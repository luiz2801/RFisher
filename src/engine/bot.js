import {
  BOT_QUEDA_POR_DIFICULDADE, BOT_ACERTO_MIN, BOT_ACERTO_MAX, BOT_SINAL_CONFIANCA, BOT_RUIDO_CONFIANCA,
  BOT_LIMIARES_CONFIANCA,
} from './config.js';
import { CONFIANCA } from './scoring.js';

// Rival do modo solo (fisher.md 3.11). Não resolve o cenário: acerta com a frequência do seu perfil,
// erra escolhendo um distrator e aposta conforme uma certeza interna ruidosa. Usa só o rng recebido,
// então a partida continua reproduzível pela seed.

const NIVEIS_CONFIANCA = Object.keys(CONFIANCA); // do chute à certeza

// Chance de acerto no cenário: cai com a dificuldade, como para uma pessoa.
export const acertoEfetivo = (perfil, dificuldade) =>
  Math.min(BOT_ACERTO_MAX, Math.max(BOT_ACERTO_MIN, perfil.acerto - BOT_QUEDA_POR_DIFICULDADE * (dificuldade - 1)));

// Certeza interna -> nível de confiança.
export function confiancaDaCerteza(certeza) {
  const i = BOT_LIMIARES_CONFIANCA.findIndex((limiar) => certeza < limiar);
  return NIVEIS_CONFIANCA[i === -1 ? NIVEIS_CONFIANCA.length - 1 : i];
}

const qualquer = (lista, rng) => lista[rng.inteiro(0, lista.length - 1)];

// `perfil`: { acerto }. Devolve os ids da métrica e da justificativa e a chave da confiança.
export function decidirBot(def, perfil, rng) {
  const p = acertoEfetivo(perfil, def.dificuldade);
  const acertaMetrica = rng.prox() < p;
  const acertaJustificativa = rng.prox() < p;
  const metrica = qualquer(def.opcoes.filter((o) => o.correta === acertaMetrica), rng);
  const justificativa = qualquer(def.justificativas.filter((x) => (x.tipo === 'correta') === acertaJustificativa), rng);
  // Quem acerta tende a se sentir mais seguro, mas com ruído: às vezes erra convicto.
  const acertos = Number(acertaMetrica) + Number(acertaJustificativa);
  const certeza = p + BOT_SINAL_CONFIANCA * (acertos - 1) + rng.normal(0, BOT_RUIDO_CONFIANCA);
  return { metrica: metrica.id, justificativa: justificativa.id, confianca: confiancaDaCerteza(certeza) };
}
