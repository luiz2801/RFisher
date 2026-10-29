// Transporte WebRTC sem servidor (docs/adr/0008). Cada conexão é um RTCDataChannel entre o convidado e o dono.
// `iceServers: []`: nenhum STUN ou TURN, então só conecta dentro da mesma rede local.
// Sem sinalização automática: a oferta e a resposta viram os códigos de convite (codigo.js), trocados por fora do jogo.
//
// Interface do transporte, a mesma do transporte falso dos testes:
//   enviar(texto) · aoReceber(fn(texto)) · aoEstado(fn('conectado' | 'instavel' | 'caiu')) · fechar()

import { codificar, decodificar, tipoDoCodigo } from './codigo.js';

const CONFIG_RTC = { iceServers: [] };
// Espera os candidatos de rede para gerar um código só (sem trickle). Em LAN termina em milissegundos.
const ESPERA_ICE_MS = 4000;

export class ErroConvite extends Error {
  constructor(motivo, mensagem) {
    super(mensagem);
    this.motivo = motivo; // 'sem-webrtc' | 'codigo-invalido' | 'falha'
  }
}

export const temWebRtc = () => typeof RTCPeerConnection === 'function';

function criarConexao() {
  if (!temWebRtc()) throw new ErroConvite('sem-webrtc', 'Este navegador não tem WebRTC.');
  return new RTCPeerConnection(CONFIG_RTC);
}

function esperarCandidatos(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const fim = () => {
      clearTimeout(limite);
      pc.removeEventListener('icegatheringstatechange', mudou);
      resolve();
    };
    const mudou = () => pc.iceGatheringState === 'complete' && fim();
    const limite = setTimeout(fim, ESPERA_ICE_MS);
    pc.addEventListener('icegatheringstatechange', mudou);
  });
}

// Liga o RTCPeerConnection à interface do transporte. O canal pode chegar depois (no dono) ou antes (no convidado);
// mensagens que chegam antes de alguém ouvir ficam numa fila, e o último estado é repetido a quem se inscreve tarde.
function envolver(pc) {
  let canal = null;
  let estado = null;
  const fila = [];
  const ouvintesMsg = [];
  const ouvintesEstado = [];

  const emitirEstado = (s) => {
    if (estado === s || estado === 'caiu') return;
    estado = s;
    ouvintesEstado.forEach((fn) => fn(s));
  };
  const emitirMsg = (texto) => {
    if (!ouvintesMsg.length) fila.push(texto);
    else ouvintesMsg.forEach((fn) => fn(texto));
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'failed' || s === 'closed') emitirEstado('caiu');
    else if (s === 'disconnected') emitirEstado('instavel');
    else if (s === 'connected' && canal?.readyState === 'open') emitirEstado('conectado');
  };

  return {
    ligar(dc) {
      canal = dc;
      dc.onopen = () => emitirEstado('conectado');
      dc.onclose = () => emitirEstado('caiu');
      dc.onmessage = (ev) => typeof ev.data === 'string' && emitirMsg(ev.data);
      if (dc.readyState === 'open') emitirEstado('conectado');
    },
    transporte: {
      enviar(texto) {
        if (canal?.readyState === 'open') canal.send(texto);
      },
      aoReceber(fn) {
        ouvintesMsg.push(fn);
        while (fila.length) fn(fila.shift());
      },
      aoEstado(fn) {
        ouvintesEstado.push(fn);
        if (estado) fn(estado);
      },
      fechar() {
        try {
          canal?.close();
          pc.close();
        } catch {
          /* já fechado */
        }
        emitirEstado('caiu');
      },
      // Para a mensagem de diagnóstico quando a conexão demora: onde a negociação parou.
      diagnostico: () => ({ conexao: pc.connectionState, ice: pc.iceConnectionState }),
    },
  };
}

// Convidado, passo 1: gera o código de pedido. Devolve também a função que recebe o código de resposta do dono.
export async function criarPedido(nome) {
  const pc = criarConexao();
  const conexao = envolver(pc);
  try {
    conexao.ligar(pc.createDataChannel('ceo'));
    await pc.setLocalDescription(await pc.createOffer());
    await esperarCandidatos(pc);
    const codigo = await codificar('pedido', { nome, sdp: pc.localDescription.sdp });
    return {
      codigo,
      transporte: conexao.transporte,
      // Convidado, passo 2: cola a resposta do dono e a conexão se abre.
      async aplicarResposta(codigoResposta) {
        if (!codigoResposta || typeof codigoResposta !== 'string') {
          throw new ErroConvite('codigo-invalido', 'Cole o código de resposta do anfitrião.');
        }
        if (tipoDoCodigo(codigoResposta) === 'pedido') {
          throw new ErroConvite(
            'codigo-invalido',
            'Você colou um código de PEDIDO. Cole o código de RESPOSTA do anfitrião (começa com CEO1R.).',
          );
        }
        const resposta = await decodificar('resposta', codigoResposta);
        if (!resposta) {
          throw new ErroConvite(
            'codigo-invalido',
            'Esse não é um código de resposta válido (deve começar com CEO1R. e conter os dados gerados pelo anfitrião).',
          );
        }
        try {
          await pc.setRemoteDescription({ type: 'answer', sdp: resposta.sdp });
        } catch (e) {
          throw new ErroConvite(
            'codigo-invalido',
            `O código de resposta não combina com este pedido (${e.message || 'SDP incompatível'}).`,
          );
        }
      },
    };
  } catch (e) {
    conexao.transporte.fechar();
    throw e instanceof ErroConvite ? e : new ErroConvite('falha', `Não foi possível criar o pedido de entrada (${e.message || 'erro de rede'}).`);
  }
}

// Dono: lê o código de pedido e devolve o código de resposta, mais o transporte que abre quando o convidado o colar.
export async function responderPedido(codigoPedido) {
  if (!codigoPedido || typeof codigoPedido !== 'string') {
    throw new ErroConvite('codigo-invalido', 'Cole o código de pedido do convidado.');
  }
  if (tipoDoCodigo(codigoPedido) === 'resposta') {
    throw new ErroConvite(
      'codigo-invalido',
      'Você colou um código de RESPOSTA. Cole o código de PEDIDO do convidado (começa com CEO1P.).',
    );
  }
  const pedido = await decodificar('pedido', codigoPedido);
  if (!pedido) {
    throw new ErroConvite(
      'codigo-invalido',
      'Esse não é um código de pedido válido (deve começar com CEO1P. e conter os dados gerados pelo convidado).',
    );
  }
  const pc = criarConexao();
  const conexao = envolver(pc);
  pc.ondatachannel = (ev) => conexao.ligar(ev.channel);
  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: pedido.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await esperarCandidatos(pc);
    return {
      nome: pedido.nome,
      codigoResposta: await codificar('resposta', { sdp: pc.localDescription.sdp }),
      transporte: conexao.transporte,
    };
  } catch (e) {
    conexao.transporte.fechar();
    throw new ErroConvite(
      'codigo-invalido',
      `O código de pedido está corrompido ou incompatível (${e.message || 'falha no handshake'}).`,
    );
  }
}
