import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo, diretoriasDe, diretoriasAtivas } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { motivoIndisponivel, resumoDoDashboard, usosRestantes } from '../src/engine/habilidades.js';
import { HABILIDADE_USOS } from '../src/engine/config.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { DIRETORIAS } from '../src/engine/papeis.js';

const SIMPLES = 'cenario_01_salarios'; // histograma de uma série, com dica
const CALCULO = 'cenario_26_bonus_vendas';

const jogo = (modo, diretoria, cenario = SIMPLES, extra = {}) =>
  reduzir(novoJogo({
    jogadores: [{ nome: 'Ana', nivel: 'avancado', diretoria }, { nome: 'Bia', nivel: 'iniciante' }],
    modo, seed: 11, teste: { casa: 'decisao', cenarios: [cenario] }, ...extra,
  }), { tipo: 'ROLAR' });
const usar = (e, id) => reduzir(e, { tipo: 'USAR_HABILIDADE', valor: id });

test('cada diretoria tem uma habilidade ativa e uma passiva descritas', () => {
  for (const d of Object.values(DIRETORIAS)) {
    assert.ok(d.habilidade.nome && d.habilidade.descricao, d.nome);
    assert.ok(d.passivo.nome && d.passivo.descricao, d.nome);
  }
});

test('as diretorias de quem decide vêm do setor escolhido (competitivo e solo) ou dos papéis (cooperativo)', () => {
  const comp = jogo('competitivo', 'tecnologia');
  assert.deepEqual(diretoriasDe(comp, comp.jogadores[0]), ['tecnologia']);
  assert.deepEqual(diretoriasAtivas(comp), ['tecnologia']);
  const coop = jogo('cooperativo', 'tecnologia');
  assert.deepEqual(diretoriasDe(coop, coop.jogadores[0]), ['tecnologia']);
  assert.equal(diretoriasAtivas(coop).length, 3, 'no cooperativo todo setor tem responsável');
  const bot = { id: 1, bot: 'medio' };
  assert.deepEqual(diretoriasDe(comp, bot), [], 'o rival do computador não tem habilidades');
});

test('Dashboard (Tecnologia) mostra o resumo e gasta um uso, em qualquer modo', () => {
  for (const modo of ['competitivo', 'cooperativo']) {
    const e = usar(jogo(modo, 'tecnologia'), 'tecnologia');
    assert.equal(e.cenarioAtual.dashboard, true, modo);
    assert.deepEqual(e.cenarioAtual.habilidades, ['tecnologia']);
    assert.equal(usosRestantes(e.jogadores[0], 'tecnologia'), HABILIDADE_USOS - 1);
  }
  const e = jogo('competitivo', 'tecnologia');
  const [r] = resumoDoDashboard(obterCenario(SIMPLES), e.cenarioAtual);
  const v = [...e.cenarioAtual.series[0].valores];
  assert.equal(r.n, v.length);
  assert.equal(r.minimo, Math.min(...v));
  assert.equal(r.maximo, Math.max(...v));
});

test('Dashboard não vale em cenário de cálculo nem mostra colunas ocultas até o resultado', () => {
  const calc = jogo('competitivo', 'tecnologia', CALCULO);
  assert.match(motivoIndisponivel(calc, calc.jogadores[0], calc.cenarioAtual, obterCenario(CALCULO), 'tecnologia'), /cálculo/);
  assert.deepEqual(usar(calc, 'tecnologia'), calc, 'ação ignorada');
  const id = 'cenario_22_simpson_rh';
  const e = jogo('competitivo', 'tecnologia', id);
  const def = obterCenario(id);
  assert.equal(resumoDoDashboard(def, e.cenarioAtual).length, e.cenarioAtual.series.length - def.dados.ocultas_ate_resultado.length);
});

test('Treinamento (Pessoas e Finanças) abre a dica sem reduzir o bônus, até no nível avançado', () => {
  const e = usar(jogo('competitivo', 'pessoas_financas'), 'pessoas_financas');
  assert.equal(e.cenarioAtual.dicaLivre, true);
  assert.equal(e.cenarioAtual.dicaUsada, false);
  let r = reduzir(e, { tipo: 'METRICA', valor: e.cenarioAtual.ordemOpcoes[0] });
  r = reduzir(r, { tipo: 'JUSTIFICATIVA', valor: e.cenarioAtual.ordemJustificativas[0] });
  r = reduzir(r, { tipo: 'CONFIANCA', valor: 'certeza' });
  assert.equal(r.resultado.dicaUsada, false, 'o bônus de confiança não é reduzido');
  assert.deepEqual(r.resultado.habilidades, ['pessoas_financas']);
});

test('Treinamento não vale com a dica paga já aberta, e a dica paga não abre depois dele', () => {
  const aberta = reduzir(jogo('competitivo', 'pessoas_financas'), { tipo: 'ABRIR_DICA' });
  assert.equal(aberta.cenarioAtual.dicaUsada, false, 'avançado não abre a dica paga');
  const ini = reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante', diretoria: 'pessoas_financas' }, { nome: 'Bia', nivel: 'iniciante' }], seed: 3, teste: { casa: 'decisao', cenarios: [SIMPLES] } }), { tipo: 'ROLAR' });
  const paga = reduzir(ini, { tipo: 'ABRIR_DICA' });
  assert.equal(paga.cenarioAtual.dicaUsada, true);
  assert.deepEqual(usar(paga, 'pessoas_financas'), paga, 'a dica já foi aberta');
  const livre = usar(ini, 'pessoas_financas');
  assert.equal(reduzir(livre, { tipo: 'ABRIR_DICA' }).cenarioAtual.dicaUsada, false);
});

test('Plano B (Operações) remove uma métrica incorreta e ela não pode ser escolhida', () => {
  const e = usar(jogo('competitivo', 'operacoes'), 'operacoes');
  const removida = e.cenarioAtual.opcaoRemovida;
  assert.ok(removida);
  assert.equal(obterCenario(SIMPLES).opcoes.find((o) => o.id === removida).correta, false);
  assert.deepEqual(reduzir(e, { tipo: 'METRICA', valor: removida }), e, 'a opção removida é ignorada');
  const certa = obterCenario(SIMPLES).opcoes.find((o) => o.correta).id;
  assert.equal(reduzir(e, { tipo: 'METRICA', valor: certa }).cenarioAtual.metricaId, certa);
});

test('Plano B é determinístico pela seed', () => {
  assert.equal(usar(jogo('competitivo', 'operacoes'), 'operacoes').cenarioAtual.opcaoRemovida, usar(jogo('competitivo', 'operacoes'), 'operacoes').cenarioAtual.opcaoRemovida);
});

test('só vale a habilidade da própria diretoria, uma vez por cenário e HABILIDADE_USOS vezes por partida', () => {
  const e = jogo('competitivo', 'operacoes');
  assert.deepEqual(usar(e, 'tecnologia'), e, 'outra diretoria');
  assert.deepEqual(usar(e, 'inexistente'), e);
  const uma = usar(e, 'operacoes');
  assert.deepEqual(usar(uma, 'operacoes'), uma, 'uma vez por cenário');
  const gasta = structuredClone(e);
  gasta.jogadores[0].habilidadeUsos = { operacoes: HABILIDADE_USOS };
  assert.deepEqual(usar(gasta, 'operacoes'), gasta, 'sem usos restantes');
});

test('no cooperativo, quem acumula diretorias usa cada habilidade uma vez por cenário', () => {
  const solo = reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'avancado' }], modo: 'cooperativo', seed: 4, teste: { casa: 'decisao', cenarios: [SIMPLES] } }), { tipo: 'ROLAR' });
  let r = solo;
  for (const id of ['operacoes', 'tecnologia', 'pessoas_financas']) r = usar(r, id);
  assert.deepEqual(r.cenarioAtual.habilidades, ['operacoes', 'tecnologia', 'pessoas_financas']);
});

test('saves antigos com habilidadeUsos = 0 têm todos os usos', () => {
  const e = jogo('competitivo', 'tecnologia');
  e.jogadores[0].habilidadeUsos = 0;
  assert.equal(usosRestantes(e.jogadores[0], 'tecnologia'), HABILIDADE_USOS);
  assert.deepEqual(usar(e, 'tecnologia').jogadores[0].habilidadeUsos, { tecnologia: 1 });
});

test('o rival do computador não usa habilidades', () => {
  const e = reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'avancado', diretoria: 'tecnologia' }, { nome: 'Rival', nivel: 'avancado', bot: 'medio' }], seed: 6, teste: { casa: 'decisao', cenarios: [SIMPLES] } }), { tipo: 'ROLAR' });
  e.jogadorAtual = 1;
  assert.deepEqual(usar(e, 'tecnologia'), e);
});
