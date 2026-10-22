import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { valorEsperado } from '../src/engine/calculo.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { salvar, carregar } from '../src/storage/persist.js';

// Integração: uma partida inteira conduzida só pelo reducer, como o main.js faz a cada clique.
// Cada ação é um "pedido" ao motor; entre as ações a partida é salva e, no meio, recarregada.

// Escolhe a ação de quem sabe a resposta (métrica correta, justificativa correta, certeza).
function proximaAcao(e) {
  const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
  switch (e.fase) {
    case 'ROLAR_DADO':
      return { tipo: 'ROLAR' };
    case 'ESCOLHER_CONFIANCA':
      return { tipo: 'CONFIANCA', valor: 'certeza' };
    case 'ESCOLHER_METRICA':
      return { tipo: 'METRICA', valor: def.opcoes.find((o) => o.correta).id };
    case 'INFORMAR_VALOR':
      return { tipo: 'VALOR', valor: valorEsperado(def, e.cenarioAtual) };
    case 'ESCOLHER_JUSTIFICATIVA':
      return { tipo: 'JUSTIFICATIVA', valor: def.justificativas.find((j) => j.tipo === 'correta').id };
    default:
      return { tipo: 'CONTINUAR' };
  }
}

const jogoNovo = (modo) =>
  novoJogo({
    jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'avancado' }],
    modo,
    turnos: 6,
    seed: 99,
  });

// Mock de localStorage: o persist.js lê o global no momento da chamada.
function comLocalStorageFalso(fn) {
  const dados = new Map();
  const falso = {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: falso, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

for (const modo of ['competitivo', 'cooperativo']) {
  test(`partida ${modo}: salvar e recarregar no meio não altera o resultado`, () => {
    // Referência: partida sem interrupções.
    let referencia = jogoNovo(modo);
    for (let i = 0; i < 1000 && referencia.fase !== 'FIM_DE_JOGO'; i++) {
      referencia = reduzir(referencia, proximaAcao(referencia));
    }
    assert.equal(referencia.fase, 'FIM_DE_JOGO');

    // Mesma partida, salvando a cada ação e recarregando do save na metade.
    comLocalStorageFalso(() => {
      let e = jogoNovo(modo);
      let acoes = 0;
      for (let i = 0; i < 1000 && e.fase !== 'FIM_DE_JOGO'; i++) {
        e = reduzir(e, proximaAcao(e));
        salvar(e);
        acoes++;
        if (acoes === 40) {
          const recarregado = carregar();
          assert.ok(recarregado, 'o save deve ser lido de volta no meio da partida');
          e = recarregado;
        }
      }
      assert.ok(acoes > 40, 'a partida precisa passar do ponto de recarga');
      assert.deepEqual(e, referencia);
    });
  });
}
