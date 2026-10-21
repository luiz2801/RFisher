import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { novoJogo, vencedores } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { DINHEIRO_INICIAL } from '../src/engine/config.js';
import { CONFIANCA } from '../src/engine/scoring.js';
import { viewJogo } from '../src/ui/views.js';

const jogadores = (...niveis) => niveis.map((nivel, i) => ({ nome: `J${i + 1}`, nivel }));

// Joga a partida inteira. `politica` decide confiança, métrica e justificativa.
function jogar(config, politica) {
  let e = novoJogo(config);
  for (let passo = 0; e.fase !== 'FIM_DE_JOGO'; passo++) {
    assert.ok(passo < 10000, 'partida não terminou');
    const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
    const acao = {
      ROLAR_DADO: () => ({ tipo: 'ROLAR' }),
      ESCOLHER_CONFIANCA: () => ({ tipo: 'CONFIANCA', valor: politica.confianca }),
      ESCOLHER_METRICA: () => ({ tipo: 'METRICA', valor: politica.metrica(def) }),
      ESCOLHER_JUSTIFICATIVA: () => ({ tipo: 'JUSTIFICATIVA', valor: politica.justificativa(def) }),
    }[e.fase]?.() ?? { tipo: 'CONTINUAR' };
    e = reduzir(e, acao);
  }
  return e;
}

const sorteio = (seed) => {
  const rng = criarRng(seed);
  return (lista) => lista[rng.inteiro(0, lista.length - 1)];
};
const saberTudo = {
  confianca: 'certeza',
  metrica: (d) => d.opcoes.find((o) => o.correta).id,
  justificativa: (d) => d.justificativas.find((j) => j.tipo === 'correta').id,
};
function chutador(seed) {
  const pick = sorteio(seed);
  return {
    confianca: 'certeza',
    metrica: (d) => pick(d.opcoes).id,
    justificativa: (d) => pick(d.justificativas).id,
  };
}

test('a partida é determinística para a mesma seed', () => {
  const cfg = { jogadores: jogadores('iniciante', 'avancado'), turnos: 6, seed: 123 };
  assert.deepEqual(jogar(cfg, saberTudo), jogar(cfg, saberTudo));
});

test('a partida termina após N turnos por jogador, sem eliminar ninguém', () => {
  const e = jogar({ jogadores: jogadores('iniciante', 'iniciante', 'avancado'), turnos: 5, seed: 9 }, chutador(1));
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.equal(e.jogadores.length, 3);
  const jogadas = e.jogadores.map((j) => j.historico.length);
  assert.ok(jogadas.every((n) => n <= 5));
});

test('ações inválidas para a fase são ignoradas', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), seed: 1 });
  assert.equal(reduzir(e, { tipo: 'METRICA', valor: 'media' }), e);
  assert.equal(reduzir(e, { tipo: 'CONTINUAR' }), e);
});

test('o reducer não altera o estado anterior', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), seed: 1 });
  const antes = structuredClone(e);
  reduzir(e, { tipo: 'ROLAR' });
  assert.deepEqual(e, antes);
});

test('em casas de decisão, a pergunta de certeza (5 níveis) ocorre após a resposta (métrica e justificativa)', () => {
  let e = novoJogo({ jogadores: jogadores('iniciante'), seed: 1 });
  let passos = 0;
  while (e.fase === 'ROLAR_DADO' && passos < 20) {
    e = reduzir(e, { tipo: 'ROLAR' });
    passos++;
    if (e.fase === 'MOSTRAR_EVENTO' || e.fase === 'MOSTRAR_BALANCO') {
      e = reduzir(e, { tipo: 'CONTINUAR' });
    }
  }
  assert.equal(e.fase, 'ESCOLHER_METRICA');
  const def = obterCenario(e.cenarioAtual.id);

  e = reduzir(e, { tipo: 'METRICA', valor: def.opcoes[0].id });
  assert.equal(e.fase, 'ESCOLHER_JUSTIFICATIVA');

  e = reduzir(e, { tipo: 'JUSTIFICATIVA', valor: def.justificativas[0].id });
  assert.equal(e.fase, 'ESCOLHER_CONFIANCA');

  const html = viewJogo(e);
  for (const nivel of Object.keys(CONFIANCA)) assert.match(html, new RegExp(`data-valor="${nivel}"`));

  for (const invalido of ['talvez', 'toString', undefined]) {
    assert.equal(reduzir(e, { tipo: 'CONFIANCA', valor: invalido }).fase, 'ESCOLHER_CONFIANCA');
  }

  e = reduzir(e, { tipo: 'CONFIANCA', valor: 'provavel' });
  assert.equal(e.fase, 'MOSTRAR_RESULTADO');
  assert.equal(e.resultado.confianca, 'provavel');
});

test('o estado sobrevive a JSON (salvar/retomar partida)', () => {
  let e = novoJogo({ jogadores: jogadores('iniciante', 'avancado'), turnos: 4, seed: 77 });
  for (let i = 0; i < 12; i++) {
    const copia = JSON.parse(JSON.stringify(e));
    assert.deepEqual(copia, e);
    const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
    const acao = {
      ROLAR_DADO: { tipo: 'ROLAR' },
      ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'chute' },
      ESCOLHER_METRICA: { tipo: 'METRICA', valor: def?.opcoes[0].id },
      ESCOLHER_JUSTIFICATIVA: { tipo: 'JUSTIFICATIVA', valor: def?.justificativas[0].id },
    }[e.fase] ?? { tipo: 'CONTINUAR' };
    e = reduzir(copia, acao);
  }
});

test('simulação: quem chuta termina com menos dinheiro que quem sabe tudo', () => {
  const PARTIDAS = 300;
  let somaChute = 0;
  let somaSabe = 0;
  let vitoriasSabe = 0;
  for (let seed = 1; seed <= PARTIDAS; seed++) {
    // O mesmo tabuleiro e a mesma sequência de dados para os dois.
    const cfg = { jogadores: jogadores('iniciante'), turnos: 10, seed };
    somaChute += jogar(cfg, chutador(seed)).jogadores[0].dinheiro;
    somaSabe += jogar(cfg, saberTudo).jogadores[0].dinheiro;
  }
  const mediaChute = somaChute / PARTIDAS;
  const mediaSabe = somaSabe / PARTIDAS;
  assert.ok(mediaChute < DINHEIRO_INICIAL, `chutar deveria perder dinheiro, média final = ${mediaChute}`);
  assert.ok(mediaSabe > DINHEIRO_INICIAL * 2, `saber tudo deveria render bem, média final = ${mediaSabe}`);

  // Disputa direta: um jogador que sabe tudo contra um que chuta.
  for (let seed = 1; seed <= PARTIDAS; seed++) {
    let e = novoJogo({ jogadores: jogadores('iniciante', 'iniciante'), turnos: 10, seed });
    const pick = chutador(seed);
    while (e.fase !== 'FIM_DE_JOGO') {
      const p = e.jogadorAtual === 0 ? saberTudo : pick;
      const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
      const acao = {
        ROLAR_DADO: { tipo: 'ROLAR' },
        ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: p.confianca },
        ESCOLHER_METRICA: { tipo: 'METRICA', valor: def && p.metrica(def) },
        ESCOLHER_JUSTIFICATIVA: { tipo: 'JUSTIFICATIVA', valor: def && p.justificativa(def) },
      }[e.fase] ?? { tipo: 'CONTINUAR' };
      e = reduzir(e, acao);
    }
    if (vencedores(e).some((j) => j.id === 0)) vitoriasSabe++;
  }
  assert.ok(vitoriasSabe / PARTIDAS > 0.95, `quem sabe venceu só ${vitoriasSabe}/${PARTIDAS}`);
});

test('o dado não decide a partida: mesmo com sorte no dado, o conhecimento pesa mais', () => {
  // Dinheiro das casas de decisão vs. balanço e eventos, para quem sabe tudo.
  let decisao = 0;
  let outros = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const e = jogar({ jogadores: jogadores('iniciante'), turnos: 10, seed }, saberTudo);
    const j = e.jogadores[0];
    decisao += j.historico.reduce((s, h) => s + h.delta, 0);
    outros += j.dinheiro - DINHEIRO_INICIAL - j.historico.reduce((s, h) => s + h.delta, 0);
  }
  assert.ok(decisao > 2 * Math.abs(outros), `decisões ${decisao} vs. resto ${outros}`);
});

// ---------- modo cooperativo ----------

import { carteira, classificarEmpresa } from '../src/engine/state.js';
import { metaTrimestral } from '../src/engine/machine.js';

const coop = (n, extra = {}) =>
  novoJogo({ jogadores: jogadores(...Array(n).fill('iniciante')), modo: 'cooperativo', seed: 5, ...extra });

test('cooperativo: todo setor tem responsável, com 1, 2 ou 3 jogadores', () => {
  for (const n of [1, 2, 3]) {
    const e = coop(n);
    const papeis = e.jogadores.flatMap((j) => j.papeis);
    assert.deepEqual([...papeis].sort(), ['operacoes', 'pessoas_financas', 'tecnologia']);
  }
});

test('cooperativo: o caixa é da empresa, e o dinheiro dos jogadores não muda', () => {
  const e = jogar({ jogadores: jogadores('iniciante', 'iniciante'), modo: 'cooperativo', turnos: 6, seed: 3 }, saberTudo);
  assert.ok(e.jogadores.every((j) => j.dinheiro === DINHEIRO_INICIAL));
  assert.notEqual(e.empresa.dinheiro, DINHEIRO_INICIAL);
  assert.ok(e.empresa.dinheiro > DINHEIRO_INICIAL);
});

test('competitivo continua com carteira individual e sem empresa', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), seed: 1 });
  assert.equal(e.empresa, null);
  assert.equal(carteira(e), e.jogadores[0]);
  // saves antigos, sem `modo`, seguem competitivos
  delete e.modo;
  assert.equal(carteira(e), e.jogadores[0]);
});

test('cooperativo: a meta do Balanço premia ou corta e ninguém é eliminado', () => {
  const resultados = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const e = jogar({ jogadores: jogadores('iniciante', 'iniciante'), modo: 'cooperativo', turnos: 10, seed }, chutador(seed));
    assert.equal(e.fase, 'FIM_DE_JOGO');
    assert.equal(e.jogadores.length, 2);
  }
  // força um Balanço com caixa baixo e outro com caixa alto
  for (const dinheiro of [0, 10 * DINHEIRO_INICIAL]) {
    let e = coop(1);
    e.empresa.dinheiro = dinheiro;
    e.jogadores[0].posicao = 27; // qualquer dado passa pelo início
    e = reduzir(e, { tipo: 'ROLAR' });
    assert.ok(e.balanco.meta, 'balanço cooperativo deve avaliar a meta');
    resultados.add(e.balanco.meta.cumprida);
    assert.equal(e.balanco.meta.valor, metaTrimestral(e));
  }
  assert.deepEqual([...resultados].sort(), [false, true]);
});

test('cooperativo: a meta cresce com os trimestres e com o número de jogadores', () => {
  const a = coop(1);
  const b = coop(3);
  assert.equal(metaTrimestral(a), DINHEIRO_INICIAL);
  assert.ok(metaTrimestral({ ...a, turnoAtual: 5 }) > metaTrimestral(a));
  assert.ok(metaTrimestral({ ...b, turnoAtual: 5 }) > metaTrimestral({ ...a, turnoAtual: 5 }));
});

test('cooperativo: classificação final por faixas de caixa e reputação', () => {
  const faixa = (dinheiro, reputacao) => classificarEmpresa({ dinheiro, reputacao }).id;
  assert.equal(faixa(0, 90), 'falencia');
  assert.equal(faixa(DINHEIRO_INICIAL, 50), 'sobrevivencia');
  assert.equal(faixa(2 * DINHEIRO_INICIAL, 65), 'crescimento');
  assert.equal(faixa(3 * DINHEIRO_INICIAL, 80), 'lider');
  assert.equal(faixa(3 * DINHEIRO_INICIAL, 30), 'sobrevivencia'); // caixa sozinho não basta
});

test('cooperativo: o estado sobrevive a JSON e a partida é determinística', () => {
  const cfg = { jogadores: jogadores('iniciante', 'avancado', 'iniciante'), modo: 'cooperativo', turnos: 5, seed: 8 };
  const e = jogar(cfg, saberTudo);
  assert.deepEqual(JSON.parse(JSON.stringify(e)), e);
  assert.deepEqual(jogar(cfg, saberTudo), e);
});
