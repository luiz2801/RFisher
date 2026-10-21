# Tabuleiro do CEO (nome provisório)

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
| **Jogadores** | 1 a 3 simultâneos, revezando turnos |
| **Papel do jogador** | CEO de uma empresa |
| **Modo** | Competitivo |
| **Objetivo** | Ter mais dinheiro ao fim de N turnos |
| **Métricas** | Dinheiro e reputação |
| **Juiz** | O computador (regras determinísticas, sem IA) |
| **Duração alvo** | 30 a 40 minutos (10 a 12 turnos por jogador) |
| **Níveis** | Iniciante (sem base de matemática) e Avançado (já conhece média, mediana, Paradoxo de Simpson etc.) |
| **Custo** | Zero (site estático, sem servidor) |
| **Inspiração** | Jogo da Vida (trilha circular de casas de evento) |

### Core loop

```
Rola o dado → cai numa casa → vê o cenário/gráfico → escolhe o nível de confiança
→ escolhe a métrica/ação → escolhe a justificativa → vê o resultado
→ lê a explicação (sempre, inclusive quem acertou) → atualiza dinheiro e reputação → próximo jogador
```

### Princípios de design

1. **Errar custa dinheiro e ensina.** Toda decisão termina com a explicação correta, para quem errou e para quem acertou.
2. **Acertar por sorte não pode compensar.** Aposta de confiança e justificativa obrigatória tornam o chute um mau negócio.
3. **O conhecimento pesa mais que o dado.** O dado só decide onde o jogador cai.
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

1. Rola o dado e avança.
2. Resolve a casa (decisão, evento, duelo, mercado, auditoria ou balanço).
3. Em casas de decisão: **confiança → métrica → justificativa → resultado → explicação**.
4. Atualiza o estado e passa a vez.

### 3.3 Decisão em duas etapas

- **Etapa 1, escolha prática:** o jogador escolhe a métrica ou ação entre 5 alternativas (ex.: Média, Mediana, Moda, P90, Desvio Padrão). Os distratores são **equívocos conceituais reais**, não absurdos.
- **Etapa 2, justificativa:** o jogador escolhe a afirmação que sustenta a decisão, em um **pool único** por cenário (6 a 8 afirmações, embaralhadas a cada jogada), igual para qualquer alternativa escolhida.

Cada afirmação do pool é marcada com um tipo: `correta`, `parcial`, `erro_conceitual` (com o equívoco associado), `afirmacao_falsa` ou `irrelevante`.

### 3.4 Aposta de confiança

Antes de revelar, o jogador escolhe:

- **Chute (×0,5):** ganha menos, perde menos.
- **Certeza (×1,5):** ganha mais, perde mais.

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

---

## 4. Conteúdo pedagógico e cenários

### 4.1 Cenários iniciais

| ID | Tema | Padrão dos dados | Métrica correta | Ponto cego avaliado |
| --- | --- | --- | --- | --- |
| 01 | Divulgação salarial de contratação | Assimetria à direita (*outliers* no topo) | **Mediana** | Sensibilidade da média a valores extremos |
| 02 | SLA de e-commerce | Cauda longa de atrasos severos | **Percentil 90 (P90)** | A média oculta falhas graves na experiência do cliente |
| 03 | Controle de estoque de calçados | Dados discretos categóricos | **Moda** | Aplicar tendência central contínua a itens discretos |
| 04 | Precisão de peças industriais | Mesma média, variâncias distintas | **Desvio padrão** | Ignorar dispersão e olhar só a tendência central |

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
- Conceitos errados voltam em cenários futuros com dados diferentes (repetição espaçada), em fase posterior.

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
│   │   ├── components/       # gráfico, cartas, placar, dado
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
                  ├─ Decisão ─> ESCOLHER_CONFIANCA ─> ESCOLHER_METRICA ─> ESCOLHER_JUSTIFICATIVA ─> MOSTRAR_RESULTADO ─> MOSTRAR_EXPLICACAO
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
      efeitosAtivos: [           // consequências com atraso
        { tipo: "crise_turnover", turnosRestantes: 2, impacto: -15000 }
      ],
      cenariosVistos: ["cenario_01_salarios"],
      historico: [               // base para feedback e repetição espaçada
        { cenario: "cenario_01_salarios", metrica: "media", justificativa: "j4",
          confianca: "certeza", resultado: "erro_total", delta: -15000 }
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
const CONFIANCA = { chute: 0.5, certeza: 1.5 };
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
- **Testes de pontuação:** as quatro combinações, os dois níveis de confiança, os dois níveis de jogador e os limites de reputação.
- **Testes de geradores:** invariantes da seção 5.6 em 1.000 seeds aleatórias.
- **Teste de simulação:** 1.000 partidas com jogadores simulados (um que chuta, um que sabe 70%, um que sabe 100%). O que chuta deve terminar com menos dinheiro, e o que sabe tudo, com mais.

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

---

## 9. Roadmap

| Fase | Entrega | Critério de sucesso |
| --- | --- | --- |
| **0. Protótipo em papel (opcional)** | 1 cenário, 6 cartas de justificativa, marcador de dinheiro, aposta de confiança | 2 a 3 pessoas jogam e discutem; o chute não compensa |
| **1. MVP jogável** | Tabuleiro com 3 jogadores, dado, casas de decisão e evento, aposta de confiança, 4 cenários do nível iniciante, resultado e explicação | Uma partida completa roda do início ao fim sem erros |
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