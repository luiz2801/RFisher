import test from 'node:test';
import assert from 'node:assert/strict';
import { mediana, moda, percentil, desvioPadrao, mediaAparada, resumo } from '../src/stats/metrics.js';

// Estes números são os que o aluno vê na tela: um erro aqui ensina estatística errada.

test('mediana de lista par é a média dos dois centrais; lista unitária devolve o próprio valor', () => {
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
  assert.equal(mediana([7]), 7);
  assert.equal(mediana([9, -1]), 4);
});

test('moda: em empate vence o menor valor; lista unitária devolve o próprio valor', () => {
  assert.equal(moda([3, 1, 3, 1]), 1);
  assert.equal(moda([5]), 5);
  assert.equal(moda([2, 2, 2, 9, 9]), 2);
});

test('percentil: p0 e p100 são mínimo e máximo, e lista unitária não quebra', () => {
  const v = [30, 10, 40, 20];
  assert.equal(percentil(v, 0), 10);
  assert.equal(percentil(v, 100), 40);
  assert.equal(percentil([42], 90), 42);
});

test('percentil interpola linearmente entre postos (mesmo método do NumPy)', () => {
  assert.equal(percentil([1, 2, 3, 4], 50), 2.5);
  // pos = 0,25 × 3 = 0,75 → 10 + 0,75 × (20 − 10)
  assert.equal(percentil([10, 20, 30, 40], 25), 17.5);
});

test('desvio padrão é amostral (divide por n − 1)', () => {
  // média 2,5; soma dos quadrados 5; 5 / 3 = 1,6667; raiz = 1,2910
  assert.ok(Math.abs(desvioPadrao([1, 2, 3, 4]) - Math.sqrt(5 / 3)) < 1e-12);
});

test('resumo de [1, 2, 3, 4, 5] traz IQR, amplitude e ponto médio corretos', () => {
  const r = resumo([1, 2, 3, 4, 5]);
  assert.equal(r.mediana, 3);
  assert.equal(r.p25, 2);
  assert.equal(r.p75, 4);
  assert.equal(r.iqr, 2);
  assert.equal(r.amplitude, 4);
  assert.equal(r.ponto_medio, 3);
  assert.equal(r.minimo, 1);
  assert.equal(r.maximo, 5);
});

test('formatos cm e ms arredondam para inteiro com separador pt-BR', async () => {
  const { formatar } = await import('../src/stats/format.js');
  assert.equal(formatar('cm', 362.6), '363 cm');
  assert.equal(formatar('ms', 3736.4), '3.736 ms');
});

test('média aparada descarta 5% de cada ponta e o resumo traz CV e média aparada', () => {
  const v = [0, 0, ...Array(16).fill(5), 10, 10];
  assert.equal(mediaAparada(v, 0.1), 5);
  assert.equal(mediaAparada([1, 2, 3]), 2, 'com poucos registros nada é descartado');
  const r = resumo([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.ok(Math.abs(r.cv - r.dp / 5) < 1e-9);
  assert.equal(r.media_aparada, 5);
});
