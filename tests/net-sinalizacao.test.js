import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALFABETO_SALA,
  gerarCodigoSala,
  normalizarCodigoSala,
  criarCanalEmMemoria,
  detectarTipoSinalizacao,
  criarCanalSinalizacao,
  anunciarSala,
  conectarNaSala,
} from '../src/net/sinalizacao.js';
import { ErroConvite } from '../src/net/transporte.js';

test('gerarCodigoSala: gera código com tamanho correto e caracteres válidos', () => {
  const c4 = gerarCodigoSala();
  assert.equal(c4.length, 4);
  for (const char of c4) {
    assert.ok(ALFABETO_SALA.includes(char), `Caractere inválido: ${char}`);
  }

  const c6 = gerarCodigoSala(6);
  assert.equal(c6.length, 6);

  // Testa determinismo com aleatório mockado
  let idx = 0;
  const mockRandom = () => (idx++ % 10) / 10;
  const cMock = gerarCodigoSala(4, mockRandom);
  assert.equal(cMock.length, 4);
});

test('normalizarCodigoSala: limpa espaços, converte para maiúsculo e remove inválidos', () => {
  assert.equal(normalizarCodigoSala('  k9p2  '), 'K9P2');
  assert.equal(normalizarCodigoSala('ab-cd!'), 'ABCD');
  assert.equal(normalizarCodigoSala(null), '');
  assert.equal(normalizarCodigoSala(123), '');
  assert.equal(normalizarCodigoSala(''), '');
});

test('criarCanalEmMemoria: publica e ouve mensagens por sala', async () => {
  const canal = criarCanalEmMemoria();
  const recebidasA = [];
  const recebidasB = [];

  const cancelarA = canal.ouvir('SALA1', (msg) => recebidasA.push(msg));
  const cancelarB = canal.ouvir('SALA2', (msg) => recebidasB.push(msg));

  await canal.publicar('SALA1', { texto: 'olá sala 1' });
  await canal.publicar('SALA2', { texto: 'olá sala 2' });

  assert.equal(recebidasA.length, 1);
  assert.equal(recebidasA[0].texto, 'olá sala 1');
  assert.equal(recebidasB.length, 1);
  assert.equal(recebidasB[0].texto, 'olá sala 2');

  cancelarA();
  await canal.publicar('SALA1', { texto: 'mais um' });
  assert.equal(recebidasA.length, 1);
  cancelarB();
});

test('detectarTipoSinalizacao: identifica local quando ping responde 200', async () => {
  const mockFetchOk = async (url) => {
    assert.match(url, /\/_sinal\/ping/);
    return { ok: true };
  };
  const tipoLocal = await detectarTipoSinalizacao({ fetchFn: mockFetchOk });
  assert.equal(tipoLocal, 'local');

  const mockFetchFail = async () => {
    throw new Error('Network error');
  };
  const tipoPublico = await detectarTipoSinalizacao({ fetchFn: mockFetchFail });
  assert.equal(tipoPublico, 'publico');

  const tipoSemFetch = await detectarTipoSinalizacao({ fetchFn: null });
  assert.equal(tipoSemFetch, 'publico');
});

test('criarCanalSinalizacao: local e público com SSE e fallback', async () => {
  // 1. Em memória
  const canalMem = criarCanalSinalizacao({ tipo: 'memoria' });
  assert.equal(canalMem.tipo, 'memoria');

  // 2. Local com Mock EventSource e fetch
  let fetchUrl = null;
  let fetchBody = null;
  const mockFetch = async (url, opts) => {
    fetchUrl = url;
    fetchBody = opts.body;
    return { ok: true, json: async () => ({ ok: true, mensagens: [] }), text: async () => '' };
  };

  class MockEventSource {
    constructor(url) {
      this.url = url;
      this.fechado = false;
      MockEventSource.ultimaInstancia = this;
    }
    close() {
      this.fechado = true;
    }
  }

  const canalLocal = criarCanalSinalizacao({
    tipo: 'local',
    fetchFn: mockFetch,
    EventSourceClass: MockEventSource,
  });
  assert.equal(canalLocal.tipo, 'local');

  await canalLocal.publicar('K9P2', { acao: 'teste' });
  assert.match(fetchUrl, /\/_sinal\/K9P2/);
  assert.match(fetchBody, /"acao":"teste"/);

  const mensagensRecebidas = [];
  const cancelarOuvinte = canalLocal.ouvir('K9P2', (msg) => mensagensRecebidas.push(msg));
  assert.ok(MockEventSource.ultimaInstancia);
  assert.match(MockEventSource.ultimaInstancia.url, /\/_sinal\/K9P2\/sse/);

  MockEventSource.ultimaInstancia.onmessage({ data: JSON.stringify({ ping: 'pong' }) });
  assert.equal(mensagensRecebidas.length, 1);
  assert.equal(mensagensRecebidas[0].ping, 'pong');
  cancelarOuvinte();
  assert.equal(MockEventSource.ultimaInstancia.fechado, true);

  // 3. Público (ntfy.sh) com SSE
  const canalPub = criarCanalSinalizacao({
    tipo: 'publico',
    fetchFn: mockFetch,
    EventSourceClass: MockEventSource,
  });
  await canalPub.publicar('K9P2', { acao: 'pub' });
  assert.match(fetchUrl, /ntfy\.sh\/rfisher-ceo-k9p2/);

  const msgsPub = [];
  const cancelarPub = canalPub.ouvir('K9P2', (msg) => msgsPub.push(msg));
  // ntfy envia payload envelopado em { event: 'message', message: '...' }
  MockEventSource.ultimaInstancia.onmessage({
    data: JSON.stringify({
      event: 'message',
      message: JSON.stringify({ dado: 123 }),
    }),
  });
  assert.equal(msgsPub.length, 1);
  assert.equal(msgsPub[0].dado, 123);
  cancelarPub();
});

test('anunciarSala e conectarNaSala: fluxo completo de conexão bem-sucedido', async () => {
  const canalSinal = criarCanalEmMemoria();
  const codigoSala = 'K9P2';

  const mockTransporteHost = { fechar: () => {}, enviar: () => {} };
  const mockTransporteGuest = { fechar: () => {}, enviar: () => {} };

  let respostaAplicada = null;

  const mockCriarPedido = async (nome) => ({
    codigo: 'CEO1P.MOCK_PEDIDO',
    transporte: mockTransporteGuest,
    aplicarResposta: async (codResp) => {
      respostaAplicada = codResp;
    },
  });

  const mockResponderPedido = async (codPed) => {
    assert.equal(codPed, 'CEO1P.MOCK_PEDIDO');
    return {
      nome: 'Convidado Bob',
      codigoResposta: 'CEO1R.MOCK_RESPOSTA',
      transporte: mockTransporteHost,
    };
  };

  let conexaoRecebidaPeloHost = null;
  const host = anunciarSala({
    codigoSala,
    canalSinal,
    responderFn: mockResponderPedido,
    aoConectar: (dados) => {
      conexaoRecebidaPeloHost = dados;
    },
  });

  const progresso = [];
  const resultadoGuest = await conectarNaSala({
    codigoSala,
    nome: 'Convidado Bob',
    canalSinal,
    criarFn: mockCriarPedido,
    timeoutMs: 5000,
    aoProgresso: (etapa) => progresso.push(etapa),
  });

  assert.equal(respostaAplicada, 'CEO1R.MOCK_RESPOSTA');
  assert.equal(resultadoGuest.transporte, mockTransporteGuest);
  assert.equal(resultadoGuest.nome, 'Convidado Bob');

  assert.ok(conexaoRecebidaPeloHost);
  assert.equal(conexaoRecebidaPeloHost.nome, 'Convidado Bob');
  assert.equal(conexaoRecebidaPeloHost.transporte, mockTransporteHost);

  assert.ok(progresso.includes('criando_oferta'));
  assert.ok(progresso.includes('aguardando_anfitriao'));
  assert.ok(progresso.includes('conectando_webrtc'));

  host.parar();
});

test('conectarNaSala: rejeição quando host recusa ou lança erro', async () => {
  const canalSinal = criarCanalEmMemoria();
  const codigoSala = 'CH77';

  let fechouTransporte = false;
  const mockTransporte = {
    fechar: () => {
      fechouTransporte = true;
    },
  };

  const mockCriarPedido = async () => ({
    codigo: 'CEO1P.TESTE',
    transporte: mockTransporte,
    aplicarResposta: async () => {},
  });

  const mockResponderFalha = async () => {
    throw new Error('A sala está lotada.');
  };

  const host = anunciarSala({
    codigoSala,
    canalSinal,
    responderFn: mockResponderFalha,
    aoConectar: () => {},
  });

  await assert.rejects(
    async () => {
      await conectarNaSala({
        codigoSala,
        nome: 'Charlie',
        canalSinal,
        criarFn: mockCriarPedido,
        timeoutMs: 3000,
      });
    },
    (err) => {
      assert.ok(err instanceof ErroConvite);
      assert.equal(err.motivo, 'recusado');
      assert.match(err.message, /A sala está lotada/);
      return true;
    },
  );

  assert.equal(fechouTransporte, true);
  host.parar();
});

test('conectarNaSala: erro de timeout quando host não responde', async () => {
  const canalSinal = criarCanalEmMemoria();
  const codigoSala = 'ZZ99';

  let fechouTransporte = false;
  const mockCriarPedido = async () => ({
    codigo: 'CEO1P.TESTE',
    transporte: { fechar: () => { fechouTransporte = true; } },
    aplicarResposta: async () => {},
  });

  await assert.rejects(
    async () => {
      await conectarNaSala({
        codigoSala,
        nome: 'David',
        canalSinal,
        criarFn: mockCriarPedido,
        timeoutMs: 50,
      });
    },
    (err) => {
      assert.ok(err instanceof ErroConvite);
      assert.equal(err.motivo, 'timeout');
      assert.match(err.message, /Tempo esgotado/);
      return true;
    },
  );

  assert.equal(fechouTransporte, true);
});

test('conectarNaSala: recusa código de sala vazio ou muito curto', async () => {
  await assert.rejects(
    async () => {
      await conectarNaSala({
        codigoSala: 'AB',
        nome: 'David',
        canalSinal: criarCanalEmMemoria(),
      });
    },
    (err) => {
      assert.ok(err instanceof ErroConvite);
      assert.equal(err.motivo, 'codigo-invalido');
      return true;
    },
  );
});

test('criarCanalSinalizacao: polling fallback quando EventSource não existe', async (t) => {
  let chamadasLocal = 0;
  let chamadasPub = 0;

  const mockFetchLocal = async (url) => {
    chamadasLocal++;
    return {
      ok: true,
      json: async () => ({
        ok: true,
        mensagens: [{ tempo: 100, dados: 'msg_local' }],
      }),
    };
  };

  const canalLocalSemES = criarCanalSinalizacao({
    tipo: 'local',
    fetchFn: mockFetchLocal,
    EventSourceClass: null,
  });

  const recebidasLocal = [];
  const cancelarLocal = canalLocalSemES.ouvir('L999', (msg) => recebidasLocal.push(msg));

  // Aguarda 1 tick do polling
  await new Promise((r) => setTimeout(r, 1100));
  cancelarLocal();
  assert.ok(chamadasLocal >= 1);
  assert.ok(recebidasLocal.length >= 1);

  const mockFetchPub = async (url) => {
    chamadasPub++;
    return {
      ok: true,
      text: async () => JSON.stringify({ event: 'message', time: 200, message: JSON.stringify({ pub: 'ok' }) }) + '\n',
    };
  };

  const canalPubSemES = criarCanalSinalizacao({
    tipo: 'publico',
    fetchFn: mockFetchPub,
    EventSourceClass: null,
  });

  const recebidasPub = [];
  const cancelarPub = canalPubSemES.ouvir('P999', (msg) => recebidasPub.push(msg));
  await new Promise((r) => setTimeout(r, 1600));
  cancelarPub();
  assert.ok(chamadasPub >= 1);
  assert.ok(recebidasPub.length >= 1);
});

test('anunciarSala: ignora pedidos repetidos com o mesmo idPedido', async () => {
  const canalSinal = criarCanalEmMemoria();
  let vezesAtendidas = 0;

  const mockResponder = async () => {
    vezesAtendidas++;
    return {
      nome: 'Duplicado',
      codigoResposta: 'CEO1R.RESP',
      transporte: { fechar: () => {} },
    };
  };

  const host = anunciarSala({
    codigoSala: 'DUP1',
    canalSinal,
    responderFn: mockResponder,
    aoConectar: () => {},
  });

  // Envia primeiro pedido
  await canalSinal.publicar('DUP1', {
    tipo: 'pedido_conexao',
    idPedido: 'ped_mesmo_id',
    codigoPedido: 'CEO1P.1',
  });
  // Envia segundo pedido idêntico (retry da rede)
  await canalSinal.publicar('DUP1', {
    tipo: 'pedido_conexao',
    idPedido: 'ped_mesmo_id',
    codigoPedido: 'CEO1P.1',
  });

  assert.equal(vezesAtendidas, 1);
  host.parar();
});

test('conectarNaSala: falha ao aplicar resposta rejeita e fecha transporte', async () => {
  const canalSinal = criarCanalEmMemoria();
  let fechouTransporte = false;

  const mockCriarPedido = async () => ({
    codigo: 'CEO1P.FAIL',
    transporte: { fechar: () => { fechouTransporte = true; } },
    aplicarResposta: async () => {
      throw new ErroConvite('sdp-invalido', 'SDP incompatível.');
    },
  });

  const mockResponder = async () => ({
    nome: 'Alice',
    codigoResposta: 'CEO1R.INCOMPAT',
    transporte: { fechar: () => {} },
  });

  const host = anunciarSala({
    codigoSala: 'ERR1',
    canalSinal,
    responderFn: mockResponder,
    aoConectar: () => {},
  });

  await assert.rejects(
    async () => {
      await conectarNaSala({
        codigoSala: 'ERR1',
        nome: 'Bob',
        canalSinal,
        criarFn: mockCriarPedido,
        timeoutMs: 3000,
      });
    },
    (err) => {
      assert.ok(err instanceof ErroConvite);
      assert.equal(err.motivo, 'sdp-invalido');
      return true;
    },
  );

  assert.equal(fechouTransporte, true);
  host.parar();
});

