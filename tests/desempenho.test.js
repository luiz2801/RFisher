import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { obterCenario, todosCenarios, validarCenario } from '../src/scenarios/loader.js';
import { CONCEITOS } from '../src/scenarios/content/conceitos.js';
import { criarRng } from '../src/engine/rng.js';
import {
  certeza, evidencia, diagnosticar, calibrar, perfilDesempenho, equivocosDaEscolha,
} from '../src/engine/desempenho.js';

const h = (cenario, resultado, confianca, extra = {}) => ({ cenario, resultado, confianca, metrica: 'x', justificativa: 'y', delta: 0, ...extra });

test('certeza vai de 0 (chute) a 1 (certeza absoluta) em degraus iguais', () => {
  assert.deepEqual(['chute', 'duvida', 'provavel', 'confiante', 'certeza'].map(certeza), [0, 0.25, 0.5, 0.75, 1]);
});

test('evidência: errar com certeza pesa o dobro de errar no chute; acerto parcial é neutro', () => {
  assert.equal(evidencia(1, 1), 1);
  assert.equal(evidencia(0, 1), -1);
  assert.equal(evidencia(1, 0), 0.5);
  assert.equal(evidencia(0, 0), -0.5);
  assert.equal(evidencia(0.5, 1), 0);
});

test('diagnóstico cruza acerto e certeza nos quatro quadrantes', () => {
  assert.equal(diagnosticar(1, 1), 'dominado');
  assert.equal(diagnosticar(1, 0), 'inseguro');
  assert.equal(diagnosticar(0, 1), 'equivoco');
  assert.equal(diagnosticar(0, 0), 'lacuna');
  assert.equal(diagnosticar(0.5, 1), 'equivoco', 'meio certo não é domínio');
});

test('calibração compara certeza média com acerto médio', () => {
  assert.equal(calibrar(0.2, 0.9), 'superconfiante');
  assert.equal(calibrar(0.9, 0.2), 'subconfiante');
  assert.equal(calibrar(0.6, 0.65), 'calibrado');
});

test('perfil separa pontos fortes e deficiências e ordena pela gravidade', () => {
  const perfil = perfilDesempenho({
    historico: [
      h('cenario_01_salarios', 'sucesso', 'certeza'),
      h('cenario_03_estoque', 'sucesso', 'chute'),
      h('cenario_02_sla', 'erro_total', 'duvida'),
      h('cenario_06_sac', 'erro_total', 'certeza'),
    ],
  });
  assert.deepEqual(perfil.pontosFortes.map((c) => [c.id, c.diagnostico]), [['mediana', 'dominado'], ['moda', 'inseguro']]);
  assert.deepEqual(perfil.deficiencias.map((c) => [c.id, c.diagnostico]), [['iqr', 'equivoco'], ['percentil', 'lacuna']]);
  assert.equal(perfil.deficiencias[0].nome, CONCEITOS.iqr);
  assert.equal(perfil.geral.decisoes, 4);
});

test('cenários do mesmo conceito são agregados', () => {
  const perfil = perfilDesempenho({
    historico: [h('cenario_01_salarios', 'sucesso', 'certeza'), h('cenario_01_salarios', 'erro_total', 'certeza')],
  });
  assert.equal(perfil.conceitos.length, 1);
  assert.equal(perfil.conceitos[0].decisoes, 2);
  assert.equal(perfil.conceitos[0].taxaAcerto, 0.5);
});

test('equívocos repetidos aparecem primeiro, pesados pela certeza', () => {
  const perfil = perfilDesempenho({
    historico: [
      h('cenario_01_salarios', 'erro_total', 'chute', { equivocos: ['a'] }),
      h('cenario_02_sla', 'erro_total', 'certeza', { equivocos: ['b'] }),
      h('cenario_03_estoque', 'erro_total', 'certeza', { equivocos: ['b'] }),
    ],
  });
  assert.deepEqual(perfil.equivocos.map((q) => [q.id, q.vezes, q.peso]), [['b', 2, 2], ['a', 1, 0.5]]);
  assert.deepEqual(perfil.equivocos[0].cenarios, ['cenario_02_sla', 'cenario_03_estoque']);
});

test('histórico antigo, sem conceito nem equívocos, é completado pelo conteúdo', () => {
  const perfil = perfilDesempenho({
    historico: [{ cenario: 'cenario_01_salarios', metrica: 'media', justificativa: 'j3', confianca: 'certeza', resultado: 'erro_total', delta: 0 }],
  });
  assert.equal(perfil.conceitos[0].id, 'mediana');
  assert.deepEqual(perfil.equivocos.map((q) => q.id), ['ignora_outliers', 'confunde_mediana_moda']);
});

test('jogador sem decisões tem perfil vazio', () => {
  const perfil = perfilDesempenho({ historico: [] });
  assert.deepEqual([perfil.conceitos, perfil.pontosFortes, perfil.deficiencias, perfil.equivocos], [[], [], [], []]);
  assert.equal(perfil.geral.decisoes, 0);
});

test('equivocosDaEscolha junta opção e justificativa sem repetir', () => {
  assert.deepEqual(equivocosDaEscolha({ equivoco: 'x' }, { equivoco: 'x' }), ['x']);
  assert.deepEqual(equivocosDaEscolha({ correta: true }, { tipo: 'correta' }), []);
});

test('todo cenário tem conceito do catálogo e o validador o exige', () => {
  for (const c of todosCenarios()) assert.ok(Object.hasOwn(CONCEITOS, c.conceito), c.id);
  const ruim = structuredClone(todosCenarios()[0]);
  delete ruim.conceito;
  assert.ok(validarCenario(ruim, criarRng(1)).some((m) => m.includes('conceito')));
});

test('a partida grava conceito e equívocos no histórico de cada decisão', () => {
  let e = novoJogo({ jogadores: [{ nome: 'A', nivel: 'iniciante' }], turnos: 8, seed: 5 });
  while (e.fase !== 'FIM_DE_JOGO') {
    const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
    const errada = def?.opcoes.find((o) => !o.correta);
    const acao = {
      ROLAR_DADO: { tipo: 'ROLAR' },
      ESCOLHER_METRICA: { tipo: 'METRICA', valor: errada?.id },
      ESCOLHER_JUSTIFICATIVA: { tipo: 'JUSTIFICATIVA', valor: def?.justificativas.find((x) => x.tipo === 'correta').id },
      ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'certeza' },
    }[e.fase] ?? { tipo: 'CONTINUAR' };
    e = reduzir(e, acao);
  }
  const { historico } = e.jogadores[0];
  assert.ok(historico.length > 0);
  for (const d of historico) {
    const def = obterCenario(d.cenario);
    assert.equal(d.conceito, def.conceito);
    assert.deepEqual(d.equivocos, [def.opcoes.find((o) => o.id === d.metrica).equivoco]);
  }
  const perfil = perfilDesempenho(e.jogadores[0]);
  assert.ok(perfil.deficiencias.length > 0 && perfil.pontosFortes.length === 0);
  assert.ok(perfil.deficiencias.every((c) => c.diagnostico === 'equivoco'));
});
