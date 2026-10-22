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
    case 'cm':
      return nf(0, 0).format(v) + ' cm';
    case 'ms':
      return nf(0, 0).format(v) + ' ms';
    case 'seg':
      return nf(0, 1).format(v) + ' s';
    case 'decimal':
      return nf(0, 3).format(v);
    default:
      return nf(0, 1).format(v);
  }
}

export const brl = (v) => (v < 0 ? '−' : '') + formatar('brl', Math.abs(v));
export const brlSinal = (v) => (v > 0 ? '+' : '') + brl(v);

const UNIDADES = { brl: 'R$', dias: 'dias', minutos: 'min', gramas: 'g', porcento: '%', mm: 'mm', cm: 'cm', ms: 'ms', seg: 's' };
export const unidade = (tipo) => UNIDADES[tipo] ?? '';

// Lê o que a pessoa digitou como número em pt-BR ("5.000,50", "5000,5", "2.5", "R$ 3.200", "12 min").
// Ponto isolado entre grupos de três dígitos ("2.500") é separador de milhar; senão, ponto é decimal.
// Devolve NaN se não for um número.
export function lerNumero(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : NaN;
  let t = String(texto ?? '').replace(/\s|R\$|%/g, '').replace(/−/g, '-').replace(/[a-z]+$/i, '');
  if (!/^-?\d[\d.,]*$/.test(t)) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
