// Anfitrião da sala (docs/adr/0008): a única autoridade da partida. Mantém a sala e o estado, valida o que os
// convidados pedem, aplica `reduzir`, joga pelos bots e faz o broadcast do estado. Não conhece o DOM nem o
// WebRTC: recebe transportes prontos ({ enviar, aoReceber, aoEstado, fechar }), o relógio e o agendador por
// injeção, o que permite testar tudo em Node com um transporte falso.

import { reduzir } from '../engine/machine.js';
import { avancarBot } from './piloto.js';
import { serializar, validarMensagem, SEM_SINAL_AVISO_MS } from './protocolo.js';
import {
  novaSala, podeEntrar, adicionarPessoa, removerPessoa, definirPerfil, definirConfig, validarInicio, iniciarPartida,
  idNoJogo, acaoPermitida, substituirPorBot, voltarAoLobby, CHAVE_DONO,
} from './sala.js';

export { SEM_SINAL_AVISO_MS };
export const INTERVALO_TICK_MS = 2000; // período do ping e da checagem de sinal
export const SEM_SINAL_BOT_MS = 60000; // vira bot (ou sai do lobby)
export const PENDENTE_MAX_MS = 120000; // pedido que nunca conectou
export const PAUSA_BOT_MS = 1200; // entre os passos de um bot, para os outros acompanharem
export const PAUSA_LEITURA_MS = 4000; // nas telas de resultado do bot

const FASES_DE_LEITURA = ['MOSTRAR_RESULTADO', 'MOSTRAR_EVENTO', 'MOSTRAR_MERCADO', 'MOSTRAR_BALANCO'];

export function criarAnfitriao({
  nomeDono = 'Jogador 1', vagas = 2, config = {}, relogio = Date.now, aleatorio = Math.random,
  agendar = (fn, ms) => setTimeout(fn, ms), cancelar = (t) => clearTimeout(t), aoMudar = () => {},
} = {}) {
  let sala = novaSala({ vagas, config, nomeDono });
  let estado = null;
  let encerrada = false;
  let aviso = null;
  let timerPiloto = null;
  let proximoPendente = 1;
  const conexoes = new Map(); // chave -> { transporte, ultimoSinal, semSinal }
  const pendentes = new Map(); // id -> { nome, transporte, desde }
  const ausentes = new Set(); // chaves de quem virou bot ou saiu (para a revanche)

  const semChaves = () => [...conexoes].filter(([, c]) => c.semSinal).map(([k]) => k);
  const semIds = () => semChaves().map((k) => idNoJogo(sala, k)).filter((i) => i >= 0);

  function visao() {
    return {
      papel: 'anfitriao', sala, estado, voce: CHAVE_DONO, meuId: estado ? idNoJogo(sala, CHAVE_DONO) : null,
      sem: semIds(), semChaves: semChaves(), aviso, encerrada,
      pendentes: [...pendentes].map(([id, p]) => ({ id, nome: p.nome, desde: p.desde })),
      vagasLivres: sala.vagas - sala.pessoas.length - pendentes.size,
    };
  }
  const notificar = () => aoMudar(visao());

  function enviar(chave, mensagem) {
    try {
      conexoes.get(chave)?.transporte.enviar(serializar(mensagem));
    } catch {
      /* o transporte avisa a queda por aoEstado */
    }
  }

  function broadcast() {
    const sem = semIds();
    for (const chave of conexoes.keys()) {
      enviar(chave, estado
        ? { tipo: 'estado', estado, meuId: idNoJogo(sala, chave), sem }
        : { tipo: 'sala', sala, voce: chave });
    }
    notificar();
  }

  function avisar(texto) {
    aviso = { texto, em: relogio() };
    for (const chave of conexoes.keys()) enviar(chave, { tipo: 'aviso', texto });
  }

  // ----- piloto dos bots -----
  function agendarPiloto() {
    if (timerPiloto !== null || !estado || avancarBot(estado) === null) return;
    const ms = FASES_DE_LEITURA.includes(estado.fase) ? PAUSA_LEITURA_MS : PAUSA_BOT_MS;
    timerPiloto = agendar(() => {
      timerPiloto = null;
      const novo = estado && avancarBot(estado);
      if (novo) {
        estado = novo;
        broadcast();
      }
      agendarPiloto();
    }, ms);
  }

  function aplicarAcao(acao) {
    const novo = reduzir(estado, acao);
    if (novo === estado) return false;
    estado = novo;
    broadcast();
    agendarPiloto();
    return true;
  }

  // ----- saída de convidados -----
  function desconectar(chave, texto) {
    const conexao = conexoes.get(chave);
    if (!conexao) return;
    conexoes.delete(chave);
    try {
      conexao.transporte.fechar();
    } catch {
      /* já fechado */
    }
    const pessoa = sala.pessoas.find((p) => p.chave === chave);
    if (!pessoa) return;
    if (sala.fase === 'lobby') {
      sala = removerPessoa(sala, chave);
    } else {
      ausentes.add(chave);
      if (estado && estado.fase !== 'FIM_DE_JOGO') {
        estado = substituirPorBot(estado, idNoJogo(sala, chave));
        avisar(texto ?? `${pessoa.nome} saiu da partida e agora é um bot.`);
      }
    }
    broadcast();
    agendarPiloto();
  }

  // ----- mensagens dos convidados -----
  function receber(chave, texto) {
    const conexao = conexoes.get(chave);
    if (!conexao) return;
    conexao.ultimoSinal = relogio();
    const voltou = conexao.semSinal;
    conexao.semSinal = false;
    const m = validarMensagem(texto, 'convidado');
    if (m?.tipo === 'perfil' && sala.fase === 'lobby') {
      sala = definirPerfil(sala, chave, m);
      broadcast();
    } else if (m?.tipo === 'acao') {
      if (estado && acaoPermitida(estado, idNoJogo(sala, chave), m.acao)) aplicarAcao(m.acao);
      else enviar(chave, estado ? { tipo: 'estado', estado, meuId: idNoJogo(sala, chave), sem: semIds() } : { tipo: 'sala', sala, voce: chave }); // ressincroniza
    } else if (m?.tipo === 'ping') {
      enviar(chave, { tipo: 'pong' });
    } else if (m?.tipo === 'sair') {
      desconectar(chave);
      return;
    }
    if (voltou && m?.tipo !== 'perfil' && m?.tipo !== 'acao') broadcast();
  }

  // ----- pedidos de entrada (conexões ainda sem vaga) -----
  // A vaga só é ocupada quando o canal abre: pedido que nunca conecta não prende ninguém.
  const podeReceber = () => !encerrada && podeEntrar(sala) && sala.pessoas.length + pendentes.size < sala.vagas;

  function receberPedido({ nome, transporte }) {
    if (!podeReceber()) {
      transporte.fechar();
      return null;
    }
    const id = proximoPendente++;
    const ref = { chave: null };
    pendentes.set(id, { nome, transporte, desde: relogio() });

    const promover = () => {
      if (ref.chave || !pendentes.has(id)) return;
      pendentes.delete(id);
      const r = podeEntrar(sala) ? adicionarPessoa(sala, { nome }) : null;
      if (!r) {
        transporte.fechar();
        notificar();
        return;
      }
      sala = r.sala;
      ref.chave = r.chave;
      conexoes.set(r.chave, { transporte, ultimoSinal: relogio(), semSinal: false });
      broadcast();
    };
    transporte.aoReceber((texto) => {
      promover();
      if (ref.chave) receber(ref.chave, texto);
    });
    transporte.aoEstado((s) => {
      if (s === 'conectado' && !ref.chave) promover();
      else if (s === 'conectado' || s === 'instavel') {
        const c = ref.chave && conexoes.get(ref.chave);
        if (c && c.semSinal !== (s === 'instavel')) {
          c.semSinal = s === 'instavel';
          broadcast();
        }
      } else if (s === 'caiu') {
        if (ref.chave) desconectar(ref.chave);
        else if (pendentes.delete(id)) notificar();
      }
    });
    notificar();
    return id;
  }

  function cancelarPedido(id) {
    const p = pendentes.get(id);
    if (!p) return;
    pendentes.delete(id);
    p.transporte.fechar();
    notificar();
  }

  // ----- relógio: ping e checagem de sinal; chamado a cada INTERVALO_TICK_MS -----
  function tick() {
    if (encerrada) return;
    const agora = relogio();
    for (const [id, p] of pendentes) if (agora - p.desde >= PENDENTE_MAX_MS) cancelarPedido(id);
    let mudou = false;
    for (const [chave, c] of [...conexoes]) {
      enviar(chave, { tipo: 'ping' });
      const silencio = agora - c.ultimoSinal;
      const nome = sala.pessoas.find((p) => p.chave === chave)?.nome ?? 'Alguém';
      if (silencio >= SEM_SINAL_BOT_MS) {
        desconectar(chave, `${nome} ficou sem conexão e agora é um bot.`);
      } else if (silencio >= SEM_SINAL_AVISO_MS && !c.semSinal) {
        c.semSinal = true;
        mudou = true;
        avisar(`${nome} está sem conexão…`);
      }
    }
    if (mudou) broadcast();
  }

  return {
    visao,
    sala: () => sala,
    estado: () => estado,
    podeReceber,
    receberPedido,
    cancelarPedido,
    tick,

    definirPerfilDono(perfil) {
      if (sala.fase !== 'lobby') return;
      sala = definirPerfil(sala, CHAVE_DONO, perfil);
      broadcast();
    },
    definirConfig(parcial) {
      if (sala.fase !== 'lobby') return;
      sala = definirConfig(sala, parcial);
      broadcast();
    },
    removerConvidado(chave) {
      desconectar(chave);
    },
    // Dono passa a vaga de alguém para o bot (também serve para expulsar quem parou de jogar).
    passarParaBot(chave) {
      if (chave === CHAVE_DONO || !conexoes.has(chave)) return;
      const nome = sala.pessoas.find((p) => p.chave === chave)?.nome ?? 'Alguém';
      desconectar(chave, `${nome} passou a vaga para um bot.`);
    },
    iniciar() {
      const v = validarInicio(sala);
      if (!v.ok) return v;
      for (const id of [...pendentes.keys()]) cancelarPedido(id);
      const inicio = iniciarPartida(sala, aleatorio);
      sala = inicio.sala;
      estado = inicio.estado;
      ausentes.clear();
      broadcast();
      agendarPiloto();
      return { ok: true, erro: null };
    },
    // Ação do próprio dono, com a mesma validação dos convidados.
    jogar(acao) {
      if (!estado || !acaoPermitida(estado, idNoJogo(sala, CHAVE_DONO), acao)) return false;
      return aplicarAcao(acao);
    },
    // Fim de jogo: volta todos ao lobby sem trocar códigos de novo. Vagas de bot ficam fora.
    revanche() {
      if (!estado || estado.fase !== 'FIM_DE_JOGO') return false;
      sala = voltarAoLobby(sala, [...ausentes]);
      estado = null;
      ausentes.clear();
      aviso = null;
      broadcast();
      return true;
    },
    encerrar() {
      if (encerrada) return;
      for (const chave of conexoes.keys()) enviar(chave, { tipo: 'encerrada' });
      for (const c of conexoes.values()) c.transporte.fechar();
      for (const p of pendentes.values()) p.transporte.fechar();
      conexoes.clear();
      pendentes.clear();
      if (timerPiloto !== null) cancelar(timerPiloto);
      timerPiloto = null;
      encerrada = true;
      notificar();
    },
  };
}
