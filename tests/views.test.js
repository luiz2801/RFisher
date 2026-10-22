import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { viewMenu, viewJogo } from '../src/ui/views.js';
import { esc } from '../src/ui/html.js';

test('o menu renderiza, com e sem partida salva', () => {
  assert.match(viewMenu(), /Nova partida/);
  const salvo = novoJogo({ jogadores: [{ nome: 'A', nivel: 'iniciante' }], seed: 1 });
  assert.match(viewMenu({ salvo }), /Continuar partida salva/);
});

test('todas as telas de uma partida renderizam sem placeholders soltos nem HTML injetado', () => {
  const nomeMalicioso = '<img src=x onerror=alert(1)>';
  let e = novoJogo({
    jogadores: [{ nome: nomeMalicioso, nivel: 'iniciante' }, { nome: 'Bia', nivel: 'avancado' }],
    turnos: 12,
    seed: 2024,
  });
  const fasesVistas = new Set();
  for (let i = 0; i < 400 && e.fase !== 'FIM_DE_JOGO'; i++) {
    const html = viewJogo(e);
    fasesVistas.add(e.fase);
    assert.ok(!html.includes('{{'), `placeholder solto na fase ${e.fase}`);
    assert.ok(!html.includes('undefined'), `"undefined" na fase ${e.fase}`);
    assert.ok(!html.includes(nomeMalicioso), 'nome não escapado');
    const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
    // alterna entre acertar tudo e errar tudo para cobrir todos os tipos de feedback
    const certo = i % 2 === 0;
    const acao = {
      ROLAR_DADO: { tipo: 'ROLAR' },
      ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'certeza' },
      ESCOLHER_METRICA: { tipo: 'METRICA', valor: def && def.opcoes.find((o) => o.correta === certo).id },
      ESCOLHER_JUSTIFICATIVA: {
        tipo: 'JUSTIFICATIVA',
        valor: def && def.justificativas[certo ? 0 : 1 + (i % (def.justificativas.length - 1))].id,
      },
    }[e.fase] ?? { tipo: 'CONTINUAR' };
    e = reduzir(e, acao);
  }
  assert.match(viewJogo(e), /Fim de jogo/);
  const fim = viewJogo(e);
  assert.match(fim, /Relatório de desempenho/);
  assert.match(fim, /Bia<\/h3>/);
  assert.match(fim, /Sugestões de estudo|Não caiu em nenhuma casa de Decisão/);
  assert.ok(!fim.includes(nomeMalicioso), 'nome não escapado no relatório');
  for (const fase of ['ROLAR_DADO', 'ESCOLHER_CONFIANCA', 'ESCOLHER_METRICA', 'ESCOLHER_JUSTIFICATIVA', 'MOSTRAR_RESULTADO', 'MOSTRAR_EVENTO']) {
    assert.ok(fasesVistas.has(fase), `fase nunca exibida: ${fase}`);
  }
});

test('as telas do modo cooperativo renderizam até o fim', () => {
  let e = novoJogo({
    jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'iniciante' }],
    modo: 'cooperativo',
    turnos: 12,
    seed: 11,
  });
  for (let i = 0; i < 400 && e.fase !== 'FIM_DE_JOGO'; i++) {
    const html = viewJogo(e);
    assert.ok(!html.includes('undefined') && !html.includes('{{'), `tela quebrada na fase ${e.fase}`);
    assert.match(html, /caixa e reputação compartilhados/);
    const def = e.cenarioAtual && obterCenario(e.cenarioAtual.id);
    const acao = {
      ROLAR_DADO: { tipo: 'ROLAR' },
      ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'chute' },
      ESCOLHER_METRICA: { tipo: 'METRICA', valor: def?.opcoes[0].id },
      ESCOLHER_JUSTIFICATIVA: { tipo: 'JUSTIFICATIVA', valor: def?.justificativas[0].id },
    }[e.fase] ?? { tipo: 'CONTINUAR' };
    e = reduzir(e, acao);
  }
  assert.match(viewJogo(e), /terminou em:/);
  assert.match(viewJogo(e), /Relatório de desempenho/);
});

test('no modo solo o relatório de fim de jogo é só da pessoa, não do rival', () => {
  const e = novoJogo({
    jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Rival Analista', nivel: 'iniciante', bot: 'medio' }],
    seed: 3,
  });
  e.fase = 'FIM_DE_JOGO';
  const decisao = { metrica: 'x', justificativa: 'y', confianca: 'certeza', delta: 0 };
  e.jogadores[0].historico = [{ ...decisao, cenario: 'cenario_04_pecas', resultado: 'erro_total' }];
  e.jogadores[1].historico = [{ ...decisao, cenario: 'cenario_01_salarios', resultado: 'sucesso' }];
  const html = viewJogo(e);
  assert.match(html, /Ana<\/h3>/);
  assert.ok(!html.includes('Rival Analista</h3>'));
  assert.match(html, /Desvio padrão/);
  assert.match(html, /href="https:\/\/pt\.wikipedia\.org\/wiki\/Desvio_padr/);
  assert.ok(!html.includes('undefined'));
});

test('esc neutraliza HTML', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});
