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

test('cenário 05: distribuição bimodal com concentração em 1 e 5 e vale no meio', () => {
  const g = todosCenarios()[4].dados.gerador;
  for (let seed = 1; seed <= 200; seed++) {
    const v = gerar(g, criarRng(seed)).series[0].valores;
    const c1 = v.filter((x) => x === 1).length;
    const c5 = v.filter((x) => x === 5).length;
    const c3 = v.filter((x) => x === 3).length;
    assert.ok(c1 >= 10 && c5 >= 10);
    assert.ok(c3 < c1 && c3 < c5);
  }
});

test('cenário 06: outliers inflam desvio padrão muito acima do IQR', () => {
  const g = todosCenarios()[5].dados.gerador;
  for (let seed = 1; seed <= 200; seed++) {
    const v = gerar(g, criarRng(seed)).series[0].valores;
    const iqr = percentil(v, 75) - percentil(v, 25);
    assert.ok(desvioPadrao(v) > 3 * iqr);
  }
});

test('cenário 07: distribuição normal simétrica com média próxima da mediana', () => {
  const g = todosCenarios()[6].dados.gerador;
  for (let seed = 1; seed <= 200; seed++) {
    const v = gerar(g, criarRng(seed)).series[0].valores;
    assert.ok(Math.abs(media(v) - mediana(v)) < 0.6);
    assert.ok(Math.abs(media(v) - 500) < 0.8);
  }
});

test('cenário 08: amostra pequena tem variabilidade significativamente maior que amostra grande', () => {
  const g = todosCenarios()[7].dados.gerador;
  for (let seed = 1; seed <= 200; seed++) {
    const [a, b] = gerar(g, criarRng(seed)).series.map((s) => s.valores);
    assert.ok(desvioPadrao(b) > 4 * desvioPadrao(a));
    assert.ok(media(b) > media(a));
  }
});

const geradorDe = (id) => todosCenarios().find((c) => c.id === id).dados.gerador;

test('cenário 09: o máximo fica acima do P95, que fica acima da média', () => {
  const g = geradorDe('cenario_09_portao');
  for (let seed = 1; seed <= 200; seed++) {
    const v = gerar(g, criarRng(seed)).series[0].valores;
    assert.ok(Math.max(...v) - percentil(v, 95) >= 0.25 * desvioPadrao(v));
    assert.ok(percentil(v, 95) > media(v));
  }
});

test('cenário 10: P95 e P90 caem na cauda, bem acima da média', () => {
  const g = geradorDe('cenario_10_latencia');
  for (let seed = 1; seed <= 200; seed++) {
    const v = gerar(g, criarRng(seed)).series[0].valores;
    assert.ok(percentil(v, 90) > 3 * media(v));
    assert.ok(percentil(v, 95) >= percentil(v, 90));
  }
});

test('cenário 11: assimetria à esquerda, média abaixo da mediana', () => {
  const g = geradorDe('cenario_11_primeiro_contato');
  for (let seed = 1; seed <= 200; seed++) {
    const v = gerar(g, criarRng(seed)).series[0].valores;
    assert.ok(mediana(v) - media(v) > 0.06 * mediana(v));
    assert.ok(Math.min(...v) < 0.5 * mediana(v));
    assert.ok(Math.max(...v) <= 100);
  }
});

test('cenário 12: fundo B com média maior e oscilação muito maior', () => {
  const g = geradorDe('cenario_12_fundos');
  for (let seed = 1; seed <= 200; seed++) {
    const [a, b] = gerar(g, criarRng(seed)).series.map((s) => s.valores);
    assert.ok(media(b) > media(a));
    assert.ok(desvioPadrao(b) > 4 * desvioPadrao(a));
  }
});

test('cenário 13: maioria de zeros, mediana zero e média positiva', () => {
  const g = geradorDe('cenario_13_freemium');
  for (let seed = 1; seed <= 200; seed++) {
    const v = gerar(g, criarRng(seed)).series[0].valores;
    assert.equal(mediana(v), 0);
    assert.equal(moda(v), 0);
    assert.ok(media(v) > 0.1 * Math.max(...v));
  }
});
