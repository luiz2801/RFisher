import test from 'node:test';
import assert from 'node:assert/strict';
import { NUM_CASAS, coordenadas } from '../src/engine/board.js';

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
