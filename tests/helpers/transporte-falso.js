// Transporte falso em memória para os testes de rede: o mesmo contrato do transporte WebRTC (src/net/transporte.js).
// `parTransportes()` devolve as duas pontas de uma conexão. A entrega é assíncrona (microtarefa), como a rede.

export function parTransportes({ conectarAoCriar = true } = {}) {
  const lados = [criarLado(), criarLado()];
  lados[0].outro = lados[1];
  lados[1].outro = lados[0];
  if (conectarAoCriar) for (const l of lados) queueMicrotask(() => l.mudar('conectado'));
  return { a: lados[0].transporte, b: lados[1].transporte, ladoA: lados[0], ladoB: lados[1] };
}

function criarLado() {
  const l = {
    outro: null, msgs: [], estados: [], estadoAtual: null, fila: [], aberto: true, cortado: false,
    mudar(s) {
      if (l.estadoAtual === 'caiu') return;
      l.estadoAtual = s;
      l.estados.forEach((fn) => fn(s));
    },
    receber(texto) {
      if (l.cortado) return;
      if (!l.msgs.length) l.fila.push(texto);
      else l.msgs.forEach((fn) => fn(texto));
    },
    // Simula silêncio: a ponta continua "aberta", mas nada chega a ela nem sai dela.
    cortarSinal() {
      l.cortado = true;
      l.outro.cortado = true;
    },
    // Simula a queda da conexão nos dois lados.
    derrubar() {
      for (const x of [l, l.outro]) {
        x.aberto = false;
        queueMicrotask(() => x.mudar('caiu'));
      }
    },
    transporte: {
      enviar(texto) {
        if (!l.aberto) throw new Error('canal fechado');
        const destino = l.outro;
        if (!l.cortado) queueMicrotask(() => destino.receber(texto));
      },
      aoReceber(fn) {
        l.msgs.push(fn);
        while (l.fila.length) fn(l.fila.shift());
      },
      aoEstado(fn) {
        l.estados.push(fn);
        if (l.estadoAtual) fn(l.estadoAtual);
      },
      fechar() {
        if (!l.aberto) return;
        l.derrubar();
      },
    },
  };
  return l;
}

// Deixa as microtarefas (a "rede") terminarem.
export const drenar = () => new Promise((resolve) => setImmediate(resolve));

// Relógio e agendador controlados pelos testes.
export function relogioFalso(inicio = 1_000_000) {
  let agora = inicio;
  const tarefas = [];
  return {
    relogio: () => agora,
    avancar(ms) {
      agora += ms;
    },
    agendar(fn, ms) {
      const t = { fn, ms, id: tarefas.length + 1, feito: false };
      tarefas.push(t);
      return t.id;
    },
    cancelar(id) {
      const t = tarefas.find((x) => x.id === id);
      if (t) t.feito = true;
    },
    pendentes: () => tarefas.filter((t) => !t.feito).length,
    // Roda a próxima tarefa agendada (o piloto dos bots); devolve false se não há nenhuma.
    rodarProxima() {
      const t = tarefas.find((x) => !x.feito);
      if (!t) return false;
      t.feito = true;
      t.fn();
      return true;
    },
    ultimoMs: () => tarefas.at(-1)?.ms,
  };
}
