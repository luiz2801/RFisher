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
import { EVENTOS } from '../src/scenarios/content/eventos.js';
import { brlSinal } from '../src/stats/format.js';
import { DIRETORIAS } from '../src/engine/papeis.js';

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

test('o menu informa a calculadora e não deixa excluir os cenários de cálculo', () => {
  const menu = viewMenu();
  assert.match(menu, /Material de apoio/);
  assert.match(menu, /calculadora de estatísticas/);
  assert.doesNotMatch(menu, /planilha|Excel|lápis|papel/i, 'a calculadora dispensa material externo');
  assert.doesNotMatch(menu, /name="apoio"|value="conceitual"/);
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
  assert.match(html, /<input type="number" name="reputacao" min="10" max="100" step="5" value="50"/);
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

test('sem consultoria a ficha mostra os lucros, mas não os retornos nem a chance', () => {
  const e = naOferta();
  const html = viewJogo(e);
  sinalOk(html, 'oferta');
  const def = obterEmpresa(e.mercadoAtual.empresaId);
  assert.match(html, /Mercado: oportunidade de investimento/);
  assert.ok(html.includes(esc(def.nome)) && html.includes(esc(def.fundador)));
  assert.match(html, /Lucro \(prejuízo\) por trimestre/);
  assert.doesNotMatch(html, /chance de sucesso de|Se der certo|Se der errado|<h3>Relatório da consultoria/i);
  assert.match(html, /só aparecem no relatório da consultoria/);
  assert.match(html, /data-acao="ABRIR_CONSULTORIA"/);
  assert.match(html, /50% do retorno quando der certo e R\$ 15\.000 quando der errado/);
  assert.match(html, /data-acao="RECUSAR"/);
  for (const a of APORTES) assert.match(html, new RegExp(`data-acao="INVESTIR" data-valor="${a}"`));
  assert.match(html, /data-acao="DIAGNOSTICAR" data-valor="nenhuma"/);
  assert.ok(!html.includes('class="resultado"'), 'o veredito só vem depois da decisão');
});

test('o relatório da consultoria libera chance e retornos já com o custo da consultoria', () => {
  const e = reduzir(naOferta(), { tipo: 'ABRIR_CONSULTORIA' });
  const html = viewJogo(e);
  sinalOk(html, 'consultoria');
  assert.match(html, /Relatório da consultoria/);
  assert.ok(html.includes(`${(e.mercadoAtual.prob * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`));
  assert.match(html, /mais R\$ 15\.000 de honorários/);
  assert.match(html, /Se der certo: \+R\$ [\d.]+ · Se der errado: −R\$ [\d.]+/);
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

// ---------- casa de Evento: oferta, cartas viradas e carta revelada (fisher.md 3.15) ----------

test('evento: a oferta convida a participar ou passar e não revela nenhuma carta', () => {
  const e = reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], seed: 5, teste: { casa: 'evento' } }), { tipo: 'ROLAR' });
  const html = viewJogo(e);
  assert.match(html, /data-acao="PARTICIPAR"/);
  assert.match(html, /data-acao="RECUSAR"/);
  assert.doesNotMatch(html, /data-acao="CONTINUAR"/);
  for (const id of e.eventoAtual.cartas) assert.ok(!html.includes(EVENTOS.find((c) => c.id === id).titulo), 'a oferta não vaza as cartas');
});

test('evento: as três cartas viradas são botões sem nada que as distinga', () => {
  let e = reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], seed: 5, teste: { casa: 'evento' } }), { tipo: 'ROLAR' });
  e = reduzir(e, { tipo: 'PARTICIPAR' });
  const html = viewJogo(e);
  assert.equal((html.match(/data-acao="ESCOLHER_CARTA"/g) ?? []).length, 3);
  for (const i of [0, 1, 2]) assert.match(html, new RegExp(`data-acao="ESCOLHER_CARTA" data-valor="${i}"`));
  for (const id of e.eventoAtual.cartas) {
    const c = EVENTOS.find((x) => x.id === id);
    assert.ok(!html.includes(c.titulo) && !html.includes(c.texto), 'as cartas viradas não vazam o conteúdo');
  }
});

test('evento: a carta escolhida aparece com o efeito e as outras duas são reveladas', () => {
  for (const modo of ['competitivo', 'cooperativo']) {
    for (const i of [0, 1, 2]) {
      let e = reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], modo, seed: 7, teste: { casa: 'evento' } }), { tipo: 'ROLAR' });
      e = reduzir(reduzir(reduzir(e, { tipo: 'PARTICIPAR' }), { tipo: 'ESCOLHER_CARTA', valor: i }), { tipo: 'MANTER' });
      const html = viewJogo(e);
      assert.ok(!html.includes('undefined') && !html.includes('NaN'), 'sem valores soltos');
      const [escolhida, ...outras] = [e.eventoAtual.cartas[i], ...e.eventoAtual.cartas.filter((_, j) => j !== i)].map((id) => EVENTOS.find((c) => c.id === id));
      assert.ok(html.includes(esc(escolhida.texto)), 'texto da carta escolhida');
      assert.ok(html.includes(brlSinal(e.eventoAtual.dinheiro)) || e.eventoAtual.dinheiro === 0, 'dinheiro da carta');
      for (const o of outras) assert.ok(html.includes(esc(o.titulo)), `carta restante revelada: ${o.id}`);
      assert.match(html, /As outras cartas eram/);
      assert.match(html, /data-acao="CONTINUAR"/);
      if (escolhida.licao) assert.match(html, /Lição:/);
      else assert.doesNotMatch(html, /Lição:/);
    }
  }
});

test('evento: todas as cartas do jogo renderizam reveladas, nos dois modos', () => {
  for (const modo of ['competitivo', 'cooperativo']) {
    for (const carta of EVENTOS) {
      let e = reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], modo, seed: 3, teste: { casa: 'evento' } }), { tipo: 'ROLAR' });
      const outras = ['boa', 'ruim', 'troll'].filter((t) => t !== carta.tipo).map((t) => EVENTOS.find((c) => c.tipo === t).id);
      e.eventoAtual.cartas = [carta.id, ...outras];
      e = reduzir(reduzir(reduzir(e, { tipo: 'PARTICIPAR' }), { tipo: 'ESCOLHER_CARTA', valor: 0 }), { tipo: 'MANTER' });
      const html = viewJogo(e);
      assert.ok(html.includes(esc(carta.titulo)) && !html.includes('undefined') && !html.includes('NaN'), carta.id);
      assert.match(html, carta.tipo === 'boa' ? /class="evento bom"/ : carta.tipo === 'ruim' ? /class="evento ruim"/ : /class="evento troll"/);
      if (modo === 'cooperativo' && carta.dinheiro < 0) assert.match(html, /amortecido pela diretoria/);
    }
  }
});

test('evento: uma partida em que a pessoa participa de todo evento renderiza todas as telas até o fim', () => {
  let e = novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }, { nome: 'Bia', nivel: 'avancado' }], seed: 31, turnos: 8, teste: { casa: 'evento' } });
  const fases = new Set();
  for (let i = 0; i < 600 && e.fase !== 'FIM_DE_JOGO'; i++) {
    const html = viewJogo(e);
    assert.ok(!html.includes('undefined') && !html.includes('{{'), `tela quebrada: ${e.fase}`);
    if (e.fase === 'MOSTRAR_EVENTO') fases.add(e.eventoAtual.decisao);
    const acao = { ROLAR_DADO: { tipo: 'ROLAR' } }[e.fase]
      ?? (e.fase === 'MOSTRAR_EVENTO' && e.eventoAtual.decisao === null ? { tipo: 'PARTICIPAR' } : null)
      ?? (e.fase === 'MOSTRAR_EVENTO' && e.eventoAtual.decisao === 'escolhendo' ? { tipo: 'ESCOLHER_CARTA', valor: i % 3 } : null)
      ?? (e.fase === 'MOSTRAR_EVENTO' && e.eventoAtual.decisao === 'trocando' ? { tipo: i % 2 ? 'TROCAR' : 'MANTER' } : { tipo: 'CONTINUAR' });
    e = reduzir(e, acao);
  }
  assert.equal(e.fase, 'FIM_DE_JOGO');
  assert.deepEqual([...fases].sort(), ['escolhendo', 'participou', 'trocando', null].sort());
});

test('Monty Hall: a tela mostra a carta revelada, esconde as outras duas e oferece manter ou trocar', () => {
  let e = reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], seed: 5, teste: { casa: 'evento' } }), { tipo: 'ROLAR' });
  e = reduzir(reduzir(e, { tipo: 'PARTICIPAR' }), { tipo: 'ESCOLHER_CARTA', valor: 1 });
  const { cartas, primeira, revelada } = e.eventoAtual;
  const html = viewJogo(e);
  assert.match(html, /Manter ou trocar\?/);
  assert.equal((html.match(/data-acao="MANTER"/g) ?? []).length, 1);
  assert.equal((html.match(/data-acao="TROCAR"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /data-acao="CONTINUAR"/);
  const aberta = EVENTOS.find((c) => c.id === cartas[revelada]);
  assert.ok(html.includes(esc(aberta.titulo)), 'a revelada aparece');
  assert.notEqual(aberta.tipo, 'boa');
  for (const i of [0, 1, 2].filter((j) => j !== revelada)) {
    assert.ok(!html.includes(esc(EVENTOS.find((c) => c.id === cartas[i]).titulo)), 'as demais seguem viradas');
  }
  assert.match(html, new RegExp(`Manter a carta ${primeira + 1} \\(a sua\\)`));
});

test('Monty Hall: depois de decidir, a tela diz se trocou e traz a lição', () => {
  const base = reduzir(reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'iniciante' }], seed: 5, teste: { casa: 'evento' } }), { tipo: 'ROLAR' }), { tipo: 'PARTICIPAR' });
  const trocando = reduzir(base, { tipo: 'ESCOLHER_CARTA', valor: 0 });
  const trocou = viewJogo(reduzir(trocando, { tipo: 'TROCAR' }));
  const manteve = viewJogo(reduzir(trocando, { tipo: 'MANTER' }));
  assert.match(trocou, /Você trocou de carta/);
  assert.match(manteve, /Você manteve a sua carta/);
  for (const html of [trocou, manteve]) {
    assert.match(html, /problema de Monty Hall/);
    assert.match(html, /As outras cartas eram/);
    assert.ok(!html.includes('undefined') && !html.includes('NaN'));
  }
});

test('menu: tela inicial é a introdução e a configuração fica num assistente por etapas', () => {
  const html = viewMenu();
  assert.match(html, /data-acao="ABRIR_CONFIG"/);
  assert.match(html, /data-nav="anterior"/);
  assert.match(html, /data-nav="proximo"/);
  assert.equal((html.match(/data-etapa/g) ?? []).length, 13);
});

test('o menu apresenta a habilidade ativa e a passiva de cada diretoria', () => {
  const html = viewMenu();
  for (const d of Object.values(DIRETORIAS)) {
    assert.ok(html.includes(esc(d.habilidade.nome)), `ativa de ${d.nome}`);
    assert.ok(html.includes(esc(d.passivo.nome)), `passiva de ${d.nome}`);
  }
});

test('a decisão oferece a habilidade da diretoria, mostra o efeito e esconde a métrica removida', () => {
  const novo = (diretoria) => reduzir(novoJogo({ jogadores: [{ nome: 'Ana', nivel: 'avancado', diretoria }, { nome: 'Bia', nivel: 'avancado' }], seed: 11, teste: { casa: 'decisao', cenarios: ['cenario_01_salarios'] } }), { tipo: 'ROLAR' });
  const antes = viewJogo(novo('tecnologia'));
  assert.match(antes, /data-acao="USAR_HABILIDADE" data-valor="tecnologia"/);
  assert.doesNotMatch(antes, /data-valor="operacoes"/, 'só a habilidade da própria diretoria');
  assert.match(viewJogo(reduzir(novo('tecnologia'), { tipo: 'USAR_HABILIDADE', valor: 'tecnologia' })), /Dashboard: resumo dos dados/);
  assert.match(viewJogo(reduzir(novo('pessoas_financas'), { tipo: 'USAR_HABILIDADE', valor: 'pessoas_financas' })), /Dica \(Treinamento\)/);
  const plano = reduzir(novo('operacoes'), { tipo: 'USAR_HABILIDADE', valor: 'operacoes' });
  const opcoes = (h) => [...h.matchAll(/data-acao="METRICA"/g)].length;
  assert.equal(opcoes(viewJogo(plano)), opcoes(viewJogo(novo('operacoes'))) - 1);
});
