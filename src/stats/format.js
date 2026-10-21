const nf = (min, max) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

export function formatar(tipo, v) {
  switch (tipo) {
    case 'brl':
      return 'R$ ' + nf(0, 0).format(Math.round(v));
    case 'dias':
      return nf(1, 1).format(v) + ' dias';
    case 'minutos':
      return nf(1, 1).format(v) + ' min';
    case 'gramas':
      return nf(1, 1).format(v) + ' g';
    case 'porcento':
      return nf(1, 1).format(v) + '%';
    case 'mm':
      return nf(2, 2).format(v) + ' mm';
    default:
      return nf(0, 1).format(v);
  }
}

export const brl = (v) => (v < 0 ? '−' : '') + formatar('brl', Math.abs(v));
export const brlSinal = (v) => (v > 0 ? '+' : '') + brl(v);
