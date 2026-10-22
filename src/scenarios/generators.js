import { soma, media, mediaAparada, mediana, moda, percentil, desvioPadrao, contagens } from '../stats/metrics.js';

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

function sortearComPesos(n, pesos, primeiro, rng) {
  const total = pesos.reduce((s, w) => s + w, 0);
  return Array.from({ length: n }, () => {
    let r = rng.prox() * total;
    let idx = 0;
    while (idx < pesos.length - 1 && r >= pesos[idx]) r -= pesos[idx++];
    return primeiro + idx;
  });
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

  bimodal_polarizado: {
    gerar(p, rng) {
      const valores = [];
      const totalPesos = p.pesos.reduce((s, w) => s + w, 0);
      for (let i = 0; i < p.n; i++) {
        let r = rng.prox() * totalPesos;
        let nota = 1;
        while (nota < p.pesos.length && r >= p.pesos[nota - 1]) {
          r -= p.pesos[nota - 1];
          nota++;
        }
        valores.push(nota);
      }
      return { series: [{ nome: 'Avaliações', valores }] };
    },
    invariante([v]) {
      const c = contagens(v);
      const n1 = c.get(1) ?? 0;
      const n5 = c.get(5) ?? 0;
      const n3 = c.get(3) ?? 0;
      const m = media(v);
      return n1 >= 10 && n5 >= 10 && (n1 + n5) / v.length >= 0.55 && n3 < n1 && n3 < n5 && m >= 2.2 && m <= 3.8;
    },
  },

  dispersao_outliers: {
    gerar(p, rng) {
      const nOutliers = p.outliers.length;
      const valores = [];
      for (let i = 0; i < p.n - nOutliers; i++) {
        valores.push(casas(rng.entre(p.baseMin, p.baseMax), 1));
      }
      for (const o of p.outliers) {
        valores.push(casas(o * rng.entre(0.9, 1.1), 1));
      }
      return { series: [{ nome: 'Tempo de suporte', valores: rng.embaralhar(valores) }] };
    },
    invariante([v]) {
      const q1 = percentil(v, 25);
      const q3 = percentil(v, 75);
      const iqr = q3 - q1;
      return desvioPadrao(v) > 3 * iqr && mediana(v) <= 25 && iqr > 0;
    },
  },

  // Sino simétrico. Com `outliers` ([{valor, qtd}], opcional), acrescenta nas pontas valores sem critério
  // (notas 0 e 10 dadas sem ler a pergunta); a média aparada os descarta e volta ao centro do sino.
  distribuicao_normal_simetrica: {
    gerar(p, rng) {
      const extras = (p.outliers ?? []).flatMap((o) => Array(o.qtd).fill(o.valor));
      const base = padronizado(p.n - extras.length, p.media, p.dp, rng, 1);
      return { series: [{ nome: p.outliers ? 'Notas' : 'Pesagem', valores: extras.length ? rng.embaralhar([...base, ...extras]) : base }] };
    },
    invariante([v], p) {
      if (!p.outliers) return Math.abs(media(v) - mediana(v)) < 0.15 * p.dp && Math.abs(media(v) - p.media) < 0.2 * p.dp;
      const [piso, teto] = [Math.min(...p.outliers.map((o) => o.valor)), Math.max(...p.outliers.map((o) => o.valor))];
      const miolo = v.filter((x) => x > piso && x < teto);
      return v.length - miolo.length === p.outliers.reduce((s, o) => s + o.qtd, 0) && Math.abs(mediaAparada(v) - p.media) < 0.2 * p.dp;
    },
  },

  comparacao_amostral: {
    gerar(p, rng) {
      const sA = padronizado(p.nA, p.mediaA, p.dpA, rng, 1);
      const sB = padronizado(p.nB, p.mediaB, p.dpB, rng, 1);
      return {
        series: [
          { nome: p.nomes[0], valores: sA },
          { nome: p.nomes[1], valores: sB },
        ],
      };
    },
    invariante([a, b]) {
      return desvioPadrao(b) > 4 * desvioPadrao(a) && media(b) > media(a);
    },
  },

  // Restrição física: todos precisam caber, então só o máximo serve. O maior valor
  // fica bem acima do P95 para que "quase todos" deixe alguém de fora.
  limite_fisico: {
    gerar(p, rng) {
      return { series: [{ nome: 'Medições', valores: padronizado(p.n, p.media, p.dp, rng, 0) }] };
    },
    invariante([v]) {
      const dp = desvioPadrao(v);
      const max = Math.max(...v);
      return max - percentil(v, 95) >= 0.25 * dp && max > media(v) + 1.5 * dp;
    },
  },

  // Espelho de assimetria_direita: poucos valores muito baixos puxam a média para baixo.
  assimetria_esquerda: {
    gerar(p, rng) {
      const qtdOutliers = p.outliers.reduce((s, o) => s + o.qtd, 0);
      const valores = [];
      for (let i = 0; i < p.n - qtdOutliers; i++) {
        valores.push(casas(p.base + rng.entre(-p.ruido, p.ruido), 1));
      }
      for (const o of p.outliers) {
        for (let q = 0; q < o.qtd; q++) valores.push(casas(o.valor * rng.entre(0.8, 1.2), 1));
      }
      return { series: [{ nome: 'Taxa por pessoa', valores: rng.embaralhar(valores) }] };
    },
    invariante([v]) {
      const med = mediana(v);
      return med - media(v) > 0.06 * med && Math.min(...v) < 0.5 * med;
    },
  },

  // Maioria de zeros (não pagantes): mediana e moda são 0, mas a média não.
  inflado_em_zero: {
    gerar(p, rng) {
      const nZeros = Math.round(p.n * p.proporcaoZero);
      const valores = Array(nZeros).fill(0);
      for (let i = nZeros; i < p.n; i++) valores.push(Math.round(rng.entre(p.valorMin, p.valorMax)));
      return { series: [{ nome: 'Gasto por usuário', valores: rng.embaralhar(valores) }] };
    },
    invariante([v]) {
      const zeros = v.filter((x) => x === 0).length;
      return mediana(v) === 0 && zeros / v.length >= 0.55 && media(v) > 0.1 * Math.max(...v);
    },
  },

  // Poucas medições (para calcular à mão): o ponto é o cálculo, não a forma dos dados.
  // O invariante garante valores positivos e um desvio padrão próximo do pedido, com amplitude bem maior que ele.
  amostra_pequena: {
    gerar(p, rng) {
      return { series: [{ nome: 'Medições', valores: padronizado(p.n, p.media, p.dp, rng, p.casas ?? 0) }] };
    },
    invariante([v], p) {
      const dp = desvioPadrao(v);
      return Math.min(...v) > 0 && Math.abs(dp - p.dp) <= 0.1 * p.dp && Math.max(...v) - Math.min(...v) > 1.8 * dp;
    },
  },

  // Contagens inteiras com cauda à direita (0, 1, 2, ...): moda e mediana ficam abaixo da média,
  // e o P90 bem acima dela. Projetar um total pede a média.
  contagens_assimetricas: {
    gerar(p, rng) {
      return { series: [{ nome: 'Contagens', valores: sortearComPesos(p.n, p.pesos, 0, rng) }] };
    },
    invariante([v]) {
      const m = media(v);
      return m - mediana(v) >= 0.2 && Math.abs(m - moda(v)) >= 0.5 && percentil(v, 90) > 1.5 * m;
    },
  },

  // Paradoxo de Simpson: a conversão sobe no Desktop (6% → 7%) e no Mobile (2% → 2,5%), mas a geral cai
  // (4% → 3%) porque o tráfego migra para o Mobile (50% → 8/9 das visitas). As taxas são fixas; o sorteio muda
  // só o volume de visitas. Séries: taxas antes e depois (Desktop, Mobile, Geral, em %) e visitas (Desktop, Mobile).
  paradoxo_simpson: {
    gerar(p, rng) {
      const metade = rng.inteiro(p.metadeAntesMin, p.metadeAntesMax) * 1000;
      const nono = rng.inteiro(p.nonoDepoisMin, p.nonoDepoisMax) * 1000;
      const antes = [metade, metade];
      const depois = [nono, 8 * nono];
      const conv = (visitas, taxas) => visitas.map((vis, i) => vis * taxas[i] / 100);
      const taxa = (visitas, taxas) => casas((100 * soma(conv(visitas, taxas))) / soma(visitas), 1);
      return {
        series: [
          { nome: 'Conversão antes (%)', valores: [...p.taxasAntes, taxa(antes, p.taxasAntes)] },
          { nome: 'Conversão depois (%)', valores: [...p.taxasDepois, taxa(depois, p.taxasDepois)] },
          { nome: 'Visitas antes', valores: antes },
          { nome: 'Visitas depois', valores: depois },
        ],
      };
    },
    invariante([antes, depois, visAntes, visDepois]) {
      const sobe = depois[0] > antes[0] && depois[1] > antes[1];
      const geralCai = depois[2] < antes[2];
      const migrou = visDepois[1] / soma(visDepois) > visAntes[1] / soma(visAntes);
      return sobe && geralCai && migrou && antes[1] < antes[0] && depois[1] < depois[0];
    },
  },
};

export function tiposDeGerador() {
  return Object.keys(GERADORES);
}

export function verificarInvariante(gerador, series) {
  return GERADORES[gerador.tipo].invariante(series.map((s) => s.valores), gerador.parametros);
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
