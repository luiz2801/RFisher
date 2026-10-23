import { formatar } from '../../stats/format.js';
import { esc } from '../html.js';

const NUM_FAIXAS = 12;

// Agrupa os valores em barras: uma por valor inteiro (discreto) ou faixas iguais (contínuo).
export function calcularBarras(valores, dominio, discreto) {
  if (discreto) {
    const [min, max] = [Math.ceil(dominio[0]), Math.floor(dominio[1])];
    const barras = [];
    for (let v = min; v <= max; v++) {
      barras.push({ de: v - 0.5, ate: v + 0.5, rotulo: String(v), qtd: valores.filter((x) => x === v).length });
    }
    return barras;
  }
  const largura = (dominio[1] - dominio[0]) / NUM_FAIXAS;
  const barras = Array.from({ length: NUM_FAIXAS }, (_, i) => ({
    de: dominio[0] + i * largura,
    ate: dominio[0] + (i + 1) * largura,
    qtd: 0,
  }));
  for (const v of valores) {
    const i = Math.min(NUM_FAIXAS - 1, Math.max(0, Math.floor((v - dominio[0]) / largura)));
    barras[i].qtd++;
  }
  return barras;
}

export function calcularDominio(series, discreto) {
  const todos = series.flatMap((s) => s.valores);
  const [min, max] = [Math.min(...todos), Math.max(...todos)];
  if (discreto) return [min - 0.5, max + 0.5];
  const folga = (max - min) * 0.02 || 1;
  return [min - folga, max + folga];
}

// Marcas "redondas" (passo 1, 2 ou 5 × 10^k) dentro do domínio, para o eixo não exibir valores que os dados não têm
// (como salário negativo ou nota acima de 10), que apareceriam nas pontas do domínio com folga.
export function calcularTicks(dominio, alvo = 5) {
  const [min, max] = dominio;
  const bruto = (max - min) / alvo;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / pot;
  const passo = (f < Math.SQRT2 ? 1 : f < Math.sqrt(10) ? 2 : f < Math.sqrt(50) ? 5 : 10) * pot;
  const ticks = [];
  for (let k = Math.ceil(min / passo - 1e-9); k * passo <= max + passo * 1e-9; k++) ticks.push(Number((k * passo).toPrecision(12)));
  return ticks;
}

const TRACOS = ['', '7 4', '2 4', '10 3 2 3'];

export function grafico({ serie, dominio, discreto, formato, rotuloX, rotuloY, marcadores = [], titulo, descricao }) {
  const W = 560;
  const H = 240;
  const m = { l: 44, r: 28, t: 40, b: 46 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const x = (v) => m.l + ((v - dominio[0]) / (dominio[1] - dominio[0])) * pw;

  const barras = calcularBarras(serie.valores, dominio, discreto);
  const ymax = Math.max(...barras.map((b) => b.qtd), 1);
  const y = (q) => m.t + ph - (q / ymax) * ph;
  const fmt = (v) => formatar(formato, v);

  const rect = barras
    .filter((b) => b.qtd > 0)
    .map(
      (b) =>
        `<rect class="barra" x="${x(b.de) + 1}" y="${y(b.qtd)}" width="${Math.max(1, x(b.ate) - x(b.de) - 2)}" height="${m.t + ph - y(b.qtd)}"><title>${b.qtd}</title></rect>`,
    )
    .join('');

  const ticksX = discreto
    ? barras.map((b) => ({ pos: x((b.de + b.ate) / 2), txt: b.rotulo }))
    : calcularTicks(dominio).map((v) => ({ pos: x(v), txt: fmt(v) }));
  const eixoX = ticksX
    .map((t) => `<line class="tick" x1="${t.pos}" x2="${t.pos}" y1="${m.t + ph}" y2="${m.t + ph + 4}"/><text class="rot" x="${t.pos}" y="${m.t + ph + 17}" text-anchor="middle">${esc(t.txt)}</text>`)
    .join('');

  const eixoY = [0, ymax]
    .map((q) => `<text class="rot" x="${m.l - 6}" y="${y(q) + 4}" text-anchor="end">${q}</text>`)
    .join('');

  const marcas = marcadores
    .map((mk, i) => {
      const px = x(mk.valor);
      const ancora = px > m.l + pw * 0.6 ? 'end' : 'start';
      const dx = ancora === 'end' ? -4 : 4;
      return `<g class="marcador m${i % 4}${mk.correto ? ' certo' : ''}">
        <line x1="${px}" x2="${px}" y1="${m.t - 4}" y2="${m.t + ph}" stroke-dasharray="${TRACOS[i % 4]}"/>
        <text x="${px + dx}" y="${m.t - 20 + (i % 2) * 14}" text-anchor="${ancora}">${esc(mk.rotulo)}: ${esc(fmt(mk.valor))}</text>
      </g>`;
    })
    .join('');

  const linhasTabela = barras
    .filter((b) => b.qtd > 0)
    .map((b) => `<tr><td>${esc(discreto ? b.rotulo : `${fmt(b.de)} a ${fmt(b.ate)}`)}</td><td>${b.qtd}</td></tr>`)
    .join('');

  const rotulo = [titulo, descricao].filter(Boolean).join('. ');
  return `<figure class="grafico">
    ${titulo ? `<figcaption>${esc(titulo)}</figcaption>` : ''}
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)}">
      <line class="eixo" x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}"/>
      <line class="eixo" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${m.t + ph}"/>
      ${rect}${eixoX}${eixoY}${marcas}
      <text class="rot" x="${m.l + pw / 2}" y="${H - 6}" text-anchor="middle">${esc(rotuloX)}</text>
      <text class="rot" transform="translate(11 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle">${esc(rotuloY)}</text>
    </svg>
    <details><summary>Ver os mesmos dados em tabela</summary>
      <table><thead><tr><th>${esc(discreto ? rotuloX : 'Faixa')}</th><th>${esc(rotuloY)}</th></tr></thead><tbody>${linhasTabela}</tbody></table>
    </details>
  </figure>`;
}
