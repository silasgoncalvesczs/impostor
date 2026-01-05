const socket = io();
let euSouMestre = false;
let primeiraRodada = true;
let nomePendente = '';

// Variáveis de Controle de Estado Local
let qtdJogadoresSetup = 4; // Controle da tela de cadastro (Setup)
let qtdImpostoresAtual = 1; // Controle do Painel do Mestre
let maxImpostoresPermitido = 1; // Limite calculado dinamicamente

const CATEGORIAS_DISPONIVEIS = [
    "Objetos do cotidiano", "Pessoas famosas", "Comidas e Bebidas",
    "Marcas e Logotipos", "Países e Cidades", "Hobbies e Atividades",
    "Filmes e Séries", "Profissões", "Esportes"
];

// Elementos DOM (Cache)
const telas = {
    setup: document.getElementById('telaSetup'),
    selecao: document.getElementById('telaSelecao'),
    mestre: document.getElementById('telaMestre'),
    jogo: document.getElementById('telaJogo')
};

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa a tela de setup
    atualizarInputsNomes();
    gerarCheckboxesCategorias();

    // Recupera status local (Reconexão/Refresh)
    if (localStorage.getItem('impostor_sou_mestre') === 'true') {
        euSouMestre = true;
    }
    const nomeSalvo = localStorage.getItem('impostor_meu_nome');
    if (nomeSalvo && !euSouMestre) {
        socket.emit('escolherNome', nomeSalvo);
    }

    // --- LISTENERS: TELA DE SETUP (+ e - Jogadores) ---
    document.getElementById('btnMenos').addEventListener('click', () => {
        if (qtdJogadoresSetup > 3) {
            qtdJogadoresSetup--;
            atualizarInputsNomes();
        }
    });

    document.getElementById('btnMais').addEventListener('click', () => {
        if (qtdJogadoresSetup < 20) {
            qtdJogadoresSetup++;
            atualizarInputsNomes();
        }
    });

    // --- LISTENERS: PAINEL DO MESTRE ---

    // Botões de Link
    document.getElementById('btnCopiar').addEventListener('click', copiarLink);
    document.getElementById('btnShare').addEventListener('click', compartilharLink);

    // Controle de Impostores (+ e -)
    document.getElementById('btnMenosImp').addEventListener('click', () => {
        if (qtdImpostoresAtual > 1) {
            qtdImpostoresAtual--;
            atualizarDisplayImpostores();
        }
    });

    document.getElementById('btnMaisImp').addEventListener('click', () => {
        if (qtdImpostoresAtual < maxImpostoresPermitido) {
            qtdImpostoresAtual++;
            atualizarDisplayImpostores();
        } else {
            // Feedback visual de erro (pisca vermelho)
            const display = document.getElementById('displayQtdImp');
            display.style.color = '#ff4444';
            setTimeout(() => display.style.color = 'white', 300);
        }
    });

    // --- LISTENERS: GERAIS ---
    document.getElementById('btnCriarSala').addEventListener('click', criarSala);
    document.getElementById('btnIniciarRodada').addEventListener('click', iniciarRodada);
    document.getElementById('btnSairSala').addEventListener('click', () => location.reload());

    // Botão Encerrar
    document.getElementById('btnEncerrar').addEventListener('click', () => {
        if (confirm("Tem certeza? Isso vai desconectar todos os jogadores.")) {
            socket.emit('encerrarJogo');
        }
    });

    // Modal de Confirmação
    document.getElementById('btnCancelar').addEventListener('click', fecharModal);
    document.getElementById('btnConfirmar').addEventListener('click', confirmarEntrada);
});


// --- LÓGICA: TELA DE SETUP (INPUTS INTELIGENTES) ---
function actualizarInputsNomes() { // Nota: Mantive o nome da função conforme lógica anterior
    atualizarInputsNomes();
}

function atualizarInputsNomes() {
    const container = document.getElementById('listaInputsNomes');
    const display = document.getElementById('displayQtd');

    // Atualiza o visor numérico
    display.innerText = qtdJogadoresSetup;

    const inputsExistentes = container.children.length;
    const diferenca = qtdJogadoresSetup - inputsExistentes;

    if (diferenca > 0) {
        // Adiciona novos campos
        for (let i = 0; i < diferenca; i++) {
            const novoIndex = inputsExistentes + i + 1;
            const input = document.createElement('input');
            input.type = "text";
            input.className = "input-nome";
            input.placeholder = `Nome do Jogador ${novoIndex}`;

            // Foca suavemente no primeiro novo input
            if (i === 0) setTimeout(() => input.focus(), 50);
            container.appendChild(input);
        }
    } else if (diferenca < 0) {
        // Remove os últimos campos
        for (let i = 0; i < Math.abs(diferenca); i++) {
            if (container.lastChild) {
                container.removeChild(container.lastChild);
            }
        }
    }
}


// --- SOCKET LISTENERS ---

socket.on('jogoEncerrado', () => {
    localStorage.removeItem('impostor_sou_mestre');
    localStorage.removeItem('impostor_meu_nome');
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
    const elCat = document.getElementById('minhaCategoria'); // Novo elemento

    elBadge.innerText = dados.papel;
    elInfo.innerText = dados.info;
    elCat.innerText = dados.categoria || ""; // Mostra a categoria

    if (dados.papel === "IMPOSTOR") {
        elBadge.className = "role-badge impostor-badge";
        elInfo.style.color = "#e94560";
        elCat.style.color = "#666"; // Impostor vê "???" mais apagado
    } else {
        elBadge.className = "role-badge cidadao-badge";
        elInfo.style.color = "#ffffff";
        elCat.style.color = "#4effef"; // Cidadão vê a categoria em destaque
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


// --- FUNÇÕES DE AÇÃO ---

function criarSala() {
    const inputs = document.querySelectorAll('.input-nome');
    const nomes = Array.from(inputs).map(input => input.value).filter(v => v !== "");
    if (nomes.length < 3) return alert("Mínimo de 3 jogadores!");

    socket.emit('criarSala', { nomes: nomes });

    euSouMestre = true;
    localStorage.setItem('impostor_sou_mestre', 'true');
    mostrarTela('mestre');

    // Preenche o input de link
    document.getElementById('linkSala').value = window.location.href;
}

function iniciarRodada() {
    const checkboxes = document.querySelectorAll('.tag-checkbox:checked');
    const categoriasSelecionadas = Array.from(checkboxes).map(cb => cb.value);

    if (categoriasSelecionadas.length === 0) return alert("Selecione pelo menos uma categoria!");

    // Envia a quantidade de impostores definida na variável global
    socket.emit('iniciarRodada', {
        categorias: categoriasSelecionadas,
        qtdImpostores: qtdImpostoresAtual
    });

    if (primeiraRodada) {
        document.getElementById('btnIniciarRodada').innerText = "INICIAR PRÓXIMA RODADA";
        primeiraRodada = false;
    }
}


// --- FUNÇÕES AUXILIARES E UI ---

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

    // Filtra e conta online
    const jogadoresOnline = estado.jogadores.filter(j => j.socketId !== null);
    const qtdOnline = jogadoresOnline.length;

    // Atualiza contador no título
    document.getElementById('countJogadores').innerText = qtdOnline;

    estado.jogadores.forEach(j => {
        const status = j.socketId ? "<span style='color:#4effef'>Online</span>" : "<span style='color:#666'>...</span>";
        ul.innerHTML += `<li><span>${j.nome}</span> ${status}</li>`;
    });

    // --- LÓGICA DE LIMITE DE IMPOSTORES ---
    // Regra: Máximo é a metade dos jogadores online (arredondado para baixo). Minimo 1.
    maxImpostoresPermitido = Math.floor(qtdOnline / 2);
    if (maxImpostoresPermitido < 1) maxImpostoresPermitido = 1;

    // Atualiza texto de aviso
    document.getElementById('msgLimiteImpostor').innerText = `Máximo permitido: ${maxImpostoresPermitido}`;

    // Ajusta se o valor atual for maior que o permitido (ex: alguém saiu)
    if (qtdImpostoresAtual > maxImpostoresPermitido) {
        qtdImpostoresAtual = maxImpostoresPermitido;
    }
    atualizarDisplayImpostores();
}

function atualizarDisplayImpostores() {
    document.getElementById('displayQtdImp').innerText = qtdImpostoresAtual;
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

        container.appendChild(input); container.appendChild(label);
    });
}

// --- FUNÇÕES DE LINK (COPIAR E COMPARTILHAR) ---

function copiarLink() {
    const linkInput = document.getElementById('linkSala');

    // 1. Seleciona o texto (Necessário para o método antigo funcionar)
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Para funcionar bem em celulares

    // 2. Tenta copiar usando o método antigo (execCommand)
    // Este método funciona em HTTP/Rede Local (192.168.x.x), onde a API nova falha.
    try {
        const copiouSucesso = document.execCommand('copy');

        if (copiouSucesso) {
            exibirFeedbackSucesso();
        } else {
            // Se falhar, tenta o método moderno (Clipboard API) como fallback
            usarApiModerna(linkInput.value);
        }
    } catch (err) {
        // Se der erro no execCommand, tenta a API moderna
        usarApiModerna(linkInput.value);
    }
}

// Função auxiliar para tentar a API moderna (caso esteja em localhost ou HTTPS)
function usarApiModerna(texto) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(texto)
            .then(() => exibirFeedbackSucesso())
            .catch(err => {
                console.error('Falha ao copiar:', err);
                alert("O navegador bloqueou a cópia automática. O link já está selecionado, por favor copie manualmente.");
            });
    }
}

// Função para mostrar o "Vzinho" ✅
function exibirFeedbackSucesso() {
    const btn = document.getElementById('btnCopiar');
    const originalHtml = btn.innerHTML; // Salva o ícone original

    // Muda para o check verde
    btn.innerHTML = "✅";
    btn.style.borderColor = "#4effef"; // Opcional: muda a borda para verde neon

    // Volta ao normal depois de 1.5 segundos
    setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.borderColor = ""; // Reseta a borda
    }, 1500);
}

async function compartilharLink() {
    const link = document.getElementById('linkSala').value;
    const textoParaEnviar = `🕵️ Venha jogar *Quem é o Impostor?* comigo!\nEntre na sala: ${link}`;

    const shareData = {
        title: 'Quem é o Impostor?',
        text: 'Venha jogar Impostor comigo!',
        url: link
    };

    // 1. Tenta o compartilhamento nativo do celular (Geralmente requer HTTPS)
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.log('Share cancelado ou erro:', err);
        }
    }
    // 2. Fallback: Se não suportar (PC ou HTTP local), abre o WhatsApp
    else {
        const textoCodificado = encodeURIComponent(textoParaEnviar);
        const urlWhatsApp = `https://api.whatsapp.com/send?text=${textoCodificado}`;

        // Abre o WhatsApp em uma nova aba
        window.open(urlWhatsApp, '_blank');
    }
}

// --- FUNÇÕES DO MODAL ---

function abrirModalConfirmacao(nome) {
    nomePendente = nome;
    document.getElementById('nomeConfirmacao').innerText = nome;
    document.getElementById('modalConfirmacao').classList.add('mostrar');
}

function fecharModal() {
    document.getElementById('modalConfirmacao').classList.remove('mostrar');
    nomePendente = '';
}

function confirmarEntrada() {
    if (nomePendente) {
        socket.emit('escolherNome', nomePendente);
        fecharModal();
    }
}