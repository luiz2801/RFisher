// Sinalização automática para multiplayer em rede local ou GitHub Pages (docs/adr/0008).
// Permite que o anfitrião exiba apenas um código curto de 4 caracteres (ex: K9P2)
// e os convidados conectem-se automaticamente sem precisar trocar códigos de centenas de caracteres.

import { ErroConvite, criarPedido, responderPedido } from './transporte.js';

export const ALFABETO_SALA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function gerarCodigoSala(tamanho = 4, aleatorio = Math.random) {
  let res = '';
  for (let i = 0; i < tamanho; i++) {
    res += ALFABETO_SALA[Math.floor(aleatorio() * ALFABETO_SALA.length)];
  }
  return res;
}

export function normalizarCodigoSala(codigo) {
  if (!codigo || typeof codigo !== 'string') return '';
  return codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function criarCanalEmMemoria() {
  const salas = new Map();
  return {
    tipo: 'memoria',
    async publicar(sala, msg) {
      const chave = normalizarCodigoSala(sala);
      const ouvintes = salas.get(chave) ?? new Set();
      const copia = JSON.parse(JSON.stringify(msg));
      for (const fn of [...ouvintes]) {
        try {
          fn(copia);
        } catch {
          /* erro no ouvinte */
        }
      }
    },
    ouvir(sala, fn) {
      const chave = normalizarCodigoSala(sala);
      if (!salas.has(chave)) salas.set(chave, new Set());
      const conjunto = salas.get(chave);
      conjunto.add(fn);
      return () => {
        conjunto.delete(fn);
      };
    },
  };
}

export async function detectarTipoSinalizacao({ urlBase = '', fetchFn = globalThis.fetch } = {}) {
  if (typeof fetchFn !== 'function') return 'publico';
  try {
    const res = await fetchFn(`${urlBase}/_sinal/ping`, {
      method: 'GET',
      signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(1200) : undefined,
    });
    if (res.ok) return 'local';
  } catch {
    /* servidor local indisponível */
  }
  return 'publico';
}

export function criarCanalSinalizacao({
  tipo = 'local',
  urlBase = '',
  fetchFn = globalThis.fetch,
  EventSourceClass = globalThis.EventSource,
} = {}) {
  if (tipo === 'memoria') return criarCanalEmMemoria();

  if (tipo === 'local') {
    return {
      tipo: 'local',
      async publicar(sala, msg) {
        const chave = normalizarCodigoSala(sala);
        const res = await fetchFn(`${urlBase}/_sinal/${encodeURIComponent(chave)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        });
        if (!res.ok) throw new Error(`Falha ao enviar sinal local (${res.status})`);
      },
      ouvir(sala, aoMensagem) {
        const chave = normalizarCodigoSala(sala);
        if (typeof EventSourceClass === 'function') {
          const es = new EventSourceClass(`${urlBase}/_sinal/${encodeURIComponent(chave)}/sse`);
          es.onmessage = (ev) => {
            try {
              const dados = JSON.parse(ev.data);
              aoMensagem(dados);
            } catch {
              /* ignora */
            }
          };
          return () => es.close();
        }

        let ativo = true;
        let ultimoTempo = 0;
        const intervalo = setInterval(async () => {
          if (!ativo) return;
          try {
            const res = await fetchFn(`${urlBase}/_sinal/${encodeURIComponent(chave)}/mensagens?desde=${ultimoTempo}`);
            if (res.ok) {
              const json = await res.json();
              for (const m of json.mensagens ?? []) {
                if (m.tempo > ultimoTempo) ultimoTempo = m.tempo;
                aoMensagem(m);
              }
            }
          } catch {
            /* erro transitório */
          }
        }, 1000);
        return () => {
          ativo = false;
          clearInterval(intervalo);
        };
      },
    };
  }

  // Tipo 'publico' (fallback para GitHub Pages via relay ntfy.sh)
  return {
    tipo: 'publico',
    async publicar(sala, msg) {
      const chave = normalizarCodigoSala(sala);
      const topico = `rfisher-ceo-${chave.toLowerCase()}`;
      const res = await fetchFn(`https://ntfy.sh/${encodeURIComponent(topico)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      });
      if (!res.ok) throw new Error(`Falha ao publicar sinal (${res.status})`);
    },
    ouvir(sala, aoMensagem) {
      const chave = normalizarCodigoSala(sala);
      const topico = `rfisher-ceo-${chave.toLowerCase()}`;
      if (typeof EventSourceClass === 'function') {
        const es = new EventSourceClass(`https://ntfy.sh/${encodeURIComponent(topico)}/sse`);
        es.onmessage = (ev) => {
          try {
            const env = JSON.parse(ev.data);
            if (env.event === 'message' && typeof env.message === 'string') {
              try {
                aoMensagem(JSON.parse(env.message));
              } catch {
                aoMensagem(env.message);
              }
            } else {
              aoMensagem(env);
            }
          } catch {
            /* ignora */
          }
        };
        return () => es.close();
      }

      let ativo = true;
      let ultimoTempo = 0;
      const intervalo = setInterval(async () => {
        if (!ativo) return;
        try {
          const res = await fetchFn(`https://ntfy.sh/${encodeURIComponent(topico)}/json?since=${ultimoTempo || 'all'}`);
          if (res.ok) {
            const texto = await res.text();
            const linhas = texto.trim().split('\n');
            for (const linha of linhas) {
              if (!linha) continue;
              const env = JSON.parse(linha);
              if (env.time > ultimoTempo) ultimoTempo = env.time;
              if (env.event === 'message') {
                aoMensagem(JSON.parse(env.message));
              }
            }
          }
        } catch {
          /* erro transitório */
        }
      }, 1500);
      return () => {
        ativo = false;
        clearInterval(intervalo);
      };
    },
  };
}

export function anunciarSala({
  codigoSala,
  aoConectar,
  canalSinal,
  responderFn = responderPedido,
}) {
  const chave = normalizarCodigoSala(codigoSala);
  const pedidosAtendidos = new Set();

  const cancelarOuvinte = canalSinal.ouvir(chave, async (msg) => {
    if (msg?.tipo === 'pedido_conexao' && msg.idPedido && msg.codigoPedido) {
      if (pedidosAtendidos.has(msg.idPedido)) return;
      pedidosAtendidos.add(msg.idPedido);
      try {
        const { nome, codigoResposta, transporte } = await responderFn(msg.codigoPedido);
        await canalSinal.publicar(chave, {
          tipo: 'resposta_conexao',
          idPedido: msg.idPedido,
          codigoResposta,
        });
        aoConectar({ nome, transporte });
      } catch (err) {
        try {
          await canalSinal.publicar(chave, {
            tipo: 'recusa_conexao',
            idPedido: msg.idPedido,
            motivo: err.message || 'Falha ao aceitar conexão.',
          });
        } catch {
          /* ignora erro de envio de recusa */
        }
      }
    }
  });

  return {
    parar() {
      cancelarOuvinte();
    },
  };
}

export async function conectarNaSala({
  codigoSala,
  nome,
  canalSinal,
  criarFn = criarPedido,
  timeoutMs = 25000,
  aoProgresso = () => {},
}) {
  const chave = normalizarCodigoSala(codigoSala);
  if (!chave || chave.length < 3) {
    throw new ErroConvite('codigo-invalido', 'Digite o código da sala de 4 caracteres.');
  }

  const idPedido = `ped_${Math.random().toString(36).slice(2, 10)}`;
  aoProgresso('criando_oferta');

  const pedido = await criarFn(nome);
  let limparTudo = () => {};

  return new Promise((resolve, reject) => {
    let resolvido = false;

    const timeout = setTimeout(() => {
      if (resolvido) return;
      resolvido = true;
      limparTudo();
      try {
        pedido.transporte.fechar();
      } catch {
        /* já fechado */
      }
      reject(new ErroConvite('timeout', `Tempo esgotado aguardando resposta da sala "${chave}". Verifique se o código está correto e se o anfitrião está com a sala aberta.`));
    }, timeoutMs);

    const cancelarOuvinte = canalSinal.ouvir(chave, async (msg) => {
      if (resolvido || !msg || msg.idPedido !== idPedido) return;

      if (msg.tipo === 'resposta_conexao' && msg.codigoResposta) {
        resolvido = true;
        limparTudo();
        aoProgresso('conectando_webrtc');
        try {
          await pedido.aplicarResposta(msg.codigoResposta);
          resolve({ transporte: pedido.transporte, nome });
        } catch (err) {
          try {
            pedido.transporte.fechar();
          } catch {
            /* já fechado */
          }
          reject(err);
        }
      } else if (msg.tipo === 'recusa_conexao') {
        resolvido = true;
        limparTudo();
        try {
          pedido.transporte.fechar();
        } catch {
          /* já fechado */
        }
        reject(new ErroConvite('recusado', msg.motivo || 'Entrada recusada pelo anfitrião.'));
      }
    });

    let retryTimer = null;
    let tentativas = 0;
    const enviarOferta = async () => {
      if (resolvido) return;
      try {
        aoProgresso('aguardando_anfitriao');
        await canalSinal.publicar(chave, {
          tipo: 'pedido_conexao',
          idPedido,
          nome,
          codigoPedido: pedido.codigo,
        });
      } catch (err) {
        /* falha transitória ao publicar */
      }
      tentativas++;
      if (tentativas < 3 && !resolvido) {
        retryTimer = setTimeout(enviarOferta, 4000);
      }
    };

    limparTudo = () => {
      clearTimeout(timeout);
      if (retryTimer) clearTimeout(retryTimer);
      cancelarOuvinte();
    };

    enviarOferta().catch(() => {});
  });
}
