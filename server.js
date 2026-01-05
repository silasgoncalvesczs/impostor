const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bancoPalavras = require('./palavras'); // Importa as categorias

app.use(express.static('public'));

// Estado Global do Jogo
let estadoJogo = {
    criado: false,
    jogadores: [], // Formato: { nome: "João", socketId: null (livre) ou "xyz" (ocupado), papel: null }
    config: {},    // Categoria, qtd impostores
    rodadaAtiva: false
};

io.on('connection', (socket) => {

    // Assim que conecta, envia o estado atual para saber qual tela mostrar
    socket.emit('estadoAtual', estadoJogo);

    // MESTRE: Cria a configuração da sala
    socket.on('criarSala', (dados) => {
        estadoJogo.criado = true;
        estadoJogo.config = {
            categoria: dados.categoria,
            qtdImpostores: dados.qtdImpostores
        };
        // Cria a lista de jogadores baseada nos nomes que o mestre digitou
        estadoJogo.jogadores = dados.nomes.map(nome => ({
            nome: nome,
            socketId: null, // Null significa que ninguém "pegou" esse nome ainda
            papel: null,
            info: null
        }));

        io.emit('estadoAtual', estadoJogo); // Atualiza todo mundo
    });

    // JOGADOR: Escolhe um nome da lista
    socket.on('escolherNome', (nomeEscolhido) => {
        const jogador = estadoJogo.jogadores.find(j => j.nome === nomeEscolhido);

        // Verifica se o nome existe e se está livre
        if (jogador && !jogador.socketId) {
            jogador.socketId = socket.id; // Vincula o novo socket ao nome antigo

            socket.emit('loginSucesso', { nome: nomeEscolhido });
            io.emit('estadoAtual', estadoJogo);

            // RECUPERAÇÃO DE ESTADO (Se o jogo já estiver rolando)
            if (estadoJogo.rodadaAtiva && jogador.papel) {
                socket.emit('receberCarta', { papel: jogador.papel, info: jogador.info });
            }
        }
    });

    // MESTRE: Inicia a rodada
    socket.on('iniciarRodada', (dadosConfig) => {
        let listaPalavras = [];

        dadosConfig.categorias.forEach(cat => {
            if (bancoPalavras[cat]) {
                listaPalavras = listaPalavras.concat(bancoPalavras[cat]);
            }
        });

        if (listaPalavras.length === 0) {
            listaPalavras = ["Erro: Nenhuma categoria válida"];
        }

        const palavraSecreta = listaPalavras[Math.floor(Math.random() * listaPalavras.length)];

        let jogadoresOnline = estadoJogo.jogadores.filter(j => j.socketId !== null);

        jogadoresOnline.forEach(j => { j.papel = "CIDADÃO"; j.info = palavraSecreta; });

        let impostoresDefinidos = 0;
        const qtdImpostoresReal = Math.min(dadosConfig.qtdImpostores, jogadoresOnline.length - 1);

        while (impostoresDefinidos < qtdImpostoresReal) {
            let sorteado = jogadoresOnline[Math.floor(Math.random() * jogadoresOnline.length)];
            if (sorteado.papel !== "IMPOSTOR") {
                sorteado.papel = "IMPOSTOR";
                sorteado.info = "Descubra a palavra!";
                impostoresDefinidos++;
            }
        }

        jogadoresOnline.forEach(j => {
            io.to(j.socketId).emit('receberCarta', { papel: j.papel, info: j.info });
        });

        estadoJogo.rodadaAtiva = true;
        io.emit('rodadaIniciada');
    });

    // MESTRE: Reseta o jogo para todos
    socket.on('encerrarJogo', () => {
        // Zera o estado do jogo
        estadoJogo = {
            criado: false,
            jogadores: [],
            config: {},
            rodadaAtiva: false
        };
        
        // Avisa a todos os conectados que acabou
        io.emit('jogoEncerrado');
    });

    // --- CORREÇÃO AQUI: O QUE FALTAVA ---
    // Se desconectar, libera o nome para que a pessoa possa voltar
    socket.on('disconnect', () => {
        const jogador = estadoJogo.jogadores.find(j => j.socketId === socket.id);
        if (jogador) {
            jogador.socketId = null; // O nome fica "livre" de novo
            io.emit('estadoAtual', estadoJogo); // Avisa a todos que o status mudou (ficou cinza/livre)
        }
    });
});

http.listen(3000, '0.0.0.0', () => console.log('Servidor ON na porta 3000'));