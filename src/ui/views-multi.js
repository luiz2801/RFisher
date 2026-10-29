// Telas e componentes do modo multiplayer em rede local (docs/adr/0008).
// Utiliza HTML puro com escape centralizado em esc (src/ui/html.js) e QR Code SVG puro.

import { esc } from './html.js';
import { DIRETORIAS } from '../engine/papeis.js';
import { opcoes } from './views.js';
import { VAGAS_MIN, VAGAS_MAX, validarInicio } from '../net/sala.js';
import {
  TURNOS_PADRAO, TURNOS_MIN, TURNOS_MAX,
  DINHEIRO_INICIAL, DINHEIRO_INICIAL_MIN, DINHEIRO_INICIAL_MAX, DINHEIRO_INICIAL_PASSO,
  REPUTACAO_INICIAL, REPUTACAO_INICIAL_MIN, REPUTACAO_INICIAL_MAX, REPUTACAO_INICIAL_PASSO,
  PROGRESSOES, PROGRESSAO_PADRAO,
} from '../engine/config.js';
import { qrCodeSvg } from './components/qrcode.js';

const DESCRICAO_PROGRESSAO = {
  facil: 'Cenários fáceis duram mais; subida lenta.',
  tradicional: 'Equilibrada: fácil no início, difícil no fim.',
  dificil: 'Subida acelerada: cenários difíceis aparecem cedo.',
};

export function viewModalMultiplayer(estadoUi = {}) {
  const { tela = 'escolha', erro = null, aviso = null } = estadoUi;
  let conteudo = '';
  if (tela === 'escolha') {
    conteudo = viewEscolhaMulti();
  } else if (tela === 'entrar_passo1') {
    conteudo = viewEntrarPasso1(estadoUi);
  } else if (tela === 'entrar_passo2') {
    conteudo = viewEntrarPasso2(estadoUi);
  } else if (tela === 'entrar_confirmacao') {
    conteudo = viewEntrarConfirmacao(estadoUi);
  } else if (tela === 'lobby_dono') {
    conteudo = viewLobbyDono(estadoUi);
  } else if (tela === 'lobby_convidado') {
    conteudo = viewLobbyConvidado(estadoUi);
  }

  const msgErro = erro ? `<p class="alerta" role="alert">${esc(erro)}</p>` : '';
  const msgAviso = aviso ? `<p class="aviso" role="status">${esc(aviso)}</p>` : '';

  return `<div class="modal" id="modal-multiplayer" role="dialog" aria-modal="true" aria-label="Multiplayer local" tabindex="-1">
    <div class="painel modal-multi">
      ${msgErro}${msgAviso}${conteudo}
    </div>
  </div>`;
}

function viewEscolhaMulti() {
  return `<header class="topo-multi">
      <h2>🌐 Multiplayer em Rede Local (LAN)</h2>
      <p class="sub">Jogue com 2 ou 3 pessoas na mesma rede Wi-Fi, sem necessidade de servidores externos.</p>
    </header>
    <div class="opcoes-multi-inicio">
      <div class="cartao">
        <h3>Criar uma sala</h3>
        <p>Você será o anfitrião, definirá as regras da partida e gerará o QR Code e link de convite.</p>
        <button class="primario" data-acao="ABRIR_CRIAR_SALA">Criar sala →</button>
      </div>
      <div class="cartao">
        <h3>Entrar em uma sala</h3>
        <p>Conecte-se à sala lendo o QR Code do anfitrião com a câmera ou colando o link/código.</p>
        <button class="secundario" data-acao="ABRIR_ENTRAR_SALA">Entrar em uma sala →</button>
      </div>
    </div>
    <div class="nav-menu">
      <button type="button" class="discreto" data-acao="FECHAR_MODAL_MULTI">Fechar</button>
    </div>`;
}

function viewEntrarPasso1({ nome = '', codigoConvite = '', cameraAtiva = false, cameraErro = null } = {}) {
  return `<header class="topo-multi">
      <h2>Entrar em uma sala (Passo 1 de 2)</h2>
      <p class="sub">Identifique-se como CEO e use a câmera ou cole o convite do anfitrião.</p>
    </header>
    <form data-form="multi-pedido">
      <label class="campo-nome">Nome do(a) CEO:
        <input name="nome_convidado" value="${esc(nome || 'Jogador')}" maxlength="20" required autofocus>
      </label>

      ${
        cameraAtiva
          ? `<div class="camera-container" id="camera-box">
              <video id="camera-preview" autoplay playsinline muted></video>
              <div class="camera-mira"></div>
              <p class="ajuda">Aponte a câmera para o QR Code da sala na tela do anfitrião</p>
              <button type="button" class="discreto" data-acao="FECHAR_CAMERA">Fechar câmera</button>
            </div>`
          : `<div class="area-camera-botao">
              <button type="button" class="secundario cta-camera" data-acao="ABRIR_CAMERA" data-alvo="convidado">📷 Ler QR Code do anfitrião</button>
            </div>`
      }
      ${cameraErro ? `<p class="alerta camera-alerta">${esc(cameraErro)}</p>` : ''}

      <label class="campo-convite">Ou cole o link/código do anfitrião:
        <textarea class="caixa-codigo" name="codigo_convite" rows="3" placeholder="Cole aqui o link ou código CEO1P... do anfitrião">${esc(codigoConvite)}</textarea>
      </label>
      <div class="botoes-auxiliares">
        <button type="button" class="discreto" data-acao="COLAR_CLIPBOARD" data-destino="codigo_convite">📋 Colar da área de transferência</button>
      </div>

      <div class="nav-menu">
        <button type="button" class="discreto" data-acao="VOLTAR_ESCOLHA_MULTI">← Voltar</button>
        <button type="submit" class="primario" data-acao="GERAR_PEDIDO">Gerar código de pedido →</button>
      </div>
    </form>`;
}

function viewEntrarConfirmacao({ nome = '', confirmacaoAtiva = null, tempoDecorrido = 0 } = {}) {
  const alertaDiagnostico = tempoDecorrido >= 15
    ? `<div class="alerta">
        <strong>⚠️ A conexão está demorando.</strong>
        <p>Certifique-se de que ambos os dispositivos estejam conectados na <strong>mesma rede local</strong> (mesmo Wi-Fi), sem isolamento de clientes.</p>
      </div>`
    : '';

  const qr = confirmacaoAtiva?.link
    ? qrCodeSvg(confirmacaoAtiva.link, { rotulo: 'QR Code de confirmação do convidado' })
    : '';

  return `<header class="topo-multi">
      <h2>Quase lá, ${esc(nome)}!</h2>
      <p class="sub">Mostre sua confirmação ao anfitrião para entrar na sala.</p>
    </header>
    <div class="painel-confirmacao">
      <div class="qrcode-wrapper-grande">
        ${qr}
      </div>
      <p class="ajuda-destaque"><strong>Mostre este QR Code para o anfitrião ler com a câmera dele</strong>, ou compartilhe o link de confirmação:</p>
      
      <div class="acoes-compartilhar">
        <button type="button" class="primario" data-acao="COPIAR_LINK_CONFIRMACAO" data-link="${esc(confirmacaoAtiva?.link ?? '')}">🔗 Copiar link de confirmação</button>
        <button type="button" class="secundario" data-acao="COMPARTILHAR_CONFIRMACAO" data-link="${esc(confirmacaoAtiva?.link ?? '')}">📤 Compartilhar link</button>
      </div>
      <span role="status" class="ajuda" data-copiado="link-confirmacao" hidden>Link copiado!</span>

      <div class="status-espera-destaque">
        <p class="ajuda">⏳ Aguardando o anfitrião confirmar a sua entrada...</p>
        <small>Você entrará na sala automaticamente assim que ele ler este QR Code ou acessar o link.</small>
      </div>

      ${alertaDiagnostico}

      <details class="detalhes-codigo">
        <summary>Ver código em texto puro</summary>
        <textarea class="caixa-codigo" readonly rows="3" data-alvo="resposta">${esc(confirmacaoAtiva?.codigo ?? '')}</textarea>
        <button type="button" class="discreto" data-acao="COPIAR_RESPOSTA">📋 Copiar código</button>
      </details>
    </div>

    <div class="nav-menu">
      <button type="button" class="discreto" data-acao="VOLTAR_ESCOLHA_MULTI">Cancelar</button>
    </div>`;
}

function viewEntrarPasso2({ codigoPedido = '', conectando = false, tempoDecorrido = 0 } = {}) {
  const alertaDiagnostico = tempoDecorrido >= 15
    ? `<div class="alerta">
        <strong>⚠️ A conexão está demorando.</strong>
        <p>Certifique-se de que ambos os dispositivos estejam conectados na <strong>mesma rede local</strong> (mesmo Wi-Fi), sem isolamento de clientes.</p>
      </div>`
    : '';

  return `<header class="topo-multi">
      <h2>Entrar em uma sala (Passo 2 de 2)</h2>
      <p class="sub">Troque os códigos de conexão com o anfitrião da sala.</p>
    </header>
    <div class="passo-codigo">
      <label><strong>1. Seu código de pedido:</strong>
        <small class="ajuda">Copie este código e envie ao anfitrião da sala (via WhatsApp, chat ou e-mail):</small>
        <textarea class="caixa-codigo" readonly rows="4" data-alvo="pedido">${esc(codigoPedido)}</textarea>
      </label>
      <button type="button" class="discreto" data-acao="COPIAR_CODIGO_PEDIDO">📋 Copiar código de pedido</button>
      <span role="status" class="ajuda" data-copiado="pedido" hidden>Copiado para a área de transferência!</span>
    </div>

    <form data-form="multi-resposta" class="passo-codigo">
      <label><strong>2. Código de resposta do anfitrião:</strong>
        <small class="ajuda">Cole abaixo o código de resposta que o anfitrião lhe enviou:</small>
        <textarea class="caixa-codigo" name="codigo_resposta" rows="4" placeholder="Cole aqui o código CEO1R...." required></textarea>
      </label>
      ${alertaDiagnostico}
      <div class="nav-menu">
        <button type="button" class="discreto" data-acao="VOLTAR_ESCOLHA_MULTI" ${conectando ? 'disabled' : ''}>Cancelar</button>
        <button type="submit" class="primario" data-acao="CONECTAR_RESPOSTA" ${conectando ? 'disabled' : ''}>
          ${conectando ? 'Conectando...' : 'Conectar à sala →'}
        </button>
      </div>
    </form>`;
}

function viewLobbyDono({
  visaoHost,
  conviteAtivo = null,
  respostaGerada = null,
  cameraAtiva = false,
  cameraErro = null,
} = {}) {
  const sala = visaoHost?.sala;
  const config = sala?.config ?? {};
  const validacao = sala ? validarInicio(sala) : { ok: false, erro: '' };
  const setores = Object.entries(DIRETORIAS).map(([id, d]) => [id, d.nome, d.foco, d.icone]);
  const modoCoop = config.modo === 'cooperativo';

  const listaPessoas = (sala?.pessoas ?? []).map((p, i) => {
    const ehDono = p.chave === 'dono';
    const cargo = DIRETORIAS[p.diretoria]?.cargo ?? 'CEO';
    const acaoRemover = !ehDono
      ? `<button type="button" class="discreto btn-remover" data-acao="REMOVER_CONVIDADO" data-chave="${esc(p.chave)}" title="Remover convidado">✖</button>`
      : '<span class="selo-dono">👑 Anfitrião</span>';

    return `<li class="vaga-jogador">
      <div class="vaga-info">
        <strong>${i + 1}. ${esc(p.nome)}</strong>
        <small>${esc(cargo)} · Nível ${p.nivel === 'avancado' ? 'Avançado' : 'Iniciante'}</small>
      </div>
      <div class="vaga-acoes">${acaoRemover}</div>
    </li>`;
  }).join('');

  const vagasRestantes = sala ? sala.vagas - sala.pessoas.length : 0;
  
  let areaConectar = '<p class="ajuda">Sala cheia. Todos os participantes estão conectados.</p>';
  if (vagasRestantes > 0) {
    const qrSvg = conviteAtivo?.link
      ? qrCodeSvg(conviteAtivo.link, { rotulo: 'QR Code de convite para a sala' })
      : '';

    areaConectar = `<fieldset class="secao-config secao-convite-host">
      <legend>Conectar convidado (${vagasRestantes} vaga${vagasRestantes > 1 ? 's' : ''} livre${vagasRestantes > 1 ? 's' : ''})</legend>
      
      <div class="bloco-qrcode-convite">
        <div class="qrcode-wrapper">
          ${qrSvg}
        </div>
        <div class="convite-opcoes">
          <p class="ajuda-destaque"><strong>1. Convide seu amigo:</strong> Mostre este QR Code para ele escanear na câmera do celular, ou envie o link:</p>
          <div class="acoes-compartilhar">
            <button type="button" class="primario" data-acao="COPIAR_LINK_CONVITE" data-link="${esc(conviteAtivo?.link ?? '')}">🔗 Copiar link de convite</button>
            <button type="button" class="secundario" data-acao="COMPARTILHAR_CONVITE" data-link="${esc(conviteAtivo?.link ?? '')}">📤 Compartilhar link</button>
          </div>
          <span role="status" class="ajuda" data-copiado="link-convite" hidden>Link copiado!</span>

          <details class="detalhes-codigo">
            <summary>Ver código em texto</summary>
            <textarea class="caixa-codigo" readonly rows="2" data-alvo="pedido">${esc(conviteAtivo?.codigo ?? '')}</textarea>
            <button type="button" class="discreto" data-acao="COPIAR_CODIGO_PEDIDO">📋 Copiar código</button>
          </details>
        </div>
      </div>

      <hr class="divisor-convite">

      <div class="bloco-resposta-convidado">
        <p class="ajuda-destaque"><strong>2. Receber confirmação do convidado:</strong></p>
        ${
          cameraAtiva
            ? `<div class="camera-container" id="camera-box">
                <video id="camera-preview" autoplay playsinline muted></video>
                <div class="camera-mira"></div>
                <p class="ajuda">Aponte a câmera para o QR Code de confirmação na tela do convidado</p>
                <button type="button" class="discreto" data-acao="FECHAR_CAMERA">Fechar câmera</button>
              </div>`
            : `<div class="acoes-receber">
                <button type="button" class="secundario cta-camera" data-acao="ABRIR_CAMERA" data-alvo="host">📷 Ler QR Code do convidado</button>
              </div>`
        }
        ${cameraErro ? `<p class="alerta camera-alerta">${esc(cameraErro)}</p>` : ''}

        <form data-form="host-aceitar-pedido" class="form-confirmacao">
          <label>Ou cole o link/código de confirmação que o convidado enviou:
            <textarea class="caixa-codigo" name="codigo_pedido" rows="2" placeholder="Cole o link ou código CEO1R... aqui" required></textarea>
          </label>
          <div class="botoes-form-confirmacao">
            <button type="button" class="discreto" data-acao="COLAR_CLIPBOARD" data-destino="codigo_pedido">📋 Colar da área de transferência</button>
            <button type="submit" class="primario" data-acao="GERAR_RESPOSTA">Conectar convidado</button>
          </div>
        </form>

        ${
          respostaGerada
            ? `<div class="resposta-pronta">
                <label>Envie este código de resposta de volta para <strong>${esc(respostaGerada.nome)}</strong>:
                  <textarea class="caixa-codigo" readonly rows="3" data-alvo="resposta">${esc(respostaGerada.codigo)}</textarea>
                </label>
                <button type="button" class="discreto" data-acao="COPIAR_RESPOSTA">📋 Copiar código de resposta</button>
                <span role="status" class="ajuda" data-copiado="resposta" hidden>Copiado!</span>
              </div>`
            : ''
        }
      </div>
    </fieldset>`;
  }

  const dono = sala?.pessoas?.find((p) => p.chave === 'dono');

  return `<header class="topo-multi">
      <h2>Lobby da Sala (Anfitrião)</h2>
      <p class="sub">Configure a partida e aguarde a entrada dos outros jogadores.</p>
    </header>
    <div class="grade-lobby">
      <div class="painel-esquerdo">
        <fieldset class="secao-config">
          <legend>Seu Perfil (Anfitrião)</legend>
          <label class="campo-nome">Seu Nome:
            <input name="dono_nome" value="${esc(dono?.nome ?? 'Jogador 1')}" maxlength="20" data-altera="perfil_dono">
          </label>
          <div class="grupo-opcoes">
            <span class="rotulo-grupo">Perfil Executivo</span>
            ${opcoes('dono_nivel', [['iniciante', 'Iniciante', 'Com dicas', '🌱'], ['avancado', 'Avançado', '×1,5 pontos', '🔥']], dono?.nivel ?? 'iniciante', 'compacto', 'data-altera="perfil_dono"')}
          </div>
          <div class="grupo-opcoes">
            <span class="rotulo-grupo">Setor que representa</span>
            ${opcoes('dono_diretoria', setores, dono?.diretoria ?? setores[0][0], 'compacto', 'data-altera="perfil_dono"')}
          </div>
        </fieldset>

        <fieldset class="secao-config">
          <legend>Regras da Partida</legend>
          <div class="grupo-opcoes">
            <span class="rotulo-grupo">Modo</span>
            ${opcoes('config_modo', [['competitivo', 'Competitivo', '', '⚔️'], ['cooperativo', 'Cooperativo', '', '🤝']], config.modo ?? 'competitivo', 'compacto', 'data-altera="config_sala"')}
          </div>
          <div class="grupo-opcoes">
            <span class="rotulo-grupo">Vagas da sala</span>
            ${opcoes('config_vagas', [[2, '2 CEOs'], [3, '3 CEOs']], sala?.vagas ?? 2, 'compacto', 'data-altera="config_sala"')}
          </div>
          <div class="grupo-opcoes">
            <span class="rotulo-grupo">Trimestres (Duração)</span>
            ${opcoes('config_turnos', [[5, '5', '⚡'], [10, '10', '📅'], [20, '20', '📆']], config.turnos ?? TURNOS_PADRAO, 'compacto', 'data-altera="config_sala"')}
          </div>
          <div class="grupo-opcoes">
            <span class="rotulo-grupo">Dificuldade</span>
            ${opcoes('config_progressao', Object.entries(PROGRESSOES).map(([id, p]) => [id, p.nome, '', { facil: '🌱', tradicional: '⚖️', dificil: '🔥' }[id]]), config.progressao ?? PROGRESSAO_PADRAO, 'compacto', 'data-altera="config_sala"')}
          </div>
        </fieldset>
      </div>

      <div class="painel-direito">
        <fieldset class="secao-config">
          <legend>Participantes Conectados (${sala?.pessoas?.length ?? 1} de ${sala?.vagas ?? 2})</legend>
          <ul class="lista-vagas">${listaPessoas}</ul>
        </fieldset>
        ${areaConectar}
      </div>
    </div>

    ${!validacao.ok ? `<p class="alerta" role="alert">${esc(validacao.erro)}</p>` : ''}

    <div class="nav-menu">
      <button type="button" class="discreto" data-acao="ENCERRAR_SALA">Cancelar Sala</button>
      <button type="button" class="primario cta-grande" data-acao="INICIAR_SALA" ${!validacao.ok ? 'disabled' : ''}>Iniciar Partida →</button>
    </div>`;
}

function viewLobbyConvidado({ visaoConvidado } = {}) {
  const sala = visaoConvidado?.sala;
  const config = sala?.config ?? {};
  const voce = visaoConvidado?.voce;
  const eu = sala?.pessoas?.find((p) => p.chave === voce);
  const setores = Object.entries(DIRETORIAS).map(([id, d]) => [id, d.nome, d.foco, d.icone]);
  const dono = sala?.pessoas?.find((p) => p.chave === 'dono');

  const listaPessoas = (sala?.pessoas ?? []).map((p, i) => {
    const ehEu = p.chave === voce;
    const cargo = DIRETORIAS[p.diretoria]?.cargo ?? 'CEO';
    return `<li class="vaga-jogador ${ehEu ? 'sou-eu' : ''}">
      <div class="vaga-info">
        <strong>${i + 1}. ${esc(p.nome)}${ehEu ? ' (Você)' : ''}</strong>
        <small>${esc(cargo)} · Nível ${p.nivel === 'avancado' ? 'Avançado' : 'Iniciante'}</small>
      </div>
      ${p.chave === 'dono' ? '<span class="selo-dono">👑 Anfitrião</span>' : ''}
    </li>`;
  }).join('');

  return `<header class="topo-multi">
      <h2>Lobby da Sala (Convidado)</h2>
      <p class="sub">Conectado à sala de <strong>${esc(dono?.nome ?? 'Anfitrião')}</strong>. Personalize seu perfil enquanto aguarda o início.</p>
    </header>
    <div class="grade-lobby">
      <div class="painel-esquerdo">
        <fieldset class="secao-config">
          <legend>Seu Perfil de Jogador</legend>
          <label class="campo-nome">Seu Nome:
            <input name="convidado_nome" value="${esc(eu?.nome ?? 'Jogador')}" maxlength="20" data-altera="perfil_convidado">
          </label>
          <div class="grupo-opcoes">
            <span class="rotulo-grupo">Perfil Executivo</span>
            ${opcoes('convidado_nivel', [['iniciante', 'Iniciante', 'Com dicas', '🌱'], ['avancado', 'Avançado', '×1,5 pontos', '🔥']], eu?.nivel ?? 'iniciante', 'compacto', 'data-altera="perfil_convidado"')}
          </div>
          <div class="grupo-opcoes">
            <span class="rotulo-grupo">Setor que representa</span>
            ${opcoes('convidado_diretoria', setores, eu?.diretoria ?? setores[1][0], 'compacto', 'data-altera="perfil_convidado"')}
          </div>
        </fieldset>
      </div>

      <div class="painel-direito">
        <fieldset class="secao-config">
          <legend>Participantes na Sala (${sala?.pessoas?.length ?? 0} de ${sala?.vagas ?? 2})</legend>
          <ul class="lista-vagas">${listaPessoas}</ul>
        </fieldset>
        <div class="status-espera">
          <p class="ajuda">⏳ Aguardando o anfitrião iniciar a disputa corporativa...</p>
          <p class="ajuda">Modo: <strong>${config.modo === 'cooperativo' ? 'Cooperativo' : 'Competitivo'}</strong> · ${config.turnos ?? TURNOS_PADRAO} trimestres</p>
        </div>
      </div>
    </div>

    <div class="nav-menu">
      <button type="button" class="discreto" data-acao="SAIR_SALA">Sair da Sala</button>
    </div>`;
}
