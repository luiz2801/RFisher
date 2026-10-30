import test from 'node:test';
import assert from 'node:assert/strict';
import {
  novaSala, podeEntrar, adicionarPessoa, removerPessoa, definirPerfil, definirConfig, validarInicio, argumentosNovoJogo,
  iniciarPartida, idNoJogo, acaoPermitida, substituirPorBot, voltarAoLobby, configLimpa, CHAVE_DONO,
} from '../src/net/sala.js';
import { jogadorAtual, ehBot } from '../src/engine/state.js';
import { DIRETORIAS } from '../src/engine/papeis.js';

const DIRS = Object.keys(DIRETORIAS);

// Sala com o dono e mais `n` pessoas, cada uma com um setor diferente.
function salaCom(n, { vagas = 3, config = {} } = {}) {
  let sala = novaSala({ vagas, config, nomeDono: 'Dora' });
  for (let i = 0; i < n; i++) sala = adicionarPessoa(sala, { nome: `Conv ${i + 1}` }).sala;
  return sala;
}

test('sala nova: só o dono, em lobby, com vagas limitadas a 2 ou 3', () => {
  const s = novaSala({ nomeDono: 'Dora' });
  assert.equal(s.fase, 'lobby');
  assert.equal(s.vagas, 2);
  assert.deepEqual(s.pessoas.map((p) => [p.chave, p.nome]), [[CHAVE_DONO, 'Dora']]);
  assert.equal(novaSala({ vagas: 9 }).vagas, 3);
  assert.equal(novaSala({ vagas: 1 }).vagas, 2);
  assert.equal(novaSala({ vagas: 'abc' }).vagas, 2);
});

test('entrada na ordem de chegada; sala cheia recusa; setores nascem diferentes', () => {
  let s = novaSala({ vagas: 3 });
  const a = adicionarPessoa(s, { nome: 'Ana' });
  const b = adicionarPessoa(a.sala, { nome: 'Bia' });
  assert.deepEqual(b.sala.pessoas.map((p) => p.nome), ['Jogador 1', 'Ana', 'Bia']);
  assert.equal(new Set(b.sala.pessoas.map((p) => p.diretoria)).size, 3);
  assert.equal(podeEntrar(b.sala), false);
  assert.equal(adicionarPessoa(b.sala, { nome: 'Caio' }), null);
  assert.notEqual(a.chave, b.chave);
  assert.equal(s.pessoas.length, 1, 'a sala original não muda');
});

test('chaves não se repetem mesmo depois de alguém sair', () => {
  let s = novaSala({ vagas: 3 });
  const a = adicionarPessoa(s, { nome: 'Ana' });
  s = removerPessoa(a.sala, a.chave);
  const b = adicionarPessoa(s, { nome: 'Bia' });
  assert.notEqual(a.chave, b.chave);
});

test('nome vazio ou longo é tratado', () => {
  const a = adicionarPessoa(novaSala({ vagas: 2 }), { nome: '   ' });
  assert.equal(a.sala.pessoas[1].nome, 'Jogador 2');
  const b = adicionarPessoa(novaSala({ vagas: 2 }), { nome: 'x'.repeat(50) });
  assert.equal(b.sala.pessoas[1].nome.length, 20);
});

test('o dono não sai da sala; quem sai libera a vaga', () => {
  const s = salaCom(1, { vagas: 2 });
  assert.equal(removerPessoa(s, CHAVE_DONO), s);
  const sem = removerPessoa(s, s.pessoas[1].chave);
  assert.equal(sem.pessoas.length, 1);
  assert.equal(podeEntrar(sem), true);
});

test('perfil: nível e diretoria válidos mudam; inválidos são ignorados', () => {
  const s = salaCom(1, { vagas: 2 });
  const chave = s.pessoas[1].chave;
  const antes = s.pessoas[1];
  const p = definirPerfil(s, chave, { nome: ' Zé ', nivel: 'avancado', diretoria: 'tecnologia' }).pessoas[1];
  assert.deepEqual([p.nome, p.nivel, p.diretoria], ['Zé', 'avancado', 'tecnologia']);
  const ruim = definirPerfil(s, chave, { nome: '', nivel: 'deus', diretoria: 'constructor' }).pessoas[1];
  assert.deepEqual([ruim.nome, ruim.nivel, ruim.diretoria], [antes.nome, antes.nivel, antes.diretoria]);
  assert.equal(definirPerfil(s, 'inexistente', { nome: 'X' }).pessoas.length, 2);
});

test('config: modo e vagas; as vagas nunca ficam abaixo de quem já entrou', () => {
  const s = salaCom(2, { vagas: 3 });
  assert.equal(definirConfig(s, { vagas: 2 }).vagas, 3);
  assert.equal(definirConfig(s, { config: { modo: 'cooperativo' } }).config.modo, 'cooperativo');
  assert.equal(definirConfig(s, { config: { modo: 'solo' } }).config.modo, 'competitivo', 'solo não existe em rede');
  assert.equal(definirConfig(novaSala({ vagas: 2 }), { vagas: 3 }).vagas, 3);
});

test('configLimpa: lixo vira padrão', () => {
  const c = configLimpa({ modo: 'x', turnos: 'abc', seed: -4, teste: { casa: 'lua', cenarios: [1, 'a'] } });
  assert.deepEqual(c, { modo: 'competitivo', turnos: null, dinheiroInicial: null, reputacaoInicial: null, progressao: null, seed: null, teste: { casa: null, cenarios: ['a'] } });
  assert.equal(configLimpa({ turnos: '12' }).turnos, 12);
  assert.equal(configLimpa({ turnos: '' }).turnos, null);
});

test('início exige pelo menos 2 pessoas', () => {
  const v = validarInicio(novaSala({ vagas: 3 }));
  assert.equal(v.ok, false);
  assert.match(v.erro, /mais uma pessoa/);
  assert.equal(validarInicio(salaCom(1)).ok, true);
  assert.equal(iniciarPartida(novaSala()), null);
});

test('setor repetido bloqueia o início (competitivo e cooperativo com 3) mas não o cooperativo com 2', () => {
  const rep = (s) => {
    const p = s.pessoas;
    return p.reduce((acc, x) => definirPerfil(acc, x.chave, { diretoria: DIRS[0] }), s);
  };
  assert.equal(validarInicio(rep(salaCom(1, { config: { modo: 'competitivo' } }))).ok, false);
  assert.match(validarInicio(rep(salaCom(1, { config: { modo: 'competitivo' } }))).erro, /mesmo setor/);
  assert.equal(validarInicio(rep(salaCom(2, { config: { modo: 'cooperativo' } }))).ok, false);
  assert.equal(validarInicio(rep(salaCom(1, { config: { modo: 'cooperativo' } }))).ok, true);
});

test('iniciarPartida cria o jogo nos dois modos, na ordem de entrada', () => {
  for (const modo of ['competitivo', 'cooperativo']) {
    const sala = salaCom(2, { config: { modo, turnos: 5, seed: 7 } });
    const { sala: viva, estado } = iniciarPartida(sala);
    assert.equal(viva.fase, 'jogando');
    assert.deepEqual(viva.ordem, [CHAVE_DONO, 'c1', 'c2']);
    assert.equal(estado.modo, modo);
    assert.equal(estado.turnosPorJogador, 5);
    assert.equal(estado.seed, 7);
    assert.deepEqual(estado.jogadores.map((j) => j.nome), ['Dora', 'Conv 1', 'Conv 2']);
    assert.equal(estado.jogadores.some(ehBot), false);
    assert.equal(estado.empresa !== null, modo === 'cooperativo');
    assert.equal(idNoJogo(viva, 'c2'), 2);
    assert.equal(idNoJogo(viva, 'zzz'), -1);
    assert.equal(idNoJogo(sala, 'c1'), -1, 'antes de iniciar não há ordem');
  }
});

test('sem semente escolhida, sorteia uma com o gerador injetado', () => {
  const a = argumentosNovoJogo(salaCom(1), () => 0.5);
  assert.equal(a.seed, 2 ** 31);
  assert.equal(argumentosNovoJogo(salaCom(1, { config: { seed: 9 } }), () => 0.5).seed, 9);
});

test('teste do menu vale para a sala e a partida fica marcada', () => {
  const { estado } = iniciarPartida(salaCom(1, { config: { teste: { casa: 'mercado' } } }));
  assert.equal(estado.teste.casa, 'mercado');
  assert.equal(iniciarPartida(salaCom(1)).estado.teste, null);
});

test('acaoPermitida: só a vez de uma pessoa, ação da lista, valor pequeno', () => {
  const { estado } = iniciarPartida(salaCom(2, { config: { seed: 3 } }));
  assert.equal(jogadorAtual(estado).id, 0);
  assert.equal(acaoPermitida(estado, 0, { tipo: 'ROLAR' }), true);
  assert.equal(acaoPermitida(estado, 1, { tipo: 'ROLAR' }), false, 'fora da vez');
  assert.equal(acaoPermitida(estado, 0, { tipo: 'DECIDIR_BOT' }), false);
  assert.equal(acaoPermitida(estado, 0, { tipo: 'FOO' }), false);
  assert.equal(acaoPermitida(estado, 0, { tipo: 'METRICA', valor: 'x'.repeat(65) }), false);
  assert.equal(acaoPermitida(estado, 0, { tipo: 'METRICA', valor: { a: 1 } }), false);
  assert.equal(acaoPermitida(estado, 0, { tipo: 'INVESTIR', valor: 10000 }), true);
  assert.equal(acaoPermitida(estado, 0, null), false);
  assert.equal(acaoPermitida(estado, '0', { tipo: 'ROLAR' }), false);
  assert.equal(acaoPermitida(estado, undefined, { tipo: 'ROLAR' }), false);
  assert.equal(acaoPermitida(null, 0, { tipo: 'ROLAR' }), false);
});

test('acaoPermitida: vaga de bot nunca age, nem no fim do jogo', () => {
  const { estado } = iniciarPartida(salaCom(1, { vagas: 2, config: { seed: 3 } }));
  const comBot = substituirPorBot(estado, 0);
  assert.equal(acaoPermitida(comBot, 0, { tipo: 'ROLAR' }), false);
  assert.equal(acaoPermitida({ ...estado, fase: 'FIM_DE_JOGO' }, 0, { tipo: 'CONTINUAR' }), false);
});

test('substituirPorBot: perfil médio, mesmo nível e histórico, nome com (bot), RNG intacto', () => {
  const sala = definirPerfil(salaCom(1, { vagas: 2, config: { seed: 5 } }), 'c1', { nivel: 'avancado' });
  const { estado } = iniciarPartida(sala);
  estado.jogadores[1].historico.push({ conceito: 'media' });
  const novo = substituirPorBot(estado, 1);
  const j = novo.jogadores[1];
  assert.equal(j.bot, 'medio');
  assert.equal(j.nivel, 'avancado');
  assert.equal(j.nome, 'Conv 1 (bot)');
  assert.equal(j.substituido, true);
  assert.deepEqual(j.historico, [{ conceito: 'media' }]);
  assert.deepEqual(novo.rng, estado.rng);
  assert.equal(estado.jogadores[1].bot, null, 'o estado original não muda');
  assert.equal(substituirPorBot(novo, 1), novo, 'já é bot: nada muda');
  assert.equal(substituirPorBot(estado, 9), estado);
});

test('revanche: volta ao lobby só com quem ficou, mantendo perfis; o dono nunca sai', () => {
  let sala = salaCom(2);
  sala = definirPerfil(sala, 'c1', { nome: 'Ana', nivel: 'avancado' });
  const { sala: viva } = iniciarPartida(sala);
  const lobby = voltarAoLobby(viva, ['c2']);
  assert.equal(lobby.fase, 'lobby');
  assert.equal(lobby.ordem, null);
  assert.deepEqual(lobby.pessoas.map((p) => p.chave), [CHAVE_DONO, 'c1']);
  assert.equal(lobby.pessoas[1].nivel, 'avancado');
  assert.equal(voltarAoLobby(viva, [CHAVE_DONO]).pessoas[0].chave, CHAVE_DONO);
  assert.equal(podeEntrar(lobby), true);
});

test('com a partida em andamento ninguém entra, sai ou muda perfil', () => {
  const { sala: viva } = iniciarPartida(salaCom(1, { vagas: 3 }));
  assert.equal(podeEntrar(viva), false);
  assert.equal(adicionarPessoa(viva, { nome: 'Tarde' }), null);
  assert.equal(removerPessoa(viva, 'c1'), viva);
  assert.equal(definirPerfil(viva, 'c1', { nome: 'Outro' }), viva);
  assert.equal(definirConfig(viva, { vagas: 2 }), viva);
  assert.equal(validarInicio(viva).ok, false);
});
