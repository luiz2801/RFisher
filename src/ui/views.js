// Visões puras: estado -> string HTML. Os eventos são ligados em main.js por delegação (data-acao).
import { esc } from './html.js';
import { grafico, calcularDominio } from './components/grafico.js';
import { CASAS, NUM_CASAS, ROTULO_CASA, coordenadas } from '../engine/board.js';
import { jogadorAtual, classificacao, vencedores } from '../engine/state.js';
import { CONFIANCA, NIVEL } from '../engine/scoring.js';
import { MAX_JOGADORES, TURNOS_PADRAO } from '../engine/config.js';
import { obterCenario, preencher, valorDoMarcador } from '../scenarios/loader.js';
import { EVENTOS } from '../scenarios/content/eventos.js';
import { brl, brlSinal } from '../stats/format.js';

const NOME_NIVEL = { iniciante: 'Iniciante', avancado: 'Avançado' };
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
    return `<fieldset data-jogador="${i}" ${i >= 2 ? 'hidden' : ''}>
      <legend>Jogador ${i + 1}</legend>
      <label>Nome <input name="nome_${i}" value="Jogador ${i + 1}" maxlength="20" required></label>
      <label>Nível
        <select name="nivel_${i}">
          <option value="iniciante">Iniciante (com dicas)</option>
          <option value="avancado">Avançado (casas valem ×1,5, sem dicas)</option>
        </select>
      </label>
    </fieldset>`;
  }).join('');

  return `<main class="menu">
    <h1>Tabuleiro do CEO</h1>
    <p class="sub">Você é o CEO de uma empresa. Escolha a métrica certa, justifique a decisão e termine com mais dinheiro.</p>
    ${
      salvo
        ? `<section class="cartao"><p>Há uma partida salva: ${salvo.jogadores.length} jogador(es), turno ${Math.min(salvo.turnoAtual, salvo.turnosPorJogador)} de ${salvo.turnosPorJogador}.</p>
           <button class="primario" data-acao="CONTINUAR_SALVA">Continuar partida salva</button></section>`
        : ''
    }
    <form id="form-menu" class="cartao">
      <h2>Nova partida</h2>
      <label>Jogadores
        <select name="n">${[1, 2, 3].map((n) => `<option value="${n}" ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      ${linhas}
      <label>Turnos por jogador
        <select name="turnos">${[6, 8, 10, 12].map((n) => `<option value="${n}" ${n === TURNOS_PADRAO ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <label>Semente (opcional, para repetir uma partida)
        <input name="seed" inputmode="numeric" pattern="[0-9]*" placeholder="aleatória">
      </label>
      <button class="primario" type="submit">Começar</button>
    </form>
  </main>`;
}

// ---------- jogo ----------

export function viewJogo(e) {
  const turno = Math.min(e.turnoAtual, e.turnosPorJogador);
  return `<header class="topo">
      <strong>Tabuleiro do CEO</strong>
      <span>Turno ${turno} de ${e.turnosPorJogador}</span>
      <button data-acao="NOVA" class="discreto">Nova partida</button>
    </header>
    <div class="jogo">
      <div class="lateral">${tabuleiro(e)}${placar(e)}</div>
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

function placar(e) {
  return `<ul class="placar">${e.jogadores
    .map(
      (j) => `<li class="${j.id === e.jogadorAtual && e.fase !== 'FIM_DE_JOGO' ? 'ativo' : ''}">
        <span class="peao p${j.id}">${esc(j.nome.trim().charAt(0).toUpperCase() || '?')}</span>
        <span class="nome">${esc(j.nome)} <small>${NOME_NIVEL[j.nivel]}</small></span>
        <span class="din">${brl(j.dinheiro)}</span>
        <span class="rep" title="Reputação">Rep. ${j.reputacao}<progress max="100" value="${j.reputacao}"></progress></span>
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

const bannerBalanco = (e) =>
  e.balanco && e.fase !== 'MOSTRAR_BALANCO'
    ? `<p class="aviso">Você passou pelo Balanço: ${brlSinal(e.balanco.liquido)} (receita ${brl(e.balanco.receita)}, custos ${brl(e.balanco.custos)}).</p>`
    : '';

const botaoContinuar = '<button class="primario" data-acao="CONTINUAR">Próximo jogador</button>';

function viewRolar(e) {
  const j = jogadorAtual(e);
  return `<h2>Vez de ${esc(j.nome)}</h2>
    <p>Você está na casa ${j.posicao + 1}. Role o dado para avançar na trilha.</p>
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
  return { def, html: `<h2>${esc(def.titulo)}</h2><p class="contexto">${esc(preencher(def.contexto, c.vars))}</p>${graficos}` };
}

function viewDecisao(e) {
  const j = jogadorAtual(e);
  const c = e.cenarioAtual;
  const { def, html } = blocoCenario(e);
  let passo;

  if (e.fase === 'ESCOLHER_CONFIANCA') {
    const V = def.valor_base * NIVEL[j.nivel];
    const linha = (chave, nome) => {
      const f = CONFIANCA[chave];
      return `<button class="opcao" data-acao="CONFIANCA" data-valor="${chave}">
        <strong>${nome} (×${String(f).replace('.', ',')})</strong>
        <span>Acerto total: até ${brlSinal(V * f)} · Erro total: ${brlSinal(-0.5 * V * f)}</span>
      </button>`;
    };
    passo = `<h3>1. Quão confiante você está?</h3>
      <p class="ajuda">Antes de escolher, aposte: quanto maior a confiança, maior o ganho e a perda.</p>
      <div class="opcoes">${linha('chute', 'Chute')}${linha('certeza', 'Certeza')}</div>`;
  } else if (e.fase === 'ESCOLHER_METRICA') {
    const dica = j.nivel === 'iniciante' && def.dica ? `<p class="dica"><strong>Dica:</strong> ${esc(def.dica)}</p>` : '';
    passo = `<h3>2. Qual métrica você escolhe?</h3>${dica}
      <div class="opcoes">${c.ordemOpcoes
        .map((id) => def.opcoes.find((o) => o.id === id))
        .map((o) => `<button class="opcao" data-acao="METRICA" data-valor="${o.id}">${esc(preencher(o.texto, c.vars))}</button>`)
        .join('')}</div>`;
  } else {
    const escolhida = def.opcoes.find((o) => o.id === c.metricaId);
    passo = `<h3>3. Por que essa é a melhor decisão?</h3>
      <p class="ajuda">Sua métrica: <strong>${esc(preencher(escolhida.texto, c.vars))}</strong></p>
      <div class="opcoes">${c.ordemJustificativas
        .map((id) => def.justificativas.find((x) => x.id === id))
        .map((x) => `<button class="opcao" data-acao="JUSTIFICATIVA" data-valor="${x.id}">${esc(x.texto)}</button>`)
        .join('')}</div>`;
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
  const { html } = blocoCenario(e, marcadores);
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
  if (!r.justificativaCorreta) gabarito.push(`<li>Justificativa certa: ${esc(justCerta.texto)}</li>`);

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
  if (carta.dinheiro) efeitos.push(brlSinal(carta.dinheiro));
  if (carta.reputacao) efeitos.push(`Reputação ${carta.reputacao > 0 ? '+' : '−'}${Math.abs(carta.reputacao)}`);
  return `${bannerBalanco(e)}<div class="evento ${carta.dinheiro >= 0 ? 'bom' : 'ruim'}">
      <h2>Evento: ${esc(carta.titulo)}</h2>
      <p>${esc(carta.texto)}</p>
      <p class="delta">${carta.dinheiro >= 0 ? '▲' : '▼'} ${efeitos.join(' · ')}</p>
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
    </table>${botaoContinuar}`;
}

function viewFim(e) {
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
