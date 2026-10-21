import { criarRng } from './rng.js';
import { DINHEIRO_INICIAL, REPUTACAO_INICIAL, TURNOS_PADRAO } from './config.js';
import { atribuirPapeis } from './papeis.js';

export function novoJogo({ jogadores, turnos = TURNOS_PADRAO, seed = Date.now(), modo = 'competitivo' }) {
  const semente = seed >>> 0;
  const cooperativo = modo === 'cooperativo';
  const papeis = atribuirPapeis(jogadores.length);
  return {
    versao: 1,
    modo: cooperativo ? 'cooperativo' : 'competitivo',
    empresa: cooperativo ? { dinheiro: DINHEIRO_INICIAL, reputacao: REPUTACAO_INICIAL } : null,
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
      papeis: cooperativo ? papeis[id] : [],
      merito: 0,
      habilidadeUsos: 0,
    })),
    baralhoCenarios: [],
    baralhoEventos: [],
    cenarioAtual: null,
    eventoAtual: null,
    resultado: null,
  };
}

export const jogadorAtual = (e) => e.jogadores[e.jogadorAtual];

// Saves antigos não têm `modo`: eram sempre competitivos.
export const ehCooperativo = (e) => e.modo === 'cooperativo';

// Quem recebe dinheiro e reputação: a empresa (cooperativo) ou o jogador da vez.
export const carteira = (e) => (ehCooperativo(e) ? e.empresa : jogadorAtual(e));

// Mais dinheiro vence; a reputação desempata.
export function classificacao(e) {
  return [...e.jogadores].sort((a, b) => b.dinheiro - a.dinheiro || b.reputacao - a.reputacao);
}

export function vencedores(e) {
  const [primeiro, ...resto] = classificacao(e);
  return [primeiro, ...resto.filter((j) => j.dinheiro === primeiro.dinheiro && j.reputacao === primeiro.reputacao)];
}

// Faixas do fim de jogo cooperativo, da melhor para a pior. A primeira que a empresa atinge vale.
export const FAIXAS_EMPRESA = [
  { id: 'lider', nome: 'Líder de mercado', caixa: 1.75 * DINHEIRO_INICIAL, reputacao: 75 },
  { id: 'crescimento', nome: 'Crescimento', caixa: 1.25 * DINHEIRO_INICIAL, reputacao: 60 },
  { id: 'sobrevivencia', nome: 'Sobrevivência', caixa: 0.5 * DINHEIRO_INICIAL, reputacao: 0 },
  { id: 'falencia', nome: 'Falência', caixa: -Infinity, reputacao: 0 },
];

export function classificarEmpresa({ dinheiro, reputacao }) {
  return FAIXAS_EMPRESA.find((f) => dinheiro >= f.caixa && reputacao >= f.reputacao);
}
