import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverDecisao, multiplicadorReputacao, CONFIANCA, NIVEL } from '../src/engine/scoring.js';

const impacto = { reputacao_acerto: 5, reputacao_erro: -10 };
const base = { nivel: 'iniciante', reputacao: 50, valorBase: 20000, impacto };
const centenas = (v) => Math.round(v / 100) * 100 || 0;
const jogada = (m, j, confianca, extra = {}) =>
  resolverDecisao({ ...base, metricaCorreta: m, justificativaCorreta: j, confianca, ...extra });

test('exemplos da seção 3.5 (V = 20.000, iniciante, reputação neutra)', () => {
  assert.equal(jogada(true, true, 'certeza').delta, 30000);
  assert.equal(jogada(true, true, 'chute').delta, 10000);
  assert.equal(jogada(false, false, 'certeza').delta, -15000);
  assert.equal(jogada(false, false, 'chute').delta, -5000);
});

test('escala de confiança: 5 níveis crescentes em degraus de 0,25 (seção 3.4)', () => {
  assert.deepEqual(Object.values(CONFIANCA), [0.5, 0.75, 1, 1.25, 1.5]);
  assert.deepEqual(
    Object.keys(CONFIANCA).map((c) => jogada(true, true, c).delta),
    [10000, 15000, 20000, 25000, 30000],
  );
  assert.deepEqual(
    Object.keys(CONFIANCA).map((c) => jogada(false, false, c).delta),
    [-5000, -7500, -10000, -12500, -15000],
  );
});

test('as quatro combinações, nos cinco níveis de confiança e de jogador', () => {
  for (const nivel of Object.keys(NIVEL)) {
    for (const confianca of Object.keys(CONFIANCA)) {
      const V = 20000 * NIVEL[nivel] * CONFIANCA[confianca];
      const r = (m, j) => jogada(m, j, confianca, { nivel }).delta;
      assert.equal(r(true, true), centenas(V));
      assert.equal(r(true, false), centenas(0.2 * V));
      assert.equal(r(false, true), 0);
      assert.equal(r(false, false), centenas(-0.5 * V));
    }
  }
});

test('multiplicador de reputação: 0,8 / 1,0 / 1,3 e limites', () => {
  assert.equal(multiplicadorReputacao(0), 0.8);
  assert.equal(multiplicadorReputacao(50), 1);
  assert.equal(multiplicadorReputacao(100), 1.3);
  assert.equal(multiplicadorReputacao(-20), 0.8);
  assert.equal(multiplicadorReputacao(500), 1.3);
});

test('reputação multiplica só os ganhos, nunca as perdas', () => {
  assert.equal(jogada(true, true, 'certeza', { reputacao: 100 }).delta, 39000);
  assert.equal(jogada(true, true, 'certeza', { reputacao: 0 }).delta, 24000);
  assert.equal(jogada(false, false, 'certeza', { reputacao: 100 }).delta, -15000);
  assert.equal(jogada(false, false, 'certeza', { reputacao: 0 }).delta, -15000);
});

test('variação de reputação por categoria', () => {
  assert.equal(jogada(true, true, 'chute').deltaReputacao, 5);
  assert.equal(jogada(true, false, 'chute').deltaReputacao, 0);
  assert.equal(jogada(false, true, 'chute').deltaReputacao, -5);
  assert.equal(jogada(false, false, 'chute').deltaReputacao, -10);
});

test('anti-chute: esperança do chute total é ≈ −0,27 × V × confiança (seção 3.5)', () => {
  const [pM, pJ] = [1 / 5, 1 / 6];
  const esperanca =
    pM * pJ * 1 + pM * (1 - pJ) * 0.2 + (1 - pM) * pJ * 0 + (1 - pM) * (1 - pJ) * -0.5;
  assert.ok(Math.abs(esperanca - -0.267) < 0.001, `esperança = ${esperanca}`);
});

test('dica reduz pela metade o bônus de confiança nos ganhos (seção 3.4)', () => {
  assert.equal(jogada(true, true, 'certeza', { dicaUsada: true }).delta, 25000); // ×1,25 em vez de ×1,5
  assert.equal(jogada(true, true, 'confiante', { dicaUsada: true }).delta, 22500); // ×1,125
  assert.equal(jogada(true, true, 'provavel', { dicaUsada: true }).delta, 20000);
  assert.equal(jogada(true, true, 'chute', { dicaUsada: true }).delta, 10000);
  assert.equal(jogada(false, false, 'certeza', { dicaUsada: true }).delta, -15000); // perda não muda
});

// Sequências (fisher.md 3.13)
import { multiplicadorSequencia, fatorSequencia, atualizarSequencia, SEM_SEQUENCIA } from '../src/engine/scoring.js';

const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('fator da sequência: ×1,1 por acerto seguido até o teto 2; ×0,9 por erro seguido até o piso 0,5', () => {
  perto(fatorSequencia(SEM_SEQUENCIA), 1);
  perto(fatorSequencia({ erros: 0, acertos: 1 }), 1.1);
  perto(fatorSequencia({ erros: 0, acertos: 3 }), 1.331);
  perto(fatorSequencia({ erros: 0, acertos: 7 }), 1.1 ** 7);
  perto(fatorSequencia({ erros: 0, acertos: 8 }), 2);
  perto(fatorSequencia({ erros: 0, acertos: 30 }), 2);
  perto(fatorSequencia({ erros: 1, acertos: 0 }), 0.9);
  perto(fatorSequencia({ erros: 3, acertos: 0 }), 0.729);
  perto(fatorSequencia({ erros: 6, acertos: 0 }), 0.9 ** 6);
  perto(fatorSequencia({ erros: 7, acertos: 0 }), 0.5);
  perto(fatorSequencia({ erros: 30, acertos: 0 }), 0.5);
});

test('o sucesso absoluto rende o fator da sequência; depois de erros rende menos', () => {
  const ganho = (acertos, erros = 0) => jogada(true, true, 'provavel', { sequencia: { erros, acertos } }).delta;
  assert.deepEqual([0, 1, 2, 7, 8, 20].map((n) => ganho(n)), [20000, 22000, 24200, 39000, 40000, 40000]);
  assert.deepEqual([1, 2, 7, 20].map((n) => ganho(0, n)), [18000, 16200, 10000, 10000]);
});

test('o erro total custa o inverso do fator: mais com erros seguidos (até 2×), menos com acertos seguidos (até 0,5×)', () => {
  const perda = (erros, acertos = 0) => jogada(false, false, 'provavel', { sequencia: { erros, acertos } }).delta;
  assert.deepEqual([0, 1, 2, 7, 20].map((n) => perda(n)), [-10000, -11100, -12300, -20000, -20000]);
  assert.deepEqual([1, 2, 8, 20].map((n) => perda(0, n)), [-9100, -8300, -5000, -5000]);
});

test('o acerto parcial e a incoerência não recebem o fator de sequência', () => {
  for (const sequencia of [{ erros: 3, acertos: 0 }, { erros: 0, acertos: 4 }]) {
    for (const [m, j] of [[true, false], [false, true]]) {
      const comSeq = jogada(m, j, 'certeza', { sequencia });
      assert.equal(comSeq.delta, jogada(m, j, 'certeza').delta);
      assert.equal(comSeq.multiplicadorSequencia, 1);
    }
  }
});

test('a sequência soma-se à reputação e ao nível', () => {
  const r = jogada(true, true, 'provavel', { reputacao: 100, nivel: 'avancado', sequencia: { erros: 0, acertos: 2 } });
  assert.equal(r.delta, centenas(20000 * 1.5 * 1.3 * 1.1 ** 2));
});

test('atualizarSequencia: erro total e sucesso estendem a própria sequência; parcial zera as duas', () => {
  assert.deepEqual(atualizarSequencia('erro_total', { erros: 1, acertos: 0 }), { erros: 2, acertos: 0 });
  assert.deepEqual(atualizarSequencia('sucesso', { erros: 2, acertos: 0 }), { erros: 0, acertos: 1 });
  assert.deepEqual(atualizarSequencia('sucesso', { erros: 0, acertos: 1 }), { erros: 0, acertos: 2 });
  assert.deepEqual(atualizarSequencia('erro_total', { erros: 0, acertos: 3 }), { erros: 1, acertos: 0 });
  assert.deepEqual(atualizarSequencia('sorte', { erros: 2, acertos: 0 }), SEM_SEQUENCIA);
  assert.deepEqual(atualizarSequencia('incoerencia', { erros: 0, acertos: 2 }), SEM_SEQUENCIA);
});
