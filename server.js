const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bancoPalavras = require('./palavras');

app.use(express.static('public'));

// Estado Global (Em memória)
let estadoJogo = {
    criado: false,
    jogadores: [], // { nome, socketId, papel, info, categoriaExibida }
    config: {},
    rodadaAtiva: false
};

io.on('connection', (socket) => {
    // Ao conectar, envia o estado atual para o cliente se situar
    socket.emit('estadoAtual', estadoJogo);

    // --- SETUP: MESTRE CRIA SALA ---
    socket.on('criarSala', (dados) => {
        estadoJogo = {
            criado: true,
            jogadores: dados.nomes.map(nome => ({
                nome: nome,
                socketId: null,
                papel: null,
                info: null,
                categoriaExibida: null
            })),
            config: {},
            rodadaAtiva: false
        };
        io.emit('estadoAtual', estadoJogo);
    });

    // --- LOGIN: JOGADOR ESCOLHE AVATAR ---
    socket.on('escolherNome', (nome) => {
        const jogador = estadoJogo.jogadores.find(j => j.nome === nome);

        // Permite login se o nome existe e não tem ninguém conectado nele (ou reconexão)
        if (jogador && (!jogador.socketId || jogador.socketId === socket.id)) {
            jogador.socketId = socket.id;
            socket.emit('loginSucesso', { nome });
            io.emit('estadoAtual', estadoJogo);

            // Se reconectou no meio de uma rodada, reenvia a carta
            if (estadoJogo.rodadaAtiva && jogador.papel) {
                enviarCarta(socket, jogador);
            }
        }
    });

    // --- GAME: INICIAR RODADA ---
    socket.on('iniciarRodada', (config) => {
        const catsValidas = config.categorias.filter(c => bancoPalavras[c]);
        const catSorteada = catsValidas[Math.floor(Math.random() * catsValidas.length)] || "Objetos do cotidiano";

        const listaPalavras = bancoPalavras[catSorteada];
        const palavraSecreta = listaPalavras[Math.floor(Math.random() * listaPalavras.length)];

        // Filtra e embaralha jogadores online
        let onlines = estadoJogo.jogadores.filter(j => j.socketId !== null);
        onlines = embaralharArray(onlines);

        const qtdImpostores = Math.min(config.qtdImpostores, Math.max(1, Math.floor(onlines.length / 2)));

        // Distribui Papéis
        onlines.forEach((jog, idx) => {
            const ehImpostor = idx < qtdImpostores;
            jog.papel = ehImpostor ? "IMPOSTOR" : "CIDADÃO";
            jog.info = ehImpostor ? "Descubra a palavra!" : palavraSecreta;
            jog.categoriaExibida = ehImpostor ? "???" : catSorteada;
        });

        // Envia para todos
        onlines.forEach(jog => enviarCarta(io.to(jog.socketId), jog));

        estadoJogo.rodadaAtiva = true;
        io.emit('rodadaIniciada');
    });

    // --- GAME: RESET ---
    socket.on('encerrarJogo', () => {
        estadoJogo = { criado: false, jogadores: [], config: {}, rodadaAtiva: false };
        io.emit('jogoEncerrado');
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        const jogador = estadoJogo.jogadores.find(j => j.socketId === socket.id);
        if (jogador) {
            jogador.socketId = null;
            io.emit('estadoAtual', estadoJogo);
        }
    });
});

// Helper: Envio de carta padronizado
function enviarCarta(destino, jogador) {
    destino.emit('receberCarta', {
        papel: jogador.papel,
        info: jogador.info,
        categoria: jogador.categoriaExibida
    });
}

// Helper: Fisher-Yates Shuffle
function embaralharArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));