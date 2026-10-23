import { novoJogo, jogadorAtual, ehBot } from './engine/state.js';
import { reduzir } from './engine/machine.js';
import { salvar, carregar, limpar } from './storage/persist.js';
import { viewMenu, QTD_SEMENTES, viewJogo, tabelaTsv, posicaoCss } from './ui/views.js';
import { obterCenario, todosCenarios } from './scenarios/loader.js';
import { MAX_JOGADORES, PERFIS_BOT } from './engine/config.js';
import { NUM_CASAS } from './engine/board.js';
import { ehCalculo } from './engine/calculo.js';
import { dadoHtml } from './ui/components/dado.js';
import { lerNumero } from './stats/format.js';
import { calcularOperacao, formatarResultadoCalculadora } from './engine/calculo.js';

const app = document.getElementById('app');
let estado = null;
const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function render({ focar = false } = {}) {
  app.innerHTML = estado ? viewJogo(estado) : viewMenu({ salvo: carregar() });
  if (focar) (document.getElementById('painel') ?? app.querySelector('.cta-jogar'))?.focus({ preventScroll: true });
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

// Atalhos de teste do menu: casa forçada e/ou subconjunto de cenários. `null` é a partida normal.
function lerTeste(dados) {
  const casa = String(dados.get('teste_casa'));
  const filtro = String(dados.get('teste_cenarios'));
  const todos = todosCenarios();
  const cenarios = {
    '': null,
    calculo: todos.filter(ehCalculo).map((c) => c.id),
    comuns: todos.filter((c) => !ehCalculo(c)).map((c) => c.id),
  }[filtro] ?? todos.filter((c) => c.id === filtro).map((c) => c.id);
  return { casa: ['decisao', 'evento', 'balanco'].includes(casa) ? casa : null, cenarios };
}

// Setores repetidos entre os jogadores não valem: cada setor vale para um jogador só (no cooperativo, com 3 jogadores).
function setoresRepetidos(form) {
  const modo = form.elements.modo.value;
  const n = Number(form.elements.n.value);
  if (modo === 'solo' || (modo === 'cooperativo' && n !== 3)) return false;
  const escolhas = Array.from({ length: n }, (_, i) => form.elements[`diretoria_${i}`].value);
  return new Set(escolhas).size < n;
}

// Campo numérico do menu: vazio ou inválido vira NaN, e o motor cai no padrão.
const lerInteiro = (valor) => (String(valor ?? '').trim() === '' ? NaN : Number(valor));

function iniciar(form) {
  const erro = form.querySelector('[data-erro-setor]');
  erro.hidden = !setoresRepetidos(form);
  if (!erro.hidden) return;
  const dados = new FormData(form);
  const solo = dados.get('modo') === 'solo';
  const n = solo ? 1 : Math.min(MAX_JOGADORES, Math.max(1, Number(dados.get('n'))));
  const jogadores = Array.from({ length: n }, (_, i) => ({
    nome: String(dados.get(`nome_${i}`)).trim() || `Jogador ${i + 1}`,
    nivel: dados.get(`nivel_${i}`) === 'avancado' ? 'avancado' : 'iniciante',
    diretoria: String(dados.get(`diretoria_${i}`)),
  }));
  // Solo é o competitivo contra um rival do computador, no mesmo nível da pessoa (mesmo valor das casas).
  if (solo) {
    const perfil = Object.hasOwn(PERFIS_BOT, dados.get('bot')) ? dados.get('bot') : 'medio';
    jogadores.push({ nome: `Rival ${PERFIS_BOT[perfil].nome}`, nivel: jogadores[0].nivel, bot: perfil });
  }
  const seedEscolhida = Number(dados.get('seed'));
  estado = novoJogo({
    jogadores,
    turnos: lerInteiro(dados.get('turnos')),
    dinheiroInicial: lerInteiro(dados.get('dinheiro')),
    modo: dados.get('modo') === 'cooperativo' ? 'cooperativo' : 'competitivo',
    seed: Number.isInteger(seedEscolhida) && seedEscolhida >= 1 && seedEscolhida <= QTD_SEMENTES ? seedEscolhida : Math.floor(Math.random() * 2 ** 32),
    soConceitual: dados.get('apoio') === 'conceitual',
    teste: lerTeste(dados),
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
      fantasma.style.cssText = posicaoCss(indice);
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

// Copia a tabela do cenário em texto separado por tabulação, que o Excel cola em colunas.
async function copiarTabela(botao) {
  const c = estado?.cenarioAtual;
  if (!c) return;
  const texto = tabelaTsv(obterCenario(c.id), c);
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement('textarea'); // sem permissão da API: método antigo
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  const aviso = botao.parentElement.querySelector('[data-copiado]');
  aviso.hidden = false;
  setTimeout(() => { aviso.hidden = true; }, 2500);
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
  } else if (acao === 'COPIAR_TABELA') {
    copiarTabela(botao);
  } else if (acao === 'IMPRIMIR') {
    window.print();
  } else if (acao === 'CONTINUAR_SALVA') {
    estado = carregar();
    render({ focar: true });
  } else {
    despachar({ tipo: acao, valor });
  }
});

app.addEventListener('submit', (ev) => {
  if (ev.target.id === 'form-menu') {
    ev.preventDefault();
    iniciar(ev.target);
  } else if (ev.target.dataset.form === 'calculadora') {
    ev.preventDefault();
    calcularNaCalculadora(ev.target);
  } else if (ev.target.dataset.form === 'valor') {
    ev.preventDefault();
    informarValor(ev.target);
  }
});

// Calculadora embutida: opera sobre os dados do cenário e mostra o resultado; não mexe no estado da partida.
function calcularNaCalculadora(form) {
  const c = estado?.cenarioAtual;
  const saida = form.querySelector('[data-resultado]');
  if (!c) return;
  const p = lerNumero(form.elements.p.value);
  const r = calcularOperacao(c.series[0].valores, form.elements.operacao.value, p);
  const rotulo = form.elements.operacao.selectedOptions[0].textContent;
  saida.textContent = r === null ? 'Não foi possível calcular: confira o P (0 a 100).' : `${rotulo}: ${formatarResultadoCalculadora(r)}`;
}

// Valor calculado de um cenário de cálculo: texto livre em pt-BR; se não for número, avisa e não avança.
function informarValor(form) {
  const campo = form.elements.valor;
  const valor = lerNumero(campo.value);
  const erro = form.querySelector('.erro-campo');
  if (Number.isNaN(valor)) {
    erro.hidden = false;
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
    return;
  }
  despachar({ tipo: 'VALOR', valor });
}

// No cooperativo com 2 jogadores só o primeiro escolhe o setor (o segundo fica com os demais) e com 1 acumula todos.
function ajustarCamposSetor(form) {
  const modo = form.elements.modo.value;
  const n = modo === 'solo' ? 1 : Number(form.elements.n.value);
  const coop = modo === 'cooperativo';
  form.querySelectorAll('fieldset[data-jogador]').forEach((f) => {
    const i = Number(f.dataset.jogador);
    f.hidden = i >= n;
    f.querySelector('[data-campo="diretoria"]').hidden = !coop || n === 1 || (n === 2 && i === 1);
    f.querySelector('[data-campo="diretoria-resto"]').hidden = !coop || n !== 2 || i !== 1;
  });
  form.querySelector('[data-erro-setor]').hidden = true;
}

// No solo só a pessoa preenche o cadastro; o número de CEOs dá lugar à escolha do rival.
app.addEventListener('change', (ev) => {
  if (ev.target.name === 'operacao') {
    const form = ev.target.form;
    form.querySelector('[data-campo="p"]').hidden = !ev.target.selectedOptions[0].hasAttribute('data-pede-p');
    form.querySelector('[data-resultado]').textContent = '';
    return;
  }
  const nome = ev.target.name;
  if (nome?.startsWith('diretoria_')) {
    ev.target.form.querySelector('[data-erro-setor]').hidden = true;
    return;
  }
  if (nome !== 'n' && nome !== 'modo') return;
  const form = ev.target.form;
  const solo = form.elements.modo.value === 'solo';
  form.querySelector('[data-campo="n"]').hidden = solo;
  form.querySelector('[data-campo="bot"]').hidden = !solo;
  ajustarCamposSetor(form);
});

render();
