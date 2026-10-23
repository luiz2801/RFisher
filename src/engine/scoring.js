import {
  RECEITA_BALANCO, SEQUENCIA_FATOR_ACERTO, SEQUENCIA_TETO, SEQUENCIA_FATOR_ERRO, SEQUENCIA_PISO,
} from './config.js';

// Escala crescente de certeza, em degraus iguais de 0,25 (seção 3.4).
export const CONFIANCA = { chute: 0.5, duvida: 0.75, provavel: 1, confiante: 1.25, certeza: 1.5 };
export const ROTULO_CONFIANCA = {
  chute: 'Chute',
  duvida: 'Tenho dúvidas',
  provavel: 'Provavelmente certo',
  confiante: 'Confiante',
  certeza: 'Certeza absoluta',
};
// Quem abre a dica tem o bônus da confiança (a parte acima de ×1) reduzido pela metade nos ganhos:
// certeza ×1,5 vira ×1,25. Perdas e confianças até ×1 não mudam (seção 3.4).
export const ATENUACAO_DICA = 0.5;
export const confiancaEfetiva = (c, dicaUsada) => (dicaUsada && c > 1 ? 1 + (c - 1) * (1 - ATENUACAO_DICA) : c);
export const NIVEL = { iniciante: 1, avancado: 1.5 };

// Questão em aberto (seção 8, item 4): por ora a justificativa "parcial" conta como errada.
export const PARCIAL_CONTA_COMO_CORRETA = false;

const arredondar = (v) => Math.round(v / 100) * 100 || 0;

// 0 -> ×0,8 · 50 -> ×1,0 · 100 -> ×1,3
export function multiplicadorReputacao(reputacao) {
  const r = Math.min(100, Math.max(0, reputacao));
  return r <= 50 ? 0.8 + (r / 50) * 0.2 : 1 + ((r - 50) / 50) * 0.3;
}

// Sequência de decisões consecutivas: `erros` de erro total, ou `acertos` de sucesso absoluto (só uma das duas é > 0).
// Resposta parcial (sorte ou incoerência) zera as duas (seção 3.13). Evento e Balanço não passam por aqui.
export const SEM_SEQUENCIA = { erros: 0, acertos: 0 };

// Fator acumulado da sequência: 1,1 por acerto seguido (até 2) ou 0,9 por erro seguido (até 0,5).
export function fatorSequencia({ erros = 0, acertos = 0 } = SEM_SEQUENCIA) {
  if (acertos) return Math.min(SEQUENCIA_TETO, SEQUENCIA_FATOR_ACERTO ** acertos);
  if (erros) return Math.max(SEQUENCIA_PISO, SEQUENCIA_FATOR_ERRO ** erros);
  return 1;
}

// Multiplicador da decisão que se segue à sequência: o fator sobre o ganho do sucesso absoluto e o inverso dele
// sobre a perda do erro total (a sequência de erros agrava a perda; a de acertos a alivia).
export function multiplicadorSequencia(categoria, sequencia = SEM_SEQUENCIA) {
  if (categoria === 'sucesso') return fatorSequencia(sequencia);
  if (categoria === 'erro_total') return 1 / fatorSequencia(sequencia);
  return 1;
}

// Sequência depois da decisão.
export function atualizarSequencia(categoria, { erros = 0, acertos = 0 } = SEM_SEQUENCIA) {
  if (categoria === 'erro_total') return { erros: erros + 1, acertos: 0 };
  if (categoria === 'sucesso') return { erros: 0, acertos: acertos + 1 };
  return { ...SEM_SEQUENCIA };
}

export function justificativaConta(tipo) {
  return tipo === 'correta' || (PARCIAL_CONTA_COMO_CORRETA && tipo === 'parcial');
}

export function classificar(metricaCorreta, justificativaCorreta) {
  if (metricaCorreta && justificativaCorreta) return 'sucesso';
  if (metricaCorreta) return 'sorte';
  if (justificativaCorreta) return 'incoerencia';
  return 'erro_total';
}

export function resolverDecisao({ nivel, reputacao, valorBase, metricaCorreta, justificativaCorreta, confianca, impacto, dicaUsada = false, sequencia = SEM_SEQUENCIA }) {
  const V = valorBase * NIVEL[nivel];
  const c = CONFIANCA[confianca];
  const categoria = classificar(metricaCorreta, justificativaCorreta);

  const cGanho = confiancaEfetiva(c, dicaUsada);
  const bruto = { sucesso: V * cGanho, sorte: 0.2 * V * cGanho, incoerencia: 0, erro_total: -0.5 * V * c }[categoria];
  const multiplicador = bruto > 0 ? multiplicadorReputacao(reputacao) : 1;
  const multiplicadorSeq = multiplicadorSequencia(categoria, sequencia);
  const deltaReputacao = {
    sucesso: impacto.reputacao_acerto,
    sorte: 0,
    incoerencia: Math.round(impacto.reputacao_erro / 2),
    erro_total: impacto.reputacao_erro,
  }[categoria];

  return { categoria, delta: arredondar(bruto * multiplicador * multiplicadorSeq), multiplicador, multiplicadorSequencia: multiplicadorSeq, deltaReputacao };
}

export function receitaBalanco(reputacao) {
  return arredondar(RECEITA_BALANCO * multiplicadorReputacao(reputacao));
}
