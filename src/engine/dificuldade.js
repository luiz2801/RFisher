import { DIFICULDADE_MAX, SELETIVIDADE_DIFICULDADE } from './config.js';

// Progresso 0..1 vira dificuldade-alvo contínua entre 1 e DIFICULDADE_MAX.
export const dificuldadeAlvo = (progresso) => 1 + Math.min(1, Math.max(0, progresso)) * (DIFICULDADE_MAX - 1);

// Quanto mais perto da dificuldade-alvo, maior a chance. Nenhum cenário é excluído.
export const pesoDificuldade = (dificuldade, progresso) =>
  1 / (1 + SELETIVIDADE_DIFICULDADE * (dificuldade - dificuldadeAlvo(progresso)) ** 2);

// `candidatos`: [{ id, dificuldade }]. Devolve o id sorteado (consome um valor do rng).
export function escolherPorDificuldade(candidatos, progresso, rng) {
  const pesos = candidatos.map((c) => pesoDificuldade(c.dificuldade, progresso));
  let r = rng.prox() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidatos.length; i++) {
    r -= pesos[i];
    if (r < 0) return candidatos[i].id;
  }
  return candidatos[candidatos.length - 1].id;
}
