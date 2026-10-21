// Trilha de 20 casas. Duelo, Mercado e Auditoria entram na fase 2 do roadmap.
export const CASAS = [
  'balanco', 'decisao', 'decisao', 'evento', 'decisao',
  'decisao', 'evento', 'decisao', 'decisao', 'evento',
  'decisao', 'decisao', 'evento', 'decisao', 'decisao',
  'evento', 'decisao', 'decisao', 'evento', 'decisao',
];
export const NUM_CASAS = CASAS.length;

export const ROTULO_CASA = { balanco: 'Balanço', decisao: 'Decisão', evento: 'Evento' };

export function avancar(posicao, passos) {
  const total = posicao + passos;
  return { posicao: total % NUM_CASAS, passouInicio: total >= NUM_CASAS };
}

// Trilha desenhada no perímetro de uma grade 6x6 (20 células).
export function coordenadas(i) {
  if (i <= 5) return { linha: 1, coluna: i + 1 };
  if (i <= 10) return { linha: i - 4, coluna: 6 };
  if (i <= 15) return { linha: 6, coluna: 16 - i };
  return { linha: 21 - i, coluna: 1 };
}
