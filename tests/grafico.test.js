import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularBarras, calcularDominio, grafico } from '../src/ui/components/grafico.js';

const serie = (valores) => ({ nome: 'S', valores });
const soma = (barras) => barras.reduce((s, b) => s + b.qtd, 0);

// ---------- calcularBarras: discreto ----------

test('calcularBarras discreto: uma barra por valor inteiro do domínio, com rótulo e frequência fiéis', () => {
  const valores = [1, 2, 2, 3, 3, 3, 5];
  const barras = calcularBarras(valores, calcularDominio([serie(valores)], true), true);
  assert.deepEqual(barras.map((b) => b.rotulo), ['1', '2', '3', '4', '5']);
  assert.deepEqual(barras.map((b) => b.qtd), [1, 2, 3, 0, 1]);
  assert.equal(soma(barras), valores.length);
});

test('calcularBarras discreto: cada barra cobre ±0,5 em torno do inteiro', () => {
  const barras = calcularBarras([4, 5], [3.5, 5.5], true);
  assert.deepEqual(barras.map((b) => [b.de, b.ate]), [[3.5, 4.5], [4.5, 5.5]]);
});

test('calcularBarras discreto: valor único gera uma só barra', () => {
  const barras = calcularBarras([7, 7, 7], calcularDominio([serie([7, 7, 7])], true), true);
  assert.equal(barras.length, 1);
  assert.deepEqual(barras[0], { de: 6.5, ate: 7.5, rotulo: '7', qtd: 3 });
});

// ---------- calcularBarras: contínuo ----------

test('calcularBarras contínuo: exatamente 12 faixas contíguas e a soma das frequências é o total', () => {
  const valores = Array.from({ length: 50 }, (_, i) => 100 + i * 3.7);
  const dominio = calcularDominio([serie(valores)], false);
  const barras = calcularBarras(valores, dominio, false);
  assert.equal(barras.length, 12);
  assert.equal(soma(barras), valores.length);
  assert.equal(barras[0].de, dominio[0]);
  assert.ok(Math.abs(barras[11].ate - dominio[1]) < 1e-9);
  barras.slice(1).forEach((b, i) => assert.ok(Math.abs(b.de - barras[i].ate) < 1e-9, 'faixas devem ser contíguas'));
});

test('calcularBarras contínuo: o valor máximo cai na última faixa e o mínimo na primeira', () => {
  const valores = [10, 12, 15, 20, 31, 40, 55, 99];
  const barras = calcularBarras(valores, calcularDominio([serie(valores)], false), false);
  assert.ok(barras[11].qtd >= 1, 'o máximo deve estar na última faixa');
  assert.ok(barras[0].qtd >= 1, 'o mínimo deve estar na primeira faixa');
  assert.equal(soma(barras), valores.length);
});

test('calcularBarras contínuo: valor exatamente no limite superior do domínio fica na última faixa, não fora', () => {
  const barras = calcularBarras([0, 5, 10], [0, 10], false);
  assert.equal(barras.length, 12);
  assert.equal(barras[11].qtd, 1);
  assert.equal(barras[0].qtd, 1);
  assert.equal(soma(barras), 3);
});

test('calcularBarras contínuo: valores fora do domínio são presos às faixas das pontas (sem perder contagem)', () => {
  const barras = calcularBarras([-50, 5, 500], [0, 10], false);
  assert.equal(barras[0].qtd, 1);
  assert.equal(barras[11].qtd, 1);
  assert.equal(soma(barras), 3);
});

test('calcularBarras: sem valores, todas as barras ficam zeradas', () => {
  assert.equal(soma(calcularBarras([], [0, 10], false)), 0);
  assert.equal(soma(calcularBarras([], [0.5, 3.5], true)), 0);
});

// ---------- calcularDominio ----------

test('calcularDominio discreto: ±0,5 em torno do mínimo e do máximo', () => {
  assert.deepEqual(calcularDominio([serie([2, 5, 3])], true), [1.5, 5.5]);
});

test('calcularDominio contínuo: folga de 2% da amplitude em cada ponta', () => {
  const [min, max] = calcularDominio([serie([100, 200, 150])], false);
  assert.ok(Math.abs(min - 98) < 1e-9, `min = ${min}`);
  assert.ok(Math.abs(max - 202) < 1e-9, `max = ${max}`);
});

test('calcularDominio contínuo: série constante usa folga 1 e evita divisão por zero', () => {
  const dominio = calcularDominio([serie([5, 5, 5])], false);
  assert.deepEqual(dominio, [4, 6]);
  const barras = calcularBarras([5, 5, 5], dominio, false);
  assert.equal(barras.length, 12);
  assert.equal(soma(barras), 3);
  assert.ok(barras.every((b) => Number.isFinite(b.de) && Number.isFinite(b.ate)));
});

test('calcularDominio considera todas as séries juntas', () => {
  assert.deepEqual(calcularDominio([serie([1, 2]), serie([8, 9])], true), [0.5, 9.5]);
  const [min, max] = calcularDominio([serie([0, 10]), serie([90, 100])], false);
  assert.ok(Math.abs(min - -2) < 1e-9 && Math.abs(max - 102) < 1e-9);
});

// ---------- grafico (marcação) ----------

test('grafico: SVG acessível com título, descrição e a tabela alternativa dos mesmos dados', () => {
  const valores = [1, 2, 2, 3];
  const html = grafico({
    serie: serie(valores),
    dominio: calcularDominio([serie(valores)], true),
    discreto: true,
    formato: 'decimal',
    rotuloX: 'Defeitos',
    rotuloY: 'Lotes',
    titulo: 'Defeitos por lote',
    descricao: 'Maioria com 2 defeitos.',
  });
  assert.match(html, /<svg [^>]*role="img"/);
  assert.match(html, /aria-label="Defeitos por lote\. Maioria com 2 defeitos\."/);
  assert.match(html, /<details>/);
  assert.match(html, /<td>2<\/td><td>2<\/td>/, 'a tabela traz a frequência do valor 2');
  assert.doesNotMatch(html, /undefined|NaN/);
});

test('grafico: escapa HTML nos rótulos e desenha os marcadores com valor formatado', () => {
  const valores = [10, 20, 30, 40];
  const html = grafico({
    serie: serie(valores),
    dominio: calcularDominio([serie(valores)], false),
    discreto: false,
    formato: 'brl',
    rotuloX: '<script>x</script>',
    rotuloY: 'Qtd',
    marcadores: [{ valor: 25, rotulo: 'Mediana', correto: true }],
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /class="marcador m0 certo"/);
  assert.match(html, /Mediana: R\$ 25/);
});
