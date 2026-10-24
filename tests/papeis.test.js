import test from 'node:test';
import assert from 'node:assert/strict';
import { atribuirPapeis, setoresRepetidos } from '../src/engine/papeis.js';
import { novoJogo } from '../src/engine/state.js';

test('atribuirPapeis: 3 jogadores respeitam a escolha, desde que seja uma permutação', () => {
  assert.deepEqual(atribuirPapeis(3, ['tecnologia', 'pessoas_financas', 'operacoes']), [['tecnologia'], ['pessoas_financas'], ['operacoes']]);
  assert.deepEqual(atribuirPapeis(3, ['tecnologia', 'tecnologia', 'operacoes']), [['operacoes'], ['tecnologia'], ['pessoas_financas']]);
});

test('atribuirPapeis: com 2 jogadores o segundo fica com as diretorias que sobram', () => {
  assert.deepEqual(atribuirPapeis(2, ['tecnologia']), [['tecnologia'], ['operacoes', 'pessoas_financas']]);
  assert.deepEqual(atribuirPapeis(2), [['operacoes'], ['tecnologia', 'pessoas_financas']]);
});

test('atribuirPapeis: 1 jogador acumula todas', () => {
  assert.equal(atribuirPapeis(1, ['tecnologia'])[0].length, 3);
});

test('novoJogo guarda o setor escolhido; valor inválido ou ausente fica null', () => {
  const comp = novoJogo({ jogadores: [{ nome: 'A', nivel: 'iniciante', diretoria: 'tecnologia' }, { nome: 'B', nivel: 'iniciante', diretoria: 'x' }], seed: 1 });
  assert.equal(comp.jogadores[0].diretoria, 'tecnologia');
  assert.equal(comp.jogadores[1].diretoria, null);
  assert.deepEqual(comp.jogadores[0].papeis, []);
  const coop = novoJogo({
    jogadores: [{ nome: 'A', nivel: 'iniciante', diretoria: 'tecnologia' }, { nome: 'B', nivel: 'iniciante' }],
    seed: 1,
    modo: 'cooperativo',
  });
  assert.deepEqual(coop.jogadores[0].papeis, ['tecnologia']);
});

test('setoresRepetidos: competitivo sempre confere; cooperativo só com 3; solo nunca', () => {
  assert.equal(setoresRepetidos('competitivo', ['operacoes', 'operacoes']), true);
  assert.equal(setoresRepetidos('competitivo', ['operacoes', 'tecnologia']), false);
  assert.equal(setoresRepetidos('cooperativo', ['operacoes', 'operacoes', 'tecnologia']), true);
  assert.equal(setoresRepetidos('cooperativo', ['operacoes', 'tecnologia', 'pessoas_financas']), false);
  assert.equal(setoresRepetidos('cooperativo', ['operacoes', 'operacoes']), false);
  assert.equal(setoresRepetidos('cooperativo', ['operacoes']), false);
  assert.equal(setoresRepetidos('solo', ['operacoes']), false);
});
