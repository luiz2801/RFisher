import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from '../src/engine/state.js';
import { salvar, carregar, limpar } from '../src/storage/persist.js';

const CHAVE = 'tabuleiro-do-ceo:partida:v1';

// Substitui o localStorage global por um falso em memória. Devolve a função que restaura o original.
function mockLocalStorage(falso) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: falso, configurable: true, writable: true });
  return () => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  };
}

// Falso localStorage: `dados` guarda o que foi escrito; `sobrescreve` permite simular falhas.
function falsoLocalStorage(sobrescreve = {}) {
  const dados = new Map();
  return {
    dados,
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    ...sobrescreve,
  };
}

const partida = () => novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], seed: 7 });

test('salvar e carregar devolvem a mesma partida (ida e volta)', () => {
  const falso = falsoLocalStorage();
  const restaurar = mockLocalStorage(falso);
  try {
    const e = partida();
    salvar(e);
    assert.ok(falso.dados.has(CHAVE), 'grava na chave versionada');
    assert.deepEqual(carregar(), e);
  } finally {
    restaurar();
  }
});

test('carregar devolve null quando o save é ausente, inválido ou de outra versão', () => {
  const casos = {
    'chave ausente': null,
    'JSON inválido': '{partida quebrada',
    'versão diferente de 1': JSON.stringify({ ...partida(), versao: 2 }),
    'sem jogadores': JSON.stringify({ ...partida(), jogadores: undefined }),
    'sem fase': JSON.stringify({ ...partida(), fase: undefined }),
  };
  for (const [caso, conteudo] of Object.entries(casos)) {
    const falso = falsoLocalStorage();
    if (conteudo !== null) falso.dados.set(CHAVE, conteudo);
    const restaurar = mockLocalStorage(falso);
    try {
      assert.equal(carregar(), null, caso);
    } finally {
      restaurar();
    }
  }
});

test('limpar remove a partida salva', () => {
  const falso = falsoLocalStorage();
  const restaurar = mockLocalStorage(falso);
  try {
    salvar(partida());
    limpar();
    assert.equal(falso.dados.has(CHAVE), false);
    assert.equal(carregar(), null);
  } finally {
    restaurar();
  }
});

test('falhas do localStorage (cota excedida, modo privado) não lançam erro', () => {
  const erro = () => {
    throw new DOMException('cota excedida', 'QuotaExceededError');
  };
  const falso = falsoLocalStorage({ setItem: erro, getItem: erro, removeItem: erro });
  const restaurar = mockLocalStorage(falso);
  try {
    assert.doesNotThrow(() => salvar(partida()));
    assert.equal(carregar(), null);
    assert.doesNotThrow(() => limpar());
  } finally {
    restaurar();
  }
});
