import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { obterCenario, todosCenarios, validarCenario } from '../src/scenarios/loader.js';
import { CONCEITOS } from '../src/scenarios/content/conceitos.js';
import { criarRng } from '../src/engine/rng.js';
import {
  certeza, evidencia, diagnosticar, calibrar, perfilDesempenho, equivocosDaEscolha, relatorioDesempenho,
} from '../src/engine/desempenho.js';
import { MATERIAIS } from '../src/scenarios/content/materiais.js';

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

test('relatório conta acertos, parciais e erros, e métricas e justificativas certas', () => {
  const r = relatorioDesempenho({
    historico: [
      h('cenario_01_salarios', 'sucesso', 'certeza'),
      h('cenario_02_sla', 'sorte', 'provavel'),
      h('cenario_03_estoque', 'incoerencia', 'duvida'),
      h('cenario_04_pecas', 'erro_total', 'certeza'),
      h('cenario_07_envase', 'erro_total', 'chute'),
    ],
  });
  assert.deepEqual(
    [r.decisoes, r.acertos, r.parciais, r.erros, r.metricasCertas, r.justificativasCertas],
    [5, 1, 2, 2, 2, 2],
  );
  assert.deepEqual(r.maisDomina.map((c) => c.id), ['mediana']);
  // Errar com certeza pesa mais que errar no chute; acertos parciais (domínio 0) vêm depois, o mais convicto primeiro.
  assert.deepEqual(r.menosDomina.map((c) => c.id), ['desvio_padrao', 'media', 'percentil']);
});

test('relatório sugere materiais das deficiências, depois do conhecimento inseguro', () => {
  const r = relatorioDesempenho({
    historico: [
      h('cenario_01_salarios', 'sucesso', 'certeza'),
      h('cenario_03_estoque', 'sucesso', 'chute'),
      h('cenario_04_pecas', 'erro_total', 'certeza'),
    ],
  });
  assert.deepEqual(r.sugestoes.map((s) => [s.conceito, s.motivo]), [['desvio_padrao', 'equivoco'], ['moda', 'inseguro']]);
  for (const s of r.sugestoes) assert.ok(s.revisar && s.links.length > 0, s.conceito);
});

test('sem deficiências, o relatório sugere conceitos que a partida não cobrou', () => {
  const r = relatorioDesempenho({ historico: [h('cenario_01_salarios', 'sucesso', 'certeza')] });
  assert.equal(r.menosDomina.length, 0);
  assert.ok(r.sugestoes.length > 0);
  assert.ok(r.sugestoes.every((s) => s.motivo === 'nao_visto' && s.conceito !== 'mediana'));
});

test('relatório de quem não tomou nenhuma decisão fica vazio, sem quebrar', () => {
  const r = relatorioDesempenho({ historico: [] });
  assert.deepEqual([r.decisoes, r.acertos, r.erros, r.maisDomina.length, r.menosDomina.length], [0, 0, 0, 0, 0]);
  assert.ok(r.materialGeral.url.startsWith('https://'));
});

test('todo conceito do catálogo tem o que revisar e materiais com link https', () => {
  for (const id of Object.keys(CONCEITOS)) {
    const m = MATERIAIS[id];
    assert.ok(m?.revisar, id);
    assert.ok(m.links.length > 0 && m.links.every((l) => l.titulo && l.fonte && l.url.startsWith('https://')), id);
  }
});
