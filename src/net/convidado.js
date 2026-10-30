// Convidado da sala (docs/adr/0008): não roda regra nenhuma. Envia o que a pessoa fez (só a da vez pode agir)
// e guarda o último estado enviado pelo dono. Independente do DOM e do WebRTC, como o anfitrião.

import { serializar, validarMensagem, SEM_SINAL_AVISO_MS } from './protocolo.js';

export function criarConvidado({ transporte, relogio = Date.now, aoMudar = () => {} }) {
  let ultimoSinal = relogio();
  const v = {
    papel: 'convidado', conectado: false, sala: null, estado: null, voce: null, meuId: null,
    sem: [], aviso: null, encerrada: false, motivo: null, semDono: false,
  };
  const visao = () => ({ ...v, sem: [...v.sem] });
  const notificar = () => aoMudar(visao());

  const enviar = (mensagem) => {
    try {
      transporte.enviar(serializar(mensagem));
    } catch {
      /* o transporte avisa a queda por aoEstado */
    }
  };

  const encerrar = (motivo) => {
    if (v.encerrada) return;
    v.encerrada = true;
    v.motivo = motivo;
    notificar();
  };

  transporte.aoReceber((texto) => {
    ultimoSinal = relogio();
    v.semDono = false;
    if (v.encerrada) return;
    const m = validarMensagem(texto, 'dono');
    if (!m) return;
    if (m.tipo === 'sala') Object.assign(v, { sala: m.sala, voce: m.voce, estado: null, meuId: null, sem: [] });
    else if (m.tipo === 'estado') Object.assign(v, { estado: m.estado, meuId: m.meuId, sem: m.sem });
    else if (m.tipo === 'aviso') v.aviso = { texto: m.texto, em: relogio() };
    else if (m.tipo === 'encerrada') return encerrar('dono');
    else if (m.tipo === 'ping') {
      enviar({ tipo: 'pong' });
      return;
    }
    v.conectado = true;
    notificar();
  });

  transporte.aoEstado((s) => {
    if (s === 'conectado') {
      v.conectado = true;
      v.semDono = false;
      notificar();
    } else if (s === 'instavel') {
      v.semDono = true;
      notificar();
    } else if (s === 'caiu') {
      encerrar('conexao');
    }
  });

  return {
    visao,
    // Só a pessoa da vez pode agir; o dono valida de novo e ignora o que não vale.
    acao(acao) {
      if (v.encerrada || !v.estado || v.meuId !== v.estado.jogadorAtual) return false;
      enviar({ tipo: 'acao', acao });
      return true;
    },
    perfil({ nome, nivel, diretoria }) {
      if (v.encerrada || v.estado) return false;
      enviar({ tipo: 'perfil', nome, nivel, diretoria });
      return true;
    },
    tick() {
      if (v.encerrada) return;
      if (!v.semDono && relogio() - ultimoSinal >= SEM_SINAL_AVISO_MS) {
        v.semDono = true;
        notificar();
      }
    },
    sair() {
      if (v.encerrada) return;
      enviar({ tipo: 'sair' });
      v.encerrada = true;
      v.motivo = 'saiu';
      try {
        transporte.fechar();
      } catch {
        /* já fechado */
      }
      notificar();
    },
  };
}
