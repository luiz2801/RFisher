import { HABILIDADE_USOS } from './config.js';
import { ehCalculo } from './calculo.js';
import { diretoriasDe } from './state.js';
import { resumo } from '../stats/metrics.js';

// Habilidades ativas das diretorias (docs/modo-cooperativo.md seção 2), usadas na escolha da métrica nos três modos.
// Dão informação, nunca a resposta: a justificativa e a confiança continuam obrigatórias.
export const HABILIDADES = ['operacoes', 'tecnologia', 'pessoas_financas'];

// Saves antigos guardam um inteiro (0) em `habilidadeUsos`: vale um objeto vazio.
const usosDeTodas = (j) => (j?.habilidadeUsos && typeof j.habilidadeUsos === 'object' ? j.habilidadeUsos : {});
export const usosDaHabilidade = (j, id) => usosDeTodas(j)[id] ?? 0;
export const usosRestantes = (j, id) => Math.max(0, HABILIDADE_USOS - usosDaHabilidade(j, id));
export const registrarUso = (j, id) => {
  j.habilidadeUsos = { ...usosDeTodas(j), [id]: usosDaHabilidade(j, id) + 1 };
};

// Motivo de a habilidade não poder ser usada agora, ou null se pode. `c` é o `cenarioAtual` e `def` o cenário.
export function motivoIndisponivel(e, j, c, def, id) {
  if (!HABILIDADES.includes(id) || !diretoriasDe(e, j).includes(id)) return 'Sua diretoria não tem esta habilidade.';
  if (c.habilidades?.includes(id)) return 'Já usada neste cenário.';
  if (usosRestantes(j, id) === 0) return 'Sem usos restantes nesta partida.';
  if (id === 'tecnologia' && ehCalculo(def)) return 'Nos cenários de cálculo o resumo entregaria o resultado.';
  if (id === 'pessoas_financas' && !def.dica) return 'Este cenário não tem dica.';
  if (id === 'pessoas_financas' && c.dicaUsada) return 'A dica já foi aberta.';
  return null;
}

// Resumo estatístico de cada série visível do cenário (Dashboard da Tecnologia). Colunas ocultas até o resultado ficam de fora.
export function resumoDoDashboard(def, c) {
  const ocultas = def.dados.ocultas_ate_resultado ?? [];
  return c.series
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !ocultas.includes(i))
    .map(({ s, i }) => {
      const r = resumo(s.valores);
      return { indice: i, nome: s.nome, n: s.valores.length, minimo: r.minimo, q1: r.p25, q3: r.p75, maximo: r.maximo, mediana: r.mediana };
    });
}
