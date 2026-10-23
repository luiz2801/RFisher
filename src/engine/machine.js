import { criarRng } from './rng.js';
import { CASAS, avancar } from './board.js';
import {
  CUSTOS_BALANCO, MULTA_CRISE, REPUTACAO_POS_CRISE, META_CRESCIMENTO_POR_JOGADOR, BONUS_INVESTIDOR,
  BONUS_INVESTIDOR_REPUTACAO, CORTE_ORCAMENTO, CORTE_ORCAMENTO_REPUTACAO, REDUCAO_PREJUIZO_PASSIVA,
  REPUTACAO_BALANCO_RH, PERFIS_BOT, APORTES, ANALISE_BONUS_REPUTACAO, ANALISE_PENALIDADE_REPUTACAO,
} from './config.js';
import { resolverDecisao, receitaBalanco, justificativaConta, atualizarSequencia, CONFIANCA } from './scoring.js';
import {
  jogadorAtual, sequenciaDe, dinheiroInicialDe, carteira, ehCooperativo, ehBot, ehFalido, jogadoresAtivos, julgarBalanco, distanciaPercorrida, progressoDoJogador,
} from './state.js';
import { decidirBot } from './bot.js';
import { ehCalculo, avaliarCalculo } from './calculo.js';
import { lerNumero } from '../stats/format.js';
import { escolherPorDificuldade } from './dificuldade.js';
import { equivocosDaEscolha } from './desempenho.js';
import { diretoriaDoSetor } from './papeis.js';
import { OPCOES_DIAGNOSTICO, sortearOferta, ganhoComConsultoria, honorarioDaConsultoria, liquidarTodos, investimentosDe } from './investimentos.js';
import { instanciar, obterCenario, idsCenarios } from '../scenarios/loader.js';
import { EVENTOS } from '../scenarios/content/eventos.js';
import { obterEmpresa } from '../scenarios/content/investimentos.js';

// Máquina de estados do turno: cada transição é (estado, ação) -> novo estado.
// Ação inválida para a fase atual é ignorada.

function sacar(e, chave, todos, rng) {
  if (!e[chave].length) e[chave] = rng.embaralhar(todos);
  return e[chave].shift();
}

// Cenário do baralho com dificuldade mais próxima do progresso do jogador (sem repetir no ciclo).
function sacarCenario(e, progresso, rng) {
  // Em partida de teste o baralho se limita aos cenários escolhidos no menu.
  // Sem material de apoio (`soConceitual`) saem os de cálculo; o atalho de teste, se houver, tem precedência.
  const todos = e.teste?.cenarios ?? (e.soConceitual ? idsCenarios().filter((id) => !ehCalculo(obterCenario(id))) : idsCenarios());
  if (!e.baralhoCenarios.length) e.baralhoCenarios = rng.embaralhar(todos);
  else {
    // Partida salva antes de um cenário existir: ele entra no baralho em vez de esperar o próximo ciclo.
    const vistos = new Set(e.jogadores.flatMap((j) => j.historico.map((h) => h.cenario)));
    for (const id of todos) if (!vistos.has(id) && !e.baralhoCenarios.includes(id)) e.baralhoCenarios.push(id);
  }
  const candidatos = e.baralhoCenarios.map((id) => ({ id, dificuldade: obterCenario(id).dificuldade }));
  const id = escolherPorDificuldade(candidatos, progresso, rng);
  e.baralhoCenarios.splice(e.baralhoCenarios.indexOf(id), 1);
  return id;
}

// Reputação em zero dispara crise de imagem: multa e reputação parcialmente recuperada.
function mudarReputacao(j, delta) {
  j.reputacao = Math.min(100, Math.max(0, j.reputacao + delta));
  if (j.reputacao > 0) return false;
  j.dinheiro -= MULTA_CRISE;
  j.reputacao = REPUTACAO_POS_CRISE;
  return true;
}

// Caixa mínimo exigido pelo Conselho: cresce a cada trimestre e com o número de jogadores.
export const metaTrimestral = (e) =>
  dinheiroInicialDe(e) + META_CRESCIMENTO_POR_JOGADOR * e.jogadores.length * (e.turnoAtual - 1);

// Depois da receita e dos custos, os aportes do jogador da vez no Mercado são apurados (fisher.md 3.14); no
// cooperativo isso vem antes da meta, então o retorno dos investimentos conta para o caixa exigido.
function aplicarBalanco(e, rng) {
  const w = carteira(e);
  const receita = receitaBalanco(w.reputacao);
  w.dinheiro += receita - CUSTOS_BALANCO;
  const investimentos = liquidarTodos(w, jogadorAtual(e), rng);
  const balanco = { receita, custos: CUSTOS_BALANCO, liquido: receita - CUSTOS_BALANCO, investimentos };
  if (!ehCooperativo(e)) return balanco;

  // Cooperativo: bônus do RH, depois a meta. Quem falha sofre corte, ninguém é eliminado.
  mudarReputacao(w, REPUTACAO_BALANCO_RH);
  const meta = metaTrimestral(e);
  const cumprida = w.dinheiro >= meta;
  const ajusteDinheiro = cumprida ? BONUS_INVESTIDOR : -CORTE_ORCAMENTO;
  w.dinheiro += ajusteDinheiro;
  const crise = mudarReputacao(w, cumprida ? BONUS_INVESTIDOR_REPUTACAO : -CORTE_ORCAMENTO_REPUTACAO);
  return {
    ...balanco,
    bonusRh: REPUTACAO_BALANCO_RH,
    meta: { valor: meta, cumprida, dinheiro: ajusteDinheiro, reputacao: cumprida ? BONUS_INVESTIDOR_REPUTACAO : -CORTE_ORCAMENTO_REPUTACAO, crise },
  };
}

// Prejuízo de evento do setor de uma diretoria é amortecido (todo setor tem diretor no cooperativo).
function dinheiroDoEvento(e, carta) {
  if (!ehCooperativo(e) || carta.dinheiro >= 0 || !diretoriaDoSetor(carta.setor)) return carta.dinheiro;
  return Math.round((carta.dinheiro * (1 - REDUCAO_PREJUIZO_PASSIVA)) / 100) * 100;
}

const TRANSICOES = {
  ROLAR_DADO: {
    ROLAR(e) {
      const rng = criarRng(e.rng);
      const j = jogadorAtual(e);
      const d1 = rng.inteiro(1, 6);
      const d2 = rng.inteiro(1, 6);
      const dado = d1 + d2;
      const { posicao, passouInicio } = avancar(j.posicao, dado);
      j.distancia = distanciaPercorrida(j) + dado;
      j.posicao = posicao;
      e.dado = dado;
      e.dados = [d1, d2];
      e.balanco = passouInicio ? aplicarBalanco(e, rng) : null;

      const casa = e.teste?.casa ?? CASAS[posicao];
      if (casa === 'balanco' && !e.balanco) e.balanco = aplicarBalanco(e, rng); // casa forçada no teste
      if (casa === 'decisao') {
        const def = obterCenario(sacarCenario(e, progressoDoJogador(e, j), rng));
        const inst = instanciar(def, rng);
        e.cenarioAtual = {
          id: def.id,
          ...inst,
          ordemOpcoes: rng.embaralhar(def.opcoes.map((o) => o.id)),
          ordemJustificativas: rng.embaralhar(def.justificativas.map((x) => x.id)),
          confianca: null,
          dicaUsada: false,
          metricaId: null,
          valorInformado: null,
          justificativaId: null,
        };
        e.fase = 'ESCOLHER_METRICA';
      } else if (casa === 'evento') {
        const idCarta = sacar(e, 'baralhoEventos', EVENTOS.map((x) => x.id), rng);
        const carta = EVENTOS.find((ev) => ev.id === idCarta);
        const dinheiro = dinheiroDoEvento(e, carta);
        const w = carteira(e);
        w.dinheiro += dinheiro;
        const crise = carta.reputacao !== 0 ? mudarReputacao(w, carta.reputacao) : false;
        e.eventoAtual = { id: carta.id, crise, dinheiro };
        e.fase = 'MOSTRAR_EVENTO';
      } else if (casa === 'mercado') {
        // O rival do solo não investe: passa pelo Mercado sem oferta (e sem gastar sorteios).
        e.mercadoAtual = ehBot(j)
          ? { empresaId: null, decisao: 'recusou' }
          : sortearOferta(e, carteira(e).reputacao, rng);
        e.fase = 'MOSTRAR_MERCADO';
      } else {
        e.fase = 'MOSTRAR_BALANCO';
      }
      e.rng = rng.estado;
      return e;
    },
  },

  ESCOLHER_METRICA: {
    // Só quem joga no nível iniciante e cujo cenário tem dica pode abri-la; o bônus de confiança cai (3.4).
    ABRIR_DICA(e) {
      const j = jogadorAtual(e);
      if (ehBot(j) || j.nivel !== 'iniciante' || !obterCenario(e.cenarioAtual.id).dica) return e;
      e.cenarioAtual.dicaUsada = true;
      return e;
    },
    METRICA(e, { valor }) {
      if (ehBot(jogadorAtual(e))) return e;
      if (!obterCenario(e.cenarioAtual.id).opcoes.some((o) => o.id === valor)) return e;
      e.cenarioAtual.metricaId = valor;
      e.fase = ehCalculo(obterCenario(e.cenarioAtual.id)) ? 'INFORMAR_VALOR' : 'ESCOLHER_JUSTIFICATIVA';
      return e;
    },
    // Vez do rival do modo solo: as três escolhas de uma vez, com o rng da partida.
    DECIDIR_BOT(e) {
      const j = jogadorAtual(e);
      if (!ehBot(j)) return e;
      const rng = criarRng(e.rng);
      const escolha = decidirBot(obterCenario(e.cenarioAtual.id), PERFIS_BOT[j.bot], rng, e.cenarioAtual.num);
      e.rng = rng.estado;
      e.cenarioAtual.metricaId = escolha.metrica;
      e.cenarioAtual.valorInformado = escolha.valor ?? null;
      e.cenarioAtual.justificativaId = escolha.justificativa;
      e.cenarioAtual.confianca = escolha.confianca;
      return resolverEscolhas(e);
    },
  },

  // Só em cenário de cálculo: o valor calculado pela pessoa (número ou texto em pt-BR).
  INFORMAR_VALOR: {
    VALOR(e, { valor }) {
      const n = lerNumero(valor);
      if (!Number.isFinite(n)) return e;
      e.cenarioAtual.valorInformado = n;
      e.fase = 'ESCOLHER_JUSTIFICATIVA';
      return e;
    },
  },

  ESCOLHER_JUSTIFICATIVA: {
    JUSTIFICATIVA(e, { valor }) {
      const c = e.cenarioAtual;
      const def = obterCenario(c.id);
      const just = def.justificativas.find((x) => x.id === valor);
      if (!just) return e;
      c.justificativaId = valor;
      e.fase = 'ESCOLHER_CONFIANCA';
      return e;
    },
  },

  ESCOLHER_CONFIANCA: {
    CONFIANCA(e, { valor }) {
      if (!Object.hasOwn(CONFIANCA, valor)) return e;
      e.cenarioAtual.confianca = valor;
      return resolverEscolhas(e);
    },
  },
};

// Fecha a oferta do Mercado: debita e registra o aporte, se houve, e paga o diagnóstico do argumento do fundador
// (bônus de reputação se acertou, perda se errou). Quem contratou a consultoria e não investiu paga o honorário na hora
// (quem investe só o paga se der errado, no Balanço). A explicação do argumento aparece na tela em qualquer caso.
function decidirMercado(e, decisao, aporte = null) {
  const m = e.mercadoAtual;
  const w = carteira(e);
  const j = jogadorAtual(e);
  m.decisao = decisao;
  if (decisao === 'investiu') {
    const def = obterEmpresa(m.empresaId);
    w.dinheiro -= aporte;
    m.aporte = aporte;
    j.investimentos = [
      ...investimentosDe(j),
      {
        empresaId: m.empresaId,
        nome: def.nome,
        porte: m.porte,
        valor: aporte,
        prob: m.prob,
        ganho: m.consultoria ? ganhoComConsultoria(m.ganho) : m.ganho,
        perda: m.perda,
        consultoria: m.consultoria,
        honorario: honorarioDaConsultoria(m.consultoria),
        turnoAporte: e.turnoAtual,
      },
    ];
  } else if (m.consultoria) {
    m.honorarioPago = honorarioDaConsultoria(true);
    w.dinheiro -= m.honorarioPago;
  }
  if (m.diagnostico) {
    const falha = obterEmpresa(m.empresaId).falha ?? 'nenhuma';
    const correta = m.diagnostico === falha;
    const deltaReputacao = correta ? ANALISE_BONUS_REPUTACAO : -ANALISE_PENALIDADE_REPUTACAO;
    m.analise = { falha, correta, deltaReputacao, crise: mudarReputacao(w, deltaReputacao) };
  }
}

// Só quem ainda pode agir na oferta: tem empresa (o rival do solo não) e não decidiu.
const ofertaAberta = (e) => Boolean(e.mercadoAtual?.empresaId) && !e.mercadoAtual.decisao;

TRANSICOES.MOSTRAR_MERCADO = {
  // Como a dica (3.4): ver a chance exata tem preço, que só se paga se a pessoa investir (fisher.md 3.14).
  ABRIR_CONSULTORIA(e) {
    if (!ofertaAberta(e) || e.mercadoAtual.consultoria) return e;
    e.mercadoAtual.consultoria = true;
    return e;
  },
  DIAGNOSTICAR(e, { valor }) {
    if (!ofertaAberta(e) || e.mercadoAtual.diagnostico || !OPCOES_DIAGNOSTICO.includes(valor)) return e;
    e.mercadoAtual.diagnostico = valor;
    return e;
  },
  INVESTIR(e, { valor }) {
    const aporte = Number(valor);
    if (!ofertaAberta(e) || !APORTES.includes(aporte) || aporte > carteira(e).dinheiro) return e;
    decidirMercado(e, 'investiu', aporte);
    return e;
  },
  RECUSAR(e) {
    if (!ofertaAberta(e)) return e;
    decidirMercado(e, 'recusou');
    return e;
  },
  // Seguir sem escolher vale como recusar.
  CONTINUAR(e) {
    if (ofertaAberta(e)) decidirMercado(e, 'recusou');
    return continuar(e);
  },
};

// Pontua a decisão com as escolhas já gravadas em `cenarioAtual` (por uma pessoa ou pelo bot).
function resolverEscolhas(e) {
  const c = e.cenarioAtual;
  const def = obterCenario(c.id);
  const just = def.justificativas.find((x) => x.id === c.justificativaId);
  if (!just) return e;

  const j = jogadorAtual(e);
  const w = carteira(e);
  const metrica = def.opcoes.find((o) => o.id === c.metricaId);
  // Em cenário de cálculo, métrica certa só vale com o valor dentro da margem (fisher.md 4.7).
  const calculo = ehCalculo(def) ? avaliarCalculo(metrica, c.num, c.valorInformado) : null;
  if (ehCalculo(def) && !Number.isFinite(c.valorInformado)) return e;
  const r = resolverDecisao({
    nivel: j.nivel,
    reputacao: w.reputacao,
    valorBase: def.valor_base,
    metricaCorreta: metrica.correta && (calculo?.dentro ?? true),
    justificativaCorreta: justificativaConta(just.tipo),
    confianca: c.confianca,
    impacto: def.impacto,
    dicaUsada: c.dicaUsada === true,
    sequencia: sequenciaDe(j),
  });
  j.sequencia = atualizarSequencia(r.categoria, sequenciaDe(j));
  w.dinheiro += r.delta;
  const crise = mudarReputacao(w, r.deltaReputacao);

  e.resultado = {
    cenarioId: def.id,
    metricaId: metrica.id,
    justificativaId: just.id,
    confianca: c.confianca,
    dicaUsada: c.dicaUsada === true,
    metricaCorreta: metrica.correta,
    justificativaCorreta: just.tipo === 'correta',
    ...(calculo && { valorCorreto: calculo.dentro, calculo }),
    categoria: r.categoria,
    delta: r.delta,
    multiplicador: r.multiplicador,
    multiplicadorSequencia: r.multiplicadorSequencia,
    sequencia: { ...j.sequencia },
    deltaReputacao: r.deltaReputacao,
    crise,
  };
  // Base do perfil de desempenho do fim de jogo (src/engine/desempenho.js).
  j.historico.push({
    cenario: def.id,
    conceito: def.conceito,
    metrica: metrica.id,
    justificativa: just.id,
    confianca: c.confianca,
    resultado: r.categoria,
    delta: r.delta,
    equivocos: equivocosDaEscolha(metrica, just),
    ...(calculo && { valor: calculo.informado, valorCorreto: calculo.dentro }),
  });
  e.fase = 'MOSTRAR_RESULTADO';
  return e;
}

function continuar(e) {
  const passouPeloBalanco = Boolean(e.balanco);
  // Dados iguais (fisher.md 3.2): quem tirou dois dados iguais joga de novo, na mesma vez e sem gastar trimestre.
  const dadosIguais = Array.isArray(e.dados) && e.dados[0] === e.dados[1];
  e.cenarioAtual = null;
  e.eventoAtual = null;
  e.mercadoAtual = null;
  e.resultado = null;
  e.balanco = null;
  e.dado = null;
  e.dados = null;
  e.jogadaExtra = false;

  // Falência (fisher.md 3.12): só na jogada em que passou pelo Balanço, com o caixa negativo ao fim dela.
  // Fora do Balanço o caixa pode ficar negativo sem eliminar. A pessoa viu o que causou antes de continuar.
  // No competitivo, quem passa negativado só é julgado quando não há ninguém negativo, com saldo pior, que
  // ainda não passou pelo Balanço; aí perde o de menor saldo entre os que passaram negativados (`julgarBalanco`).
  if (passouPeloBalanco) {
    if (ehCooperativo(e)) {
      if (e.empresa.dinheiro < 0) e.falencia = true;
    } else {
      const { perdedor } = julgarBalanco(e);
      const j = jogadorAtual(e);
      j.negativado = j.dinheiro < 0;
      if (perdedor) {
        perdedor.falido = true;
        for (const x of e.jogadores) x.negativado = false;
      }
    }
  }
  // A disputa acaba com a empresa falida, sem ninguém no jogo ou, com mais de um jogador, com um só sobrevivente.
  const ativos = jogadoresAtivos(e).length;
  if (e.falencia || ativos === 0 || (e.jogadores.length > 1 && ativos === 1)) {
    e.fase = 'FIM_DE_JOGO';
    return e;
  }

  // Jogada extra: o mesmo jogador rola outra vez, desde que siga no jogo (os testes acima já encerraram a partida).
  if (dadosIguais && !ehFalido(jogadorAtual(e))) {
    e.jogadaExtra = true;
    e.fase = 'ROLAR_DADO';
    return e;
  }

  // Próximo jogador que não faliu; ao dar a volta, começa o próximo trimestre.
  do {
    e.jogadorAtual += 1;
    if (e.jogadorAtual >= e.jogadores.length) {
      e.jogadorAtual = 0;
      e.turnoAtual += 1;
    }
  } while (ehFalido(jogadorAtual(e)));
  e.fase = e.turnoAtual > e.turnosPorJogador ? 'FIM_DE_JOGO' : 'ROLAR_DADO';
  if (e.fase === 'FIM_DE_JOGO') apurarInvestimentosFinais(e);
  return e;
}

// Fim da partida pelo número de trimestres: os aportes que ainda esperavam um Balanço são apurados agora, para o
// ranking não ignorar o dinheiro em custódia (fisher.md 3.14). Quem faliu perde os seus; falência da empresa ou
// vitória do último sobrevivente encerram a partida sem apuração.
function apurarInvestimentosFinais(e) {
  const rng = criarRng(e.rng);
  const apuracao = [];
  for (const j of e.jogadores) {
    if (ehFalido(j) || !investimentosDe(j).length) continue;
    apuracao.push({ jogador: j.id, nome: j.nome, investimentos: liquidarTodos(ehCooperativo(e) ? e.empresa : j, j, rng) });
  }
  e.rng = rng.estado;
  e.apuracaoFinal = apuracao.length ? apuracao : null;
}

for (const fase of ['MOSTRAR_RESULTADO', 'MOSTRAR_EVENTO', 'MOSTRAR_BALANCO']) {
  TRANSICOES[fase] = { CONTINUAR: continuar };
}

export function reduzir(estado, acao) {
  const transicao = TRANSICOES[estado.fase]?.[acao.tipo];
  return transicao ? transicao(structuredClone(estado), acao) : estado;
}
