import test from 'node:test';
import assert from 'node:assert/strict';
import { formatar, brl, brlSinal, unidade, lerNumero } from '../src/stats/format.js';

const MENOS = '−'; // sinal de menos tipográfico (−), não o hífen

test('formatar brl: reais inteiros, arredondados, com milhar em pt-BR', () => {
  assert.equal(formatar('brl', 0), 'R$ 0');
  assert.equal(formatar('brl', 1234), 'R$ 1.234');
  assert.equal(formatar('brl', 47500), 'R$ 47.500');
  assert.equal(formatar('brl', 1234567.6), 'R$ 1.234.568');
  assert.equal(formatar('brl', 999.4), 'R$ 999');
});

test('formatar dias, minutos e gramas: uma casa decimal fixa, vírgula decimal e unidade', () => {
  assert.equal(formatar('dias', 3), '3,0 dias');
  assert.equal(formatar('dias', 12.34), '12,3 dias');
  assert.equal(formatar('minutos', 5.55), '5,6 min');
  assert.equal(formatar('minutos', 1500), '1.500,0 min');
  assert.equal(formatar('gramas', 250), '250,0 g');
  assert.equal(formatar('gramas', 0.04), '0,0 g');
});

test('formatar porcento: uma casa decimal colada ao símbolo', () => {
  assert.equal(formatar('porcento', 9.8), '9,8%');
  assert.equal(formatar('porcento', 100), '100,0%');
  assert.equal(formatar('porcento', 0), '0,0%');
});

test('formatar mm: sempre duas casas decimais', () => {
  assert.equal(formatar('mm', 10), '10,00 mm');
  assert.equal(formatar('mm', 9.876), '9,88 mm');
});

test('formatar cm e ms: inteiros, com milhar em pt-BR', () => {
  assert.equal(formatar('cm', 362.6), '363 cm');
  assert.equal(formatar('ms', 3736.4), '3.736 ms');
});

test('formatar seg: até uma casa decimal, sem zero sobrando', () => {
  assert.equal(formatar('seg', 4), '4 s');
  assert.equal(formatar('seg', 4.25), '4,3 s');
  assert.equal(formatar('seg', 4.04), '4 s');
});

test('formatar decimal: até três casas decimais, sem unidade', () => {
  assert.equal(formatar('decimal', 0.5), '0,5');
  assert.equal(formatar('decimal', 0.12345), '0,123');
  assert.equal(formatar('decimal', 2), '2');
  assert.equal(formatar('decimal', 1234.5678), '1.234,568');
});

test('formatar com tipo desconhecido ou ausente cai no padrão: até uma casa decimal, sem unidade', () => {
  assert.equal(formatar('inexistente', 3.14159), '3,1');
  assert.equal(formatar(undefined, 1000), '1.000');
  assert.equal(formatar('', 2), '2');
});

test('formatar aceita zero e negativos sem lançar', () => {
  assert.equal(formatar('dias', -2.5), '-2,5 dias');
  assert.equal(formatar('decimal', 0), '0');
  assert.equal(formatar('brl', 0.4), 'R$ 0');
});

test('brl: positivo, zero e negativo com o sinal de menos tipográfico', () => {
  assert.equal(brl(5000), 'R$ 5.000');
  assert.equal(brl(0), 'R$ 0');
  assert.equal(brl(-5000), `${MENOS}R$ 5.000`);
  assert.notEqual(brl(-1).charAt(0), '-', 'não pode ser o hífen ASCII');
  assert.equal(brl(-1).charAt(0), MENOS);
});

test('brlSinal: + para ganho, − para perda e nada para zero', () => {
  assert.equal(brlSinal(5000), '+R$ 5.000');
  assert.equal(brlSinal(-5000), `${MENOS}R$ 5.000`);
  assert.equal(brlSinal(0), 'R$ 0');
});

test('brl e brlSinal: menos zero e fração que arredonda para zero não ganham sinal', () => {
  assert.equal(brl(-0), 'R$ 0');
  assert.equal(brlSinal(-0), 'R$ 0');
  assert.equal(brl(0.4), 'R$ 0');
});

test('unidade mapeia cada tipo conhecido para o seu símbolo', () => {
  assert.deepEqual(
    {
      brl: unidade('brl'), dias: unidade('dias'), minutos: unidade('minutos'), gramas: unidade('gramas'),
      porcento: unidade('porcento'), mm: unidade('mm'), cm: unidade('cm'), ms: unidade('ms'), seg: unidade('seg'),
    },
    { brl: 'R$', dias: 'dias', minutos: 'min', gramas: 'g', porcento: '%', mm: 'mm', cm: 'cm', ms: 'ms', seg: 's' },
  );
});

test('unidade devolve string vazia para tipos sem unidade ou desconhecidos', () => {
  assert.equal(unidade('decimal'), '');
  assert.equal(unidade('inexistente'), '');
  assert.equal(unidade(undefined), '');
});

test('lerNumero entende o que o jogador digita em pt-BR e recusa o que não é número', () => {
  assert.equal(lerNumero('5.000,50'), 5000.5);
  assert.equal(lerNumero('5000,5'), 5000.5);
  assert.equal(lerNumero('2.5'), 2.5);
  assert.equal(lerNumero('2.500'), 2500);
  assert.equal(lerNumero('R$ 3.200'), 3200);
  assert.equal(lerNumero('12 min'), 12);
  assert.equal(lerNumero(`${MENOS}4`), -4);
  assert.equal(lerNumero(7), 7);
  for (const ruim of ['', 'abc', '1,2,3', '--1', null, undefined, NaN, Infinity]) {
    assert.ok(Number.isNaN(lerNumero(ruim)), `deveria recusar ${String(ruim)}`);
  }
});
