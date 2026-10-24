import { HABILIDADE_USOS } from './config.js';
import { diretoriasDe } from './state.js';

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
  if (id === 'pessoas_financas' && !def.dica) return 'Este cenário não tem dica.';
  if (id === 'pessoas_financas' && c.dicaUsada) return 'A dica já foi aberta.';
  return null;
}

// Teste A/B (Tecnologia): revela duas métricas finalistas, a correta e uma errada (a primeira errada na ordem embaralhada do
// cenário, que varia por partida). Os dois ids saem na ordem em que as opções aparecem na tela (`ordemOpcoes`), para a
// posição não entregar qual é a certa.
export function testeAB(def, c) {
  const correta = def.opcoes.find((o) => o.correta).id;
  const errada = c.ordemOpcoes.find((id) => id !== correta && !def.opcoes.find((o) => o.id === id).correta);
  return c.ordemOpcoes.filter((id) => id === correta || id === errada);
}
