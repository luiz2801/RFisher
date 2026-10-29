// Gerador de QR Code em SVG puro (zero dependências, ISO/IEC 18004).
// Suporta modo Byte com correção de erro nível L (7%), ideal para manter a matriz
// o mais compacta e legível possível para câmeras e telas de celular.

// Galois Field GF(2^8) com polinômio primitivo 0x11D (285).
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}
for (let i = 255; i < 512; i++) {
  EXP[i] = EXP[i - 255];
}

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function polyMul(p1, p2) {
  const res = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return res;
}

function geradorRs(grau) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < grau; i++) {
    g = polyMul(g, new Uint8Array([1, EXP[i]]));
  }
  return g;
}

function calcularEc(dados, grau) {
  const g = geradorRs(grau);
  const r = new Uint8Array(dados.length + grau);
  r.set(dados, 0);
  for (let i = 0; i < dados.length; i++) {
    const coef = r[i];
    if (coef !== 0) {
      for (let j = 0; j < g.length; j++) {
        r[i + j] ^= gfMul(g[j], coef);
      }
    }
  }
  return r.slice(dados.length);
}

// Tabela de versões para Nível L:
// [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsG1, numBlocksGroup2, dataCodewordsG2]
const TABELA_VERSOES_L = [
  null,
  [26, 7, 1, 19, 0, 0], // v1 (21x21): 19 dados (17 bytes)
  [44, 10, 1, 34, 0, 0], // v2 (25x25): 34 dados (32 bytes)
  [70, 15, 1, 55, 0, 0], // v3 (29x29): 55 dados (53 bytes)
  [100, 20, 1, 80, 0, 0], // v4 (33x33): 80 dados (78 bytes)
  [134, 26, 1, 108, 0, 0], // v5 (37x37): 108 dados (106 bytes)
  [172, 18, 2, 68, 0, 0], // v6 (41x41): 136 dados (134 bytes)
  [196, 20, 2, 78, 0, 0], // v7 (45x45): 156 dados (154 bytes)
  [242, 24, 2, 97, 0, 0], // v8 (49x49): 194 dados (192 bytes)
  [292, 30, 2, 116, 0, 0], // v9 (53x53): 232 dados (230 bytes)
  [346, 18, 2, 68, 2, 69], // v10 (57x57): 274 dados (271 bytes)
  [404, 20, 4, 81, 0, 0], // v11 (61x61): 324 dados (321 bytes)
  [466, 24, 2, 92, 2, 93], // v12 (65x65): 370 dados (367 bytes)
  [532, 26, 4, 107, 0, 0], // v13 (69x69): 428 dados (425 bytes)
  [581, 30, 3, 115, 1, 116], // v14 (73x73): 461 dados (458 bytes)
];

// Posições de padrões de alinhamento por versão
const ALINHAMENTOS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
];

// Informação de versão (v7 a v14) codificada em Golay (18, 6)
const INFO_VERSAO = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
  11: 0x0bbf6,
  12: 0x0c762,
  13: 0x0d847,
  14: 0x0e60d,
};

// Formato para Nível L com máscaras 0 a 7 (BCH 15, 5 mascarado com 0x5412)
const FORMATOS_L = [
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
];

class BitBuffer {
  constructor() {
    this.buffer = [];
    this.tamanho = 0;
  }
  escrever(valor, numBits) {
    for (let i = numBits - 1; i >= 0; i--) {
      const bit = (valor >> i) & 1;
      const idx = Math.floor(this.tamanho / 8);
      if (this.buffer.length <= idx) this.buffer.push(0);
      if (bit) this.buffer[idx] |= 1 << (7 - (this.tamanho % 8));
      this.tamanho++;
    }
  }
  obterBytes() {
    return new Uint8Array(this.buffer);
  }
}

function escolherVersao(numBytes) {
  for (let v = 1; v < TABELA_VERSOES_L.length; v++) {
    const t = TABELA_VERSOES_L[v];
    const totalDados = (t[2] * t[3]) + (t[4] * t[5]);
    const numBitsIndicador = v <= 9 ? 8 : 16;
    const overheadBits = 4 + numBitsIndicador; // modo (4) + contador
    const bytesDisponiveis = Math.floor((totalDados * 8 - overheadBits) / 8);
    if (numBytes <= bytesDisponiveis) return v;
  }
  throw new Error(`Dados longos demais para QR Code (máximo suportado: ${numBytes} bytes)`);
}

function codificarDados(bytesUtf8, versao) {
  const t = TABELA_VERSOES_L[versao];
  const totalDados = (t[2] * t[3]) + (t[4] * t[5]);
  const bits = new BitBuffer();

  // Modo byte: 0100
  bits.escrever(4, 4);
  // Indicador de comprimento de caractere (8 bits para v1-9, 16 bits para v10+)
  bits.escrever(bytesUtf8.length, versao <= 9 ? 8 : 16);
  // Dados
  for (const b of bytesUtf8) bits.escrever(b, 8);

  // Terminador (até 4 bits zero)
  const restante = totalDados * 8 - bits.tamanho;
  bits.escrever(0, Math.min(4, restante));

  // Alinhar a byte
  if (bits.tamanho % 8 !== 0) {
    bits.escrever(0, 8 - (bits.tamanho % 8));
  }

  // Bytes de preenchimento (0xEC, 0x11)
  const preenchimento = [0xec, 0x11];
  let pIdx = 0;
  while (bits.tamanho < totalDados * 8) {
    bits.escrever(preenchimento[pIdx], 8);
    pIdx = (pIdx + 1) % 2;
  }

  return bits.obterBytes();
}

function dividirEIntercalar(dadosCodificados, versao) {
  const t = TABELA_VERSOES_L[versao];
  const [totalCodewords, ecPorBloco, b1, g1, b2, g2] = t;
  const blocosDados = [];
  const blocosEc = [];
  let offset = 0;

  for (let i = 0; i < b1; i++) {
    const slice = dadosCodificados.slice(offset, offset + g1);
    blocosDados.push(slice);
    blocosEc.push(calcularEc(slice, ecPorBloco));
    offset += g1;
  }
  for (let i = 0; i < b2; i++) {
    const slice = dadosCodificados.slice(offset, offset + g2);
    blocosDados.push(slice);
    blocosEc.push(calcularEc(slice, ecPorBloco));
    offset += g2;
  }

  // Intercalar dados
  const final = new Uint8Array(totalCodewords);
  let ptr = 0;
  const maxDados = Math.max(g1, g2);
  for (let c = 0; c < maxDados; c++) {
    for (const b of blocosDados) {
      if (c < b.length) final[ptr++] = b[c];
    }
  }

  // Intercalar EC
  for (let c = 0; c < ecPorBloco; c++) {
    for (const b of blocosEc) {
      final[ptr++] = b[c];
    }
  }

  return final;
}

export function gerarMatrizQr(texto) {
  const bytes = new TextEncoder().encode(texto);
  const versao = escolherVersao(bytes.length);
  const dadosFinais = dividirEIntercalar(codificarDados(bytes, versao), versao);
  const tamanho = versao * 4 + 17;

  // matriz: 0 = branco, 1 = preto, -1 = reservado/função
  const mat = Array.from({ length: tamanho }, () => new Int8Array(tamanho).fill(0));
  const reservado = Array.from({ length: tamanho }, () => new Uint8Array(tamanho));

  function marcar(l, c, val) {
    mat[l][c] = val;
    reservado[l][c] = 1;
  }

  // 1. Padrões de localização (Finder patterns) 7x7 em (0,0), (0, size-7), (size-7, 0)
  const posicoesFinder = [[0, 0], [0, tamanho - 7], [tamanho - 7, 0]];
  for (const [fl, fc] of posicoesFinder) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const l = fl + r;
        const col = fc + c;
        if (l >= 0 && l < tamanho && col >= 0 && col < tamanho) {
          const dentro7 = r >= 0 && r < 7 && c >= 0 && c < 7;
          const dentro5 = r >= 1 && r < 6 && c >= 1 && c < 6;
          const dentro3 = r >= 2 && r < 5 && c >= 2 && c < 5;
          const cor = dentro7 ? (dentro3 ? 1 : (dentro5 ? 0 : 1)) : 0;
          marcar(l, col, cor);
        }
      }
    }
  }

  // 2. Padrões de sincronização (Timing patterns)
  for (let i = 8; i < tamanho - 8; i++) {
    if (!reservado[6][i]) marcar(6, i, i % 2 === 0 ? 1 : 0);
    if (!reservado[i][6]) marcar(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // 3. Padrões de alinhamento (Alignment patterns) para v >= 2
  const coordsAlinhamento = ALINHAMENTOS[versao];
  for (const r of coordsAlinhamento) {
    for (const c of coordsAlinhamento) {
      if (reservado[r][c]) continue; // não sobrepor com finders
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const borda = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          const centro = dr === 0 && dc === 0;
          marcar(r + dr, c + dc, borda || centro ? 1 : 0);
        }
      }
    }
  }

  // 4. Módulo escuro fixo
  marcar(4 * versao + 9, 8, 1);

  // 5. Reservar áreas de informação de formato e versão
  for (let i = 0; i < 9; i++) {
    reservado[8][i] = 1;
    reservado[i][8] = 1;
    if (i < 8) {
      reservado[8][tamanho - 1 - i] = 1;
      reservado[tamanho - 1 - i][8] = 1;
    }
  }
  if (versao >= 7) {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        reservado[r][tamanho - 11 + c] = 1;
        reservado[tamanho - 11 + c][r] = 1;
      }
    }
  }

  // 6. Alocar bits de dados no padrão zig-zag
  let bitIdx = 0;
  let direcaoCima = true;
  for (let c = tamanho - 1; c > 0; c -= 2) {
    if (c === 6) c--; // pular linha de timing vertical
    const linhas = direcaoCima
      ? Array.from({ length: tamanho }, (_, i) => tamanho - 1 - i)
      : Array.from({ length: tamanho }, (_, i) => i);

    for (const l of linhas) {
      for (const dc of [0, -1]) {
        const col = c + dc;
        if (!reservado[l][col]) {
          const byte = Math.floor(bitIdx / 8);
          const bitPos = 7 - (bitIdx % 8);
          const bitVal = byte < dadosFinais.length ? (dadosFinais[byte] >> bitPos) & 1 : 0;
          mat[l][col] = bitVal;
          bitIdx++;
        }
      }
    }
    direcaoCima = !direcaoCima;
  }

  // 7. Selecionar melhor máscara (usamos máscara 0 a 7 avaliando penalidades)
  const funcoesMascara = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  let melhorMascara = 0;
  let menorPenalidade = Infinity;
  let melhorMatriz = null;

  for (let m = 0; m < 8; m++) {
    const fn = funcoesMascara[m];
    const copia = mat.map((row, r) =>
      row.map((val, c) => (reservado[r][c] ? val : val ^ (fn(r, c) ? 1 : 0))),
    );

    // Escrever formato temporário para avaliar
    aplicarFormato(copia, versao, m);

    const pen = avaliarPenalidade(copia);
    if (pen < menorPenalidade) {
      menorPenalidade = pen;
      melhorMascara = m;
      melhorMatriz = copia;
    }
  }

  return { matriz: melhorMatriz, versao, tamanho, mascara: melhorMascara };
}

function aplicarFormato(mat, versao, mascara) {
  const tamanho = mat.length;
  const formato = FORMATOS_L[mascara];

  // Informação de formato (15 bits)
  for (let i = 0; i < 15; i++) {
    const bit = (formato >> i) & 1;
    // Perto do canto superior esquerdo
    if (i < 6) mat[i][8] = bit;
    else if (i === 6) mat[7][8] = bit;
    else if (i === 7) mat[8][8] = bit;
    else if (i === 8) mat[8][7] = bit;
    else mat[8][14 - i] = bit;

    // Cantos inferior esquerdo e superior direito
    if (i < 7) mat[8][tamanho - 1 - i] = bit;
    else mat[tamanho - 15 + i][8] = bit;
  }

  // Informação de versão (para v >= 7)
  if (versao >= 7) {
    const vInfo = INFO_VERSAO[versao];
    for (let i = 0; i < 18; i++) {
      const bit = (vInfo >> i) & 1;
      const r = Math.floor(i / 3);
      const c = i % 3;
      mat[tamanho - 11 + c][r] = bit;
      mat[r][tamanho - 11 + c] = bit;
    }
  }
}

function avaliarPenalidade(m) {
  const sz = m.length;
  let pen = 0;

  // N1: Linhas ou colunas com 5+ módulos da mesma cor seguidos
  for (let r = 0; r < sz; r++) {
    let cont = 1;
    for (let c = 1; c < sz; c++) {
      if (m[r][c] === m[r][c - 1]) {
        cont++;
      } else {
        if (cont >= 5) pen += 3 + (cont - 5);
        cont = 1;
      }
    }
    if (cont >= 5) pen += 3 + (cont - 5);
  }

  for (let c = 0; c < sz; c++) {
    let cont = 1;
    for (let r = 1; r < sz; r++) {
      if (m[r][c] === m[r - 1][c]) {
        cont++;
      } else {
        if (cont >= 5) pen += 3 + (cont - 5);
        cont = 1;
      }
    }
    if (cont >= 5) pen += 3 + (cont - 5);
  }

  // N2: Blocos 2x2 da mesma cor
  for (let r = 0; r < sz - 1; r++) {
    for (let c = 0; c < sz - 1; c++) {
      const v = m[r][c];
      if (v === m[r + 1][c] && v === m[r][c + 1] && v === m[r + 1][c + 1]) {
        pen += 3;
      }
    }
  }

  return pen;
}

// Gera o SVG do QR Code pronto para renderização inline
export function qrCodeSvg(texto, { rotulo = 'QR Code de convite', margem = 4 } = {}) {
  const { matriz, tamanho } = gerarMatrizQr(texto);
  const total = tamanho + margem * 2;
  const pathD = [];

  for (let r = 0; r < tamanho; r++) {
    for (let c = 0; c < tamanho; c++) {
      if (matriz[r][c] === 1) {
        const x = c + margem;
        const y = r + margem;
        pathD.push(`M${x} ${y}h1v1h-1z`);
      }
    }
  }

  return `<svg class="qrcode-svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="${rotulo}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${total}" height="${total}" fill="#ffffff"/>
  <path d="${pathD.join('')}" fill="#0f172a"/>
</svg>`;
}
