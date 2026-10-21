// Visões puras: estado -> string HTML. Os eventos são ligados em main.js por delegação (data-acao).
import { esc } from './html.js';
import { grafico, calcularDominio } from './components/grafico.js';
import { CASAS, NUM_CASAS, ROTULO_CASA, coordenadas } from '../engine/board.js';
import { jogadorAtual, classificacao, vencedores, ehCooperativo, classificarEmpresa } from '../engine/state.js';
import { DIRETORIAS } from '../engine/papeis.js';
import { metaTrimestral } from '../engine/machine.js';
import { CONFIANCA, NIVEL } from '../engine/scoring.js';
import { MAX_JOGADORES, TURNOS_PADRAO } from '../engine/config.js';
import { obterCenario, preencher, valorDoMarcador } from '../scenarios/loader.js';
import { EVENTOS } from '../scenarios/content/eventos.js';
import { brl, brlSinal } from '../stats/format.js';

const NOME_NIVEL = { iniciante: 'Iniciante', avancado: 'Avançado' };
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
const MSG_JUSTIFICATIVA = {
  parcial: 'Sua justificativa é verdadeira, mas incompleta: não explica por que a métrica escolhida é a melhor.',
  irrelevante: 'Sua justificativa pode até ser verdade, mas não sustenta a decisão.',
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
        </select>
      </label>
      <label>Quantidade de CEOs concorrentes
        <select name="n">${[1, 2, 3].map((n) => `<option value="${n}" ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      ${linhas}
      <label>Trimestres fiscais (turnos por jogador)
        <select name="turnos">${[2, 6, 8, 10, 12].map((n) => `<option value="${n}" ${n === TURNOS_PADRAO ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <label>Semente de mercado (opcional, para repetir uma partida)
        <input name="seed" inputmode="numeric" pattern="[0-9]*" placeholder="aleatória">
      </label>
      <button class="primario" type="submit">Iniciar Disputa Corporativa</button>
    </form>
  </main>`;
}

// ---------- jogo ----------

const nomesPapeis = (j) => j.papeis.map((id) => DIRETORIAS[id].nome).join(' + ');
// Cargo exibido: a(s) diretoria(s) no cooperativo, a divisão no competitivo.
const cargoDe = (e, j) => (ehCooperativo(e) ? nomesPapeis(j) : DIVISOES[j.id % DIVISOES.length].cargo);

export function viewJogo(e) {
  const turno = Math.min(e.turnoAtual, e.turnosPorJogador);
  return `<header class="topo">
      <strong>Tabuleiro do CEO · Fisher S.A.</strong>
      <span>Trimestre ${turno} de ${e.turnosPorJogador}</span>
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
  const dado = e.dado ? `<span class="dado" aria-label="Dado: ${e.dado}">${e.dado}</span>` : '';
  return `<div class="tabuleiro" role="group" aria-label="Tabuleiro com ${NUM_CASAS} casas">
    ${casas}<div class="centro"><strong>${vez}</strong>${dado}</div>
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
      ? `<p class="aviso">${ehCooperativo(e) ? 'A empresa passou' : 'Você passou'} pelo Balanço: ${brlSinal(e.balanco.liquido)} (receita ${brl(e.balanco.receita)}, custos ${brl(e.balanco.custos)}).${metaTexto(e.balanco)}</p>`
      : '';

      const botaoContinuar = '<button class="primario" data-acao="CONTINUAR">Próximo jogador</button>';

function viewRolar(e) {
  const j = jogadorAtual(e);
  const cargo = cargoDe(e, j);
  const inaugural =
    e.turnoAtual === 1 && j.posicao === 0 && e.jogadores.every((x) => x.historico.length === 0)
      ? `<div class="cartao briefing-inaugural">
        <span class="tag-contexto">🏛️ Assembleia Inaugural do Conselho</span>
        <p>Bem-vindos à sede corporativa da <strong>Fisher S.A.</strong>! Cada CEO acaba de assumir sua divisão com <strong>R$ 50.000 em caixa</strong> e <strong>50 pontos de reputação</strong>. Os mercados estão abertos: role o dado para liderar suas operações no primeiro trimestre!</p>
      </div>`
      : '';

  return `${inaugural}<h2>Vez de ${esc(j.nome)} <small>(${esc(cargo)})</small></h2>
      <p>Você está na casa ${j.posicao + 1}. Role o dado para avançar na trilha e encarar os desafios do mercado.</p>
      <button class="primario" data-acao="ROLAR">Rolar o dado</button>`;
}

      function blocoCenario(e, marcadoresRevelacao) {
  const c = e.cenarioAtual;
      const def = obterCenario(c.id);
      const discreto = def.dados.tipo_grafico === 'barras_discretas';
      const dominio = calcularDominio(c.series, discreto);
      const graficos = c.series
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
      return {def, html: `<h2>${esc(def.titulo)}</h2><p class="contexto">${esc(preencher(def.contexto, c.vars))}</p>${graficos}` };
}

      function viewDecisao(e) {
  const j = jogadorAtual(e);
      const c = e.cenarioAtual;
      const {def, html} = blocoCenario(e);
      let passo;

      if (e.fase === 'ESCOLHER_METRICA') {
    const dica = j.nivel === 'iniciante' && def.dica ? `<p class="dica"><strong>Dica:</strong> ${esc(def.dica)}</p>` : '';
      passo = `<h3>1. Qual métrica você escolhe?</h3>${dica}
      <div class="opcoes">${c.ordemOpcoes
        .map((id) => def.opcoes.find((o) => o.id === id))
        .map((o) => `<button class="opcao" data-acao="METRICA" data-valor="${o.id}">${esc(preencher(o.texto, c.vars))}</button>`)
        .join('')}</div>`;
  } else if (e.fase === 'ESCOLHER_JUSTIFICATIVA') {
    const escolhida = def.opcoes.find((o) => o.id === c.metricaId);
      passo = `<h3>2. Por que essa é a melhor decisão?</h3>
      <p class="ajuda">Sua métrica: <strong>${esc(preencher(escolhida.texto, c.vars))}</strong></p>
      <div class="opcoes">${c.ordemJustificativas
        .map((id) => def.justificativas.find((x) => x.id === id))
        .map((x) => `<button class="opcao" data-acao="JUSTIFICATIVA" data-valor="${x.id}">${esc(preencher(x.texto, c.vars))}</button>`)
        .join('')}</div>`;
  } else {
    const V = def.valor_base * NIVEL[j.nivel];
    const linha = (chave, nome) => {
      const f = CONFIANCA[chave];
      return `<button class="opcao" data-acao="CONFIANCA" data-valor="${chave}">
        <strong>${nome} (×${String(f).replace('.', ',')})</strong>
        <span>Acerto total: até ${brlSinal(V * f)} · Erro total: ${brlSinal(-0.5 * V * f)}</span>
      </button>`;
    };
    const escolhida = def.opcoes.find((o) => o.id === c.metricaId);
    const justEscolhida = def.justificativas.find((x) => x.id === c.justificativaId);
      const resumo = escolhida && justEscolhida
      ? `<p class="ajuda">Sua métrica: <strong>${esc(preencher(escolhida.texto, c.vars))}</strong><br>Sua justificativa: <strong>${esc(preencher(justEscolhida.texto, c.vars))}</strong></p>`
      : '';
      passo = `<h3>3. Quão confiante você está na sua resposta?</h3>
      ${resumo}
      <p class="ajuda">Aposte: quanto maior a confiança, maior o ganho e a perda.</p>
      <div class="opcoes">${linha('chute', 'Chute')}${linha('certeza', 'Certeza')}</div>`;
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

    const explicacoes = [`<p>${esc(preencher(fb.explicacao_correta, vars))}</p>`];
    if (!r.metricaCorreta) {
      explicacoes.push(`<p><strong>Sua métrica:</strong> ${esc(preencher(fb.por_equivoco[escolhida.equivoco], vars))}</p>`);
  }
    if (!r.justificativaCorreta) {
    const msg = fb.por_equivoco[just.equivoco] ?? MSG_JUSTIFICATIVA[just.tipo];
    explicacoes.push(`<p><strong>Sua justificativa:</strong> ${esc(preencher(msg, vars))}</p>`);
  }

    const gabarito = [];
    if (!r.metricaCorreta) gabarito.push(`<li>Métrica certa: ${esc(preencher(certa.texto, vars))}</li>`);
    if (!r.justificativaCorreta) gabarito.push(`<li>Justificativa certa: ${esc(preencher(justCerta.texto, vars))}</li>`);

    const rep = r.deltaReputacao ? ` · Reputação ${r.deltaReputacao > 0 ? '+' : '−'}${Math.abs(r.deltaReputacao)}` : '';
    const mult = r.multiplicador !== 1 ? ` (bônus de reputação ×${r.multiplicador.toFixed(2).replace('.', ',')})` : '';

    return `${bannerBalanco(e)}${titulo}
    <div class="resultado ${r.categoria}">
      <h3>${TITULO_RESULTADO[r.categoria]}</h3>
      <p class="delta">${r.delta === 0 ? 'Nenhuma variação de dinheiro' : brlSinal(r.delta)}${mult}${rep}</p>
      ${r.crise ? '<p class="alerta">Crise de imagem! Reputação em zero: multa de R$ 10.000.</p>' : ''}
    </div>
    ${explicacoes.join('')}
    ${gabarito.length ? `<ul class="gabarito">${gabarito.join('')}</ul>` : ''}
    ${graficos}
    ${botaoContinuar}`;
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
    <button class="primario" data-acao="NOVA">Jogar de novo</button>`;
}
