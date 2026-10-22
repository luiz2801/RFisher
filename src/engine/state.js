import { criarRng } from './rng.js';
import { DINHEIRO_INICIAL, REPUTACAO_INICIAL, TURNOS_PADRAO, PASSO_MEDIO_DADO, PERFIS_BOT } from './config.js';
import { atribuirPapeis } from './papeis.js';

// `teste` (opcional) só serve para depurar: `{ casa, cenarios }` força a casa em que o peão cai e restringe o baralho.
export function novoJogo({ jogadores, turnos = TURNOS_PADRAO, seed = Date.now(), modo = 'competitivo', teste = null }) {
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
    dados: null,
    balanco: null,
    jogadores: jogadores.map((j, id) => ({
      id,
      nome: j.nome,
      nivel: j.nivel,
      dinheiro: DINHEIRO_INICIAL,
      reputacao: REPUTACAO_INICIAL,
      posicao: 0,
      distancia: 0,
      historico: [],
      // Perfil do rival controlado pelo computador (modo solo), ou null para uma pessoa.
      bot: Object.hasOwn(PERFIS_BOT, j.bot ?? '') ? j.bot : null,
      papeis: cooperativo ? papeis[id] : [],
      merito: 0,
      habilidadeUsos: 0,
    })),
    baralhoCenarios: [],
    baralhoEventos: [],
    cenarioAtual: null,
    eventoAtual: null,
    resultado: null,
    // Atalhos de teste do menu; ausente em saves antigos e em partidas normais (vale `null`).
    teste: teste && (teste.casa || teste.cenarios?.length) ? { casa: teste.casa ?? null, cenarios: teste.cenarios?.length ? teste.cenarios : null } : null,
  };
}

export const jogadorAtual = (e) => e.jogadores[e.jogadorAtual];

// Casas já percorridas, contando as voltas. Saves antigos não têm `distancia`: vale a posição.
export const distanciaPercorrida = (j) => j.distancia ?? j.posicao;

// 0 a 1: quanto do percurso esperado da partida (turnos × passo médio do dado) o jogador já andou.
export const progressoDoJogador = (e, j) =>
  Math.min(1, distanciaPercorrida(j) / (e.turnosPorJogador * PASSO_MEDIO_DADO));

// Saves antigos não têm `modo`: eram sempre competitivos.
export const ehCooperativo = (e) => e.modo === 'cooperativo';

// Saves antigos não têm `bot`: todos eram pessoas.
export const ehBot = (j) => Boolean(j?.bot);

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
