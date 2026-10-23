import CENARIOS from './content/cenarios.json' with { type: 'json' };
import { CONCEITOS } from './content/conceitos.js';
import { gerar } from './generators.js';
import { resumo } from '../stats/metrics.js';
import { formatar } from '../stats/format.js';
import { SETORES } from '../engine/papeis.js';
import { DIFICULDADE_MAX } from '../engine/config.js';
import { ehCalculo } from '../engine/calculo.js';

const POR_ID = new Map(CENARIOS.map((c) => [c.id, c]));

export const obterCenario = (id) => POR_ID.get(id);
export const idsCenarios = () => CENARIOS.map((c) => c.id);
export const todosCenarios = () => CENARIOS;

export function preencher(texto, vars) {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, chave) => vars[chave] ?? `{{${chave}}}`);
}

// Números brutos por série. A série 0 vale sem sufixo; todas valem com _a, _b, ...
export function calcularNumeros(series) {
  const num = {};
  series.forEach((s, i) => {
    for (const [k, v] of Object.entries(resumo(s.valores))) {
      num[`${k}_${'abcdefgh'[i]}`] = v;
      if (i === 0) num[k] = v;
    }
  });
  return num;
}

export function valorDoMarcador(num, chave, indiceSerie, totalSeries) {
  return totalSeries > 1 ? num[`${chave}_${'abcdefgh'[indiceSerie]}`] : num[chave];
}

// Resultado serializável: vai direto para o estado do jogo e para o localStorage.
export function instanciar(def, rng) {
  const { series } = gerar(def.dados.gerador, rng);
  const num = calcularNumeros(series);
  const vars = { n: String(series[0].valores.length) };
  for (const [k, v] of Object.entries(num)) vars[k] = formatar(def.dados.formato, v);
  return { series, num, vars };
}

function textosDe(def) {
  const t = [def.contexto, def.dica, def.feedback.explicacao_correta, def.feedback.como_calcular ?? ''];
  t.push(...def.opcoes.map((o) => o.texto), ...def.justificativas.map((j) => j.texto));
  t.push(...Object.values(def.feedback.por_equivoco));
  return t;
}

// Cenário de cálculo (fisher.md 4.7): cada métrica aponta para um número calculável, as opções não entregam
// o valor e há explicação do cálculo. A margem não é configurada no cenário: vem da grandeza do valor exato.
function validarCalculo(def, num, err) {
  const exibir = def.dados.exibir ?? [];
  if (!exibir.includes('tabela') || exibir.some((x) => !['tabela', 'grafico'].includes(x))) {
    err('dados.exibir deve incluir "tabela" e só aceita "tabela" e "grafico"');
  }
  if (def.dados.tabela && !['valores', 'frequencias'].includes(def.dados.tabela)) err(`dados.tabela inválido: ${def.dados.tabela}`);
  if (typeof def.feedback.como_calcular !== 'string') err('feedback.como_calcular é obrigatório em cenário de cálculo');
  for (const o of def.opcoes) {
    if (!(o.chave in num)) err(`opção sem chave de métrica calculável: ${o.id}`);
    if (o.texto.includes('{{')) err(`o texto da opção não pode revelar o valor: ${o.id}`);
  }
}

// Devolve a lista de problemas do cenário (vazia se estiver tudo certo).
export function validarCenario(def, rng) {
  const erros = [];
  const err = (m) => erros.push(`${def.id}: ${m}`);

  if (!SETORES.includes(def.setor)) err(`setor inválido ou ausente: ${def.setor}`);
  if (!Object.hasOwn(CONCEITOS, def.conceito)) err(`conceito inválido ou ausente: ${def.conceito}`);
  if (!Number.isInteger(def.dificuldade) || def.dificuldade < 1 || def.dificuldade > DIFICULDADE_MAX) {
    err(`dificuldade deve ser inteiro de 1 a ${DIFICULDADE_MAX}: ${def.dificuldade}`);
  }
  if (def.opcoes.length !== 5) err(`esperadas 5 opções, há ${def.opcoes.length}`);
  if (def.opcoes.filter((o) => o.correta).length !== 1) err('deve haver exatamente 1 opção correta');
  const nJust = def.justificativas.length;
  if (nJust < 6 || nJust > 8) err(`o pool deve ter de 6 a 8 justificativas, há ${nJust}`);
  if (def.justificativas.filter((j) => j.tipo === 'correta').length !== 1) err('deve haver exatamente 1 justificativa correta');

  for (const item of [...def.opcoes, ...def.justificativas]) {
    if (item.equivoco && !def.feedback.por_equivoco[item.equivoco]) err(`equívoco sem feedback: ${item.equivoco}`);
    if (item.tipo && !['correta', 'parcial', 'erro_conceitual', 'afirmacao_falsa', 'irrelevante'].includes(item.tipo)) {
      err(`tipo de justificativa inválido: ${item.tipo}`);
    }
  }
  for (const o of def.opcoes) if (!o.correta && !o.equivoco) err(`opção errada sem equívoco: ${o.id}`);

  const { vars, num } = instanciar(def, rng);
  if (ehCalculo(def)) validarCalculo(def, num, err);
  for (const texto of textosDe(def)) {
    for (const [, chave] of texto.matchAll(/\{\{(\w+)\}\}/g)) {
      if (!(chave in vars)) err(`placeholder inexistente: {{${chave}}}`);
    }
  }
  for (const m of def.feedback.revelacao.marcadores) {
    const chave = m.chave in num ? m.chave : `${m.chave}_a`;
    if (!(chave in num)) err(`marcador sem valor: ${m.chave}`);
  }
  return erros;
}
