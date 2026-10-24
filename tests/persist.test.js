import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from '../src/engine/state.js';
import { salvar, carregar, limpar } from '../src/storage/persist.js';

const CHAVE = 'tabuleiro-do-ceo:partida:v1';

// Substitui o localStorage global por um falso em memória. Devolve a função que restaura o original.
function mockLocalStorage(falso) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: falso, configurable: true, writable: true });
  return () => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  };
}

// Falso localStorage: `dados` guarda o que foi escrito; `sobrescreve` permite simular falhas.
function falsoLocalStorage(sobrescreve = {}) {
  const dados = new Map();
  return {
    dados,
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    ...sobrescreve,
  };
}

const partida = () => novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], seed: 7 });

test('salvar e carregar devolvem a mesma partida (ida e volta)', () => {
  const falso = falsoLocalStorage();
  const restaurar = mockLocalStorage(falso);
  try {
    const e = partida();
    salvar(e);
    assert.ok(falso.dados.has(CHAVE), 'grava na chave versionada');
    assert.deepEqual(carregar(), e);
  } finally {
    restaurar();
  }
});

test('carregar devolve null quando o save é ausente, inválido ou de outra versão', () => {
  const casos = {
    'chave ausente': null,
    'JSON inválido': '{partida quebrada',
    'versão diferente de 1': JSON.stringify({ ...partida(), versao: 2 }),
    'sem jogadores': JSON.stringify({ ...partida(), jogadores: undefined }),
    'sem fase': JSON.stringify({ ...partida(), fase: undefined }),
  };
  for (const [caso, conteudo] of Object.entries(casos)) {
    const falso = falsoLocalStorage();
    if (conteudo !== null) falso.dados.set(CHAVE, conteudo);
    const restaurar = mockLocalStorage(falso);
    try {
      assert.equal(carregar(), null, caso);
    } finally {
      restaurar();
    }
  }
});

test('limpar remove a partida salva', () => {
  const falso = falsoLocalStorage();
  const restaurar = mockLocalStorage(falso);
  try {
    salvar(partida());
    limpar();
    assert.equal(falso.dados.has(CHAVE), false);
    assert.equal(carregar(), null);
  } finally {
    restaurar();
  }
});

test('falhas do localStorage (cota excedida, modo privado) não lançam erro', () => {
  const erro = () => {
    throw new DOMException('cota excedida', 'QuotaExceededError');
  };
  const falso = falsoLocalStorage({ setItem: erro, getItem: erro, removeItem: erro });
  const restaurar = mockLocalStorage(falso);
  try {
    assert.doesNotThrow(() => salvar(partida()));
    assert.equal(carregar(), null);
    assert.doesNotThrow(() => limpar());
  } finally {
    restaurar();
  }
});

// ---------- fixtures estáticas de saves (tests/fixtures/) ----------

import { readFileSync } from 'node:fs';
import { reduzir } from '../src/engine/machine.js';
import { valorEsperado } from '../src/engine/calculo.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { DINHEIRO_INICIAL } from '../src/engine/config.js';
import { carteira, ehCooperativo, dinheiroInicialDe, distanciaPercorrida, progressoDoJogador, ehBot, ehFalido } from '../src/engine/state.js';
import { viewJogo } from '../src/ui/views.js';

const lerFixture = (nome) => readFileSync(new URL(`./fixtures/${nome}.json`, import.meta.url), 'utf8');

// Guarda o JSON da fixture no localStorage falso e lê de volta com `carregar`, como o menu faz.
function carregarFixture(nome) {
  const falso = falsoLocalStorage();
  falso.dados.set(CHAVE, lerFixture(nome));
  const restaurar = mockLocalStorage(falso);
  try {
    return carregar();
  } finally {
    restaurar();
  }
}

// Ação de quem sabe a resposta, para levar qualquer fase adiante.
function proximaAcao(e) {
  const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
  switch (e.fase) {
    case 'ROLAR_DADO': return { tipo: 'ROLAR' };
    case 'ESCOLHER_CONFIANCA': return { tipo: 'CONFIANCA', valor: 'certeza' };
    case 'ESCOLHER_METRICA': return { tipo: 'METRICA', valor: def.opcoes.find((o) => o.correta).id };
    case 'INFORMAR_VALOR': return { tipo: 'VALOR', valor: valorEsperado(def, e.cenarioAtual) };
    case 'ESCOLHER_JUSTIFICATIVA': return { tipo: 'JUSTIFICATIVA', valor: def.justificativas.find((j) => j.tipo === 'correta').id };
    default: return { tipo: 'CONTINUAR' };
  }
}

function jogarAteOFim(e) {
  for (let i = 0; i < 2000 && e.fase !== 'FIM_DE_JOGO'; i++) e = reduzir(e, proximaAcao(e));
  assert.equal(e.fase, 'FIM_DE_JOGO', 'a partida retomada deve terminar');
  return e;
}

const FIXTURES = [
  'save-v1-competitivo',
  'save-v1-cooperativo',
  'save-legado-sem-modo',
  'save-legado-sem-distancia',
  'save-legado-sem-dinheiro-inicial',
];

for (const nome of FIXTURES) {
  test(`fixture ${nome}: carrega, renderiza e a partida retomada vai até o fim sem erro`, () => {
    const e = carregarFixture(nome);
    assert.ok(e, 'carregar deve aceitar a fixture');
    assert.equal(e.versao, 1);
    assert.deepEqual(e, JSON.parse(lerFixture(nome)), 'carregar não altera o conteúdo do save');
    const html = viewJogo(e);
    assert.ok(html.length > 0);
    assert.doesNotMatch(html, /undefined|NaN|\{\{/, 'a tela do save não pode ter valores soltos');
    const fim = jogarAteOFim(e);
    assert.ok(carteira(fim).dinheiro > 0);
    assert.doesNotMatch(viewJogo(fim), /undefined|NaN|\{\{/);
    // Determinismo: retomar do mesmo save duas vezes dá o mesmo final.
    assert.deepEqual(jogarAteOFim(carregarFixture(nome)), fim);
  });
}

test('fixture save-v1-competitivo: partida competitiva ativa, sem empresa e com carteira individual', () => {
  const e = carregarFixture('save-v1-competitivo');
  assert.equal(e.modo, 'competitivo');
  assert.equal(ehCooperativo(e), false);
  assert.equal(e.empresa, null);
  assert.equal(e.fase, 'ESCOLHER_CONFIANCA');
  assert.equal(e.jogadores.length, 2);
  assert.equal(carteira(e), e.jogadores[e.jogadorAtual]);
  assert.ok(e.jogadores.every((j) => Array.isArray(j.papeis) && j.papeis.length === 0));
});

test('fixture save-v1-cooperativo: partida cooperativa ativa, com empresa e papéis em todos os setores', () => {
  const e = carregarFixture('save-v1-cooperativo');
  assert.equal(e.modo, 'cooperativo');
  assert.equal(ehCooperativo(e), true);
  assert.equal(carteira(e), e.empresa);
  assert.equal(e.fase, 'ESCOLHER_CONFIANCA');
  assert.deepEqual(e.jogadores.flatMap((j) => j.papeis).sort(), ['operacoes', 'pessoas_financas', 'tecnologia']);
});

test('save legado sem modo, empresa e papeis: vira competitivo, com a carteira do jogador', () => {
  const e = carregarFixture('save-legado-sem-modo');
  assert.equal('modo' in e, false);
  assert.equal('empresa' in e, false);
  assert.ok(e.jogadores.every((j) => !('papeis' in j)));
  assert.equal(ehCooperativo(e), false);
  assert.equal(carteira(e), e.jogadores[e.jogadorAtual]);
  // O balanço de um save assim não tem meta.
  const balanco = reduzir({ ...e, teste: { casa: 'balanco', cenarios: null }, fase: 'ROLAR_DADO', jogadores: e.jogadores.map((j) => ({ ...j, posicao: 27 })) }, { tipo: 'ROLAR' });
  assert.equal(balanco.fase, 'MOSTRAR_BALANCO');
  assert.equal(balanco.balanco.meta, undefined);
});

test('save legado sem distancia: a distância vale a posição, o progresso é finito e a jogada soma a partir dela', () => {
  const e = carregarFixture('save-legado-sem-distancia');
  assert.ok(e.jogadores.every((j) => !('distancia' in j)));
  for (const j of e.jogadores) {
    assert.equal(distanciaPercorrida(j), j.posicao);
    const p = progressoDoJogador(e, j);
    assert.ok(Number.isFinite(p) && p >= 0 && p <= 1, `progresso = ${p}`);
  }
  const fase = { ...e, fase: 'ROLAR_DADO', cenarioAtual: null };
  const antes = e.jogadores[e.jogadorAtual].posicao;
  const depois = reduzir(fase, { tipo: 'ROLAR' });
  assert.equal(distanciaPercorrida(depois.jogadores[e.jogadorAtual]), antes + depois.dado);
});

test('save legado sem dinheiroInicial: vale o padrão e a meta do cooperativo acompanha', () => {
  const e = carregarFixture('save-legado-sem-dinheiro-inicial');
  assert.equal('dinheiroInicial' in e, false);
  assert.equal(dinheiroInicialDe(e), DINHEIRO_INICIAL);
  assert.ok(e.jogadores.every((j) => !ehBot(j) && !ehFalido(j)));
  const coop = { ...structuredClone(e), modo: 'cooperativo', empresa: { dinheiro: 0, reputacao: 50 }, fase: 'ROLAR_DADO', cenarioAtual: null, teste: { casa: 'balanco', cenarios: null } };
  coop.jogadores.forEach((j) => { j.posicao = 27; });
  const depois = reduzir(coop, { tipo: 'ROLAR' });
  assert.equal(depois.balanco.meta.valor, DINHEIRO_INICIAL + 2000 * coop.jogadores.length * (coop.turnoAtual - 1));
});

test('os saves antigos continuam aceitos por carregar mesmo sem os campos opcionais mais novos', () => {
  const e = carregarFixture('save-legado-sem-modo');
  for (const campo of ['soConceitual', 'teste', 'falencia']) {
    const sem = { ...e };
    delete sem[campo];
    const falso = falsoLocalStorage();
    falso.dados.set(CHAVE, JSON.stringify(sem));
    const restaurar = mockLocalStorage(falso);
    try {
      assert.ok(carregar(), `sem ${campo}`);
    } finally {
      restaurar();
    }
    assert.doesNotThrow(() => jogarAteOFim(sem), `partida sem ${campo}`);
  }
});

// ---------- retomada em cada fase da partida ----------

// Conduz uma partida até a primeira vez que ela pára na `fase` pedida.
function ate(fase, config) {
  let e = novoJogo({ turnos: 6, seed: 11, ...config });
  for (let i = 0; i < 2000 && e.fase !== fase; i++) {
    assert.notEqual(e.fase, 'FIM_DE_JOGO', `a partida acabou sem passar por ${fase}`);
    e = reduzir(e, proximaAcao(e));
  }
  assert.equal(e.fase, fase);
  return e;
}

const DOIS = [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'avancado' }];
const CALCULO = { casa: 'decisao', cenarios: ['cenario_14_alugueis'] };
// Uma configuração que leva a cada fase, nos dois modos.
const CAMINHOS = {
  ROLAR_DADO: {},
  ESCOLHER_METRICA: { teste: { casa: 'decisao', cenarios: null } },
  INFORMAR_VALOR: { teste: CALCULO },
  ESCOLHER_JUSTIFICATIVA: { teste: { casa: 'decisao', cenarios: null } },
  ESCOLHER_CONFIANCA: { teste: { casa: 'decisao', cenarios: null } },
  MOSTRAR_RESULTADO: { teste: { casa: 'decisao', cenarios: null } },
  MOSTRAR_EVENTO: { teste: { casa: 'evento' } },
  MOSTRAR_MERCADO: { teste: { casa: 'mercado' } },
  MOSTRAR_BALANCO: { teste: { casa: 'balanco' } },
};

for (const modo of ['competitivo', 'cooperativo']) {
  for (const [fase, extra] of Object.entries(CAMINHOS)) {
    test(`retomada ${modo}: salvar e carregar em ${fase} preserva o estado e a partida termina igual`, () => {
      const e = ate(fase, { jogadores: DOIS, modo, ...extra });
      const falso = falsoLocalStorage();
      const restaurar = mockLocalStorage(falso);
      let recarregado;
      try {
        salvar(e);
        recarregado = carregar();
      } finally {
        restaurar();
      }
      assert.deepEqual(recarregado, e);
      assert.notEqual(recarregado, e, 'é uma cópia, não o mesmo objeto');
      // A tela da fase retomada é idêntica à da original.
      assert.equal(viewJogo(recarregado), viewJogo(e));
      // Continuar do save leva ao mesmo fim que continuar sem interrupção.
      assert.deepEqual(jogarAteOFim(recarregado), jogarAteOFim(e));
    });
  }
}

// Casa de Evento (fisher.md 3.15): o save no meio da escolha das cartas e depois dela volta igual e termina igual.
for (const modo of ['competitivo', 'cooperativo']) {
  test(`retomada ${modo}: salvar com as cartas na mesa, no meio da troca e com a carta revelada preserva o estado`, () => {
    const oferta = ate('MOSTRAR_EVENTO', { jogadores: DOIS, modo, teste: { casa: 'evento' } });
    const naMesa = reduzir(oferta, { tipo: 'PARTICIPAR' });
    const trocando = reduzir(naMesa, { tipo: 'ESCOLHER_CARTA', valor: 2 });
    const revelada = reduzir(trocando, { tipo: 'TROCAR' });
    for (const e of [oferta, naMesa, trocando, revelada]) {
      const falso = falsoLocalStorage();
      const restaurar = mockLocalStorage(falso);
      let recarregado;
      try {
        salvar(e);
        recarregado = carregar();
      } finally {
        restaurar();
      }
      assert.deepEqual(recarregado, e);
      assert.equal(viewJogo(recarregado), viewJogo(e));
      assert.equal(recarregado.eventoAtual.decisao, e.eventoAtual.decisao);
    }
    // Retomado no meio do Monty Hall, a carta revelada e a decisão de trocar seguem valendo.
    const salvo = JSON.parse(JSON.stringify(trocando));
    assert.equal(salvo.eventoAtual.revelada, trocando.eventoAtual.revelada);
    assert.deepEqual(reduzir(salvo, { tipo: 'TROCAR' }), revelada);
    assert.deepEqual(jogarAteOFim(JSON.parse(JSON.stringify(revelada))), jogarAteOFim(revelada));
  });
}

test('retomada: o save do fim de jogo também é carregável (fase FIM_DE_JOGO)', () => {
  const fim = jogarAteOFim(novoJogo({ jogadores: DOIS, turnos: 2, seed: 4 }));
  const falso = falsoLocalStorage();
  const restaurar = mockLocalStorage(falso);
  try {
    salvar(fim);
    assert.deepEqual(carregar(), fim);
  } finally {
    restaurar();
  }
});
