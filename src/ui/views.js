// Visões puras: estado -> string HTML. Os eventos são ligados em main.js por delegação (data-acao).
import { esc } from './html.js';
import { grafico, calcularDominio } from './components/grafico.js';
import { parDadosHtml } from './components/dado.js';
import { CASAS, NUM_CASAS, ROTULO_CASA, coordenadas } from '../engine/board.js';
import { jogadorAtual, classificacao, vencedores, ehCooperativo, ehBot, classificarEmpresa } from '../engine/state.js';
import { DIRETORIAS } from '../engine/papeis.js';
import { metaTrimestral } from '../engine/machine.js';
import { relatorioDesempenho } from '../engine/desempenho.js';
import { CONFIANCA, ROTULO_CONFIANCA, NIVEL, confiancaEfetiva } from '../engine/scoring.js';
import { MAX_JOGADORES, TURNOS_PADRAO, PERFIS_BOT } from '../engine/config.js';
import { obterCenario, todosCenarios, preencher, valorDoMarcador } from '../scenarios/loader.js';
import { EVENTOS } from '../scenarios/content/eventos.js';
import { brl, brlSinal, formatar, unidade } from '../stats/format.js';
import { contagens } from '../stats/metrics.js';
import { ehCalculo, margemPct, notaDeMetodo } from '../engine/calculo.js';

const NOME_NIVEL = { iniciante: 'Iniciante', avancado: 'Avançado' };
const ROTULO_BOT = { facil: 'fácil', medio: 'médio', dificil: 'difícil' };
export const DIVISOES = [
  {
    cargo: 'CEO de Produtos & Tecnologia',
    nome: 'Divisão de Produtos & Tecnologia',
    foco: 'Testes A/B, engajamento digital e algoritmos',
    icone: '💻',
  },
  {
    cargo: 'CEO de Operações & Logística',
    nome: 'Divisão de Operações & Logística',
    foco: 'SLA de entregas, giro de estoque e linhas fabris',
    icone: '📦',
  },
  {
    cargo: 'CEO de Estratégia & Mercado',
    nome: 'Divisão de Estratégia & Mercado',
    foco: 'Equidade salarial, suporte ao cliente e valor de marca',
    icone: '📈',
  },
];
const TITULO_RESULTADO = {
  sucesso: '✔ Sucesso absoluto',
  sorte: '△ Acertou a métrica, mas não soube justificar',
  incoerencia: '△ Incoerência: conceito certo, métrica errada',
  erro_total: '✖ Erro total',
};
// Em cenário de cálculo, métrica certa com valor fora da margem não vale como acerto da métrica.
function tituloResultado(r) {
  if (r.valorCorreto !== false || r.metricaCorreta === false) return TITULO_RESULTADO[r.categoria];
  return r.justificativaCorreta
    ? '△ Métrica e justificativa certas, mas o valor calculado ficou fora da margem'
    : '✖ Métrica certa, mas o valor calculado e a justificativa estão errados';
}
const MSG_JUSTIFICATIVA = {
  parcial: 'É verdadeira, mas incompleta: não explica por que a métrica escolhida é a melhor.',
  irrelevante: 'Pode até ser verdade, mas não sustenta a decisão.',
};

// ---------- menu ----------

export function viewMenu({ salvo } = {}) {
  const linhas = Array.from({ length: MAX_JOGADORES }, (_, i) => {
    const div = DIVISOES[i % DIVISOES.length];
    return `<fieldset data-jogador="${i}" ${i >= 2 ? 'hidden' : ''} class="card-jogador-config">
      <legend class="legend-jogador">Jogador ${i + 1} · ${esc(div.cargo)}</legend>
      <div class="divisao-info">
        <span class="divisao-icone" aria-hidden="true">${div.icone}</span>
        <div>
          <div class="divisao-nome">${esc(div.nome)}</div>
          <div class="divisao-foco">${esc(div.foco)}</div>
        </div>
      </div>
      <label>Nome do(a) CEO <input name="nome_${i}" value="Jogador ${i + 1}" maxlength="20" required></label>
      <label>Perfil Executivo
        <select name="nivel_${i}">
          <option value="iniciante">Iniciante (com consultoria pedagógica e dicas)</option>
          <option value="avancado">Avançado (alto risco: casas valem ×1,5, sem dicas)</option>
        </select>
      </label>
    </fieldset>`;
  }).join('');

  const passos = [
    ['📊', 'Métrica certa', 'Interprete gráficos e distribuições com rigor — desconfie de outliers em médias e de caudas longas de atraso.'],
    ['🧾', 'Justificativa técnica', 'Acerto sem fundamentação é sorte. Convença os acionistas com o porquê estatístico da sua decisão.'],
    ['🎯', 'Aposta de confiança', 'Certeza absoluta alavanca ganhos, mas cobra caro em erros. Avalie o risco com responsabilidade.'],
  ];
  const cartoesDivisoes = DIVISOES.map(
    (d) => `<li><span class="divisao-icone" aria-hidden="true">${d.icone}</span>
      <div><div class="divisao-nome">${esc(d.nome)}</div><div class="divisao-foco">${esc(d.foco)}</div></div></li>`,
  ).join('');

  return `<main class="menu">
    <section class="hero">
      <span class="tag-contexto">Fisher S.A. · Simulação Executiva</span>
      <h1>Tabuleiro do CEO</h1>
      <p class="sub">Decisões corporativas orientadas a dados contra a armadilha dos "achismos".</p>
      <a class="rolar-dica" href="#historia">Role para conhecer a história <span aria-hidden="true">↓</span></a>
    </section>

    <section class="secao-scroll" id="historia">
      <header class="historia-topo">
        <span class="icone-alerta" aria-hidden="true">🏛️</span>
        <div>
          <span class="subtitulo-memorando">Memorando confidencial do Conselho</span>
          <h2>A crise dos "achismos" na Fisher S.A.</h2>
        </div>
      </header>
      <div class="prologo-texto">
        <p>A centenária <strong>Fisher S.A.</strong> esteve à beira do colapso financeiro. Durante anos, a antiga diretoria tomou decisões estratégicas com base em <em>"puro feeling"</em>, apresentações com gráficos de eixos distorcidos e médias salariais maquiadas que mascaravam graves insatisfações internas. Linhas de produção pararam por desvios de precisão ignorados, e investimentos milionários evaporaram sem nenhuma validação estatística.</p>
        <p>Farto de ver fortunas queimadas em palpites vazios, o Conselho de Acionistas dissolveu a cúpula anterior e convocou os profissionais mais promissores do mercado: <strong>vocês</strong>.</p>
      </div>
    </section>

    <section class="secao-scroll">
      <h2>A disputa pelo controle acionário</h2>
      <p>Cada jogador comanda uma divisão estratégica, com aporte inicial de <strong>R$ 50.000 em caixa</strong> e <strong>50 pontos de reputação</strong> perante o mercado.</p>
      <div class="indicadores">
        <div><strong>R$ 50 mil</strong><span>caixa inicial</span></div>
        <div><strong>50</strong><span>reputação</span></div>
        <div><strong>1–3</strong><span>CEOs</span></div>
      </div>
      <ul class="lista-divisoes">${cartoesDivisoes}</ul>
    </section>

    <section class="secao-scroll">
      <h2>Como prosperar perante o Conselho</h2>
      <p>A cada trimestre fiscal (as casas do tabuleiro), uma decisão bate à sua porta:</p>
      <ol class="passos">${passos
        .map(([ic, t, d], i) => `<li><span class="passo-num" aria-hidden="true">${ic}</span><div><strong>${i + 1}. ${t}</strong><p>${d}</p></div></li>`)
        .join('')}</ol>
    </section>

    <section class="secao-scroll fim-scroll">
      <blockquote class="frase-efeito">
        <em>"Nesta empresa, opinião sem dados é apenas boato, mas dados mal interpretados custam o seu cargo. No encerramento do exercício, o CEO com maior patrimônio e reputação assumirá a Presidência Definitiva do Conselho!"</em>
      </blockquote>
      ${
        salvo
          ? `<div class="cartao"><p>Há uma partida salva: ${salvo.jogadores.length} jogador(es), turno ${Math.min(salvo.turnoAtual, salvo.turnosPorJogador)} de ${salvo.turnosPorJogador}.</p>
             <button class="primario" data-acao="CONTINUAR_SALVA">Continuar partida salva</button></div>`
          : ''
      }
      <button class="primario cta-grande" id="btn-comecar" data-acao="ABRIR_CONFIG" aria-controls="form-menu" aria-expanded="false">Assumir a presidência →</button>
    </section>

    <form id="form-menu" class="cartao" hidden>
      <h2>Nova partida</h2>
      <label>Modo de jogo
        <select name="modo">
          <option value="competitivo">Competitivo (cada CEO com o seu caixa)</option>
          <option value="cooperativo">Cooperativo (diretoria de uma só empresa, caixa compartilhado)</option>
          <option value="solo">Solo (você contra um rival controlado pelo computador)</option>
        </select>
      </label>
      <label data-campo="n">Quantidade de CEOs concorrentes
        <select name="n">${[1, 2, 3].map((n) => `<option value="${n}" ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <label data-campo="bot" hidden>Rival
        <select name="bot">${Object.entries(PERFIS_BOT)
          .map(([id, p]) => `<option value="${id}" ${id === 'medio' ? 'selected' : ''}>${esc(p.nome)} (${ROTULO_BOT[id]})</option>`)
          .join('')}</select>
      </label>
      ${linhas}
      <label>Trimestres fiscais (turnos por jogador)
        <select name="turnos">${[2, 6, 8, 10, 12].map((n) => `<option value="${n}" ${n === TURNOS_PADRAO ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <label>Semente de mercado (opcional, para repetir uma partida)
        <input name="seed" inputmode="numeric" pattern="[0-9]*" placeholder="aleatória">
      </label>
      <details class="atalhos-teste">
        <summary>Atalhos de teste</summary>
        <label>Casa em que o peão cai
          <select name="teste_casa">
            <option value="">Normal (pelo tabuleiro)</option>
            <option value="decisao">Sempre Decisão</option>
            <option value="evento">Sempre Evento</option>
            <option value="balanco">Sempre Balanço</option>
          </select>
        </label>
        <label>Cenários sorteados
          <select name="teste_cenarios">
            <option value="">Todos</option>
            <option value="calculo">Só os de cálculo</option>
            <option value="comuns">Só os sem cálculo</option>
            <optgroup label="Um cenário só">${todosCenarios()
              .map((c) => `<option value="${esc(c.id)}">${esc(c.titulo)}${ehCalculo(c) ? ' (cálculo)' : ''}</option>`)
              .join('')}</optgroup>
          </select>
        </label>
      </details>
      <button class="primario" type="submit">Iniciar Disputa Corporativa</button>
    </form>
  </main>`;
}

// ---------- jogo ----------

const nomesPapeis = (j) => j.papeis.map((id) => DIRETORIAS[id].nome).join(' + ');
// Cargo exibido: a(s) diretoria(s) no cooperativo, a divisão no competitivo, o perfil no rival do solo.
const cargoDe = (e, j) => {
  if (ehBot(j)) return `🤖 computador, ${ROTULO_BOT[j.bot]}`;
  return ehCooperativo(e) ? nomesPapeis(j) : DIVISOES[j.id % DIVISOES.length].cargo;
};
// Textos da decisão em segunda pessoa para quem joga, em terceira para o rival do computador.
const autor = (e) =>
  ehBot(jogadorAtual(e))
    ? { metrica: 'Métrica do rival', justificativa: 'Justificativa do rival', valor: 'Cálculo do rival', passou: 'O rival passou' }
    : { metrica: 'Sua métrica', justificativa: 'Sua justificativa', valor: 'Seu cálculo', passou: 'Você passou' };

export function viewJogo(e) {
  const turno = Math.min(e.turnoAtual, e.turnosPorJogador);
  return `<header class="topo">
      <strong>Tabuleiro do CEO · Fisher S.A.</strong>
      <span>Trimestre ${turno} de ${e.turnosPorJogador}</span>
      ${e.teste ? '<span class="selo-teste" title="Casa ou cenários forçados pelos atalhos de teste">Partida de teste</span>' : ''}
      <button data-acao="NOVA" class="discreto">Nova partida</button>
    </header>
    <div class="jogo">
      <div class="lateral">
        ${tabuleiro(e)}
        ${placar(e)}
        <details class="contexto-rapido">
          <summary>🏛️ Contexto da Fisher S.A.</summary>
          <div class="cartao-contexto-interno">
            <p><strong>A Missão:</strong> A antiga diretoria quase faliu a Fisher S.A. tomando decisões por mero "achismo". Vocês assumiram divisões estratégicas com R$ 50.000 em caixa e 50 de reputação para provar quem lidera com dados reais.</p>
            ${
              ehCooperativo(e)
                ? '<p><strong>Objetivo:</strong> A diretoria responde por uma só empresa, com caixa e reputação compartilhados. Cumpram a meta de caixa em cada Balanço e levem a Fisher S.A. à melhor faixa ao fim dos trimestres.</p>'
                : '<p><strong>Critério de Vitória:</strong> Quem acumular mais capital (e maior reputação em caso de empate) ao fim dos trimestres fiscais será eleito Presidente do Conselho!</p>'
            }
          </div>
        </details>
      </div>
      <section class="painel" id="painel" tabindex="-1" aria-live="polite">${painel(e)}</section>
    </div>`;
}

function tabuleiro(e) {
  const casas = CASAS.map((tipo, i) => {
    const { linha, coluna } = coordenadas(i);
    const peoes = e.jogadores
      .filter((j) => j.posicao === i)
      .map((j) => `<span class="peao p${j.id}" title="${esc(j.nome)}">${esc(j.nome.trim().charAt(0).toUpperCase() || '?')}</span>`)
      .join('');
    return `<div class="casa ${tipo}" style="grid-row:${linha};grid-column:${coluna}">
      <span class="num">${i + 1}</span><span class="tipo">${ROTULO_CASA[tipo]}</span><span class="peoes">${peoes}</span>
    </div>`;
  }).join('');
  const vez = e.fase === 'FIM_DE_JOGO' ? 'Fim de jogo' : `Vez de ${esc(jogadorAtual(e).nome)}`;
  const dados = e.dados ? parDadosHtml(e.dados[0], e.dados[1], e.dado) : '';
  return `<div class="tabuleiro" role="group" aria-label="Tabuleiro com ${NUM_CASAS} casas">
    ${casas}<div class="centro"><strong>${vez}</strong>${dados}</div>
  </div>`;
}

function painelEmpresa(e) {
  const { dinheiro, reputacao } = e.empresa;
  return `<div class="cartao empresa">
    <strong>Fisher S.A. · caixa e reputação compartilhados</strong>
    <span class="din">${brl(dinheiro)}</span>
    <span class="rep" title="Reputação">Rep. ${reputacao}<progress max="100" value="${reputacao}"></progress></span>
    <small>Meta do próximo Balanço: ${brl(metaTrimestral(e))}</small>
  </div>`;
}

function placar(e) {
  const coop = ehCooperativo(e);
  return `${coop ? painelEmpresa(e) : ''}<ul class="placar">${e.jogadores
    .map(
      (j) => `<li class="${j.id === e.jogadorAtual && e.fase !== 'FIM_DE_JOGO' ? 'ativo' : ''}">
        <span class="peao p${j.id}">${esc(j.nome.trim().charAt(0).toUpperCase() || '?')}</span>
        <span class="nome">${esc(j.nome)} <small>${esc(cargoDe(e, j))} · ${NOME_NIVEL[j.nivel]}</small></span>
        ${
          coop
            ? ''
            : `<span class="din">${brl(j.dinheiro)}</span>
        <span class="rep" title="Reputação">Rep. ${j.reputacao}<progress max="100" value="${j.reputacao}"></progress></span>`
        }
      </li>`,
    )
    .join('')}</ul>`;
}

      function painel(e) {
  switch (e.fase) {
    case 'ROLAR_DADO':
      return viewRolar(e);
      case 'ESCOLHER_CONFIANCA':
      case 'ESCOLHER_METRICA':
      case 'INFORMAR_VALOR':
      case 'ESCOLHER_JUSTIFICATIVA':
      return viewDecisao(e);
      case 'MOSTRAR_RESULTADO':
      return viewResultado(e);
      case 'MOSTRAR_EVENTO':
      return viewEvento(e);
      case 'MOSTRAR_BALANCO':
      return viewBalanco(e);
      case 'FIM_DE_JOGO':
      return viewFim(e);
      default:
      return '';
  }
}

const metaTexto = (b) =>
  b.meta
    ? ` Meta de ${brl(b.meta.valor)} ${b.meta.cumprida ? `cumprida: bônus de investidor ${brlSinal(b.meta.dinheiro)}` : `não cumprida: corte de orçamento ${brlSinal(b.meta.dinheiro)}`}.`
    : '';

const bannerBalanco = (e) =>
      e.balanco && e.fase !== 'MOSTRAR_BALANCO'
      ? `<p class="aviso">${ehCooperativo(e) ? 'A empresa passou' : autor(e).passou} pelo Balanço: ${brlSinal(e.balanco.liquido)} (receita ${brl(e.balanco.receita)}, custos ${brl(e.balanco.custos)}).${metaTexto(e.balanco)}</p>`
      : '';

      const botaoContinuar = '<button class="primario" data-acao="CONTINUAR">Próximo jogador</button>';

function viewRolar(e) {
  const j = jogadorAtual(e);
  const cargo = cargoDe(e, j);
  const inaugural =
    e.turnoAtual === 1 && j.posicao === 0 && e.jogadores.every((x) => x.historico.length === 0)
      ? `<div class="cartao briefing-inaugural">
        <span class="tag-contexto">🏛️ Assembleia Inaugural do Conselho</span>
        <p>Bem-vindos à sede corporativa da <strong>Fisher S.A.</strong>! Cada CEO acaba de assumir sua divisão com <strong>R$ 50.000 em caixa</strong> e <strong>50 pontos de reputação</strong>. Os mercados estão abertos: role os dados para liderar suas operações no primeiro trimestre!</p>
      </div>`
      : '';

  if (ehBot(j)) {
    return `${inaugural}<h2>Vez de ${esc(j.nome)} <small>(${esc(cargo)})</small></h2>
      <p>O rival está na casa ${j.posicao + 1}. Ele rola os dados e decide sozinho; você acompanha o resultado.</p>
      <button class="primario" data-acao="ROLAR">Ver a jogada do rival</button>`;
  }
  return `${inaugural}<h2>Vez de ${esc(j.nome)} <small>(${esc(cargo)})</small></h2>
      <p>Você está na casa ${j.posicao + 1}. Role os dados para avançar na trilha e encarar os desafios do mercado.</p>
      <button class="primario" data-acao="ROLAR">Rolar os dados</button>`;
}

// Texto para colar no Excel (colunas separadas por tabulação, números com vírgula decimal, sem unidade):
// os registros, um por linha, ou valor e frequência.
export function tabelaTsv(def, c) {
  const num = (v) => String(v).replace('.', ',');
  const valores = c.series[0].valores;
  if (def.dados.tabela === 'frequencias') {
    const linhas = [...contagens(valores)].sort((x, y) => x[0] - y[0]).map(([v, q]) => `${num(v)}\t${q}`);
    return [`${def.dados.rotulo_x}\t${def.dados.rotulo_y}`, ...linhas].join('\n');
  }
  return [`Nº\t${def.dados.rotulo_x}`, ...valores.map((v, i) => `${i + 1}\t${num(v)}`)].join('\n');
}

const botaoCopiar = `<p class="copiar-tabela"><button type="button" class="discreto" data-acao="COPIAR_TABELA">📋 Copiar tabela para o Excel</button> <span role="status" class="ajuda" data-copiado hidden>Copiado! Cole numa planilha.</span></p>`;

// Dados de um cenário de cálculo em tabela: os registros na ordem em que chegaram, ou valor e frequência.
function tabelaDados(def, c) {
  const { formato, rotulo_x: rotuloX, rotulo_y: rotuloY } = def.dados;
  const valores = c.series[0].valores;
  if (def.dados.tabela === 'frequencias') {
    const linhas = [...contagens(valores)]
      .sort((a, b) => a[0] - b[0])
      .map(([v, q]) => `<tr><td>${esc(formatar(formato, v))}</td><td>${q}</td></tr>`)
      .join('');
    return `<table class="tabela-dados"><caption>Dados da tabela (${valores.length} registros)</caption>
      <thead><tr><th scope="col">${esc(rotuloX)}</th><th scope="col">${esc(rotuloY)}</th></tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr><th scope="row">Total</th><td>${valores.length}</td></tr></tfoot></table>${botaoCopiar}`;
  }
  // Vários blocos lado a lado quando a lista é longa; cada bloco lê de cima para baixo.
  const blocos = valores.length > 12 ? 3 : valores.length > 6 ? 2 : 1;
  const porBloco = Math.ceil(valores.length / blocos);
  const cabecalho = Array.from({ length: blocos }, () => `<th scope="col">Nº</th><th scope="col">${esc(rotuloX)}</th>`).join('');
  const linhas = Array.from({ length: porBloco }, (_, r) =>
    Array.from({ length: blocos }, (_, b) => {
      const i = b * porBloco + r;
      return i < valores.length ? `<td>${i + 1}</td><td>${esc(formatar(formato, valores[i]))}</td>` : '<td></td><td></td>';
    }).join(''),
  ).map((l) => `<tr>${l}</tr>`).join('');
  return `<table class="tabela-dados"><caption>Dados da tabela (${valores.length} registros)</caption>
    <thead><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table>${botaoCopiar}`;
}

      function blocoCenario(e, marcadoresRevelacao) {
  const c = e.cenarioAtual;
      const def = obterCenario(c.id);
      const discreto = def.dados.tipo_grafico === 'barras_discretas';
      const dominio = calcularDominio(c.series, discreto);
      const mostraGrafico = !ehCalculo(def) || def.dados.exibir.includes('grafico');
      const graficos = (mostraGrafico ? c.series : [])
    .map((serie, i) =>
      grafico({
        serie,
        dominio,
        discreto,
        formato: def.dados.formato,
      rotuloX: def.dados.rotulo_x,
      rotuloY: def.dados.rotulo_y,
        titulo: c.series.length > 1 ? serie.nome : null,
      descricao: def.dados.descricao_acessivel,
        marcadores: (marcadoresRevelacao ?? []).map((mk) => ({
        ...mk,
        valor: valorDoMarcador(c.num, mk.chave, i, c.series.length),
        })),
      }),
      )
      .join('');
      return {def, html: `<h2>${esc(def.titulo)}</h2><p class="contexto">${esc(preencher(def.contexto, c.vars))}</p>${ehCalculo(def) ? tabelaDados(def, c) : ''}${graficos}` };
}

      function viewDecisao(e) {
  const j = jogadorAtual(e);
      const c = e.cenarioAtual;
      const {def, html} = blocoCenario(e);
      const calculo = ehCalculo(def);
      let passo;

      // Normalmente o main.js já despacha DECIDIR_BOT; o botão cobre uma partida retomada nesta fase.
      if (ehBot(j)) {
    return `${bannerBalanco(e)}${html}<button class="primario" data-acao="DECIDIR_BOT">Ver a decisão do rival</button>`;
  }

      if (e.fase === 'ESCOLHER_METRICA') {
    const dica = j.nivel !== 'iniciante' || !def.dica ? ''
      : c.dicaUsada ? `<p class="dica"><strong>Dica:</strong> ${esc(def.dica)}</p>`
      : '<button class="discreto" data-acao="ABRIR_DICA">Mostrar dica (reduz pela metade o bônus de confiança)</button>';
      passo = `<h3>1. Qual métrica você escolhe?</h3>${dica}
      <div class="opcoes">${c.ordemOpcoes
        .map((id) => def.opcoes.find((o) => o.id === id))
        .map((o) => `<button class="opcao" data-acao="METRICA" data-valor="${o.id}">${esc(preencher(o.texto, c.vars))}</button>`)
        .join('')}</div>`;
  } else if (e.fase === 'INFORMAR_VALOR') {
    const escolhida = def.opcoes.find((o) => o.id === c.metricaId);
    const un = unidade(def.dados.formato);
    const nota = notaDeMetodo(escolhida.chave);
    passo = `<h3>2. Qual valor você calculou?</h3>
      <p class="ajuda">Sua métrica: <strong>${esc(preencher(escolhida.texto, c.vars))}</strong></p>
      <p class="ajuda">Calcule com os dados da tabela. Aceitamos uma <strong>margem de erro de ±${String(margemPct(def, escolhida)).replace('.', ',')}%</strong> sobre o valor correto, então arredondamentos pequenos não são problema.${nota ? ` ${esc(nota)}` : ''}</p>
      <form class="form-valor" data-form="valor" novalidate>
        <label>Valor calculado${un ? ` (em ${esc(un)})` : ''}
          <input name="valor" type="text" inputmode="decimal" autocomplete="off" required aria-describedby="erro-valor" placeholder="ex.: 1234,5">
        </label>
        <button class="primario" type="submit">Confirmar valor</button>
        <p class="erro-campo" id="erro-valor" role="alert" hidden>Digite só o número, por exemplo 1234,5.</p>
      </form>`;
  } else if (e.fase === 'ESCOLHER_JUSTIFICATIVA') {
    const escolhida = def.opcoes.find((o) => o.id === c.metricaId);
      passo = `<h3>${calculo ? 3 : 2}. Por que essa é a melhor decisão?</h3>
      <p class="ajuda">Sua métrica: <strong>${esc(preencher(escolhida.texto, c.vars))}</strong>${calculo ? ` · Seu valor: <strong>${esc(formatar(def.dados.formato, c.valorInformado))}</strong>` : ''}</p>
      <div class="opcoes">${c.ordemJustificativas
        .map((id) => def.justificativas.find((x) => x.id === id))
        .map((x) => `<button class="opcao" data-acao="JUSTIFICATIVA" data-valor="${x.id}">${esc(preencher(x.texto, c.vars))}</button>`)
        .join('')}</div>`;
  } else {
    const V = def.valor_base * NIVEL[j.nivel];
    const linha = (chave) => {
      const f = CONFIANCA[chave];
      const fGanho = confiancaEfetiva(f, c.dicaUsada);
      return `<button class="opcao" data-acao="CONFIANCA" data-valor="${chave}">
        <strong>${ROTULO_CONFIANCA[chave]} (×${String(f).replace('.', ',')})</strong>
        <span>Acerto total: até ${brlSinal(V * fGanho)} · Erro total: ${brlSinal(-0.5 * V * f)}</span>
      </button>`;
    };
    const escolhida = def.opcoes.find((o) => o.id === c.metricaId);
    const justEscolhida = def.justificativas.find((x) => x.id === c.justificativaId);
      const resumo = escolhida && justEscolhida
      ? `<p class="ajuda">Sua métrica: <strong>${esc(preencher(escolhida.texto, c.vars))}</strong>${calculo ? `<br>Seu valor: <strong>${esc(formatar(def.dados.formato, c.valorInformado))}</strong>` : ''}<br>Sua justificativa: <strong>${esc(preencher(justEscolhida.texto, c.vars))}</strong></p>`
      : '';
      passo = `<h3>${calculo ? 4 : 3}. Quão confiante você está na sua resposta?</h3>
      ${resumo}
      <p class="ajuda">Aposte: quanto maior a confiança, maior o ganho e a perda.</p>
      <div class="opcoes">${Object.keys(CONFIANCA).map(linha).join('')}</div>`;
  }
      return `${bannerBalanco(e)}${html}${passo}`;
}

      function viewResultado(e) {
  const r = e.resultado;
      const c = e.cenarioAtual;
      const def = obterCenario(r.cenarioId);
      const vars = c.vars;
  const escolhida = def.opcoes.find((o) => o.id === r.metricaId);
  const certa = def.opcoes.find((o) => o.correta);
  const just = def.justificativas.find((x) => x.id === r.justificativaId);
  const justCerta = def.justificativas.find((x) => x.tipo === 'correta');
      const fb = def.feedback;

      const marcadores = fb.revelacao.marcadores;
      const {html} = blocoCenario(e, marcadores);
      const titulo = html.slice(0, html.indexOf('</p>') + 4); // título + contexto
    const graficos = html.slice(titulo.length);

    const quem = autor(e);
    // A decisão do rival não aparece em nenhuma etapa anterior, então o resultado a mostra.
    const escolhasRival = ehBot(jogadorAtual(e))
      ? `<p class="ajuda">${quem.metrica}: <strong>${esc(preencher(escolhida.texto, vars))}</strong>${r.calculo ? `<br>Valor do rival: <strong>${esc(formatar(def.dados.formato, r.calculo.informado))}</strong>` : ''}<br>${quem.justificativa}: <strong>${esc(preencher(just.texto, vars))}</strong><br>Confiança: <strong>${ROTULO_CONFIANCA[r.confianca]}</strong></p>`
      : '';
    const explicacoes = [`<p>${esc(preencher(fb.explicacao_correta, vars))}</p>`];
    if (!escolhida.correta) {
      explicacoes.push(`<p><strong>${quem.metrica}:</strong> ${esc(preencher(fb.por_equivoco[escolhida.equivoco], vars))}</p>`);
  }
    if (r.calculo) explicacoes.push(blocoCalculo(def, r, escolhida, certa, c, quem));
    if (!r.justificativaCorreta) {
    const msg = fb.por_equivoco[just.equivoco] ?? MSG_JUSTIFICATIVA[just.tipo];
    explicacoes.push(`<p><strong>${quem.justificativa}:</strong> ${esc(preencher(msg, vars))}</p>`);
  }

    const gabarito = [];
    if (!escolhida.correta) gabarito.push(`<li>Métrica certa: ${esc(preencher(certa.texto, vars))}</li>`);
    if (!r.justificativaCorreta) gabarito.push(`<li>Justificativa certa: ${esc(preencher(justCerta.texto, vars))}</li>`);

    const rep = r.deltaReputacao ? ` · Reputação ${r.deltaReputacao > 0 ? '+' : '−'}${Math.abs(r.deltaReputacao)}` : '';
    const usouDica = r.dicaUsada ? ' · Dica usada: bônus de confiança reduzido pela metade' : '';
    const mult = r.multiplicador !== 1 ? ` (bônus de reputação ×${r.multiplicador.toFixed(2).replace('.', ',')})` : '';

    return `${bannerBalanco(e)}${titulo}${escolhasRival}
    <div class="resultado ${r.categoria}">
      <h3>${tituloResultado(r)}</h3>
      <p class="delta">${r.delta === 0 ? 'Nenhuma variação de dinheiro' : brlSinal(r.delta)}${mult}${rep}${usouDica}</p>
      ${r.crise ? '<p class="alerta">Crise de imagem! Reputação em zero: multa de R$ 10.000.</p>' : ''}
    </div>
    ${explicacoes.join('')}
    ${gabarito.length ? `<ul class="gabarito">${gabarito.join('')}</ul>` : ''}
    ${graficos}
    ${botaoContinuar}`;
}

// Confronto entre o valor informado e o valor exato, com a margem aceita e a explicação do cálculo.
function blocoCalculo(def, r, escolhida, certa, c0, quem) {
  const vars = c0.vars;
  const f = (v) => esc(formatar(def.dados.formato, v));
  const c = r.calculo;
  const veredito = c.dentro ? 'dentro da margem' : 'fora da margem';
  const pct = String(c.margemPct).replace('.', ',');
  const outra = escolhida.correta
    ? ''
    : `<tr><th scope="row">Valor da métrica certa (${esc(certa.texto)})</th><td>${f(c0.num[certa.chave])}</td></tr>`;
  return `<table class="calculo-resultado"><caption>${quem.valor}</caption><tbody>
    <tr><th scope="row">Valor informado</th><td>${f(c.informado)} (${veredito})</td></tr>
    <tr><th scope="row">Valor correto de ${esc(escolhida.texto)}</th><td>${f(c.esperado)}</td></tr>
    <tr><th scope="row">Margem aceita (±${pct}%)</th><td>de ${f(c.minimo)} a ${f(c.maximo)}</td></tr>${outra}
  </tbody></table>
  <p><strong>Como calcular:</strong> ${esc(preencher(def.feedback.como_calcular, vars))}</p>`;
}

    function viewEvento(e) {
  const carta = EVENTOS.find((x) => x.id === e.eventoAtual.id);
    const efeitos = [];
    const dinheiro = e.eventoAtual.dinheiro ?? carta.dinheiro;
    if (dinheiro) efeitos.push(brlSinal(dinheiro));
    if (carta.reputacao) efeitos.push(`Reputação ${carta.reputacao > 0 ? '+' : '−'}${Math.abs(carta.reputacao)}`);
    return `${bannerBalanco(e)}<div class="evento ${dinheiro >= 0 ? 'bom' : 'ruim'}">
      <h2>Evento: ${esc(carta.titulo)}</h2>
      <p>${esc(carta.texto)}</p>
      <p class="delta">${dinheiro >= 0 ? '▲' : '▼'} ${efeitos.join(' · ')}${dinheiro !== carta.dinheiro ? ' (amortecido pela diretoria do setor)' : ''}</p>
      ${e.eventoAtual.crise ? '<p class="alerta">Crise de imagem! Reputação em zero: multa de R$ 10.000.</p>' : ''}
      <p class="licao"><strong>Lição:</strong> ${esc(carta.licao)}</p>
    </div>${botaoContinuar}`;
}

    function viewBalanco(e) {
  const b = e.balanco;
    return `<h2>Balanço da empresa</h2>
    <table class="balanco">
      <tr><td>Receita (ajustada pela reputação)</td><td>${brlSinal(b.receita)}</td></tr>
      <tr><td>Custos</td><td>${brlSinal(-b.custos)}</td></tr>
      <tr class="total"><td>Resultado</td><td>${brlSinal(b.liquido)}</td></tr>
      ${
        b.meta
          ? `<tr><td>Meta de caixa: ${brl(b.meta.valor)} (${b.meta.cumprida ? 'cumprida: bônus de investidor' : 'não cumprida: corte de orçamento'})</td><td>${brlSinal(b.meta.dinheiro)} · Rep. ${b.meta.reputacao > 0 ? '+' : '−'}${Math.abs(b.meta.reputacao)}</td></tr>
      <tr><td>Pessoas e Finanças: treinamento da equipe</td><td>Rep. +${b.bonusRh}</td></tr>`
          : ''
      }
    </table>${b.meta?.crise ? '<p class="alerta">Crise de imagem! Reputação em zero: multa de R$ 10.000.</p>' : ''}${botaoContinuar}`;
}

    function viewFimCooperativo(e) {
  const faixa = classificarEmpresa(e.empresa);
  return `<h2>Fim de jogo</h2><p class="vencedor">A Fisher S.A. terminou em: ${esc(faixa.nome)}</p>
    <p>Caixa final ${brl(e.empresa.dinheiro)} · Reputação ${e.empresa.reputacao}</p>
    <ol class="ranking">${e.jogadores
      .map((j) => {
        const acertos = j.historico.filter((h) => h.resultado === 'sucesso').length;
        return `<li><strong>${esc(j.nome)}</strong> (${esc(nomesPapeis(j))}): ${acertos} de ${j.historico.length} decisões com sucesso absoluto</li>`;
      })
      .join('')}</ol>
    ${relatorios(e)}
    <button class="primario" data-acao="NOVA">Jogar de novo</button>`;
}

function viewFim(e) {
  if (ehCooperativo(e)) return viewFimCooperativo(e);
  const ganhadores = vencedores(e);
    const titulo =
    ganhadores.length === 1
    ? `${esc(ganhadores[0].nome)} é o grande CEO!`
    : `Empate entre ${ganhadores.map((g) => esc(g.nome)).join(' e ')}`;
    return `<h2>Fim de jogo</h2><p class="vencedor">${titulo}</p>
    <ol class="ranking">${classificacao(e)
      .map((j) => {
        const acertos = j.historico.filter((h) => h.resultado === 'sucesso').length;
        return `<li><strong>${esc(j.nome)}</strong>: ${brl(j.dinheiro)} · Rep. ${j.reputacao} · ${acertos} de ${j.historico.length} decisões com sucesso absoluto</li>`;
      })
      .join('')}</ol>
    ${relatorios(e)}
    <button class="primario" data-acao="NOVA">Jogar de novo</button>`;
}

// ---------- relatório de desempenho (fim de jogo) ----------

const pct = (x) => `${Math.round(x * 100)}%`;
const DIAGNOSTICO = {
  dominado: 'domina e confia no que sabe',
  inseguro: 'acerta, mas sem confiança',
  equivoco: 'erra com convicção',
  lacuna: 'ainda não domina',
};
const MOTIVO_SUGESTAO = {
  equivoco: 'Errou com convicção: revise antes que a confusão se fixe.',
  lacuna: 'Ainda não domina: comece pelo básico.',
  inseguro: 'Acertou, mas sem confiança: reforce para ganhar segurança.',
  nao_visto: 'Não apareceu nesta partida: um próximo passo.',
};
const CALIBRACAO = {
  superconfiante: 'Apostou mais certeza do que acertou: vale desconfiar da primeira impressão.',
  subconfiante: 'Acertou mais do que apostou: pode confiar mais no que sabe.',
  calibrado: 'A confiança apostada acompanhou o acerto.',
};

const linkMaterial = (m) =>
  `<li><a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.titulo)}</a> <small>(${esc(m.fonte)})</small></li>`;

function listaAssuntos(conceitos, vazio) {
  if (!conceitos.length) return `<p class="ajuda">${vazio}</p>`;
  return `<ul class="assuntos">${conceitos
    .map((c) => `<li><strong>${esc(c.nome)}</strong>: ${DIAGNOSTICO[c.diagnostico]} <small>(acerto ${pct(c.taxaAcerto)} em ${c.decisoes} ${c.decisoes === 1 ? 'decisão' : 'decisões'})</small></li>`)
    .join('')}</ul>`;
}

function relatorioJogador(j) {
  const r = relatorioDesempenho(j);
  if (!r.decisoes) {
    return `<article class="cartao relatorio"><h3>${esc(j.nome)}</h3>
      <p class="ajuda">Não caiu em nenhuma casa de Decisão nesta partida, então não há acertos nem erros para avaliar.</p>
      <ul class="materiais">${linkMaterial(r.materialGeral)}</ul></article>`;
  }
  const sugestoes = r.sugestoes
    .map(
      (s) => `<li><strong>${esc(s.nome)}</strong> <small>${MOTIVO_SUGESTAO[s.motivo]}</small>
        <p>${esc(s.revisar)}</p>
        <ul class="materiais">${s.links.map(linkMaterial).join('')}</ul></li>`,
    )
    .join('');
  return `<article class="cartao relatorio">
    <h3>${esc(j.nome)}</h3>
    <div class="placar-relatorio">
      <div class="bom"><strong>${r.acertos}</strong><span>acertos totais</span></div>
      <div class="parcial"><strong>${r.parciais}</strong><span>acertos parciais</span></div>
      <div class="ruim"><strong>${r.erros}</strong><span>erros totais</span></div>
    </div>
    <p class="ajuda">${r.decisoes} ${r.decisoes === 1 ? 'decisão' : 'decisões'} · métrica certa em ${r.metricasCertas} · justificativa certa em ${r.justificativasCertas}. ${CALIBRACAO[r.geral.calibracao]}</p>
    <h4>Assuntos que mais domina</h4>
    ${listaAssuntos(r.maisDomina, 'Nenhum assunto com acerto consistente ainda.')}
    <h4>Assuntos que menos domina</h4>
    ${listaAssuntos(r.menosDomina, 'Nenhuma deficiência nos assuntos cobrados nesta partida.')}
    <h4>Sugestões de estudo</h4>
    <ol class="sugestoes">${sugestoes}</ol>
    <p class="ajuda">Para uma revisão completa:</p>
    <ul class="materiais">${linkMaterial(r.materialGeral)}</ul>
  </article>`;
}

// Um relatório por pessoa; o rival do computador não estuda.
function relatorios(e) {
  const pessoas = e.jogadores.filter((j) => !ehBot(j));
  if (!pessoas.length) return '';
  return `<section class="relatorios" aria-labelledby="titulo-relatorios">
    <h2 id="titulo-relatorios">Relatório de desempenho</h2>
    <p class="ajuda">A partida salva é apagada no fim de jogo: imprima ou salve em PDF para guardar o relatório.</p>
    ${pessoas.map(relatorioJogador).join('')}
    <button class="discreto" data-acao="IMPRIMIR">Imprimir relatório</button>
  </section>`;
}
