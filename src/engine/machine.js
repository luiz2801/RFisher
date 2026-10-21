import { criarRng } from './rng.js';
import { CASAS, avancar } from './board.js';
import {
  CUSTOS_BALANCO, MULTA_CRISE, REPUTACAO_POS_CRISE, META_CRESCIMENTO_POR_JOGADOR, BONUS_INVESTIDOR,
  BONUS_INVESTIDOR_REPUTACAO, CORTE_ORCAMENTO, CORTE_ORCAMENTO_REPUTACAO, REDUCAO_PREJUIZO_PASSIVA,
  REPUTACAO_BALANCO_RH, DINHEIRO_INICIAL,
} from './config.js';
import { resolverDecisao, receitaBalanco, justificativaConta } from './scoring.js';
import { jogadorAtual, carteira, ehCooperativo } from './state.js';
import { diretoriaDoSetor } from './papeis.js';
import { instanciar, obterCenario, idsCenarios } from '../scenarios/loader.js';
import { EVENTOS } from '../scenarios/content/eventos.js';

// Máquina de estados do turno: cada transição é (estado, ação) -> novo estado.
// Ação inválida para a fase atual é ignorada.

function sacar(e, chave, todos, rng) {
  if (!e[chave].length) e[chave] = rng.embaralhar(todos);
  return e[chave].shift();
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
  DINHEIRO_INICIAL + META_CRESCIMENTO_POR_JOGADOR * e.jogadores.length * (e.turnoAtual - 1);

function aplicarBalanco(e) {
  const w = carteira(e);
  const receita = receitaBalanco(w.reputacao);
  w.dinheiro += receita - CUSTOS_BALANCO;
  const balanco = { receita, custos: CUSTOS_BALANCO, liquido: receita - CUSTOS_BALANCO };
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
      const dado = rng.inteiro(1, 6);
      const { posicao, passouInicio } = avancar(j.posicao, dado);
      j.posicao = posicao;
      e.dado = dado;
      e.balanco = passouInicio ? aplicarBalanco(e) : null;

      const casa = CASAS[posicao];
      if (casa === 'decisao') {
        const def = obterCenario(sacar(e, 'baralhoCenarios', idsCenarios(), rng));
        const inst = instanciar(def, rng);
        e.cenarioAtual = {
          id: def.id,
          ...inst,
          ordemOpcoes: rng.embaralhar(def.opcoes.map((o) => o.id)),
          ordemJustificativas: rng.embaralhar(def.justificativas.map((x) => x.id)),
          confianca: null,
          metricaId: null,
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
      } else {
        e.fase = 'MOSTRAR_BALANCO';
      }
      e.rng = rng.estado;
      return e;
    },
  },

  ESCOLHER_METRICA: {
    METRICA(e, { valor }) {
      if (!obterCenario(e.cenarioAtual.id).opcoes.some((o) => o.id === valor)) return e;
      e.cenarioAtual.metricaId = valor;
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
      if (valor !== 'chute' && valor !== 'certeza') return e;
      const c = e.cenarioAtual;
      c.confianca = valor;

      const def = obterCenario(c.id);
      const just = def.justificativas.find((x) => x.id === c.justificativaId);
      if (!just) return e;

      const j = jogadorAtual(e);
      const w = carteira(e);
      const metrica = def.opcoes.find((o) => o.id === c.metricaId);
      const r = resolverDecisao({
        nivel: j.nivel,
        reputacao: w.reputacao,
        valorBase: def.valor_base,
        metricaCorreta: metrica.correta,
        justificativaCorreta: justificativaConta(just.tipo),
        confianca: valor,
        impacto: def.impacto,
      });
      w.dinheiro += r.delta;
      const crise = mudarReputacao(w, r.deltaReputacao);

      e.resultado = {
        cenarioId: def.id,
        metricaId: metrica.id,
        justificativaId: just.id,
        confianca: valor,
        metricaCorreta: metrica.correta,
        justificativaCorreta: just.tipo === 'correta',
        categoria: r.categoria,
        delta: r.delta,
        multiplicador: r.multiplicador,
        deltaReputacao: r.deltaReputacao,
        crise,
      };
      j.historico.push({
        cenario: def.id,
        metrica: metrica.id,
        justificativa: just.id,
        confianca: valor,
        resultado: r.categoria,
        delta: r.delta,
      });
      e.fase = 'MOSTRAR_RESULTADO';
      return e;
    },
  },
};

function continuar(e) {
  e.cenarioAtual = null;
  e.eventoAtual = null;
  e.resultado = null;
  e.balanco = null;
  e.dado = null;

  if (e.jogadorAtual + 1 < e.jogadores.length) {
    e.jogadorAtual += 1;
  } else {
    e.jogadorAtual = 0;
    e.turnoAtual += 1;
  }
  e.fase = e.turnoAtual > e.turnosPorJogador ? 'FIM_DE_JOGO' : 'ROLAR_DADO';
  return e;
}

for (const fase of ['MOSTRAR_RESULTADO', 'MOSTRAR_EVENTO', 'MOSTRAR_BALANCO']) {
  TRANSICOES[fase] = { CONTINUAR: continuar };
}

export function reduzir(estado, acao) {
  const transicao = TRANSICOES[estado.fase]?.[acao.tipo];
  return transicao ? transicao(structuredClone(estado), acao) : estado;
}
