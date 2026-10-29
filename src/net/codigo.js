// Códigos de convite do multiplayer em rede local (docs/adr/0008). Sem servidor, o convidado e o dono trocam
// dois textos por fora do jogo (copiar e colar): o pedido (oferta WebRTC do convidado) e a resposta do dono.
// Formato: prefixo + JSON comprimido (deflate-raw) em base64url, em blocos de 4 caracteres para facilitar a leitura.

export const VERSAO_CODIGO = 1;
export const PREFIXOS = { pedido: `CEO${VERSAO_CODIGO}P.`, resposta: `CEO${VERSAO_CODIGO}R.` };
export const NOME_MAX = 20;
// Limite do texto colado: um SDP comprimido tem poucas centenas de caracteres; acima disso é lixo ou abuso.
const CODIGO_MAX = 8000;
const BLOCO = 4;

const paraBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

const deBase64Url = (texto) => {
  const b64 = texto.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

async function transformar(bytes, Fluxo) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new Fluxo('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

// Enxuga um SDP padrão de webrtc-datachannel para manter apenas os parâmetros essenciais,
// reduzindo em até 75% o tamanho do payload para gerar códigos compactos e fáceis de compartilhar.
export function enxugarSdp(sdp) {
  if (typeof sdp !== 'string') return null;
  const u = sdp.match(/a=ice-ufrag:([^\r\n]+)/)?.[1]?.trim();
  const p = sdp.match(/a=ice-pwd:([^\r\n]+)/)?.[1]?.trim();
  const f = sdp.match(/a=fingerprint:([^\r\n]+)/)?.[1]?.trim();
  const s = sdp.match(/a=setup:([^\r\n]+)/)?.[1]?.trim();
  if (!u || !p || !f) {
    // String mock ou arbitrária de teste: preserva íntegra
    return { sdp };
  }
  const c = [];
  const linhas = sdp.split(/\r?\n/);
  for (const l of linhas) {
    const m = l.match(/^a=candidate:(\S+)\s+(\d+)\s+udp\s+(\d+)\s+(\S+)\s+(\d+)\s+typ\s+host/i);
    if (m) {
      c.push([m[1], Number(m[2]), Number(m[3]), m[4], Number(m[5])]);
    }
  }
  return { u, p, f, s: s ?? 'actpass', c };
}

// Reconstrói um SDP padrão a partir dos parâmetros essenciais enxugados.
export function hidratarSdp(dados, tipo = 'pedido') {
  if (typeof dados?.sdp === 'string') return dados.sdp;
  if (!dados?.u || !dados?.p || !dados?.f) return null;
  const setup = dados.s || (tipo === 'pedido' ? 'actpass' : 'active');
  const candidatos = (dados.c ?? []).map(
    ([fund, comp, prio, ip, porta]) => `a=candidate:${fund} ${comp} udp ${prio} ${ip} ${porta} typ host\r\n`,
  ).join('');

  return [
    'v=0',
    'o=- 1000000000000000 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=extmap-allow-mixed',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${dados.u}`,
    `a=ice-pwd:${dados.p}`,
    'a=ice-options:trickle',
    `a=fingerprint:${dados.f}`,
    `a=setup:${setup}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    candidatos,
  ].filter(Boolean).join('\r\n') + '\r\n';
}

// Cada tipo traz só os campos que o outro lado precisa; o resto é descartado.
const CAMPOS = {
  pedido: (d) => {
    if (!d) return null;
    const nome = String(d.nome ?? '').trim().slice(0, NOME_MAX);
    if (typeof d.sdp === 'string' && d.sdp) return { nome, sdp: d.sdp };
    if (typeof d.u === 'string' && typeof d.p === 'string' && typeof d.f === 'string') {
      return { nome, u: d.u, p: d.p, f: d.f, s: d.s, c: Array.isArray(d.c) ? d.c : [] };
    }
    return null;
  },
  resposta: (d) => {
    if (!d) return null;
    if (typeof d.sdp === 'string' && d.sdp) return { sdp: d.sdp };
    if (typeof d.u === 'string' && typeof d.p === 'string' && typeof d.f === 'string') {
      return { u: d.u, p: d.p, f: d.f, s: d.s, c: Array.isArray(d.c) ? d.c : [] };
    }
    return null;
  },
};

// Extrai o código CEO1... a partir de texto colado, tolerando espaços e quebras de linha.
export function extrairCodigo(texto) {
  if (!texto) return '';
  const s = String(texto).trim();
  for (const pref of Object.values(PREFIXOS)) {
    const idx = s.indexOf(pref);
    if (idx >= 0) {
      return s.slice(idx).replace(/\s+/g, '');
    }
  }
  return s.replace(/\s+/g, '');
}

// `tipo`: 'pedido' ou 'resposta'. Devolve o texto pronto para copiar, ou lança se os dados forem inválidos.
export async function codificar(tipo, dados) {
  if (!dados) throw new Error('Dados de convite inválidos');
  let entrada = dados;
  if (typeof dados.sdp === 'string') {
    const enxuto = enxugarSdp(dados.sdp);
    if (enxuto?.u) {
      entrada = { ...(dados.nome !== undefined ? { nome: dados.nome } : {}), ...enxuto };
    } else {
      entrada = { ...dados, sdp: dados.sdp };
    }
  }
  const limpo = CAMPOS[tipo]?.(entrada);
  if (!limpo) throw new Error('Dados de convite inválidos');
  const comprimido = await transformar(new TextEncoder().encode(JSON.stringify(limpo)), CompressionStream);
  const corpo = paraBase64Url(comprimido).match(new RegExp(`.{1,${BLOCO}}`, 'g')).join(' ');
  return PREFIXOS[tipo] + corpo;
}

// Devolve os dados ou `null` para qualquer texto inválido (prefixo ou versão errados, corrompido, campos ausentes).
export async function decodificar(tipo, texto) {
  try {
    const limpo = extrairCodigo(texto);
    if (!CAMPOS[tipo] || limpo.length > CODIGO_MAX || !limpo.startsWith(PREFIXOS[tipo])) return null;
    const bytes = deBase64Url(limpo.slice(PREFIXOS[tipo].length));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(await transformar(bytes, DecompressionStream));
    const obj = JSON.parse(json);
    const validado = CAMPOS[tipo](obj);
    if (!validado) return null;
    const sdp = hidratarSdp(validado, tipo);
    if (!sdp) return null;
    return {
      ...(validado.nome !== undefined ? { nome: validado.nome } : {}),
      sdp,
    };
  } catch {
    return null;
  }
}

// Diz qual tipo de código o texto parece ser (para avisar quem colou o código errado no campo errado).
export function tipoDoCodigo(texto) {
  const limpo = extrairCodigo(texto);
  return Object.keys(PREFIXOS).find((t) => limpo.startsWith(PREFIXOS[t])) ?? null;
}
