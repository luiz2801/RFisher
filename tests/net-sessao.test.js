import test from 'node:test';
import assert from 'node:assert/strict';
import { criarAnfitriao, SEM_SINAL_AVISO_MS, SEM_SINAL_BOT_MS, PENDENTE_MAX_MS, PAUSA_BOT_MS, PAUSA_LEITURA_MS } from '../src/net/anfitriao.js';
import { criarConvidado } from '../src/net/convidado.js';
import { ehBot } from '../src/engine/state.js';
import { parTransportes, drenar, relogioFalso } from './helpers/transporte-falso.js';
import { acaoHumana } from './helpers/partida.js';

// Anfitrião com relógio e agendador falsos; `entrar` liga um convidado por um transporte falso.
function montar({ vagas = 3, config = {} } = {}) {
  const tempo = relogioFalso();
  const visoes = [];
  const host = criarAnfitriao({
    nomeDono: 'Dora', vagas, config, relogio: tempo.relogio, agendar: tempo.agendar, cancelar: tempo.cancelar,
    aleatorio: () => 0.25, aoMudar: (v) => visoes.push(v),
  });
  async function entrar(nome, opcoes) {
    const par = parTransportes(opcoes);
    const visoesConv = [];
    const id = host.receberPedido({ nome, transporte: par.a });
    const conv = criarConvidado({ transporte: par.b, relogio: tempo.relogio, aoMudar: (v) => visoesConv.push(v) });
    await drenar();
    return { conv, par, id, visoes: visoesConv };
  }
  return { host, tempo, visoes, entrar };
}

const chaves = (host) => host.sala().pessoas.map((p) => p.chave);

// Joga a partida inteira com pessoas (o dono e os convidados), deixando o piloto cuidar dos bots.
async function jogarAteOFim({ host, tempo }, convidados, limite = 3000) {
  for (let i = 0; i < limite && host.estado().fase !== 'FIM_DE_JOGO'; i++) {
    const e = host.estado();
    const vez = e.jogadorAtual;
    if (ehBot(e.jogadores[vez])) {
      assert.ok(tempo.rodarProxima(), `o piloto não agendou o bot (fase ${e.fase})`);
    } else if (vez === 0) {
      assert.ok(host.jogar(acaoHumana(e)), `ação do dono recusada na fase ${e.fase}`);
    } else {
      const conv = convidados[vez - 1];
      assert.ok(conv.acao(acaoHumana(e)), `convidado ${vez} não pôde agir na fase ${e.fase}`);
    }
    await drenar();
  }
  assert.equal(host.estado().fase, 'FIM_DE_JOGO');
}

test('lobby: o convidado entra, recebe a sala e o dono vê a vaga ocupada', async () => {
  const { host, entrar } = montar();
  const a = await entrar('Ana');
  assert.deepEqual(host.sala().pessoas.map((p) => p.nome), ['Dora', 'Ana']);
  const v = a.conv.visao();
  assert.equal(v.conectado, true);
  assert.equal(v.voce, 'c1');
  assert.equal(v.sala.pessoas.length, 2);
  assert.equal(v.estado, null);
  assert.equal(host.visao().vagasLivres, 1);
});

test('lobby: perfil do convidado e do dono chegam a todos', async () => {
  const { host, entrar } = montar();
  const a = await entrar('Ana');
  const b = await entrar('Bia');
  a.conv.perfil({ nome: 'Ana S.', nivel: 'avancado', diretoria: 'tecnologia' });
  await drenar();
  assert.deepEqual(host.sala().pessoas[1], { chave: 'c1', nome: 'Ana S.', nivel: 'avancado', diretoria: 'tecnologia' });
  assert.equal(b.conv.visao().sala.pessoas[1].nome, 'Ana S.');
  host.definirPerfilDono({ nome: 'Dora C.', nivel: 'avancado' });
  await drenar();
  assert.equal(a.conv.visao().sala.pessoas[0].nome, 'Dora C.');
});

test('sala cheia recusa o pedido e fecha a conexão; sem vaga, não se gera resposta', async () => {
  const { host, entrar } = montar({ vagas: 2 });
  await entrar('Ana');
  assert.equal(host.podeReceber(), false);
  const par = parTransportes();
  assert.equal(host.receberPedido({ nome: 'Caio', transporte: par.a }), null);
  await drenar();
  assert.equal(host.sala().pessoas.length, 2);
});

test('pedido que nunca conecta não ocupa a vaga para sempre', async () => {
  const { host, tempo, entrar } = montar({ vagas: 2 });
  await entrar('Fantasma', { conectarAoCriar: false });
  assert.equal(host.sala().pessoas.length, 1, 'ainda não conectou: sem vaga');
  assert.equal(host.visao().pendentes.length, 1);
  assert.equal(host.podeReceber(), false, 'a vaga fica reservada enquanto aguarda');
  tempo.avancar(PENDENTE_MAX_MS);
  host.tick();
  assert.equal(host.visao().pendentes.length, 0);
  assert.equal(host.podeReceber(), true);
});

test('dono pode cancelar um pedido pendente', async () => {
  const { host, entrar } = montar({ vagas: 2 });
  const { id } = await entrar('Fantasma', { conectarAoCriar: false });
  host.cancelarPedido(id);
  assert.equal(host.visao().pendentes.length, 0);
});

test('iniciar exige 2 pessoas e setores diferentes; depois todos recebem o mesmo estado', async () => {
  const { host, entrar } = montar({ config: { seed: 3, turnos: 2 } });
  assert.match(host.iniciar().erro, /mais uma pessoa/);
  const a = await entrar('Ana');
  const b = await entrar('Bia');
  assert.deepEqual(await Promise.resolve(host.iniciar()), { ok: true, erro: null });
  await drenar();
  const e = host.estado();
  assert.equal(e.jogadores.length, 3);
  assert.deepEqual(a.conv.visao().estado, e);
  assert.deepEqual(b.conv.visao().estado, e);
  assert.equal(a.conv.visao().meuId, 1);
  assert.equal(b.conv.visao().meuId, 2);
  assert.equal(host.visao().meuId, 0);
  assert.equal(host.sala().fase, 'jogando');
});

test('setor repetido bloqueia o início', async () => {
  const { host, entrar } = montar({ vagas: 2, config: { modo: 'competitivo' } });
  const a = await entrar('Ana');
  a.conv.perfil({ nome: 'Ana', nivel: 'iniciante', diretoria: host.sala().pessoas[0].diretoria });
  await drenar();
  assert.match(host.iniciar().erro, /mesmo setor/);
  assert.equal(host.estado(), null);
});

test('só a pessoa da vez age: fora da vez, a ação é ignorada e o convidado é ressincronizado', async () => {
  const { host, entrar } = montar({ vagas: 2, config: { seed: 5 } });
  const a = await entrar('Ana');
  host.iniciar();
  await drenar();
  const antes = host.estado();
  assert.equal(antes.jogadorAtual, 0);
  assert.equal(a.conv.acao({ tipo: 'ROLAR' }), false, 'o convidado nem envia');
  a.par.b.enviar(JSON.stringify({ tipo: 'acao', acao: { tipo: 'ROLAR' } })); // convidado hostil
  await drenar();
  assert.equal(host.estado(), antes);
  assert.equal(host.jogar({ tipo: 'ROLAR' }), true);
  await drenar();
  assert.deepEqual(a.conv.visao().estado, host.estado());
});

test('um convidado não consegue agir pelo dono nem usar ação proibida', async () => {
  const { host, entrar } = montar({ vagas: 2, config: { seed: 5 } });
  const a = await entrar('Ana');
  host.iniciar();
  host.jogar({ tipo: 'ROLAR' });
  host.jogar(acaoHumana(host.estado()));
  while (host.estado().jogadorAtual === 0) host.jogar(acaoHumana(host.estado()));
  await drenar();
  const e = host.estado();
  assert.equal(e.jogadorAtual, 1);
  a.par.b.enviar(JSON.stringify({ tipo: 'acao', acao: { tipo: 'DECIDIR_BOT' } }));
  a.par.b.enviar(JSON.stringify({ tipo: 'estado', estado: { fase: 'FIM_DE_JOGO', jogadores: [] } }));
  await drenar();
  assert.equal(host.estado(), e);
});

test('mensagens malformadas e enormes são ignoradas sem derrubar nada', async () => {
  const { host, entrar } = montar({ vagas: 2 });
  const a = await entrar('Ana');
  host.iniciar();
  await drenar();
  const antes = host.estado();
  for (const lixo of ['', 'não é json', '[]', 'null', '{"tipo":"acao"}', '{"tipo":"acao","acao":{"tipo":"ROLAR","valor":{}}}', 'x'.repeat(5000), '{"tipo":"__proto__"}']) {
    a.par.b.enviar(lixo);
  }
  await drenar();
  assert.equal(host.estado(), antes);
  assert.equal(host.sala().pessoas.length, 2);
});

test('partida completa entre o dono e dois convidados, com os mesmos estados em todas as telas', async () => {
  const m = montar({ config: { seed: 8, turnos: 2 } });
  const a = await m.entrar('Ana');
  const b = await m.entrar('Bia');
  m.host.iniciar();
  await drenar();
  await jogarAteOFim(m, [a.conv, b.conv]);
  assert.equal(a.conv.visao().estado.fase, 'FIM_DE_JOGO');
  assert.deepEqual(a.conv.visao().estado, m.host.estado());
  assert.deepEqual(b.conv.visao().estado, m.host.estado());
});

test('queda de convidado no meio da partida: vira bot, todos são avisados e a partida termina', async () => {
  const m = montar({ vagas: 2, config: { seed: 6, turnos: 2 } });
  const a = await m.entrar('Ana');
  m.host.iniciar();
  await drenar();
  for (let i = 0; i < 3; i++) m.host.jogar(acaoHumana(m.host.estado()));
  while (m.host.estado().jogadorAtual === 0) m.host.jogar(acaoHumana(m.host.estado()));
  a.par.ladoA.derrubar();
  await drenar();
  const e = m.host.estado();
  assert.equal(e.jogadores[1].bot, 'medio');
  assert.equal(e.jogadores[1].nome, 'Ana (bot)');
  assert.match(m.host.visao().aviso.texto, /Ana saiu da partida e agora é um bot/);
  assert.equal(m.tempo.pendentes(), 1, 'o piloto agendou a vez do bot');
  await jogarAteOFim(m, []);
});

test('o piloto espera entre os passos do bot (mais nas telas de resultado)', async () => {
  const m = montar({ vagas: 2, config: { seed: 6, turnos: 2 } });
  const a = await m.entrar('Ana');
  m.host.iniciar();
  a.par.ladoA.derrubar();
  await drenar();
  while (m.host.estado().jogadorAtual === 0 && m.host.estado().fase !== 'FIM_DE_JOGO') m.host.jogar(acaoHumana(m.host.estado()));
  const duracoes = new Set();
  for (let i = 0; i < 40 && m.host.estado().jogadorAtual === 1; i++) {
    duracoes.add(m.tempo.ultimoMs());
    m.tempo.rodarProxima();
  }
  assert.ok(duracoes.has(PAUSA_BOT_MS));
  assert.ok(duracoes.has(PAUSA_LEITURA_MS));
});

test('sinal: sem resposta aparece "sem conexão" aos 8 s e a vaga vira bot aos 60 s', async () => {
  const m = montar({ vagas: 2, config: { seed: 6 } });
  const a = await m.entrar('Ana');
  m.host.iniciar();
  await drenar();
  // com o pong chegando, o convidado nunca é marcado
  for (let i = 0; i < 6; i++) {
    m.tempo.avancar(7000);
    m.host.tick();
    await drenar();
  }
  assert.deepEqual(m.host.visao().sem, []);
  a.par.ladoA.cortarSinal();
  m.tempo.avancar(SEM_SINAL_AVISO_MS);
  m.host.tick();
  assert.deepEqual(m.host.visao().sem, [1]);
  assert.deepEqual(m.host.visao().semChaves, ['c1']);
  assert.match(m.host.visao().aviso.texto, /Ana está sem conexão/);
  assert.equal(m.host.estado().jogadores[1].bot, null, 'ainda é pessoa: a partida espera por ela');
  m.tempo.avancar(SEM_SINAL_BOT_MS - SEM_SINAL_AVISO_MS);
  m.host.tick();
  assert.equal(m.host.estado().jogadores[1].bot, 'medio');
  assert.deepEqual(m.host.visao().sem, []);
});

test('quando a conexão oscila e volta, a marca de "sem conexão" some', async () => {
  const m = montar({ vagas: 2, config: { seed: 6 } });
  const a = await m.entrar('Ana');
  m.host.iniciar();
  await drenar();
  a.par.ladoA.mudar('instavel');
  assert.deepEqual(m.host.visao().sem, [1]);
  assert.deepEqual(a.conv.visao().sem, [], 'o convidado só sabe depois do próximo broadcast');
  a.par.ladoA.mudar('conectado');
  assert.deepEqual(m.host.visao().sem, []);
});

test('dono passa a vaga de quem parou de jogar para um bot', async () => {
  const m = montar({ vagas: 2, config: { seed: 6 } });
  const a = await m.entrar('Ana');
  m.host.iniciar();
  await drenar();
  m.host.passarParaBot('c1');
  await drenar();
  assert.equal(m.host.estado().jogadores[1].bot, 'medio');
  assert.match(m.host.visao().aviso.texto, /Ana passou a vaga para um bot/);
  assert.equal(a.conv.visao().encerrada, true, 'a conexão de quem saiu é fechada');
  m.host.passarParaBot('dono'); // o dono não se passa para bot
  assert.equal(m.host.estado().jogadores[0].bot, null);
});

test('convidado que sai pelo botão: libera a vaga no lobby e vira bot na partida', async () => {
  const m = montar({ vagas: 3, config: { seed: 6 } });
  const a = await m.entrar('Ana');
  const b = await m.entrar('Bia');
  a.conv.sair();
  await drenar();
  assert.deepEqual(chaves(m.host), ['dono', 'c2']);
  assert.equal(m.host.podeReceber(), true);
  assert.equal(a.conv.visao().motivo, 'saiu');
  m.host.iniciar();
  await drenar();
  b.conv.sair();
  await drenar();
  assert.equal(m.host.estado().jogadores[1].bot, 'medio');
});

test('com a partida em andamento ninguém entra', async () => {
  const m = montar({ vagas: 3, config: { seed: 6 } });
  await m.entrar('Ana');
  m.host.iniciar();
  assert.equal(m.host.podeReceber(), false);
  const par = parTransportes();
  assert.equal(m.host.receberPedido({ nome: 'Tarde', transporte: par.a }), null);
});

test('perfil enviado durante a partida é ignorado', async () => {
  const m = montar({ vagas: 2, config: { seed: 6 } });
  const a = await m.entrar('Ana');
  m.host.iniciar();
  await drenar();
  assert.equal(a.conv.perfil({ nome: 'Outro', nivel: 'avancado', diretoria: 'tecnologia' }), false);
  a.par.b.enviar(JSON.stringify({ tipo: 'perfil', nome: 'Outro', nivel: 'avancado', diretoria: 'tecnologia' }));
  await drenar();
  assert.equal(m.host.sala().pessoas[1].nome, 'Ana');
});

test('dono encerra: convidados são avisados; dono cai: convidados veem a conexão cair', async () => {
  const m = montar({ vagas: 3 });
  const a = await m.entrar('Ana');
  m.host.encerrar();
  await drenar();
  assert.equal(a.conv.visao().encerrada, true);
  assert.equal(a.conv.visao().motivo, 'dono');
  assert.equal(m.host.visao().encerrada, true);
  assert.equal(m.host.podeReceber(), false);

  const m2 = montar({ vagas: 3 });
  const b = await m2.entrar('Bia');
  b.par.ladoB.derrubar();
  await drenar();
  assert.equal(b.conv.visao().motivo, 'conexao');
  assert.equal(b.conv.acao({ tipo: 'ROLAR' }), false);
});

test('convidado avisa "sem conexão com o dono" após 8 s de silêncio e limpa ao receber algo', async () => {
  const m = montar({ vagas: 2 });
  const a = await m.entrar('Ana');
  m.tempo.avancar(SEM_SINAL_AVISO_MS);
  a.conv.tick();
  assert.equal(a.conv.visao().semDono, true);
  m.host.tick(); // o ping do dono chega
  await drenar();
  assert.equal(a.conv.visao().semDono, false);
});

test('revanche: volta ao lobby sem trocar códigos; vagas de bot ficam fora', async () => {
  const m = montar({ config: { seed: 4, turnos: 1 } });
  const a = await m.entrar('Ana');
  const b = await m.entrar('Bia');
  m.host.iniciar();
  await drenar();
  assert.equal(m.host.revanche(), false, 'só no fim do jogo');
  b.par.ladoA.derrubar(); // Bia cai e vira bot
  await drenar();
  await jogarAteOFim(m, [a.conv]);
  assert.equal(m.host.revanche(), true);
  await drenar();
  assert.equal(m.host.sala().fase, 'lobby');
  assert.deepEqual(chaves(m.host), ['dono', 'c1']);
  assert.equal(m.host.estado(), null);
  assert.equal(a.conv.visao().estado, null);
  assert.equal(a.conv.visao().sala.fase, 'lobby');
  assert.equal(m.host.podeReceber(), true);
  // nova partida na mesma sala, sem trocar códigos
  assert.equal(m.host.iniciar().ok, true);
  await drenar();
  assert.equal(a.conv.visao().estado.fase, 'ROLAR_DADO');
  assert.equal(a.conv.visao().meuId, 1);
});

test('queda no fim do jogo não cria bot nem aviso', async () => {
  const m = montar({ vagas: 2, config: { seed: 4, turnos: 1 } });
  const a = await m.entrar('Ana');
  m.host.iniciar();
  await drenar();
  await jogarAteOFim(m, [a.conv]);
  a.par.ladoA.derrubar();
  await drenar();
  assert.equal(m.host.estado().jogadores[1].bot, null);
});

test('encerrar cancela o piloto dos bots', async () => {
  const m = montar({ vagas: 2, config: { seed: 6 } });
  const a = await m.entrar('Ana');
  m.host.iniciar();
  a.par.ladoA.derrubar();
  await drenar();
  while (m.host.estado().jogadorAtual === 0) m.host.jogar(acaoHumana(m.host.estado()));
  assert.equal(m.tempo.pendentes(), 1);
  m.host.encerrar();
  assert.equal(m.tempo.pendentes(), 0);
});

test('o dono não joga fora da vez e a visão do dono traz o id 0 só durante a partida', async () => {
  const m = montar({ vagas: 2, config: { seed: 6 } });
  await m.entrar('Ana');
  assert.equal(m.host.visao().meuId, null);
  assert.equal(m.host.jogar({ tipo: 'ROLAR' }), false, 'sem partida');
  m.host.iniciar();
  while (m.host.estado().jogadorAtual === 0) m.host.jogar(acaoHumana(m.host.estado()));
  assert.equal(m.host.jogar({ tipo: 'ROLAR' }), false, 'vez da Ana');
  assert.equal(m.host.visao().meuId, 0);
});
