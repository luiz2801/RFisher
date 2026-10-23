import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng, proximo } from '../src/engine/rng.js';

const sequencia = (rng, n) => Array.from({ length: n }, () => rng.prox());

test('a mesma seed produz a mesma sequência e seeds distintas produzem sequências diferentes', () => {
  assert.deepEqual(sequencia(criarRng(42), 20), sequencia(criarRng(42), 20));
  assert.notDeepEqual(sequencia(criarRng(42), 20), sequencia(criarRng(43), 20));
});

test('proximo é puro: o mesmo estado dá o mesmo valor e o mesmo novo estado', () => {
  assert.deepEqual(proximo(123), proximo(123));
  const [v, s] = proximo(123);
  assert.ok(v >= 0 && v < 1);
  assert.equal(criarRng(123).prox(), v);
  assert.equal(s, (123 + 0x6d2b79f5) >>> 0);
});

test('prox devolve sempre valores em [0, 1) (1.000 sorteios)', () => {
  const rng = criarRng(2024);
  for (let i = 0; i < 1000; i++) {
    const v = rng.prox();
    assert.ok(Number.isFinite(v) && v >= 0 && v < 1, `fora do intervalo: ${v}`);
  }
});

test('entre sorteia dentro de [min, max)', () => {
  const rng = criarRng(5);
  for (let i = 0; i < 1000; i++) {
    const v = rng.entre(-3, 7);
    assert.ok(v >= -3 && v < 7, `fora do intervalo: ${v}`);
  }
});

test('inteiro inclui os dois extremos e nunca sai do intervalo (dado de 1 a 6)', () => {
  const rng = criarRng(7);
  const vistos = new Set();
  for (let i = 0; i < 1000; i++) {
    const v = rng.inteiro(1, 6);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 6, `fora do intervalo: ${v}`);
    vistos.add(v);
  }
  assert.deepEqual([...vistos].sort(), [1, 2, 3, 4, 5, 6]);
});

test('inteiro funciona em intervalos mínimos: 0 a 1 e um único valor', () => {
  const rng = criarRng(11);
  const vistos = new Set();
  for (let i = 0; i < 200; i++) vistos.add(rng.inteiro(0, 1));
  assert.deepEqual([...vistos].sort(), [0, 1]);
  for (let i = 0; i < 20; i++) assert.equal(rng.inteiro(4, 4), 4);
});

test('embaralhar não altera a lista original e devolve outra lista', () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const copia = [...original];
  const resultado = criarRng(3).embaralhar(original);
  assert.deepEqual(original, copia);
  assert.notEqual(resultado, original);
});

test('embaralhar devolve uma permutação dos mesmos elementos, inclusive repetidos', () => {
  const original = ['a', 'b', 'c', 'c', 'd', 'e', 'e', 'e'];
  const resultado = criarRng(9).embaralhar(original);
  assert.equal(resultado.length, original.length);
  assert.deepEqual([...resultado].sort(), [...original].sort());
});

test('embaralhar é determinístico para o mesmo estado do RNG e varia com outra seed', () => {
  const lista = Array.from({ length: 20 }, (_, i) => i);
  assert.deepEqual(criarRng(8).embaralhar(lista), criarRng(8).embaralhar(lista));
  assert.notDeepEqual(criarRng(8).embaralhar(lista), criarRng(9).embaralhar(lista));
});

test('embaralhar lida com lista vazia e com um elemento', () => {
  assert.deepEqual(criarRng(1).embaralhar([]), []);
  assert.deepEqual(criarRng(1).embaralhar(['só']), ['só']);
});

test('normal: média e desvio amostrais se aproximam dos parâmetros, sem NaN nem Infinity (5.000 sorteios)', () => {
  const rng = criarRng(2026);
  const media = 100;
  const dp = 15;
  const n = 5000;
  const amostra = Array.from({ length: n }, () => rng.normal(media, dp));
  assert.ok(amostra.every(Number.isFinite), 'há NaN ou Infinity');
  const mediaAmostral = amostra.reduce((s, v) => s + v, 0) / n;
  const dpAmostral = Math.sqrt(amostra.reduce((s, v) => s + (v - mediaAmostral) ** 2, 0) / (n - 1));
  // Erro-padrão da média = 15 / √5000 ≈ 0,21; tolerância de 1,0 (~5 erros-padrão) com seed fixa.
  assert.ok(Math.abs(mediaAmostral - media) < 1, `média amostral = ${mediaAmostral}`);
  // O dp amostral tem erro-padrão ≈ 15 / √(2 × 5000) = 0,15; tolerância de 0,75.
  assert.ok(Math.abs(dpAmostral - dp) < 0.75, `desvio amostral = ${dpAmostral}`);
});

test('normal sem argumentos é a normal padrão', () => {
  const rng = criarRng(77);
  const n = 5000;
  const amostra = Array.from({ length: n }, () => rng.normal());
  const m = amostra.reduce((s, v) => s + v, 0) / n;
  const dp = Math.sqrt(amostra.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
  assert.ok(Math.abs(m) < 0.1, `média = ${m}`);
  assert.ok(Math.abs(dp - 1) < 0.05, `desvio = ${dp}`);
});

test('o estado exposto retoma a sequência exatamente de onde parou (usado no save)', () => {
  const original = criarRng(31415);
  sequencia(original, 5);
  const s = original.estado;
  const retomado = criarRng(s);
  // Do 6º número em diante, os dois geradores coincidem.
  assert.deepEqual(sequencia(retomado, 10), sequencia(original, 10));
});

test('o estado sobrevive a JSON e é um inteiro de 32 bits sem sinal', () => {
  const rng = criarRng(99);
  sequencia(rng, 3);
  assert.ok(Number.isInteger(rng.estado) && rng.estado >= 0 && rng.estado <= 0xffffffff);
  assert.equal(JSON.parse(JSON.stringify(rng.estado)), rng.estado);
});

test('seed fora de 32 bits ou negativa é reduzida a 32 bits sem sinal', () => {
  assert.equal(criarRng(2 ** 32 + 5).estado, 5);
  assert.equal(criarRng(-1).estado, 0xffffffff);
  assert.deepEqual(sequencia(criarRng(2 ** 32 + 5), 5), sequencia(criarRng(5), 5));
});
