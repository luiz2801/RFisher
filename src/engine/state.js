import { criarRng } from './rng.js';
import {
  DINHEIRO_INICIAL, REPUTACAO_INICIAL, TURNOS_PADRAO, TURNOS_MIN, TURNOS_MAX, DINHEIRO_INICIAL_MIN, DINHEIRO_INICIAL_MAX,
  PASSO_MEDIO_DADO, PERFIS_BOT,
} from './config.js';
import { atribuirPapeis, DIRETORIAS } from './papeis.js';

// Inteiro dentro de [min, max]; valor que não é número cai no padrão.
const limitar = (valor, min, max, padrao) => (Number.isFinite(valor) ? Math.min(max, Math.max(min, Math.round(valor))) : padrao);

// `turnos` (1 a 64) e `dinheiroInicial` (o caixa de cada jogador, ou da empresa no cooperativo) vêm do menu e são limitados aqui.
// `teste` (opcional) só serve para depurar: `{ casa, cenarios }` força a casa em que o peão cai e restringe o baralho.
export function novoJogo({ jogadores, turnos = TURNOS_PADRAO, dinheiroInicial = DINHEIRO_INICIAL, seed = Date.now(), modo = 'competitivo', teste = null, soConceitual = false }) {
  const semente = seed >>> 0;
  const cooperativo = modo === 'cooperativo';
  const caixaInicial = limitar(dinheiroInicial, DINHEIRO_INICIAL_MIN, DINHEIRO_INICIAL_MAX, DINHEIRO_INICIAL);
  const papeis = atribuirPapeis(jogadores.length, jogadores.map((j) => j.diretoria));
  return {
    versao: 1,
    modo: cooperativo ? 'cooperativo' : 'competitivo',
    empresa: cooperativo ? { dinheiro: caixaInicial, reputacao: REPUTACAO_INICIAL } : null,
    seed: semente,
    rng: criarRng(semente).estado,
    turnoAtual: 1,
    turnosPorJogador: limitar(turnos, TURNOS_MIN, TURNOS_MAX, TURNOS_PADRAO),
    dinheiroInicial: caixaInicial,
    jogadorAtual: 0,
    falencia: false,
    fase: 'ROLAR_DADO',
    dado: null,
    dados: null,
    balanco: null,
    jogadores: jogadores.map((j, id) => ({
      id,
      nome: j.nome,
      nivel: j.nivel,
      dinheiro: caixaInicial,
      reputacao: REPUTACAO_INICIAL,
      posicao: 0,
      distancia: 0,
      historico: [],
      falido: false,
      negativado: false,
      // Perfil do rival controlado pelo computador (modo solo), ou null para uma pessoa.
      bot: Object.hasOwn(PERFIS_BOT, j.bot ?? '') ? j.bot : null,
      // Setor (diretoria) escolhido no menu. No competitivo é só o cargo; no cooperativo vale `papeis`. Ausente em saves antigos.
      diretoria: Object.hasOwn(DIRETORIAS, j.diretoria ?? '') ? j.diretoria : null,
      papeis: cooperativo ? papeis[id] : [],
      merito: 0,
      habilidadeUsos: 0,
    })),
    // Sem papel, lápis ou planilha: o baralho exclui os cenários de cálculo. Ausente em saves antigos (vale `false`).
    soConceitual: Boolean(soConceitual),
    baralhoCenarios: [],
    baralhoEventos: [],
    cenarioAtual: null,
    eventoAtual: null,
    resultado: null,
    // Atalhos de teste do menu; ausente em saves antigos e em partidas normais (vale `null`).
    teste: teste && (teste.casa || teste.cenarios?.length) ? { casa: teste.casa ?? null, cenarios: teste.cenarios?.length ? teste.cenarios : null } : null,
  };
}

// Saves antigos não têm `dinheiroInicial`: valia o padrão.
export const dinheiroInicialDe = (e) => e.dinheiroInicial ?? DINHEIRO_INICIAL;

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

// Falência (fisher.md 3.12): caixa negativo ao fim de uma jogada que passou pelo Balanço. No competitivo e no solo o jogador sai da disputa
// (`falido`); no cooperativo a empresa quebra e a partida acaba (`falencia`). Saves antigos não têm nenhum dos dois.
export const ehFalido = (j) => j?.falido === true;
export const empresaFalida = (e) => e.falencia === true;

// Quem ainda disputa a partida.
export const jogadoresAtivos = (e) => e.jogadores.filter((j) => !ehFalido(j));

// Veredito da falência na jogada de Balanço do jogador da vez (competitivo e solo, fisher.md 3.12).
// Concorrem à falência quem passou pelo Balanço negativado (`negativado`, mais o jogador da vez) e ainda está
// com o caixa abaixo de zero; perde o de menor saldo (a reputação desempata). Se há alguém negativo, com saldo
// pior, que ainda não passou pelo Balanço, o veredito espera por ele (`aguardando`). Não altera o estado.
export function julgarBalanco(e) {
  const atual = jogadorAtual(e);
  const negativos = jogadoresAtivos(e).filter((j) => j.dinheiro < 0);
  const candidatos = negativos.filter((j) => j === atual || j.negativado === true);
  if (!candidatos.length) return { perdedor: null, aguardando: [] };
  const perdedor = candidatos.reduce((pior, j) => (j.dinheiro - pior.dinheiro || j.reputacao - pior.reputacao) < 0 ? j : pior);
  const aguardando = negativos.filter((j) => !candidatos.includes(j) && j.dinheiro < perdedor.dinheiro);
  return aguardando.length ? { perdedor: null, aguardando } : { perdedor, aguardando };
}

// Quem não faliu vem antes; depois, mais dinheiro vence e a reputação desempata.
export function classificacao(e) {
  return [...e.jogadores].sort(
    (a, b) => ehFalido(a) - ehFalido(b) || b.dinheiro - a.dinheiro || b.reputacao - a.reputacao,
  );
}

// Quem faliu perde automaticamente: se todos faliram, não há vencedor.
export function vencedores(e) {
  const [primeiro, ...resto] = classificacao(e);
  if (ehFalido(primeiro)) return [];
  return [primeiro, ...resto.filter((j) => !ehFalido(j) && j.dinheiro === primeiro.dinheiro && j.reputacao === primeiro.reputacao)];
}

// Faixas do fim de jogo cooperativo, da melhor para a pior. A primeira que a empresa atinge vale.
// `multiplo` é o caixa exigido em múltiplos do caixa inicial da partida.
export const FAIXAS_EMPRESA = [
  { id: 'lider', nome: 'Líder de mercado', multiplo: 1.75, reputacao: 75 },
  { id: 'crescimento', nome: 'Crescimento', multiplo: 1.25, reputacao: 60 },
  { id: 'sobrevivencia', nome: 'Sobrevivência', multiplo: 0.5, reputacao: 0 },
  { id: 'falencia', nome: 'Falência', multiplo: -Infinity, reputacao: 0 },
];

export function classificarEmpresa({ dinheiro, reputacao }, caixaInicial = DINHEIRO_INICIAL) {
  return FAIXAS_EMPRESA.find((f) => dinheiro >= f.multiplo * caixaInicial && reputacao >= f.reputacao);
}
