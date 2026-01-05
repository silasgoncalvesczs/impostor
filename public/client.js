const socket = io();
let euSouMestre = false;
let primeiraRodada = true;
let nomePendente = '';

const CATEGORIAS_DISPONIVEIS = [
    "Objetos do cotidiano", "Pessoas famosas", "Comidas e Bebidas",
    "Marcas e Logotipos", "Países e Cidades", "Hobbies e Atividades",
    "Filmes e Séries", "Profissões", "Esportes"
];

// Elementos DOM
const telas = {
    setup: document.getElementById('telaSetup'),
    selecao: document.getElementById('telaSelecao'),
    mestre: document.getElementById('telaMestre'),
    jogo: document.getElementById('telaJogo')
};

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    gerarInputsNomes();
    gerarCheckboxesCategorias();

    // Recupera status de mestre
    if (localStorage.getItem('impostor_sou_mestre') === 'true') {
        euSouMestre = true;
    }

    // Tenta reconectar jogador (se não for mestre)
    const nomeSalvo = localStorage.getItem('impostor_meu_nome');
    if (nomeSalvo && !euSouMestre) {
        socket.emit('escolherNome', nomeSalvo);
    }

    // Event Listeners
    document.getElementById('qtdJogadores').addEventListener('change', gerarInputsNomes);
    document.getElementById('btnCriarSala').addEventListener('click', criarSala);
    document.getElementById('linkSala').addEventListener('click', function () { this.select(); });
    document.getElementById('btnIniciarRodada').addEventListener('click', iniciarRodada);
    document.getElementById('btnSairSala').addEventListener('click', () => location.reload());

    // Botão Encerrar (Avisa o servidor)
    document.getElementById('btnEncerrar').addEventListener('click', () => {
        if (confirm("Tem certeza? Isso vai desconectar todos os jogadores.")) {
            socket.emit('encerrarJogo');
            // Não fazemos reload aqui direto, esperamos o servidor confirmar com 'jogoEncerrado'
        }
    });

    // Modal
    document.getElementById('btnCancelar').addEventListener('click', fecharModal);
    document.getElementById('btnConfirmar').addEventListener('click', confirmarEntrada);
});

// --- Socket Listeners ---

socket.on('jogoEncerrado', () => {
    // Limpa os dados locais
    localStorage.removeItem('impostor_sou_mestre');
    localStorage.removeItem('impostor_meu_nome');

    // Recarrega a página (Agora o servidor dirá que criado = false, então volta pro Setup)
    location.reload();
});

socket.on('estadoAtual', (estado) => {
    if (!estado.criado) {
        mostrarTela('setup');
        return;
    }

    if (euSouMestre) {
        mostrarTela('mestre');
        atualizarPainelMestre(estado);
        return;
    }

    // Se a rodada está ativa e já tenho papel, fico no jogo
    const textoCarta = document.getElementById('minhaInfo').innerText;
    if (estado.rodadaAtiva && textoCarta !== "...") {
        mostrarTela('jogo');
        return;
    }

    // Caso contrário, vou para seleção
    mostrarTela('selecao');
    renderizarListaNomes(estado.jogadores);
});

socket.on('receberCarta', (dados) => {
    mostrarTela('jogo');
    const elBadge = document.getElementById('badgePapel');
    const elInfo = document.getElementById('minhaInfo');

    elBadge.innerText = dados.papel;
    elInfo.innerText = dados.info;

    if (dados.papel === "IMPOSTOR") {
        elBadge.className = "role-badge impostor-badge";
        elInfo.style.color = "#e94560";
    } else {
        elBadge.className = "role-badge cidadao-badge";
        elInfo.style.color = "#ffffff";
    }

    if (euSouMestre) {
        document.getElementById('msgMestre').classList.remove('hidden');
    }
});

socket.on('loginSucesso', (dados) => {
    localStorage.setItem('impostor_meu_nome', dados.nome);
    document.querySelector('#telaSelecao').innerHTML = `
        <div style="margin-top: 50px;">
            <h3>Olá, ${dados.nome}!</h3>
            <p>👀 De olho na tela...</p>
            <p style="color:#aaa;">O Mestre vai iniciar a rodada em breve.</p>
        </div>
    `;
});

// --- Funções de Ação ---

function criarSala() {
    const inputs = document.querySelectorAll('.input-nome');
    const nomes = Array.from(inputs).map(input => input.value).filter(v => v !== "");

    if (nomes.length < 3) return alert("Mínimo de 3 jogadores!");

    socket.emit('criarSala', { nomes: nomes });

    euSouMestre = true;
    localStorage.setItem('impostor_sou_mestre', 'true');
    mostrarTela('mestre');
    document.getElementById('linkSala').value = window.location.href;
}

function iniciarRodada() {
    const checkboxes = document.querySelectorAll('.tag-checkbox:checked');
    const categoriasSelecionadas = Array.from(checkboxes).map(cb => cb.value);

    if (categoriasSelecionadas.length === 0) return alert("Selecione pelo menos uma categoria!");

    const radioImp = document.querySelector('input[name="radImp"]:checked');
    const qtdImp = radioImp ? parseInt(radioImp.value) : 1;

    socket.emit('iniciarRodada', { categorias: categoriasSelecionadas, qtdImpostores: qtdImp });

    if (primeiraRodada) {
        document.getElementById('btnIniciarRodada').innerText = "INICIAR PRÓXIMA RODADA";
        primeiraRodada = false;
    }
}

// --- Helpers e UI ---

function mostrarTela(id) {
    Object.values(telas).forEach(t => t.classList.add('hidden'));
    telas[id].classList.remove('hidden');
}

function renderizarListaNomes(jogadores) {
    const div = document.getElementById('listaNomesDisponiveis');
    div.innerHTML = "";
    jogadores.forEach(j => {
        const ocupado = j.socketId !== null;
        const btn = document.createElement('button');
        btn.className = `btn-nome ${ocupado ? 'ocupado' : ''}`;

        if (ocupado) {
            btn.innerHTML = `👤 ${j.nome} <span style="font-size:12px; float:right; margin-top:4px;">(Já entrou)</span>`;
            btn.disabled = true;
        } else {
            btn.innerHTML = `👉 Entrar como <b>${j.nome}</b>`;
            btn.onclick = () => abrirModalConfirmacao(j.nome);
        }
        div.appendChild(btn);
    });
}

function atualizarPainelMestre(estado) {
    const ul = document.getElementById('statusJogadores');
    ul.innerHTML = "";
    estado.jogadores.forEach(j => {
        const status = j.socketId ? "<span style='color:#4effef'>Online</span>" : "<span style='color:#666'>...</span>";
        ul.innerHTML += `<li><span>${j.nome}</span> ${status}</li>`;
    });
}

function gerarInputsNomes() {
    const qtd = document.getElementById('qtdJogadores').value;
    const container = document.getElementById('listaInputsNomes');
    container.innerHTML = "";
    for (let i = 0; i < qtd; i++) {
        const input = document.createElement('input');
        input.type = "text";
        input.className = "input-nome";
        input.placeholder = `Nome do Jogador ${i + 1}`;
        container.appendChild(input);
    }
}

function gerarCheckboxesCategorias() {
    const container = document.getElementById('containerCategorias');
    container.innerHTML = "";
    CATEGORIAS_DISPONIVEIS.forEach((cat, index) => {
        const id = `cat-${index}`;
        const input = document.createElement('input');
        input.type = "checkbox"; input.id = id; input.value = cat; input.className = "tag-checkbox";
        if (index === 0) input.checked = true;

        const label = document.createElement('label');
        label.htmlFor = id; label.className = "tag-label"; label.innerText = cat;

        container.appendChild(input);
        container.appendChild(label);
    });
}

// --- Funções do Modal ---

function abrirModalConfirmacao(nome) {
    nomePendente = nome;
    document.getElementById('nomeConfirmacao').innerText = nome;
    document.getElementById('modalConfirmacao').classList.add('mostrar'); // Adiciona classe para exibir
}

function fecharModal() {
    document.getElementById('modalConfirmacao').classList.remove('mostrar'); // Remove classe para esconder
    nomePendente = '';
}

function confirmarEntrada() {
    if (nomePendente) {
        socket.emit('escolherNome', nomePendente);
        fecharModal();
    }
}