import { media, mediana, moda, percentil, desvioPadrao, contagens } from '../stats/metrics.js';

// Cada gerador devolve { series: [{ nome, valores }] } e tem um invariante:
// se o sorteio não preservar a resposta correta, `gerar` sorteia de novo.

const arredondar = (v, passo) => Math.round(v / passo) * passo;
const casas = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

function padronizado(n, alvoMedia, alvoDp, rng, nCasas) {
  const z = Array.from({ length: n }, () => rng.normal());
  const m = media(z);
  const s = desvioPadrao(z);
  return z.map((v) => casas(alvoMedia + ((v - m) / s) * alvoDp, nCasas));
}

const GERADORES = {
  assimetria_direita: {
    gerar(p, rng) {
      const qtdOutliers = p.outliers.reduce((s, o) => s + o.qtd, 0);
      const valores = [];
      for (let i = 0; i < p.n - qtdOutliers; i++) {
        valores.push(arredondar(p.base * (1 + rng.entre(-p.ruido, p.ruido)), 100));
      }
      for (const o of p.outliers) {
        for (let q = 0; q < o.qtd; q++) valores.push(arredondar(o.valor * rng.entre(0.9, 1.1), 1000));
      }
      return { series: [{ nome: 'Salários', valores: rng.embaralhar(valores) }] };
    },
    invariante([v]) {
      const med = mediana(v);
      return media(v) > med * 1.5 && Math.max(...v) > med * 10;
    },
  },

  cauda_longa: {
    gerar(p, rng) {
      const nCauda = Math.round(p.n * p.proporcaoCauda);
      const valores = [];
      for (let i = 0; i < p.n - nCauda; i++) valores.push(Math.max(0.5, casas(rng.normal(p.base, p.ruido), 1)));
      for (let i = 0; i < nCauda; i++) valores.push(casas(rng.entre(p.caudaMin, p.caudaMax), 1));
      return { series: [{ nome: 'Tempo de entrega', valores: rng.embaralhar(valores) }] };
    },
    invariante([v]) {
      return percentil(v, 90) > 3 * media(v);
    },
  },

  categorico_discreto: {
    gerar(p, rng) {
      const deslocamento = rng.inteiro(0, 3);
      const total = p.pesos.reduce((s, w) => s + w, 0);
      const valores = [];
      for (let i = 0; i < p.n; i++) {
        let r = rng.prox() * total;
        let idx = 0;
        while (idx < p.pesos.length - 1 && r >= p.pesos[idx]) r -= p.pesos[idx++];
        valores.push(p.tamanhoMin + deslocamento + idx);
      }
      return { series: [{ nome: 'Numeração vendida', valores }] };
    },
    invariante([v]) {
      const freq = [...contagens(v).values()].sort((a, b) => b - a);
      const m = media(v);
      return freq[0] >= freq[1] + 3 && moda(v) !== mediana(v) && Math.abs(m - Math.round(m)) > 0.1;
    },
  },

  mesma_media_variancia_distinta: {
    gerar(p, rng) {
      const dpA = rng.entre(p.dpA[0], p.dpA[1]);
      const dpB = rng.entre(p.dpB[0], p.dpB[1]);
      return {
        series: [
          { nome: p.nomes[0], valores: padronizado(p.n, p.media, dpA, rng, 2) },
          { nome: p.nomes[1], valores: padronizado(p.n, p.media, dpB, rng, 2) },
        ],
      };
    },
    invariante([a, b]) {
      return Math.abs(media(a) - media(b)) < 0.01 && desvioPadrao(b) > 5 * desvioPadrao(a);
    },
  },
};

export function tiposDeGerador() {
  return Object.keys(GERADORES);
}

export function verificarInvariante(gerador, series) {
  return GERADORES[gerador.tipo].invariante(series.map((s) => s.valores));
}

export function gerar(gerador, rng) {
  const g = GERADORES[gerador.tipo];
  if (!g) throw new Error(`Gerador desconhecido: ${gerador.tipo}`);
  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const r = g.gerar(gerador.parametros, rng);
    if (verificarInvariante(gerador, r.series)) return r;
  }
  throw new Error(`Gerador ${gerador.tipo} não satisfez o invariante em 200 tentativas`);
}
