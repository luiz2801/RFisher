# Histórico de implementações — Fisher SA

Linha do tempo do que foi desenvolvido, reconstruída a partir do histórico do git (de 21 a 23/10/2026) e do [README.md](README.md). Para o estado atual e as decisões de projeto, veja o README e o [fisher.md](fisher.md).

## 21/10/2026 — Fundação

- **Documentação inicial**: arquitetura e diagramas UML (`docs/diagramas-uml.md`).
- **Cenários**: primeiros cenários de decisão estatística com dados gerados por seed.
- **Modos de jogo**: competitivo e cooperativo.
- **Guia de conteúdo** para criação de cenários.
- **Desempenho, dificuldade, conceitos e testes**: perfil de desempenho por conceito, dificuldade crescente do baralho e a primeira suíte de testes.

## 22/10/2026 — Conteúdo, solo e cenários de cálculo

- **Animações**: rolagem de dois dados e caminhada do peão casa a casa.
- **Cenários 09 a 13**, eventos e formatos `cm`/`ms`.
- **Modo solo** contra rival controlado pelo computador (Estagiário(a), Analista, Sênior), calibrado por simulação (`scripts/simular-bot.mjs`).
- **Relatório de desempenho** no fim do jogo, com sugestões de estudo.
- **Deploy** no GitHub Pages via workflow.
- **Cenários de cálculo (14 a 18)**: tabela, valor com margem de tolerância e confiança; correção para que entrem no baralho de partidas salvas.
- **Botão de copiar a tabela** para o Excel.
- **Atalhos de teste** no menu (casa forçada e baralho restrito).
- **Calculadora de estatísticas embutida** (com IQR depois), mais novas questões.
- **Cenários 19 a 21** (coeficiente de variação, média aparada, paradoxo de Simpson).
- Correções: tamanho do campo da seed, tolerância de ponto flutuante no teste da calculadora, `{{` solto que quebrava o build do Jekyll.

## 23/10/2026 — Regras novas, Mercado e CI

### Interface
- Tabuleiro em tela cheia, botão **Jogar** no centro e pergunta sobreposta.
- Escolha do setor (diretoria) de cada jogador no menu.
- Reputação inicial escolhida no menu.
- Calculadora aberta por padrão, com aviso em destaque e campo P só no percentil.
- Menu de nova partida sem a opção de jogar só com questões conceituais.
- Sequência de erros e acertos exibida no placar e no resultado.

### Regras e motor
- **Falência no Balanço** e rounds e caixa inicial configuráveis (`fisher.md` 3.12).
- **Sequências de erros e acertos** (`fisher.md` 3.13, decisão nº 14).
- **Jogada extra** quando os dois dados saem iguais (`fisher.md` 3.2, decisão nº 15).
- **Investimentos no Mercado** (`fisher.md` 3.14, decisão nº 17):
  - motor de investimentos e casa de Mercado na trilha, com telas de investimento;
  - relatório da consultoria, com métricas visíveis só depois de contratá-la;
  - custo de R$ 15.000 para quem contrata a consultoria e não investe;
  - lucros da empresa sempre visíveis.
- **Eventos com escolha de carta** no estilo Monty Hall (`fisher.md` 3.15, decisão nº 19).

### Cenários e conteúdo
- **Cenários 22 a 25**: Simpson no RH, sobrevivência, taxa base e correlação.
- **Cenários 26 a 30**: dois de cálculo (P75 no corte de bônus e média aparada em notas com pontas sem critério) e três conceituais com tabela de séries (regressão à média, comparações múltiplas e risco relativo × absoluto). Três geradores e três conceitos novos (19 no catálogo), com materiais de estudo.
- Correção da margem dos cenários de cálculo, agora pela grandeza do valor exato.
- Correção das legendas erradas nos gráficos (decisão nº 16).

### Testes, CI e processo
- Suíte de testes ampliada conforme o relatório de testes (fases 1 a 3) e teste de que investir sem critério rende perto de zero.
- CI: o lint barra o deploy, e a `main` passou a ser protegida (pull request com checks `Node 20` e `Node 22`).
- Políticas para agentes no `CLAUDE.md`: commits exigem `npm test` e devem ser atômicos.

### Pull requests mergeados
| PR | Tema |
| --- | --- |
| #3 | CI: lint antes do deploy |
| #4 | Cenários 22 a 25 |
| #5 | Margem dos cenários de cálculo |
| #6 | Falência no Balanço |
| #7 | Sequências de erros e acertos |
| #8 | Jogada extra com dados iguais |
| #9 | Legendas dos gráficos |
| #10, #11, #12 | Mercado, consultoria, reputação inicial e eventos com escolha de carta |
| #16 | Cenários 26 a 30 |

## 25/10/2026 — Multiplayer em rede local (LAN via WebRTC)

- **Código de convite e protocolo** (`src/net/codigo.js`, `src/net/protocolo.js`):
  - Sinalização WebRTC manual sem servidor (oferta/resposta SDP comprimidas com `deflate-raw` e Base64url com prefixos `CEO1P.` e `CEO1R.`);
  - Validação de mensagens, tipagem e limites de payload (`MAX_DO_DONO` e `MAX_DO_CONVIDADO`).
- **Regras da sala e lobby** (`src/net/sala.js`):
  - Suporte a 2 ou 3 jogadores em aparelhos separados na mesma rede local;
  - Configuração de regras (modo cooperativo/competitivo, trimestres, dificuldade);
  - Garantia de diretorias não repetidas e transição limpa para revanche (`voltarAoLobby`).
- **Piloto automático de bots e resiliência** (`src/net/piloto.js`):
  - Detecção de quedas e desconexões por heartbeat a cada 2 segundos;
  - Substituição automática de jogador ausente por bot no mesmo nível técnico após 60 segundos de silêncio, mantendo a partida fluida sem travamento.
- **Sessões de anfitrião e convidado** (`src/net/anfitriao.js`, `src/net/convidado.js`, `src/net/transporte.js`):
  - Anfitrião autoritativo (roda `reduzir` centralizado e transmite os estados);
  - Convidado cliente com despacho de intenções de ação na sua vez.
- **Telas e fluxo de multiplayer** (`src/ui/views-multi.js`, `src/ui/views.js`, `src/main.js`, `style.css`):
  - Modal de multiplayer com criação ou entrada na sala;
  - Lobbies dedicados para anfitrião e convidados com personalização de perfil;
  - Modo espectador em tempo real com textos em terceira pessoa e botões inertes;
  - Mensagem de diagnóstico de rede (aviso de AP isolation / Wi-Fi de visitantes após 15 segundos de tentativa de conexão);
  - Botão de revanche ao final da partida e relatórios de desempenho colapsados.
- **Documentação e ADR**:
  - `docs/adr/0008-multiplayer-lan-webrtc-sem-servidor.md`, atualização de `docs/adr/README.md`, `fisher.md`, `docs/diagramas-uml.md`, `docs/modo-cooperativo.md`, `docs/testes.md`, `README.md`.

## Estado atual (resumo)

- 3 modos (competitivo, cooperativo, solo) em hot-seat ou multiplayer LAN (WebRTC serverless), trilha de 28 casas, 30 cenários e 41 cartas de eventos.
- Quatro tipos de casa: Decisão, Evento, Mercado e Balanço. Duelo e Auditoria ficam para a Fase 2.
- Pontos a calibrar no playtest: dificuldade dos cenários, margem de cálculo, fatores das sequências, valores do Mercado e das cartas, e balanceamento com caixas fora do padrão.
