import { novoJogo } from './engine/state.js';
import { reduzir } from './engine/machine.js';
import { salvar, carregar, limpar } from './storage/persist.js';
import { viewMenu, viewJogo } from './ui/views.js';
import { MAX_JOGADORES } from './engine/config.js';

const app = document.getElementById('app');
let estado = null;

function render({ focar = false } = {}) {
  app.innerHTML = estado ? viewJogo(estado) : viewMenu({ salvo: carregar() });
  if (focar) document.getElementById('painel')?.focus({ preventScroll: true });
}

function despachar(acao) {
  const novo = reduzir(estado, acao);
  if (novo === estado) return;
  estado = novo;
  if (estado.fase === 'FIM_DE_JOGO') limpar();
  else salvar(estado);
  render({ focar: true });
  window.scrollTo({ top: 0 });
}

function iniciar(form) {
  const dados = new FormData(form);
  const n = Math.min(MAX_JOGADORES, Math.max(1, Number(dados.get('n'))));
  const jogadores = Array.from({ length: n }, (_, i) => ({
    nome: String(dados.get(`nome_${i}`)).trim() || `Jogador ${i + 1}`,
    nivel: dados.get(`nivel_${i}`) === 'avancado' ? 'avancado' : 'iniciante',
  }));
  const seedTexto = String(dados.get('seed')).trim();
  estado = novoJogo({
    jogadores,
    turnos: Number(dados.get('turnos')),
    seed: seedTexto ? Number(seedTexto) : Math.floor(Math.random() * 2 ** 32),
  });
  salvar(estado);
  render({ focar: true });
}

app.addEventListener('click', (ev) => {
  const botao = ev.target.closest('[data-acao]');
  if (!botao) return;
  const { acao, valor } = botao.dataset;
  if (acao === 'NOVA') {
    if (estado && estado.fase !== 'FIM_DE_JOGO' && !confirm('Abandonar a partida atual?')) return;
    limpar();
    estado = null;
    render();
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

app.addEventListener('change', (ev) => {
  if (ev.target.name !== 'n') return;
  const n = Number(ev.target.value);
  app.querySelectorAll('fieldset[data-jogador]').forEach((f) => {
    f.hidden = Number(f.dataset.jogador) >= n;
  });
});

render();
