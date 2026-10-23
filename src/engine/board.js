// Trilha expandida de 28 casas no perímetro de uma grade 9x7 (ou 7x9 em tela em pé).
export const CASAS = [
  'balanco', 'decisao', 'decisao', 'evento', 'decisao', 'decisao', 'evento',
  'decisao', 'decisao', 'evento', 'decisao', 'decisao', 'evento', 'decisao',
  'evento', 'decisao', 'decisao', 'evento', 'decisao', 'decisao', 'evento',
  'decisao', 'decisao', 'evento', 'decisao', 'decisao', 'evento', 'decisao',
];
export const NUM_CASAS = CASAS.length;

export const ROTULO_CASA = { balanco: 'Balanço', decisao: 'Decisão', evento: 'Evento' };

export function avancar(posicao, passos) {
  const total = posicao + passos;
  return { posicao: total % NUM_CASAS, passouInicio: total >= NUM_CASAS };
}

// Trilha desenhada no perímetro de uma grade de células quadradas (28 células em 9x7 ou 7x9).
export function coordenadas(i, colunas = 9, linhas = 7) {
  const C = colunas;
  const L = linhas;
  if (i < C) return { linha: 1, coluna: i + 1 };
  if (i < C + L - 2) return { linha: i - C + 2, coluna: C };
  if (i < 2 * C + L - 2) return { linha: L, coluna: 2 * C + L - 2 - i };
  return { linha: 2 * C + 2 * L - 3 - i, coluna: 1 };
}
