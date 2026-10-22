import { MARGEM_CALCULO_PISO } from './config.js';
import { soma, media, mediana, moda, percentil, desvioPadrao } from '../stats/metrics.js';

// Cenários de cálculo (fisher.md 4.7): além de escolher a métrica, a pessoa calcula o valor a partir
// dos dados e o informa. O valor vale se cair dentro de uma margem do valor exato da métrica escolhida.

export const ehCalculo = (def) => def?.tipo === 'calculo';

export const margemPct = (def, opcao) => opcao.margem_pct ?? def.calculo.margem_pct;

// Avalia o valor informado contra a métrica escolhida (`opcao.chave` aponta para `num`).
export function avaliarCalculo(def, opcao, num, informado) {
  const esperado = num[opcao.chave];
  const pct = margemPct(def, opcao);
  const tolerancia = Math.max((Math.abs(esperado) * pct) / 100, MARGEM_CALCULO_PISO);
  return {
    chave: opcao.chave,
    informado,
    esperado,
    margemPct: pct,
    minimo: esperado - tolerancia,
    maximo: esperado + tolerancia,
    dentro: Number.isFinite(informado) && Math.abs(informado - esperado) <= tolerancia + 1e-9,
  };
}

// Valor exato da métrica que a pessoa (ou o rival) escolheu na decisão em andamento
// (undefined enquanto não há métrica escolhida ou se o cenário não for de cálculo).
export const valorEsperado = (def, c) => c.num[def.opcoes.find((o) => o.id === c.metricaId)?.chave];

// Convenções de cálculo que mudam o resultado: avisadas na hora de informar o valor.
const NOTA_PERCENTIL =
  'Percentis e quartis pelo método linear (o mesmo de PERCENTIL.INC e QUARTIL.INC nas planilhas): posição = p × (n − 1) + 1 na lista ordenada, interpolando quando não for inteira.';
const NOTAS_METODO = {
  p25: NOTA_PERCENTIL,
  p75: NOTA_PERCENTIL,
  p90: NOTA_PERCENTIL,
  p95: NOTA_PERCENTIL,
  iqr: NOTA_PERCENTIL,
  dp: 'Desvio padrão amostral: divisor n − 1.',
};
export const notaDeMetodo = (chave) => NOTAS_METODO[chave] ?? null;

// Calculadora embutida (fisher.md 4.7): faz uma operação estatística sobre os dados do cenário, como a
// planilha faria. Não pontua nem entra no estado da partida; usa as mesmas convenções da conferência
// (percentil linear, desvio e variância amostrais).
export const OPERACOES_CALCULADORA = [
  { id: 'n', rotulo: 'Quantidade de registros (n)', calcular: (v) => v.length },
  { id: 'soma', rotulo: 'Soma', calcular: soma },
  { id: 'media', rotulo: 'Média', calcular: media },
  { id: 'mediana', rotulo: 'Mediana', calcular: mediana },
  { id: 'moda', rotulo: 'Moda', calcular: moda },
  { id: 'minimo', rotulo: 'Mínimo', calcular: (v) => Math.min(...v) },
  { id: 'maximo', rotulo: 'Máximo', calcular: (v) => Math.max(...v) },
  { id: 'amplitude', rotulo: 'Amplitude (máximo − mínimo)', calcular: (v) => Math.max(...v) - Math.min(...v) },
  { id: 'q1', rotulo: '1º quartil (Q1)', calcular: (v) => percentil(v, 25) },
  { id: 'q3', rotulo: '3º quartil (Q3)', calcular: (v) => percentil(v, 75) },
  { id: 'percentil', rotulo: 'Percentil (informe o P)', pedeP: true, calcular: (v, p) => percentil(v, p) },
  { id: 'variancia', rotulo: 'Variância amostral (n − 1)', calcular: (v) => desvioPadrao(v) ** 2 },
  { id: 'dp', rotulo: 'Desvio padrão amostral (n − 1)', calcular: desvioPadrao },
];

// Devolve o número, ou null se a operação não existir, não houver dados ou o P estiver fora de 0 a 100
// (o desvio e a variância precisam de pelo menos 2 registros).
export function calcularOperacao(valores, id, p) {
  const op = OPERACOES_CALCULADORA.find((o) => o.id === id);
  if (!op || valores.length === 0) return null;
  if (op.pedeP && !(p >= 0 && p <= 100)) return null;
  if ((id === 'dp' || id === 'variancia') && valores.length < 2) return null;
  const r = op.calcular(valores, p);
  return Number.isFinite(r) ? r : null;
}

// Número em pt-BR com até 4 casas, sem arredondar para a unidade do cenário (quem calcula decide
// quanto arredondar ao informar o valor).
export const formatarResultadoCalculadora = (r) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(r);
