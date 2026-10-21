import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { todosCenarios } from '../src/scenarios/loader.js';
import { gerar, verificarInvariante } from '../src/scenarios/generators.js';
import { media, mediana, moda, percentil, desvioPadrao } from '../src/stats/metrics.js';

test('métricas básicas', () => {
  assert.equal(media([1, 2, 3, 4]), 2.5);
  assert.equal(mediana([5, 1, 3]), 3);
  assert.equal(mediana([1, 2, 3, 4]), 2.5);
  assert.equal(moda([1, 2, 2, 3, 3]), 2);
  assert.equal(percentil([1, 2, 3, 4, 5], 90), 4.6);
  assert.ok(Math.abs(desvioPadrao([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.001);
  // Correção do apêndice: a média do cenário original era R$ 47.500, não R$ 10.700.
  assert.equal(media([5000, 5000, 5000, 5000, 15000, 250000]), 47500);
});

test('mesma seed gera os mesmos dados', () => {
  for (const c of todosCenarios()) {
    const a = gerar(c.dados.gerador, criarRng(42));
    const b = gerar(c.dados.gerador, criarRng(42));
    assert.deepEqual(a, b, c.id);
  }
});

test('invariantes valem em 1.000 seeds, para todos os cenários', () => {
  for (const c of todosCenarios()) {
    for (let seed = 1; seed <= 1000; seed++) {
      const { series } = gerar(c.dados.gerador, criarRng(seed));
      assert.ok(verificarInvariante(c.dados.gerador, series), `${c.id} seed ${seed}`);
    }
  }
});

test('cenário 01: média > 1,5 × mediana e outlier > 10 × mediana', () => {
  const g = todosCenarios()[0].dados.gerador;
  for (let seed = 1; seed <= 200; seed++) {
    const v = gerar(g, criarRng(seed)).series[0].valores;
    assert.ok(media(v) > 1.5 * mediana(v));
    assert.ok(Math.max(...v) > 10 * mediana(v));
  }
});

test('cenário 04: médias iguais e desvios muito distintos', () => {
  const g = todosCenarios()[3].dados.gerador;
  for (let seed = 1; seed <= 200; seed++) {
    const [a, b] = gerar(g, criarRng(seed)).series.map((s) => s.valores);
    assert.ok(Math.abs(media(a) - media(b)) < 0.01);
    assert.ok(desvioPadrao(b) > 5 * desvioPadrao(a));
  }
});
