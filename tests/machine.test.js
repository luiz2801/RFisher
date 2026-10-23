import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { novoJogo, vencedores, reputacaoInicialDe } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { valorEsperado, ehCalculo } from '../src/engine/calculo.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { DINHEIRO_INICIAL, DINHEIRO_INICIAL_MIN, DINHEIRO_INICIAL_MAX, REPUTACAO_INICIAL_MIN, REPUTACAO_INICIAL_MAX, TURNOS_PADRAO } from '../src/engine/config.js';
import { CONFIANCA } from '../src/engine/scoring.js';
import { viewJogo } from '../src/ui/views.js';

const jogadores = (...niveis) => niveis.map((nivel, i) => ({ nome: `J${i + 1}`, nivel }));

// Joga a partida inteira. `politica` decide confiança, métrica e justificativa.
function jogar(config, politica) {
  let e = novoJogo(config);
  for (let passo = 0; e.fase !== 'FIM_DE_JOGO'; passo++) {
    assert.ok(passo < 10000, 'partida não terminou');
    const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
    const acao = {
      ROLAR_DADO: () => ({ tipo: 'ROLAR' }),
      ESCOLHER_CONFIANCA: () => ({ tipo: 'CONFIANCA', valor: politica.confianca }),
      ESCOLHER_METRICA: () => ({ tipo: 'METRICA', valor: politica.metrica(def) }),
      INFORMAR_VALOR: () => ({ tipo: 'VALOR', valor: valorEsperado(def, e.cenarioAtual) }),
      ESCOLHER_JUSTIFICATIVA: () => ({ tipo: 'JUSTIFICATIVA', valor: politica.justificativa(def) }),
    }[e.fase]?.() ?? { tipo: 'CONTINUAR' };
    e = reduzir(e, acao);
  }
  return e;
}

const sorteio = (seed) => {
  const rng = criarRng(seed);
  return (lista) => lista[rng.inteiro(0, lista.length - 1)];
};
const saberTudo = {
  confianca: 'certeza',
  metrica: (d) => d.opcoes.find((o) => o.correta).id,
  justificativa: (d) => d.justificativas.find((j) => j.tipo === 'correta').id,
};
function chutador(seed) {
  const pick = sorteio(seed);
  return {
    confianca: 'certeza',
    metrica: (d) => pick(d.opcoes).id,
    justificativa: (d) => pick(d.justificativas).id,
  };
}

test('a partida é determinística para a mesma seed', () => {
  const cfg = { jogadores: jogadores('iniciante', 'avancado'), turnos: 6, seed: 123 };
  assert.deepEqual(jogar(cfg, saberTudo), jogar(cfg, saberTudo));
});

test('a partida termina após N turnos por jogador, sem eliminar ninguém', () => {
  const e = jogar({ jogadores: jogadores('iniciante', 'iniciante', 'avancado'), turnos: 5, seed: 9 }, chutador(1));
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.equal(e.jogadores.length, 3);
  // Dados iguais dão jogada extra sem gastar trimestre: são sempre 5 trimestres, com 5 ou mais jogadas por jogador.
  assert.equal(e.turnoAtual, 6);
});

// Rola até sair uma jogada com dados iguais (ou diferentes), conforme `iguais`, e devolve o estado logo após o ROLAR.
function rolarAte(iguais, config = {}) {
  for (let seed = 1; seed < 500; seed++) {
    const e = reduzir(novoJogo({ jogadores: jogadores('iniciante', 'iniciante'), seed, teste: { casa: 'evento' }, ...config }), { tipo: 'ROLAR' });
    if ((e.dados[0] === e.dados[1]) === iguais) return e;
  }
  throw new Error('nenhuma seed serviu');
}

test('dados iguais: o mesmo jogador joga de novo, sem avançar a vez nem o trimestre', () => {
  const e = reduzir(rolarAte(true), { tipo: 'CONTINUAR' });
  assert.equal(e.fase, 'ROLAR_DADO');
  assert.equal(e.jogadorAtual, 0);
  assert.equal(e.turnoAtual, 1);
  assert.equal(e.jogadaExtra, true);
  assert.equal(e.dados, null);
  assert.match(viewJogo(e), /Dados iguais/);
});

test('dados diferentes: a vez passa ao próximo jogador, sem jogada extra', () => {
  const e = reduzir(rolarAte(false), { tipo: 'CONTINUAR' });
  assert.equal(e.jogadorAtual, 1);
  assert.equal(e.jogadaExtra, false);
  assert.doesNotMatch(viewJogo(e), /Dados iguais/);
});

test('a jogada extra acaba na rolagem seguinte: o aviso some e a vez passa se os dados forem diferentes', () => {
  let e = reduzir(rolarAte(true), { tipo: 'CONTINUAR' });
  for (let i = 0; i < 50 && e.jogadorAtual === 0; i++) {
    e = reduzir(reduzir(e, { tipo: 'ROLAR' }), { tipo: 'CONTINUAR' });
  }
  assert.equal(e.jogadorAtual, 1);
  assert.equal(e.jogadaExtra, false);
});

test('dados iguais não dão jogada extra a quem faliu na jogada, nem depois do último trimestre', () => {
  // Uma partida de 1 trimestre e 1 jogador: dados iguais ainda dão mais uma rolagem; só ao fim da vez sem igualdade a partida acaba.
  let e = reduzir(rolarAte(true, { turnos: 1 }), { tipo: 'CONTINUAR' });
  assert.equal(e.fase, 'ROLAR_DADO');
  for (let i = 0; i < 50 && e.fase !== 'FIM_DE_JOGO'; i++) {
    e = reduzir(e, { tipo: e.fase === 'ROLAR_DADO' ? 'ROLAR' : 'CONTINUAR' });
  }
  assert.equal(e.fase, 'FIM_DE_JOGO');

  // Falido na jogada que tirou dados iguais: perde a vez, sem jogada extra.
  const f = rolarAte(true, { teste: { casa: 'balanco' } });
  f.jogadores[0].dinheiro = -1;
  f.jogadores[0].falido = false;
  f.balanco = { receita: 0, custos: 0, liquido: 0 };
  const depois = reduzir(f, { tipo: 'CONTINUAR' });
  assert.ok(depois.jogadores[0].falido || depois.fase === 'FIM_DE_JOGO' || depois.jogadorAtual === 1);
  assert.notEqual(depois.jogadaExtra, true);
});

test('ações inválidas para a fase são ignoradas', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), seed: 1 });
  assert.equal(reduzir(e, { tipo: 'METRICA', valor: 'media' }), e);
  assert.equal(reduzir(e, { tipo: 'CONTINUAR' }), e);
});

test('o reducer não altera o estado anterior', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), seed: 1 });
  const antes = structuredClone(e);
  reduzir(e, { tipo: 'ROLAR' });
  assert.deepEqual(e, antes);
});

test('em casas de decisão, a pergunta de certeza (5 níveis) ocorre após a resposta (métrica e justificativa)', () => {
  let e = novoJogo({ jogadores: jogadores('iniciante'), seed: 1 });
  let passos = 0;
  while (e.fase === 'ROLAR_DADO' && passos < 20) {
    e = reduzir(e, { tipo: 'ROLAR' });
    passos++;
    if (e.fase === 'MOSTRAR_EVENTO' || e.fase === 'MOSTRAR_BALANCO') {
      e = reduzir(e, { tipo: 'CONTINUAR' });
    }
  }
  assert.equal(e.fase, 'ESCOLHER_METRICA');
  const def = obterCenario(e.cenarioAtual.id);

  e = reduzir(e, { tipo: 'METRICA', valor: def.opcoes[0].id });
  assert.equal(e.fase, 'ESCOLHER_JUSTIFICATIVA');

  e = reduzir(e, { tipo: 'JUSTIFICATIVA', valor: def.justificativas[0].id });
  assert.equal(e.fase, 'ESCOLHER_CONFIANCA');

  const html = viewJogo(e);
  for (const nivel of Object.keys(CONFIANCA)) assert.match(html, new RegExp(`data-valor="${nivel}"`));

  for (const invalido of ['talvez', 'toString', undefined]) {
    assert.equal(reduzir(e, { tipo: 'CONFIANCA', valor: invalido }).fase, 'ESCOLHER_CONFIANCA');
  }

  e = reduzir(e, { tipo: 'CONFIANCA', valor: 'provavel' });
  assert.equal(e.fase, 'MOSTRAR_RESULTADO');
  assert.equal(e.resultado.confianca, 'provavel');
});

test('o estado sobrevive a JSON (salvar/retomar partida)', () => {
  let e = novoJogo({ jogadores: jogadores('iniciante', 'avancado'), turnos: 4, seed: 77 });
  for (let i = 0; i < 12; i++) {
    const copia = JSON.parse(JSON.stringify(e));
    assert.deepEqual(copia, e);
    const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
    const acao = {
      ROLAR_DADO: { tipo: 'ROLAR' },
      ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'chute' },
      ESCOLHER_METRICA: { tipo: 'METRICA', valor: def?.opcoes[0].id },
      INFORMAR_VALOR: { tipo: 'VALOR', valor: def && valorEsperado(def, e.cenarioAtual) },
      ESCOLHER_JUSTIFICATIVA: { tipo: 'JUSTIFICATIVA', valor: def?.justificativas[0].id },
    }[e.fase] ?? { tipo: 'CONTINUAR' };
    e = reduzir(copia, acao);
  }
});

test('simulação: quem chuta termina com menos dinheiro que quem sabe tudo', () => {
  const PARTIDAS = 300;
  let somaChute = 0;
  let somaSabe = 0;
  let vitoriasSabe = 0;
  for (let seed = 1; seed <= PARTIDAS; seed++) {
    // O mesmo tabuleiro e a mesma sequência de dados para os dois.
    const cfg = { jogadores: jogadores('iniciante'), turnos: 10, seed };
    somaChute += jogar(cfg, chutador(seed)).jogadores[0].dinheiro;
    somaSabe += jogar(cfg, saberTudo).jogadores[0].dinheiro;
  }
  const mediaChute = somaChute / PARTIDAS;
  const mediaSabe = somaSabe / PARTIDAS;
  assert.ok(mediaChute < DINHEIRO_INICIAL, `chutar deveria perder dinheiro, média final = ${mediaChute}`);
  assert.ok(mediaSabe > DINHEIRO_INICIAL * 2, `saber tudo deveria render bem, média final = ${mediaSabe}`);

  // Disputa direta: um jogador que sabe tudo contra um que chuta.
  for (let seed = 1; seed <= PARTIDAS; seed++) {
    let e = novoJogo({ jogadores: jogadores('iniciante', 'iniciante'), turnos: 10, seed });
    const pick = chutador(seed);
    while (e.fase !== 'FIM_DE_JOGO') {
      const p = e.jogadorAtual === 0 ? saberTudo : pick;
      const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
      const acao = {
        ROLAR_DADO: { tipo: 'ROLAR' },
        ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: p.confianca },
        ESCOLHER_METRICA: { tipo: 'METRICA', valor: def && p.metrica(def) },
        INFORMAR_VALOR: { tipo: 'VALOR', valor: def && valorEsperado(def, e.cenarioAtual) },
        ESCOLHER_JUSTIFICATIVA: { tipo: 'JUSTIFICATIVA', valor: def && p.justificativa(def) },
      }[e.fase] ?? { tipo: 'CONTINUAR' };
      e = reduzir(e, acao);
    }
    if (vencedores(e).some((j) => j.id === 0)) vitoriasSabe++;
  }
  assert.ok(vitoriasSabe / PARTIDAS > 0.95, `quem sabe venceu só ${vitoriasSabe}/${PARTIDAS}`);
});

test('o dado não decide a partida: mesmo com sorte no dado, o conhecimento pesa mais', () => {
  // Dinheiro das casas de decisão vs. balanço e eventos, para quem sabe tudo.
  let decisao = 0;
  let outros = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const e = jogar({ jogadores: jogadores('iniciante'), turnos: 10, seed }, saberTudo);
    const j = e.jogadores[0];
    decisao += j.historico.reduce((s, h) => s + h.delta, 0);
    outros += j.dinheiro - DINHEIRO_INICIAL - j.historico.reduce((s, h) => s + h.delta, 0);
  }
  assert.ok(decisao > 2 * Math.abs(outros), `decisões ${decisao} vs. resto ${outros}`);
});

// ---------- modo cooperativo ----------

import { carteira, classificarEmpresa } from '../src/engine/state.js';
import { metaTrimestral } from '../src/engine/machine.js';

const coop = (n, extra = {}) =>
  novoJogo({ jogadores: jogadores(...Array(n).fill('iniciante')), modo: 'cooperativo', seed: 5, ...extra });

test('cooperativo: todo setor tem responsável, com 1, 2 ou 3 jogadores', () => {
  for (const n of [1, 2, 3]) {
    const e = coop(n);
    const papeis = e.jogadores.flatMap((j) => j.papeis);
    assert.deepEqual([...papeis].sort(), ['operacoes', 'pessoas_financas', 'tecnologia']);
  }
});

test('cooperativo: o caixa é da empresa, e o dinheiro dos jogadores não muda', () => {
  const e = jogar({ jogadores: jogadores('iniciante', 'iniciante'), modo: 'cooperativo', turnos: 6, seed: 3 }, saberTudo);
  assert.ok(e.jogadores.every((j) => j.dinheiro === DINHEIRO_INICIAL));
  assert.notEqual(e.empresa.dinheiro, DINHEIRO_INICIAL);
  assert.ok(e.empresa.dinheiro > DINHEIRO_INICIAL);
});

test('competitivo continua com carteira individual e sem empresa', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), seed: 1 });
  assert.equal(e.empresa, null);
  assert.equal(carteira(e), e.jogadores[0]);
  // saves antigos, sem `modo`, seguem competitivos
  delete e.modo;
  assert.equal(carteira(e), e.jogadores[0]);
});

test('cooperativo: a meta do Balanço premia ou corta e ninguém é eliminado', () => {
  const resultados = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const e = jogar({ jogadores: jogadores('iniciante', 'iniciante'), modo: 'cooperativo', turnos: 10, seed }, chutador(seed));
    assert.equal(e.fase, 'FIM_DE_JOGO');
    assert.equal(e.jogadores.length, 2);
  }
  // força um Balanço com caixa baixo e outro com caixa alto
  for (const dinheiro of [0, 10 * DINHEIRO_INICIAL]) {
    let e = coop(1);
    e.empresa.dinheiro = dinheiro;
    e.jogadores[0].posicao = 27; // qualquer dado passa pelo início
    e = reduzir(e, { tipo: 'ROLAR' });
    assert.ok(e.balanco.meta, 'balanço cooperativo deve avaliar a meta');
    resultados.add(e.balanco.meta.cumprida);
    assert.equal(e.balanco.meta.valor, metaTrimestral(e));
  }
  assert.deepEqual([...resultados].sort(), [false, true]);
});

test('cooperativo: a meta cresce com os trimestres e com o número de jogadores', () => {
  const a = coop(1);
  const b = coop(3);
  assert.equal(metaTrimestral(a), DINHEIRO_INICIAL);
  assert.ok(metaTrimestral({ ...a, turnoAtual: 5 }) > metaTrimestral(a));
  assert.ok(metaTrimestral({ ...b, turnoAtual: 5 }) > metaTrimestral({ ...a, turnoAtual: 5 }));
});

test('cooperativo: classificação final por faixas de caixa e reputação', () => {
  const faixa = (dinheiro, reputacao) => classificarEmpresa({ dinheiro, reputacao }).id;
  assert.equal(faixa(0, 90), 'falencia');
  assert.equal(faixa(DINHEIRO_INICIAL, 50), 'sobrevivencia');
  assert.equal(faixa(2 * DINHEIRO_INICIAL, 65), 'crescimento');
  assert.equal(faixa(3 * DINHEIRO_INICIAL, 80), 'lider');
  assert.equal(faixa(3 * DINHEIRO_INICIAL, 30), 'sobrevivencia'); // caixa sozinho não basta
});

test('cooperativo: o estado sobrevive a JSON e a partida é determinística', () => {
  const cfg = { jogadores: jogadores('iniciante', 'avancado', 'iniciante'), modo: 'cooperativo', turnos: 5, seed: 8 };
  const e = jogar(cfg, saberTudo);
  assert.deepEqual(JSON.parse(JSON.stringify(e)), e);
  assert.deepEqual(jogar(cfg, saberTudo), e);
});

test('a dica começa oculta e abri-la marca o cenário (só iniciante)', () => {
  const chegarNaDecisao = (nivel) => {
    let e = novoJogo({ jogadores: jogadores(nivel), seed: 1 });
    for (let i = 0; e.fase !== 'ESCOLHER_METRICA' && i < 20; i++) {
      e = reduzir(e, { tipo: e.fase === 'ROLAR_DADO' ? 'ROLAR' : 'CONTINUAR' });
    }
    return e;
  };
  let e = chegarNaDecisao('iniciante');
  const def = obterCenario(e.cenarioAtual.id);
  assert.equal(e.cenarioAtual.dicaUsada, false);
  assert.doesNotMatch(viewJogo(e), /class="dica"/);
  e = reduzir(e, { tipo: 'ABRIR_DICA' });
  assert.equal(e.cenarioAtual.dicaUsada, Boolean(def.dica));
  if (def.dica) assert.match(viewJogo(e), /class="dica"/);

  const av = chegarNaDecisao('avancado');
  assert.equal(reduzir(av, { tipo: 'ABRIR_DICA' }).cenarioAtual.dicaUsada, false);
});

test('atalhos de teste: casa forçada e baralho restrito aos cenários escolhidos', () => {
  const alvo = 'cenario_14_alugueis';
  let e = novoJogo({
    jogadores: jogadores('iniciante'),
    turnos: 10,
    seed: 3,
    teste: { casa: 'decisao', cenarios: [alvo] },
  });
  for (let i = 0; i < 40; i++) {
    e = reduzir(e, { tipo: 'ROLAR' });
    assert.equal(e.fase, 'ESCOLHER_METRICA', 'toda rolagem cai em Decisão');
    assert.equal(e.cenarioAtual.id, alvo, 'o baralho só tem o cenário escolhido');
    e = { ...e, fase: 'MOSTRAR_RESULTADO' };
    e = reduzir(e, { tipo: 'CONTINUAR' });
    if (e.fase === 'FIM_DE_JOGO') break;
  }
});

test('atalhos de teste: casa de Evento ou Balanço forçada; partida normal não tem teste', () => {
  const base = { jogadores: jogadores('iniciante'), turnos: 10, seed: 3 };
  assert.equal(novoJogo(base).teste, null);
  assert.equal(novoJogo({ ...base, teste: { casa: null, cenarios: null } }).teste, null);
  assert.equal(reduzir(novoJogo({ ...base, teste: { casa: 'evento' } }), { tipo: 'ROLAR' }).fase, 'MOSTRAR_EVENTO');
  const b = reduzir(novoJogo({ ...base, teste: { casa: 'balanco' } }), { tipo: 'ROLAR' });
  assert.equal(b.fase, 'MOSTRAR_BALANCO');
  assert.ok(b.balanco, 'o Balanço forçado também calcula o resultado');
});

test('sem material de apoio, o baralho exclui os cenários de cálculo', () => {
  const base = { jogadores: jogadores('iniciante'), turnos: 12, seed: 5, teste: { casa: 'decisao' } };
  assert.equal(novoJogo(base).soConceitual, false);
  let e = novoJogo({ ...base, soConceitual: true });
  assert.equal(e.soConceitual, true);
  for (let i = 0; i < 60 && e.fase !== 'FIM_DE_JOGO'; i++) {
    e = reduzir(e, { tipo: 'ROLAR' });
    assert.ok(!ehCalculo(obterCenario(e.cenarioAtual.id)), 'nenhum cenário de cálculo');
    e = reduzir({ ...e, fase: 'MOSTRAR_RESULTADO' }, { tipo: 'CONTINUAR' });
  }
  // O atalho de teste que escolhe um cenário tem precedência.
  const alvo = 'cenario_14_alugueis';
  const t = reduzir(novoJogo({ ...base, soConceitual: true, teste: { casa: 'decisao', cenarios: [alvo] } }), { tipo: 'ROLAR' });
  assert.equal(t.cenarioAtual.id, alvo);
});

test('rounds e caixa inicial vêm do menu e são limitados', () => {
  const base = { jogadores: jogadores('iniciante', 'iniciante'), seed: 1 };
  const e = novoJogo({ ...base, turnos: 64, dinheiroInicial: 250000 });
  assert.equal(e.turnosPorJogador, 64);
  assert.equal(e.dinheiroInicial, 250000);
  assert.ok(e.jogadores.every((j) => j.dinheiro === 250000));
  assert.equal(novoJogo({ ...base, turnos: 500 }).turnosPorJogador, 64);
  assert.equal(novoJogo({ ...base, turnos: 0 }).turnosPorJogador, 1);
  assert.equal(novoJogo({ ...base, turnos: NaN }).turnosPorJogador, TURNOS_PADRAO);
  assert.equal(novoJogo({ ...base, dinheiroInicial: 1 }).dinheiroInicial, DINHEIRO_INICIAL_MIN);
  assert.equal(novoJogo({ ...base, dinheiroInicial: 1e9 }).dinheiroInicial, DINHEIRO_INICIAL_MAX);
  assert.equal(novoJogo({ ...base, dinheiroInicial: NaN }).dinheiroInicial, DINHEIRO_INICIAL);
});

test('cooperativo: caixa da empresa, meta e faixas seguem o caixa inicial escolhido', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), modo: 'cooperativo', seed: 5, dinheiroInicial: 400000 });
  assert.equal(e.empresa.dinheiro, 400000);
  assert.equal(metaTrimestral(e), 400000);
  assert.equal(classificarEmpresa({ dinheiro: 500000, reputacao: 80 }, 400000).id, 'crescimento');
  assert.equal(classificarEmpresa({ dinheiro: 500000, reputacao: 80 }).id, 'lider'); // padrão: R$ 100.000
  // Save antigo, sem `dinheiroInicial`: vale o padrão.
  const { dinheiroInicial, ...antigo } = e;
  assert.equal(metaTrimestral(antigo), DINHEIRO_INICIAL);
});

test('reputação inicial vem do menu, vale para cada jogador (ou a empresa) e é limitada', () => {
  const base = { jogadores: jogadores('iniciante', 'iniciante'), seed: 1 };
  const e = novoJogo({ ...base, reputacaoInicial: 80 });
  assert.equal(e.reputacaoInicial, 80);
  assert.ok(e.jogadores.every((j) => j.reputacao === 80));
  assert.equal(novoJogo({ ...base }).reputacaoInicial, REPUTACAO_INICIAL);
  assert.equal(novoJogo({ ...base, reputacaoInicial: 1 }).reputacaoInicial, REPUTACAO_INICIAL_MIN);
  assert.equal(novoJogo({ ...base, reputacaoInicial: 500 }).reputacaoInicial, REPUTACAO_INICIAL_MAX);
  assert.equal(novoJogo({ ...base, reputacaoInicial: NaN }).reputacaoInicial, REPUTACAO_INICIAL);
  const coop = novoJogo({ jogadores: jogadores('iniciante'), modo: 'cooperativo', seed: 5, reputacaoInicial: 30 });
  assert.equal(coop.empresa.reputacao, 30);
  assert.equal(coop.jogadores[0].reputacao, 30);
  // Save antigo, sem `reputacaoInicial`: vale o padrão.
  assert.equal(reputacaoInicialDe({ ...e, reputacaoInicial: undefined }), REPUTACAO_INICIAL);
  assert.equal(reputacaoInicialDe(e), 80);
});

// ---------- falência (fisher.md 3.12) ----------

import { ehFalido, empresaFalida } from '../src/engine/state.js';

// Estado parado na tela de resultado, com o caixa da carteira da vez já no valor dado.
// `balanco: true` simula uma jogada que passou pela casa do Balanço.
function emResultado(config, dinheiro, { balanco = true } = {}) {
  const e = novoJogo({ turnos: 5, seed: 1, ...config });
  e.fase = 'MOSTRAR_RESULTADO';
  carteira(e).dinheiro = dinheiro;
  e.balanco = balanco ? { receita: 0, custos: 0, liquido: 0 } : null;
  return e;
}

test('falência: caixa negativo ao continuar tira o jogador da disputa e a partida segue com os demais', () => {
  let e = emResultado({ jogadores: jogadores('iniciante', 'iniciante', 'iniciante') }, -1);
  e = reduzir(e, { tipo: 'CONTINUAR' });
  assert.equal(ehFalido(e.jogadores[0]), true);
  assert.equal(e.jogadorAtual, 1);
  assert.equal(e.fase, 'ROLAR_DADO');
  // Na volta seguinte, o falido é pulado.
  e.jogadorAtual = 2;
  e.fase = 'MOSTRAR_EVENTO';
  e = reduzir(e, { tipo: 'CONTINUAR' });
  assert.equal(e.jogadorAtual, 1);
  assert.equal(e.turnoAtual, 2);
});

test('falência: caixa negativo fora do Balanço não elimina ninguém', () => {
  for (const modo of ['competitivo', 'cooperativo']) {
    const e = reduzir(emResultado({ jogadores: jogadores('iniciante', 'iniciante'), modo }, -5000, { balanco: false }), { tipo: 'CONTINUAR' });
    assert.equal(e.fase, 'ROLAR_DADO');
    assert.equal(ehFalido(e.jogadores[0]), false);
    assert.equal(empresaFalida(e), false);
  }
});

test('falência: caixa zero não quebra, só negativo', () => {
  const e = reduzir(emResultado({ jogadores: jogadores('iniciante', 'iniciante') }, 0), { tipo: 'CONTINUAR' });
  assert.equal(ehFalido(e.jogadores[0]), false);
  assert.equal(e.jogadorAtual, 1);
});

test('falência: com dois jogadores, quem quebra perde e o outro vence na hora', () => {
  const e = reduzir(emResultado({ jogadores: jogadores('iniciante', 'iniciante') }, -500), { tipo: 'CONTINUAR' });
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.deepEqual(vencedores(e).map((j) => j.id), [1]);
});

// Jogada de Balanço do jogador `quem`, com os caixas dados para cada jogador.
function balancoDe(quem, caixas, extra = {}) {
  const e = novoJogo({ jogadores: jogadores(...caixas.map(() => 'iniciante')), turnos: 5, seed: 1 });
  caixas.forEach((c, i) => { e.jogadores[i].dinheiro = c; });
  Object.assign(e, { jogadorAtual: quem, fase: 'MOSTRAR_BALANCO', balanco: { receita: 0, custos: 0, liquido: 0 } }, extra);
  return e;
}

test('falência: quem passa negativado espera o rival negativado, com saldo pior, passar pelo Balanço', () => {
  // J1 passa com -1.000; J2 está com -9.000 e ainda não passou: ninguém perde por enquanto.
  let e = reduzir(balancoDe(0, [-1000, -9000, 50000]), { tipo: 'CONTINUAR' });
  assert.equal(e.jogadores[0].falido, false);
  assert.equal(e.jogadores[0].negativado, true);
  assert.equal(e.jogadorAtual, 1);
  assert.equal(e.fase, 'ROLAR_DADO');
  // J2 passa pelo Balanço: tem o menor saldo dos dois e perde.
  e.fase = 'MOSTRAR_BALANCO';
  e.balanco = { receita: 0, custos: 0, liquido: 0 };
  e = reduzir(e, { tipo: 'CONTINUAR' });
  assert.equal(e.jogadores[1].falido, true);
  assert.equal(e.jogadores[0].falido, false);
  assert.equal(e.jogadores[0].negativado, false);
});

test('falência: se o rival melhora e passa ainda negativado com saldo melhor, perde quem esperava', () => {
  let e = reduzir(balancoDe(0, [-1000, -9000]), { tipo: 'CONTINUAR' });
  assert.equal(e.jogadores[0].falido, false);
  e.jogadores[1].dinheiro = -500;
  Object.assign(e, { fase: 'MOSTRAR_BALANCO', balanco: { receita: 0, custos: 0, liquido: 0 } });
  e = reduzir(e, { tipo: 'CONTINUAR' });
  assert.equal(e.jogadores[0].falido, true);
  assert.equal(e.jogadores[1].falido, false);
  assert.equal(e.fase, 'FIM_DE_JOGO');
});

test('falência: se o rival se recupera ao passar, quem esperava perde', () => {
  let e = reduzir(balancoDe(0, [-1000, -9000, 50000]), { tipo: 'CONTINUAR' });
  e.jogadores[1].dinheiro = 3000;
  Object.assign(e, { fase: 'MOSTRAR_BALANCO', balanco: { receita: 0, custos: 0, liquido: 0 } });
  e = reduzir(e, { tipo: 'CONTINUAR' });
  assert.equal(e.jogadores[0].falido, true);
  assert.equal(e.jogadores[1].falido, false);
});

test('falência: rival negativado com saldo melhor não faz esperar', () => {
  const e = reduzir(balancoDe(0, [-9000, -1000, 50000]), { tipo: 'CONTINUAR' });
  assert.equal(e.jogadores[0].falido, true);
});

test('falência: o aviso na tela diz que o veredito espera o rival', () => {
  const e = balancoDe(0, [-1000, -9000]);
  e.eventoAtual = { id: 'eixo_truncado', crise: false, dinheiro: 0 };
  e.fase = 'MOSTRAR_EVENTO';
  assert.match(viewJogo(e), /veredito espera J2/);
});

test('falência: quem faliu perde mesmo com mais dinheiro que o outro', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante', 'iniciante'), seed: 1 });
  e.jogadores[0].falido = true;
  e.jogadores[0].dinheiro = 500000;
  e.jogadores[1].dinheiro = 10;
  assert.deepEqual(vencedores(e).map((j) => j.id), [1]);
});

test('falência: sozinho, quebrar encerra a partida sem vencedor', () => {
  const e = reduzir(emResultado({ jogadores: jogadores('iniciante') }, -1), { tipo: 'CONTINUAR' });
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.deepEqual(vencedores(e), []);
});

test('falência: no cooperativo, caixa negativo da empresa encerra a partida', () => {
  const e = reduzir(emResultado({ jogadores: jogadores('iniciante', 'iniciante'), modo: 'cooperativo' }, -1), { tipo: 'CONTINUAR' });
  assert.equal(empresaFalida(e), true);
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.equal(classificarEmpresa(e.empresa).id, 'falencia');
});

test('falência: o aviso aparece na tela antes de continuar e o placar marca o falido', () => {
  const e = emResultado({ jogadores: jogadores('iniciante', 'iniciante') }, -1);
  e.fase = 'MOSTRAR_EVENTO';
  e.eventoAtual = { id: 'eixo_truncado', crise: false, dinheiro: 0 };
  assert.match(viewJogo(e), /vai à falência/);
  e.balanco = null;
  assert.doesNotMatch(viewJogo(e), /vai à falência/);
  e.balanco = { receita: 0, custos: 0, liquido: 0 };
  e.jogadores[0].falido = true;
  assert.match(viewJogo(e), /Falido/);
});

// ---------- cooperativo: Balanço, amortecimento e faixas (fisher.md 3.9 e docs/modo-cooperativo.md) ----------

import {
  MULTA_CRISE, REPUTACAO_POS_CRISE, REPUTACAO_INICIAL, CUSTOS_BALANCO, BONUS_INVESTIDOR, BONUS_INVESTIDOR_REPUTACAO,
  CORTE_ORCAMENTO, CORTE_ORCAMENTO_REPUTACAO, REDUCAO_PREJUIZO_PASSIVA, REPUTACAO_BALANCO_RH,
} from '../src/engine/config.js';
import { receitaBalanco } from '../src/engine/scoring.js';
import { EVENTOS, TIPOS_CARTA, eventosDoTipo } from '../src/scenarios/content/eventos.js';

// Parado na casa 27 com o Balanço forçado: qualquer dado passa pelo início e a jogada termina em MOSTRAR_BALANCO.
function noBalanco(modo, { dinheiro, reputacao, ...extra } = {}) {
  const e = novoJogo({ jogadores: jogadores('iniciante'), modo, seed: 5, teste: { casa: 'balanco' }, ...extra });
  e.jogadores[0].posicao = 27;
  const w = carteira(e);
  if (dinheiro !== undefined) w.dinheiro = dinheiro;
  if (reputacao !== undefined) w.reputacao = reputacao;
  return e;
}

// Rola na casa de Evento e escolhe (e mantém) a carta `idCarta`, posta na mão com uma carta de cada um dos outros tipos.
// `posicao` 27 faz a jogada passar pelo Balanço.
function comEvento(modo, idCarta, { dinheiro, reputacao, posicao = 0 } = {}) {
  const e = novoJogo({ jogadores: jogadores('iniciante'), modo, seed: 5, teste: { casa: 'evento' } });
  e.jogadores[0].posicao = posicao;
  const w = carteira(e);
  if (dinheiro !== undefined) w.dinheiro = dinheiro;
  if (reputacao !== undefined) w.reputacao = reputacao;
  const rolado = reduzir(e, { tipo: 'ROLAR' });
  const { tipo } = EVENTOS.find((c) => c.id === idCarta);
  rolado.eventoAtual.cartas = [idCarta, ...TIPOS_CARTA.filter((t) => t !== tipo).map((t) => eventosDoTipo(t)[0].id)];
  return reduzir(reduzir(reduzir(rolado, { tipo: 'PARTICIPAR' }), { tipo: 'ESCOLHER_CARTA', valor: 0 }), { tipo: 'MANTER' });
}

test('cooperativo: o Balanço dá o bônus do RH à reputação da empresa e o expõe em balanco.bonusRh', () => {
  assert.equal(REPUTACAO_BALANCO_RH, 2);
  // Meta cumprida: reputação = inicial + RH + bônus do investidor.
  const ok = reduzir(noBalanco('cooperativo', { dinheiro: 10 * DINHEIRO_INICIAL }), { tipo: 'ROLAR' });
  assert.equal(ok.fase, 'MOSTRAR_BALANCO');
  assert.equal(ok.balanco.bonusRh, REPUTACAO_BALANCO_RH);
  assert.equal(ok.empresa.reputacao, REPUTACAO_INICIAL + REPUTACAO_BALANCO_RH + BONUS_INVESTIDOR_REPUTACAO);
  // Meta falha: o RH entra antes do corte.
  const falha = reduzir(noBalanco('cooperativo', { dinheiro: 0 }), { tipo: 'ROLAR' });
  assert.equal(falha.balanco.bonusRh, REPUTACAO_BALANCO_RH);
  assert.equal(falha.empresa.reputacao, REPUTACAO_INICIAL + REPUTACAO_BALANCO_RH - CORTE_ORCAMENTO_REPUTACAO);
  // Os jogadores não ganham o bônus: ele é da empresa.
  assert.equal(ok.jogadores[0].reputacao, REPUTACAO_INICIAL);
});

test('competitivo: o Balanço não tem bônus do RH nem meta', () => {
  const e = reduzir(noBalanco('competitivo'), { tipo: 'ROLAR' });
  assert.equal(e.fase, 'MOSTRAR_BALANCO');
  assert.equal(e.balanco.bonusRh, undefined);
  assert.equal(e.balanco.meta, undefined);
  assert.equal(e.jogadores[0].reputacao, REPUTACAO_INICIAL);
  assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL + receitaBalanco(REPUTACAO_INICIAL) - CUSTOS_BALANCO);
});

test('cooperativo: meta cumprida credita exatamente o bônus do investidor e a reputação extra', () => {
  const caixa = 10 * DINHEIRO_INICIAL;
  const e = reduzir(noBalanco('cooperativo', { dinheiro: caixa }), { tipo: 'ROLAR' });
  const receita = receitaBalanco(REPUTACAO_INICIAL);
  assert.equal(BONUS_INVESTIDOR, 10000);
  assert.equal(BONUS_INVESTIDOR_REPUTACAO, 3);
  assert.deepEqual(e.balanco.meta, {
    valor: DINHEIRO_INICIAL,
    cumprida: true,
    dinheiro: BONUS_INVESTIDOR,
    reputacao: BONUS_INVESTIDOR_REPUTACAO,
    crise: false,
  });
  assert.equal(e.empresa.dinheiro, caixa + receita - CUSTOS_BALANCO + BONUS_INVESTIDOR);
});

test('cooperativo: meta falha aplica exatamente o corte de orçamento e a perda de reputação', () => {
  const e = reduzir(noBalanco('cooperativo', { dinheiro: 0 }), { tipo: 'ROLAR' });
  const receita = receitaBalanco(REPUTACAO_INICIAL);
  assert.equal(CORTE_ORCAMENTO, 8000);
  assert.equal(CORTE_ORCAMENTO_REPUTACAO, 5);
  assert.deepEqual(e.balanco.meta, {
    valor: DINHEIRO_INICIAL,
    cumprida: false,
    dinheiro: -CORTE_ORCAMENTO,
    reputacao: -CORTE_ORCAMENTO_REPUTACAO,
    crise: false,
  });
  assert.equal(e.empresa.dinheiro, receita - CUSTOS_BALANCO - CORTE_ORCAMENTO);
});

test('cooperativo: a meta é avaliada com o caixa já depois da receita e dos custos (limite exato)', () => {
  const liquido = receitaBalanco(REPUTACAO_INICIAL) - CUSTOS_BALANCO;
  const meta = (caixa) => reduzir(noBalanco('cooperativo', { dinheiro: caixa }), { tipo: 'ROLAR' }).balanco.meta;
  assert.equal(meta(DINHEIRO_INICIAL - liquido).cumprida, true, 'caixa == meta cumpre');
  assert.equal(meta(DINHEIRO_INICIAL - liquido - 1).cumprida, false, 'R$ 1 abaixo da meta falha');
});

test('cooperativo: o objeto balanco traz receita, custos e líquido além da meta', () => {
  const { balanco } = reduzir(noBalanco('cooperativo', { dinheiro: 0 }), { tipo: 'ROLAR' });
  const receita = receitaBalanco(REPUTACAO_INICIAL);
  assert.equal(balanco.receita, receita);
  assert.equal(balanco.custos, CUSTOS_BALANCO);
  assert.equal(balanco.liquido, receita - CUSTOS_BALANCO);
  assert.deepEqual(Object.keys(balanco.meta).sort(), ['crise', 'cumprida', 'dinheiro', 'reputacao', 'valor']);
});

// ---------- amortecimento passivo de prejuízo em eventos ----------

test('cooperativo: prejuízo de evento é reduzido em 30% e arredondado à centena (-5.000 vira -3.500)', () => {
  assert.equal(REDUCAO_PREJUIZO_PASSIVA, 0.3);
  const carta = EVENTOS.find((c) => c.id === 'taxa_base');
  assert.equal(carta.dinheiro, -5000);
  const e = comEvento('cooperativo', 'taxa_base');
  assert.equal(e.fase, 'MOSTRAR_EVENTO');
  assert.equal(e.eventoAtual.dinheiro, -3500);
  assert.equal(e.empresa.dinheiro, DINHEIRO_INICIAL - 3500);
  // A reputação da carta não é amortecida.
  assert.equal(e.empresa.reputacao, REPUTACAO_INICIAL + carta.reputacao);
});

test('cooperativo: evento de ganho não sofre alteração', () => {
  const carta = EVENTOS.find((c) => c.id === 'sobrevivencia');
  assert.ok(carta.dinheiro > 0);
  const e = comEvento('cooperativo', 'sobrevivencia');
  assert.equal(e.eventoAtual.dinheiro, carta.dinheiro);
  assert.equal(e.empresa.dinheiro, DINHEIRO_INICIAL + carta.dinheiro);
});

test('competitivo: prejuízo de evento não é amortecido', () => {
  const e = comEvento('competitivo', 'taxa_base');
  assert.equal(e.eventoAtual.dinheiro, -5000);
  assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL - 5000);
});

test('amortecimento vale para toda carta de evento: só prejuízo, só no cooperativo, sempre à centena', () => {
  for (const carta of EVENTOS) {
    const coopE = comEvento('cooperativo', carta.id);
    const compE = comEvento('competitivo', carta.id);
    assert.equal(compE.eventoAtual.dinheiro, carta.dinheiro, `competitivo ${carta.id}`);
    const esperado = carta.dinheiro < 0 ? Math.round((carta.dinheiro * (1 - REDUCAO_PREJUIZO_PASSIVA)) / 100) * 100 : carta.dinheiro;
    assert.equal(coopE.eventoAtual.dinheiro, esperado, `cooperativo ${carta.id}`);
    assert.equal(Math.abs(coopE.eventoAtual.dinheiro) % 100, 0, `centena ${carta.id}`);
    if (carta.dinheiro < 0) assert.ok(coopE.eventoAtual.dinheiro > carta.dinheiro, `${carta.id} deveria perder menos`);
  }
});

// ---------- faixas de encerramento cooperativo (limites exatos) ----------

test('cooperativo: limites exatos das faixas de encerramento, com o caixa inicial padrão e com outro', () => {
  for (const C of [DINHEIRO_INICIAL, 250000]) {
    const faixa = (dinheiro, reputacao) => classificarEmpresa({ dinheiro, reputacao }, C).id;
    assert.equal(faixa(1.75 * C, 75), 'lider', `1,75 C e rep. 75 (C = ${C})`);
    assert.equal(faixa(1.75 * C, 74), 'crescimento', `1,75 C e rep. 74 (C = ${C})`);
    assert.equal(faixa(1.75 * C - 1, 100), 'crescimento', `1,75 C - 1 e rep. 100 (C = ${C})`);
    assert.equal(faixa(1.25 * C, 60), 'crescimento', `1,25 C e rep. 60 (C = ${C})`);
    assert.equal(faixa(1.25 * C, 59), 'sobrevivencia', `1,25 C e rep. 59 (C = ${C})`);
    assert.equal(faixa(1.25 * C - 1, 60), 'sobrevivencia', `1,25 C - 1 e rep. 60 (C = ${C})`);
    assert.equal(faixa(0.5 * C, 0), 'sobrevivencia', `0,5 C e rep. 0 (C = ${C})`);
    assert.equal(faixa(0.5 * C - 1, 100), 'falencia', `0,5 C - 1 e rep. 100 (C = ${C})`);
    assert.equal(faixa(-1, 100), 'falencia', `caixa negativo (C = ${C})`);
  }
});

// ---------- crise de imagem (reputação em zero) ----------

// Parado em ESCOLHER_METRICA no cenário 01 (não é de cálculo), com a reputação e o caixa dados.
function emDecisao(modo, { dinheiro, reputacao }) {
  let e = novoJogo({ jogadores: jogadores('iniciante'), modo, seed: 3, teste: { casa: 'decisao', cenarios: ['cenario_01_salarios'] } });
  e = reduzir(e, { tipo: 'ROLAR' });
  assert.equal(e.fase, 'ESCOLHER_METRICA');
  const w = carteira(e);
  w.dinheiro = dinheiro;
  w.reputacao = reputacao;
  return e;
}

// Responde errado em tudo, com certeza absoluta: categoria `erro_total`, a pior reputação do cenário.
function errarTudo(e) {
  const def = obterCenario(e.cenarioAtual.id);
  e = reduzir(e, { tipo: 'METRICA', valor: def.opcoes.find((o) => !o.correta).id });
  e = reduzir(e, { tipo: 'JUSTIFICATIVA', valor: def.justificativas.find((j) => j.tipo === 'erro_conceitual').id });
  return reduzir(e, { tipo: 'CONFIANCA', valor: 'certeza' });
}

test('crise de imagem por decisão: reputação que chega a zero cobra a multa e volta a 20', () => {
  for (const modo of ['competitivo', 'cooperativo']) {
    const e = errarTudo(emDecisao(modo, { dinheiro: 100000, reputacao: 5 }));
    assert.equal(e.fase, 'MOSTRAR_RESULTADO', modo);
    assert.equal(e.resultado.categoria, 'erro_total');
    assert.ok(e.resultado.deltaReputacao <= -5, 'a penalidade leva a reputação a zero ou abaixo');
    assert.equal(e.resultado.crise, true, modo);
    assert.equal(carteira(e).reputacao, REPUTACAO_POS_CRISE, modo);
    assert.equal(carteira(e).dinheiro, 100000 + e.resultado.delta - MULTA_CRISE, modo);
  }
});

test('crise de imagem por decisão: reputação que ficaria negativa também cobra a multa uma única vez', () => {
  const e = errarTudo(emDecisao('competitivo', { dinheiro: 100000, reputacao: 1 }));
  assert.equal(e.resultado.crise, true);
  assert.equal(e.jogadores[0].reputacao, REPUTACAO_POS_CRISE);
  assert.equal(e.jogadores[0].dinheiro, 100000 + e.resultado.delta - MULTA_CRISE);
});

test('sem crise quando a reputação resiste à penalidade da decisão', () => {
  const e = errarTudo(emDecisao('competitivo', { dinheiro: 100000, reputacao: 50 }));
  assert.equal(e.resultado.crise, false);
  assert.equal(e.jogadores[0].reputacao, 50 + e.resultado.deltaReputacao);
  assert.equal(e.jogadores[0].dinheiro, 100000 + e.resultado.delta);
  // Reputação exatamente igual à penalidade zera e dispara; uma a mais não.
  const limite = errarTudo(emDecisao('competitivo', { dinheiro: 100000, reputacao: -e.resultado.deltaReputacao }));
  assert.equal(limite.resultado.crise, true);
  const acima = errarTudo(emDecisao('competitivo', { dinheiro: 100000, reputacao: -e.resultado.deltaReputacao + 1 }));
  assert.equal(acima.resultado.crise, false);
  assert.equal(acima.jogadores[0].reputacao, 1);
});

test('crise de imagem por evento: perda de reputação até zero cobra a multa e volta a 20', () => {
  const carta = EVENTOS.find((c) => c.id === 'correlacao'); // -3 de reputação
  assert.equal(carta.reputacao, -3);
  const e = comEvento('competitivo', 'correlacao', { dinheiro: 100000, reputacao: 3 });
  assert.equal(e.eventoAtual.crise, true);
  assert.equal(e.jogadores[0].reputacao, REPUTACAO_POS_CRISE);
  assert.equal(e.jogadores[0].dinheiro, 100000 + carta.dinheiro - MULTA_CRISE);
  // Reputação 4 resiste (fica em 1).
  const resiste = comEvento('competitivo', 'correlacao', { reputacao: 4 });
  assert.equal(resiste.eventoAtual.crise, false);
  assert.equal(resiste.jogadores[0].reputacao, 1);
});

test('crise de imagem por evento no cooperativo: a multa sai do caixa da empresa, junto do prejuízo amortecido', () => {
  const e = comEvento('cooperativo', 'correlacao', { dinheiro: 100000, reputacao: 2 });
  assert.equal(e.eventoAtual.crise, true);
  assert.equal(e.eventoAtual.dinheiro, -7000);
  assert.equal(e.empresa.reputacao, REPUTACAO_POS_CRISE);
  assert.equal(e.empresa.dinheiro, 100000 - 7000 - MULTA_CRISE);
  assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL, 'o caixa dos jogadores não muda');
});

test('evento sem perda de reputação nunca dispara crise, mesmo com reputação zerada no limite', () => {
  const e = comEvento('competitivo', 'eixo_truncado', { reputacao: 1 });
  assert.equal(e.eventoAtual.crise, false);
  assert.equal(e.jogadores[0].reputacao, 1);
});

test('crise de imagem pelo Balanço cooperativo: o corte por meta falha leva a reputação a zero', () => {
  // RH +2 antes do corte de -5: reputação 3 vira 5 e depois 0.
  const e = reduzir(noBalanco('cooperativo', { dinheiro: 0, reputacao: 3 }), { tipo: 'ROLAR' });
  const receita = receitaBalanco(3);
  assert.equal(e.balanco.meta.cumprida, false);
  assert.equal(e.balanco.meta.crise, true);
  assert.equal(e.empresa.reputacao, REPUTACAO_POS_CRISE);
  assert.equal(e.empresa.dinheiro, receita - CUSTOS_BALANCO - CORTE_ORCAMENTO - MULTA_CRISE);
});

test('sem crise no Balanço cooperativo quando o bônus do RH segura a reputação acima de zero', () => {
  // Reputação 4: +2 = 6, -5 = 1.
  const e = reduzir(noBalanco('cooperativo', { dinheiro: 0, reputacao: 4 }), { tipo: 'ROLAR' });
  assert.equal(e.balanco.meta.crise, false);
  assert.equal(e.empresa.reputacao, 1);
});

test('crise de imagem pelo Balanço: meta cumprida nunca dispara crise', () => {
  const e = reduzir(noBalanco('cooperativo', { dinheiro: 10 * DINHEIRO_INICIAL, reputacao: 1 }), { tipo: 'ROLAR' });
  assert.equal(e.balanco.meta.crise, false);
  assert.equal(e.empresa.reputacao, 1 + REPUTACAO_BALANCO_RH + BONUS_INVESTIDOR_REPUTACAO);
});

test('crise causando falência no cooperativo: a multa da crise leva o caixa a negativo no Balanço', () => {
  // Sem a multa o caixa fecharia em R$ 5.000; com ela, em -R$ 5.000.
  const receita = receitaBalanco(3);
  const caixa = 5000 - (receita - CUSTOS_BALANCO - CORTE_ORCAMENTO);
  let e = reduzir(noBalanco('cooperativo', { dinheiro: caixa, reputacao: 3 }), { tipo: 'ROLAR' });
  assert.equal(e.balanco.meta.crise, true);
  assert.equal(e.empresa.dinheiro, 5000 - MULTA_CRISE);
  assert.ok(e.empresa.dinheiro < 0);
  assert.equal(empresaFalida(e), false, 'a falência só é decretada ao continuar');
  e = reduzir(e, { tipo: 'CONTINUAR' });
  assert.equal(empresaFalida(e), true);
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.equal(classificarEmpresa(e.empresa).id, 'falencia');
});

test('crise de imagem sem a multa o caixa ficaria positivo: a empresa sobrevive ao Balanço', () => {
  // Mesma situação, mas a reputação resiste (4 vira 1): sem multa, o caixa fecha em R$ 5.000 e a jogada segue.
  const receita = receitaBalanco(4);
  const caixa = 5000 - (receita - CUSTOS_BALANCO - CORTE_ORCAMENTO);
  const e = reduzir(reduzir(noBalanco('cooperativo', { dinheiro: caixa, reputacao: 4 }), { tipo: 'ROLAR' }), { tipo: 'CONTINUAR' });
  assert.equal(empresaFalida(e), false);
  assert.equal(e.empresa.dinheiro, 5000);
  assert.equal(e.fase, 'ROLAR_DADO');
});

test('crise causando falência no competitivo: a multa de um evento na jogada do Balanço quebra o jogador', () => {
  // Passa pela casa 0 (posição 27) e cai num Evento que zera a reputação.
  const receita = receitaBalanco(3);
  const carta = EVENTOS.find((c) => c.id === 'correlacao');
  const caixa = 2000 - (receita - CUSTOS_BALANCO + carta.dinheiro); // depois do Balanço e do evento, sem multa: R$ 2.000
  let e = comEvento('competitivo', 'correlacao', { dinheiro: caixa, reputacao: 3, posicao: 27 });
  assert.ok(e.balanco, 'a jogada passou pelo Balanço');
  assert.equal(e.eventoAtual.crise, true);
  assert.equal(e.jogadores[0].dinheiro, 2000 - MULTA_CRISE);
  e = reduzir(e, { tipo: 'CONTINUAR' });
  assert.equal(ehFalido(e.jogadores[0]), true);
  assert.equal(e.fase, 'FIM_DE_JOGO');
});

// Sequências (fisher.md 3.13): joga uma decisão de um cenário comum com a política dada e devolve o resultado.
function decidir(e, { metricaCerta, justificativaCerta }) {
  e = reduzir(e, { tipo: 'ROLAR' });
  const def = obterCenario(e.cenarioAtual.id);
  e = reduzir(e, { tipo: 'METRICA', valor: def.opcoes.find((o) => o.correta === metricaCerta).id });
  if (e.fase === 'INFORMAR_VALOR') e = reduzir(e, { tipo: 'VALOR', valor: valorEsperado(def, e.cenarioAtual) });
  e = reduzir(e, { tipo: 'JUSTIFICATIVA', valor: def.justificativas.find((x) => (x.tipo === 'correta') === justificativaCerta).id });
  return reduzir(e, { tipo: 'CONFIANCA', valor: 'provavel' });
}
const proxima = (e) => reduzir(e, { tipo: 'CONTINUAR' });

test('sequência: erros totais seguidos custam cada vez mais, e um sucesso troca a sequência de erros pela de acertos', () => {
  let e = novoJogo({ jogadores: jogadores('iniciante'), turnos: 20, dinheiroInicial: 1000000, seed: 4, teste: { casa: 'decisao' } });
  assert.deepEqual(e.jogadores[0].sequencia, { erros: 0, acertos: 0 });
  const mults = [];
  for (let i = 0; i < 3; i++) {
    e = decidir(e, { metricaCerta: false, justificativaCerta: false });
    mults.push(e.resultado.multiplicadorSequencia);
    e = proxima(e);
  }
  assert.deepEqual(mults.map((m) => Math.round(m * 1000) / 1000), [1, 1.111, 1.235]);
  assert.deepEqual(e.jogadores[0].sequencia, { erros: 3, acertos: 0 });
  e = decidir(e, { metricaCerta: true, justificativaCerta: true });
  assert.equal(e.resultado.categoria, 'sucesso');
  assert.ok(Math.abs(e.resultado.multiplicadorSequencia - 0.729) < 1e-9, 'o sucesso depois de erros rende menos (×0,9³)');
  assert.deepEqual(e.resultado.sequencia, { erros: 0, acertos: 1 });
});

test('sequência: sucessos absolutos seguidos ampliam o ganho; resposta parcial interrompe', () => {
  let e = novoJogo({ jogadores: jogadores('iniciante'), turnos: 20, dinheiroInicial: 1000000, seed: 4, teste: { casa: 'decisao' } });
  const mults = [];
  for (let i = 0; i < 3; i++) {
    e = decidir(e, { metricaCerta: true, justificativaCerta: true });
    mults.push(e.resultado.multiplicadorSequencia);
    e = proxima(e);
  }
  assert.deepEqual(mults.map((m) => Math.round(m * 1000) / 1000), [1, 1.1, 1.21]);
  e = decidir(e, { metricaCerta: true, justificativaCerta: false });
  assert.equal(e.resultado.categoria, 'sorte');
  assert.equal(e.resultado.multiplicadorSequencia, 1);
  assert.deepEqual(e.jogadores[0].sequencia, { erros: 0, acertos: 0 });
});

test('sequência: é por jogador, e saves antigos sem o campo valem zero', () => {
  let e = novoJogo({ jogadores: jogadores('iniciante', 'iniciante'), turnos: 20, dinheiroInicial: 1000000, seed: 4, teste: { casa: 'decisao' } });
  e = proxima(decidir(e, { metricaCerta: false, justificativaCerta: false }));
  assert.equal(e.jogadorAtual, 1);
  assert.deepEqual(e.jogadores[1].sequencia, { erros: 0, acertos: 0 });
  e.jogadores[0].sequencia = undefined; // save antigo
  e = decidir(proxima(decidir(e, { metricaCerta: false, justificativaCerta: false })), { metricaCerta: false, justificativaCerta: false });
  assert.equal(e.resultado.multiplicadorSequencia, 1);
  assert.deepEqual(e.jogadores[0].sequencia, { erros: 1, acertos: 0 });
});

test('sequência: evento e Balanço não alteram a sequência', () => {
  for (const casa of ['evento', 'balanco']) {
    let e = novoJogo({ jogadores: jogadores('iniciante'), turnos: 20, dinheiroInicial: 1000000, seed: 4, teste: { casa: 'decisao' } });
    e = proxima(decidir(e, { metricaCerta: false, justificativaCerta: false }));
    e = proxima(decidir(e, { metricaCerta: false, justificativaCerta: false }));
    const antes = e.jogadores[0].sequencia;
    assert.deepEqual(antes, { erros: 2, acertos: 0 });
    e.teste.casa = casa;
    e = proxima(reduzir(e, { tipo: 'ROLAR' }));
    assert.deepEqual(e.jogadores[0].sequencia, antes, casa);
  }
});

// ---------- casa de Evento: participar ou passar, três cartas viradas (fisher.md 3.15) ----------

const naCasaDeEvento = (extra = {}) => reduzir(novoJogo({ jogadores: jogadores('iniciante'), seed: 5, teste: { casa: 'evento' }, ...extra }), { tipo: 'ROLAR' });

test('evento: a casa oferece participar ou passar, com três cartas, uma de cada tipo, e nada aplicado ainda', () => {
  const e = naCasaDeEvento();
  assert.equal(e.fase, 'MOSTRAR_EVENTO');
  assert.equal(e.eventoAtual.decisao, null);
  assert.equal(e.eventoAtual.cartas.length, 3);
  assert.deepEqual(e.eventoAtual.cartas.map((id) => EVENTOS.find((c) => c.id === id).tipo).sort(), [...TIPOS_CARTA].sort());
  assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL);
  assert.equal(e.jogadores[0].reputacao, REPUTACAO_INICIAL);
});

test('evento: participar põe as cartas na mesa e, escolhida uma e mantida, só o efeito dela vale', () => {
  let e = reduzir(naCasaDeEvento(), { tipo: 'PARTICIPAR' });
  assert.equal(e.eventoAtual.decisao, 'escolhendo');
  assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL, 'ainda sem efeito');
  e = reduzir(e, { tipo: 'ESCOLHER_CARTA', valor: '1' }); // o botão manda texto
  assert.equal(e.eventoAtual.decisao, 'trocando');
  assert.equal(e.eventoAtual.primeira, 1);
  assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL, 'a escolha ainda pode ser trocada: sem efeito');
  e = reduzir(e, { tipo: 'MANTER' });
  const carta = EVENTOS.find((c) => c.id === e.eventoAtual.cartas[1]);
  assert.equal(e.eventoAtual.decisao, 'participou');
  assert.equal(e.eventoAtual.escolhida, 1);
  assert.equal(e.eventoAtual.trocou, false);
  assert.equal(e.eventoAtual.id, carta.id);
  assert.equal(e.fase, 'MOSTRAR_EVENTO', 'a pessoa vê a carta antes de continuar');
  assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL + carta.dinheiro);
  assert.equal(e.jogadores[0].reputacao, REPUTACAO_INICIAL + carta.reputacao);
});

test('evento: a carta escolhida é a da posição, e a posição das cartas muda de uma casa para outra', () => {
  const posicoes = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const e = naCasaDeEvento({ seed });
    posicoes.add(e.eventoAtual.cartas.map((id) => EVENTOS.find((c) => c.id === id).tipo).join());
    for (let i = 0; i < 3; i++) {
      const r = reduzir(reduzir(reduzir(e, { tipo: 'PARTICIPAR' }), { tipo: 'ESCOLHER_CARTA', valor: i }), { tipo: 'MANTER' });
      assert.equal(r.eventoAtual.id, e.eventoAtual.cartas[i]);
    }
  }
  assert.ok(posicoes.size >= 4, 'as seis ordens possíveis tendem a aparecer');
});

test('evento: passar segue para o próximo jogador sem efeito algum', () => {
  const e = reduzir(naCasaDeEvento(), { tipo: 'RECUSAR' });
  assert.equal(e.fase, 'ROLAR_DADO');
  assert.equal(e.eventoAtual, null);
  assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL);
  assert.equal(e.jogadores[0].reputacao, REPUTACAO_INICIAL);
});

test('evento: seguir sem decidir vale como passar, mas com as cartas na mesa é preciso escolher', () => {
  const oferta = naCasaDeEvento();
  const passou = reduzir(oferta, { tipo: 'CONTINUAR' });
  assert.equal(passou.fase, 'ROLAR_DADO');
  assert.equal(passou.jogadores[0].dinheiro, DINHEIRO_INICIAL);
  const naMesa = reduzir(oferta, { tipo: 'PARTICIPAR' });
  assert.deepEqual(reduzir(naMesa, { tipo: 'CONTINUAR' }), naMesa);
  assert.deepEqual(reduzir(naMesa, { tipo: 'RECUSAR' }), naMesa, 'não dá para desistir depois de participar');
  const trocando = reduzir(naMesa, { tipo: 'ESCOLHER_CARTA', valor: 0 });
  assert.deepEqual(reduzir(trocando, { tipo: 'CONTINUAR' }), trocando, 'é preciso manter ou trocar');
  assert.deepEqual(reduzir(trocando, { tipo: 'RECUSAR' }), trocando);
});

test('evento: ações fora de hora ou inválidas são ignoradas', () => {
  const oferta = naCasaDeEvento();
  for (const valor of [-1, 3, 1.5, 'x', undefined]) {
    assert.deepEqual(reduzir(oferta, { tipo: 'ESCOLHER_CARTA', valor }), oferta, 'sem participar não há carta a escolher');
    const naMesa = reduzir(oferta, { tipo: 'PARTICIPAR' });
    assert.deepEqual(reduzir(naMesa, { tipo: 'ESCOLHER_CARTA', valor }), naMesa, `valor ${valor}`);
  }
  for (const acao of ['MANTER', 'TROCAR']) {
    assert.deepEqual(reduzir(oferta, { tipo: acao }), oferta, `${acao} sem a carta escolhida`);
    const naMesa = reduzir(oferta, { tipo: 'PARTICIPAR' });
    assert.deepEqual(reduzir(naMesa, { tipo: acao }), naMesa, `${acao} sem a carta escolhida`);
  }
  const trocando = reduzir(reduzir(oferta, { tipo: 'PARTICIPAR' }), { tipo: 'ESCOLHER_CARTA', valor: 0 });
  assert.deepEqual(reduzir(trocando, { tipo: 'ESCOLHER_CARTA', valor: 1 }), trocando, 'a escolha já foi feita');
  assert.deepEqual(reduzir(trocando, { tipo: 'PARTICIPAR' }), trocando);
  const feito = reduzir(trocando, { tipo: 'MANTER' });
  for (const acao of [{ tipo: 'ESCOLHER_CARTA', valor: 1 }, { tipo: 'MANTER' }, { tipo: 'TROCAR' }, { tipo: 'PARTICIPAR' }, { tipo: 'RECUSAR' }]) {
    assert.deepEqual(reduzir(feito, acao), feito, `${acao.tipo} depois de decidir`);
  }
});

test('evento: o rival do solo passa sem participar e sem gastar sorteios', () => {
  const solo = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Rival', nivel: 'iniciante', bot: 'medio' }], seed: 5, teste: { casa: 'evento' } });
  solo.jogadorAtual = 1;
  const antes = solo.baralhoEventos.length;
  const e = reduzir(solo, { tipo: 'ROLAR' });
  assert.equal(e.fase, 'MOSTRAR_EVENTO');
  assert.equal(e.eventoAtual.decisao, 'recusou');
  assert.equal(e.eventoAtual.cartas, null);
  assert.equal(e.baralhoEventos.length, antes, 'o baralho não foi mexido');
  assert.equal(e.jogadores[1].dinheiro, DINHEIRO_INICIAL);
  assert.match(viewJogo(e), /O rival passou pelo Evento/);
  assert.equal(reduzir(e, { tipo: 'CONTINUAR' }).fase, 'ROLAR_DADO');
});

test('evento: cada tipo tem seu baralho, que não repete carta dentro do ciclo', () => {
  let e = novoJogo({ jogadores: jogadores('iniciante'), seed: 9, teste: { casa: 'evento' } });
  const vistas = { boa: [], ruim: [], troll: [] };
  for (let i = 0; i < eventosDoTipo('troll').length; i++) {
    const oferta = reduzir(e, { tipo: 'ROLAR' });
    for (const id of oferta.eventoAtual.cartas) vistas[EVENTOS.find((c) => c.id === id).tipo].push(id);
    e = reduzir(oferta, { tipo: 'RECUSAR' });
  }
  for (const tipo of TIPOS_CARTA) assert.equal(new Set(vistas[tipo]).size, vistas[tipo].length, `${tipo} sem repetição no ciclo`);
  assert.equal(vistas.troll.length, eventosDoTipo('troll').length);
  assert.deepEqual(new Set(vistas.troll), new Set(eventosDoTipo('troll').map((c) => c.id)), 'o ciclo das trolls passa por todas');
});

test('evento: um save antigo, com o baralho misturado de cartas já vistas, continua a sacar por tipo', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), seed: 5, teste: { casa: 'evento' } });
  e.baralhoEventos = ['eixo_truncado', 'sobrevivencia', 'correlacao'];
  const r = reduzir(e, { tipo: 'ROLAR' });
  assert.ok(r.eventoAtual.cartas.includes('eixo_truncado') && r.eventoAtual.cartas.includes('sobrevivencia'));
  assert.ok(!r.baralhoEventos.includes('eixo_truncado') && !r.baralhoEventos.includes('sobrevivencia'));
  assert.ok(r.baralhoEventos.includes('correlacao'), 'a carta ruim que não saiu continua no baralho');
});

test('evento: um save em MOSTRAR_EVENTO do formato antigo (efeito já aplicado) mostra a carta e continua', () => {
  const e = novoJogo({ jogadores: jogadores('iniciante'), seed: 5 });
  e.fase = 'MOSTRAR_EVENTO';
  e.eventoAtual = { id: 'eixo_truncado', crise: false, dinheiro: -8000 };
  const html = viewJogo(e);
  assert.match(html, /O gráfico que enganou/);
  assert.match(html, /Lição:/);
  assert.equal(reduzir(e, { tipo: 'CONTINUAR' }).fase, 'ROLAR_DADO');
});

// ---------- troca de carta, como no problema de Monty Hall (fisher.md 3.15) ----------

const tipoDe = (e, i) => EVENTOS.find((c) => c.id === e.eventoAtual.cartas[i]).tipo;
const escolhendo = (seed, extra = {}) => reduzir(naCasaDeEvento({ seed, ...extra }), { tipo: 'PARTICIPAR' });

test('Monty Hall: a carta revelada nunca é a boa nem a escolhida, e nada é aplicado antes de decidir', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (let i = 0; i < 3; i++) {
      const e = reduzir(escolhendo(seed), { tipo: 'ESCOLHER_CARTA', valor: i });
      const { revelada, primeira } = e.eventoAtual;
      assert.notEqual(revelada, primeira, 'não revela a carta escolhida');
      assert.notEqual(tipoDe(e, revelada), 'boa', 'a revelada nunca é a boa');
      assert.equal(e.jogadores[0].dinheiro, DINHEIRO_INICIAL);
      assert.equal(e.jogadores[0].reputacao, REPUTACAO_INICIAL);
    }
  }
});

test('Monty Hall: quem escolheu uma carta ruim ou troll vê a outra delas revelada (não há alternativa)', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const base = escolhendo(seed);
    for (let i = 0; i < 3; i++) {
      if (tipoDe(base, i) === 'boa') continue;
      const e = reduzir(base, { tipo: 'ESCOLHER_CARTA', valor: i });
      const outraNaoBoa = [0, 1, 2].find((j) => j !== i && tipoDe(base, j) !== 'boa');
      assert.equal(e.eventoAtual.revelada, outraNaoBoa);
    }
  }
});

test('Monty Hall: quem escolheu a boa vê qualquer uma das duas outras revelada, e o sorteio usa o rng da partida', () => {
  const reveladas = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const base = escolhendo(seed);
    const i = [0, 1, 2].find((j) => tipoDe(base, j) === 'boa');
    const e = reduzir(base, { tipo: 'ESCOLHER_CARTA', valor: i });
    reveladas.add(tipoDe(e, e.eventoAtual.revelada));
    assert.notDeepEqual(e.rng, base.rng, 'sorteou com o rng da partida');
    assert.deepEqual(reduzir(base, { tipo: 'ESCOLHER_CARTA', valor: i }), e, 'determinístico pela seed');
  }
  assert.deepEqual([...reveladas].sort(), ['ruim', 'troll']);
});

test('Monty Hall: trocar leva à carta que sobrou, e manter, à primeira escolha', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (let i = 0; i < 3; i++) {
      const e = reduzir(escolhendo(seed), { tipo: 'ESCOLHER_CARTA', valor: i });
      const { primeira, revelada } = e.eventoAtual;
      const sobrou = [0, 1, 2].find((j) => j !== primeira && j !== revelada);
      const trocou = reduzir(e, { tipo: 'TROCAR' }).eventoAtual;
      assert.equal(trocou.escolhida, sobrou);
      assert.equal(trocou.trocou, true);
      assert.equal(trocou.id, e.eventoAtual.cartas[sobrou]);
      assert.equal(trocou.decisao, 'participou');
      const manteve = reduzir(e, { tipo: 'MANTER' }).eventoAtual;
      assert.equal(manteve.escolhida, primeira);
      assert.equal(manteve.trocou, false);
    }
  }
});

test('Monty Hall: o efeito aplicado é o da carta final, nos dois modos', () => {
  for (const modo of ['competitivo', 'cooperativo']) {
    const e = reduzir(escolhendo(4, { modo }), { tipo: 'ESCOLHER_CARTA', valor: 0 });
    const r = reduzir(e, { tipo: 'TROCAR' });
    const carta = EVENTOS.find((c) => c.id === r.eventoAtual.id);
    const carteira = modo === 'cooperativo' ? r.empresa : r.jogadores[0];
    assert.equal(carteira.dinheiro, DINHEIRO_INICIAL + r.eventoAtual.dinheiro);
    assert.equal(carteira.reputacao, REPUTACAO_INICIAL + carta.reputacao);
  }
});

test('Monty Hall: quem troca sempre fica com a carta boa em cerca de 2 de cada 3 vezes, e quem mantém em 1 de 3', () => {
  let trocaBoa = 0;
  let mantemBoa = 0;
  const n = 600;
  for (let seed = 1; seed <= n; seed++) {
    const e = reduzir(escolhendo(seed), { tipo: 'ESCOLHER_CARTA', valor: seed % 3 });
    if (tipoDe(e, reduzir(e, { tipo: 'TROCAR' }).eventoAtual.escolhida) === 'boa') trocaBoa++;
    if (tipoDe(e, e.eventoAtual.primeira) === 'boa') mantemBoa++;
  }
  assert.ok(Math.abs(trocaBoa / n - 2 / 3) < 0.07, `trocar: ${trocaBoa / n}`);
  assert.ok(Math.abs(mantemBoa / n - 1 / 3) < 0.07, `manter: ${mantemBoa / n}`);
  assert.equal(trocaBoa + mantemBoa, n, 'a boa é sempre a primeira escolha ou a que sobra');
});
