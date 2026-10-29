import { novoJogo, jogadorAtual, ehBot } from './engine/state.js';
import { reduzir } from './engine/machine.js';
import { salvar, carregar, limpar } from './storage/persist.js';
import { viewMenu, QTD_SEMENTES, viewJogo, tabelaTsv, posicaoCss } from './ui/views.js';
import { viewModalMultiplayer } from './ui/views-multi.js';
import { criarAnfitriao } from './net/anfitriao.js';
import { criarConvidado } from './net/convidado.js';
import { criarPedido, responderPedido } from './net/transporte.js';
import {
  gerarCodigoSala,
  detectarTipoSinalizacao,
  criarCanalSinalizacao,
  anunciarSala,
  conectarNaSala,
} from './net/sinalizacao.js';
import { obterCenario, todosCenarios } from './scenarios/loader.js';
import { MAX_JOGADORES, PERFIS_BOT } from './engine/config.js';
import { NUM_CASAS } from './engine/board.js';
import { ehCalculo } from './engine/calculo.js';
import { setoresRepetidos } from './engine/papeis.js';
import { dadoHtml } from './ui/components/dado.js';
import { lerNumero } from './stats/format.js';
import { calcularOperacao, formatarResultadoCalculadora } from './engine/calculo.js';

const app = document.getElementById('app');
let estado = null;
let sessaoRede = null;
let estadoUiMulti = null;
const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function encerrarSessaoRede() {
  if (!sessaoRede) return;
  if (sessaoRede.tickTimer) clearInterval(sessaoRede.tickTimer);
  if (sessaoRede.timerDiag) clearInterval(sessaoRede.timerDiag);
  if (sessaoRede.sinalizador) {
    try {
      sessaoRede.sinalizador.parar();
    } catch {
      /* já parado */
    }
  }
  if (sessaoRede.tipo === 'anfitriao') {
    sessaoRede.instancia.encerrar();
  } else if (sessaoRede.tipo === 'convidado') {
    sessaoRede.instancia.sair();
  } else if (sessaoRede.pedidoPendente?.transporte) {
    try {
      sessaoRede.pedidoPendente.transporte.fechar();
    } catch {
      /* já fechado */
    }
  }
  sessaoRede = null;
}

function render({ focar = false } = {}) {
  let papelRede = null;
  let meuId = null;
  let sem = [];
  let avisoRede = null;

  if (sessaoRede?.tipo === 'anfitriao') {
    const v = sessaoRede.instancia.visao();
    papelRede = 'anfitriao';
    meuId = v.meuId;
    sem = v.sem ?? [];
    avisoRede = v.aviso;
  } else if (sessaoRede?.tipo === 'convidado') {
    const v = sessaoRede.instancia.visao();
    papelRede = 'convidado';
    meuId = v.meuId;
    sem = v.sem ?? [];
    avisoRede = v.aviso;
  }

  // Cada jogador tem um tema próprio (style.css, body[data-vez]); a troca de vez muda as cores da tela.
  if (estado && estado.fase !== 'FIM_DE_JOGO') document.body.dataset.vez = String(estado.jogadorAtual);
  else delete document.body.dataset.vez;

  let html = estado ? viewJogo(estado, { meuId, sem, papelRede, avisoRede }) : viewMenu({ salvo: carregar() });
  if (estadoUiMulti) {
    html += viewModalMultiplayer(estadoUiMulti);
  }
  app.innerHTML = html;
  if (focar) (document.getElementById('painel') ?? app.querySelector('.cta-jogar'))?.focus({ preventScroll: true });
}

function aplicarEstado(novo) {
  estado = novo;
  // O rival decide assim que cai numa casa de Decisão; a pessoa vê direto o resultado dele.
  if (estado.fase === 'ESCOLHER_METRICA' && ehBot(jogadorAtual(estado))) estado = reduzir(estado, { tipo: 'DECIDIR_BOT' });
  if (estado.fase === 'FIM_DE_JOGO') limpar();
  else if (!sessaoRede) salvar(estado);
  render({ focar: true });
  window.scrollTo({ top: 0 });
}

function despachar(acao) {
  if (sessaoRede?.tipo === 'anfitriao') {
    sessaoRede.instancia.jogar(acao);
    return;
  }
  if (sessaoRede?.tipo === 'convidado') {
    sessaoRede.instancia.acao(acao);
    return;
  }
  const novo = reduzir(estado, acao);
  if (novo === estado) return;
  aplicarEstado(novo);
}

// Atalhos de teste do menu: casa forçada e/ou subconjunto de cenários. `null` é a partida normal.
function lerTeste(dados) {
  const casa = String(dados.get('teste_casa'));
  const filtro = String(dados.get('teste_cenarios'));
  const todos = todosCenarios();
  const cenarios = {
    '': null,
    calculo: todos.filter(ehCalculo).map((c) => c.id),
    comuns: todos.filter((c) => !ehCalculo(c)).map((c) => c.id),
  }[filtro] ?? todos.filter((c) => c.id === filtro).map((c) => c.id);
  return { casa: ['decisao', 'evento', 'mercado', 'balanco'].includes(casa) ? casa : null, cenarios };
}

// Setores repetidos entre os jogadores não valem (regra em papeis.js, compartilhada com o multiplayer).
function formTemSetoresRepetidos(form) {
  const modo = form.elements.modo.value;
  const n = modo === 'solo' ? 1 : Number(form.elements.n.value);
  return setoresRepetidos(modo, Array.from({ length: n }, (_, i) => form.elements[`diretoria_${i}`].value));
}

// Campo numérico do menu: vazio ou inválido vira NaN, e o motor cai no padrão.
const lerInteiro = (valor) => (String(valor ?? '').trim() === '' ? NaN : Number(valor));

function iniciar(form) {
  const erro = form.querySelector('[data-erro-setor]');
  erro.hidden = !formTemSetoresRepetidos(form);
  if (!erro.hidden) {
    mostrarEtapa(etapasVisiveis(form).indexOf(form.querySelector('[data-jogador="0"]')));
    return;
  }
  const dados = new FormData(form);
  const solo = dados.get('modo') === 'solo';
  const n = solo ? 1 : Math.min(MAX_JOGADORES, Math.max(1, Number(dados.get('n'))));
  const jogadores = Array.from({ length: n }, (_, i) => ({
    nome: String(dados.get(`nome_${i}`)).trim() || `Jogador ${i + 1}`,
    nivel: dados.get(`nivel_${i}`) === 'avancado' ? 'avancado' : 'iniciante',
    diretoria: String(dados.get(`diretoria_${i}`)),
  }));
  // Solo é o competitivo contra um rival do computador, no mesmo nível da pessoa (mesmo valor das casas).
  if (solo) {
    const perfil = Object.hasOwn(PERFIS_BOT, dados.get('bot')) ? dados.get('bot') : 'medio';
    jogadores.push({ nome: `Rival ${PERFIS_BOT[perfil].nome}`, nivel: jogadores[0].nivel, bot: perfil });
  }
  const seedEscolhida = Number(dados.get('seed'));
  estado = novoJogo({
    jogadores,
    turnos: lerInteiro(dados.get('turnos')),
    dinheiroInicial: lerInteiro(dados.get('dinheiro')),
    reputacaoInicial: lerInteiro(dados.get('reputacao')),
    progressao: String(dados.get('progressao')),
    modo: dados.get('modo') === 'cooperativo' ? 'cooperativo' : 'competitivo',
    seed: Number.isInteger(seedEscolhida) && seedEscolhida >= 1 && seedEscolhida <= QTD_SEMENTES ? seedEscolhida : Math.floor(Math.random() * 2 ** 32),
    teste: lerTeste(dados),
  });
  salvar(estado);
  render({ focar: true });
}

// Gira os dados e, ao fim, fixa as faces no resultado real (que já foi sorteado),
// mostrando a soma por um instante antes de o peão andar.
function girarDados(giro, [d1, d2], total) {
  return new Promise((resolve) => {
    const dados = giro.querySelectorAll('.dado');
    let tiques = 0;
    const intervalo = setInterval(() => {
      tiques += 1;
      if (tiques >= 6) {
        clearInterval(intervalo);
        dados[0].dataset.face = String(d1);
        dados[1].dataset.face = String(d2);
        dados.forEach((d) => d.classList.remove('dado-girando'));
        giro.querySelector('.dado-total').textContent = `= ${total}`;
        giro.setAttribute('aria-label', `Dados: ${d1} e ${d2}, total ${total}`);
        setTimeout(resolve, 700);
        return;
      }
      dados.forEach((d) => { d.dataset.face = String(1 + Math.floor(Math.random() * 6)); });
    }, 90);
  });
}

// Salta o peão do jogador casa a casa, da posição antiga até a nova (puramente cosmético).
function andarPeao(jogador, posicaoInicial, passos) {
  return new Promise((resolve) => {
    const tabuleiroEl = app.querySelector('.tabuleiro');
    if (!tabuleiroEl || semMovimento() || passos <= 0) {
      resolve(null);
      return;
    }
    app.querySelectorAll(`.peao.p${jogador.id}`).forEach((p) => { p.style.visibility = 'hidden'; });
    const letra = jogador.nome.trim().charAt(0).toUpperCase() || '?';
    const fantasma = document.createElement('span');
    fantasma.className = `peao p${jogador.id}`;
    fantasma.title = jogador.nome;
    fantasma.textContent = letra;
    tabuleiroEl.appendChild(fantasma);

    let passo = 0;
    const passar = () => {
      const indice = (posicaoInicial + passo) % NUM_CASAS;
      fantasma.style.cssText = posicaoCss(indice);
      fantasma.classList.remove('peao-fantasma');
      void fantasma.offsetWidth; // reflow para reiniciar a animação de salto
      fantasma.classList.add('peao-fantasma');
      passo += 1;
      if (passo <= passos) {
        setTimeout(passar, 160);
      } else {
        setTimeout(() => { fantasma.remove(); resolve(null); }, 160);
      }
    };
    passar();
  });
}

async function rolarComAnimacao(botao, acao) {
  botao.disabled = true;
  const anterior = estado;
  const jogador = anterior.jogadores[anterior.jogadorAtual];
  const posicaoInicial = jogador.posicao;
  // O resultado já é sorteado aqui (determinístico pela seed); a animação só o revela aos poucos.
  const novo = reduzir(anterior, { tipo: acao });
  if (novo === anterior) {
    botao.disabled = false;
    return;
  }
  const centro = app.querySelector('.centro');
  if (!centro || semMovimento()) {
    aplicarEstado(novo);
    return;
  }
  const giro = document.createElement('div');
  giro.className = 'dados-par';
  giro.innerHTML = `${dadoHtml(1)}${dadoHtml(1)}<span class="dado-total"></span>`;
  giro.querySelectorAll('.dado').forEach((d) => d.classList.add('dado-girando'));
  centro.appendChild(giro);

  await girarDados(giro, novo.dados, novo.dado);
  giro.remove();
  await andarPeao(jogador, posicaoInicial, novo.dado);
  aplicarEstado(novo);
}

// Copia a tabela do cenário em texto separado por tabulação, que o Excel cola em colunas.
async function copiarTabela(botao) {
  const c = estado?.cenarioAtual;
  if (!c) return;
  const texto = tabelaTsv(obterCenario(c.id), c);
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement('textarea'); // sem permissão da API: método antigo
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  const aviso = botao.parentElement.querySelector('[data-copiado]');
  aviso.hidden = false;
  setTimeout(() => { aviso.hidden = true; }, 2500);
}

async function copiarTexto(texto, avisoEl) {
  if (!texto) return;
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  if (avisoEl) {
    avisoEl.hidden = false;
    setTimeout(() => { avisoEl.hidden = true; }, 2500);
  }
}

let canalSinalizacaoCache = null;
async function obterCanalSinalizacao() {
  if (canalSinalizacaoCache) return canalSinalizacaoCache;
  const tipo = await detectarTipoSinalizacao();
  canalSinalizacaoCache = criarCanalSinalizacao({ tipo });
  return canalSinalizacaoCache;
}

async function conectarComCodigoSala(codigoSala, nome) {
  encerrarSessaoRede();
  estadoUiMulti = {
    tela: 'entrar',
    nome,
    codigoSala,
    conectando: true,
    progresso: 'Preparando conexão...',
    tempoDecorrido: 0,
    erro: null,
  };
  render();

  const inicioConexao = Date.now();
  const timerDiag = setInterval(() => {
    if (estadoUiMulti?.tela === 'entrar') {
      estadoUiMulti.tempoDecorrido = Math.floor((Date.now() - inicioConexao) / 1000);
      render();
    }
  }, 1000);

  try {
    const canal = await obterCanalSinalizacao();
    const { transporte } = await conectarNaSala({
      codigoSala,
      nome,
      canalSinal: canal,
      aoProgresso: (etapa) => {
        if (estadoUiMulti) {
          const msgs = {
            criando_oferta: 'Gerando credenciais de rede...',
            aguardando_anfitriao: `Aguardando sala "${codigoSala}" responder...`,
            conectando_webrtc: 'Conectando ao anfitrião...',
          };
          estadoUiMulti.progresso = msgs[etapa] || 'Conectando...';
          render();
        }
      },
    });

    clearInterval(timerDiag);

    const convidado = criarConvidado({
      transporte,
      aoMudar: (visao) => {
        if (visao.encerrada) {
          const msg = visao.motivo === 'dono' ? 'A sala foi encerrada pelo anfitrião.' : 'A conexão com o anfitrião foi perdida.';
          encerrarSessaoRede();
          estado = null;
          estadoUiMulti = { tela: 'escolha', erro: msg };
          render();
          return;
        }
        if (visao.estado) {
          estado = visao.estado;
          estadoUiMulti = null;
        } else {
          estado = null;
          estadoUiMulti = {
            tela: 'lobby_convidado',
            visaoConvidado: visao,
            tipoTransporte: sessaoRede?.transporte?.tipoTransporte?.() ?? null,
          };
        }
        render();
      },
    });

    const tickTimer = setInterval(() => convidado.tick(), 2000);
    sessaoRede = { tipo: 'convidado', instancia: convidado, tickTimer, transporte };
    estadoUiMulti = {
      tela: 'lobby_convidado',
      visaoConvidado: convidado.visao(),
      tipoTransporte: transporte.tipoTransporte?.() ?? null,
    };
    render();
  } catch (err) {
    clearInterval(timerDiag);
    estadoUiMulti = {
      tela: 'entrar',
      nome,
      codigoSala,
      conectando: false,
      erro: err.message || 'Falha ao conectar à sala.',
    };
    render();
  }
}

async function gerarPedidoConvidado(nome) {
  try {
    const { codigo, transporte, aplicarResposta } = await criarPedido(nome);
    sessaoRede = {
      tipo: 'convidado_pendente',
      pedidoPendente: { codigo, transporte, aplicarResposta, nome },
      timerDiag: null,
    };
    estadoUiMulti = {
      tela: 'entrar_passo2',
      codigoPedido: codigo,
      codigoResposta: '',
      conectando: false,
      tempoDecorrido: 0,
      erro: null,
    };
    render();
  } catch (err) {
    estadoUiMulti.erro = `Não foi possível gerar código de pedido: ${err.message}`;
    render();
  }
}

async function conectarRespostaConvidado(codigoResposta) {
  if (!sessaoRede?.pedidoPendente) return;
  const { transporte, aplicarResposta } = sessaoRede.pedidoPendente;
  estadoUiMulti.conectando = true;
  estadoUiMulti.codigoResposta = codigoResposta;
  estadoUiMulti.tempoDecorrido = 0;
  estadoUiMulti.erro = null;
  render();

  const inicioConexao = Date.now();
  const timerDiag = setInterval(() => {
    if (estadoUiMulti?.tela === 'entrar_passo2') {
      estadoUiMulti.tempoDecorrido = Math.floor((Date.now() - inicioConexao) / 1000);
      render();
    }
  }, 1000);
  sessaoRede.timerDiag = timerDiag;

  try {
    await aplicarResposta(codigoResposta);
    const convidado = criarConvidado({
      transporte,
      aoMudar: (visao) => {
        if (visao.encerrada) {
          const msg = visao.motivo === 'dono' ? 'A sala foi encerrada pelo anfitrião.' : 'A conexão com o anfitrião foi perdida.';
          encerrarSessaoRede();
          estado = null;
          estadoUiMulti = { tela: 'escolha', erro: msg };
          render();
          return;
        }
        if (visao.estado) {
          estado = visao.estado;
          estadoUiMulti = null;
        } else {
          estado = null;
          estadoUiMulti = { tela: 'lobby_convidado', visaoConvidado: visao };
        }
        render();
      },
    });
    clearInterval(timerDiag);
    const tickTimer = setInterval(() => convidado.tick(), 2000);
    sessaoRede = { tipo: 'convidado', instancia: convidado, tickTimer };
    estadoUiMulti = { tela: 'lobby_convidado', visaoConvidado: convidado.visao() };
    render();
  } catch (err) {
    clearInterval(timerDiag);
    estadoUiMulti.conectando = false;
    estadoUiMulti.codigoResposta = codigoResposta;
    estadoUiMulti.erro = err.message || 'Código de resposta inválido.';
    render();
  }
}

async function aceitarPedidoHost(codigoPedido) {
  if (sessaoRede?.tipo !== 'anfitriao') return;
  try {
    const { nome, codigoResposta, transporte } = await responderPedido(codigoPedido);
    const id = sessaoRede.instancia.receberPedido({ nome, transporte });
    if (id === null) {
      estadoUiMulti.erro = 'A sala já está cheia ou não pode receber mais participantes.';
      render();
      return;
    }
    sessaoRede.respostaGerada = { codigo: codigoResposta, nome };
    estadoUiMulti.respostaGerada = sessaoRede.respostaGerada;
    estadoUiMulti.erro = null;
    render();
  } catch (err) {
    estadoUiMulti.erro = err.message || 'Código de pedido inválido.';
    render();
  }
}

function atualizarPerfilDonoPelaUi(elemento) {
  if (sessaoRede?.tipo !== 'anfitriao') return;
  const container = elemento.closest('.modal-multi') || elemento.closest('.painel');
  if (!container) return;
  const nome = container.querySelector('[name="dono_nome"]')?.value;
  const nivel = container.querySelector('[name="dono_nivel"]:checked')?.value;
  const diretoria = container.querySelector('[name="dono_diretoria"]:checked')?.value;
  sessaoRede.instancia.definirPerfilDono({ nome, nivel, diretoria });
}

function atualizarConfigSalaPelaUi(elemento) {
  if (sessaoRede?.tipo !== 'anfitriao') return;
  const container = elemento.closest('.modal-multi') || elemento.closest('.painel');
  if (!container) return;
  const modo = container.querySelector('[name="config_modo"]:checked')?.value;
  const vagas = Number(container.querySelector('[name="config_vagas"]:checked')?.value ?? 2);
  const turnos = Number(container.querySelector('[name="config_turnos"]:checked')?.value ?? 5);
  const progressao = container.querySelector('[name="config_progressao"]:checked')?.value ?? 'tradicional';
  sessaoRede.instancia.definirConfig({ vagas, config: { modo, turnos, progressao } });
}

function atualizarPerfilConvidadoPelaUi(elemento) {
  if (sessaoRede?.tipo !== 'convidado') return;
  const container = elemento.closest('.modal-multi') || elemento.closest('.painel');
  if (!container) return;
  const nome = container.querySelector('[name="convidado_nome"]')?.value;
  const nivel = container.querySelector('[name="convidado_nivel"]:checked')?.value;
  const diretoria = container.querySelector('[name="convidado_diretoria"]:checked')?.value;
  sessaoRede.instancia.perfil({ nome, nivel, diretoria });
}

app.addEventListener('click', (ev) => {
  const botao = ev.target.closest('[data-acao]');
  if (!botao) return;
  const { acao, valor } = botao.dataset;
  if (acao === 'ROLAR') {
    if (sessaoRede) {
      despachar({ tipo: 'ROLAR' });
    } else {
      rolarComAnimacao(botao, acao);
    }
  } else if (acao === 'NOVA') {
    if (estado && estado.fase !== 'FIM_DE_JOGO' && !confirm('Abandonar a partida atual?')) return;
    limpar();
    estado = null;
    render();
  } else if (acao === 'ABRIR_CONFIG') {
    abrirAssistente();
  } else if (acao === 'COPIAR_TABELA') {
    copiarTabela(botao);
  } else if (acao === 'IMPRIMIR') {
    window.print();
  } else if (acao === 'CONTINUAR_SALVA') {
    estado = carregar();
    render({ focar: true });
  } else if (acao === 'ABRIR_MULTIPLAYER') {
    estadoUiMulti = { tela: 'escolha' };
    render();
  } else if (acao === 'FECHAR_MODAL_MULTI') {
    estadoUiMulti = null;
    render();
  } else if (acao === 'VOLTAR_ESCOLHA_MULTI') {
    encerrarSessaoRede();
    estadoUiMulti = { tela: 'escolha' };
    render();
  } else if (acao === 'ABRIR_CRIAR_SALA') {
    encerrarSessaoRede();
    const codigoSala = gerarCodigoSala();
    const host = criarAnfitriao({
      nomeDono: 'Jogador 1',
      vagas: 2,
      aoMudar: (visao) => {
        if (visao.encerrada) {
          encerrarSessaoRede();
          estadoUiMulti = null;
          render();
          return;
        }
        if (visao.estado) {
          estado = visao.estado;
          estadoUiMulti = null;
        } else {
          estado = null;
          const tipoTransporte = sessaoRede?.transportes?.some((t) => t.tipoTransporte?.() === 'servidor')
            ? 'servidor'
            : (sessaoRede?.transportes?.length ? 'p2p' : null);
          estadoUiMulti = {
            tela: 'lobby_dono',
            visaoHost: visao,
            codigoSala: sessaoRede?.codigoSala ?? codigoSala,
            respostaGerada: sessaoRede?.respostaGerada ?? null,
            tipoTransporte,
          };
        }
        render();
      },
    });
    const tickTimer = setInterval(() => host.tick(), 2000);
    const transportes = [];
    sessaoRede = { tipo: 'anfitriao', instancia: host, tickTimer, respostaGerada: null, codigoSala, sinalizador: null, transportes };
    estadoUiMulti = { tela: 'lobby_dono', visaoHost: host.visao(), codigoSala, respostaGerada: null, tipoTransporte: null };
    render();

    obterCanalSinalizacao().then((canal) => {
      if (sessaoRede?.tipo === 'anfitriao' && sessaoRede.codigoSala === codigoSala) {
        sessaoRede.sinalizador = anunciarSala({
          codigoSala,
          canalSinal: canal,
          aoConectar: ({ nome, transporte }) => {
            sessaoRede?.transportes?.push(transporte);
            sessaoRede?.instancia?.receberPedido({ nome, transporte });
          },
        });
      }
    }).catch(() => {});
  } else if (acao === 'ABRIR_ENTRAR_SALA') {
    encerrarSessaoRede();
    estadoUiMulti = { tela: 'entrar', nome: 'Jogador 2', codigoSala: '' };
    render();
  } else if (acao === 'ABRIR_ENTRAR_MANUAL') {
    estadoUiMulti = { tela: 'entrar_passo1', nome: estadoUiMulti?.nome || 'Jogador 2' };
    render();
  } else if (acao === 'COPIAR_CODIGO_SALA') {
    const el = app.querySelector('[data-alvo="codigo-sala"]');
    const aviso = app.querySelector('[data-copiado="sala"]');
    if (el) copiarTexto(el.textContent.trim(), aviso);
  } else if (acao === 'COPIAR_CODIGO_PEDIDO') {
    const el = app.querySelector('textarea[data-alvo="pedido"]');
    const aviso = app.querySelector('[data-copiado="pedido"]');
    if (el) copiarTexto(el.value, aviso);
  } else if (acao === 'COPIAR_RESPOSTA') {
    const el = app.querySelector('textarea[data-alvo="resposta"]');
    const aviso = app.querySelector('[data-copiado="resposta"]');
    if (el) copiarTexto(el.value, aviso);
  } else if (acao === 'REMOVER_CONVIDADO') {
    sessaoRede?.instancia?.removerConvidado(botao.dataset.chave);
  } else if (acao === 'INICIAR_SALA') {
    const r = sessaoRede?.instancia?.iniciar();
    if (r && !r.ok) {
      estadoUiMulti.erro = r.erro;
      render();
    }
  } else if (acao === 'ENCERRAR_SALA' || acao === 'SAIR_SALA') {
    encerrarSessaoRede();
    estado = null;
    estadoUiMulti = null;
    render();
  } else if (acao === 'REVANCHE') {
    sessaoRede?.instancia?.revanche();
  } else {
    despachar({ tipo: acao, valor });
  }
});

// Assistente da tela inicial: história, contexto e configuração, uma etapa por vez (Anterior / Próximo).
let etapaMenu = 0;

// As etapas dos jogadores que não existem na partida (data-pula) ficam fora da sequência.
const etapasVisiveis = (form) => [...form.querySelectorAll('[data-etapa]')].filter((el) => !('pula' in el.dataset));

function mostrarEtapa(n) {
  const form = document.getElementById('form-menu');
  form.querySelectorAll('[data-etapa]').forEach((el) => { el.hidden = true; });
  const etapas = etapasVisiveis(form);
  etapaMenu = Math.max(0, Math.min(n, etapas.length - 1));
  etapas[etapaMenu].hidden = false;
  const ultima = etapaMenu === etapas.length - 1;
  form.querySelector('[data-nav="anterior"]').hidden = etapaMenu === 0;
  form.querySelector('[data-nav="proximo"]').hidden = ultima;
  form.querySelector('[data-nav="iniciar"]').hidden = !ultima;
  form.querySelector('[data-passo]').textContent = `${etapaMenu + 1} de ${etapas.length}`;
  form.scrollTop = 0;
  form.querySelector('.etapas').scrollTop = 0;
}

function abrirAssistente() {
  document.getElementById('modal-menu').hidden = false;
  ajustarCamposSetor(document.getElementById('form-menu'));
  mostrarEtapa(0);
  document.getElementById('form-menu').focus({ preventScroll: true });
}

function avancarEtapa(form) {
  const etapa = etapasVisiveis(form)[etapaMenu];
  const campos = [...etapa.querySelectorAll('input, select')].filter((c) => !c.closest('[hidden]'));
  const invalido = campos.find((c) => !c.checkValidity());
  if (invalido) return invalido.reportValidity();
  mostrarEtapa(etapaMenu + 1);
}

app.addEventListener('click', (ev) => {
  const nav = ev.target.closest('[data-nav]')?.dataset.nav;
  if (nav === 'anterior') mostrarEtapa(etapaMenu - 1);
  else if (nav === 'proximo') avancarEtapa(document.getElementById('form-menu'));
});

app.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !document.getElementById('modal-menu')?.hidden) document.getElementById('modal-menu').hidden = true;
});

app.addEventListener('submit', (ev) => {
  if (ev.target.id === 'form-menu') {
    ev.preventDefault();
    const form = ev.target;
    if (etapaMenu < etapasVisiveis(form).length - 1) avancarEtapa(form);
    else iniciar(form);
  } else if (ev.target.dataset.form === 'calculadora') {
    ev.preventDefault();
    calcularNaCalculadora(ev.target);
  } else if (ev.target.dataset.form === 'valor') {
    ev.preventDefault();
    informarValor(ev.target);
  } else if (ev.target.dataset.form === 'multi-entrar-codigo') {
    ev.preventDefault();
    const nome = String(ev.target.elements.nome_convidado?.value || '').trim() || 'Jogador 2';
    const codigoSala = String(ev.target.elements.codigo_sala?.value || '').trim().toUpperCase();
    conectarComCodigoSala(codigoSala, nome);
  } else if (ev.target.dataset.form === 'multi-pedido') {
    ev.preventDefault();
    const nome = String(ev.target.elements.nome_convidado?.value || '').trim() || 'Jogador';
    gerarPedidoConvidado(nome);
  } else if (ev.target.dataset.form === 'multi-resposta') {
    ev.preventDefault();
    const resposta = String(ev.target.elements.codigo_resposta?.value || '').trim();
    conectarRespostaConvidado(resposta);
  } else if (ev.target.dataset.form === 'host-aceitar-pedido') {
    ev.preventDefault();
    const pedido = String(ev.target.elements.codigo_pedido?.value || '').trim();
    aceitarPedidoHost(pedido);
  }
});

// Calculadora embutida: opera sobre os dados do cenário e mostra o resultado; não mexe no estado da partida.
function calcularNaCalculadora(form) {
  const c = estado?.cenarioAtual;
  const saida = form.querySelector('[data-resultado]');
  if (!c) return;
  const p = lerNumero(form.elements.p.value);
  const r = calcularOperacao(c.series[0].valores, form.elements.operacao.value, p);
  const rotulo = form.elements.operacao.selectedOptions[0].textContent;
  if (r === null) {
    saida.textContent = 'Não foi possível calcular: confira o P (0 a 100).';
    return;
  }
  const texto = formatarResultadoCalculadora(r);
  saida.textContent = `${rotulo}: ${texto}`;
  // O resultado vai direto para o campo do valor (sem confirmar); a pessoa ainda pode ajustá-lo e envia o formulário.
  const campo = document.querySelector('form[data-form="valor"] input[name="valor"]');
  if (campo) {
    campo.value = texto;
    campo.removeAttribute('aria-invalid');
    const erro = campo.form.querySelector('.erro-campo');
    if (erro) erro.hidden = true;
  }
}

// Valor calculado de um cenário de cálculo: texto livre em pt-BR; se não for número, avisa e não avança.
function informarValor(form) {
  const campo = form.elements.valor;
  const valor = lerNumero(campo.value);
  const erro = form.querySelector('.erro-campo');
  if (Number.isNaN(valor)) {
    erro.hidden = false;
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
    return;
  }
  despachar({ tipo: 'VALOR', valor });
}

// No cooperativo com 2 jogadores só o primeiro escolhe o setor (o segundo fica com os demais) e com 1 acumula todos.
function ajustarCamposSetor(form) {
  const modo = form.elements.modo.value;
  const n = modo === 'solo' ? 1 : Number(form.elements.n.value);
  const coop = modo === 'cooperativo';
  form.querySelectorAll('fieldset[data-jogador]').forEach((f) => {
    const i = Number(f.dataset.jogador);
    if (i >= n) f.dataset.pula = ''; else delete f.dataset.pula;
    f.querySelector('[data-campo="diretoria"]').hidden = !coop || n === 1 || (n === 2 && i === 1);
    f.querySelector('[data-campo="diretoria-resto"]').hidden = !coop || n !== 2 || i !== 1;
  });
  form.querySelector('[data-erro-setor]').hidden = true;
}

// No solo só a pessoa preenche o cadastro; o número de CEOs dá lugar à escolha do rival.
app.addEventListener('change', (ev) => {
  if (ev.target.name === 'operacao') {
    const form = ev.target.form;
    form.querySelector('[data-campo="p"]').hidden = !ev.target.selectedOptions[0].hasAttribute('data-pede-p');
    form.querySelector('[data-resultado]').textContent = '';
    return;
  }
  const alvo = ev.target.dataset.alvo;
  if (alvo) {
    ev.target.form.elements[alvo].value = ev.target.value;
    return;
  }
  const nome = ev.target.name;
  if (nome?.startsWith('diretoria_')) {
    ev.target.form.querySelector('[data-erro-setor]').hidden = true;
    return;
  }
  if (ev.target.dataset.altera === 'perfil_dono') {
    atualizarPerfilDonoPelaUi(ev.target);
    return;
  }
  if (ev.target.dataset.altera === 'config_sala') {
    atualizarConfigSalaPelaUi(ev.target);
    return;
  }
  if (ev.target.dataset.altera === 'perfil_convidado') {
    atualizarPerfilConvidadoPelaUi(ev.target);
    return;
  }
  if (nome !== 'n' && nome !== 'modo') return;
  const form = ev.target.form;
  const solo = form.elements.modo.value === 'solo';
  form.querySelector('[data-campo="n"]').hidden = solo;
  form.querySelector('[data-campo="bot"]').hidden = !solo;
  ajustarCamposSetor(form);
});

// Digitar um valor próprio marca o cartão de mesmo valor (ou nenhum).
app.addEventListener('input', (ev) => {
  const campo = ev.target;
  if (campo.name === 'codigo_sala') {
    campo.value = campo.value.toUpperCase();
    return;
  }
  if (campo.type !== 'number' || !campo.form?.querySelector(`[data-alvo="${campo.name}"]`)) return;
  campo.form.querySelectorAll(`[data-alvo="${campo.name}"]`).forEach((r) => { r.checked = r.value === campo.value; });
});

window.addEventListener('beforeunload', (ev) => {
  if (sessaoRede) {
    ev.preventDefault();
    ev.returnValue = '';
  }
});

render();
