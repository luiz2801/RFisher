// Números de partida. Todos são pontos de partida, a calibrar no playtest.
export const DINHEIRO_INICIAL = 100000;
export const REPUTACAO_INICIAL = 50;
export const RECEITA_BALANCO = 20000;
export const CUSTOS_BALANCO = 8000;
export const MULTA_CRISE = 10000;
export const REPUTACAO_POS_CRISE = 20;
export const TURNOS_PADRAO = 10;
// Limites das escolhas do menu de nova partida (o motor também os aplica).
export const TURNOS_MIN = 1;
export const TURNOS_MAX = 64;
export const DINHEIRO_INICIAL_MIN = 10000;
export const DINHEIRO_INICIAL_MAX = 1000000;
export const DINHEIRO_INICIAL_PASSO = 10000;
export const REPUTACAO_INICIAL_MIN = 10;
export const REPUTACAO_INICIAL_MAX = 100;
export const REPUTACAO_INICIAL_PASSO = 5;
export const MAX_JOGADORES = 3;

// Sequências (fisher.md 3.13): cada sucesso absoluto seguido multiplica o fator da sequência por 1,1 (teto 2) e cada
// erro total seguido por 0,9 (piso 0,5). O fator vale sobre o ganho do sucesso e, invertido, sobre a perda do erro total.
export const SEQUENCIA_FATOR_ACERTO = 1.1;
export const SEQUENCIA_TETO = 2;
export const SEQUENCIA_FATOR_ERRO = 0.9;
export const SEQUENCIA_PISO = 0.5;

// Investimentos do Mercado (fisher.md 3.14). O porte da empresa ofertada depende da reputação de quem cai na casa.
export const FAIXAS_MERCADO = [
  { id: 'micro', min: 0 },
  { id: 'pme', min: 35 },
  { id: 'consolidada', min: 70 },
  { id: 'elite', min: 90 },
];
export const APORTES = [10000, 25000, 50000];
// Relatório da consultoria: libera lucros, retornos e chance exata. Quem investe depois paga a consultoria pelo resultado:
// metade do retorno, se der certo, ou um honorário fixo, se der errado.
export const CONSULTORIA_PENALIDADE = 0.5; // fração do retorno do sucesso cobrada pela consultoria
export const CONSULTORIA_HONORARIO_FRACASSO = 15000; // cobrado a mais quando o investimento dá errado
export const SORTEIO_PROBABILIDADE = 0.04; // a chance de sucesso de cada oferta varia até ±0,04 em torno da do catálogo
export const ANALISE_BONUS_REPUTACAO = 3; // diagnóstico certo do argumento do fundador
export const ANALISE_PENALIDADE_REPUTACAO = 2; // diagnóstico errado

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
// Ritmo da progressão, escolhido no menu: expoente aplicado ao progresso (1 = linear; >1 mantém os cenários
// fáceis por mais tempo e acelera só no fim).
export const PROGRESSOES = {
  facil: { nome: 'Gradual', expoente: 2.6 },
  tradicional: { nome: 'Tradicional', expoente: 2 },
  dificil: { nome: 'Acelerada', expoente: 1 },
};
export const PROGRESSAO_PADRAO = 'tradicional';
export const PASSO_MEDIO_DADO = 7; // casas por jogada (soma de 2d6), para estimar o percurso total da partida
export const SELETIVIDADE_DIFICULDADE = 4; // peso do cenário = 1 / (1 + k × distância²) até a dificuldade-alvo

// Cenários de cálculo (fisher.md 4.7): a margem aceita no valor informado é relativa ao valor exato, com um
// piso absoluto para quando ele é zero. A porcentagem depende só da grandeza do valor exato: 5% abaixo de 100
// (valores em unidades) e 2% a partir de 100 (valores na centena ou mais).
export const MARGEM_CALCULO_PISO = 0.005;
export const MARGEM_CALCULO_LIMITE = 100;
export const MARGEM_CALCULO_UNIDADES_PCT = 5;
export const MARGEM_CALCULO_CENTENAS_PCT = 2;
