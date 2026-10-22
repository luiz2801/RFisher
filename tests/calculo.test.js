import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { decidirBot } from '../src/engine/bot.js';
import { ehCalculo, avaliarCalculo, valorEsperado, notaDeMetodo, calcularOperacao, formatarResultadoCalculadora } from '../src/engine/calculo.js';
import { MARGEM_CALCULO_PISO } from '../src/engine/config.js';
import { instanciar, obterCenario, todosCenarios, validarCenario } from '../src/scenarios/loader.js';
import { lerNumero, formatar } from '../src/stats/format.js';
import { viewJogo, tabelaTsv } from '../src/ui/views.js';

const calculos = () => todosCenarios().filter(ehCalculo);

// Estado parado na escolha da métrica de um cenário de cálculo, com dados da seed dada.
function estadoCalculo(id, seed = 1) {
  const def = obterCenario(id);
  const e = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], turnos: 5, seed });
  e.fase = 'ESCOLHER_METRICA';
  e.cenarioAtual = {
    id,
    ...instanciar(def, criarRng(seed)),
    ordemOpcoes: def.opcoes.map((o) => o.id),
    ordemJustificativas: def.justificativas.map((j) => j.id),
    confianca: null,
    metricaId: null,
    valorInformado: null,
    justificativaId: null,
  };
  return e;
}

const certa = (def) => def.opcoes.find((o) => o.correta);
const justCerta = (def) => def.justificativas.find((j) => j.tipo === 'correta');
// Joga a decisão inteira com a métrica, o valor e a justificativa dados.
function decidir(e, { metrica, valor, justificativa, confianca = 'provavel' }) {
  e = reduzir(e, { tipo: 'METRICA', valor: metrica });
  e = reduzir(e, { tipo: 'VALOR', valor });
  e = reduzir(e, { tipo: 'JUSTIFICATIVA', valor: justificativa });
  return reduzir(e, { tipo: 'CONFIANCA', valor: confianca });
}

test('há cenários de cálculo e todos têm métricas calculáveis, margem e explicação do cálculo', () => {
  assert.ok(calculos().length >= 5);
  for (const def of calculos()) {
    for (const seed of [1, 7, 99, 2024]) assert.deepEqual(validarCenario(def, criarRng(seed)), [], def.id);
    assert.ok(def.dados.exibir.includes('tabela'), def.id);
    assert.ok(def.calculo.margem_pct > 0, def.id);
  }
});

test('o validador recusa cenário de cálculo que revela o valor, sem chave ou sem explicação', () => {
  const base = calculos()[0];
  const clone = () => structuredClone(base);

  const revela = clone();
  revela.opcoes[0].texto += ' ({{mediana}})';
  assert.ok(validarCenario(revela, criarRng(1)).some((m) => m.includes('revelar o valor')));

  const semChave = clone();
  delete semChave.opcoes[1].chave;
  assert.ok(validarCenario(semChave, criarRng(1)).some((m) => m.includes('chave de métrica')));

  const semExplicacao = clone();
  delete semExplicacao.feedback.como_calcular;
  assert.ok(validarCenario(semExplicacao, criarRng(1)).some((m) => m.includes('como_calcular')));

  const semMargem = clone();
  semMargem.calculo.margem_pct = 0;
  assert.ok(validarCenario(semMargem, criarRng(1)).some((m) => m.includes('margem_pct')));

  const semTabela = clone();
  semTabela.dados.exibir = ['grafico'];
  assert.ok(validarCenario(semTabela, criarRng(1)).some((m) => m.includes('dados.exibir')));
});

test('lerNumero entende números digitados em pt-BR', () => {
  assert.equal(lerNumero('1234'), 1234);
  assert.equal(lerNumero('1234,5'), 1234.5);
  assert.equal(lerNumero('1.234,5'), 1234.5);
  assert.equal(lerNumero('2.500'), 2500);
  assert.equal(lerNumero('2.5'), 2.5);
  assert.equal(lerNumero('0,325'), 0.325);
  assert.equal(lerNumero(' R$ 3.200 '), 3200);
  assert.equal(lerNumero('12 min'), 12);
  assert.equal(lerNumero('−4,5'), -4.5);
  assert.equal(lerNumero(7), 7);
  for (const ruim of ['', '   ', 'abc', '1,2,3', '12abc3', '--1', '.5', null, undefined, NaN, Infinity]) {
    assert.ok(Number.isNaN(lerNumero(ruim)), `deveria recusar ${String(ruim)}`);
  }
});

test('a margem é relativa ao valor correto, com piso quando ele é zero', () => {
  const def = { calculo: { margem_pct: 2 } };
  const num = { media: 200, moda: 0 };
  const opMedia = { chave: 'media' };
  const dentro = (v) => avaliarCalculo(def, opMedia, num, v).dentro;
  assert.ok(dentro(200) && dentro(204) && dentro(196), 'os limites de ±2% valem');
  assert.ok(!dentro(204.1) && !dentro(195.9));
  assert.ok(!avaliarCalculo(def, opMedia, num, NaN).dentro);

  const a = avaliarCalculo(def, opMedia, num, 200);
  assert.equal(a.margemPct, 2);
  assert.equal(a.minimo, 196);
  assert.equal(a.maximo, 204);

  const zero = { chave: 'moda' };
  assert.ok(avaliarCalculo(def, zero, num, 0).dentro);
  assert.ok(avaliarCalculo(def, zero, num, MARGEM_CALCULO_PISO).dentro);
  assert.ok(!avaliarCalculo(def, zero, num, 0.1).dentro);

  // a margem de uma opção sobrepõe a do cenário
  assert.ok(avaliarCalculo(def, { chave: 'media', margem_pct: 10 }, num, 218).dentro);
});

test('o valor exato de cada métrica das opções vem dos dados sorteados', () => {
  for (const def of calculos()) {
    const e = estadoCalculo(def.id, 3);
    for (const o of def.opcoes) {
      const c = { ...e.cenarioAtual, metricaId: o.id };
      assert.equal(valorEsperado(def, c), e.cenarioAtual.num[o.chave], `${def.id} ${o.id}`);
      assert.ok(avaliarCalculo(def, o, c.num, valorEsperado(def, c)).dentro);
    }
  }
});

test('em cenário de cálculo, a métrica leva à fase INFORMAR_VALOR; no comum, direto à justificativa', () => {
  const e = estadoCalculo('cenario_14_alugueis');
  const def = obterCenario(e.cenarioAtual.id);
  const depois = reduzir(e, { tipo: 'METRICA', valor: certa(def).id });
  assert.equal(depois.fase, 'INFORMAR_VALOR');
  assert.equal(depois.cenarioAtual.metricaId, certa(def).id);

  const comum = estadoCalculo('cenario_01_salarios');
  assert.equal(reduzir(comum, { tipo: 'METRICA', valor: 'mediana' }).fase, 'ESCOLHER_JUSTIFICATIVA');
});

test('INFORMAR_VALOR aceita só números (número ou texto pt-BR) e só nessa fase', () => {
  let e = reduzir(estadoCalculo('cenario_14_alugueis'), { tipo: 'METRICA', valor: 'mediana' });
  for (const ruim of ['', 'abc', null, undefined, NaN, '1,2,3']) assert.deepEqual(reduzir(e, { tipo: 'VALOR', valor: ruim }), e);
  for (const fase of ['ESCOLHER_METRICA', 'ESCOLHER_JUSTIFICATIVA', 'ESCOLHER_CONFIANCA']) {
    const outraFase = { ...e, fase };
    assert.equal(reduzir(outraFase, { tipo: 'VALOR', valor: 10 }), outraFase);
  }
  assert.equal(reduzir(e, { tipo: 'JUSTIFICATIVA', valor: 'j1' }), e, 'sem valor não há justificativa');

  const texto = reduzir(e, { tipo: 'VALOR', valor: '2.350,5' });
  assert.equal(texto.fase, 'ESCOLHER_JUSTIFICATIVA');
  assert.equal(texto.cenarioAtual.valorInformado, 2350.5);
  assert.equal(reduzir(e, { tipo: 'VALOR', valor: 2350.5 }).cenarioAtual.valorInformado, 2350.5);
});

test('métrica, valor e justificativa certos dão sucesso absoluto e gravam o valor no histórico', () => {
  const e0 = estadoCalculo('cenario_14_alugueis', 5);
  const def = obterCenario(e0.cenarioAtual.id);
  const exato = e0.cenarioAtual.num.mediana;
  const e = decidir(e0, { metrica: 'mediana', valor: exato, justificativa: justCerta(def).id, confianca: 'certeza' });
  assert.equal(e.fase, 'MOSTRAR_RESULTADO');
  assert.equal(e.resultado.categoria, 'sucesso');
  assert.equal(e.resultado.valorCorreto, true);
  assert.equal(e.resultado.calculo.informado, exato);
  assert.ok(e.resultado.delta > 0);
  const h = e.jogadores[0].historico[0];
  assert.equal(h.valor, exato);
  assert.equal(h.valorCorreto, true);
});

test('um valor dentro da margem vale, mesmo arredondado; fora dela a métrica deixa de valer', () => {
  const e0 = estadoCalculo('cenario_14_alugueis', 5);
  const def = obterCenario(e0.cenarioAtual.id);
  const exato = e0.cenarioAtual.num.mediana;
  const jogada = (valor) => decidir(e0, { metrica: 'mediana', valor, justificativa: justCerta(def).id });

  assert.equal(jogada(exato * 1.009).resultado.categoria, 'sucesso', '+0,9% está na margem de 1%');
  assert.equal(jogada(exato * 0.991).resultado.categoria, 'sucesso');

  const fora = jogada(exato * 1.02);
  assert.equal(fora.resultado.valorCorreto, false);
  assert.equal(fora.resultado.metricaCorreta, true, 'a escolha da métrica em si estava certa');
  assert.equal(fora.resultado.categoria, 'incoerencia', 'com a justificativa certa, o cálculo errado zera o ganho');
  assert.equal(fora.resultado.delta, 0);
  assert.equal(fora.jogadores[0].historico[0].resultado, 'incoerencia');
  assert.equal(fora.jogadores[0].historico[0].valorCorreto, false);

  const errouTudo = decidir(e0, { metrica: 'mediana', valor: exato * 2, justificativa: def.justificativas.find((j) => j.tipo !== 'correta').id });
  assert.equal(errouTudo.resultado.categoria, 'erro_total');
  assert.ok(errouTudo.resultado.delta < 0);
});

test('o valor é conferido contra a métrica escolhida, não contra a correta', () => {
  const e0 = estadoCalculo('cenario_14_alugueis', 5);
  const def = obterCenario(e0.cenarioAtual.id);
  const num = e0.cenarioAtual.num;
  const errada = def.opcoes.find((o) => o.id === 'media');
  const e = decidir(e0, { metrica: errada.id, valor: num.media, justificativa: justCerta(def).id });
  assert.equal(e.resultado.valorCorreto, true, 'a média foi bem calculada');
  assert.equal(e.resultado.metricaCorreta, false, 'mas a média não era a métrica certa');
  assert.equal(e.resultado.categoria, 'incoerencia');

  // calcular o valor da métrica certa e informá-lo para a errada não vale
  const troca = decidir(e0, { metrica: errada.id, valor: num.mediana, justificativa: justCerta(def).id });
  assert.equal(troca.resultado.valorCorreto, false);
});

test('o rival informa o valor exato da métrica que escolheu e decide numa só ação', () => {
  for (const def of calculos()) {
    for (let seed = 1; seed <= 30; seed++) {
      const { num } = instanciar(def, criarRng(seed));
      const escolha = decidirBot(def, { acerto: 0.6 }, criarRng(seed), num);
      const op = def.opcoes.find((o) => o.id === escolha.metrica);
      assert.equal(escolha.valor, num[op.chave]);
    }
  }
  // sem `num` (cenário comum ou chamada antiga), não há valor
  const comum = obterCenario('cenario_01_salarios');
  assert.equal(decidirBot(comum, { acerto: 0.6 }, criarRng(1)).valor, undefined);

  let e = novoJogo({
    jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Rival', nivel: 'iniciante', bot: 'medio' }],
    turnos: 5,
    seed: 4,
  });
  e = { ...estadoCalculo('cenario_16_chamados', 4), jogadores: e.jogadores, jogadorAtual: 1, modo: 'competitivo' };
  const depois = reduzir(e, { tipo: 'DECIDIR_BOT' });
  assert.equal(depois.fase, 'MOSTRAR_RESULTADO');
  assert.equal(depois.resultado.calculo.informado, depois.resultado.calculo.esperado);
  assert.equal(depois.resultado.metricaCorreta, certa(obterCenario('cenario_16_chamados')).id === depois.resultado.metricaId);
});

test('a tela de valor mostra a tabela, a margem aceita e o campo, sem revelar a resposta', () => {
  const e = reduzir(estadoCalculo('cenario_14_alugueis', 5), { tipo: 'METRICA', valor: 'mediana' });
  const html = viewJogo(e);
  const { series } = e.cenarioAtual;
  assert.match(html, /<table class="tabela-dados">/);
  assert.match(html, /2\. Qual valor você calculou\?/);
  assert.match(html, /margem de erro de ±1%/);
  assert.match(html, /<form class="form-valor" data-form="valor"/);
  assert.match(html, /name="valor"/);
  assert.match(html, /em R\$/);
  assert.ok(!html.includes('Valor correto') && !html.includes('Como calcular'), 'a resposta só aparece no resultado');
  assert.ok(!html.includes('class="marcador'), 'o gráfico não marca a métrica antes do resultado');
  // os registros aparecem na ordem sorteada, e não ordenados
  const ordemSorteada = series[0].valores.map((v) => formatar('brl', v));
  const posicoes = ordemSorteada.map((t) => html.indexOf(`<td>${t}</td>`));
  assert.ok(posicoes.every((p) => p > 0));
});

test('as notas de método avisam sobre percentis, quartis e o desvio padrão', () => {
  for (const chave of ['p25', 'p75', 'p90', 'p95', 'iqr']) assert.match(notaDeMetodo(chave), /método linear/);
  assert.match(notaDeMetodo('dp'), /n − 1/);
  assert.equal(notaDeMetodo('media'), null);
  const e = reduzir(estadoCalculo('cenario_15_espera', 2), { tipo: 'METRICA', valor: 'p90' });
  assert.match(viewJogo(e), /PERCENTIL\.INC/);
});

test('o cenário com tabela de frequências lista valor e quantidade, com o total', () => {
  const e = estadoCalculo('cenario_16_chamados', 3);
  const html = viewJogo({ ...e, fase: 'ESCOLHER_METRICA' });
  assert.match(html, /<th scope="col">Chamados no mês<\/th><th scope="col">Clientes<\/th>/);
  assert.match(html, /<th scope="row">Total<\/th><td>40<\/td>/);
  // só o gráfico do cenário que o pede
  assert.match(html, /<svg/);
  const semGrafico = viewJogo(reduzir(estadoCalculo('cenario_17_embaladora', 3), { tipo: 'METRICA', valor: 'dp' }));
  assert.ok(!semGrafico.includes('<svg'), 'o cenário 17 mostra só a tabela');
});

test('as etapas seguintes mostram o valor informado e a numeração em quatro passos', () => {
  const e0 = estadoCalculo('cenario_14_alugueis', 5);
  const def = obterCenario(e0.cenarioAtual.id);
  let e = reduzir(e0, { tipo: 'METRICA', valor: 'mediana' });
  e = reduzir(e, { tipo: 'VALOR', valor: '2.100,5' });
  assert.match(viewJogo(e), /3\. Por que essa é a melhor decisão\?/);
  assert.match(viewJogo(e), /Seu valor: <strong>R\$ 2\.101<\/strong>/);
  e = reduzir(e, { tipo: 'JUSTIFICATIVA', valor: justCerta(def).id });
  assert.match(viewJogo(e), /4\. Quão confiante/);
  assert.match(viewJogo(e), /Seu valor:/);
});

test('o resultado confronta o valor informado com o correto, a margem e o passo a passo', () => {
  const e0 = estadoCalculo('cenario_14_alugueis', 5);
  const def = obterCenario(e0.cenarioAtual.id);
  const { mediana, media } = e0.cenarioAtual.num;

  const ok = viewJogo(decidir(e0, { metrica: 'mediana', valor: mediana, justificativa: justCerta(def).id }));
  assert.match(ok, /Sucesso absoluto/);
  assert.match(ok, /dentro da margem/);
  assert.match(ok, /Margem aceita \(±1%\)/);
  assert.match(ok, /Como calcular:/);

  const fora = viewJogo(decidir(e0, { metrica: 'mediana', valor: mediana * 1.5, justificativa: justCerta(def).id }));
  assert.match(fora, /valor calculado ficou fora da margem/);
  assert.match(fora, /fora da margem/);
  assert.ok(!fora.includes('Métrica certa:'), 'a métrica estava certa: o gabarito não a repete');
  assert.match(fora, /Valor correto de Mediana/);

  const errada = viewJogo(decidir(e0, { metrica: 'media', valor: media, justificativa: justCerta(def).id }));
  assert.match(errada, /Valor da métrica certa \(Mediana\)/);
  assert.match(errada, /Métrica certa: Mediana/);
  assert.ok(!errada.includes('{{') && !errada.includes('undefined'));
});

test('uma partida inteira com cenários de cálculo termina e é reproduzível com save a cada ação', () => {
  const jogar = (copiar) => {
    let e = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], turnos: 10, seed: 2 });
    let viuValor = false;
    for (let i = 0; i < 3000 && e.fase !== 'FIM_DE_JOGO'; i++) {
      const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
      viuValor ||= e.fase === 'INFORMAR_VALOR';
      const acao = {
        ROLAR_DADO: { tipo: 'ROLAR' },
        ESCOLHER_METRICA: { tipo: 'METRICA', valor: def?.opcoes[0].id },
        INFORMAR_VALOR: { tipo: 'VALOR', valor: def && valorEsperado(def, e.cenarioAtual) },
        ESCOLHER_JUSTIFICATIVA: { tipo: 'JUSTIFICATIVA', valor: def?.justificativas[0].id },
        ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'duvida' },
      }[e.fase] ?? { tipo: 'CONTINUAR' };
      e = reduzir(copiar(e), acao);
    }
    assert.equal(e.fase, 'FIM_DE_JOGO');
    return { e, viuValor };
  };
  const a = jogar((x) => x);
  const b = jogar((x) => JSON.parse(JSON.stringify(x)));
  assert.deepEqual(a.e, b.e);
  assert.ok(a.viuValor && b.viuValor, 'a partida passou por um cenário de cálculo');
});

test('uma partida salva antes dos cenários de cálculo passa a sorteá-los sem esperar o fim do ciclo', () => {
  const e = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], turnos: 10, seed: 3 });
  e.baralhoCenarios = ['cenario_01_salarios', 'cenario_02_sla']; // baralho de um save antigo
  e.jogadores[0].historico = [{ cenario: 'cenario_03_estoque', resultado: 'sucesso', confianca: 'chute' }];
  e.jogadores[0].posicao = 0;
  const depois = reduzir(e, { tipo: 'ROLAR' });
  if (depois.fase === 'ESCOLHER_METRICA') {
    const restantes = [depois.cenarioAtual.id, ...depois.baralhoCenarios];
    assert.ok(restantes.some((id) => ehCalculo(obterCenario(id))), 'os cenários novos entraram no baralho');
    assert.ok(!restantes.includes('cenario_03_estoque'), 'o já visto não volta');
  }
});

test('o botão copia a tabela em texto com tabulações, pronto para colar no Excel', () => {
  const e = estadoCalculo('cenario_14_alugueis', 5);
  assert.match(viewJogo(e), /data-acao="COPIAR_TABELA"/);
  const linhas = tabelaTsv(obterCenario(e.cenarioAtual.id), e.cenarioAtual).split('\n');
  assert.equal(linhas[0], 'Nº\tAluguel (R$)');
  assert.equal(linhas.length, 12, 'cabeçalho + 11 registros');
  assert.deepEqual(linhas[1].split('\t'), ['1', String(e.cenarioAtual.series[0].valores[0])]);

  const f = estadoCalculo('cenario_16_chamados', 3);
  const freq = tabelaTsv(obterCenario(f.cenarioAtual.id), f.cenarioAtual).split('\n');
  assert.equal(freq[0], 'Chamados no mês\tClientes');
  assert.equal(freq.slice(1).reduce((s, l) => s + Number(l.split('\t')[1]), 0), 40);

  const dec = estadoCalculo('cenario_15_espera', 2);
  assert.ok(tabelaTsv(obterCenario(dec.cenarioAtual.id), dec.cenarioAtual).includes(','), 'decimais com vírgula');
});

test('a calculadora embutida aparece só na etapa do valor e calcula como a conferência', () => {
  const e = estadoCalculo('cenario_14_alugueis', 5);
  assert.doesNotMatch(viewJogo(e), /data-form="calculadora"/, 'não aparece na escolha da métrica');
  e.fase = 'INFORMAR_VALOR';
  e.cenarioAtual.metricaId = obterCenario(e.cenarioAtual.id).opcoes[0].id;
  assert.match(viewJogo(e), /data-form="calculadora"/);

  const v = e.cenarioAtual.series[0].valores;
  const num = e.cenarioAtual.num;
  assert.equal(calcularOperacao(v, 'n'), v.length);
  assert.ok(Math.abs(calcularOperacao(v, 'media') - num.media) < 1e-9);
  assert.ok(Math.abs(calcularOperacao(v, 'mediana') - num.mediana) < 1e-9);
  assert.ok(Math.abs(calcularOperacao(v, 'q3') - num.p75) < 1e-9);
  assert.ok(Math.abs(calcularOperacao(v, 'dp') - num.dp) < 1e-9);
  assert.ok(Math.abs(calcularOperacao(v, 'percentil', 90) - num.p90) < 1e-9);
});

test('a calculadora recusa entradas inválidas', () => {
  assert.equal(calcularOperacao([1, 2, 3, 4], 'soma'), 10);
  assert.equal(calcularOperacao([1, 2, 3, 4], 'amplitude'), 3);
  assert.ok(Math.abs(calcularOperacao([1, 2, 3, 4], 'variancia') - 5 / 3) < 1e-9);
  assert.equal(calcularOperacao([1, 2, 3, 4], 'percentil', 101), null);
  assert.equal(calcularOperacao([1, 2, 3, 4], 'percentil', NaN), null);
  assert.equal(calcularOperacao([5], 'dp'), null, 'desvio amostral precisa de 2 registros');
  assert.equal(calcularOperacao([], 'media'), null);
  assert.equal(calcularOperacao([1, 2], 'inexistente'), null);
  assert.equal(formatarResultadoCalculadora(1234.56789), '1.234,5679');
});
