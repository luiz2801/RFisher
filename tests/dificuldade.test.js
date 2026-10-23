import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { novoJogo, progressoDoJogador } from '../src/engine/state.js';
import { dificuldadeAlvo, pesoDificuldade, escolherPorDificuldade } from '../src/engine/dificuldade.js';
import { reduzir } from '../src/engine/machine.js';
import { valorEsperado } from '../src/engine/calculo.js';
import { todosCenarios, obterCenario, validarCenario } from '../src/scenarios/loader.js';
import { DIFICULDADE_MAX, PROGRESSOES, PROGRESSAO_PADRAO } from '../src/engine/config.js';

test('a dificuldade-alvo vai de 1 a DIFICULDADE_MAX com o progresso', () => {
  assert.equal(dificuldadeAlvo(0), 1);
  assert.equal(dificuldadeAlvo(1), DIFICULDADE_MAX);
  assert.equal(dificuldadeAlvo(5), DIFICULDADE_MAX);
  assert.equal(dificuldadeAlvo(-1), 1);
  assert.ok(dificuldadeAlvo(0.5) < 2, 'a subida é lenta no começo');
});

test('o peso é máximo na dificuldade-alvo e nunca zera', () => {
  assert.equal(pesoDificuldade(1, 0), 1);
  assert.ok(pesoDificuldade(1, 0) > pesoDificuldade(2, 0));
  assert.ok(pesoDificuldade(2, 0) > pesoDificuldade(3, 0));
  assert.ok(pesoDificuldade(3, 0) > 0);
  assert.ok(pesoDificuldade(3, 1) > pesoDificuldade(1, 1));
});

test('o sorteio por dificuldade favorece o cenário próximo do progresso', () => {
  const candidatos = [{ id: 'f', dificuldade: 1 }, { id: 'd', dificuldade: 3 }];
  const rng = criarRng(1);
  const contar = (progresso) => {
    let faceis = 0;
    for (let i = 0; i < 2000; i++) if (escolherPorDificuldade(candidatos, progresso, rng) === 'f') faceis++;
    return faceis;
  };
  assert.ok(contar(0) > 1800);
  assert.ok(contar(1) < 200);
});

test('todo cenário declara dificuldade válida e há cenários em todos os níveis', () => {
  const niveis = new Set(todosCenarios().map((c) => c.dificuldade));
  for (let d = 1; d <= DIFICULDADE_MAX; d++) assert.ok(niveis.has(d), `sem cenário de dificuldade ${d}`);
  const ruim = structuredClone(todosCenarios()[0]);
  ruim.dificuldade = DIFICULDADE_MAX + 1;
  assert.equal(validarCenario(ruim, criarRng(1)).length, 1);
  delete ruim.dificuldade;
  assert.equal(validarCenario(ruim, criarRng(1)).length, 1);
});

test('o progresso usa as casas percorridas, contando as voltas, e satura em 1', () => {
  const e = novoJogo({ jogadores: [{ nome: 'A', nivel: 'iniciante' }], turnos: 10, seed: 1 });
  const j = e.jogadores[0];
  assert.equal(progressoDoJogador(e, j), 0);
  j.distancia = 35;
  assert.equal(progressoDoJogador(e, j), 0.5);
  j.distancia = 500;
  assert.equal(progressoDoJogador(e, j), 1);
  delete j.distancia; // save antigo: vale a posição
  j.posicao = 7;
  assert.equal(progressoDoJogador(e, j), 7 / 70);
});

// Responde qualquer fase com uma ação válida (primeira opção, primeira justificativa, chute).
function passo(e) {
  const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
  const acao = {
    ROLAR_DADO: () => ({ tipo: 'ROLAR' }),
    ESCOLHER_METRICA: () => ({ tipo: 'METRICA', valor: def.opcoes[0].id }),
    INFORMAR_VALOR: () => ({ tipo: 'VALOR', valor: valorEsperado(def, e.cenarioAtual) }),
    ESCOLHER_JUSTIFICATIVA: () => ({ tipo: 'JUSTIFICATIVA', valor: def.justificativas[0].id }),
    ESCOLHER_CONFIANCA: () => ({ tipo: 'CONFIANCA', valor: 'chute' }),
  }[e.fase]?.() ?? { tipo: 'CONTINUAR' };
  return reduzir(e, acao);
}

// Ids dos cenários na ordem em que foram sorteados.
function cenariosSorteados(seed, turnos = 10) {
  let e = novoJogo({ jogadores: [{ nome: 'A', nivel: 'iniciante' }], turnos, seed });
  const ids = [];
  while (e.fase !== 'FIM_DE_JOGO') {
    const antes = e.fase;
    e = passo(e);
    if (antes === 'ROLAR_DADO' && e.fase === 'ESCOLHER_METRICA') ids.push(e.cenarioAtual.id);
  }
  return ids;
}

test('ao longo da partida os cenários sorteados ficam mais difíceis', () => {
  const media = (l) => l.reduce((a, b) => a + b, 0) / l.length;
  let inicio = 0;
  let fim = 0;
  let partidas = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = cenariosSorteados(seed).map((id) => obterCenario(id).dificuldade);
    if (s.length < 2) continue;
    const metade = Math.floor(s.length / 2);
    inicio += media(s.slice(0, metade));
    fim += media(s.slice(metade));
    partidas++;
  }
  assert.ok(partidas > 100);
  assert.ok(fim / partidas > inicio / partidas + 0.3, `início ${inicio / partidas}, fim ${fim / partidas}`);
});

test('o baralho de cenários não repete carta dentro de um ciclo', () => {
  const total = todosCenarios().length;
  for (let seed = 1; seed <= 30; seed++) {
    const ciclo = cenariosSorteados(seed, 40).slice(0, total);
    assert.equal(new Set(ciclo).size, ciclo.length);
  }
});

test('a progressão escolhida muda o ritmo da dificuldade-alvo, sem mudar os extremos', () => {
  assert.ok(dificuldadeAlvo(0.5, 'facil') < dificuldadeAlvo(0.5, 'tradicional'));
  assert.ok(dificuldadeAlvo(0.5, 'tradicional') < dificuldadeAlvo(0.5, 'dificil'));
  assert.equal(dificuldadeAlvo(0.5, 'dificil'), 2);
  for (const id of Object.keys(PROGRESSOES)) {
    assert.equal(dificuldadeAlvo(0, id), 1);
    assert.equal(dificuldadeAlvo(1, id), DIFICULDADE_MAX);
  }
  // Progressão ausente ou desconhecida (save antigo) vale a tradicional.
  assert.equal(dificuldadeAlvo(0.5), dificuldadeAlvo(0.5, PROGRESSAO_PADRAO));
  assert.equal(dificuldadeAlvo(0.5, 'inexistente'), dificuldadeAlvo(0.5, PROGRESSAO_PADRAO));
});

test('novoJogo guarda a progressão e cai na tradicional se ela for inválida', () => {
  const base = { jogadores: [{ nome: 'A', nivel: 'iniciante' }], seed: 1 };
  assert.equal(novoJogo(base).progressao, PROGRESSAO_PADRAO);
  assert.equal(novoJogo({ ...base, progressao: 'dificil' }).progressao, 'dificil');
  assert.equal(novoJogo({ ...base, progressao: 'xyz' }).progressao, PROGRESSAO_PADRAO);
  assert.equal(novoJogo({ ...base, progressao: null }).progressao, PROGRESSAO_PADRAO);
});

test('na progressão acelerada os cenários sorteados são mais difíceis que na gradual', () => {
  const media = (progressao) => {
    let soma = 0;
    let n = 0;
    for (let seed = 1; seed <= 100; seed++) {
      let e = novoJogo({ jogadores: [{ nome: 'A', nivel: 'iniciante' }], turnos: 10, seed, progressao });
      while (e.fase !== 'FIM_DE_JOGO') {
        const antes = e.fase;
        e = passo(e);
        if (antes === 'ROLAR_DADO' && e.fase === 'ESCOLHER_METRICA') { soma += obterCenario(e.cenarioAtual.id).dificuldade; n++; }
      }
    }
    return soma / n;
  };
  assert.ok(media('dificil') > media('facil') + 0.15);
});
