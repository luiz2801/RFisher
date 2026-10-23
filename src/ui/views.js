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
import { ehCalculo, margemPct, notaDeMetodo, OPERACOES_CALCULADORA } from '../engine/calculo.js';

// Sementes fixas oferecidas no menu (1 a QTD_SEMENTES); vazio = sorteada.
export const QTD_SEMENTES = 20;
const NOME_NIVEL = { iniciante: 'Iniciante', avancado: 'Avançado' };
const FIGURA_CASA = { decisao: '📊', evento: '🎲', balanco: '🏦' };
const ROTULO_BOT = { facil: 'fácil', medio: 'médio', dificil: 'difícil' };
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
    const opcoes = Object.entries(DIRETORIAS)
      .map(([id, d], k) => `<option value="${id}" ${k === i % 3 ? 'selected' : ''}>${d.icone} ${esc(d.nome)}</option>`)
      .join('');
    return `<fieldset data-jogador="${i}" ${i >= 2 ? 'hidden' : ''} class="card-jogador-config">
      <legend class="legend-jogador">Jogador ${i + 1}</legend>
      <label data-campo="diretoria">Setor que representa
        <select name="diretoria_${i}">${opcoes}</select>
      </label>
      <p class="ajuda" data-campo="diretoria-resto" hidden>Fica com os setores que sobrarem.</p>
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
  const cartoesDivisoes = Object.values(DIRETORIAS).map(
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
        <select name="seed"><option value="" selected>Aleatória</option>${Array.from({ length: QTD_SEMENTES }, (_, i) => `<option value="${i + 1}">Mercado ${i + 1}</option>`).join('')}</select>
      </label>
      <fieldset class="apoio">
        <legend>Material de apoio</legend>
        <p>Alguns cenários trazem uma tabela de dados e pedem que você faça a conta (mediana, percentil, desvio padrão, quartis). Para esses, o ideal é ter à mão:</p>
        <ul>
          <li>a <strong>calculadora de estatísticas</strong> do próprio jogo (média, mediana, quartis, IQR, percentil, desvio padrão), disponível na etapa do valor; ou</li>
          <li>uma <strong>planilha</strong> (Excel, Google Planilhas ou LibreOffice): o botão "Copiar tabela" cola os dados direto nela, e as funções <code>MED</code>, <code>PERCENTIL.INC</code>, <code>DESVPAD.A</code> e <code>QUARTIL.INC</code> conferem o resultado; ou</li>
          <li><strong>lápis e papel</strong> (com calculadora), para ordenar os registros e contar posições.</li>
        </ul>
        <label>Como você quer jogar?
          <select name="apoio">
            <option value="completo">Incluir os cenários de cálculo</option>
            <option value="conceitual">Não tenho: só questões conceituais (sem contas)</option>
          </select>
        </label>
      </fieldset>
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
      <p class="erro-campo" data-erro-setor role="alert" hidden>Dois jogadores escolheram o mesmo setor. Cada um precisa de um setor diferente.</p>
      <button class="primario" type="submit">Iniciar Disputa Corporativa</button>
    </form>
  </main>`;
}

// ---------- jogo ----------

const nomesPapeis = (j) => j.papeis.map((id) => DIRETORIAS[id].nome).join(' + ');
// Cargo exibido: a(s) diretoria(s) no cooperativo, o setor escolhido no competitivo, o perfil no rival do solo.
const cargoDe = (e, j) => {
  if (ehBot(j)) return `🤖 computador, ${ROTULO_BOT[j.bot]}`;
  if (ehCooperativo(e)) return nomesPapeis(j);
  const ids = Object.keys(DIRETORIAS);
  return DIRETORIAS[j.diretoria ?? ids[j.id % ids.length]].cargo;
};
// Textos da decisão em segunda pessoa para quem joga, em terceira para o rival do computador.
const autor = (e) =>
  ehBot(jogadorAtual(e))
    ? { metrica: 'Métrica do rival', justificativa: 'Justificativa do rival', valor: 'Cálculo do rival', passou: 'O rival passou' }
    : { metrica: 'Sua métrica', justificativa: 'Sua justificativa', valor: 'Seu cálculo', passou: 'Você passou' };

export function viewJogo(e) {
  const turno = Math.min(e.turnoAtual, e.turnosPorJogador);
  // O tabuleiro ocupa a tela; a pergunta (e qualquer outra etapa depois da rolagem) aparece sobre ele.
  const sobreposto = e.fase !== 'ROLAR_DADO'
    ? `<div class="modal"><section class="painel" id="painel" role="dialog" aria-modal="true" aria-label="Decisão da rodada" tabindex="-1" aria-live="polite">${painel(e)}</section></div>`
    : '';
  return `<header class="topo">
      <strong>Tabuleiro do CEO · Fisher S.A.</strong>
      <span>Trimestre ${turno} de ${e.turnosPorJogador}</span>
      ${e.teste ? '<span class="selo-teste" title="Casa ou cenários forçados pelos atalhos de teste">Partida de teste</span>' : ''}
      <button data-acao="NOVA" class="discreto">Nova partida</button>
    </header>
    <div class="jogo">${tabuleiro(e)}</div>${sobreposto}`;
}

// Posição da casa nas duas orientações (grade 9x7 deitada, 7x9 em pé); o CSS escolhe pela tela.
export function posicaoCss(i) {
  const d = coordenadas(i, 9, 7);
  const p = coordenadas(i, 7, 9);
  return `--l:${d.linha};--c:${d.coluna};--lp:${p.linha};--cp:${p.coluna}`;
}

function tabuleiro(e) {
  const casas = CASAS.map((tipo, i) => {
    const pos = posicaoCss(i);
    const peoes = e.jogadores
      .filter((j) => j.posicao === i)
      .map((j) => `<span class="peao p${j.id}" title="${esc(j.nome)}">${esc(j.nome.trim().charAt(0).toUpperCase() || '?')}</span>`)
      .join('');
    return `<div class="casa ${tipo}" style="${pos}">
      <span class="num">${i + 1}</span><span class="figura" aria-hidden="true">${FIGURA_CASA[tipo]}</span><span class="tipo">${ROTULO_CASA[tipo]}</span><span class="peoes">${peoes}</span>
    </div>`;
  }).join('');
  const vez = e.fase === 'FIM_DE_JOGO' ? 'Fim de jogo' : `Vez de ${esc(jogadorAtual(e).nome)}`;
  const dados = e.dados ? parDadosHtml(e.dados[0], e.dados[1], e.dado) : '';
  return `<div class="tabuleiro" role="group" aria-label="Tabuleiro com ${NUM_CASAS} casas">
    ${casas}<div class="centro"><strong class="vez">${vez}</strong>${dados}${e.fase === 'ROLAR_DADO' ? viewRolar(e) : ''}${placar(e)}${contextoRapido(e)}</div>
  </div>`;
}

function contextoRapido(e) {
  return `<details class="contexto-rapido">
    <summary>🏛️ Contexto da Fisher S.A.</summary>
    <div class="cartao-contexto-interno">
      <p><strong>A Missão:</strong> A antiga diretoria quase faliu a Fisher S.A. tomando decisões por mero "achismo". Vocês assumiram divisões estratégicas com R$ 50.000 em caixa e 50 de reputação para provar quem lidera com dados reais.</p>
      ${
        ehCooperativo(e)
          ? '<p><strong>Objetivo:</strong> A diretoria responde por uma só empresa, com caixa e reputação compartilhados. Cumpram a meta de caixa em cada Balanço e levem a Fisher S.A. à melhor faixa ao fim dos trimestres.</p>'
          : '<p><strong>Critério de Vitória:</strong> Quem acumular mais capital (e maior reputação em caso de empate) ao fim dos trimestres fiscais será eleito Presidente do Conselho!</p>'
      }
    </div>
  </details>`;
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

// Controle no centro do tabuleiro: o botão de jogar (ou de ver a jogada do rival).
function viewRolar(e) {
  const j = jogadorAtual(e);
  const inaugural =
    e.turnoAtual === 1 && j.posicao === 0 && e.jogadores.every((x) => x.historico.length === 0)
      ? `<p class="briefing-inaugural"><strong>🏛️ Assembleia Inaugural do Conselho.</strong> Cada CEO assume sua divisão com <strong>R$ 50.000</strong> em caixa e <strong>50 pontos</strong> de reputação. Jogue os dados para liderar o primeiro trimestre!</p>`
      : '';
  const botao = ehBot(j)
    ? '<button class="primario cta-jogar" data-acao="ROLAR">Ver a jogada do rival</button>'
    : '<button class="primario cta-jogar" data-acao="ROLAR">🎲 Jogar</button>';
  return `${inaugural}<p class="ajuda">${esc(cargoDe(e, j))} · casa ${j.posicao + 1}${ehBot(j) ? ' · o rival decide sozinho e você acompanha' : ''}</p>${botao}`;
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

// Calculadora embutida da etapa do valor: o main.js calcula ao enviar o formulário (data-form="calculadora").
function calculadoraHtml() {
  const opcoes = OPERACOES_CALCULADORA.map((o) => `<option value="${o.id}"${o.pedeP ? ' data-pede-p' : ''}>${esc(o.rotulo)}</option>`).join('');
  return `<details class="calculadora"><summary>🧮 Calculadora de estatísticas (usa os dados da tabela)</summary>
    <form data-form="calculadora" novalidate>
      <label>Operação <select name="operacao">${opcoes}</select></label>
      <label data-campo="p" hidden>P (0 a 100) <input name="p" type="text" inputmode="decimal" autocomplete="off" placeholder="ex.: 90"></label>
      <button type="submit" class="discreto">Calcular</button>
      <output role="status" aria-live="polite" data-resultado></output>
    </form>
    <p class="ajuda">Ela só faz a operação sobre os dados: escolher a métrica certa e arredondar o valor continuam com você. O resultado não é preenchido sozinho no campo abaixo.</p>
  </details>`;
}

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

// Cenário de segmentos (paradoxo_simpson): em vez de histograma, tabela com a taxa de cada segmento antes e depois.
// As visitas, que explicam a inversão, só aparecem no resultado.
function tabelaSegmentos(c, revelar) {
  const [antes, depois, visAntes, visDepois] = c.series.map((s) => s.valores);
  const pct = (v) => formatar('porcento', v);
  const milhar = (v) => new Intl.NumberFormat('pt-BR').format(v);
  const linhas = ['Desktop', 'Mobile', 'Geral']
    .map((nome, i) => `<tr><th scope="row">${nome}</th><td>${pct(antes[i])}</td><td>${pct(depois[i])}</td>${revelar && i < 2 ? `<td>${milhar(visAntes[i])}</td><td>${milhar(visDepois[i])}</td>` : revelar ? '<td>' + milhar(visAntes[0] + visAntes[1]) + '</td><td>' + milhar(visDepois[0] + visDepois[1]) + '</td>' : ''}</tr>`)
    .join('');
  const extra = revelar ? '<th scope="col">Visitas antes</th><th scope="col">Visitas depois</th>' : '';
  return `<table class="tabela-dados"><caption>Taxa de conversão por dispositivo</caption>
    <thead><tr><th scope="col">Dispositivo</th><th scope="col">Antes</th><th scope="col">Depois</th>${extra}</tr></thead><tbody>${linhas}</tbody></table>`;
}

// Cenário de tabela de séries (tipo_grafico 'tabela_series'): cada série é uma coluna e cada posição, uma linha
// (`dados.rotulos_linhas`). As colunas de `dados.ocultas_ate_resultado` — o que explica a resposta — só aparecem no resultado.
function tabelaSeries(def, c, revelar) {
  const d = def.dados;
  const colunas = c.series.map((serie, i) => ({ serie, formato: d.formatos?.[i] ?? d.formato })).filter((_, i) => revelar || !d.ocultas_ate_resultado?.includes(i));
  const cabecalho = colunas.map(({ serie }) => `<th scope="col">${esc(serie.nome)}</th>`).join('');
  const linhas = d.rotulos_linhas
    .map((rotulo, r) => `<tr><th scope="row">${esc(rotulo)}</th>${colunas.map(({ serie, formato }) => `<td>${esc(formatar(formato, serie.valores[r]))}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="tabela-dados" aria-describedby="desc-tabela"><caption>${esc(d.legenda)}</caption>
    <thead><tr><td></td>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table><p id="desc-tabela" hidden>${esc(d.descricao_acessivel)}</p>`;
}

      function blocoCenario(e, marcadoresRevelacao) {
  const c = e.cenarioAtual;
      const def = obterCenario(c.id);
      if (def.dados.tipo_grafico === 'segmentos') {
        return { def, html: `<h2>${esc(def.titulo)}</h2><p class="contexto">${esc(preencher(def.contexto, c.vars))}</p>${tabelaSegmentos(c, marcadoresRevelacao !== undefined)}` };
      }
      if (def.dados.tipo_grafico === 'tabela_series') {
        return { def, html: `<h2>${esc(def.titulo)}</h2><p class="contexto">${esc(preencher(def.contexto, c.vars))}</p>${tabelaSeries(def, c, marcadoresRevelacao !== undefined)}` };
      }
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
      ${calculadoraHtml()}
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
