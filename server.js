const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bancoPalavras = require('./palavras');

app.use(express.static('public'));

// Estado Global
let estadoJogo = {
    criado: false,
    jogadores: [],
    config: {},
    rodadaAtiva: false
};

io.on('connection', (socket) => {

    socket.emit('estadoAtual', estadoJogo);

    // MESTRE: Cria a sala
    socket.on('criarSala', (dados) => {
        estadoJogo.criado = true;
        estadoJogo.config = {
            categoria: dados.categoria,
            qtdImpostores: dados.qtdImpostores
        };
        estadoJogo.jogadores = dados.nomes.map(nome => ({
            nome: nome,
            socketId: null,
            papel: null,
            info: null
        }));
        io.emit('estadoAtual', estadoJogo);
    });

    // JOGADOR: Entra
    socket.on('escolherNome', (nomeEscolhido) => {
        const jogador = estadoJogo.jogadores.find(j => j.nome === nomeEscolhido);
        if (jogador && !jogador.socketId) {
            jogador.socketId = socket.id;
            socket.emit('loginSucesso', { nome: nomeEscolhido });
            io.emit('estadoAtual', estadoJogo);

            // Reconexão durante jogo
            if (estadoJogo.rodadaAtiva && jogador.papel) {
                socket.emit('receberCarta', {
                    papel: jogador.papel,
                    info: jogador.info
                });
            }
        }
    });

    // MESTRE: Inicia rodada
    socket.on('iniciarRodada', (dadosConfig) => {
        // 1. Filtra quais categorias do banco foram selecionadas pelo usuário
        const categoriasValidas = dadosConfig.categorias.filter(cat => bancoPalavras[cat]);

        if (categoriasValidas.length === 0) {
            // Fallback caso dê erro
            categoriasValidas.push("Objetos do cotidiano");
        }

        // 2. Sorteia UMA categoria entre as selecionadas
        const categoriaSorteada = categoriasValidas[Math.floor(Math.random() * categoriasValidas.length)];

        // 3. Pega as palavras dessa categoria específica
        const listaPalavras = bancoPalavras[categoriaSorteada];
        const palavraSecreta = listaPalavras[Math.floor(Math.random() * listaPalavras.length)];

        // Pega quem está online
        let jogadoresOnline = estadoJogo.jogadores.filter(j => j.socketId !== null);

        // --- LÓGICA DE SORTEIO (FISHER-YATES) ---
        jogadoresOnline = embaralharArray(jogadoresOnline);

        const qtdImpostoresReal = Math.min(dadosConfig.qtdImpostores, jogadoresOnline.length - 1);

        jogadoresOnline.forEach((jogador, index) => {
            if (index < qtdImpostoresReal) {
                // Impostor
                jogador.papel = "IMPOSTOR";
                jogador.info = "Descubra a palavra!";
                jogador.categoriaExibida = "???"; // O Impostor NÃO vê a categoria (ou vê, você decide)
            } else {
                // Cidadão
                jogador.papel = "CIDADÃO";
                jogador.info = palavraSecreta;
                jogador.categoriaExibida = categoriaSorteada; // Cidadão vê a categoria
            }
        });

        // Envia as cartas
        jogadoresOnline.forEach(j => {
            io.to(j.socketId).emit('receberCarta', {
                papel: j.papel,
                info: j.info,
                categoria: j.categoriaExibida // Enviamos a categoria aqui
            });
        });

        estadoJogo.rodadaAtiva = true;
        io.emit('rodadaIniciada');
    });

    // MESTRE: Encerra
    socket.on('encerrarJogo', () => {
        estadoJogo = {
            criado: false,
            jogadores: [],
            config: {},
            rodadaAtiva: false
        };
        io.emit('jogoEncerrado');
    });

    // Desconexão
    socket.on('disconnect', () => {
        const jogador = estadoJogo.jogadores.find(j => j.socketId === socket.id);
        if (jogador) {
            jogador.socketId = null;
            io.emit('estadoAtual', estadoJogo);
        }
    });
});

// Algoritmo Fisher-Yates para embaralhamento perfeito
function embaralharArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        // Gera um índice aleatório ente 0 e i
        const j = Math.floor(Math.random() * (i + 1));
        // Troca os elementos de lugar
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

http.listen(3000, '0.0.0.0', () => console.log('Servidor ON na porta 3000'));