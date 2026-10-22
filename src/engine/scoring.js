import { RECEITA_BALANCO } from './config.js';

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

export function justificativaConta(tipo) {
  return tipo === 'correta' || (PARCIAL_CONTA_COMO_CORRETA && tipo === 'parcial');
}

export function classificar(metricaCorreta, justificativaCorreta) {
  if (metricaCorreta && justificativaCorreta) return 'sucesso';
  if (metricaCorreta) return 'sorte';
  if (justificativaCorreta) return 'incoerencia';
  return 'erro_total';
}

export function resolverDecisao({ nivel, reputacao, valorBase, metricaCorreta, justificativaCorreta, confianca, impacto, dicaUsada = false }) {
  const V = valorBase * NIVEL[nivel];
  const c = CONFIANCA[confianca];
  const categoria = classificar(metricaCorreta, justificativaCorreta);

  const cGanho = confiancaEfetiva(c, dicaUsada);
  const bruto = { sucesso: V * cGanho, sorte: 0.2 * V * cGanho, incoerencia: 0, erro_total: -0.5 * V * c }[categoria];
  const multiplicador = bruto > 0 ? multiplicadorReputacao(reputacao) : 1;
  const deltaReputacao = {
    sucesso: impacto.reputacao_acerto,
    sorte: 0,
    incoerencia: Math.round(impacto.reputacao_erro / 2),
    erro_total: impacto.reputacao_erro,
  }[categoria];

  return { categoria, delta: arredondar(bruto * multiplicador), multiplicador, deltaReputacao };
}

export function receitaBalanco(reputacao) {
  return arredondar(RECEITA_BALANCO * multiplicadorReputacao(reputacao));
}
