export const soma = (v) => v.reduce((s, x) => s + x, 0);
export const media = (v) => soma(v) / v.length;

export function mediana(v) {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export function contagens(v) {
  const c = new Map();
  for (const x of v) c.set(x, (c.get(x) ?? 0) + 1);
  return c;
}

// Em empate, vence o menor valor (resultado determinístico).
export function moda(v) {
  let melhor = null;
  let qtd = 0;
  for (const [x, n] of contagens(v)) {
    if (n > qtd || (n === qtd && x < melhor)) {
      melhor = x;
      qtd = n;
    }
  }
  return melhor;
}

// Interpolação linear entre postos (mesmo método do NumPy).
export function percentil(v, p) {
  const o = [...v].sort((a, b) => a - b);
  const pos = (p / 100) * (o.length - 1);
  const i = Math.floor(pos);
  const frac = pos - i;
  return i + 1 < o.length ? o[i] + frac * (o[i + 1] - o[i]) : o[i];
}

// Desvio padrão amostral (n - 1).
export function desvioPadrao(v) {
  const m = media(v);
  return Math.sqrt(soma(v.map((x) => (x - m) ** 2)) / (v.length - 1));
}

export function resumo(v) {
  const min = Math.min(...v);
  const max = Math.max(...v);
  return {
    media: media(v),
    mediana: mediana(v),
    moda: moda(v),
    p90: percentil(v, 90),
    dp: desvioPadrao(v),
    maximo: max,
    minimo: min,
    ponto_medio: (min + max) / 2,
  };
}
