import { MARGEM_CALCULO_PISO } from './config.js';

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
