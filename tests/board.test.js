import test from 'node:test';
import assert from 'node:assert/strict';
import { CASAS, NUM_CASAS, ROTULO_CASA, avancar, coordenadas } from '../src/engine/board.js';

for (const [colunas, linhas] of [[9, 7], [7, 9]]) {
  test(`coordenadas ${colunas}x${linhas}: 28 células distintas, no perímetro e contíguas`, () => {
    const celulas = Array.from({ length: NUM_CASAS }, (_, i) => coordenadas(i, colunas, linhas));
    assert.equal(new Set(celulas.map((c) => `${c.linha},${c.coluna}`)).size, NUM_CASAS);
    for (const { linha, coluna } of celulas) {
      assert.ok(linha === 1 || linha === linhas || coluna === 1 || coluna === colunas);
    }
    celulas.forEach((c, i) => {
      const n = celulas[(i + 1) % NUM_CASAS];
      assert.equal(Math.abs(c.linha - n.linha) + Math.abs(c.coluna - n.coluna), 1);
    });
  });
}

test('avancar sem volta completa mantém passouInicio falso', () => {
  assert.deepEqual(avancar(5, 4), { posicao: 9, passouInicio: false });
});

test('avancar além da casa 27 volta ao começo e marca passouInicio', () => {
  assert.deepEqual(avancar(25, 4), { posicao: 1, passouInicio: true });
});

test('avancar a partir da casa 27 com 1 passo cai na casa 0 e passa pelo início', () => {
  assert.deepEqual(avancar(27, 1), { posicao: 0, passouInicio: true });
});

test('avancar com total exatamente igual a NUM_CASAS cai na casa 0 e passa pelo início', () => {
  assert.deepEqual(avancar(22, 6), { posicao: 0, passouInicio: true });
});

test('avancar até a última casa (27) ainda não passa pelo início', () => {
  assert.deepEqual(avancar(22, 5), { posicao: 27, passouInicio: false });
});

test('o tabuleiro tem 28 casas: 1 balanço, 18 decisões, 7 eventos e 2 mercados, e o balanço é a casa 0', () => {
  assert.equal(NUM_CASAS, 28);
  assert.equal(CASAS.length, 28);
  const conta = (tipo) => CASAS.filter((c) => c === tipo).length;
  assert.equal(conta('balanco'), 1);
  assert.equal(conta('decisao'), 18);
  assert.equal(conta('evento'), 7);
  assert.equal(conta('mercado'), 2);
  assert.equal(CASAS[0], 'balanco');
  assert.ok(CASAS.every((c) => Object.hasOwn(ROTULO_CASA, c)), 'todo tipo de casa tem rótulo');
});
