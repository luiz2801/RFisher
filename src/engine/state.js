import { criarRng } from './rng.js';
import { DINHEIRO_INICIAL, REPUTACAO_INICIAL, TURNOS_PADRAO } from './config.js';

export function novoJogo({ jogadores, turnos = TURNOS_PADRAO, seed = Date.now() }) {
  const semente = seed >>> 0;
  return {
    versao: 1,
    seed: semente,
    rng: criarRng(semente).estado,
    turnoAtual: 1,
    turnosPorJogador: turnos,
    jogadorAtual: 0,
    fase: 'ROLAR_DADO',
    dado: null,
    balanco: null,
    jogadores: jogadores.map((j, id) => ({
      id,
      nome: j.nome,
      nivel: j.nivel,
      dinheiro: DINHEIRO_INICIAL,
      reputacao: REPUTACAO_INICIAL,
      posicao: 0,
      historico: [],
    })),
    baralhoCenarios: [],
    baralhoEventos: [],
    cenarioAtual: null,
    eventoAtual: null,
    resultado: null,
  };
}

export const jogadorAtual = (e) => e.jogadores[e.jogadorAtual];

// Mais dinheiro vence; a reputação desempata.
export function classificacao(e) {
  return [...e.jogadores].sort((a, b) => b.dinheiro - a.dinheiro || b.reputacao - a.reputacao);
}

export function vencedores(e) {
  const [primeiro, ...resto] = classificacao(e);
  return [primeiro, ...resto.filter((j) => j.dinheiro === primeiro.dinheiro && j.reputacao === primeiro.reputacao)];
}
