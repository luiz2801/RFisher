// Mensagens trocadas pelo canal de dados entre o dono da sala (autoridade) e os convidados (docs/adr/0008).
// Tudo que chega da rede é dado não confiável: `validarMensagem` nunca lança e devolve `null` para o que não conhece.

import { NOME_MAX } from './codigo.js';

// Tamanho máximo do texto de cada mensagem. O estado do dono é o único grande; o que o convidado manda é minúsculo.
export const MAX_DO_DONO = 512 * 1024;
export const MAX_DO_CONVIDADO = 2 * 1024;
export const VALOR_MAX = 64;

// Ações da máquina de estados que um convidado pode pedir. `DECIDIR_BOT` fica de fora: só o dono controla os bots.
export const ACOES_REMOTAS = [
  'ROLAR', 'ABRIR_DICA', 'METRICA', 'VALOR', 'JUSTIFICATIVA', 'CONFIANCA',
  'ABRIR_CONSULTORIA', 'DIAGNOSTICAR', 'INVESTIR', 'RECUSAR', 'CONTINUAR',
  'PARTICIPAR', 'ESCOLHER_CARTA', 'MANTER', 'TROCAR',
];

const NIVEIS = ['iniciante', 'avancado'];
const ehObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const ehTexto = (x, max) => typeof x === 'string' && x.length <= max;

// Um validador por tipo: devolve a mensagem limpa (só os campos conhecidos) ou null.
const DO_CONVIDADO = {
  // Perfil escolhido no lobby; o dono revalida o setor contra as diretorias.
  perfil: (m) => (ehTexto(m.nome, NOME_MAX) && NIVEIS.includes(m.nivel) && ehTexto(m.diretoria ?? '', 32)
    ? { tipo: 'perfil', nome: m.nome.trim() || 'Jogador', nivel: m.nivel, diretoria: m.diretoria ?? '' }
    : null),
  acao: (m) => (ehObjeto(m.acao) && ACOES_REMOTAS.includes(m.acao.tipo)
    && (m.acao.valor === undefined || (typeof m.acao.valor === 'number' && Number.isFinite(m.acao.valor)) || ehTexto(m.acao.valor, VALOR_MAX))
    ? { tipo: 'acao', acao: { tipo: m.acao.tipo, valor: m.acao.valor } }
    : null),
  ping: () => ({ tipo: 'ping' }),
  pong: () => ({ tipo: 'pong' }),
  sair: () => ({ tipo: 'sair' }),
};

const DO_DONO = {
  sala: (m) => (ehObjeto(m.sala) ? { tipo: 'sala', sala: m.sala, meuId: Number.isInteger(m.meuId) ? m.meuId : null } : null),
  estado: (m) => (ehObjeto(m.estado) && Array.isArray(m.estado.jogadores) && typeof m.estado.fase === 'string'
    ? { tipo: 'estado', estado: m.estado, meuId: Number.isInteger(m.meuId) ? m.meuId : null, sem: Array.isArray(m.sem) ? m.sem.filter(Number.isInteger) : [] }
    : null),
  aviso: (m) => (ehTexto(m.texto, 200) ? { tipo: 'aviso', texto: m.texto } : null),
  encerrada: () => ({ tipo: 'encerrada' }),
  ping: () => ({ tipo: 'ping' }),
  pong: () => ({ tipo: 'pong' }),
};

// `origem`: 'convidado' (mensagem que o dono recebeu) ou 'dono' (mensagem que o convidado recebeu).
export function validarMensagem(texto, origem) {
  try {
    const validadores = origem === 'dono' ? DO_DONO : DO_CONVIDADO;
    const max = origem === 'dono' ? MAX_DO_DONO : MAX_DO_CONVIDADO;
    if (typeof texto !== 'string' || texto.length > max) return null;
    const m = JSON.parse(texto);
    return ehObjeto(m) && Object.hasOwn(validadores, m.tipo) ? validadores[m.tipo](m) : null;
  } catch {
    return null;
  }
}

export const serializar = (mensagem) => JSON.stringify(mensagem);
