import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRng } from '../src/engine/rng.js';
import { todosCenarios, validarCenario, instanciar, preencher } from '../src/scenarios/loader.js';
import { EVENTOS, TIPOS_CARTA, eventosDoTipo } from '../src/scenarios/content/eventos.js';

test('todo o conteúdo é válido (várias seeds)', () => {
  for (const def of todosCenarios()) {
    for (const seed of [1, 7, 99, 2024]) {
      assert.deepEqual(validarCenario(def, criarRng(seed)), []);
    }
  }
});

test('ids de cenário são únicos', () => {
  const ids = todosCenarios().map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('placeholders são calculados a partir dos dados', () => {
  const def = todosCenarios()[0];
  const { vars, num } = instanciar(def, criarRng(5));
  assert.ok(num.media > num.mediana * 1.5);
  assert.match(preencher(def.opcoes[0].texto, vars), /^Mediana \(R\$ [\d.]+\)$/);
});

test('o validador detecta problemas', () => {
  const ruim = structuredClone(todosCenarios()[0]);
  ruim.opcoes[1].correta = true;
  ruim.opcoes[2].equivoco = 'inexistente';
  ruim.contexto += ' {{nao_existe}}';
  const erros = validarCenario(ruim, criarRng(1));
  assert.equal(erros.length, 3, erros.join('\n'));
});

test('todo evento tem um setor válido', async () => {
  const { EVENTOS } = await import('../src/scenarios/content/eventos.js');
  const { SETORES } = await import('../src/engine/papeis.js');
  for (const ev of EVENTOS) assert.ok(SETORES.includes(ev.setor), `evento sem setor: ${ev.id}`);
});

test('o conteúdo das cartas: três tipos, lição nas boas e ruins, efeitos coerentes com o tipo', () => {
  const ids = EVENTOS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'ids únicos');
  for (const c of EVENTOS) {
    assert.ok(TIPOS_CARTA.includes(c.tipo), `tipo inválido: ${c.id}`);
    assert.ok(Number.isFinite(c.dinheiro) && Number.isFinite(c.reputacao), `efeitos numéricos: ${c.id}`);
    assert.ok(c.dinheiro % 500 === 0, `dinheiro em múltiplo de 500: ${c.id}`);
    if (c.tipo !== 'troll') assert.ok(c.licao, `lição ausente: ${c.id}`);
    if (c.tipo === 'boa') assert.ok(c.dinheiro > 0 && c.reputacao >= 0, `carta boa deve ganhar: ${c.id}`);
    if (c.tipo === 'ruim') assert.ok(c.dinheiro < 0 && c.reputacao <= 0, `carta ruim deve custar: ${c.id}`);
    if (c.tipo === 'troll') assert.ok(c.reputacao < 0 && Math.abs(c.dinheiro) <= 1500, `troll custa reputação e pouco dinheiro: ${c.id}`);
  }
  for (const tipo of TIPOS_CARTA) assert.ok(eventosDoTipo(tipo).length >= 9, `poucas cartas do tipo ${tipo}`);
});

test('o valor esperado de participar fica perto de zero em dinheiro', () => {
  const media = (tipo) => eventosDoTipo(tipo).reduce((a, c) => a + c.dinheiro, 0) / eventosDoTipo(tipo).length;
  const esperado = (media('boa') + media('ruim') + media('troll')) / 3;
  assert.ok(Math.abs(esperado) < 1000, `valor esperado ${esperado}`);
});

test('o validador exige setor no cenário', () => {
  const ruim = structuredClone(todosCenarios()[0]);
  delete ruim.setor;
  assert.equal(validarCenario(ruim, criarRng(1)).length, 1);
});

// ---------- testes negativos atômicos do validador ----------
// Cada mutação quebra exatamente uma regra, e o validador devolve exatamente um erro, com a mensagem esperada.

const base = () => structuredClone(todosCenarios()[0]);

function erroUnico(mutar, mensagem) {
  const def = base();
  mutar(def);
  const erros = validarCenario(def, criarRng(1));
  assert.equal(erros.length, 1, `esperado 1 erro, vieram ${erros.length}:\n${erros.join('\n')}`);
  assert.ok(erros[0].startsWith(`${def.id}: `), `mensagem sem o id do cenário: ${erros[0]}`);
  assert.match(erros[0], mensagem);
}

test('o cenário-base usado nos testes negativos é válido', () => {
  assert.deepEqual(validarCenario(base(), criarRng(1)), []);
});

test('validador: 4 opções em vez de 5', () => {
  erroUnico((d) => d.opcoes.pop(), /esperadas 5 opções, há 4/);
});

test('validador: 6 opções em vez de 5', () => {
  erroUnico((d) => d.opcoes.push({ ...d.opcoes[1], id: 'extra' }), /esperadas 5 opções, há 6/);
});

test('validador: nenhuma opção correta', () => {
  erroUnico((d) => {
    const certa = d.opcoes.find((o) => o.correta);
    certa.correta = false;
    certa.equivoco = 'ignora_outliers'; // sem isto, a opção errada sem equívoco seria um segundo erro
  }, /exatamente 1 opção correta/);
});

test('validador: duas opções corretas', () => {
  erroUnico((d) => {
    d.opcoes[1].correta = true;
  }, /exatamente 1 opção correta/);
});

test('validador: 5 justificativas (abaixo do pool de 6 a 8)', () => {
  erroUnico((d) => d.justificativas.pop(), /de 6 a 8 justificativas, há 5/);
});

test('validador: 9 justificativas (acima do pool de 6 a 8)', () => {
  erroUnico((d) => {
    for (const id of ['x1', 'x2', 'x3']) d.justificativas.push({ ...d.justificativas[4], id });
  }, /de 6 a 8 justificativas, há 9/);
});

test('validador: nenhuma justificativa correta', () => {
  erroUnico((d) => {
    d.justificativas.find((j) => j.tipo === 'correta').tipo = 'parcial';
  }, /exatamente 1 justificativa correta/);
});

test('validador: duas justificativas corretas', () => {
  erroUnico((d) => {
    d.justificativas[1].tipo = 'correta';
  }, /exatamente 1 justificativa correta/);
});

test('validador: tipo de justificativa inválido', () => {
  erroUnico((d) => {
    d.justificativas[4].tipo = 'quase_certa';
  }, /tipo de justificativa inválido: quase_certa/);
});

test('validador: opção errada sem o campo equivoco', () => {
  erroUnico((d) => {
    delete d.opcoes[1].equivoco;
  }, /opção errada sem equívoco: media/);
});

test('validador: opção que aponta para equívoco inexistente em feedback.por_equivoco', () => {
  erroUnico((d) => {
    d.opcoes[1].equivoco = 'nao_existe';
  }, /equívoco sem feedback: nao_existe/);
});

test('validador: justificativa que aponta para equívoco inexistente em feedback.por_equivoco', () => {
  erroUnico((d) => {
    d.justificativas[2].equivoco = 'nao_existe';
  }, /equívoco sem feedback: nao_existe/);
});

test('validador: marcador de revelação sem métrica correspondente', () => {
  erroUnico((d) => {
    d.feedback.revelacao.marcadores.push({ chave: 'metrica_fantasma', rotulo: 'Fantasma' });
  }, /marcador sem valor: metrica_fantasma/);
});

test('validador: dificuldade ausente, fracionária ou fora de 1 a 3', () => {
  erroUnico((d) => delete d.dificuldade, /dificuldade deve ser inteiro de 1 a 3: undefined/);
  erroUnico((d) => { d.dificuldade = 1.5; }, /dificuldade deve ser inteiro de 1 a 3: 1\.5/);
  erroUnico((d) => { d.dificuldade = 0; }, /dificuldade deve ser inteiro de 1 a 3: 0/);
  erroUnico((d) => { d.dificuldade = 4; }, /dificuldade deve ser inteiro de 1 a 3: 4/);
  erroUnico((d) => { d.dificuldade = '2'; }, /dificuldade deve ser inteiro de 1 a 3: 2/);
});

test('validador: dificuldade nos limites 1 e 3 é aceita', () => {
  for (const dificuldade of [1, 2, 3]) {
    const d = base();
    d.dificuldade = dificuldade;
    assert.deepEqual(validarCenario(d, criarRng(1)), [], `dificuldade ${dificuldade}`);
  }
});

test('validador: setor ausente ou inválido', () => {
  erroUnico((d) => delete d.setor, /setor inválido ou ausente: undefined/);
  erroUnico((d) => { d.setor = 'marketing'; }, /setor inválido ou ausente: marketing/);
});

test('validador: conceito ausente ou inválido', () => {
  erroUnico((d) => delete d.conceito, /conceito inválido ou ausente: undefined/);
  erroUnico((d) => { d.conceito = 'conceito_inexistente'; }, /conceito inválido ou ausente: conceito_inexistente/);
});

test('validador: placeholder inexistente no contexto', () => {
  erroUnico((d) => { d.contexto += ' {{nao_existe}}'; }, /placeholder inexistente: \{\{nao_existe\}\}/);
});

test('validador: marcador de dispersão não vira linha no eixo', () => {
  erroUnico((d) => { d.feedback.revelacao.marcadores.push({ chave: 'iqr', rotulo: 'IQR' }); }, /marcador de dispersão.*iqr/);
});
