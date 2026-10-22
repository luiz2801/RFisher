import { CONFIANCA } from './scoring.js';
import { obterCenario } from '../scenarios/loader.js';
import { CONCEITOS } from '../scenarios/content/conceitos.js';
import { MATERIAIS, MATERIAL_GERAL } from '../scenarios/content/materiais.js';

// Perfil de desempenho do fim de jogo (fisher.md 4.6): o que o jogador domina e onde tem
// deficiência, por conceito, levando em conta a certeza declarada em cada decisão.

// Certeza de 0 (chute) a 1 (certeza absoluta), derivada da escala de confiança (×0,5 a ×1,5).
export const certeza = (confianca) => (CONFIANCA[confianca] - CONFIANCA.chute) / (CONFIANCA.certeza - CONFIANCA.chute);

// Acima disto o jogador acertou o conceito; a partir disto declarou estar seguro.
export const LIMIAR_ACERTO = 0.5;
export const LIMIAR_CERTEZA = 0.5;
// Diferença entre certeza média e acerto médio que caracteriza excesso ou falta de confiança.
export const LIMIAR_CALIBRACAO = 0.15;

// Equívocos da opção e da justificativa escolhidas (sem repetição).
export function equivocosDaEscolha(opcao, justificativa) {
  return [...new Set([opcao.equivoco, justificativa.equivoco].filter(Boolean))];
}

// Acerto da decisão: métrica e justificativa valem meio ponto cada (sucesso 1, sorte e incoerência 0,5).
const ACERTO = { sucesso: 1, sorte: 0.5, incoerencia: 0.5, erro_total: 0 };

// Entradas antigas do histórico não têm `conceito` nem `equivocos`: vêm do conteúdo atual.
function normalizar(h) {
  const def = obterCenario(h.cenario);
  const opcao = def?.opcoes.find((o) => o.id === h.metrica);
  const just = def?.justificativas.find((x) => x.id === h.justificativa);
  return {
    conceito: h.conceito ?? def?.conceito ?? h.cenario,
    cenario: h.cenario,
    acerto: ACERTO[h.resultado] ?? 0,
    certeza: certeza(h.confianca),
    equivocos: h.equivocos ?? (opcao && just ? equivocosDaEscolha(opcao, just) : []),
  };
}

// Evidência de domínio, de −1 a +1: acertar com certeza vale +1, errar com certeza vale −1,
// e um chute vale metade. Acerto parcial (0,5) não conta para nenhum lado.
export const evidencia = (acerto, cert) => (2 * acerto - 1) * (0.5 + 0.5 * cert);

// dominado: acerta e sabe que sabe · inseguro: acerta, mas sem confiança
// equivoco: erra com confiança (a deficiência mais grave) · lacuna: erra e sabe que não sabe.
export function diagnosticar(taxaAcerto, certezaMedia) {
  const acertou = taxaAcerto > LIMIAR_ACERTO;
  const seguro = certezaMedia >= LIMIAR_CERTEZA;
  if (acertou) return seguro ? 'dominado' : 'inseguro';
  return seguro ? 'equivoco' : 'lacuna';
}

export function calibrar(taxaAcerto, certezaMedia) {
  const d = certezaMedia - taxaAcerto;
  if (d > LIMIAR_CALIBRACAO) return 'superconfiante';
  if (d < -LIMIAR_CALIBRACAO) return 'subconfiante';
  return 'calibrado';
}

const mediaDe = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);

function resumir(decisoes) {
  const taxaAcerto = mediaDe(decisoes.map((d) => d.acerto));
  const certezaMedia = mediaDe(decisoes.map((d) => d.certeza));
  return {
    decisoes: decisoes.length,
    taxaAcerto,
    certezaMedia,
    dominio: mediaDe(decisoes.map((d) => evidencia(d.acerto, d.certeza))),
    calibracao: calibrar(taxaAcerto, certezaMedia),
  };
}

// Perfil a partir do histórico de um jogador. Serializável, para a tela de fim de jogo.
export function perfilDesempenho(jogador) {
  const decisoes = (jogador.historico ?? []).map(normalizar);

  const porConceito = new Map();
  for (const d of decisoes) porConceito.set(d.conceito, [...(porConceito.get(d.conceito) ?? []), d]);
  const conceitos = [...porConceito].map(([id, ds]) => {
    const r = resumir(ds);
    return { id, nome: CONCEITOS[id] ?? id, ...r, diagnostico: diagnosticar(r.taxaAcerto, r.certezaMedia) };
  });

  // Fortes: mais domínio primeiro. Deficiências: menos domínio primeiro; no empate, quem errou com mais certeza.
  const pontosFortes = conceitos
    .filter((c) => c.diagnostico === 'dominado' || c.diagnostico === 'inseguro')
    .sort((a, b) => b.dominio - a.dominio || b.certezaMedia - a.certezaMedia);
  const deficiencias = conceitos
    .filter((c) => c.diagnostico === 'equivoco' || c.diagnostico === 'lacuna')
    .sort((a, b) => a.dominio - b.dominio || b.certezaMedia - a.certezaMedia);

  // Equívocos repetidos, pesados pela certeza com que foram cometidos.
  const porEquivoco = new Map();
  for (const d of decisoes) {
    for (const id of d.equivocos) {
      const q = porEquivoco.get(id) ?? { id, vezes: 0, peso: 0, cenarios: [] };
      q.vezes += 1;
      q.peso += 0.5 + 0.5 * d.certeza;
      if (!q.cenarios.includes(d.cenario)) q.cenarios.push(d.cenario);
      porEquivoco.set(id, q);
    }
  }
  const equivocos = [...porEquivoco.values()].sort((a, b) => b.peso - a.peso || b.vezes - a.vezes);

  return { geral: resumir(decisoes), conceitos, pontosFortes, deficiencias, equivocos };
}


// Quantos assuntos o relatório lista em cada seção e quantos ainda não vistos sugere.
export const MAX_ASSUNTOS = 3;
export const MAX_NAO_VISTOS = 2;

const sugestao = (id, motivo) => ({ conceito: id, nome: CONCEITOS[id] ?? id, motivo, ...MATERIAIS[id] });

// Relatório de fim de jogo (fisher.md 4.6): acertos e erros, assuntos que mais e menos domina
// e materiais de estudo. Sugere primeiro as deficiências, depois o conhecimento frágil (inseguro);
// sem nenhum dos dois, os conceitos que a partida não chegou a cobrar.
export function relatorioDesempenho(jogador) {
  const perfil = perfilDesempenho(jogador);
  const historico = jogador.historico ?? [];
  const conta = (...cats) => historico.filter((h) => cats.includes(h.resultado)).length;

  const inseguros = perfil.pontosFortes.filter((c) => c.diagnostico === 'inseguro').reverse();
  let sugestoes = [...perfil.deficiencias, ...inseguros].slice(0, MAX_ASSUNTOS).map((c) => sugestao(c.id, c.diagnostico));
  if (!sugestoes.length) {
    const vistos = new Set(perfil.conceitos.map((c) => c.id));
    sugestoes = Object.keys(MATERIAIS)
      .filter((id) => !vistos.has(id))
      .slice(0, MAX_NAO_VISTOS)
      .map((id) => sugestao(id, 'nao_visto'));
  }

  return {
    decisoes: historico.length,
    acertos: conta('sucesso'),
    parciais: conta('sorte', 'incoerencia'),
    erros: conta('erro_total'),
    metricasCertas: conta('sucesso', 'sorte'),
    justificativasCertas: conta('sucesso', 'incoerencia'),
    geral: perfil.geral,
    maisDomina: perfil.pontosFortes.slice(0, MAX_ASSUNTOS),
    menosDomina: perfil.deficiencias.slice(0, MAX_ASSUNTOS),
    sugestoes,
    materialGeral: MATERIAL_GERAL,
  };
}
