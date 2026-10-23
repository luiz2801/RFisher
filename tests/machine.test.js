import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { novoJogo, vencedores } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { valorEsperado, ehCalculo } from '../src/engine/calculo.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { DINHEIRO_INICIAL, DINHEIRO_INICIAL_MIN, DINHEIRO_INICIAL_MAX, TURNOS_PADRAO } from '../src/engine/config.js';
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
  const jogadas = e.jogadores.map((j) => j.historico.length);
  assert.ok(jogadas.every((n) => n <= 5));
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
