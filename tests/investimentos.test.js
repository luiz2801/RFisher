import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import {
  porteDaReputacao, valorEsperado, ganhoComConsultoria, sortearOferta, liquidar, totalInvestido, honorarioDaConsultoria, OPCOES_DIAGNOSTICO,
} from '../src/engine/investimentos.js';
import { EMPRESAS, PORTES, FALACIAS, obterEmpresa } from '../src/scenarios/content/investimentos.js';
import {
  APORTES, FAIXAS_MERCADO, CONSULTORIA_PENALIDADE, SORTEIO_PROBABILIDADE, ANALISE_BONUS_REPUTACAO, ANALISE_PENALIDADE_REPUTACAO,
  CUSTOS_BALANCO, CONSULTORIA_HONORARIO_FRACASSO,
} from '../src/engine/config.js';
import { receitaBalanco } from '../src/engine/scoring.js';

const DOIS = [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'iniciante' }];
const jogo = (extra = {}) => novoJogo({ jogadores: DOIS, seed: 7, teste: { casa: 'mercado' }, ...extra });
const naOferta = (extra) => reduzir(jogo(extra), { tipo: 'ROLAR' });
const agir = (e, tipo, valor) => reduzir(e, { tipo, valor });
// Ação ignorada: o estado volta igual (a máquina devolve um clone).
const ignora = (e, tipo, valor, msg) => assert.deepEqual(agir(e, tipo, valor), e, msg);

// ---------- catálogo ----------

test('o catálogo tem ids únicos e campos válidos, com narrativa de sucesso e de fracasso', () => {
  assert.equal(new Set(EMPRESAS.map((x) => x.id)).size, EMPRESAS.length);
  for (const x of EMPRESAS) {
    assert.ok(Object.hasOwn(PORTES, x.porte), `${x.id}: porte inexistente`);
    assert.ok(x.nome && x.setor && x.tempo && x.fundador && x.explicacao && x.sucesso && x.fracasso, `${x.id}: texto faltando`);
    assert.ok(x.prob > 0 && x.prob < 1, `${x.id}: prob fora de (0, 1)`);
    assert.ok(x.ganho > 0 && x.perda > 0 && x.perda <= 1, `${x.id}: ganho e perda inválidos`);
    assert.equal(x.historico.length, 4, `${x.id}: histórico de 4 trimestres`);
    assert.ok(x.falha === null || (Object.hasOwn(FALACIAS, x.falha) && x.falha !== 'nenhuma'), `${x.id}: falha inválida`);
  }
});

test('todo porte tem ao menos 2 empresas de argumento sólido e 2 furadas, e as FAIXAS_MERCADO cobrem os portes', () => {
  assert.deepEqual(FAIXAS_MERCADO.map((f) => f.id), Object.keys(PORTES));
  for (const porte of Object.keys(PORTES)) {
    const doPorte = EMPRESAS.filter((x) => x.porte === porte);
    assert.ok(doPorte.filter((x) => x.falha === null).length >= 2, `${porte}: faltam empresas sólidas`);
    assert.ok(doPorte.filter((x) => x.falha !== null).length >= 2, `${porte}: faltam furadas`);
  }
});

test('toda falácia do diagnóstico aparece em ao menos uma empresa', () => {
  for (const id of OPCOES_DIAGNOSTICO.filter((x) => x !== 'nenhuma')) {
    assert.ok(EMPRESAS.some((x) => x.falha === id), `falácia sem empresa: ${id}`);
  }
});

test('valor esperado: empresa com falha é furada e sem falha é bom negócio, mesmo no pior sorteio da chance', () => {
  for (const x of EMPRESAS) {
    if (x.falha) {
      assert.ok(valorEsperado({ ...x, prob: x.prob + SORTEIO_PROBABILIDADE }) < 0, `${x.id}: deveria ter valor esperado negativo`);
    } else {
      assert.ok(valorEsperado({ ...x, prob: x.prob - SORTEIO_PROBABILIDADE }) > 0.05, `${x.id}: deveria ter valor esperado positivo`);
    }
  }
});

test('investir sem critério fica perto de zero em cada porte, e escolher só as sólidas rende bem mais (o chute não compensa)', () => {
  const media = (lista) => lista.reduce((soma, x) => soma + valorEsperado(x), 0) / lista.length;
  for (const porte of Object.keys(PORTES)) {
    const doPorte = EMPRESAS.filter((x) => x.porte === porte);
    assert.ok(Math.abs(media(doPorte)) < 0.06, `${porte}: o investimento às cegas deveria ficar perto de zero`);
    assert.ok(media(doPorte.filter((x) => !x.falha)) > 0.08 + media(doPorte), `${porte}: a análise deveria render mais que o acaso`);
  }
  assert.ok(Math.abs(media(EMPRESAS)) < 0.05);
});

test('a consultoria cobra metade do retorno do sucesso e um honorário fixo no fracasso', () => {
  assert.equal(ganhoComConsultoria(1), 0.5);
  assert.equal(CONSULTORIA_PENALIDADE, 0.5);
  assert.equal(CONSULTORIA_HONORARIO_FRACASSO, 15000);
  assert.equal(honorarioDaConsultoria(true), 15000);
  assert.equal(honorarioDaConsultoria(false), 0);
});

// ---------- porte e oferta ----------

test('porteDaReputacao: limites das faixas de reputação', () => {
  const casos = [[0, 'micro'], [34, 'micro'], [35, 'pme'], [50, 'pme'], [69, 'pme'], [70, 'consolidada'], [89, 'consolidada'], [90, 'elite'], [100, 'elite']];
  for (const [reputacao, porte] of casos) assert.equal(porteDaReputacao(reputacao), porte, `reputação ${reputacao}`);
});

test('sortearOferta: empresa do porte da reputação, sem repetir no ciclo, chance perto da do catálogo e reproduzível', () => {
  const e = { baralhoInvestimentos: {} };
  const rng = criarRng(11);
  const doPorte = EMPRESAS.filter((x) => x.porte === 'pme');
  const vistos = [];
  for (let i = 0; i < doPorte.length; i++) {
    const o = sortearOferta(e, 50, rng);
    const def = obterEmpresa(o.empresaId);
    assert.equal(def.porte, 'pme');
    assert.ok(Math.abs(o.prob - def.prob) <= SORTEIO_PROBABILIDADE + 1e-9);
    assert.deepEqual([o.consultoria, o.diagnostico, o.analise, o.aporte, o.decisao], [false, null, null, null, null]);
    vistos.push(o.empresaId);
  }
  assert.equal(new Set(vistos).size, doPorte.length, 'um ciclo inteiro sem repetir');
  assert.ok(vistos.every((id) => doPorte.some((x) => x.id === id)));
  // O ciclo seguinte recomeça (o baralho se refaz).
  assert.ok(sortearOferta(e, 50, rng).empresaId);
  // Mesma seed, mesma sequência.
  const a = sortearOferta({}, 80, criarRng(5));
  const b = sortearOferta({}, 80, criarRng(5));
  assert.deepEqual(a, b);
});

test('sortearOferta aceita save antigo, sem baralhoInvestimentos', () => {
  const e = {};
  assert.equal(obterEmpresa(sortearOferta(e, 20, criarRng(1)).empresaId).porte, 'micro');
  assert.ok(Array.isArray(e.baralhoInvestimentos.micro));
});

// ---------- liquidação ----------

const inv = (extra = {}) => ({ empresaId: 'distribuidora_norte_vale', nome: 'Distribuidora Norte Vale', porte: 'pme', valor: 10000, prob: 0.5, ganho: 0.5, perda: 0.4, consultoria: false, turnoAporte: 1, ...extra });

test('liquidar: com chance 1 sempre sucesso e com chance 0 sempre fracasso, com crédito arredondado a centenas', () => {
  const ganha = liquidar(inv({ prob: 1, ganho: 0.525, valor: 10000 }), criarRng(1));
  assert.equal(ganha.desfecho, 'sucesso');
  assert.equal(ganha.credito, 15300);
  assert.equal(ganha.liquido, 5300);
  assert.ok(ganha.texto.length > 0);
  const perde = liquidar(inv({ prob: 0, perda: 0.4 }), criarRng(1));
  assert.equal(perde.desfecho, 'fracasso');
  assert.equal(perde.credito, 6000);
  assert.equal(perde.liquido, -4000);
  const total = liquidar(inv({ prob: 0, perda: 1 }), criarRng(1));
  assert.equal(total.credito, 0);
});

test('liquidar: o honorário da consultoria só é cobrado no fracasso, e pode deixar o crédito negativo', () => {
  const fracasso = liquidar(inv({ prob: 0, perda: 0.4, honorario: 15000, consultoria: true }), criarRng(1));
  assert.equal(fracasso.credito, 6000 - 15000);
  assert.equal(fracasso.liquido, -4000 - 15000);
  assert.equal(fracasso.honorario, 15000);
  const sucesso = liquidar(inv({ prob: 1, ganho: 0.25, honorario: 15000, consultoria: true }), criarRng(1));
  assert.equal(sucesso.honorario, 0);
  assert.equal(sucesso.liquido, 2500);
});

test('liquidar: a frequência de sucesso acompanha a chance', () => {
  const rng = criarRng(99);
  let sucessos = 0;
  for (let i = 0; i < 4000; i++) sucessos += liquidar(inv({ prob: 0.3 }), rng).desfecho === 'sucesso';
  assert.ok(Math.abs(sucessos / 4000 - 0.3) < 0.03);
});

// ---------- a oferta na máquina ----------

test('cair no Mercado abre uma oferta do porte da reputação, com aviso de que nada foi decidido', () => {
  const e = naOferta();
  assert.equal(e.fase, 'MOSTRAR_MERCADO');
  assert.equal(obterEmpresa(e.mercadoAtual.empresaId).porte, 'pme'); // reputação inicial 50
  assert.equal(e.mercadoAtual.decisao, null);
  assert.equal(e.jogadores[0].dinheiro, 100000);
});

test('a reputação baixa e alta muda o porte ofertado', () => {
  const base = jogo();
  const com = (reputacao) => reduzir({ ...base, jogadores: base.jogadores.map((j) => ({ ...j, reputacao })) }, { tipo: 'ROLAR' });
  assert.equal(obterEmpresa(com(10).mercadoAtual.empresaId).porte, 'micro');
  assert.equal(obterEmpresa(com(75).mercadoAtual.empresaId).porte, 'consolidada');
  assert.equal(obterEmpresa(com(95).mercadoAtual.empresaId).porte, 'elite');
});

test('INVESTIR debita o aporte e guarda o investimento com a chance e o retorno da oferta', () => {
  const o = naOferta();
  const e = agir(o, 'INVESTIR', 25000);
  const j = e.jogadores[0];
  assert.equal(j.dinheiro, 75000);
  assert.equal(totalInvestido(j), 25000);
  assert.equal(j.investimentos.length, 1);
  assert.deepEqual(
    { id: j.investimentos[0].empresaId, valor: j.investimentos[0].valor, prob: j.investimentos[0].prob, ganho: j.investimentos[0].ganho, perda: j.investimentos[0].perda, consultoria: j.investimentos[0].consultoria },
    { id: o.mercadoAtual.empresaId, valor: 25000, prob: o.mercadoAtual.prob, ganho: o.mercadoAtual.ganho, perda: o.mercadoAtual.perda, consultoria: false },
  );
  assert.equal(e.mercadoAtual.decisao, 'investiu');
  assert.equal(e.mercadoAtual.aporte, 25000);
  assert.equal(e.fase, 'MOSTRAR_MERCADO', 'a pessoa ainda vê o resultado antes de continuar');
});

test('INVESTIR com valor fora das faixas ou maior que o caixa é ignorado', () => {
  const o = naOferta();
  ignora(o, 'INVESTIR', 12345);
  ignora(o, 'INVESTIR', 'abc');
  const pobre = naOferta();
  pobre.jogadores[0].dinheiro = 30000;
  ignora(pobre, 'INVESTIR', 50000);
  assert.equal(agir(pobre, 'INVESTIR', 25000).jogadores[0].dinheiro, 5000, 'cabe no caixa');
  const zerado = naOferta();
  zerado.jogadores[0].dinheiro = -5000;
  for (const v of APORTES) ignora(zerado, 'INVESTIR', v);
});

test('só se decide uma vez: depois de investir ou recusar, as ações da oferta são ignoradas', () => {
  const investiu = agir(naOferta(), 'INVESTIR', 10000);
  for (const [tipo, valor] of [['INVESTIR', 10000], ['RECUSAR'], ['ABRIR_CONSULTORIA'], ['DIAGNOSTICAR', 'nenhuma']]) {
    ignora(investiu, tipo, valor, `${tipo} depois de decidir`);
  }
  const recusou = agir(naOferta(), 'RECUSAR');
  assert.equal(recusou.mercadoAtual.decisao, 'recusou');
  assert.equal(recusou.jogadores[0].dinheiro, 100000);
  ignora(recusou, 'INVESTIR', 10000);
});

test('com a consultoria o retorno do sucesso guardado cai pela penalidade, e a perda não muda', () => {
  const o = naOferta();
  const consultado = agir(o, 'ABRIR_CONSULTORIA');
  assert.equal(consultado.mercadoAtual.consultoria, true);
  ignora(consultado, 'ABRIR_CONSULTORIA', undefined, 'abrir de novo não muda nada');
  const guardado = agir(consultado, 'INVESTIR', 10000).jogadores[0].investimentos[0];
  assert.equal(guardado.consultoria, true);
  assert.equal(guardado.ganho, ganhoComConsultoria(o.mercadoAtual.ganho));
  assert.equal(guardado.honorario, 15000);
  assert.equal(agir(o, 'INVESTIR', 10000).jogadores[0].investimentos[0].honorario, 0, 'sem consultoria, sem honorário');
  assert.ok(guardado.ganho < o.mercadoAtual.ganho);
  assert.equal(guardado.perda, o.mercadoAtual.perda);
  assert.equal(agir(o, 'INVESTIR', 10000).jogadores[0].investimentos[0].ganho, o.mercadoAtual.ganho, 'sem consultoria, retorno cheio');
});

test('olhar a consultoria e recusar não custa nada', () => {
  const e = agir(agir(naOferta(), 'ABRIR_CONSULTORIA'), 'RECUSAR');
  assert.equal(e.jogadores[0].dinheiro, 100000);
  assert.equal(e.jogadores[0].reputacao, 50);
  assert.deepEqual(e.jogadores[0].investimentos, []);
});

// Escolhe o diagnóstico certo (ou um errado) de acordo com a falha da empresa sorteada.
const diagnosticoCerto = (e) => obterEmpresa(e.mercadoAtual.empresaId).falha ?? 'nenhuma';
const diagnosticoErrado = (e) => OPCOES_DIAGNOSTICO.find((id) => id !== diagnosticoCerto(e));

test('diagnóstico certo rende reputação e o errado custa reputação, ao decidir, investindo ou não', () => {
  const o = naOferta();
  const certo = agir(agir(o, 'DIAGNOSTICAR', diagnosticoCerto(o)), 'RECUSAR');
  assert.equal(certo.jogadores[0].reputacao, 50 + ANALISE_BONUS_REPUTACAO);
  assert.deepEqual(
    { correta: certo.mercadoAtual.analise.correta, falha: certo.mercadoAtual.analise.falha, delta: certo.mercadoAtual.analise.deltaReputacao },
    { correta: true, falha: diagnosticoCerto(o), delta: ANALISE_BONUS_REPUTACAO },
  );
  const errado = agir(agir(o, 'DIAGNOSTICAR', diagnosticoErrado(o)), 'INVESTIR', 10000);
  assert.equal(errado.jogadores[0].reputacao, 50 - ANALISE_PENALIDADE_REPUTACAO);
  assert.equal(errado.mercadoAtual.analise.correta, false);
  const sem = agir(o, 'RECUSAR');
  assert.equal(sem.jogadores[0].reputacao, 50, 'sem diagnóstico, a reputação não muda');
  assert.equal(sem.mercadoAtual.analise, null);
});

test('o diagnóstico é registrado uma vez só e precisa ser uma das opções', () => {
  const o = naOferta();
  ignora(o, 'DIAGNOSTICAR', 'qualquer_coisa');
  const d = agir(o, 'DIAGNOSTICAR', 'taxa_base');
  assert.equal(d.mercadoAtual.diagnostico, 'taxa_base');
  ignora(d, 'DIAGNOSTICAR', 'nenhuma', 'não dá para trocar o diagnóstico');
  assert.equal(d.jogadores[0].reputacao, 50, 'só é pago ao decidir');
});

test('chutar o diagnóstico perde reputação em média (o chute não compensa)', () => {
  const certo = ANALISE_BONUS_REPUTACAO;
  const errado = -ANALISE_PENALIDADE_REPUTACAO;
  const chute = (1 / OPCOES_DIAGNOSTICO.length) * certo + (1 - 1 / OPCOES_DIAGNOSTICO.length) * errado;
  assert.ok(chute < 0);
});

test('o diagnóstico errado em reputação 1 dispara a crise de imagem (multa), como nas demais casas', () => {
  const o = naOferta();
  o.jogadores[0].reputacao = 1;
  const e = agir(agir(o, 'DIAGNOSTICAR', diagnosticoErrado(o)), 'RECUSAR');
  assert.equal(e.mercadoAtual.analise.crise, true);
  assert.equal(e.jogadores[0].dinheiro, 90000);
});

test('CONTINUAR sem decidir equivale a recusar e passa a vez', () => {
  const o = naOferta();
  const e = agir(agir(o, 'DIAGNOSTICAR', diagnosticoCerto(o)), 'CONTINUAR');
  assert.equal(e.jogadores[0].investimentos.length, 0);
  assert.equal(e.jogadores[0].reputacao, 50 + ANALISE_BONUS_REPUTACAO, 'o diagnóstico feito também é pago');
  assert.equal(e.mercadoAtual, null);
  assert.ok(e.fase === 'ROLAR_DADO');
  assert.ok(e.jogadorAtual === 1 || e.jogadaExtra);
});

test('CONTINUAR depois de investir mantém o aporte e passa a vez', () => {
  const e = agir(agir(naOferta(), 'INVESTIR', 10000), 'CONTINUAR');
  assert.equal(e.mercadoAtual, null);
  assert.equal(e.jogadores[0].investimentos.length, 1);
  assert.equal(e.jogadores[0].dinheiro, 90000);
});

test('o rival do solo passa pelo Mercado sem oferta, sem investir e sem gastar sorteios', () => {
  const solo = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Rival', nivel: 'iniciante', bot: 'medio' }], seed: 3, teste: { casa: 'mercado' } });
  solo.jogadorAtual = 1;
  const e = reduzir(solo, { tipo: 'ROLAR' });
  assert.equal(e.fase, 'MOSTRAR_MERCADO');
  assert.equal(e.mercadoAtual.empresaId, null);
  for (const [tipo, valor] of [['INVESTIR', 10000], ['ABRIR_CONSULTORIA'], ['DIAGNOSTICAR', 'nenhuma'], ['RECUSAR']]) {
    ignora(e, tipo, valor, `${tipo} do rival`);
  }
  assert.equal(agir(e, 'CONTINUAR').jogadores[1].dinheiro, 100000);
  assert.deepEqual(e.baralhoInvestimentos, {});
});

test('a oferta é reproduzível pela seed', () => {
  assert.deepEqual(naOferta().mercadoAtual, naOferta().mercadoAtual);
});

// ---------- apuração no Balanço ----------

// Estado pronto para o jogador 0 passar pelo Balanço (casa forçada), com os aportes dados.
function noBalanco(aportes, extra = {}) {
  const e = novoJogo({ jogadores: DOIS, seed: 21, teste: { casa: 'balanco' }, ...extra });
  e.jogadores[0].investimentos = aportes;
  return reduzir(e, { tipo: 'ROLAR' });
}

test('o Balanço apura os aportes do jogador da vez: crédito do sucesso e do fracasso', () => {
  const receita = receitaBalanco(50) - CUSTOS_BALANCO;
  const e = noBalanco([inv({ prob: 1, ganho: 0.5, valor: 10000 }), inv({ prob: 0, perda: 1, valor: 25000, nome: 'X' })]);
  assert.equal(e.balanco.investimentos.length, 2);
  assert.deepEqual(e.balanco.investimentos.map((r) => [r.desfecho, r.liquido]), [['sucesso', 5000], ['fracasso', -25000]]);
  assert.equal(e.jogadores[0].dinheiro, 100000 + receita + 15000 + 0);
  assert.deepEqual(e.jogadores[0].investimentos, [], 'os aportes saem da custódia depois de apurados');
  assert.equal(e.balanco.liquido, receita, 'o líquido do Balanço não inclui os investimentos');
});

test('o Balanço sem aportes devolve uma lista vazia e não gasta sorteios', () => {
  const sem = noBalanco([]);
  assert.deepEqual(sem.balanco.investimentos, []);
  const antes = novoJogo({ jogadores: DOIS, seed: 21, teste: { casa: 'balanco' } });
  const igual = reduzir(antes, { tipo: 'ROLAR' });
  assert.equal(igual.rng, sem.rng);
});

test('o Balanço só apura os aportes de quem passou por ele', () => {
  const e = novoJogo({ jogadores: DOIS, seed: 21, teste: { casa: 'balanco' } });
  e.jogadores[1].investimentos = [inv({ prob: 1 })];
  const depois = reduzir(e, { tipo: 'ROLAR' });
  assert.equal(depois.jogadores[1].investimentos.length, 1);
  assert.equal(depois.jogadores[1].dinheiro, 100000);
});

test('passar pelo Balanço e cair no Mercado na mesma jogada apura os aportes antes da nova oferta', () => {
  const e = novoJogo({ jogadores: DOIS, seed: 5, teste: { casa: 'mercado' } });
  e.jogadores[0].posicao = 27;
  e.jogadores[0].investimentos = [inv({ prob: 1, ganho: 1, valor: 10000 })];
  const depois = reduzir(e, { tipo: 'ROLAR' });
  assert.equal(depois.fase, 'MOSTRAR_MERCADO');
  assert.equal(depois.balanco.investimentos[0].desfecho, 'sucesso');
  assert.deepEqual(depois.jogadores[0].investimentos, []);
  const reinvestiu = agir(depois, 'INVESTIR', 10000);
  assert.equal(reinvestiu.jogadores[0].investimentos.length, 1, 'o novo aporte espera o próximo Balanço');
});

test('o retorno dos investimentos conta para a falência: um sucesso salva o caixa negativo e um fracasso quebra', () => {
  const base = novoJogo({ jogadores: DOIS, seed: 21, teste: { casa: 'balanco' } });
  base.jogadores[0].dinheiro = -60000;
  base.jogadores[0].investimentos = [inv({ prob: 1, ganho: 1, valor: 50000 })];
  const ok = reduzir(reduzir(base, { tipo: 'ROLAR' }), { tipo: 'CONTINUAR' });
  assert.equal(ok.jogadores[0].falido, false, 'caixa final positivo: não quebra');
  const ruim = structuredClone(base);
  ruim.jogadores[0].investimentos = [inv({ prob: 0, perda: 1, valor: 50000 })];
  const quebra = reduzir(reduzir(ruim, { tipo: 'ROLAR' }), { tipo: 'CONTINUAR' });
  assert.equal(quebra.jogadores[0].falido, true);
});

test('cooperativo: o aporte sai do caixa da empresa e o retorno entra nele antes da meta do Balanço', () => {
  const coop = novoJogo({ jogadores: DOIS, seed: 21, modo: 'cooperativo', teste: { casa: 'mercado' } });
  const investiu = agir(reduzir(coop, { tipo: 'ROLAR' }), 'INVESTIR', 10000);
  assert.equal(investiu.empresa.dinheiro, 90000);
  assert.equal(investiu.jogadores[0].dinheiro, 100000, 'a carteira individual não muda no cooperativo');

  // Sem o retorno, o caixa de 80.000 + Balanço fica abaixo da meta (100.000); com ele, passa.
  const mk = (aportes) => {
    const e = novoJogo({ jogadores: DOIS, seed: 21, modo: 'cooperativo', teste: { casa: 'balanco' } });
    e.empresa.dinheiro = 80000;
    e.jogadores[0].investimentos = aportes;
    return reduzir(e, { tipo: 'ROLAR' });
  };
  assert.equal(mk([]).balanco.meta.cumprida, false);
  const com = mk([inv({ prob: 1, ganho: 1, valor: 10000 })]);
  assert.equal(com.balanco.meta.cumprida, true);
  assert.equal(com.balanco.investimentos[0].credito, 20000);
});

// ---------- fim da partida ----------

// Joga a partida inteira em casas de Evento, para só os trimestres contarem.
function ateOFim(e) {
  for (let i = 0; i < 200 && e.fase !== 'FIM_DE_JOGO'; i++) e = reduzir(e, e.fase === 'ROLAR_DADO' ? { tipo: 'ROLAR' } : { tipo: 'CONTINUAR' });
  assert.equal(e.fase, 'FIM_DE_JOGO');
  return e;
}

test('no fim por trimestres, os aportes que sobraram são apurados e entram no ranking', () => {
  const e = novoJogo({ jogadores: DOIS, seed: 4, turnos: 1, teste: { casa: 'evento' } });
  e.jogadores[0].investimentos = [inv({ prob: 1, ganho: 1, valor: 10000 })];
  e.jogadores[1].investimentos = [inv({ prob: 0, perda: 1, valor: 10000 })];
  const fim = ateOFim(e);
  assert.equal(fim.apuracaoFinal.length, 2);
  assert.deepEqual(fim.apuracaoFinal.map((a) => [a.jogador, a.investimentos[0].desfecho]), [[0, 'sucesso'], [1, 'fracasso']]);
  assert.ok(fim.jogadores.every((j) => j.investimentos.length === 0));
  // 100.000 + 10.000 de lucro do sucesso, contra 100.000 − 10.000 do fracasso, mais o efeito dos eventos sorteados.
  const eventosA = fim.jogadores[0].dinheiro - 110000;
  const eventosB = fim.jogadores[1].dinheiro - 90000;
  assert.ok(Math.abs(eventosA) < 40000 && Math.abs(eventosB) < 40000);
});

test('no fim sem aportes, não há apuração final', () => {
  assert.equal(ateOFim(novoJogo({ jogadores: DOIS, seed: 4, turnos: 1, teste: { casa: 'evento' } })).apuracaoFinal, null);
});

test('no cooperativo, a apuração final credita a empresa', () => {
  const e = novoJogo({ jogadores: DOIS, seed: 4, turnos: 1, modo: 'cooperativo', teste: { casa: 'evento' } });
  e.jogadores[1].investimentos = [inv({ prob: 1, ganho: 1, valor: 10000 })];
  const sem = ateOFim(novoJogo({ jogadores: DOIS, seed: 4, turnos: 1, modo: 'cooperativo', teste: { casa: 'evento' } }));
  const com = ateOFim(e);
  assert.equal(com.apuracaoFinal.length, 1);
  assert.equal(com.empresa.dinheiro - sem.empresa.dinheiro, 20000);
});

test('quem faliu perde os aportes em custódia: não há apuração para ele', () => {
  const e = novoJogo({ jogadores: DOIS, seed: 4, turnos: 1, teste: { casa: 'evento' } });
  e.jogadores[0].investimentos = [inv({ prob: 1 })];
  e.jogadores[0].falido = true;
  const fim = ateOFim(e);
  assert.equal(fim.apuracaoFinal, null);
});

test('a partida com investimentos é determinística para a mesma seed', () => {
  const rodar = () => {
    let e = novoJogo({ jogadores: DOIS, seed: 33, turnos: 6, teste: { casa: 'mercado' } });
    for (let i = 0; i < 400 && e.fase !== 'FIM_DE_JOGO'; i++) {
      const acao = { ROLAR_DADO: { tipo: 'ROLAR' }, MOSTRAR_MERCADO: { tipo: 'INVESTIR', valor: 10000 } }[e.fase];
      e = reduzir(e, acao && !(e.fase === 'MOSTRAR_MERCADO' && e.mercadoAtual.decisao) ? acao : { tipo: 'CONTINUAR' });
    }
    return e;
  };
  const a = rodar();
  assert.equal(a.fase, 'FIM_DE_JOGO');
  assert.deepEqual(a, rodar());
});

test('save antigo, sem os campos de investimento, segue funcionando', () => {
  const e = novoJogo({ jogadores: DOIS, seed: 8, turnos: 3, teste: { casa: 'mercado' } });
  delete e.baralhoInvestimentos;
  delete e.mercadoAtual;
  delete e.apuracaoFinal;
  for (const j of e.jogadores) delete j.investimentos;
  const oferta = reduzir(e, { tipo: 'ROLAR' });
  assert.equal(oferta.fase, 'MOSTRAR_MERCADO');
  const investiu = agir(oferta, 'INVESTIR', 10000);
  assert.equal(investiu.jogadores[0].investimentos.length, 1);
  assert.equal(ateOFim(investiu).fase, 'FIM_DE_JOGO');
});
