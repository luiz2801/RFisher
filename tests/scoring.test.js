import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverDecisao, multiplicadorReputacao, CONFIANCA, NIVEL } from '../src/engine/scoring.js';

const impacto = { reputacao_acerto: 5, reputacao_erro: -10 };
const base = { nivel: 'iniciante', reputacao: 50, valorBase: 20000, impacto };
const jogada = (m, j, confianca, extra = {}) =>
  resolverDecisao({ ...base, metricaCorreta: m, justificativaCorreta: j, confianca, ...extra });

test('exemplos da seção 3.5 (V = 20.000, iniciante, reputação neutra)', () => {
  assert.equal(jogada(true, true, 'certeza').delta, 30000);
  assert.equal(jogada(true, true, 'chute').delta, 10000);
  assert.equal(jogada(false, false, 'certeza').delta, -15000);
  assert.equal(jogada(false, false, 'chute').delta, -5000);
});

test('as quatro combinações, nos dois níveis de confiança e de jogador', () => {
  for (const nivel of Object.keys(NIVEL)) {
    for (const confianca of Object.keys(CONFIANCA)) {
      const V = 20000 * NIVEL[nivel] * CONFIANCA[confianca];
      const r = (m, j) => jogada(m, j, confianca, { nivel }).delta;
      assert.equal(r(true, true), V);
      assert.equal(r(true, false), 0.2 * V);
      assert.equal(r(false, true), 0);
      assert.equal(r(false, false), -0.5 * V);
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
