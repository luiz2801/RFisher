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

## Estado atual (resumo)

- 3 modos (competitivo, cooperativo, solo), trilha de 28 casas, 25 cenários e 41 cartas de eventos.
- Quatro tipos de casa: Decisão, Evento, Mercado e Balanço. Duelo e Auditoria ficam para a Fase 2.
- Pontos a calibrar no playtest: dificuldade dos cenários, margem de cálculo, fatores das sequências, valores do Mercado e das cartas, e balanceamento com caixas fora do padrão.
