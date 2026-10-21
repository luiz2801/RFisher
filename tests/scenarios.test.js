import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { todosCenarios, validarCenario, instanciar, preencher } from '../src/scenarios/loader.js';

test('todo o conteúdo é válido (várias seeds)', () => {
  for (const def of todosCenarios()) {
    for (const seed of [1, 7, 99, 2024]) {
      assert.deepEqual(validarCenario(def, criarRng(seed)), []);
    }
  }
});

test('ids de cenário são únicos', () => {
  const ids = todosCenarios().map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('placeholders são calculados a partir dos dados', () => {
  const def = todosCenarios()[0];
  const { vars, num } = instanciar(def, criarRng(5));
  assert.ok(num.media > num.mediana * 1.5);
  assert.match(preencher(def.opcoes[0].texto, vars), /^Mediana \(R\$ [\d.]+\)$/);
});

test('o validador detecta problemas', () => {
  const ruim = structuredClone(todosCenarios()[0]);
  ruim.opcoes[1].correta = true;
  ruim.opcoes[2].equivoco = 'inexistente';
  ruim.contexto += ' {{nao_existe}}';
  const erros = validarCenario(ruim, criarRng(1));
  assert.equal(erros.length, 3, erros.join('\n'));
});
