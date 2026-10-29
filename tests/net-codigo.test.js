import test from 'node:test';
import assert from 'node:assert/strict';
import { codificar, decodificar, tipoDoCodigo, PREFIXOS, enxugarSdp, hidratarSdp, extrairCodigo } from '../src/net/codigo.js';
import { validarMensagem, serializar, ACOES_REMOTAS, MAX_DO_CONVIDADO } from '../src/net/protocolo.js';

const SDP = 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=candidate:1 1 udp 2113937151 abcd-1234.local 54321 typ host\r\n'.repeat(8);

test('código de pedido: ida e volta preserva nome e SDP', async () => {
  const texto = await codificar('pedido', { nome: 'Ana', sdp: SDP });
  assert.ok(texto.startsWith(PREFIXOS.pedido));
  assert.deepEqual(await decodificar('pedido', texto), { nome: 'Ana', sdp: SDP });
});

test('código de resposta: ida e volta', async () => {
  const texto = await codificar('resposta', { sdp: SDP });
  assert.deepEqual(await decodificar('resposta', texto), { sdp: SDP });
});

test('o código sai em blocos de 4 e tolera espaços, quebras de linha e texto em volta ao colar', async () => {
  const texto = await codificar('pedido', { nome: 'Ana', sdp: SDP });
  assert.match(texto.slice(PREFIXOS.pedido.length), /^(\S{4} )*\S{1,4}$/);
  const colado = `  ${texto.replaceAll(' ', '\n')}\n\n`;
  assert.equal((await decodificar('pedido', colado))?.nome, 'Ana');
});

test('o nome é aparado e limitado a 20 caracteres', async () => {
  const d = await decodificar('pedido', await codificar('pedido', { nome: `  ${'x'.repeat(40)}  `, sdp: SDP }));
  assert.equal(d.nome, 'x'.repeat(20));
});

test('códigos de tipo trocado, prefixo ou versão errados e lixo viram null', async () => {
  const pedido = await codificar('pedido', { nome: 'Ana', sdp: SDP });
  assert.equal(await decodificar('resposta', pedido), null);
  assert.equal(await decodificar('pedido', pedido.replace('CEO1P.', 'CEO2P.')), null);
  assert.equal(await decodificar('pedido', 'qualquer coisa'), null);
  assert.equal(await decodificar('pedido', ''), null);
  assert.equal(await decodificar('pedido', undefined), null);
  assert.equal(await decodificar('inexistente', pedido), null);
});

test('código corrompido ou truncado vira null, sem lançar exceção', async () => {
  const pedido = await codificar('pedido', { nome: 'Ana', sdp: SDP });
  assert.equal(await decodificar('pedido', pedido.slice(0, pedido.length - 40)), null);
  assert.equal(await decodificar('pedido', `${PREFIXOS.pedido}!!!!@@@@`), null);
  assert.equal(await decodificar('pedido', `${PREFIXOS.pedido}AAAA`), null);
});

test('código com campos ausentes ou tipos errados vira null', async () => {
  // Código válido por fora, mas com o JSON sem `sdp` (montado à mão, já que `codificar` não deixa gerar).
  const manual = async (obj) => {
    const flux = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const b64 = Buffer.from(await new Response(flux).arrayBuffer()).toString('base64url');
    return PREFIXOS.pedido + b64;
  };
  assert.deepEqual(await decodificar('pedido', await manual({ nome: 'Ana', sdp: 'x' })), { nome: 'Ana', sdp: 'x' });
  assert.equal(await decodificar('pedido', await manual({ nome: 'Ana' })), null);
  assert.equal(await decodificar('pedido', await manual({ nome: 'Ana', sdp: 42 })), null);
  assert.equal(await decodificar('pedido', await manual(null)), null);
  assert.equal(await decodificar('pedido', await manual([1, 2])), null);
  await assert.rejects(() => codificar('pedido', { nome: 'Ana' }));
  await assert.rejects(() => codificar('pedido', { sdp: 42 }));
  await assert.rejects(() => codificar('resposta', null));
  await assert.rejects(() => codificar('outro', { sdp: 'x' }));
});

test('texto colado enorme é rejeitado antes de descomprimir', async () => {
  assert.equal(await decodificar('pedido', PREFIXOS.pedido + 'A'.repeat(9000)), null);
});

test('tipoDoCodigo identifica o tipo pelo prefixo', async () => {
  assert.equal(tipoDoCodigo(await codificar('pedido', { sdp: 'x' })), 'pedido');
  assert.equal(tipoDoCodigo(` ${await codificar('resposta', { sdp: 'x' })}`), 'resposta');
  assert.equal(tipoDoCodigo('oi'), null);
});

test('protocolo: ação de convidado válida passa e traz só os campos conhecidos', () => {
  const m = validarMensagem(serializar({ tipo: 'acao', acao: { tipo: 'METRICA', valor: 'media', extra: 1 }, intruso: true }), 'convidado');
  assert.deepEqual(m, { tipo: 'acao', acao: { tipo: 'METRICA', valor: 'media' } });
  assert.deepEqual(validarMensagem('{"tipo":"acao","acao":{"tipo":"INVESTIR","valor":10000}}', 'convidado').acao.valor, 10000);
  assert.ok(validarMensagem('{"tipo":"acao","acao":{"tipo":"ROLAR"}}', 'convidado'));
});

test('protocolo: convidado não pode pedir DECIDIR_BOT nem ação desconhecida', () => {
  assert.equal(ACOES_REMOTAS.includes('DECIDIR_BOT'), false);
  assert.equal(validarMensagem('{"tipo":"acao","acao":{"tipo":"DECIDIR_BOT"}}', 'convidado'), null);
  assert.equal(validarMensagem('{"tipo":"acao","acao":{"tipo":"constructor"}}', 'convidado'), null);
  assert.equal(validarMensagem('{"tipo":"acao","acao":{"tipo":"__proto__"}}', 'convidado'), null);
});

test('protocolo: valor inválido (objeto, texto longo, NaN) é rejeitado', () => {
  assert.equal(validarMensagem('{"tipo":"acao","acao":{"tipo":"METRICA","valor":{"a":1}}}', 'convidado'), null);
  assert.equal(validarMensagem(serializar({ tipo: 'acao', acao: { tipo: 'METRICA', valor: 'x'.repeat(65) } }), 'convidado'), null);
  assert.equal(validarMensagem('{"tipo":"acao","acao":{"tipo":"INVESTIR","valor":null}}', 'convidado'), null);
});

test('protocolo: perfil válido e inválido', () => {
  assert.deepEqual(validarMensagem('{"tipo":"perfil","nome":" Bia ","nivel":"avancado","diretoria":"tecnologia"}', 'convidado'),
    { tipo: 'perfil', nome: 'Bia', nivel: 'avancado', diretoria: 'tecnologia' });
  assert.equal(validarMensagem('{"tipo":"perfil","nome":"Bia","nivel":"deus"}', 'convidado'), null);
  assert.equal(validarMensagem(serializar({ tipo: 'perfil', nome: 'x'.repeat(21), nivel: 'iniciante' }), 'convidado'), null);
});

test('protocolo: lixo, tipo desconhecido, JSON inválido e texto grande viram null', () => {
  for (const ruim of ['', 'não é json', '[]', 'null', '42', '{"tipo":"estado"}', '{"tipo":"toString"}', '{"tipo":"__proto__"}', undefined, 7]) {
    assert.equal(validarMensagem(ruim, 'convidado'), null, String(ruim));
  }
  assert.equal(validarMensagem(serializar({ tipo: 'ping', lixo: 'x'.repeat(MAX_DO_CONVIDADO) }), 'convidado'), null);
});

test('protocolo: convidado não consegue se passar pelo dono (estado, sala, encerrada)', () => {
  for (const tipo of ['estado', 'sala', 'encerrada', 'aviso']) assert.equal(validarMensagem(`{"tipo":"${tipo}"}`, 'convidado'), null);
});

test('protocolo: mensagens do dono', () => {
  assert.deepEqual(validarMensagem('{"tipo":"encerrada"}', 'dono'), { tipo: 'encerrada' });
  assert.equal(validarMensagem('{"tipo":"sala","sala":{"pessoas":[]},"voce":"c1"}', 'dono').voce, 'c1');
  assert.equal(validarMensagem('{"tipo":"sala","sala":{"pessoas":[]}}', 'dono'), null);
  assert.equal(validarMensagem('{"tipo":"sala","sala":{},"voce":"c1"}', 'dono'), null);
  assert.equal(validarMensagem('{"tipo":"estado","estado":{"fase":"ROLAR_DADO","jogadores":[]},"meuId":1}', 'dono').meuId, 1);
  assert.equal(validarMensagem('{"tipo":"estado","estado":{"fase":1}}', 'dono'), null);
  assert.equal(validarMensagem('{"tipo":"acao","acao":{"tipo":"ROLAR"}}', 'dono'), null);
  assert.equal(validarMensagem('{"tipo":"aviso","texto":"Ana ficou sem conexão"}', 'dono').texto, 'Ana ficou sem conexão');
});

const SDP_WEBRTC_REAL = [
  'v=0',
  'o=- 8129384729182371 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=ice-ufrag:AbCd',
  'a=ice-pwd:XyZ1234567890abcdefghijklmn',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  'a=candidate:1 1 udp 2113937151 192.168.1.50 54321 typ host generation 0 ufrag AbCd network-id 1 network-cost 10',
  'a=candidate:2 1 tcp 1518280447 192.168.1.50 9 typ host tcptype active generation 0 ufrag AbCd',
].join('\r\n') + '\r\n';

test('enxugarSdp e hidratarSdp: extrai e restaura parâmetros essenciais de SDP WebRTC', () => {
  const enxuto = enxugarSdp(SDP_WEBRTC_REAL);
  assert.equal(enxuto.u, 'AbCd');
  assert.equal(enxuto.p, 'XyZ1234567890abcdefghijklmn');
  assert.ok(enxuto.f.startsWith('sha-256'));
  assert.equal(enxuto.c.length, 1); // descarta candidato tcp
  assert.deepEqual(enxuto.c[0], ['1', 1, 2113937151, '192.168.1.50', 54321]);

  const restaurado = hidratarSdp(enxuto, 'pedido');
  assert.match(restaurado, /a=ice-ufrag:AbCd/);
  assert.match(restaurado, /a=ice-pwd:XyZ1234567890abcdefghijklmn/);
  assert.match(restaurado, /a=candidate:1 1 UDP 2113937151 192.168.1.50 54321 typ host/i);
  assert.doesNotMatch(restaurado, /tcp/);
});

test('codificar com SDP real gera código compacto e decodifica com fidelidade para pedido e resposta', async () => {
  const codPedido = await codificar('pedido', { nome: 'Carlos', sdp: SDP_WEBRTC_REAL });
  const limpoPedido = codPedido.replace(/\s+/g, '');
  assert.ok(limpoPedido.length < 220, `tamanho gerado: ${limpoPedido.length}`);

  const decPedido = await decodificar('pedido', codPedido);
  assert.equal(decPedido.nome, 'Carlos');
  assert.match(decPedido.sdp, /a=ice-ufrag:AbCd/);
  assert.match(decPedido.sdp, /a=candidate:1 1 UDP 2113937151 192.168.1.50 54321 typ host/i);

  const codResposta = await codificar('resposta', { sdp: SDP_WEBRTC_REAL });
  const limpoResposta = codResposta.replace(/\s+/g, '');
  assert.ok(limpoResposta.length < 220, `tamanho gerado: ${limpoResposta.length}`);

  const decResposta = await decodificar('resposta', codResposta);
  assert.match(decResposta.sdp, /a=ice-ufrag:AbCd/);
  assert.match(decResposta.sdp, /a=candidate:1 1 UDP 2113937151 192.168.1.50 54321 typ host/i);
});

test('extrairCodigo: limpa espaços, quebras de linha e caracteres invisíveis de chat', () => {
  const cod = 'CEO1P.eJyLzivNydFRyC';
  assert.equal(extrairCodigo(`  ${cod}  `), cod);
  assert.equal(extrairCodigo('CEO1P.eJyL zivN ydFR yC'), cod);
  assert.equal(extrairCodigo(cod), cod);

  // Caracteres invisíveis (zero-width space, BOM) inseridos por apps de chat:
  const invisiveis = `\u200B\uFEFFCEO1P.eJyL\u200CzivN\u200DydFR\u2060yC\uFEFF`;
  assert.equal(extrairCodigo(invisiveis), cod);
});

test('extrairCodigo: prioriza tipo esperado se texto contiver ambos os códigos', () => {
  const textoMisto = 'Convidado: CEO1P.PEDIDO123\nAnfitrião: CEO1R.RESPOSTA456';
  assert.equal(extrairCodigo(textoMisto, 'resposta'), 'CEO1R.RESPOSTA456');
  assert.equal(extrairCodigo(textoMisto, 'pedido'), 'CEO1P.PEDIDO123');
});

test('decodificar: tolera mensagens de WhatsApp com texto antes, depois e pontuação', async () => {
  const cod = await codificar('resposta', { sdp: SDP_WEBRTC_REAL });

  // Mensagem com introdução e despedida
  const msgCompleta = `Opa, aqui está a resposta da sala:\n\n${cod}\n\nCole lá no jogo!`;
  const dec1 = await decodificar('resposta', msgCompleta);
  assert.ok(dec1?.sdp);
  assert.match(dec1.sdp, /a=ice-ufrag:AbCd/);

  // Código com ponto final acidental colado
  const comPonto = `${cod}.`;
  const dec2 = await decodificar('resposta', comPonto);
  assert.ok(dec2?.sdp);
  assert.match(dec2.sdp, /a=ice-ufrag:AbCd/);

  // Código contínuo sem espaços
  const continuo = cod.replace(/\s+/g, '');
  const dec3 = await decodificar('resposta', continuo);
  assert.ok(dec3?.sdp);
  assert.match(dec3.sdp, /a=ice-ufrag:AbCd/);
});

