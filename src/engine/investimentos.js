import { FAIXAS_MERCADO, CONSULTORIA_PENALIDADE, CONSULTORIA_HONORARIO_FRACASSO, CONSULTORIA_PENALIDADE_RH, CONSULTORIA_HONORARIO_RH, SORTEIO_PROBABILIDADE } from './config.js';
import { EMPRESAS, FALACIAS, obterEmpresa } from '../scenarios/content/investimentos.js';

// Investimentos do Mercado (fisher.md 3.14): oferta por porte, retorno com consultoria e liquidação no Balanço.
// Só usa o rng recebido, então a partida continua reproduzível pela seed.

export const OPCOES_DIAGNOSTICO = Object.keys(FALACIAS);

const arredondar = (v) => Math.round(v / 100) * 100 || 0;
const centesimos = (v) => Math.round(v * 100) / 100;

// Porte da empresa ofertada: a maior faixa cuja reputação mínima o jogador atingiu.
export const porteDaReputacao = (reputacao) => [...FAIXAS_MERCADO].reverse().find((f) => reputacao >= f.min).id;

// Retorno esperado por real investido: chance de sucesso × ganho − chance de fracasso × perda.
export const valorEsperado = ({ prob, ganho, perda }) => prob * ganho - (1 - prob) * perda;

// Quem investe depois do relatório da consultoria paga metade do retorno do sucesso e, no fracasso, um honorário fixo.
// No cooperativo (`desconto`), Pessoas e Finanças reduz os dois pela metade.
export const penalidadeDaConsultoria = (desconto = false) => (desconto ? CONSULTORIA_PENALIDADE_RH : CONSULTORIA_PENALIDADE);
export const honorarioFixoDaConsultoria = (desconto = false) => (desconto ? CONSULTORIA_HONORARIO_RH : CONSULTORIA_HONORARIO_FRACASSO);
export const ganhoComConsultoria = (ganho, desconto = false) => ganho * (1 - penalidadeDaConsultoria(desconto));
export const honorarioDaConsultoria = (consultoria, desconto = false) => (consultoria ? honorarioFixoDaConsultoria(desconto) : 0);

// Saves antigos não têm `investimentos`.
export const investimentosDe = (j) => j?.investimentos ?? [];
export const totalInvestido = (j) => investimentosDe(j).reduce((soma, inv) => soma + inv.valor, 0);

// Oferta do Mercado: empresa do porte da reputação, sem repetir dentro do ciclo do porte. A chance de sucesso varia
// um pouco a cada oferta, para decorar "qual empresa é furada" não bastar. Altera `e.baralhoInvestimentos`.
export function sortearOferta(e, reputacao, rng) {
  const porte = porteDaReputacao(reputacao);
  e.baralhoInvestimentos ??= {};
  if (!e.baralhoInvestimentos[porte]?.length) {
    e.baralhoInvestimentos[porte] = rng.embaralhar(EMPRESAS.filter((x) => x.porte === porte).map((x) => x.id));
  }
  const def = obterEmpresa(e.baralhoInvestimentos[porte].shift());
  const prob = centesimos(Math.min(0.95, Math.max(0.05, def.prob + rng.entre(-SORTEIO_PROBABILIDADE, SORTEIO_PROBABILIDADE))));
  return {
    empresaId: def.id,
    porte,
    prob,
    ganho: def.ganho,
    perda: def.perda,
    consultoria: false,
    diagnostico: null,
    analise: null,
    aporte: null,
    decisao: null,
  };
}

// Sorteia o desfecho de um aporte. O crédito devolve o valor aportado com o retorno (ou com a perda) aplicado.
export function liquidar(inv, rng) {
  const sucesso = rng.prox() < inv.prob;
  const retorno = sucesso ? inv.ganho : -inv.perda;
  const honorario = sucesso ? 0 : inv.honorario ?? 0; // o honorário pode deixar o crédito negativo
  const credito = arredondar(inv.valor * (1 + retorno)) - honorario;
  const def = obterEmpresa(inv.empresaId);
  return {
    empresaId: inv.empresaId,
    nome: inv.nome,
    valor: inv.valor,
    consultoria: inv.consultoria,
    honorario,
    desfecho: sucesso ? 'sucesso' : 'fracasso',
    retorno,
    credito,
    liquido: credito - inv.valor,
    texto: (sucesso ? def?.sucesso : def?.fracasso) ?? '',
  };
}

// Liquida todos os aportes do jogador na carteira (a empresa, no cooperativo) e os zera. Devolve os resultados.
export function liquidarTodos(carteira, jogador, rng) {
  const resultados = investimentosDe(jogador).map((inv) => liquidar(inv, rng));
  for (const r of resultados) carteira.dinheiro += r.credito;
  jogador.investimentos = [];
  return resultados;
}
