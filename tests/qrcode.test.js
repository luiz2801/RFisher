import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarMatrizQr, qrCodeSvg } from '../src/ui/components/qrcode.js';

test('gerarMatrizQr: texto curto gera versão 1 ou 2 com dimensões corretas', () => {
  const { matriz, versao, tamanho } = gerarMatrizQr('http://192.168.1.15:8000');
  assert.ok(versao >= 1 && versao <= 3);
  assert.equal(tamanho, versao * 4 + 17);
  assert.equal(matriz.length, tamanho);
  assert.equal(matriz[0].length, tamanho);

  // Padrão de localização (finder) superior esquerdo deve ter 7x7 com centro 3x3 escuro
  assert.equal(matriz[0][0], 1);
  assert.equal(matriz[3][3], 1); // centro
  assert.equal(matriz[1][1], 0); // anel branco
});

test('gerarMatrizQr: link longo de multiplayer (~150 caracteres) escolhe versão adequada (v6 a v8)', () => {
  const link = 'http://192.168.1.100:8000/#CEO1P.eJyLzivNydFRyC9XSC4pysxLV9JRgAM1PQW4sJAaFwsAcg8K2Q';
  const { versao, tamanho, matriz } = gerarMatrizQr(link);
  assert.ok(versao >= 5 && versao <= 8);
  assert.equal(tamanho, versao * 4 + 17);
  assert.equal(matriz.length, tamanho);
});

test('gerarMatrizQr: rejeita texto além da capacidade máxima suportada', () => {
  const gigante = 'A'.repeat(500);
  assert.throws(() => gerarMatrizQr(gigante), /Dados longos demais/);
});

test('qrCodeSvg: gera SVG válido com viewBox, fundo branco e caminho dos módulos', () => {
  const svg = qrCodeSvg('teste123', { rotulo: 'QR Code de Teste', margem: 4 });
  assert.match(svg, /<svg class="qrcode-svg"/);
  assert.match(svg, /aria-label="QR Code de Teste"/);
  assert.match(svg, /<rect width="\d+" height="\d+" fill="#ffffff"\/>/);
  assert.match(svg, /<path d="M\d+ \d+h1v1h-1z/);
});
