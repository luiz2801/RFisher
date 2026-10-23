import test from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from '../src/engine/state.js';
import { reduzir } from '../src/engine/machine.js';
import { valorEsperado } from '../src/engine/calculo.js';
import { obterCenario } from '../src/scenarios/loader.js';
import { viewMenu, viewJogo } from '../src/ui/views.js';
import { esc } from '../src/ui/html.js';
import { obterEmpresa, FALACIAS } from '../src/scenarios/content/investimentos.js';
import { APORTES } from '../src/engine/config.js';

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
      // valor exato quando "acerta" e fora da margem quando "erra", para cobrir os dois feedbacks
      INFORMAR_VALOR: { tipo: 'VALOR', valor: def && (certo ? 1 : 1.5) * valorEsperado(def, e.cenarioAtual) + (certo ? 0 : 1) },
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
  for (const fase of ['ROLAR_DADO', 'ESCOLHER_CONFIANCA', 'ESCOLHER_METRICA', 'INFORMAR_VALOR', 'ESCOLHER_JUSTIFICATIVA', 'MOSTRAR_RESULTADO', 'MOSTRAR_EVENTO']) {
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
      INFORMAR_VALOR: { tipo: 'VALOR', valor: def && valorEsperado(def, e.cenarioAtual) },
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

test('o menu lista os atalhos de teste e a partida de teste exibe o selo', () => {
  const menu = viewMenu();
  assert.match(menu, /Atalhos de teste/);
  assert.match(menu, /Só os de cálculo/);
  assert.match(menu, /cenario_14_alugueis/);
  const e = novoJogo({ jogadores: [{ nome: 'A', nivel: 'iniciante' }], seed: 1, teste: { casa: 'decisao' } });
  assert.match(viewJogo(e), /Partida de teste/);
  assert.doesNotMatch(viewJogo({ ...e, teste: null }), /Partida de teste/);
});

test('o menu sugere material de apoio e deixa escolher só questões conceituais', () => {
  const menu = viewMenu();
  assert.match(menu, /Material de apoio/);
  assert.match(menu, /planilha/);
  assert.match(menu, /value="conceitual"/);
});

test('cenários de tabela de séries escondem as colunas que explicam a resposta até o resultado', () => {
  const ids = ['cenario_22_simpson_rh', 'cenario_24_taxa_base_fraude', 'cenario_25_correlacao_espuria'];
  for (const id of ids) {
    const def = obterCenario(id);
    let e = novoJogo({ jogadores: [{ nome: 'A', nivel: 'iniciante' }], seed: 3, teste: { casa: 'decisao', cenarios: [id] } });
    const nomesOcultos = () => {
      const { series } = e.cenarioAtual;
      return def.dados.ocultas_ate_resultado.map((i) => esc(series[i].nome));
    };
    let antes = null;
    for (let i = 0; i < 20 && e.fase !== 'MOSTRAR_RESULTADO'; i++) {
      if (e.fase === 'ESCOLHER_METRICA') antes = viewJogo(e);
      e = reduzir(e, {
        ROLAR_DADO: { tipo: 'ROLAR' },
        ESCOLHER_CONFIANCA: { tipo: 'CONFIANCA', valor: 'certeza' },
        ESCOLHER_METRICA: { tipo: 'METRICA', valor: def.opcoes.find((o) => o.correta).id },
        ESCOLHER_JUSTIFICATIVA: { tipo: 'JUSTIFICATIVA', valor: def.justificativas[0].id },
      }[e.fase] ?? { tipo: 'CONTINUAR' });
    }
    assert.equal(e.fase, 'MOSTRAR_RESULTADO', id);
    const depois = viewJogo(e);
    for (const nome of nomesOcultos()) {
      assert.ok(!antes.includes(`>${nome}</th>`), `${id}: "${nome}" apareceu antes da resposta`);
      assert.ok(depois.includes(`>${nome}</th>`), `${id}: "${nome}" não apareceu no resultado`);
    }
    assert.match(antes, /<table class="tabela-dados"/);
    assert.ok(!antes.includes('undefined') && !depois.includes('undefined') && !antes.includes('{{'), id);
  }
});

test('o menu oferece rounds (1 a 64) e caixa inicial como campos numéricos', () => {
  const html = viewMenu();
  assert.match(html, /<input type="number" name="turnos" min="1" max="64"/);
  assert.match(html, /<input type="number" name="dinheiro" min="10000" max="1000000"/);
});

test('o placar mostra a sequência de erros ou de sucessos em andamento (fisher.md 3.13)', () => {
  const e = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'iniciante' }], seed: 1 });
  assert.ok(!viewJogo(e).includes('seguido'));
  e.jogadores[0].sequencia = { erros: 2, acertos: 0 };
  e.jogadores[1].sequencia = { erros: 0, acertos: 3 };
  const html = viewJogo(e);
  assert.match(html, /2 erros seguidos \(ganhos ×0,81, perdas ×1,23\)/);
  assert.match(html, /3 sucessos seguidos \(ganhos ×1,33, perdas ×0,75\)/);
});

// ---------- Mercado (investimentos, fisher.md 3.14) ----------

const naOferta = (extra = {}) => reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'iniciante' }], seed: 7, teste: { casa: 'mercado' }, ...extra }), { tipo: 'ROLAR' });
const sinalOk = (html, fase) => assert.ok(!html.includes('undefined') && !html.includes('{{') && !html.includes('NaN'), `tela quebrada: ${fase}`);

test('a oferta do Mercado mostra a ficha da empresa, mas esconde a chance de sucesso até a consultoria', () => {
  const e = naOferta();
  const html = viewJogo(e);
  sinalOk(html, 'oferta');
  const def = obterEmpresa(e.mercadoAtual.empresaId);
  assert.match(html, /Mercado: oportunidade de investimento/);
  assert.ok(html.includes(esc(def.nome)) && html.includes(esc(def.fundador)));
  assert.match(html, /Lucro \(prejuízo\) por trimestre/);
  assert.match(html, /Se der certo: <strong>\+/);
  assert.ok(!/chance de sucesso/i.test(html), 'a chance de sucesso não aparece antes da consultoria');
  assert.match(html, /data-acao="ABRIR_CONSULTORIA"/);
  assert.match(html, /data-acao="RECUSAR"/);
  for (const a of APORTES) assert.match(html, new RegExp(`data-acao="INVESTIR" data-valor="${a}"`));
  assert.match(html, /data-acao="DIAGNOSTICAR" data-valor="nenhuma"/);
  assert.ok(!html.includes('class="resultado"'), 'o veredito só vem depois da decisão');
});

test('a consultoria revela a chance exata e o retorno já descontado', () => {
  const o = naOferta();
  const e = reduzir(o, { tipo: 'ABRIR_CONSULTORIA' });
  const html = viewJogo(e);
  sinalOk(html, 'consultoria');
  assert.match(html, /chance de sucesso de <strong>/);
  assert.ok(html.includes(`${(e.mercadoAtual.prob * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`));
  assert.match(html, /já descontada a consultoria/);
  assert.ok(!html.includes('data-acao="ABRIR_CONSULTORIA"'), 'o botão some depois de aberto');
});

test('aportes maiores que o caixa ficam desabilitados', () => {
  const e = naOferta();
  e.jogadores[0].dinheiro = 20000;
  const html = viewJogo(e);
  assert.match(html, /data-valor="10000">/);
  assert.match(html, /data-valor="25000" disabled/);
  assert.match(html, /data-valor="50000" disabled/);
});

test('depois da decisão a tela mostra o aporte, o veredito do diagnóstico e a explicação do argumento', () => {
  const o = naOferta();
  const def = obterEmpresa(o.mercadoAtual.empresaId);
  const certo = def.falha ?? 'nenhuma';
  let e = reduzir(reduzir(o, { tipo: 'DIAGNOSTICAR', valor: certo }), { tipo: 'INVESTIR', valor: 10000 });
  let html = viewJogo(e);
  sinalOk(html, 'decisão');
  assert.match(html, /Você investiu R\$ 10\.000 na /);
  assert.match(html, /✔ Acertou \(reputação \+3\)/);
  assert.ok(html.includes(esc(def.explicacao)));
  assert.match(html, /data-acao="CONTINUAR"/);
  assert.ok(!html.includes('data-acao="INVESTIR"'));
  const errado = Object.keys(FALACIAS).find((id) => id !== certo);
  e = reduzir(reduzir(o, { tipo: 'DIAGNOSTICAR', valor: errado }), { tipo: 'RECUSAR' });
  html = viewJogo(e);
  assert.match(html, /Você não investiu/);
  assert.match(html, /✖ Errou \(reputação −2\)/);
  const semDiagnostico = viewJogo(reduzir(o, { tipo: 'RECUSAR' }));
  assert.ok(!semDiagnostico.includes('Seu diagnóstico:'));
  assert.ok(semDiagnostico.includes(esc(def.explicacao)), 'a explicação aparece mesmo sem diagnóstico');
});

test('com o diagnóstico registrado, a tela o confirma e não oferece trocar', () => {
  const html = viewJogo(reduzir(naOferta(), { tipo: 'DIAGNOSTICAR', valor: 'taxa_base' }));
  assert.match(html, /Seu diagnóstico: <strong>Ignora quão raro é o evento/);
  assert.ok(!html.includes('data-acao="DIAGNOSTICAR"'));
});

test('o rival do solo vê o Mercado sem oferta', () => {
  const solo = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Rival', nivel: 'iniciante', bot: 'medio' }], seed: 3, teste: { casa: 'mercado' } });
  solo.jogadorAtual = 1;
  const html = viewJogo(reduzir(solo, { tipo: 'ROLAR' }));
  sinalOk(html, 'rival');
  assert.match(html, /O rival passou pelo Mercado e não fez nenhum aporte/);
  assert.ok(!html.includes('data-acao="INVESTIR"'));
});

test('o placar mostra o dinheiro investido, e o painel da empresa soma tudo no cooperativo', () => {
  const e = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'iniciante' }], seed: 1 });
  assert.ok(!viewJogo(e).includes('investidos'));
  e.jogadores[0].investimentos = [{ valor: 25000 }, { valor: 10000 }];
  assert.match(viewJogo(e), /R\$ 35\.000 investidos/);
  const coop = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'iniciante' }], seed: 1, modo: 'cooperativo' });
  coop.jogadores[0].investimentos = [{ valor: 25000 }];
  coop.jogadores[1].investimentos = [{ valor: 10000 }];
  assert.match(viewJogo(coop), /Meta do próximo Balanço: R\$ [\d.]+ · R\$ 35\.000 investidos/);
});

const aporteInv = (extra) => ({ empresaId: 'fio_forte', nome: 'Indústria Têxtil Fio Forte', porte: 'consolidada', valor: 10000, prob: 1, ganho: 0.3, perda: 0.15, consultoria: false, turnoAporte: 1, ...extra });

test('o Balanço lista o retorno dos investimentos, na tela do Balanço e no aviso das demais casas', () => {
  const base = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'iniciante' }], seed: 21, teste: { casa: 'balanco' } });
  base.jogadores[0].investimentos = [aporteInv(), aporteInv({ prob: 0, nome: 'Perdedora', empresaId: 'fio_forte', consultoria: true })];
  const noBalanco = reduzir(base, { tipo: 'ROLAR' });
  const html = viewJogo(noBalanco);
  sinalOk(html, 'balanço');
  assert.match(html, /Retorno dos investimentos/);
  assert.match(html, /▲ deu certo, \+R\$ 3\.000/);
  assert.match(html, /▼ deu errado, −R\$ 1\.500/);
  assert.match(html, /com consultoria/);

  // Passando pelo Balanço e caindo em outra casa, o aviso do Balanço traz o mesmo retorno.
  const passando = reduzir({ ...structuredClone(base), teste: { casa: 'evento' }, jogadores: base.jogadores.map((j, i) => ({ ...j, posicao: i === 0 ? 27 : 0 })) }, { tipo: 'ROLAR' });
  assert.match(viewJogo(passando), /pelo Balanço:[\s\S]*Retorno dos investimentos/);
});

test('o Balanço de um save antigo, sem a lista de investimentos, continua renderizando', () => {
  const e = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], seed: 1, teste: { casa: 'balanco' } });
  const noBalanco = reduzir(e, { tipo: 'ROLAR' });
  delete noBalanco.balanco.investimentos;
  const html = viewJogo(noBalanco);
  sinalOk(html, 'balanço antigo');
  assert.ok(!html.includes('Retorno dos investimentos'));
});

test('o fim de jogo mostra a apuração dos aportes que sobraram, com o nome escapado', () => {
  const nome = '<b>Ana</b>';
  const e = novoJogo({ jogadores: [{ nome, nivel: 'iniciante' }, { nome: 'Bia', nivel: 'iniciante' }], seed: 4, turnos: 1, teste: { casa: 'evento' } });
  e.jogadores[0].investimentos = [aporteInv()];
  let f = e;
  for (let i = 0; i < 200 && f.fase !== 'FIM_DE_JOGO'; i++) f = reduzir(f, f.fase === 'ROLAR_DADO' ? { tipo: 'ROLAR' } : { tipo: 'CONTINUAR' });
  const html = viewJogo(f);
  sinalOk(html, 'fim');
  assert.match(html, /Apuração final dos investimentos/);
  assert.ok(!html.includes(nome) && html.includes(esc(nome)));
  assert.match(html, /▲ deu certo/);
  const coop = viewJogo(Object.assign(structuredClone(f), { modo: 'cooperativo', empresa: { dinheiro: 100000, reputacao: 50 } }));
  assert.match(coop, /Apuração final dos investimentos/);
  assert.ok(!viewJogo({ ...f, apuracaoFinal: null }).includes('Apuração final'));
});

test('o menu oferece "Sempre Mercado" nos atalhos de teste', () => {
  assert.match(viewMenu(), /<option value="mercado">Sempre Mercado<\/option>/);
});

test('uma partida inteira passando pelo Mercado renderiza todas as telas sem quebrar', () => {
  let e = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'avancado' }], seed: 17, turnos: 8, teste: { casa: 'mercado' } });
  let ofertas = 0;
  for (let i = 0; i < 600 && e.fase !== 'FIM_DE_JOGO'; i++) {
    sinalOk(viewJogo(e), e.fase);
    let acao = { tipo: 'CONTINUAR' };
    if (e.fase === 'ROLAR_DADO') acao = { tipo: 'ROLAR' };
    else if (e.fase === 'MOSTRAR_MERCADO' && !e.mercadoAtual.decisao) {
      ofertas++;
      acao = ofertas % 3 === 0 ? { tipo: 'RECUSAR' } : { tipo: 'INVESTIR', valor: APORTES[ofertas % 3] };
      if (ofertas % 2) e = reduzir(e, { tipo: 'ABRIR_CONSULTORIA' });
      e = reduzir(e, { tipo: 'DIAGNOSTICAR', valor: Object.keys(FALACIAS)[ofertas % 5] });
    }
    e = reduzir(e, acao);
  }
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.ok(ofertas >= 8);
  sinalOk(viewJogo(e), 'fim');
});
