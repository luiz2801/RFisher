// Trilha expandida de 28 casas no perímetro de uma grade 8x8.
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

// Trilha desenhada no perímetro de uma grade 8x8 (28 células).
export function coordenadas(i, tamanhoGrade = 8) {
  const N = tamanhoGrade;
  if (i < N) return { linha: 1, coluna: i + 1 };
  if (i < 2 * N - 2) return { linha: i - (N - 2), coluna: N };
  if (i < 3 * N - 2) return { linha: N, coluna: 3 * N - 2 - i };
  return { linha: 4 * N - 3 - i, coluna: 1 };
}
