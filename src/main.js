import { novoJogo, jogadorAtual, ehBot } from './engine/state.js';
import { reduzir } from './engine/machine.js';
import { salvar, carregar, limpar } from './storage/persist.js';
import { viewMenu, viewJogo } from './ui/views.js';
import { MAX_JOGADORES, PERFIS_BOT } from './engine/config.js';
import { NUM_CASAS, coordenadas } from './engine/board.js';
import { dadoHtml } from './ui/components/dado.js';

const app = document.getElementById('app');
let estado = null;
const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function render({ focar = false } = {}) {
  app.innerHTML = estado ? viewJogo(estado) : viewMenu({ salvo: carregar() });
  if (focar) document.getElementById('painel')?.focus({ preventScroll: true });
}

function aplicarEstado(novo) {
  estado = novo;
  // O rival decide assim que cai numa casa de Decisão; a pessoa vê direto o resultado dele.
  if (estado.fase === 'ESCOLHER_METRICA' && ehBot(jogadorAtual(estado))) estado = reduzir(estado, { tipo: 'DECIDIR_BOT' });
  if (estado.fase === 'FIM_DE_JOGO') limpar();
  else salvar(estado);
  render({ focar: true });
  window.scrollTo({ top: 0 });
}

function despachar(acao) {
  const novo = reduzir(estado, acao);
  if (novo === estado) return;
  aplicarEstado(novo);
}

function iniciar(form) {
  const dados = new FormData(form);
  const solo = dados.get('modo') === 'solo';
  const n = solo ? 1 : Math.min(MAX_JOGADORES, Math.max(1, Number(dados.get('n'))));
  const jogadores = Array.from({ length: n }, (_, i) => ({
    nome: String(dados.get(`nome_${i}`)).trim() || `Jogador ${i + 1}`,
    nivel: dados.get(`nivel_${i}`) === 'avancado' ? 'avancado' : 'iniciante',
  }));
  // Solo é o competitivo contra um rival do computador, no mesmo nível da pessoa (mesmo valor das casas).
  if (solo) {
    const perfil = Object.hasOwn(PERFIS_BOT, dados.get('bot')) ? dados.get('bot') : 'medio';
    jogadores.push({ nome: `Rival ${PERFIS_BOT[perfil].nome}`, nivel: jogadores[0].nivel, bot: perfil });
  }
  const seedTexto = String(dados.get('seed')).trim();
  estado = novoJogo({
    jogadores,
    turnos: Number(dados.get('turnos')),
    modo: dados.get('modo') === 'cooperativo' ? 'cooperativo' : 'competitivo',
    seed: seedTexto ? Number(seedTexto) : Math.floor(Math.random() * 2 ** 32),
  });
  salvar(estado);
  render({ focar: true });
}

// Gira os dados e, ao fim, fixa as faces no resultado real (que já foi sorteado),
// mostrando a soma por um instante antes de o peão andar.
function girarDados(giro, [d1, d2], total) {
  return new Promise((resolve) => {
    const dados = giro.querySelectorAll('.dado');
    let tiques = 0;
    const intervalo = setInterval(() => {
      tiques += 1;
      if (tiques >= 6) {
        clearInterval(intervalo);
        dados[0].dataset.face = String(d1);
        dados[1].dataset.face = String(d2);
        dados.forEach((d) => d.classList.remove('dado-girando'));
        giro.querySelector('.dado-total').textContent = `= ${total}`;
        giro.setAttribute('aria-label', `Dados: ${d1} e ${d2}, total ${total}`);
        setTimeout(resolve, 700);
        return;
      }
      dados.forEach((d) => { d.dataset.face = String(1 + Math.floor(Math.random() * 6)); });
    }, 90);
  });
}

// Salta o peão do jogador casa a casa, da posição antiga até a nova (puramente cosmético).
function andarPeao(jogador, posicaoInicial, passos) {
  return new Promise((resolve) => {
    const tabuleiroEl = app.querySelector('.tabuleiro');
    if (!tabuleiroEl || semMovimento() || passos <= 0) {
      resolve(null);
      return;
    }
    app.querySelectorAll(`.peao.p${jogador.id}`).forEach((p) => { p.style.visibility = 'hidden'; });
    const letra = jogador.nome.trim().charAt(0).toUpperCase() || '?';
    const fantasma = document.createElement('span');
    fantasma.className = `peao p${jogador.id}`;
    fantasma.title = jogador.nome;
    fantasma.textContent = letra;
    tabuleiroEl.appendChild(fantasma);

    let passo = 0;
    const passar = () => {
      const indice = (posicaoInicial + passo) % NUM_CASAS;
      const { linha, coluna } = coordenadas(indice);
      fantasma.style.gridRow = String(linha);
      fantasma.style.gridColumn = String(coluna);
      fantasma.classList.remove('peao-fantasma');
      void fantasma.offsetWidth; // reflow para reiniciar a animação de salto
      fantasma.classList.add('peao-fantasma');
      passo += 1;
      if (passo <= passos) {
        setTimeout(passar, 160);
      } else {
        setTimeout(() => { fantasma.remove(); resolve(null); }, 160);
      }
    };
    passar();
  });
}

async function rolarComAnimacao(botao, acao) {
  botao.disabled = true;
  const anterior = estado;
  const jogador = anterior.jogadores[anterior.jogadorAtual];
  const posicaoInicial = jogador.posicao;
  // O resultado já é sorteado aqui (determinístico pela seed); a animação só o revela aos poucos.
  const novo = reduzir(anterior, { tipo: acao });
  if (novo === anterior) {
    botao.disabled = false;
    return;
  }
  const centro = app.querySelector('.centro');
  if (!centro || semMovimento()) {
    aplicarEstado(novo);
    return;
  }
  const giro = document.createElement('div');
  giro.className = 'dados-par';
  giro.innerHTML = `${dadoHtml(1)}${dadoHtml(1)}<span class="dado-total"></span>`;
  giro.querySelectorAll('.dado').forEach((d) => d.classList.add('dado-girando'));
  centro.appendChild(giro);

  await girarDados(giro, novo.dados, novo.dado);
  giro.remove();
  await andarPeao(jogador, posicaoInicial, novo.dado);
  aplicarEstado(novo);
}

app.addEventListener('click', (ev) => {
  const botao = ev.target.closest('[data-acao]');
  if (!botao) return;
  const { acao, valor } = botao.dataset;
  if (acao === 'ROLAR') {
    rolarComAnimacao(botao, acao);
  } else if (acao === 'NOVA') {
    if (estado && estado.fase !== 'FIM_DE_JOGO' && !confirm('Abandonar a partida atual?')) return;
    limpar();
    estado = null;
    render();
  } else if (acao === 'ABRIR_CONFIG') {
    const form = document.getElementById('form-menu');
    form.hidden = false;
    botao.hidden = true;
    botao.setAttribute('aria-expanded', 'true');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.querySelector('input')?.focus({ preventScroll: true });
  } else if (acao === 'CONTINUAR_SALVA') {
    estado = carregar();
    render({ focar: true });
  } else {
    despachar({ tipo: acao, valor });
  }
});

app.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'form-menu') return;
  ev.preventDefault();
  iniciar(ev.target);
});

// No solo só a pessoa preenche o cadastro; o número de CEOs dá lugar à escolha do rival.
app.addEventListener('change', (ev) => {
  if (ev.target.name !== 'n' && ev.target.name !== 'modo') return;
  const form = ev.target.form;
  const solo = form.elements.modo.value === 'solo';
  const n = solo ? 1 : Number(form.elements.n.value);
  form.querySelector('[data-campo="n"]').hidden = solo;
  form.querySelector('[data-campo="bot"]').hidden = !solo;
  app.querySelectorAll('fieldset[data-jogador]').forEach((f) => {
    f.hidden = Number(f.dataset.jogador) >= n;
  });
});

render();
