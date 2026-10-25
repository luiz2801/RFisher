// Auxiliares dos testes de rede: uma partida pequena e uma "pessoa" que acerta tudo.

import { novoJogo } from '../../src/engine/state.js';
import { valorEsperado } from '../../src/engine/calculo.js';
import { obterCenario } from '../../src/scenarios/loader.js';

export const DIRS = ['operacoes', 'tecnologia', 'pessoas_financas'];

export const jogo = ({ n = 2, modo = 'competitivo', seed = 1, teste = null } = {}) =>
  novoJogo({
    jogadores: Array.from({ length: n }, (_, i) => ({ nome: `P${i + 1}`, nivel: 'iniciante', diretoria: DIRS[i] })),
    turnos: 3, modo, seed, teste,
  });

// A pessoa acerta tudo e participa de todo evento (passando por 'escolhendo' e 'trocando').
export function acaoHumana(e) {
  const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
  const ev = e.eventoAtual;
  if (e.fase === 'MOSTRAR_EVENTO' && ev?.cartas) {
    if (ev.decisao === null) return { tipo: 'PARTICIPAR' };
    if (ev.decisao === 'escolhendo') return { tipo: 'ESCOLHER_CARTA', valor: 0 };
    if (ev.decisao === 'trocando') return { tipo: 'TROCAR' };
  }
  return ({
    ROLAR_DADO: { tipo: 'ROLAR' },
    ESCOLHER_METRICA: def && { tipo: 'METRICA', valor: def.opcoes.find((o) => o.correta).id },
    INFORMAR_VALOR: def && { tipo: 'VALOR', valor: valorEsperado(def, e.cenarioAtual) },
    ESCOLHER_JUSTIFICATIVA: def && { tipo: 'JUSTIFICATIVA', valor: def.justificativas.find((j) => j.tipo === 'correta').id },
    ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'certeza' },
  })[e.fase] ?? { tipo: 'CONTINUAR' };
}
