import test from 'node:test';
import assert from 'node:assert/strict';
import {
  temWebRtc,
  ErroConvite,
  criarPedido,
  responderPedido,
} from '../src/net/transporte.js';
import { codificar, PREFIXOS } from '../src/net/codigo.js';

// Mock de DataChannel para testar troca de mensagens e eventos
class MockDataChannel {
  constructor(label) {
    this.label = label;
    this.readyState = 'connecting';
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this._peer = null;
  }

  send(data) {
    if (this._peer && typeof this._peer.onmessage === 'function') {
      this._peer.onmessage({ data });
    }
  }

  close() {
    this.readyState = 'closed';
    this.onclose?.();
  }

  _conectar(outro) {
    this._peer = outro;
    outro._peer = this;
    this.readyState = 'open';
    outro.readyState = 'open';
    this.onopen?.();
    outro.onopen?.();
  }
}

// Mock de RTCPeerConnection para simular o ciclo de vida WebRTC no ambiente Node.js
class MockRTCPeerConnection {
  static instances = [];
  static failOnSetRemote = false;

  constructor(config) {
    this.config = config;
    this.iceGatheringState = 'new';
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.localDescription = null;
    this.remoteDescription = null;
    this.dataChannels = [];
    this.ondatachannel = null;
    this.onconnectionstatechange = null;
    this._listeners = new Map();
    MockRTCPeerConnection.instances.push(this);
  }

  addEventListener(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(fn);
  }

  removeEventListener(event, fn) {
    const list = this._listeners.get(event);
    if (list) {
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  _emit(event) {
    const list = this._listeners.get(event) ?? [];
    list.forEach((fn) => fn());
  }

  createDataChannel(label) {
    const dc = new MockDataChannel(label);
    this.dataChannels.push(dc);
    return dc;
  }

  async createOffer() {
    return {
      type: 'offer',
      sdp: [
        'v=0',
        'o=- 1000000000 2 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'a=group:BUNDLE 0',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=ice-ufrag:mockUfragOffer',
        'a=ice-pwd:mockPwdOffer123456789012345',
        'a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF',
        'a=setup:actpass',
        'a=mid:0',
        'a=candidate:1 1 udp 2113937151 192.168.1.10 50000 typ host',
      ].join('\r\n') + '\r\n',
    };
  }

  async createAnswer() {
    return {
      type: 'answer',
      sdp: [
        'v=0',
        'o=- 2000000000 2 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'a=group:BUNDLE 0',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=ice-ufrag:mockUfragAnswer',
        'a=ice-pwd:mockPwdAnswer123456789012345',
        'a=fingerprint:sha-256 FF:EE:DD:CC:BB:AA:99:88:77:66:55:44:33:22:11:00:FF:EE:DD:CC:BB:AA:99:88:77:66:55:44:33:22:11:00',
        'a=setup:active',
        'a=mid:0',
        'a=candidate:2 1 udp 2113937151 192.168.1.20 50001 typ host',
      ].join('\r\n') + '\r\n',
    };
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
    this.iceGatheringState = 'complete';
    this._emit('icegatheringstatechange');
  }

  async setRemoteDescription(desc) {
    if (MockRTCPeerConnection.failOnSetRemote) {
      throw new Error('Falha simulada em setRemoteDescription');
    }
    if (!desc?.sdp) throw new Error('SDP ausente');
    this.remoteDescription = desc;
  }

  close() {
    this.connectionState = 'closed';
    this.onconnectionstatechange?.();
  }
}

test('temWebRtc: reflete presença de RTCPeerConnection no ambiente global', () => {
  const original = globalThis.RTCPeerConnection;
  try {
    delete globalThis.RTCPeerConnection;
    assert.equal(temWebRtc(), false);

    globalThis.RTCPeerConnection = MockRTCPeerConnection;
    assert.equal(temWebRtc(), true);
  } finally {
    globalThis.RTCPeerConnection = original;
  }
});

test('criarPedido: falha imediatamente com "sem-webrtc" se o navegador não suportar WebRTC', async () => {
  const original = globalThis.RTCPeerConnection;
  try {
    delete globalThis.RTCPeerConnection;
    await assert.rejects(
      () => criarPedido('Ana'),
      (err) => err instanceof ErroConvite && err.motivo === 'sem-webrtc',
    );
  } finally {
    globalThis.RTCPeerConnection = original;
  }
});

test('handshake completo e transporte: pedido -> resposta -> conexão -> mensagens', async () => {
  const original = globalThis.RTCPeerConnection;
  MockRTCPeerConnection.instances = [];
  MockRTCPeerConnection.failOnSetRemote = false;
  globalThis.RTCPeerConnection = MockRTCPeerConnection;

  try {
    // 1. Convidado gera pedido
    const convidado = await criarPedido('Alice');
    assert.ok(convidado.codigo.startsWith(PREFIXOS.pedido));
    assert.equal(typeof convidado.aplicarResposta, 'function');
    assert.ok(convidado.transporte);

    // 2. Anfitrião processa pedido e gera resposta
    const anfitriao = await responderPedido(convidado.codigo);
    assert.equal(anfitriao.nome, 'Alice');
    assert.ok(anfitriao.codigoResposta.startsWith(PREFIXOS.resposta));
    assert.ok(anfitriao.transporte);

    // Liga os dois canais de dados para simular a abertura do canal WebRTC
    const pcConvidado = MockRTCPeerConnection.instances[0];
    const pcAnfitriao = MockRTCPeerConnection.instances[1];
    const dcConvidado = pcConvidado.dataChannels[0];
    const dcAnfitriao = new MockDataChannel('ceo');
    pcAnfitriao.ondatachannel?.({ channel: dcAnfitriao });

    let estadoConvidado = null;
    let estadoAnfitriao = null;
    convidado.transporte.aoEstado((s) => { estadoConvidado = s; });
    anfitriao.transporte.aoEstado((s) => { estadoAnfitriao = s; });

    // 3. Convidado aplica a resposta do anfitrião
    await convidado.aplicarResposta(anfitriao.codigoResposta);

    // Simula abertura dos DataChannels
    dcConvidado._conectar(dcAnfitriao);
    assert.equal(estadoConvidado, 'conectado');
    assert.equal(estadoAnfitriao, 'conectado');

    // 4. Troca de mensagens bidirecional
    const msgsRecebidasPeloHost = [];
    const msgsRecebidasPeloGuest = [];
    anfitriao.transporte.aoReceber((m) => msgsRecebidasPeloHost.push(m));
    convidado.transporte.aoReceber((m) => msgsRecebidasPeloGuest.push(m));

    convidado.transporte.enviar('{"tipo":"ping"}');
    assert.deepEqual(msgsRecebidasPeloHost, ['{"tipo":"ping"}']);

    anfitriao.transporte.enviar('{"tipo":"pong"}');
    assert.deepEqual(msgsRecebidasPeloGuest, ['{"tipo":"pong"}']);

    // Diagnóstico
    assert.ok(convidado.transporte.diagnostico());

    // 5. Fechamento da conexão
    convidado.transporte.fechar();
    assert.equal(estadoConvidado, 'caiu');
  } finally {
    globalThis.RTCPeerConnection = original;
  }
});

test('mensagens anteriores à inscrição em aoReceber ficam em fila e são entregues na ordem', async () => {
  const original = globalThis.RTCPeerConnection;
  MockRTCPeerConnection.instances = [];
  globalThis.RTCPeerConnection = MockRTCPeerConnection;

  try {
    const convidado = await criarPedido('Bob');
    const anfitriao = await responderPedido(convidado.codigo);
    const dcConvidado = MockRTCPeerConnection.instances[0].dataChannels[0];
    const dcAnfitriao = new MockDataChannel('ceo');
    MockRTCPeerConnection.instances[1].ondatachannel?.({ channel: dcAnfitriao });
    await convidado.aplicarResposta(anfitriao.codigoResposta);
    dcConvidado._conectar(dcAnfitriao);

    // Envia mensagens antes de o convidado registrar ouvinte
    dcAnfitriao.send('msg1');
    dcAnfitriao.send('msg2');

    const recebidas = [];
    convidado.transporte.aoReceber((m) => recebidas.push(m));
    assert.deepEqual(recebidas, ['msg1', 'msg2']);
  } finally {
    globalThis.RTCPeerConnection = original;
  }
});

test('aplicarResposta: validações claras quando código é inválido ou trocado', async () => {
  const original = globalThis.RTCPeerConnection;
  MockRTCPeerConnection.instances = [];
  globalThis.RTCPeerConnection = MockRTCPeerConnection;

  try {
    const convidado = await criarPedido('Carol');
    const { aplicarResposta } = convidado;

    // Código ausente
    await assert.rejects(
      () => aplicarResposta(''),
      (err) => err instanceof ErroConvite && err.motivo === 'codigo-invalido' && err.message.includes('Cole o código de resposta'),
    );

    // Convidado colou o código de PEDIDO no campo de RESPOSTA
    const codigoPedido = convidado.codigo;
    await assert.rejects(
      () => aplicarResposta(codigoPedido),
      (err) => err instanceof ErroConvite && err.motivo === 'codigo-invalido' && err.message.includes('Você colou um código de PEDIDO'),
    );

    // Código corrompido / lixo
    await assert.rejects(
      () => aplicarResposta('CEO1R.ZZZZ LIXO INVALIDO'),
      (err) => err instanceof ErroConvite && err.motivo === 'codigo-invalido' && err.message.includes('Esse não é um código de resposta válido'),
    );

    // Falha em setRemoteDescription (SDP incompatível)
    const anfitriao = await responderPedido(codigoPedido);
    MockRTCPeerConnection.failOnSetRemote = true;
    await assert.rejects(
      () => aplicarResposta(anfitriao.codigoResposta),
      (err) => err instanceof ErroConvite && err.motivo === 'codigo-invalido' && err.message.includes('não combina com este pedido'),
    );
  } finally {
    globalThis.RTCPeerConnection = original;
    MockRTCPeerConnection.failOnSetRemote = false;
  }
});

test('responderPedido: validações claras quando código de pedido é inválido ou trocado', async () => {
  const original = globalThis.RTCPeerConnection;
  MockRTCPeerConnection.instances = [];
  globalThis.RTCPeerConnection = MockRTCPeerConnection;

  try {
    // Código ausente
    await assert.rejects(
      () => responderPedido(''),
      (err) => err instanceof ErroConvite && err.motivo === 'codigo-invalido' && err.message.includes('Cole o código de pedido'),
    );

    // Dono colou um código de RESPOSTA no campo de PEDIDO
    const codigoRespostaFalso = await codificar('resposta', { sdp: 'v=0\r\n' });
    await assert.rejects(
      () => responderPedido(codigoRespostaFalso),
      (err) => err instanceof ErroConvite && err.motivo === 'codigo-invalido' && err.message.includes('Você colou um código de RESPOSTA'),
    );

    // Código corrompido
    await assert.rejects(
      () => responderPedido('CEO1P.INVALIDO TOTAL'),
      (err) => err instanceof ErroConvite && err.motivo === 'codigo-invalido' && err.message.includes('Esse não é um código de pedido válido'),
    );

    // Falha em setRemoteDescription
    MockRTCPeerConnection.failOnSetRemote = true;
    const convidado = await criarPedido('Dan');
    await assert.rejects(
      () => responderPedido(convidado.codigo),
      (err) => err instanceof ErroConvite && err.motivo === 'codigo-invalido' && err.message.includes('corrompido ou incompatível'),
    );
  } finally {
    globalThis.RTCPeerConnection = original;
    MockRTCPeerConnection.failOnSetRemote = false;
  }
});

test('mudanças de estado na conexão: disconnected emite "instavel" e failed emite "caiu"', async () => {
  const original = globalThis.RTCPeerConnection;
  MockRTCPeerConnection.instances = [];
  globalThis.RTCPeerConnection = MockRTCPeerConnection;

  try {
    const convidado = await criarPedido('Eva');
    const pc = MockRTCPeerConnection.instances[0];

    const estados = [];
    convidado.transporte.aoEstado((s) => estados.push(s));

    pc.connectionState = 'disconnected';
    pc.onconnectionstatechange();
    assert.deepEqual(estados, ['instavel']);

    pc.connectionState = 'failed';
    pc.onconnectionstatechange();
    assert.deepEqual(estados, ['instavel', 'caiu']);
  } finally {
    globalThis.RTCPeerConnection = original;
  }
});

test('criarPedido: falha ao gerar oferta lança ErroConvite com motivo "falha"', async () => {
  const original = globalThis.RTCPeerConnection;
  MockRTCPeerConnection.instances = [];
  globalThis.RTCPeerConnection = class extends MockRTCPeerConnection {
    async createOffer() {
      throw new Error('Falha de hardware');
    }
  };

  try {
    await assert.rejects(
      () => criarPedido('Felipe'),
      (err) => err instanceof ErroConvite && err.motivo === 'falha' && err.message.includes('Falha de hardware'),
    );
  } finally {
    globalThis.RTCPeerConnection = original;
  }
});

test('fechar transporte múltiplas vezes é idempotente e emite "caiu"', async () => {
  const original = globalThis.RTCPeerConnection;
  MockRTCPeerConnection.instances = [];
  globalThis.RTCPeerConnection = MockRTCPeerConnection;

  try {
    const convidado = await criarPedido('Gabi');
    const estados = [];
    convidado.transporte.aoEstado((s) => estados.push(s));

    convidado.transporte.fechar();
    convidado.transporte.fechar();
    assert.deepEqual(estados, ['caiu']);
  } finally {
    globalThis.RTCPeerConnection = original;
  }
});

test('connectionState = connected ativa "conectado" quando o canal já está aberto', async () => {
  const original = globalThis.RTCPeerConnection;
  MockRTCPeerConnection.instances = [];
  globalThis.RTCPeerConnection = MockRTCPeerConnection;

  try {
    const convidado = await criarPedido('Helena');
    const pc = MockRTCPeerConnection.instances[0];
    const dc = pc.dataChannels[0];
    dc.readyState = 'open';

    const estados = [];
    convidado.transporte.aoEstado((s) => estados.push(s));

    pc.connectionState = 'connected';
    pc.onconnectionstatechange();
    assert.deepEqual(estados, ['conectado']);
  } finally {
    globalThis.RTCPeerConnection = original;
  }
});
