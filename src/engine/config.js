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

// Modo solo: rival controlado pelo computador (fisher.md 3.11). `acerto` é a chance de acertar a métrica
// e, de forma independente, a justificativa num cenário de dificuldade 1. Calibrado com scripts/simular-bot.mjs
// para que um jogador de acerto 0,6 vença 70%, 50% e 30% das partidas de 10 turnos.
export const PERFIS_BOT = {
  facil: { nome: 'Estagiário(a)', acerto: 0.48 },
  medio: { nome: 'Analista', acerto: 0.6 },
  dificil: { nome: 'Sênior', acerto: 0.7 },
};
export const BOT_QUEDA_POR_DIFICULDADE = 0.08; // acerto a menos por nível de dificuldade acima de 1
export const BOT_ACERTO_MIN = 0.05;
export const BOT_ACERTO_MAX = 0.98;
export const BOT_SINAL_CONFIANCA = 0.1; // quanto cada acerto (ou erro) desloca a certeza interna do bot
export const BOT_RUIDO_CONFIANCA = 0.15; // desvio padrão do ruído na certeza interna
export const BOT_LIMIARES_CONFIANCA = [0.3, 0.45, 0.6, 0.75]; // certeza interna -> chute | dúvida | provável | confiante | certeza

// Dificuldade crescente: cenários têm dificuldade de 1 a DIFICULDADE_MAX e o sorteio favorece
// a que corresponde ao progresso do jogador na trilha (docs/criar-cenarios.md).
export const DIFICULDADE_MAX = 3;
export const PASSO_MEDIO_DADO = 7; // casas por jogada (soma de 2d6), para estimar o percurso total da partida
export const SELETIVIDADE_DIFICULDADE = 4; // peso do cenário = 1 / (1 + k × distância²) até a dificuldade-alvo
