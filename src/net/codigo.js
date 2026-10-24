// Códigos de convite do multiplayer em rede local (docs/adr/0008). Sem servidor, o convidado e o dono trocam
// dois textos por fora do jogo (copiar e colar): o pedido (oferta WebRTC do convidado) e a resposta do dono.
// Formato: prefixo + JSON comprimido (deflate-raw) em base64url, em blocos de 4 caracteres para facilitar a leitura.

export const VERSAO_CODIGO = 1;
export const PREFIXOS = { pedido: `CEO${VERSAO_CODIGO}P.`, resposta: `CEO${VERSAO_CODIGO}R.` };
export const NOME_MAX = 20;
// Limite do texto colado: um SDP típico comprimido tem poucas centenas de caracteres; acima disso é lixo ou abuso.
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

// Cada tipo traz só os campos que o outro lado precisa; o resto é descartado.
const CAMPOS = {
  pedido: (d) => (typeof d?.sdp === 'string' && d.sdp ? { nome: String(d.nome ?? '').trim().slice(0, NOME_MAX), sdp: d.sdp } : null),
  resposta: (d) => (typeof d?.sdp === 'string' && d.sdp ? { sdp: d.sdp } : null),
};

// `tipo`: 'pedido' ou 'resposta'. Devolve o texto pronto para copiar, ou lança se os dados forem inválidos.
export async function codificar(tipo, dados) {
  const limpo = CAMPOS[tipo]?.(dados);
  if (!limpo) throw new Error('Dados de convite inválidos');
  const comprimido = await transformar(new TextEncoder().encode(JSON.stringify(limpo)), CompressionStream);
  const corpo = paraBase64Url(comprimido).match(new RegExp(`.{1,${BLOCO}}`, 'g')).join(' ');
  return PREFIXOS[tipo] + corpo;
}

// Devolve os dados ou `null` para qualquer texto inválido (prefixo ou versão errados, corrompido, campos ausentes).
export async function decodificar(tipo, texto) {
  try {
    const limpo = String(texto ?? '').replace(/\s+/g, '');
    if (!CAMPOS[tipo] || limpo.length > CODIGO_MAX || !limpo.startsWith(PREFIXOS[tipo])) return null;
    const bytes = deBase64Url(limpo.slice(PREFIXOS[tipo].length));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(await transformar(bytes, DecompressionStream));
    return CAMPOS[tipo](JSON.parse(json));
  } catch {
    return null;
  }
}

// Diz qual tipo de código o texto parece ser (para avisar quem colou o código errado no campo errado).
export function tipoDoCodigo(texto) {
  const limpo = String(texto ?? '').replace(/\s+/g, '');
  return Object.keys(PREFIXOS).find((t) => limpo.startsWith(PREFIXOS[t])) ?? null;
}
