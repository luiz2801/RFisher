import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo, jogadorAtual, ehBot } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { valorEsperado, ehCalculo } from '../src/engine/calculo.js';
import { obterCenario, todosCenarios } from '../src/scenarios/loader.js';
import { substituirPorBot } from '../src/net/sala.js';
import { avancarBot, avancarBotsAteUmaPessoa } from '../src/net/piloto.js';

const CALCULO = todosCenarios().filter(ehCalculo).map((c) => c.id);
const DIRS = ['operacoes', 'tecnologia', 'pessoas_financas'];

const jogo = ({ n = 2, modo = 'competitivo', seed = 1, teste = null } = {}) =>
  novoJogo({
    jogadores: Array.from({ length: n }, (_, i) => ({ nome: `P${i + 1}`, nivel: 'iniciante', diretoria: DIRS[i] })),
    turnos: 3, modo, seed, teste,
  });

// A pessoa acerta tudo e participa de todo evento (passando por 'escolhendo' e 'trocando').
function acaoHumana(e) {
  const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
  const ev = e.eventoAtual;
  if (e.fase === 'MOSTRAR_EVENTO' && ev?.cartas) {
    if (ev.decisao === null) return { tipo: 'PARTICIPAR' };
    if (ev.decisao === 'escolhendo') return { tipo: 'ESCOLHER_CARTA', valor: 0 };
    if (ev.decisao === 'trocando') return { tipo: 'TROCAR' };
  }
  return ({
    ROLAR_DADO: { tipo: 'ROLAR' },
    ESCOLHER_METRICA: def && { tipo: 'METRICA', valor: def.opcoes.find((o) => o.correta).id },
    INFORMAR_VALOR: def && { tipo: 'VALOR', valor: valorEsperado(def, e.cenarioAtual) },
    ESCOLHER_JUSTIFICATIVA: def && { tipo: 'JUSTIFICATIVA', valor: def.justificativas.find((j) => j.tipo === 'correta').id },
    ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'certeza' },
  })[e.fase] ?? { tipo: 'CONTINUAR' };
}

// Um passo da partida: o bot joga se for a vez dele; senão a pessoa joga.
function passo(e) {
  const bot = avancarBot(e);
  return bot ?? reduzir(e, acaoHumana(e));
}

function jogarAteOFim(e, limite = 4000) {
  for (let i = 0; i < limite && e.fase !== 'FIM_DE_JOGO'; i++) {
    const novo = passo(e);
    assert.notEqual(novo, e, `a partida travou na fase ${e.fase} (jogador ${e.jogadorAtual})`);
    e = novo;
  }
  assert.equal(e.fase, 'FIM_DE_JOGO', 'a partida não terminou');
  return e;
}

test('avancarBot só age na vez de um bot', () => {
  const e = jogo();
  assert.equal(avancarBot(e), null, 'vez de uma pessoa');
  assert.equal(avancarBot(null), null);
  assert.equal(avancarBot({ ...substituirPorBot(e, 0), fase: 'FIM_DE_JOGO' }), null);
  assert.equal(avancarBot({ ...substituirPorBot(e, 0), fase: 'FASE_INEXISTENTE' }), null);
});

test('avancarBot: um bot sozinho joga uma partida inteira (todos viram bot no início)', () => {
  let e = jogo({ n: 3, modo: 'cooperativo', seed: 4 });
  for (let i = 0; i < 3; i++) e = substituirPorBot(e, i);
  e = avancarBotsAteUmaPessoa(e);
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.equal(e.jogadores.every(ehBot), true);
});

test('avancarBotsAteUmaPessoa para na vez de uma pessoa', () => {
  let e = substituirPorBot(jogo({ n: 2, seed: 2 }), 0);
  e = avancarBotsAteUmaPessoa(e);
  assert.equal(ehBot(jogadorAtual(e)), false);
  assert.equal(e.jogadorAtual, 1);
  assert.equal(avancarBotsAteUmaPessoa(e), e);
});

// Cada variante força um tipo de casa para o jogo passar muitas vezes por ela.
const VARIANTES = [
  ['normal', null],
  ['cálculo', { casa: 'decisao', cenarios: CALCULO }],
  ['decisão', { casa: 'decisao', cenarios: null }],
  ['evento', { casa: 'evento', cenarios: null }],
  ['mercado', { casa: 'mercado', cenarios: null }],
  ['balanço', { casa: 'balanco', cenarios: null }],
];

test('propriedade: derrubar uma pessoa em qualquer passo nunca trava a partida (todas as fases)', () => {
  const vistas = new Set();
  let partidas = 0;
  for (const [, teste] of VARIANTES) {
    for (const modo of ['competitivo', 'cooperativo']) {
      for (const n of [2, 3]) {
        for (const seed of [1, 2]) {
          const base = jogo({ n, modo, seed, teste });
          // Quantos passos tem a partida sem ninguém cair, para derrubar em cada um.
          let total = 0;
          for (let e = base; e.fase !== 'FIM_DE_JOGO'; e = passo(e)) total += 1;
          for (let k = 0; k < total; k++) {
            let e = base;
            for (let i = 0; i < k; i++) e = passo(e);
            if (e.fase === 'FIM_DE_JOGO') continue;
            const caiu = jogadorAtual(e);
            if (ehBot(caiu)) continue;
            const fase = e.fase === 'MOSTRAR_EVENTO' ? `${e.fase}/${e.eventoAtual?.decisao}` : e.fase;
            vistas.add(fase);
            const fim = jogarAteOFim(substituirPorBot(e, caiu.id));
            assert.equal(fim.fase, 'FIM_DE_JOGO');
            partidas += 1;
          }
        }
      }
    }
  }
  const esperadas = [
    'ROLAR_DADO', 'ESCOLHER_METRICA', 'INFORMAR_VALOR', 'ESCOLHER_JUSTIFICATIVA', 'ESCOLHER_CONFIANCA', 'MOSTRAR_RESULTADO',
    'MOSTRAR_MERCADO', 'MOSTRAR_BALANCO', 'MOSTRAR_EVENTO/null', 'MOSTRAR_EVENTO/escolhendo', 'MOSTRAR_EVENTO/trocando', 'MOSTRAR_EVENTO/participou',
  ];
  for (const f of esperadas) assert.ok(vistas.has(f), `a queda não foi testada na fase ${f}`);
  assert.ok(partidas > 500, `poucas partidas simuladas: ${partidas}`);
});

test('queda de várias pessoas em passos diferentes também termina', () => {
  for (const modo of ['competitivo', 'cooperativo']) {
    let e = jogo({ n: 3, modo, seed: 9 });
    for (let i = 0; i < 40; i++) e = passo(e);
    e = substituirPorBot(e, 1);
    for (let i = 0; i < 15 && e.fase !== 'FIM_DE_JOGO'; i++) e = passo(e);
    if (e.fase !== 'FIM_DE_JOGO') e = substituirPorBot(e, jogadorAtual(e).id);
    for (let i = 0; i < 15 && e.fase !== 'FIM_DE_JOGO'; i++) e = passo(e);
    if (e.fase !== 'FIM_DE_JOGO') e = substituirPorBot(e, e.jogadores.find((j) => !ehBot(j)).id);
    assert.equal(jogarAteOFim(e).fase, 'FIM_DE_JOGO');
  }
});

test('a queda não gasta sorteios do RNG: a partida segue reproduzível pela seed', () => {
  const e = jogo({ seed: 11 });
  assert.deepEqual(substituirPorBot(e, 0).rng, e.rng);
  assert.deepEqual(substituirPorBot(e, 0).baralhoCenarios, e.baralhoCenarios);
});
