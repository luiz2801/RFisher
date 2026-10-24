// Regras do lobby e da sala do multiplayer em rede local (docs/adr/0008). Tudo puro: cada função recebe a sala
// (ou o estado da partida) e devolve uma nova, sem tocar na entrada. O dono da sala é a única autoridade.

import { novoJogo, jogadorAtual, ehBot } from '../engine/state.js';
import { DIRETORIAS, setoresRepetidos } from '../engine/papeis.js';
import { MAX_JOGADORES } from '../engine/config.js';
import { NOME_MAX } from './codigo.js';
import { ACOES_REMOTAS, VALOR_MAX } from './protocolo.js';

export const VAGAS_MIN = 2;
export const VAGAS_MAX = MAX_JOGADORES;
export const MINIMO_PARA_INICIAR = 2;
export const CHAVE_DONO = 'dono';
export const PERFIL_BOT_SUBSTITUTO = 'medio';

const DIRETORIAS_IDS = Object.keys(DIRETORIAS);
const NIVEIS = ['iniciante', 'avancado'];
const MODOS = ['competitivo', 'cooperativo'];
const CASAS_TESTE = ['decisao', 'evento', 'mercado', 'balanco'];

const nomeLimpo = (nome, padrao) => String(nome ?? '').trim().slice(0, NOME_MAX) || padrao;
const inteiroOuNulo = (v) => (Number.isFinite(Number(v)) && String(v ?? '').trim() !== '' ? Math.round(Number(v)) : null);

// Regras da partida escolhidas pelo dono. Os limites (turnos, caixa, reputação) são aplicados pelo `novoJogo`.
export function configLimpa(c = {}) {
  const cenarios = Array.isArray(c.teste?.cenarios) ? c.teste.cenarios.filter((x) => typeof x === 'string').slice(0, 200) : null;
  return {
    modo: MODOS.includes(c.modo) ? c.modo : 'competitivo',
    turnos: inteiroOuNulo(c.turnos),
    dinheiroInicial: inteiroOuNulo(c.dinheiroInicial),
    reputacaoInicial: inteiroOuNulo(c.reputacaoInicial),
    progressao: typeof c.progressao === 'string' ? c.progressao : null,
    seed: Number.isInteger(c.seed) && c.seed >= 1 ? c.seed : null,
    teste: { casa: CASAS_TESTE.includes(c.teste?.casa) ? c.teste.casa : null, cenarios: cenarios?.length ? cenarios : null },
  };
}

// A diretoria que ninguém pegou ainda, para o lobby não nascer com setor repetido.
const diretoriaLivre = (pessoas) => DIRETORIAS_IDS.find((d) => !pessoas.some((p) => p.diretoria === d)) ?? DIRETORIAS_IDS[pessoas.length % DIRETORIAS_IDS.length];

export function novaSala({ vagas = VAGAS_MIN, config = {}, nomeDono = 'Jogador 1' } = {}) {
  return {
    fase: 'lobby',
    vagas: Math.min(VAGAS_MAX, Math.max(VAGAS_MIN, Math.round(Number(vagas)) || VAGAS_MIN)),
    config: configLimpa(config),
    proximaChave: 1,
    pessoas: [{ chave: CHAVE_DONO, nome: nomeLimpo(nomeDono, 'Jogador 1'), nivel: 'iniciante', diretoria: DIRETORIAS_IDS[0] }],
    ordem: null,
  };
}

// Só dá para entrar no lobby, e se ainda houver vaga (decisão 16: nada de entrar com a partida em andamento).
export const podeEntrar = (sala) => sala.fase === 'lobby' && sala.pessoas.length < sala.vagas;

// Devolve `{ sala, chave }` com a nova pessoa na última posição (ordem de entrada), ou `null` se não pode entrar.
export function adicionarPessoa(sala, { nome } = {}) {
  if (!podeEntrar(sala)) return null;
  const chave = `c${sala.proximaChave}`;
  const pessoa = { chave, nome: nomeLimpo(nome, `Jogador ${sala.pessoas.length + 1}`), nivel: 'iniciante', diretoria: diretoriaLivre(sala.pessoas) };
  return { sala: { ...sala, proximaChave: sala.proximaChave + 1, pessoas: [...sala.pessoas, pessoa] }, chave };
}

// O dono não sai da própria sala; no lobby, quem sai libera a vaga.
export function removerPessoa(sala, chave) {
  if (sala.fase !== 'lobby' || chave === CHAVE_DONO) return sala;
  return { ...sala, pessoas: sala.pessoas.filter((p) => p.chave !== chave) };
}

export function definirPerfil(sala, chave, { nome, nivel, diretoria } = {}) {
  if (sala.fase !== 'lobby') return sala;
  return {
    ...sala,
    pessoas: sala.pessoas.map((p) => (p.chave !== chave ? p : {
      ...p,
      nome: nomeLimpo(nome, p.nome),
      nivel: NIVEIS.includes(nivel) ? nivel : p.nivel,
      diretoria: Object.hasOwn(DIRETORIAS, diretoria ?? '') ? diretoria : p.diretoria,
    })),
  };
}

// O dono muda as regras e o número de vagas; as vagas nunca ficam abaixo de quem já está na sala.
export function definirConfig(sala, { vagas, config } = {}) {
  if (sala.fase !== 'lobby') return sala;
  const v = vagas === undefined ? sala.vagas : Math.min(VAGAS_MAX, Math.max(VAGAS_MIN, sala.pessoas.length, Math.round(Number(vagas)) || sala.vagas));
  return { ...sala, vagas: v, config: config === undefined ? sala.config : configLimpa(config) };
}

// O dono só inicia com pelo menos duas pessoas e sem setores repetidos (mesma regra do menu do hot-seat).
export function validarInicio(sala) {
  if (sala.fase !== 'lobby') return { ok: false, erro: 'A partida já começou.' };
  if (sala.pessoas.length < MINIMO_PARA_INICIAR) return { ok: false, erro: 'Espere pelo menos mais uma pessoa entrar na sala.' };
  if (setoresRepetidos(sala.config.modo, sala.pessoas.map((p) => p.diretoria))) {
    return { ok: false, erro: 'Duas pessoas escolheram o mesmo setor. Cada uma precisa de um setor diferente.' };
  }
  return { ok: true, erro: null };
}

// Argumentos de `novoJogo` na ordem de entrada. Sem semente escolhida, sorteia uma (fora do motor, como o menu faz).
export function argumentosNovoJogo(sala, aleatorio = Math.random) {
  const c = sala.config;
  return {
    jogadores: sala.pessoas.map((p) => ({ nome: p.nome, nivel: p.nivel, diretoria: p.diretoria })),
    turnos: c.turnos ?? NaN,
    dinheiroInicial: c.dinheiroInicial ?? NaN,
    reputacaoInicial: c.reputacaoInicial ?? NaN,
    progressao: c.progressao ?? undefined,
    modo: c.modo,
    seed: c.seed ?? Math.floor(aleatorio() * 2 ** 32),
    teste: c.teste,
  };
}

// Começa a partida. Devolve a sala em andamento (com a `ordem` das chaves, que dá o id de cada pessoa no jogo) e o estado.
export function iniciarPartida(sala, aleatorio = Math.random) {
  const v = validarInicio(sala);
  if (!v.ok) return null;
  return {
    sala: { ...sala, fase: 'jogando', ordem: sala.pessoas.map((p) => p.chave) },
    estado: novoJogo(argumentosNovoJogo(sala, aleatorio)),
  };
}

// Id do jogador na partida (índice em `estado.jogadores`) de quem tem essa chave, ou -1.
export const idNoJogo = (sala, chave) => sala.ordem?.indexOf(chave) ?? -1;

// Só quem está na vez, sendo pessoa, pode agir; e só com ações da lista e valores pequenos.
export function acaoPermitida(estado, idJogador, acao) {
  if (!estado || !Number.isInteger(idJogador) || idJogador !== estado.jogadorAtual) return false;
  if (ehBot(jogadorAtual(estado)) || estado.fase === 'FIM_DE_JOGO') return false;
  if (!acao || !ACOES_REMOTAS.includes(acao.tipo)) return false;
  const v = acao.valor;
  return v === undefined || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= VALOR_MAX);
}

// Quem caiu (ou foi passado para o bot) vira um bot permanente: perfil Médio, mesmo nível e histórico. Não mexe no RNG.
export function substituirPorBot(estado, idJogador) {
  const j = estado.jogadores[idJogador];
  if (!j || ehBot(j)) return estado;
  const novo = structuredClone(estado);
  const alvo = novo.jogadores[idJogador];
  alvo.bot = PERFIL_BOT_SUBSTITUTO;
  alvo.substituido = true;
  alvo.nome = `${nomeLimpo(alvo.nome, 'Jogador')} (bot)`.slice(0, NOME_MAX + 6);
  return novo;
}

// Revanche: volta ao lobby só com quem ainda está conectado (vagas de bot ficam fora), mantendo nome e perfil.
// `ausentes` traz as chaves de quem virou bot ou saiu. O dono nunca sai.
export function voltarAoLobby(sala, ausentes = []) {
  return {
    ...sala,
    fase: 'lobby',
    ordem: null,
    pessoas: sala.pessoas.filter((p) => p.chave === CHAVE_DONO || !ausentes.includes(p.chave)),
  };
}
