# Fisher SA (nome provisório)

> Jogo de tabuleiro digital e educativo, em que cada jogador é o CEO de uma empresa e aprende estatística tomando decisões de negócio. Roda no navegador, sem backend, sem IA e sem custo de infraestrutura.

**Status:** Fase 1 (MVP jogável) implementada. Ver [README.md](README.md).
**Idioma:** PT-BR (inglês como possível segunda língua no futuro).

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Como chegamos aqui: histórico de decisões](#2-como-chegamos-aqui-histórico-de-decisões)
3. [Regras do jogo](#3-regras-do-jogo)
4. [Conteúdo pedagógico e cenários](#4-conteúdo-pedagógico-e-cenários)
5. [Arquitetura técnica](#5-arquitetura-técnica)
6. [Backlog: modo texto livre com IA local (v2)](#6-backlog-modo-texto-livre-com-ia-local-v2)
7. [Riscos de design](#7-riscos-de-design)
8. [Questões em aberto](#8-questões-em-aberto)
9. [Roadmap](#9-roadmap)
10. [Apêndice: correções ao documento original](#10-apêndice-correções-ao-documento-original)

---

## 1. Visão geral

| Item | Definição |
| --- | --- |
| **Gênero** | Jogo de tabuleiro digital, simulação de tomada de decisão, educativo |
| **Plataforma** | Navegador no computador (hot-seat: todos jogam no mesmo computador) |
| **Jogadores** | 1 a 3 simultâneos, revezando turnos; ou 1 contra um rival controlado pelo computador (modo solo, 3.11) |
| **Papel do jogador** | CEO de uma empresa |
| **Modo** | Competitivo, cooperativo ou solo (competitivo contra o computador) |
| **Objetivo** | Ter mais dinheiro ao fim de N turnos |
| **Métricas** | Dinheiro e reputação |
| **Juiz** | O computador (regras determinísticas, sem IA). No modo solo, o computador também joga como rival, sem IA: um perfil estatístico de acertos (3.11) |
| **Duração alvo** | 30 a 40 minutos (10 a 12 turnos por jogador) |
| **Níveis** | Iniciante (sem base de matemática) e Avançado (já conhece média, mediana, Paradoxo de Simpson etc.) |
| **Custo** | Zero (site estático, sem servidor) |
| **Inspiração** | Jogo da Vida (trilha circular de casas de evento) |

### Core loop

```
Rola os dois dados (soma, 2 a 12) → cai numa casa → vê o cenário/gráfico → escolhe a métrica/ação
→ escolhe a justificativa → escolhe o nível de confiança (escala de 5 níveis, do chute à certeza) → vê o resultado
→ lê a explicação (sempre, inclusive quem acertou) → atualiza dinheiro e reputação → próximo jogador
```

### Princípios de design

1. **Errar custa dinheiro e ensina.** Toda decisão termina com a explicação correta, para quem errou e para quem acertou.
2. **Acertar por sorte não pode compensar.** Aposta de confiança e justificativa obrigatória tornam o chute um mau negócio.
3. **O conhecimento pesa mais que o dado.** Os dois dados só decidem onde o jogador cai.
4. **Ninguém é eliminado.** O jogo é educativo, então todos jogam até o fim, com mecanismos de recuperação.
5. **Tudo é determinístico e testável.** Sem IA e sem rede, o comportamento é reproduzível.

---

## 2. Como chegamos aqui: histórico de decisões

| # | Decisão | Motivo |
| --- | --- | --- |
| 1 | A ideia original validava justificativas em **texto livre** com IA local (Transformers.js) | Garantir que o jogador sabe, e não só chutou |
| 2 | **Múltipla escolha** para justificativas no MVP | Funciona offline, é determinística, fácil de testar e balancear |
| 3 | **Pool único de justificativas por cenário**, em vez de 5 justificativas para cada alternativa (5×5) | O formato 5×5 vaza a resposta (as justificativas da opção certa "soam" certas), faz a matriz 2×2 perder sentido e exige 25 textos por cenário |
| 4 | **IA local descartada do MVP** | Modelo `typeform-distilbert...` é só inglês; modelos multilíngues são pesados; embeddings não captam negação bem; tradução PT→EN acumula erros (e quebra negações) |
| 5 | **Virou jogo de tabuleiro** | Permite punir o erro e mostrar a justificativa sem precisar detectar chute. Reduz o escopo técnico |
| 6 | **Competitivo**, até 3 jogadores | Apostas e duelos geram discussão, que é onde se aprende |
| 7 | **Jogo da Vida** como referência (não Monopoly) | Monopoly gira em torno de propriedades e eliminação, mecânicas sem relação com estatística |
| 8 | **Níveis por jogador** (recomendação, a confirmar) | Iniciante e avançado podem jogar juntos, com multiplicadores compensando o risco |
| 9 | **Modo cooperativo** com diretorias, ao lado do competitivo (fase 1 implementada) | Caixa compartilhado resolve a recuperação de quem está atrás e mantém a discussão entre papéis. Ver [docs/modo-cooperativo.md](docs/modo-cooperativo.md) |
| 10 | **Modo solo**: competitivo contra um rival do computador, que acerta com a frequência de um perfil, calibrado por simulação (implementado) | Uma pessoa sozinha não tinha contra quem competir. Um rival estocástico usa as mesmas regras e é balanceado pela taxa de vitória, sem IA nem rubber-banding (3.11) |

---

## 3. Regras do jogo

### 3.1 Tabuleiro

Circuito de aproximadamente **20 casas**. Cada casa coloca pelo menos uma métrica (dinheiro ou reputação) em jogo.

| Tipo de casa | Qtd. | O que acontece |
| --- | --- | --- |
| **Decisão** | ~8 | Cenário estatístico com gráfico: escolhe a métrica, depois a justificativa. Dinheiro e reputação em jogo |
| **Evento** | ~5 | Sorte ou revés com mini-lição (ex.: gráfico com eixo truncado engana um investidor) |
| **Duelo** | ~2 | Mesma pergunta para dois jogadores. Quem acertar leva dinheiro do outro |
| **Mercado** | ~2 | Compra dica de consultor, seguro de reputação ou glossário |
| **Imprensa/Auditoria** | ~2 | Reputação em xeque |
| **Início/Balanço** | 1 | Receita fixa, ajustada pela reputação, menos custos |

### 3.2 Estrutura do turno

1. Rola os dois dados e avança a soma.
2. Resolve a casa (decisão, evento, duelo, mercado, auditoria ou balanço).
3. Em casas de decisão: **métrica → justificativa → confiança → resultado → explicação**.
4. Atualiza o estado e passa a vez.

### 3.3 Decisão em duas etapas

- **Etapa 1, escolha prática:** o jogador escolhe a métrica ou ação entre 5 alternativas (ex.: Média, Mediana, Moda, P90, Desvio Padrão). Os distratores são **equívocos conceituais reais**, não absurdos.
- **Etapa 2, justificativa:** o jogador escolhe a afirmação que sustenta a decisão, em um **pool único** por cenário (6 a 8 afirmações, embaralhadas a cada jogada), igual para qualquer alternativa escolhida.

Cada afirmação do pool é marcada com um tipo: `correta`, `parcial`, `erro_conceitual` (com o equívoco associado), `afirmacao_falsa` ou `irrelevante`.

### 3.4 Aposta de confiança

Antes de revelar, o jogador escolhe quão certo está, numa escala crescente de 5 níveis em degraus iguais de 0,25:

| Nível | Chave | Multiplicador |
| --- | --- | --- |
| Chute | `chute` | ×0,5 |
| Tenho dúvidas | `duvida` | ×0,75 |
| Provavelmente certo | `provavel` | ×1,0 |
| Confiante | `confiante` | ×1,25 |
| Certeza absoluta | `certeza` | ×1,5 |

Quanto mais alto o nível, mais o jogador ganha ao acertar e mais perde ao errar. As pontas mantêm os valores originais (chute ×0,5, certeza ×1,5); os níveis intermediários permitem graduar a aposta em vez de uma escolha binária. Como a pontuação é linear na confiança, a verificação anti-chute (3.5) vale para todos os níveis.

### 3.5 Matriz de pontuação

Cada casa de decisão tem um valor **V** (proposta inicial: R$ 10.000 a R$ 50.000). Os números abaixo são ponto de partida, a calibrar no playtest.

| Métrica (Etapa 1) | Justificativa (Etapa 2) | Resultado | Efeito no dinheiro |
| --- | --- | --- | --- |
| Certa | Certa | Sucesso absoluto | **+V × confiança** |
| Certa | Errada | Sorte / prepotência | **+0,2V × confiança** |
| Errada | Certa | Incoerência (conceito certo, métrica errada) | **0** |
| Errada | Errada | Erro total | **−0,5V × confiança** |

**Verificação de sanidade (anti-chute).** Com 5 alternativas e 6 afirmações no pool (uma só correta), um jogador que chuta tudo tem esperança de ganho de aproximadamente **−0,27 × V × confiança** por casa. Ou seja, chutar perde dinheiro em média. Essa conta deve ser refeita se mudar o número de alternativas, o tamanho do pool ou a possibilidade de crédito parcial.

**Exemplos** com V = R$ 20.000, nível iniciante, reputação neutra:

| Situação | Cálculo | Resultado |
| --- | --- | --- |
| Certeza, certa/certa | 20.000 × 1,5 | **+R$ 30.000** |
| Provavelmente certo, certa/certa | 20.000 × 1,0 | **+R$ 20.000** |
| Chute, certa/certa | 20.000 × 0,5 | **+R$ 10.000** |
| Certeza, errada/errada | −0,5 × 20.000 × 1,5 | **−R$ 15.000** |
| Chute, errada/errada | −0,5 × 20.000 × 0,5 | **−R$ 5.000** |

### 3.6 Reputação

A reputação precisa ter função mecânica, senão vira só um número na tela:

- Multiplica os **ganhos** de dinheiro (de ×0,8 com reputação baixa a ×1,3 com alta).
- Reputação em zero dispara uma **crise de imagem** (multa ou perda de vez).
- Serve de **desempate** no fim da partida.
- Casas de Imprensa/Auditoria colocam a reputação em xeque diretamente.

### 3.7 Níveis

| | **Iniciante** | **Avançado** |
| --- | --- | --- |
| Público | Quem não sabe nada de matemática | Quem já conhece média, mediana etc. |
| Conteúdo | Média, mediana, moda, dispersão, gráficos enganosos | Paradoxo de Simpson, viés de sobrevivência, taxa-base, correlação vs. causalidade, tamanho de amostra, p-valor e intervalo de confiança |
| Ajuda | Glossário e dicas gratuitas nas primeiras casas | Dicas só compradas no Mercado |
| Valor das casas | ×1 | ×1,5 |

**Recomendação:** nível **por jogador**, não por partida. O multiplicador de valor compensa a diferença de risco entre quem joga cada nível.

### 3.8 Chute e cópia

| Problema | Mitigação |
| --- | --- |
| Quem acerta por sorte não aprende | Explicação obrigatória para todos; aposta de confiança torna o chute caro |
| Jogadores copiam a resposta dos outros (todos veem a tela) | Cenários não se repetem na mesma partida; números gerados por seed; Duelo com "passe o computador" e tela oculta; ordem das opções embaralhada |
| Quem decorou a resposta | Dados mudam por seed (mesmo padrão estatístico, valores diferentes) |

### 3.9 Recuperação de quem está atrás

Para não eliminar ninguém, o jogo tem pelo menos um destes mecanismos (a definir no playtest):

- Empréstimo do banco com juros.
- Investidor-anjo para quem estiver muito atrás.
- Casa de Crise com efeito atrasado, e não eliminação.

### 3.10 Punição

A punição é ajustável. O ponto de partida é perda de dinheiro e reputação (tabela 3.5). Opções a explorar: voltar casas, perder a vez, ou **consequências com atraso** (uma decisão ruim gera uma crise algumas rodadas depois). Ela precisa doer sem deixar o jogador entediado.

### 3.11 Modo solo: rival controlado pelo computador

**Implementado** (`src/engine/bot.js`, perfis em `src/engine/config.js`). É o modo competitivo com dois jogadores: a pessoa (jogador 1) e um rival do computador (jogador 2). Valem as mesmas regras, casas, baralhos e pontuação, e ganha quem tiver mais dinheiro ao fim (reputação desempata). O rival joga no **mesmo nível** da pessoa, então as casas valem o mesmo para os dois.

**O rival não resolve o cenário.** Ele acerta com a frequência do seu perfil:

1. **Acerto efetivo:** `p = acerto − 0,08 × (dificuldade − 1)`, limitado a 0,05–0,98. O rival sente a dificuldade crescente (4.5) como uma pessoa.
2. **Métrica e justificativa:** cada uma acerta com probabilidade `p`, de forma independente. Ao errar, escolhe ao acaso entre os distratores, que são equívocos reais. Por isso a tela de resultado mostra o equívoco do rival, e o erro dele também ensina.
3. **Confiança:** vem de uma certeza interna `p + 0,1 × (acertos − 1) + ruído normal (dp 0,15)`, em que `acertos` vai de 0 a 2. Os limiares 0,30 · 0,45 · 0,60 · 0,75 separam os cinco níveis, do chute à certeza. Quem acerta tende a apostar mais alto, mas às vezes o rival erra convicto.
4. **Determinismo:** o rival usa o rng da partida (ação `DECIDIR_BOT`), então a seed reproduz também as jogadas dele, inclusive depois de salvar e retomar.

**Valor esperado por decisão.** Com `pm = pj = p` e a matriz 3.5, em unidades de V × confiança: `EV(p) = 0,3·p² + 1,2·p − 0,5`. O ponto de equilíbrio é p ≈ 0,38. Abaixo disso o rival perde dinheiro em média, e o chute puro (≈ 0,2 e 1/6) dá os −0,27 da verificação anti-chute.

**Perfis e calibração.** O alvo é a **taxa de vitória** de um jogador de referência, não o acerto do rival. Como ainda não há dados de playtest, a referência é um jogador simulado de acerto 0,6, com o mesmo modelo de confiança, em partidas de 10 turnos. `scripts/simular-bot.mjs --calibrar` acha por bisseção o acerto de cada perfil:

| Perfil | Rival | Acerto | Referência vence (alvo) |
| --- | --- | --- | --- |
| `facil` | Estagiário(a) | 0,48 | 70% |
| `medio` | Analista | 0,60 | 50% |
| `dificil` | Sênior | 0,70 | 30% |

A variância é alta: em 10 turnos cada jogador decide cerca de 6 vezes, e a diferença final de dinheiro entre os dois tem desvio padrão de R$ 49 a 58 mil, contra uma diferença média de até R$ 31 mil. O rival difícil perde partidas, e o fácil ganha algumas, o que é saudável. Os números são pontos de partida. Depois do playtest, o acerto de referência deve ser trocado pelo acerto real medido no `historico`, e a calibração refeita.

**Fora do modelo, de propósito:** *rubber-banding* (o rival errar quando está à frente), porque desfaz a relação entre aprender e ganhar; rival que conhece a resposta e a embaralha; correlação entre métrica e justificativa, e pontos fortes por conceito, que ficam para uma fase posterior.

---

## 4. Conteúdo pedagógico e cenários

### 4.1 Cenários iniciais

| ID | Tema | Padrão dos dados | Métrica correta | Ponto cego avaliado |
| --- | --- | --- | --- | --- |
| 01 | Divulgação salarial de contratação | Assimetria à direita (*outliers* no topo) | **Mediana** | Sensibilidade da média a valores extremos |
| 02 | SLA de e-commerce | Cauda longa de atrasos severos | **Percentil 90 (P90)** | A média oculta falhas graves na experiência do cliente |
| 03 | Controle de estoque de calçados | Dados discretos categóricos | **Moda** | Aplicar tendência central contínua a itens discretos |
| 04 | Precisão de peças industriais | Mesma média, variâncias distintas | **Desvio padrão** | Ignorar dispersão e olhar só a tendência central |
| 05 | Avaliações do aplicativo | Bimodal (polarizado em 1 e 5) | **Distribuição de frequências** | A média cai num centro que ninguém escolheu |
| 06 | Tempo de atendimento do SAC | Dispersão com *outliers* | **Amplitude interquartil (IQR)** | O desvio padrão é inflado por casos aberrantes |
| 07 | Peso na linha de envase | Normal e simétrica | **Média** | Rejeitar a média mesmo quando ela é a ideal |
| 08 | Teste A/B de conversão | Duas amostras, uma muito instável | **Desvio padrão e tamanho da amostra** | Tomar flutuação aleatória por ganho real |
| 09 | Portão do centro de distribuição | Aproximadamente normal | **Máximo** | Usar valor típico quando todos precisam caber |
| 10 | Tempo de resposta da API | Cauda longa de requisições lentas | **Percentil 95 (P95)** | Confundir percentis (P90 por P95) e confiar na média |
| 11 | Resolução no primeiro contato | Assimetria à esquerda (*outliers* na base) | **Mediana** | Achar que só valores altos distorcem a média |
| 12 | Caixa da folha de pagamento | Duas séries, a de média maior é volátil | **Desvio padrão** | Escolher pela média e ignorar o risco |
| 13 | Projeção de receita (freemium) | Maioria de zeros | **Média** | Usar a mediana para projetar um total |

### 4.2 Cenários candidatos (nível avançado e eventos)

- Correlação vs. causalidade
- Paradoxo de Simpson
- Viés de sobrevivência
- Tamanho de amostra pequeno
- Eixo truncado em gráfico enganoso
- Taxa-base (falso positivo em teste de doença rara)
- Comparação de grupos com p-valor ou intervalo de confiança

### 4.3 Anatomia de um cenário

Cada cenário contém:

1. **Contexto narrativo** (você, CEO, precisa decidir X).
2. **Dados e gráfico**, gerados por seed.
3. **5 alternativas** de métrica, cada uma ligada a um equívoco quando errada.
4. **Pool de 6 a 8 justificativas** com tipo e equívoco associado.
5. **Feedback por equívoco:** explicação específica do porquê aquela escolha estava errada.
6. **Revelação visual:** os dados exibidos com a métrica certa e a errada lado a lado (ex.: média vs. mediana sobre o mesmo histograma).
7. **Impacto:** valor V e variação de reputação.

### 4.4 Exemplo: pool de justificativas do Cenário 01

| Justificativa | Tipo |
| --- | --- |
| "Um salário muito alto isolado puxa a média para cima, e a mediana não é afetada por isso." | Correta |
| "Os salários estão concentrados em poucos valores, então a mediana reflete bem a maioria." | Parcial |
| "A mediana é o valor que mais se repete, por isso representa a equipe." | Erro: confunde com moda |
| "A média usa todos os dados, então é sempre mais justa e completa." | Erro: ignora outliers |
| "A mediana é mais fácil de calcular." | Irrelevante |
| "Outliers puxam a mediana tanto quanto a média." | Afirmação falsa |

### 4.5 Progressão e reforço

- Dificuldade crescente: de cenários com métrica única até cenários ambíguos, em que duas respostas são defensáveis e o contexto decide.
- **Implementado (sorteio por progresso):** cada cenário tem `dificuldade` de 1 a 3 (1 = a métrica certa é a mais direta; 2 = exige reconhecer o formato dos dados; 3 = exige comparar dispersão ou amostras). Ao cair numa casa de Decisão, o jogo calcula o **progresso do jogador** (casas percorridas, contando as voltas, ÷ turnos da partida × 7 — a média da soma de 2 dados de 6 faces —, limitado a 1) e converte em uma dificuldade-alvo entre 1 e 3. Entre os cenários que ainda restam no baralho, o peso de sorteio é `1 / (1 + 4 × (dificuldade − alvo)²)`. Assim o começo da partida favorece os fáceis e o fim favorece os difíceis, mas nenhum fica excluído, para a partida não ser previsível. O baralho continua sem repetir cenário dentro de um ciclo. O progresso é individual: quem anda mais rápido recebe cenários mais difíceis antes.
- Conceitos errados voltam em cenários futuros com dados diferentes (repetição espaçada), em fase posterior. O perfil de desempenho (4.6) já identifica esses conceitos.

### 4.6 Perfil de desempenho (o que o jogador domina e onde tem deficiência)

**Implementado, com relatório na tela de fim de jogo** (`src/engine/desempenho.js`, funções `perfilDesempenho(jogador)` e `relatorioDesempenho(jogador)`; ver *Relatório de fim de jogo* abaixo). Cada decisão fica no `historico` do jogador com o **conceito** avaliado pelo cenário (campo `conceito`, catálogo em `src/scenarios/content/conceitos.js`), a categoria do resultado, a confiança declarada e os **equívocos** da opção e da justificativa escolhidas. No modo cooperativo o histórico continua individual: quem decidiu é quem tem o perfil.

Ao fim da partida, o perfil agrega as decisões por conceito (vários cenários podem avaliar o mesmo):

- **Acerto** da decisão: métrica e justificativa valem meio ponto cada (sucesso 1; sorte e incoerência 0,5; erro total 0). A justificativa `parcial` conta como errada, como na pontuação (8, item 4).
- **Certeza** de 0 a 1, tirada da escala de confiança: chute 0, dúvida 0,25, provável 0,5, confiante 0,75, certeza 1.
- **Evidência de domínio** por decisão, de −1 a +1: `(2 × acerto − 1) × (0,5 + 0,5 × certeza)`. Acertar com certeza vale +1 e errar com certeza vale −1; no chute, os dois valem metade. Acerto parcial é neutro. O **domínio** do conceito é a média das evidências.
- **Diagnóstico** do conceito, cruzando acerto médio (> 0,5 conta como acerto) e certeza média (≥ 0,5 conta como seguro):

| | Seguro | Inseguro |
| --- | --- | --- |
| **Acertou** | `dominado`: sabe e sabe que sabe | `inseguro`: sabe, mas não confia (conhecimento frágil) |
| **Errou** | `equivoco`: erra convicto, a deficiência mais grave | `lacuna`: não sabe e reconhece |

- **Pontos fortes:** conceitos `dominado` e `inseguro`, do maior domínio ao menor. **Deficiências:** `equivoco` e `lacuna`, do menor domínio ao maior; no empate, primeiro quem errou com mais certeza.
- **Equívocos recorrentes:** cada equívoco cometido soma peso `0,5 + 0,5 × certeza`; a lista vem do maior peso ao menor, com os cenários em que apareceu. Serve para dizer *qual* confusão o jogador fez (ex.: `confunde_mediana_moda`), não só em que conceito errou.
- **Calibração** (geral e por conceito): certeza média − acerto médio. Acima de 0,15 é `superconfiante`, abaixo de −0,15 é `subconfiante`, senão `calibrado`.

Os limiares (0,5; 0,5; 0,15) são pontos de partida, a calibrar no playtest. Históricos antigos, sem `conceito` nem `equivocos`, são completados a partir do conteúdo atual.

**Relatório de fim de jogo.** A tela de fim de jogo (competitivo, cooperativo e solo) mostra um relatório para cada pessoa; o rival do computador do modo solo não tem relatório. Cada relatório traz:

- **Acertos e erros:** acertos totais (`sucesso`), acertos parciais (`sorte` e `incoerencia`) e erros totais (`erro_total`), mais em quantas decisões acertou a métrica e a justificativa, e a calibração geral em uma frase.
- **Assuntos que mais domina:** até 3 pontos fortes, na ordem acima, com o diagnóstico e a taxa de acerto do conceito.
- **Assuntos que menos domina:** até 3 deficiências, na ordem acima.
- **Sugestões de estudo:** até 3 conceitos, primeiro as deficiências e depois os `inseguro` (do menor domínio ao maior). Se não há nenhum dos dois, sugere até 2 conceitos do catálogo que a partida não cobrou. Cada sugestão tem uma frase do que revisar e links gratuitos em português (catálogo em `src/scenarios/content/materiais.js`, um item por conceito). Um curso geral (Khan Academy, Estatística e probabilidade) aparece sempre ao fim.
- Quem não caiu em nenhuma casa de Decisão vê só um aviso e o curso geral.

Como o save é apagado em `FIM_DE_JOGO`, o relatório não sobrevive a recarregar a página; o botão **Imprimir relatório** abre a impressão do navegador (que também salva em PDF) só com o painel de fim de jogo. Os equívocos recorrentes ainda não aparecem no relatório, porque os ids de equívoco não têm rótulo legível.

---

## 5. Arquitetura técnica

### 5.1 Stack proposta

| Camada | Escolha | Observação |
| --- | --- | --- |
| Linguagem | JavaScript (ou TypeScript) | TypeScript ajuda a manter o schema dos cenários consistente |
| UI | HTML/CSS + JS puro **ou** React | Decidir conforme preferência; o jogo tem poucas telas |
| Build | Vite (opcional) | Se usar HTML/JS puro, não há build |
| Gráficos | Chart.js ou SVG próprio | SVG próprio dá mais controle para a "revelação" (sobrepor média e mediana) |
| Estado | Objeto único + máquina de estados | Sem biblioteca externa necessária |
| Persistência | `localStorage` | Salvar partida em andamento e configurações |
| Aleatoriedade | PRNG com seed (ex.: mulberry32) | Reprodutível e testável |
| Testes | Vitest ou Jest | Foco em pontuação e geradores |
| Hospedagem | GitHub Pages ou Cloudflare Pages | Estático, gratuito |
| IA | **Nenhuma no MVP** | Ver seção 6 |

### 5.2 Estrutura de pastas

```
tabuleiro-do-ceo/
├── README.md
├── index.html
├── src/
│   ├── main.js
│   ├── engine/
│   │   ├── state.js          # estado do jogo e transições
│   │   ├── machine.js        # máquina de estados do turno
│   │   ├── board.js          # definição das casas e movimentação
│   │   ├── scoring.js        # cálculo de dinheiro e reputação
│   │   ├── rng.js            # PRNG com seed
│   │   └── effects.js        # efeitos com atraso (crises, bônus)
│   ├── scenarios/
│   │   ├── loader.js         # carrega e valida cenários
│   │   ├── generators.js     # geradores de dados por padrão estatístico
│   │   ├── schema.json       # JSON Schema dos cenários
│   │   └── content/
│   │       ├── iniciante/
│   │       │   ├── 01_salarios.json
│   │       │   ├── 02_sla.json
│   │       │   ├── 03_estoque.json
│   │       │   └── 04_pecas.json
│   │       └── avancado/
│   ├── stats/
│   │   └── metrics.js        # média, mediana, moda, percentil, desvio padrão
│   ├── ui/
│   │   ├── screens/          # menu, tabuleiro, cenário, feedback, fim de jogo
│   │   ├── components/       # gráfico, cartas, placar, dados
│   │   └── a11y.js           # descrições textuais e teclado
│   └── storage/
│       └── persist.js
├── tests/
│   ├── scoring.test.js
│   ├── generators.test.js    # valida invariantes estatísticos
│   └── scenarios.test.js     # valida todo o conteúdo contra o schema
└── docs/
    └── playtest.md
```

### 5.3 Máquina de estados do turno

```
INICIO_TURNO
   └─> ROLAR_DADO
        └─> MOVER
             └─> RESOLVER_CASA
                  ├─ Decisão ─> ESCOLHER_METRICA ─> ESCOLHER_JUSTIFICATIVA ─> ESCOLHER_CONFIANCA ─> MOSTRAR_RESULTADO ─> MOSTRAR_EXPLICACAO
                  ├─ Evento ──> MOSTRAR_EVENTO ─> APLICAR_EFEITO
                  ├─ Duelo ───> (jogador A e B respondem em tela oculta) ─> COMPARAR ─> MOSTRAR_EXPLICACAO
                  ├─ Mercado ─> COMPRAR_OU_PASSAR
                  └─ Auditoria> RESOLVER_REPUTACAO
                       └─> APLICAR_EFEITOS_ATRASADOS
                            └─> FIM_TURNO ─> (próximo jogador | FIM_DE_JOGO)
```

Cada transição é uma função pura `(estado, ação) -> novoEstado`, o que facilita testes e salvar/retomar a partida.

### 5.4 Estado do jogo

```js
{
  seed: 123456,
  turnoAtual: 3,
  turnosPorJogador: 10,
  jogadorAtual: 1,
  fase: "ESCOLHER_METRICA",
  jogadores: [
    {
      id: 0,
      nome: "Ana",
      nivel: "iniciante",        // "iniciante" | "avancado"
      dinheiro: 120000,
      reputacao: 55,             // 0..100
      posicao: 7,
      distancia: 23,             // casas percorridas no total, contando voltas (define a dificuldade dos cenários)
      efeitosAtivos: [           // consequências com atraso
        { tipo: "crise_turnover", turnosRestantes: 2, impacto: -15000 }
      ],
      cenariosVistos: ["cenario_01_salarios"],
      historico: [               // base para feedback e repetição espaçada
        { cenario: "cenario_01_salarios", metrica: "media", justificativa: "j4",
          confianca: "certeza", resultado: "erro_total", delta: -15000,
          conceito: "mediana", equivocos: ["ignora_outliers"] }   // base do perfil de desempenho (4.6)
      ]
    }
  ],
  cenarioAtual: { id: "cenario_01_salarios", dadosGerados: [ /* ... */ ] }
}
```

### 5.5 Schema do cenário (revisado)

O schema original foi atualizado para refletir o pool único, os equívocos e a geração por seed. Textos que citam valores usam **placeholders calculados** (ex.: `{{media}}`), e nunca números fixos escritos à mão.

```json
{
  "id": "cenario_01_salarios",
  "versao": 1,
  "idioma": "pt-BR",
  "nivel": "iniciante",
  "dificuldade": 1,
  "conceito": "mediana",
  "titulo": "Política Salarial na Startup",
  "contexto": "Você precisa divulgar o salário representativo da equipe para candidatos.",
  "valor_base": 20000,
  "dados": {
    "gerador": {
      "tipo": "assimetria_direita",
      "n": 30,
      "parametros": {
        "base": 5000,
        "ruido": 0.1,
        "outliers": [{ "valor": 250000, "qtd": 1 }]
      }
    },
    "rotulo_x": "Salário (R$)",
    "rotulo_y": "Funcionários",
    "tipo_grafico": "histograma",
    "descricao_acessivel": "A maioria dos salários está na faixa baixa e um valor muito alto aparece isolado à direita."
  },
  "opcoes": [
    { "id": "mediana",     "texto": "Mediana ({{mediana}})",           "correta": true },
    { "id": "media",       "texto": "Média aritmética ({{media}})",    "correta": false, "equivoco": "ignora_outliers" },
    { "id": "moda",        "texto": "Moda ({{moda}})",                 "correta": false, "equivoco": "moda_para_continuo" },
    { "id": "ponto_medio", "texto": "Ponto médio entre menor e maior", "correta": false, "equivoco": "confunde_amplitude" },
    { "id": "maximo",      "texto": "Maior salário",                   "correta": false, "equivoco": "extremo_como_tipico" }
  ],
  "justificativas": [
    { "id": "j1", "texto": "Um salário muito alto isolado puxa a média para cima, e a mediana não é afetada por isso.", "tipo": "correta" },
    { "id": "j2", "texto": "Os salários estão concentrados em poucos valores, então a mediana reflete bem a maioria.",   "tipo": "parcial" },
    { "id": "j3", "texto": "A mediana é o valor que mais se repete, por isso representa a equipe.",                      "tipo": "erro_conceitual", "equivoco": "confunde_mediana_moda" },
    { "id": "j4", "texto": "A média usa todos os dados, então é sempre mais justa e completa.",                           "tipo": "erro_conceitual", "equivoco": "ignora_outliers" },
    { "id": "j5", "texto": "A mediana é mais fácil de calcular.",                                                         "tipo": "irrelevante" },
    { "id": "j6", "texto": "Outliers puxam a mediana tanto quanto a média.",                                              "tipo": "afirmacao_falsa", "equivoco": "mediana_sensivel" }
  ],
  "feedback": {
    "por_equivoco": {
      "ignora_outliers": "A média foi puxada para cima pelo salário de {{maximo}}. Quase ninguém da equipe ganha perto de {{media}}.",
      "confunde_mediana_moda": "A moda é o valor mais frequente. A mediana é o valor do meio quando os dados estão ordenados."
    },
    "explicacao_correta": "Com valores extremos, a mediana representa melhor o salário típico, porque não é arrastada por eles.",
    "revelacao": ["histograma_com_media_e_mediana"]
  },
  "impacto": { "reputacao_acerto": 5, "reputacao_erro": -10 }
}
```

### 5.6 Geração de dados por seed

- Cada padrão estatístico (`assimetria_direita`, `cauda_longa`, `categorico_discreto`, `mesma_media_variancia_distinta`, `simpson`, etc.) é um **gerador** que recebe parâmetros e um PRNG com seed.
- Para o mesmo padrão, números diferentes a cada partida. Decorar a resposta não adianta.
- **Invariantes verificados em teste automatizado**, para garantir que o gerador sempre produz um cenário em que a resposta correta continua correta. Exemplos:
  - Cenário 01: `media > mediana × 1,5` e `outlier > 10 × mediana`.
  - Cenário 02: `P90 > 3 × media`.
  - Cenário 04: duas séries com médias iguais (tolerância) e desvios padrão muito distintos.
- Para o MVP, é aceitável começar com datasets fixos bem escolhidos e adicionar seed na fase seguinte.

### 5.7 Pontuação (pseudocódigo)

```js
const CONFIANCA = { chute: 0.5, duvida: 0.75, provavel: 1, confiante: 1.25, certeza: 1.5 };
const NIVEL = { iniciante: 1, avancado: 1.5 };

function resolverDecisao({ jogador, cenario, metricaCorreta, justificativaCorreta, confianca }) {
  const V = cenario.valor_base * NIVEL[jogador.nivel];
  const c = CONFIANCA[confianca];

  let delta;
  if (metricaCorreta && justificativaCorreta)       delta =  V * c;          // sucesso absoluto
  else if (metricaCorreta && !justificativaCorreta) delta =  V * 0.2 * c;    // sorte
  else if (!metricaCorreta && justificativaCorreta) delta =  0;              // incoerência
  else                                              delta = -V * 0.5 * c;    // erro total

  if (delta > 0) delta *= multiplicadorReputacao(jogador.reputacao); // 0.8 .. 1.3
  return { delta, resultado: classificar(metricaCorreta, justificativaCorreta) };
}
```

### 5.7.1 Crédito parcial

A justificativa do tipo `parcial` deve contar como correta, incorreta ou meio-termo? Está em aberto (ver seção 8). Se for meio-termo, a tabela de pontuação ganha uma linha adicional.

### 5.8 Validação de conteúdo e testes

- **JSON Schema** (ou Zod) valida todo cenário no build: cada cenário tem exatamente uma opção correta, ao menos uma justificativa `correta`, todo `equivoco` citado tem feedback, e todo placeholder usado existe.
- **Testes de pontuação:** as quatro combinações, os cinco níveis de confiança, os dois níveis de jogador e os limites de reputação.
- **Testes de geradores:** invariantes da seção 5.6 em 1.000 seeds aleatórias.
- **Teste de simulação:** 1.000 partidas com jogadores simulados (um que chuta, um que sabe 70%, um que sabe 100%). O que chuta deve terminar com menos dinheiro, e o que sabe tudo, com mais.
- **Balanceamento do rival (modo solo, 3.11):** a taxa de vitória do jogador de referência cai do rival fácil ao difícil, e quem chuta perde quase sempre do fácil (`tests/bot.test.js`). A calibração fica em `scripts/simular-bot.mjs`.

### 5.9 Acessibilidade e persistência

- Todo gráfico tem descrição textual e tabela de dados alternativa.
- Navegação completa por teclado e contraste adequado.
- Não depender só de cor para indicar acerto/erro.
- Salvar a partida em `localStorage` a cada transição de turno, para retomar após fechar a aba. Envolver leituras e escritas em `try/catch`.
- Strings do jogo em um arquivo separado, para facilitar tradução futura.

### 5.10 Hospedagem e custo zero

- Site 100% estático em GitHub Pages ou Cloudflare Pages.
- Sem backend, sem banco de dados, sem API paga e sem telemetria em servidor.
- Multiplayer **local** (mesmo computador). Multiplayer online exigiria servidor e fica fora do escopo.

---

## 6. Backlog: modo texto livre com IA local (v2)

A ideia original era validar justificativas escritas com IA no navegador. Ficou fora do MVP, mas as conclusões ficam registradas.

- **Biblioteca:** Transformers.js (`@xenova/transformers`, que migrou para `@huggingface/transformers`). Roda no navegador, com WebGPU/WASM.
- **Modelo da proposta original (`Xenova/typeform-distilbert-base-uncased-mnli`):** é só inglês, então não serve para PT-BR.
- **Alternativas avaliadas** (tamanhos aproximados, **confirmar no Hugging Face antes de decidir**):
  - NLI multilíngue (família mDeBERTa-XNLI): bem pesado (~300 MB ou mais), inviável para MVP.
  - Traduzir PT→EN e classificar em inglês: dois modelos, o dobro da latência, e a tradução pode alterar negações.
  - **Embeddings multilíngues** (ex.: `multilingual-e5-small`, `paraphrase-multilingual-MiniLM-L12-v2`), ~100 a 120 MB: um modelo só; compara o texto com frases de referência por similaridade.
- **Fraqueza principal dos embeddings:** captam o tema e não a polaridade ("a mediana é afetada por outliers" ≈ "a mediana não é afetada por outliers"). Mitigações: referências escritas em pares espelhados, regra de negação por cima e palavras-chave obrigatórias.
- **Zero-shot com rótulos longos é frágil.** Se usado, preferir hipóteses curtas e atômicas ("O texto diz que valores extremos distorcem a média").
- **Pipeline recomendado se for implementado:** regras estruturais → conceitos-chave com palavras-chave → similaridade semântica → nota por cobertura de conceitos (0 a 1), com faixa de baixa confiança que pede reformulação em vez de punir.
- **Operação:** Web Worker para a inferência, modelo em Cache API, download opcional com aviso de tamanho (~100 MB), e um dataset de calibração com 30 a 50 justificativas reais por cenário.
- **Condição para entrar:** acerto de pelo menos ~80% no dataset de calibração. Abaixo disso, fica fora.

---

## 7. Riscos de design

| Risco | Mitigação |
| --- | --- |
| Copiar a resposta dos outros (tela compartilhada) | Seed, cenários sem repetição, Duelo com tela oculta |
| O dado manda mais que o conhecimento | Garantir que a maior parte do dinheiro venha das casas de decisão; testar por simulação |
| Quem fica para trás desiste | Empréstimo, investidor-anjo, ausência de eliminação |
| Pouco conteúdo para uma partida inteira | ~25 a 30 cenários por partida; MVP com 6 a 8 cenários e um nível só |
| Explicações longas cansam | 2 a 3 frases visíveis, "ver mais" opcional |
| Jogo vira "decorar o gabarito" | Seed, ordem embaralhada, equívocos variados |
| Múltipla escolha mede reconhecimento, não produção | Reforço com Duelo e, no futuro, modo texto livre |
| Níveis desbalanceados no mesmo jogo | Multiplicador por nível; validar em playtest com jogadores mistos |

---

## 8. Questões em aberto

1. **Nível por jogador ou por partida?** Recomendação: por jogador.
2. **Tema e tom:** uma só empresa (startup, indústria, e-commerce) ou um conglomerado em que cada casa é uma área? Os 4 cenários atuais sugerem empresas diferentes.
3. **Número de turnos:** fixo em 10, 12 ou configurável?
4. **Justificativa `parcial`:** conta como certa, errada ou meio-termo?
5. **Escolha da justificativa:** uma só afirmação ou seleção de 2 entre 6? (Selecionar 2 reduz o chute e permite crédito parcial.)
6. **Mecanismo de recuperação:** empréstimo, investidor-anjo ou crise com efeito atrasado?
7. **Valores de V, multiplicadores e receita do balanço:** a calibrar em playtest.
8. **Nome e identidade do jogo**, e o tom da narrativa.
9. **Stack final:** HTML/JS puro ou React; Chart.js ou SVG próprio.
10. **Plano de playtest:** quem testa, e quais métricas coletar (acerto por cenário, onde travam, o chute compensa?).
11. **Perfil de desempenho (4.6) depois do fim da partida:** o relatório já aparece na tela de fim de jogo e pode ser impresso, mas se apaga com o save em `FIM_DE_JOGO`. Falta decidir se deve ficar guardado (histórico entre partidas) e se os equívocos recorrentes entram no relatório (exigiria um rótulo legível para cada id de equívoco).

---

## 9. Roadmap

| Fase | Entrega | Critério de sucesso |
| --- | --- | --- |
| **0. Protótipo em papel (opcional)** | 1 cenário, 6 cartas de justificativa, marcador de dinheiro, aposta de confiança | 2 a 3 pessoas jogam e discutem; o chute não compensa |
| **1. MVP jogável** | Tabuleiro com 3 jogadores, dois dados, casas de decisão e evento, aposta de confiança, 4 cenários do nível iniciante, resultado e explicação | Uma partida completa roda do início ao fim sem erros |
| **2. Conteúdo e balanceamento** | 8+ cenários, Mercado, Duelo, Auditoria, geração por seed, testes de simulação | Chutar perde dinheiro; saber tudo ganha |
| **3. Nível avançado** | Simpson, viés de sobrevivência, taxa-base, correlação vs. causalidade | Playtest com jogadores mistos equilibrado |
| **4. Polimento** | Acessibilidade, persistência, glossário, tutorial | Pessoas novas jogam sem ajuda |
| **5. Futuro** | Repetição espaçada, modo texto livre com IA local, inglês, multiplayer online | Conforme demanda |

---

## 10. Apêndice: correções ao documento original

- **Média do Cenário 01:** com os dados `[5000, 5000, 5000, 5000, 15000, 250000]`, a média é **R$ 47.500**, não R$ 10.700. A mediana (R$ 5.000) estava correta. No novo schema, os valores são calculados a partir dos dados (`{{media}}`, `{{mediana}}`), para evitar esse tipo de erro.
- **Tamanho do dataset:** 6 valores são poucos para mostrar a forma de uma distribuição; usar de 30 a 50 pontos gerados por seed.
- **Modelo de IA:** o modelo citado é em inglês e não atende PT-BR (ver seção 6).
- **Justificativas:** o formato 5×5 foi substituído por pool único por cenário (ver seção 2, decisão 3).