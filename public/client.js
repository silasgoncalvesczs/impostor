const socket = io();

// Estado Global do Cliente
const state = {
    euSouMestre: false,
    primeiraRodada: true,
    nomePendente: '',
    qtdJogadoresSetup: 4,
    qtdImpostoresAtual: 1,
    maxImpostoresPermitido: 1
};

// Cache de Elementos DOM (Performance)
const EL = {
    telas: {
        setup: document.getElementById('telaSetup'),
        selecao: document.getElementById('telaSelecao'),
        mestre: document.getElementById('telaMestre'),
        jogo: document.getElementById('telaJogo')
    },
    setup: {
        listaInputs: document.getElementById('listaInputsNomes'),
        displayQtd: document.getElementById('displayQtd'),
        btnCriar: document.getElementById('btnCriarSala')
    },
    mestre: {
        linkInput: document.getElementById('linkSala'),
        listaJogadores: document.getElementById('statusJogadores'),
        countJogadores: document.getElementById('countJogadores'),
        categoriasContainer: document.getElementById('containerCategorias'),
        displayImp: document.getElementById('displayQtdImp'),
        msgLimite: document.getElementById('msgLimiteImpostor'),
        btnIniciar: document.getElementById('btnIniciarRodada')
    },
    jogo: {
        carta: document.getElementById('cartaJogo'),
        badge: document.getElementById('badgePapel'),
        info: document.getElementById('minhaInfo'),
        categoria: document.getElementById('minhaCategoria'),
        msgMestre: document.getElementById('msgMestre')
    },
    modal: {
        overlay: document.getElementById('modalConfirmacao'),
        nome: document.getElementById('nomeConfirmacao')
    }
};

const CATEGORIAS = [
    "Objetos do cotidiano", "Pessoas famosas", "Comidas e Bebidas",
    "Marcas e Logotipos", "Países e Cidades", "Hobbies e Atividades",
    "Filmes e Séries", "Profissões", "Esportes"
];

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    initSetup();
    initListeners();
    checkLocalStorage();
});

function initSetup() {
    atualizarInputsNomes();
    gerarCategorias();
}

function checkLocalStorage() {
    if (localStorage.getItem('impostor_sou_mestre') === 'true') {
        state.euSouMestre = true;
    }
    const nomeSalvo = localStorage.getItem('impostor_meu_nome');
    if (nomeSalvo && !state.euSouMestre) {
        socket.emit('escolherNome', nomeSalvo);
    }
}

function initListeners() {
    // Tela Setup
    document.getElementById('btnMenos').onclick = () => alterarQtdJogadores(-1);
    document.getElementById('btnMais').onclick = () => alterarQtdJogadores(1);
    EL.setup.btnCriar.onclick = criarSala;

    // Tela Mestre
    document.getElementById('btnCopiar').onclick = copiarLink;
    document.getElementById('btnShare').onclick = compartilharLink;
    document.getElementById('btnMenosImp').onclick = () => alterarQtdImpostores(-1);
    document.getElementById('btnMaisImp').onclick = () => alterarQtdImpostores(1);
    EL.mestre.btnIniciar.onclick = iniciarRodada;
    document.getElementById('btnEncerrar').onclick = encerrarJogo;

    // Tela Jogo
    EL.jogo.carta.onclick = function () { this.classList.toggle('is-flipped'); };
    document.getElementById('btnSairSala').onclick = () => location.reload();

    // Modal
    document.getElementById('btnCancelar').onclick = fecharModal;
    document.getElementById('btnConfirmar').onclick = confirmarEntrada;
}

// --- Funções Lógicas ---

function alterarQtdJogadores(delta) {
    const novaQtd = state.qtdJogadoresSetup + delta;
    if (novaQtd >= 3 && novaQtd <= 20) {
        state.qtdJogadoresSetup = novaQtd;
        atualizarInputsNomes();
    }
}

function atualizarInputsNomes() {
    EL.setup.displayQtd.innerText = state.qtdJogadoresSetup;
    const inputsExistentes = EL.setup.listaInputs.children.length;
    const diferenca = state.qtdJogadoresSetup - inputsExistentes;

    if (diferenca > 0) {
        for (let i = 0; i < diferenca; i++) {
            const input = document.createElement('input');
            input.type = "text";
            input.className = "input-nome";
            input.placeholder = `Nome do Jogador ${inputsExistentes + i + 1}`;
            if (i === 0) setTimeout(() => input.focus(), 50);
            EL.setup.listaInputs.appendChild(input);
        }
    } else {
        for (let i = 0; i < Math.abs(diferenca); i++) {
            if (EL.setup.listaInputs.lastChild) {
                EL.setup.listaInputs.removeChild(EL.setup.listaInputs.lastChild);
            }
        }
    }
}

function alterarQtdImpostores(delta) {
    const novaQtd = state.qtdImpostoresAtual + delta;
    if (novaQtd >= 1 && novaQtd <= state.maxImpostoresPermitido) {
        state.qtdImpostoresAtual = novaQtd;
        EL.mestre.displayImp.innerText = state.qtdImpostoresAtual;
    } else if (delta > 0) {
        EL.mestre.displayImp.style.color = '#ff4444';
        setTimeout(() => EL.mestre.displayImp.style.color = 'white', 300);
    }
}

function criarSala() {
    const inputs = document.querySelectorAll('.input-nome');
    const nomes = Array.from(inputs).map(inp => inp.value.trim()).filter(v => v !== "");

    if (nomes.length < 3) return alert("Mínimo de 3 jogadores!");

    socket.emit('criarSala', { nomes });
    state.euSouMestre = true;
    localStorage.setItem('impostor_sou_mestre', 'true');

    mostrarTela('mestre');
    EL.mestre.linkInput.value = window.location.href;
}

function iniciarRodada() {
    const checkboxes = document.querySelectorAll('.tag-checkbox:checked');
    const categoriasSelecionadas = Array.from(checkboxes).map(cb => cb.value);

    if (categoriasSelecionadas.length === 0) return alert("Selecione pelo menos uma categoria!");

    socket.emit('iniciarRodada', {
        categorias: categoriasSelecionadas,
        qtdImpostores: state.qtdImpostoresAtual
    });

    if (state.primeiraRodada) {
        EL.mestre.btnIniciar.innerText = "INICIAR PRÓXIMA RODADA";
        state.primeiraRodada = false;
    }
}

function encerrarJogo() {
    if (confirm("Encerrar desconecta todos os jogadores. Confirmar?")) {
        socket.emit('encerrarJogo');
    }
}

// --- Socket Events ---

socket.on('jogoEncerrado', () => {
    localStorage.removeItem('impostor_sou_mestre');
    localStorage.removeItem('impostor_meu_nome');
    location.reload();
});

socket.on('estadoAtual', (estado) => {
    if (!estado.criado) return mostrarTela('setup');

    if (state.euSouMestre) {
        mostrarTela('mestre');
        atualizarPainelMestre(estado);
        return;
    }

    const jaTenhoCarta = EL.jogo.info.innerText !== "...";
    if (estado.rodadaAtiva && jaTenhoCarta) {
        mostrarTela('jogo');
    } else {
        mostrarTela('selecao');
        renderizarListaNomes(estado.jogadores);
    }
});

socket.on('receberCarta', (dados) => {
    mostrarTela('jogo');
    const { carta, badge, info, categoria, msgMestre } = EL.jogo;
    const estaAberta = carta.classList.contains('is-flipped');

    const atualizarUI = () => {
        badge.innerText = dados.papel;
        info.innerText = dados.info;
        categoria.innerText = dados.categoria || "";

        if (dados.papel === "IMPOSTOR") {
            badge.className = "role-badge impostor-badge";
            info.style.color = "#e94560";
            categoria.style.color = "#666";
        } else {
            badge.className = "role-badge cidadao-badge";
            info.style.color = "#ffffff";
            categoria.style.color = "#4effef";
        }
    };

    if (estaAberta) {
        carta.classList.remove('is-flipped');
        setTimeout(atualizarUI, 300); // Aguarda metade da animação (flip)
    } else {
        atualizarUI();
    }

    if (state.euSouMestre) msgMestre.classList.remove('hidden');
});

socket.on('loginSucesso', (dados) => {
    localStorage.setItem('impostor_meu_nome', dados.nome);
    EL.telas.selecao.innerHTML = `
        <div style="margin-top: 50px;">
            <h3>Olá, ${dados.nome}!</h3>
            <p>👀 Aguarde...</p>
            <p style="color:#aaa;">O Mestre iniciará a rodada.</p>
        </div>
    `;
});

// --- UI Helpers ---

function mostrarTela(id) {
    Object.values(EL.telas).forEach(t => t.classList.add('hidden'));
    EL.telas[id].classList.remove('hidden');
}

function renderizarListaNomes(jogadores) {
    const div = document.getElementById('listaNomesDisponiveis');
    div.innerHTML = "";
    jogadores.forEach(j => {
        const ocupado = j.socketId !== null;
        const btn = document.createElement('button');
        btn.className = `btn-nome ${ocupado ? 'ocupado' : ''}`;

        if (ocupado) {
            btn.innerHTML = `👤 ${j.nome} <span class="sm-text" style="float:right;">(Entrou)</span>`;
            btn.disabled = true;
        } else {
            btn.innerHTML = `👉 Entrar como <b>${j.nome}</b>`;
            btn.onclick = () => abrirModalConfirmacao(j.nome);
        }
        div.appendChild(btn);
    });
}

function atualizarPainelMestre(estado) {
    EL.mestre.listaJogadores.innerHTML = "";
    const online = estado.jogadores.filter(j => j.socketId !== null);

    EL.mestre.countJogadores.innerText = online.length;

    estado.jogadores.forEach(j => {
        const status = j.socketId ? "<span class='text-accent'>Online</span>" : "<span class='text-muted'>...</span>";
        EL.mestre.listaJogadores.innerHTML += `<li><span>${j.nome}</span> ${status}</li>`;
    });

    state.maxImpostoresPermitido = Math.max(1, Math.floor(online.length / 2));
    EL.mestre.msgLimite.innerText = `Máximo: ${state.maxImpostoresPermitido}`;

    if (state.qtdImpostoresAtual > state.maxImpostoresPermitido) {
        state.qtdImpostoresAtual = state.maxImpostoresPermitido;
    }
    EL.mestre.displayImp.innerText = state.qtdImpostoresAtual;
}

function gerarCategorias() {
    EL.mestre.categoriasContainer.innerHTML = "";
    CATEGORIAS.forEach((cat, idx) => {
        const id = `cat-${idx}`;
        const input = document.createElement('input');
        input.type = "checkbox"; input.id = id; input.value = cat; input.className = "tag-checkbox";
        if (idx === 0) input.checked = true;

        const label = document.createElement('label');
        label.htmlFor = id; label.className = "tag-label"; label.innerText = cat;
        EL.mestre.categoriasContainer.append(input, label);
    });
}

// --- Shared & Modal ---
function copiarLink() {
    EL.mestre.linkInput.select();
    EL.mestre.linkInput.setSelectionRange(0, 99999);
    try {
        if (document.execCommand('copy')) return feedbackSucesso();
        usarClipboardApi();
    } catch { usarClipboardApi(); }
}

function usarClipboardApi() {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(EL.mestre.linkInput.value)
            .then(feedbackSucesso)
            .catch(() => alert("Copie o link manualmente."));
    }
}

function feedbackSucesso() {
    const btn = document.getElementById('btnCopiar');
    const htmlOriginal = btn.innerHTML;
    btn.innerHTML = "✅";
    setTimeout(() => btn.innerHTML = htmlOriginal, 1500);
}

async function compartilharLink() {
    const link = EL.mestre.linkInput.value;
    const data = { title: 'Impostor', text: 'Venha jogar!', url: link };
    if (navigator.share) {
        try { await navigator.share(data); } catch { }
    } else {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('🕵️ Jogue Impostor: ' + link)}`, '_blank');
    }
}

function abrirModalConfirmacao(nome) {
    state.nomePendente = nome;
    EL.modal.nome.innerText = nome;
    EL.modal.overlay.classList.add('mostrar');
}

function fecharModal() {
    EL.modal.overlay.classList.remove('mostrar');
    state.nomePendente = '';
}

function confirmarEntrada() {
    if (state.nomePendente) {
        socket.emit('escolherNome', state.nomePendente);
        fecharModal();
    }
}