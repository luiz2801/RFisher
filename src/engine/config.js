// Números de partida. Todos são pontos de partida, a calibrar no playtest.
export const DINHEIRO_INICIAL = 100000;
export const REPUTACAO_INICIAL = 50;
export const RECEITA_BALANCO = 20000;
export const CUSTOS_BALANCO = 8000;
export const MULTA_CRISE = 10000;
export const REPUTACAO_POS_CRISE = 20;
export const TURNOS_PADRAO = 10;
export const MAX_JOGADORES = 3;

// Modo cooperativo (docs/modo-cooperativo.md). Valores a calibrar por simulação.
export const MODOS = ['competitivo', 'cooperativo'];
export const META_CRESCIMENTO_POR_JOGADOR = 2000; // aumento do caixa mínimo a cada trimestre, por jogador
export const BONUS_INVESTIDOR = 10000;
export const BONUS_INVESTIDOR_REPUTACAO = 3;
export const CORTE_ORCAMENTO = 8000;
export const CORTE_ORCAMENTO_REPUTACAO = 5;
export const REDUCAO_PREJUIZO_PASSIVA = 0.3; // fração do prejuízo de eventos do setor da diretoria
export const REPUTACAO_BALANCO_RH = 2;

// Dificuldade crescente: cenários têm dificuldade de 1 a DIFICULDADE_MAX e o sorteio favorece
// a que corresponde ao progresso do jogador na trilha (docs/criar-cenarios.md).
export const DIFICULDADE_MAX = 3;
export const PASSO_MEDIO_DADO = 3.5; // casas por jogada, para estimar o percurso total da partida
export const SELETIVIDADE_DIFICULDADE = 4; // peso do cenário = 1 / (1 + k × distância²) até a dificuldade-alvo
