import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { viewJogo } from '../src/ui/views.js';
import { viewModalMultiplayer } from '../src/ui/views-multi.js';
import { novaSala, adicionarPessoa } from '../src/net/sala.js';

test('viewModalMultiplayer: renderiza tela de escolha', () => {
  const html = viewModalMultiplayer({ tela: 'escolha' });
  assert.match(html, /Multiplayer em Rede Local/);
  assert.match(html, /data-acao="ABRIR_CRIAR_SALA"/);
  assert.match(html, /data-acao="ABRIR_ENTRAR_SALA"/);
  assert.match(html, /data-acao="FECHAR_MODAL_MULTI"/);
});

test('viewModalMultiplayer: entrar passo 1 e passo 2', () => {
  const p1 = viewModalMultiplayer({ tela: 'entrar_passo1', nome: 'Carlos' });
  assert.match(p1, /Passo 1 de 2/);
  assert.match(p1, /name="nome_convidado"/);
  assert.match(p1, /value="Carlos"/);
  assert.match(p1, /data-acao="GERAR_PEDIDO"/);

  const p2 = viewModalMultiplayer({
    tela: 'entrar_passo2',
    codigoPedido: 'CEO1P.XYZ',
    conectando: false,
    tempoDecorrido: 5,
  });
  assert.match(p2, /Passo 2 de 2/);
  assert.match(p2, /CEO1P\.XYZ/);
  assert.match(p2, /data-acao="COPIAR_CODIGO_PEDIDO"/);
  assert.match(p2, /name="codigo_resposta"/);
  assert.match(p2, /data-acao="CONECTAR_RESPOSTA"/);
  assert.doesNotMatch(p2, /A conexão está demorando/);

  const p2Lento = viewModalMultiplayer({
    tela: 'entrar_passo2',
    codigoPedido: 'CEO1P.XYZ',
    conectando: true,
    tempoDecorrido: 16,
  });
  assert.match(p2Lento, /A conexão está demorando/);
  assert.match(p2Lento, /mesma rede local/);
});

test('viewModalMultiplayer: lobby do dono e lobby do convidado', () => {
  let sala = novaSala({ vagas: 3, nomeDono: 'Alice' });
  const add = adicionarPessoa(sala, { nome: 'Bob' });
  sala = add.sala;

  const htmlDono = viewModalMultiplayer({
    tela: 'lobby_dono',
    visaoHost: { sala },
    respostaGerada: { codigo: 'CEO1R.RESP', nome: 'Bob' },
  });
  assert.match(htmlDono, /Lobby da Sala \(Anfitrião\)/);
  assert.match(htmlDono, /Alice/);
  assert.match(htmlDono, /Bob/);
  assert.match(htmlDono, /👑 Anfitrião/);
  assert.match(htmlDono, /data-acao="INICIAR_SALA"/);
  assert.match(htmlDono, /data-acao="ENCERRAR_SALA"/);
  assert.match(htmlDono, /CEO1R\.RESP/);

  const htmlConvidado = viewModalMultiplayer({
    tela: 'lobby_convidado',
    visaoConvidado: { sala, voce: add.chave },
  });
  assert.match(htmlConvidado, /Lobby da Sala \(Convidado\)/);
  assert.match(htmlConvidado, /Bob \(Você\)/);
  assert.match(htmlConvidado, /Aguardando o anfitrião iniciar/);
  assert.match(htmlConvidado, /data-acao="SAIR_SALA"/);
});

test('viewJogo em multiplayer: vez própria vs modo espectador', () => {
  const e = novoJogo({
    jogadores: [
      { nome: 'Alice', nivel: 'iniciante' },
      { nome: 'Bob', nivel: 'avancado' },
    ],
    seed: 42,
  });

  // Alice joga (jogadorAtual = 0)
  const htmlMinhaVez = viewJogo(e, { meuId: 0, papelRede: 'anfitriao' });
  assert.match(htmlMinhaVez, /banner-vez sua-vez/);
  assert.match(htmlMinhaVez, /É a sua vez!/);
  assert.match(htmlMinhaVez, /data-acao="ROLAR"/);
  assert.doesNotMatch(htmlMinhaVez, /disabled/);

  // Bob assiste (meuId = 1, jogadorAtual = 0)
  const htmlEspectador = viewJogo(e, { meuId: 1, papelRede: 'convidado' });
  assert.match(htmlEspectador, /banner-vez espectador/);
  assert.match(htmlEspectador, /Vez de <strong>Alice<\/strong>/);
  assert.match(htmlEspectador, /Aguardando <strong>Alice<\/strong> jogar os dados/);
  assert.doesNotMatch(htmlEspectador, /<button class="primario cta-jogar" data-acao="ROLAR">/);

  // Alice sem conexão
  const htmlSemConexao = viewJogo(e, { meuId: 1, sem: [0], papelRede: 'convidado' });
  assert.match(htmlSemConexao, /<strong>Alice<\/strong> está sem conexão/);
});

test('viewJogo na fase de decisão: botões desabilitados para espectadores', () => {
  let e = novoJogo({
    jogadores: [
      { nome: 'Alice', nivel: 'iniciante' },
      { nome: 'Bob', nivel: 'iniciante' },
    ],
    seed: 42,
    teste: { casa: 'decisao' },
  });
  e = reduzir(e, { tipo: 'ROLAR' });
  assert.equal(e.fase, 'ESCOLHER_METRICA');

  // Bob assistindo Alice escolher a métrica
  const htmlBob = viewJogo(e, { meuId: 1, papelRede: 'convidado' });
  assert.match(htmlBob, /Qual métrica Alice escolhe\?/);
  assert.match(htmlBob, /opcoes-desabilitadas/);
  assert.match(htmlBob, /disabled/);

  // Alice jogando
  const htmlAlice = viewJogo(e, { meuId: 0, papelRede: 'anfitriao' });
  assert.match(htmlAlice, /1\. Qual métrica você escolhe\?/);
  assert.doesNotMatch(htmlAlice, /opcoes-desabilitadas/);
});

test('viewJogo no fim de jogo: anfitrião com revanche e relatórios colapsados', () => {
  const e = novoJogo({
    jogadores: [
      { nome: 'Alice', nivel: 'iniciante' },
      { nome: 'Bob', nivel: 'iniciante' },
    ],
    seed: 123,
  });
  e.fase = 'FIM_DE_JOGO';

  // Fim para anfitrião (Alice, meuId = 0)
  const htmlDono = viewJogo(e, { meuId: 0, papelRede: 'anfitriao' });
  assert.match(htmlDono, /data-acao="REVANCHE"/);
  assert.match(htmlDono, /data-acao="ENCERRAR_SALA"/);
  assert.match(htmlDono, /Relatório de Bob/);
  assert.match(htmlDono, /<details class="relatorio-outro">/);

  // Fim para convidado (Bob, meuId = 1)
  const htmlConvidado = viewJogo(e, { meuId: 1, papelRede: 'convidado' });
  assert.match(htmlConvidado, /data-acao="SAIR_SALA"/);
  assert.match(htmlConvidado, /Aguardando o anfitrião iniciar uma revanche/);
  assert.match(htmlConvidado, /Relatório de Alice/);
  assert.match(htmlConvidado, /<details class="relatorio-outro">/);
});

test('viewModalMultiplayer: lobby com convite ativo renderiza QR Code SVG e botões de link', () => {
  const sala = novaSala({ vagas: 2, nomeDono: 'Alice' });
  const html = viewModalMultiplayer({
    tela: 'lobby_dono',
    visaoHost: { sala },
    conviteAtivo: {
      codigo: 'CEO1P.TESTE',
      link: 'http://localhost:8000/#CEO1P.TESTE',
    },
  });
  assert.match(html, /<svg class="qrcode-svg"/);
  assert.match(html, /data-acao="COPIAR_LINK_CONVITE"/);
  assert.match(html, /data-acao="COMPARTILHAR_CONVITE"/);
  assert.match(html, /data-acao="ABRIR_CAMERA"/);
});

test('viewModalMultiplayer: tela entrar_confirmacao renderiza QR Code de resposta e espera', () => {
  const html = viewModalMultiplayer({
    tela: 'entrar_confirmacao',
    nome: 'Bia',
    confirmacaoAtiva: {
      codigo: 'CEO1R.RESP',
      link: 'http://localhost:8000/#CEO1R.RESP',
    },
  });
  assert.match(html, /Quase lá, Bia!/);
  assert.match(html, /<svg class="qrcode-svg"/);
  assert.match(html, /data-acao="COPIAR_LINK_CONFIRMACAO"/);
  assert.match(html, /data-acao="COMPARTILHAR_CONFIRMACAO"/);
  assert.match(html, /Aguardando o anfitrião confirmar a sua entrada/);
});

test('viewModalMultiplayer: cameraAtiva renderiza elemento de vídeo', () => {
  const sala = novaSala({ vagas: 2, nomeDono: 'Alice' });
  const html = viewModalMultiplayer({
    tela: 'lobby_dono',
    visaoHost: { sala },
    cameraAtiva: true,
  });
  assert.match(html, /<video id="camera-preview"/);
  assert.match(html, /data-acao="FECHAR_CAMERA"/);
});

