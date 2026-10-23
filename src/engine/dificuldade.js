import { DIFICULDADE_MAX, PROGRESSOES, PROGRESSAO_PADRAO, SELETIVIDADE_DIFICULDADE } from './config.js';

// Progressão desconhecida (ou ausente, em save antigo) vale a tradicional.
const expoenteDe = (progressao) => (PROGRESSOES[progressao] ?? PROGRESSOES[PROGRESSAO_PADRAO]).expoente;

// Progresso 0..1 vira dificuldade-alvo contínua entre 1 e DIFICULDADE_MAX. O ritmo da subida vem da progressão
// escolhida: com expoente maior que 1 a curva sobe devagar no início.
export const dificuldadeAlvo = (progresso, progressao = PROGRESSAO_PADRAO) =>
  1 + Math.min(1, Math.max(0, progresso)) ** expoenteDe(progressao) * (DIFICULDADE_MAX - 1);

// Quanto mais perto da dificuldade-alvo, maior a chance. Nenhum cenário é excluído.
export const pesoDificuldade = (dificuldade, progresso, progressao = PROGRESSAO_PADRAO) =>
  1 / (1 + SELETIVIDADE_DIFICULDADE * (dificuldade - dificuldadeAlvo(progresso, progressao)) ** 2);

// `candidatos`: [{ id, dificuldade }]. Devolve o id sorteado (consome um valor do rng).
export function escolherPorDificuldade(candidatos, progresso, rng, progressao = PROGRESSAO_PADRAO) {
  const pesos = candidatos.map((c) => pesoDificuldade(c.dificuldade, progresso, progressao));
  let r = rng.prox() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidatos.length; i++) {
    r -= pesos[i];
    if (r < 0) return candidatos[i].id;
  }
  return candidatos[candidatos.length - 1].id;
}
