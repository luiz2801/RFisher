// Simula partidas do modo solo para calibrar o rival (fisher.md 3.11).
// O "jogador de referência" e o rival são dirigidos pela mesma decidirBot, cada um com seu perfil
// e seu rng, então só a taxa de acerto os distingue.
// Uso: node scripts/simular-bot.mjs [--partidas 2000] [--turnos 10] [--referencia 0.6] [--calibrar]
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { decidirBot } from '../src/engine/bot.js';
import { criarRng } from '../src/engine/rng.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { PERFIS_BOT, TURNOS_PADRAO } from '../src/engine/config.js';

// Taxa de vitória do jogador de referência contra cada perfil do rival.
export const ALVOS = { facil: 0.7, medio: 0.5, dificil: 0.3 };
export const ACERTO_REFERENCIA = 0.6;

// Uma partida entre dois perfis { acerto }. Devolve o estado final.
export function simularPartida({ perfis, seed, turnos = TURNOS_PADRAO, nivel = 'iniciante' }) {
  let e = novoJogo({ jogadores: perfis.map((_, i) => ({ nome: `P${i}`, nivel })), turnos, seed });
  const rngs = perfis.map((_, i) => criarRng((seed ^ (0x9e3779b9 * (i + 1))) >>> 0));
  let escolha = null;
  for (let passo = 0; e.fase !== 'FIM_DE_JOGO'; passo++) {
    if (passo > 10000) throw new Error(`partida ${seed} não terminou`);
    let acao;
    if (e.fase === 'ROLAR_DADO') acao = { tipo: 'ROLAR' };
    else if (e.fase === 'ESCOLHER_METRICA') {
      escolha = decidirBot(obterCenario(e.cenarioAtual.id), perfis[e.jogadorAtual], rngs[e.jogadorAtual]);
      acao = { tipo: 'METRICA', valor: escolha.metrica };
    } else if (e.fase === 'ESCOLHER_JUSTIFICATIVA') acao = { tipo: 'JUSTIFICATIVA', valor: escolha.justificativa };
    else if (e.fase === 'ESCOLHER_CONFIANCA') acao = { tipo: 'CONFIANCA', valor: escolha.confianca };
    else acao = { tipo: 'CONTINUAR' };
    e = reduzir(e, acao);
  }
  return e;
}

// Referência (jogador 0) contra o rival (jogador 1), em `partidas` seeds seguidas.
export function avaliar({ acertoRival, acertoReferencia = ACERTO_REFERENCIA, partidas = 1000, turnos, seedInicial = 1 }) {
  let vitorias = 0;
  let empates = 0;
  const diferencas = [];
  for (let s = seedInicial; s < seedInicial + partidas; s++) {
    const [ref, rival] = simularPartida({ perfis: [{ acerto: acertoReferencia }, { acerto: acertoRival }], seed: s, turnos }).jogadores;
    const d = ref.dinheiro - rival.dinheiro || ref.reputacao - rival.reputacao;
    if (d > 0) vitorias++;
    else if (d === 0) empates++;
    diferencas.push(ref.dinheiro - rival.dinheiro);
  }
  const media = diferencas.reduce((a, b) => a + b, 0) / partidas;
  const dp = Math.sqrt(diferencas.reduce((a, b) => a + (b - media) ** 2, 0) / (partidas - 1));
  return { taxaVitoria: (vitorias + empates / 2) / partidas, diferencaMedia: media, dpDiferenca: dp };
}

// Bisseção: acerto do rival que dá ao jogador de referência a taxa de vitória `alvo`.
export function calibrar({ alvo, partidas, turnos, acertoReferencia, iteracoes = 10 }) {
  let [baixo, alto] = [0.05, 0.98];
  for (let i = 0; i < iteracoes; i++) {
    const meio = (baixo + alto) / 2;
    // Mais acerto do rival, menos vitórias da referência.
    if (avaliar({ acertoRival: meio, acertoReferencia, partidas, turnos }).taxaVitoria > alvo) baixo = meio;
    else alto = meio;
  }
  return (baixo + alto) / 2;
}

function principal() {
  const { values } = parseArgs({
    options: {
      partidas: { type: 'string', default: '2000' },
      turnos: { type: 'string', default: String(TURNOS_PADRAO) },
      referencia: { type: 'string', default: String(ACERTO_REFERENCIA) },
      calibrar: { type: 'boolean', default: false },
    },
  });
  const partidas = Number(values.partidas);
  const turnos = Number(values.turnos);
  const acertoReferencia = Number(values.referencia);
  const pct = (x) => `${(100 * x).toFixed(1)}%`;
  const reais = (x) => `R$ ${Math.round(x).toLocaleString('pt-BR')}`;

  console.log(`Referência com acerto ${acertoReferencia}, ${partidas} partidas de ${turnos} turnos.\n`);
  for (const [id, perfil] of Object.entries(PERFIS_BOT)) {
    const r = avaliar({ acertoRival: perfil.acerto, acertoReferencia, partidas, turnos });
    console.log(
      `${id.padEnd(8)} acerto ${perfil.acerto.toFixed(2)}  referência vence ${pct(r.taxaVitoria)} (alvo ${pct(ALVOS[id])})` +
        `  diferença média ${reais(r.diferencaMedia)} ± ${reais(r.dpDiferenca)}`,
    );
  }
  if (!values.calibrar) return;
  console.log('\nCalibração (bisseção no acerto do rival):');
  for (const [id, alvo] of Object.entries(ALVOS)) {
    console.log(`${id.padEnd(8)} acerto ≈ ${calibrar({ alvo, partidas, turnos, acertoReferencia }).toFixed(3)} para ${pct(alvo)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
