import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { novoJogo, jogadorAtual, ehBot } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { decidirBot, acertoEfetivo, confiancaDaCerteza } from '../src/engine/bot.js';
import { CONFIANCA } from '../src/engine/scoring.js';
import { PERFIS_BOT, BOT_ACERTO_MIN, BOT_ACERTO_MAX } from '../src/engine/config.js';
import { obterCenario, todosCenarios } from '../src/scenarios/loader.js';
import { viewJogo, viewMenu } from '../src/ui/views.js';
import { avaliar, simularPartida } from '../scripts/simular-bot.mjs';

const jogoSolo = (perfil = 'medio', seed = 7) =>
  novoJogo({
    jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Rival', nivel: 'iniciante', bot: perfil }],
    turnos: 6,
    seed,
  });

// A pessoa acerta tudo; na vez do rival, só DECIDIR_BOT avança a decisão (como o main.js faz).
function proximaAcao(e) {
  const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
  if (e.fase === 'ESCOLHER_METRICA' && ehBot(jogadorAtual(e))) return { tipo: 'DECIDIR_BOT' };
  return (
    {
      ROLAR_DADO: { tipo: 'ROLAR' },
      ESCOLHER_METRICA: def && { tipo: 'METRICA', valor: def.opcoes.find((o) => o.correta).id },
      ESCOLHER_JUSTIFICATIVA: def && { tipo: 'JUSTIFICATIVA', valor: def.justificativas.find((j) => j.tipo === 'correta').id },
      ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'certeza' },
    }[e.fase] ?? { tipo: 'CONTINUAR' }
  );
}

function jogarAteOFim(e, aCadaPasso = (x) => x) {
  for (let i = 0; i < 2000 && e.fase !== 'FIM_DE_JOGO'; i++) e = aCadaPasso(reduzir(e, proximaAcao(e)));
  assert.equal(e.fase, 'FIM_DE_JOGO');
  return e;
}

test('decidirBot devolve ids existentes e uma confiança válida, de forma reproduzível', () => {
  for (const def of todosCenarios()) {
    for (const perfil of Object.values(PERFIS_BOT)) {
      const a = decidirBot(def, perfil, criarRng(42));
      assert.deepEqual(decidirBot(def, perfil, criarRng(42)), a);
      assert.ok(def.opcoes.some((o) => o.id === a.metrica), `${def.id}: métrica inexistente`);
      assert.ok(def.justificativas.some((x) => x.id === a.justificativa), `${def.id}: justificativa inexistente`);
      assert.ok(Object.hasOwn(CONFIANCA, a.confianca));
    }
  }
});

test('a taxa de acerto do bot segue o perfil e cai com a dificuldade', () => {
  const rng = criarRng(2024);
  for (const def of todosCenarios()) {
    const perfil = PERFIS_BOT.medio;
    const p = acertoEfetivo(perfil, def.dificuldade);
    let metricas = 0;
    let justificativas = 0;
    const n = 1500;
    for (let i = 0; i < n; i++) {
      const d = decidirBot(def, perfil, rng);
      if (def.opcoes.find((o) => o.id === d.metrica).correta) metricas++;
      if (def.justificativas.find((x) => x.id === d.justificativa).tipo === 'correta') justificativas++;
    }
    assert.ok(Math.abs(metricas / n - p) < 0.04, `${def.id}: métrica ${metricas / n} vs ${p}`);
    assert.ok(Math.abs(justificativas / n - p) < 0.04, `${def.id}: justificativa ${justificativas / n} vs ${p}`);
  }
  assert.ok(acertoEfetivo({ acerto: 0.6 }, 3) < acertoEfetivo({ acerto: 0.6 }, 1));
  assert.equal(acertoEfetivo({ acerto: 0 }, 3), BOT_ACERTO_MIN);
  assert.equal(acertoEfetivo({ acerto: 1 }, 1), BOT_ACERTO_MAX);
});

test('a confiança do bot cresce com a certeza interna e com o perfil', () => {
  assert.equal(confiancaDaCerteza(-1), 'chute');
  assert.equal(confiancaDaCerteza(2), 'certeza');
  const media = (perfil) => {
    const rng = criarRng(5);
    const def = obterCenario('cenario_01_salarios');
    let soma = 0;
    for (let i = 0; i < 2000; i++) soma += CONFIANCA[decidirBot(def, perfil, rng).confianca];
    return soma / 2000;
  };
  assert.ok(media(PERFIS_BOT.facil) < media(PERFIS_BOT.medio));
  assert.ok(media(PERFIS_BOT.medio) < media(PERFIS_BOT.dificil));
});

test('novoJogo só aceita perfis de bot conhecidos', () => {
  const e = novoJogo({
    jogadores: [{ nome: 'A', nivel: 'iniciante' }, { nome: 'B', nivel: 'iniciante', bot: 'impossivel' }, { nome: 'C', nivel: 'iniciante', bot: 'dificil' }],
    seed: 1,
  });
  assert.deepEqual(e.jogadores.map((j) => j.bot), [null, null, 'dificil']);
});

test('na vez do rival só DECIDIR_BOT resolve a decisão; na vez da pessoa, DECIDIR_BOT é ignorado', () => {
  let e = jogoSolo();
  let vistoRival = false;
  let vistoPessoa = false;
  for (let i = 0; i < 2000 && e.fase !== 'FIM_DE_JOGO' && !(vistoRival && vistoPessoa); i++) {
    if (e.fase === 'ESCOLHER_METRICA') {
      const def = obterCenario(e.cenarioAtual.id);
      if (ehBot(jogadorAtual(e))) {
        vistoRival = true;
        assert.deepEqual(reduzir(e, { tipo: 'METRICA', valor: def.opcoes[0].id }), e);
        const depois = reduzir(e, { tipo: 'DECIDIR_BOT' });
        assert.equal(depois.fase, 'MOSTRAR_RESULTADO');
        assert.equal(depois.jogadores[1].historico.length, e.jogadores[1].historico.length + 1);
        assert.notEqual(depois.rng, e.rng, 'o bot consome o rng da partida');
      } else {
        vistoPessoa = true;
        assert.deepEqual(reduzir(e, { tipo: 'DECIDIR_BOT' }), e);
      }
    }
    e = reduzir(e, proximaAcao(e));
  }
  assert.ok(vistoRival && vistoPessoa);
});

test('partida solo vai até o fim e é reproduzível, inclusive com save e recarga a cada ação', () => {
  const referencia = jogarAteOFim(jogoSolo('dificil', 31));
  assert.ok(referencia.jogadores[1].historico.length > 0, 'o rival tomou decisões');
  assert.deepEqual(jogarAteOFim(jogoSolo('dificil', 31), (x) => JSON.parse(JSON.stringify(x))), referencia);
});

test('as telas do modo solo renderizam sem placeholders nem "undefined"', () => {
  assert.match(viewMenu(), /value="solo"/);
  for (const id of Object.keys(PERFIS_BOT)) assert.match(viewMenu(), new RegExp(`value="${id}"`));
  let e = jogoSolo('facil', 3);
  const vistas = new Set();
  for (let i = 0; i < 2000 && e.fase !== 'FIM_DE_JOGO'; i++) {
    const html = viewJogo(e);
    assert.ok(!html.includes('{{') && !html.includes('undefined'), `fase ${e.fase}`);
    if (ehBot(jogadorAtual(e))) vistas.add(e.fase);
    e = reduzir(e, proximaAcao(e));
  }
  assert.ok(!viewJogo(e).includes('undefined'));
  assert.ok(vistas.has('ROLAR_DADO') && vistas.has('MOSTRAR_RESULTADO'));
  assert.ok(vistas.has('ESCOLHER_METRICA'), 'o botão de reserva da vez do rival também renderiza');
});

test('balanceamento: quanto mais difícil o rival, menos o jogador de referência vence', () => {
  const taxa = (id) => avaliar({ acertoRival: PERFIS_BOT[id].acerto, partidas: 200, turnos: 10 }).taxaVitoria;
  const [facil, medio, dificil] = ['facil', 'medio', 'dificil'].map(taxa);
  assert.ok(facil > medio && medio > dificil, `${facil} > ${medio} > ${dificil}`);
  assert.ok(facil > 0.55 && dificil < 0.45, 'os extremos se afastam do empate');
});

test('chutar contra o rival fácil perde quase sempre', () => {
  // Acerto 0,2 é o chute (1 em 5 métricas); o rival fácil já passa do ponto de equilíbrio (~0,38).
  const r = avaliar({ acertoRival: PERFIS_BOT.facil.acerto, acertoReferencia: 0.2, partidas: 150, turnos: 10 });
  assert.ok(r.taxaVitoria < 0.25, `chutador venceu ${r.taxaVitoria}`);
  assert.ok(simularPartida({ perfis: [{ acerto: 1 }, { acerto: 1 }], seed: 9 }).fase === 'FIM_DE_JOGO');
});
