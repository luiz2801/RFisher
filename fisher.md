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
| **Papel do jogador** | CEO de uma empresa; cada jogador escolhe no menu o setor (diretoria: Operações, Tecnologia ou Pessoas e Finanças) que representa, o mesmo nos dois modos |
| **Modo** | Competitivo, cooperativo ou solo (competitivo contra o computador) |
| **Objetivo** | Ter mais dinheiro ao fim de N turnos, sem quebrar: caixa negativo na jogada do Balanço é falência e derrota automática (3.12) |
| **Configuração da partida** | No menu de nova partida, os jogadores escolhem a duração (N, de 1 a 64 rounds por jogador; padrão 10) o caixa inicial (R$ 10.000 a R$ 1.000.000, em passos de R$ 10.000; padrão R$ 100.000) e a reputação inicial (10 a 100, em passos de 5; padrão 50). Caixa e reputação valem para cada jogador no competitivo e no solo, e para a empresa no cooperativo |
| **Métricas** | Dinheiro e reputação |
| **Juiz** | O computador (regras determinísticas, sem IA). No modo solo, o computador também joga como rival, sem IA: um perfil estatístico de acertos (3.11) |
| **Duração alvo** | 30 a 40 minutos (10 a 12 turnos por jogador); a duração é escolhida no menu, de 1 a 64 |
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
4. **Ninguém é eliminado por errar pouco.** O jogo é educativo, então todos jogam até o fim, com mecanismos de recuperação. A única eliminação é a **falência**: caixa negativo ao passar pelo Balanço (3.12, decisão nº 13).
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
| 11 | **Cenários de cálculo** (implementado, seção 4.7): a pessoa recebe os dados em tabela, escolhe a métrica, **calcula e informa o valor** (aceito dentro de uma margem), justifica e declara a confiança | Escolher a métrica certa não prova que se sabe calculá-la. O valor informado, com margem para arredondamentos, exige fazer a conta, sem mudar a matriz de pontuação (3.5) |
| 12 | **Rounds e caixa inicial configuráveis** (implementado): 1 a 64 rounds por jogador (padrão 10) e caixa inicial de R$ 10.000 a R$ 1.000.000 (padrão R$ 100.000), ambos escolhidos no menu e limitados também pelo motor | Deixa o grupo ajustar a duração e a folga financeira. O caixa inicial é igual para todos, então não muda quem vence no competitivo; as constantes de dinheiro (valor das casas, balanço, multas) continuam absolutas. No cooperativo, a meta trimestral parte do caixa inicial e as faixas finais são múltiplos dele (50%, 125% e 175%), mas o crescimento por trimestre é fixo: com caixa inicial muito alto, as faixas "Crescimento" e "Líder" ficam inalcançáveis, e com caixa baixo, a meta e as faixas ficam fáceis. A calibrar no playtest |
| 13 | **Falência**: caixa negativo ao passar pelo Balanço elimina o jogador (competitivo e solo) ou encerra a partida (cooperativo) (implementado, 3.12) | Dá consequência real ao prejuízo e faz o chute pesar além do placar. **Diverge do princípio 4** ("ninguém é eliminado") e deixa a 3.9 (recuperação) ainda mais necessária; foi pedida expressamente. Leitura adotada: "balanço negativado" = caixa < 0. A calibrar no playtest: a regra pode quebrar quem só teve azar em eventos |
| 14 | **Sequências de erros e acertos** (implementado, 3.13): cada sucesso absoluto seguido multiplica o fator da sequência por 1,1 (teto 2) e cada erro total seguido por 0,9 (piso 0,5); o fator multiplica o ganho do sucesso e, invertido, a perda do erro total. Evento e Balanço não mexem na sequência | Faz o histórico recente pesar na aposta: errar em série fica caro e acertar em série compensa, sem premiar o acerto parcial. Valores e a leitura de "acertar" e "errar" são pontos de partida a calibrar no playtest; a sequência é por jogador, também no cooperativo |
| 15 | **Dados iguais dão jogada extra** (implementado, 3.2): se os dois dados saem com a mesma face, o jogador resolve a casa normalmente e, ao continuar, joga de novo, sem gastar trimestre. Vale a todos os jogadores e modos, inclusive o rival do solo | Dá ao dado um lance de sorte visível sem tirar o peso do conhecimento (princípio 3): a jogada extra rende mais casas, não mais pontos por decisão. Sem limite de repetições (a chance de cada repetição é 1/6) e a jogada extra não conta como trimestre, então a partida mantém a duração escolhida. Quem faliu na jogada perde a vez e a partida que acabou não continua. Pode ser calibrado no playtest |
| 16 | **Legendas do gráfico** (implementado, 5.9): o eixo X do histograma usa marcas redondas dentro do intervalo dos dados (passo 1, 2 ou 5 × 10^k), e um marcador de revelação só pode ser uma métrica que é **posição** na escala dos dados (média, mediana, moda, percentis, máximo etc.); métricas de dispersão (IQR, desvio padrão, amplitude, CV) não viram linha. O cenário 06 passou a marcar P25 e P75, as bordas da faixa central, como o 18 | O eixo antigo rotulava as pontas do intervalo com folga e mostrava valores que os dados não podem ter (salário negativo, nota 10,2), e o marcador "IQR: 5,8 min" desenhava uma linha na posição 5,8 min do eixo, o que não é onde o IQR está |
| 17 | **Investimentos no Mercado** (implementado, 3.14): duas casas de Mercado oferecem aportar R$ 10 mil, 25 mil ou 50 mil numa empresa do porte da reputação. A pessoa **não vê a chance de sucesso**; a **consultoria** a revela, e libera também lucros e retornos, cobrando de quem investe depois 50% do retorno do sucesso, ou R$ 15.000 se der errado, e os mesmos R$ 15.000 na hora de quem a contrata e não investe. O argumento do fundador carrega (ou não) uma falácia estatística, que a pessoa pode diagnosticar (reputação ±). O resultado é sorteado no próximo Balanço (e no fim da partida, para o que sobrar) | Dá um destino à reputação (ela abre portes melhores de empresa) e leva ao jogo a ideia de risco × retorno, sem virar roleta: investir às cegas rende ≈ 0 em média e a análise rende ≈ +0,19 por real. Segue a proposta de investimentos, com as escolhas do autor: probabilidades ocultas e vendidas como consultoria (como a dica, 3.4), falácias nas fichas e casa própria, para as cartas de Evento continuarem só com lições. O aporte arriscado de um jogador pode pesar no caixa comum do cooperativo; a decisão é do grupo. Fora do modelo: o rival do solo não investe, e a chance de sucesso, os retornos e os aportes são pontos de partida a calibrar no playtest |
| 18 | **Reputação inicial configurável** (implementado): de 10 a 100, em passos de 5 (padrão 50), escolhida no menu como o caixa inicial, igual para todos e, no cooperativo, a da empresa | Deixa o grupo escolher de onde a reputação começa. Reputação alta põe a pessoa no porte maior do Mercado (3.14) e aumenta os ganhos (3.6); reputação baixa aproxima a crise de imagem (zero dispara a multa). As faixas finais do cooperativo continuam absolutas (reputação 75 e 60) e não acompanham a inicial, então uma inicial alta facilita a faixa Líder. Saves antigos valem 50. A calibrar no playtest |
| 19 | **Eventos com escolha de carta** (implementado, 3.15): ao cair numa casa de Evento a pessoa escolhe participar ou passar. Ao participar, vê três cartas viradas, **uma boa, uma ruim e uma troll**, e escolhe uma sem saber qual é qual, como as portas do problema de Monty Hall. As boas são oportunidades bem acima da média, as ruins são reveses pesados e as trolls são vexames engraçados que custam reputação e quase nenhum dinheiro | Troca o sorteio às cegas pela **sensação de escolha**: participar é uma aposta com a composição conhecida (uma de cada), mas posições desconhecidas. O valor esperado em dinheiro fica perto de zero, então passar é uma opção legítima de quem prefere não arriscar, e o custo médio em reputação (as trolls) pesa contra participar sem necessidade. As 18 cartas de lição seguem no jogo (as positivas viram boas e as negativas, ruins), junto de 23 cartas novas. **Troca no estilo Monty Hall:** depois da escolha, o jogo revela uma das outras duas cartas, nunca a boa, e a pessoa decide manter a sua ou trocar pela que sobrou; quem sabe que trocar leva à carta boa em 2 de cada 3 vezes ganha, em média, bem mais que quem mantém. Fora do modelo: o rival do solo não participa. Valores das cartas e o peso dessa vantagem a calibrar no playtest |
| 20 | **Progressão da dificuldade configurável** (implementado, 4.5): o menu (etapa Dificuldade) oferece Gradual, Tradicional (padrão) e Acelerada, que mudam só o ritmo com que a dificuldade-alvo sobe com o progresso (expoente 2,6, 2 ou 1); começo e fim da partida são iguais nas três. Vale a todos os jogadores da partida | A subida linear original fazia os cenários de nível 2 dominarem já com 40% do percurso, rápido demais para quem está aprendendo. Em vez de fixar um ritmo, o grupo escolhe: quem quer desafio usa a Acelerada (a curva original), quem quer mais tempo nos conceitos básicos usa a Gradual. Não muda pontuação nem o acerto do rival do solo, apenas quais cenários saem. Saves antigos valem a Tradicional. Expoentes a calibrar no playtest |

---

## 3. Regras do jogo

### 3.1 Tabuleiro

Circuito de aproximadamente **20 casas**. Cada casa coloca pelo menos uma métrica (dinheiro ou reputação) em jogo.

| Tipo de casa | Qtd. | O que acontece |
| --- | --- | --- |
| **Decisão** | ~8 | Cenário estatístico com gráfico: escolhe a métrica, depois a justificativa. Dinheiro e reputação em jogo |
| **Evento** | ~5 | A pessoa escolhe participar ou passar. Ao participar, escolhe 1 de 3 cartas viradas (uma boa, uma ruim e uma troll), sem saber qual é qual (3.15). As cartas boas e ruins trazem mini-lição (ex.: gráfico com eixo truncado engana um investidor) |
| **Duelo** | ~2 | Mesma pergunta para dois jogadores. Quem acertar leva dinheiro do outro |
| **Mercado** | 2 | Oportunidade de investimento em empresa, com consultoria opcional (3.14). Seguro de reputação e glossário seguem previstos |
| **Imprensa/Auditoria** | ~2 | Reputação em xeque |
| **Início/Balanço** | 1 | Receita fixa, ajustada pela reputação, menos custos; apura também os investimentos do Mercado (3.14) |

**Trilha implementada:** 28 casas, com 1 Balanço (a casa 1), 18 Decisões, 7 Eventos e 2 Mercados (casas 10 e 24). Duelo e Imprensa/Auditoria continuam para a Fase 2.

### 3.2 Estrutura do turno

1. Rola os dois dados e avança a soma.
2. Resolve a casa (decisão, evento, duelo, mercado, auditoria ou balanço).
3. Em casas de decisão: **métrica → justificativa → confiança → resultado → explicação**. Nos cenários de cálculo (4.7), entre a métrica e a justificativa entra a etapa **valor calculado**.
   Na casa de **Mercado**: oferta da empresa → (consultoria e diagnóstico, opcionais) → investir ou recusar → explicação do argumento (3.14).
   Na casa de **Evento**: participar ou passar → (se participar) escolher uma de três cartas viradas → o jogo revela uma das outras (nunca a boa) → manter ou trocar → carta final, com o efeito e as outras duas cartas (3.15).
4. Atualiza o estado e passa a vez. **Exceção (dados iguais):** se os dois dados saíram com a mesma face, o mesmo jogador joga de novo em vez de passar a vez. A jogada extra não gasta trimestre, repete-se enquanto saírem dados iguais e não vale para quem faliu na jogada nem depois do fim da partida (decisão nº 15).

### 3.3 Decisão em duas etapas

- **Etapa 1, escolha prática:** o jogador escolhe a métrica ou ação entre 5 alternativas (ex.: Média, Mediana, Moda, P90, Desvio Padrão). Os distratores são **equívocos conceituais reais**, não absurdos.
- **Etapa 2, justificativa:** o jogador escolhe a afirmação que sustenta a decisão, em um **pool único** por cenário (6 a 8 afirmações, embaralhadas a cada jogada), igual para qualquer alternativa escolhida.

Cada afirmação do pool é marcada com um tipo: `correta`, `parcial`, `erro_conceitual` (com o equívoco associado), `afirmacao_falsa` ou `irrelevante`.

**Cenários de cálculo.** Alguns cenários (4.7) entregam os dados numa tabela e pedem, além da métrica, o **valor calculado** dela. A decisão fica em quatro etapas: métrica → valor → justificativa → confiança. O valor vale se ficar dentro de uma margem do valor exato (4.7).

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

**Dica (nível iniciante).** A dica do cenário fica oculta e o jogador decide abri-la. Quem a abre tem o **bônus** da confiança (a parte acima de ×1) reduzido em 50% **nos ganhos**: confiante vira ×1,125 e certeza absoluta vira ×1,25 (+25% em vez de +50%). Confianças até ×1 e as perdas não mudam, para a dica não reduzir o risco de quem erra. O efeito vale só para a decisão em que a dica foi aberta. Decisão de projeto: a atenuação cobre apenas o bônus acima de ×1.

### 3.5 Matriz de pontuação

Cada casa de decisão tem um valor **V** (proposta inicial: R$ 10.000 a R$ 50.000). Os números abaixo são ponto de partida, a calibrar no playtest.

| Métrica (Etapa 1) | Justificativa (Etapa 2) | Resultado | Efeito no dinheiro |
| --- | --- | --- | --- |
| Certa | Certa | Sucesso absoluto | **+V × confiança** |
| Certa | Errada | Sorte / prepotência | **+0,2V × confiança** |
| Errada | Certa | Incoerência (conceito certo, métrica errada) | **0** |
| Errada | Errada | Erro total | **−0,5V × confiança** |

**Cenários de cálculo.** A matriz é a mesma, e a coluna "Métrica" passa a significar *métrica certa **e** valor dentro da margem*. Quem escolhe a métrica certa mas informa um valor fora da margem cai em "Errada" (incoerência, se a justificativa estiver certa; erro total, se não). O valor é conferido contra a métrica que a pessoa escolheu, então calcular bem a métrica errada também não pontua (4.7).

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
| Ajuda | Glossário e dicas gratuitas nas primeiras casas (a dica fica oculta; abri-la reduz o bônus de confiança, ver 3.4) | Dicas só compradas no Mercado |
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
2. **Métrica e justificativa:** cada uma acerta com probabilidade `p`, de forma independente. Ao errar, escolhe ao acaso entre os distratores, que são equívocos reais. Por isso a tela de resultado mostra o equívoco do rival, e o erro dele também ensina. Nos cenários de cálculo (4.7) o rival informa o valor exato da métrica que escolheu: o acerto da métrica continua sendo `p`, e o calibrado em 3.11 vale sem mudança. Ele não sorteia nada a mais para isso.
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

**Evento (3.15).** O rival também passa pelas casas de Evento sem participar e sem gastar sorteios, como o jogador de referência da simulação, que segue sem participar. Uma pessoa que participa e troca (Monty Hall) tem valor esperado ≈ +R$ 6.500 por Evento, vantagem que a calibração não mede. Com as cartas novas a simulação foi refeita (4.000 partidas): 73,0%, 49,5% e 28,2% de vitória da referência, contra os alvos de 70%, 50% e 30%, dentro da variação da medição anterior (72,2%, 48,4% e 28,1%). Os perfis ficaram como estavam.

**Mercado (3.14).** O rival não investe: passa pela casa de Mercado sem oferta e sem gastar sorteios, então a calibração acima não conta investimentos, e uma pessoa que investe bem se afasta dela. Com as duas casas de Mercado no lugar de dois Eventos, a simulação foi refeita (4.000 partidas): 72,2%, 48,4% e 28,1% de vitória da referência, contra os alvos de 70%, 50% e 30%. Os perfis ficaram como estavam.

**Fora do modelo, de propósito:** *rubber-banding* (o rival errar quando está à frente), porque desfaz a relação entre aprender e ganhar; rival que conhece a resposta e a embaralha; correlação entre métrica e justificativa, e pontos fortes por conceito, que ficam para uma fase posterior.

### 3.12 Falência

**Implementado** (`continuar` em `src/engine/machine.js`; `ehFalido`, `empresaFalida` e `vencedores` em `src/engine/state.js`). Quem chega ao **balanço negativado** (dinheiro abaixo de zero) perde automaticamente. "Balanço negativado" foi lido como caixa negativo, e não como o resultado líquido de um Balanço (a casa) negativo.

- **Quando:** só na jogada em que o peão **passa pela casa do Balanço** (ou cai nela). A checagem é feita ao **continuar**, com o caixa já final da jogada (inclusive o efeito da casa em que o peão parou depois do Balanço). Em qualquer outra jogada o caixa pode ficar negativo sem eliminar: o jogador ganha a chance de se recuperar até o próximo Balanço. A pessoa vê na tela o que causou o prejuízo, com um aviso de falência, antes de ser eliminada. Caixa **zero** não quebra; só abaixo de zero.
- **Quem tem o pior saldo perde (competitivo e solo):** quem passa pelo Balanço negativado fica marcado como `negativado`. Se há outro jogador **negativado com saldo pior que ainda não passou pelo Balanço**, o veredito **espera**: ninguém perde por ora, e o aviso na tela diz quem é esperado. Quando não há mais ninguém assim, perde o de **menor saldo** entre os negativados que passaram pelo Balanço (a reputação desempata). Pode ser quem passou antes: se o rival passa com saldo melhor, ou se recupera para zero ou mais, perde quem esperava. O saldo comparado é o atual, no momento do veredito. Depois de um veredito, as marcas de todos são limpas. Um veredito só elimina uma pessoa por vez, e quem sobreviveu precisa passar negativado de novo para voltar a concorrer.
- **Competitivo e solo:** o jogador marcado como `falido` sai da disputa, é pulado nos turnos seguintes e fica abaixo de todos no ranking, mesmo com mais dinheiro que alguém. Com mais de um jogador, a partida termina assim que sobra um só (ele vence); no solo, se a pessoa quebra o rival vence, e se o rival quebra a pessoa vence. Se não sobra ninguém (jogador único), a partida termina sem vencedor.
- **Cooperativo:** o caixa é da empresa, então ela **vai à falência** e a partida termina na hora, com a faixa "Falência".
- **Investimentos:** o retorno dos aportes apurados na jogada do Balanço entra no caixa antes da checagem (3.14), então um sucesso pode salvar um caixa negativo e um fracasso pode quebrar. Quem faliu perde os aportes em custódia.
- **Sem recuperação:** não há empréstimo nem investidor-anjo ainda (3.9). Por isso o chute sistemático agora pode eliminar, não só empobrecer (consequência da decisão nº 13).


### 3.13 Sequências de erros e acertos

**Implementado** (`fatorSequencia`, `multiplicadorSequencia` e `atualizarSequencia` em `src/engine/scoring.js`; `jogadores[].sequencia`; aplicação em `resolverEscolhas`, `src/engine/machine.js`). Cada jogador acumula uma **sequência**: decisões seguidas terminadas em sucesso absoluto, ou em erro total. A sequência multiplica o resultado em dinheiro da decisão seguinte, com a conta feita sobre a sequência que vinha **antes** dela (a primeira decisão de uma sequência sempre vale ×1).

**Fator da sequência `F`:** cada sucesso seguido multiplica por 1,1, até o teto de 2 (`1,1^n`, atingido no 8º sucesso seguido); cada erro seguido multiplica por 0,9, até o piso de 0,5 (`0,9^n`, atingido no 7º erro seguido).

| Resultado da decisão | Efeito na sequência | Multiplicador no dinheiro |
| --- | --- | --- |
| Sucesso absoluto | `acertos` +1, `erros` zera | Ganho × `F` (bônus com acertos seguidos; ônus, ×0,9ⁿ, se vinha de erros) |
| Erro total | `erros` +1, `acertos` zera | Perda × `1/F` (agrava com erros seguidos, até ×2; alivia com acertos seguidos, até ×0,5) |
| Sorte ou incoerência (acerto parcial) | Zera as duas | ×1 |

- **O que conta como acerto e como erro.** Nos cenários conceituais, o **sucesso** exige métrica e justificativa certas, e o **erro** exige as duas erradas. Nos de cálculo, o sucesso exige métrica, valor (dentro da margem) e justificativa certos, e o erro exige métrica errada ou valor fora da margem (4.7: valor fora da margem invalida a métrica) e justificativa errada. Na prática são as categorias `sucesso` e `erro_total` da matriz 3.5. A sorte (+0,2V) e a incoerência (0) não recebem o fator.
- **Resposta parcial interrompe.** Quem acerta só a metade não está errando em série nem acertando em série, então a sequência recomeça. Isso evita premiar com bônus quem alterna acertos parciais e dá um custo ao parcial: perde-se a sequência.
- **Evento e Balanço não afetam a sequência.** Só as decisões de cenário (casa de Decisão) a movem; cair numa casa de Evento ou de Balanço a deixa como estava.
- **Acumula com os demais fatores.** O multiplicador de sequência entra na mesma conta da confiança, do nível e da reputação: `delta = V × nível × confiança (efetiva) × reputação (só ganhos) × sequência`, arredondado a centenas. Não altera a variação de reputação.
- **Valores (ponto de partida):** `SEQUENCIA_FATOR_ACERTO` 1,1, `SEQUENCIA_TETO` 2, `SEQUENCIA_FATOR_ERRO` 0,9 e `SEQUENCIA_PISO` 0,5, em `src/engine/config.js`.
- **Por jogador, em todos os modos.** A sequência é do jogador que decide, inclusive no cooperativo, onde o dinheiro é da empresa. O rival do modo solo segue a mesma regra. A calibração do rival (3.11) foi reconferida com `scripts/simular-bot.mjs` (1.000 partidas): 70,1%, 48,5% e 29,3% de vitória da referência, contra os alvos de 70%, 50% e 30%. A regra aumenta a variância (desvio padrão da diferença final de R$ 49 a 62 mil, antes R$ 47 a 57 mil).
- **Na tela:** o placar mostra a sequência em andamento e os multiplicadores que a próxima decisão terá (por exemplo, "2 erros seguidos (ganhos ×0,81, perdas ×1,23)"), para a pessoa decidir a confiança sabendo o que está em jogo. A tela de resultado mostra o bônus ou ônus aplicado.
- **Efeito na verificação anti-chute (3.5).** A esperança de um chutador deixa de ser constante: o erro total é o resultado mais provável do chute, então a perda média cresce com a sequência de erros (e os poucos sucessos seguintes rendem menos). O −0,27 × V × confiança vale só para quem não vem de uma sequência.

### 3.14 Investimentos no Mercado

**Implementado** (`src/engine/investimentos.js` e `machine.js`; empresas em `src/scenarios/content/investimentos.js`; fase `MOSTRAR_MERCADO`). Decisão nº 17. Nasceu da proposta de investimentos em empresas, com as escolhas do autor: a chance de sucesso fica oculta e é vendida como consultoria, as fichas carregam falácias estatísticas e o investimento tem casa própria.

**Onde.** Nas duas casas de **Mercado** (10 e 24). Os Eventos não oferecem investimento. O rival do solo passa pela casa sem oferta e nunca investe.

**Porte da empresa pela reputação** (a do jogador, ou a da empresa no cooperativo):

| Reputação | Porte | Retornos típicos |
| --- | --- | --- |
| 0 a 34 | Microempresas e negócios informais | Sucesso de +100% a +220%; fracasso com perda total |
| 35 a 69 | Pequenas e médias empresas e startups | Sucesso de +45% a +80%; perda de 40% a 60% |
| 70 a 89 | Empresas consolidadas e indústrias nacionais | Sucesso de +25% a +35%; perda de 15% a 40% |
| 90 a 100 | Blue chips, petrolíferas e big techs | Sucesso de +15% a +30%; perda de 20% a 40% |

A oferta sai de um baralho por porte, sem repetir empresa dentro do ciclo. A reputação inicial padrão (50, ou a escolhida no menu, decisão nº 18) cai no porte das PMEs; reputações altas dão acesso a empresas mais estáveis, o que dá à reputação um uso além do multiplicador de ganhos (3.6).

**A ficha.** Nome, setor, tempo de mercado, o que o fundador diz e o **lucro (ou prejuízo) dos 4 últimos trimestres, sempre visível**. Ficam ocultos a **chance de sucesso e de fracasso** e o **retorno provável de cada aporte** (em porcentagem e em reais): só aparecem no relatório da consultoria. A pessoa decide pelo texto do fundador e pelos lucros, como nas decisões de cenário.

**Consultoria e relatório.** Botão opcional, como a dica (3.4). **Enquanto a consultoria não entrega o relatório, a chance de sucesso e de fracasso e o retorno provável de cada aporte ficam ocultos** (os botões de aporte mostram só o valor); os lucros da empresa são públicos. Ao contratá-la, o relatório libera a **chance exata** de sucesso e de fracasso e os retornos possíveis em porcentagem e em reais. **Se a pessoa investir depois de ver o relatório,** a consultoria cobra pelo resultado: **50% do retorno** quando der certo (`CONSULTORIA_PENALIDADE`; +80% vira +40%) e **R$ 15.000 de honorários** quando der errado (`CONSULTORIA_HONORARIO_FRACASSO`), além da perda. Por isso o crédito do fracasso pode ficar negativo (R$ 10.000 aportados e perdidos custam R$ 25.000). **Se contratar a consultoria e não investir** (recusar, ou seguir sem decidir), a pessoa paga **os mesmos R$ 15.000 na hora**, debitados do caixa ao fechar a oferta (`honorarioPago` em `mercadoAtual`): o relatório nunca sai de graça. Quem investe não paga na hora; o honorário só vem se der errado. Nunca se paga os dois. O relatório já mostra os retornos descontados.

**Diagnóstico do argumento (opcional).** A pessoa aponta se o que o fundador diz tem uma falha estatística: viés de sobrevivência, falácia da taxa-base, regressão à média, amostra pequena, ou "nenhuma falha". Metade das empresas do catálogo tem uma falha e é uma **furada** (valor esperado negativo); a outra metade tem argumento sólido e é um **bom negócio**, ainda que arriscado. O diagnóstico é conferido **ao decidir** (investir ou recusar): acertar rende **+3 de reputação** e errar custa **−2** (`ANALISE_BONUS_REPUTACAO`, `ANALISE_PENALIDADE_REPUTACAO`). Chutar entre as 5 opções rende −1 de reputação em média, então não compensa. A resposta e a explicação aparecem só depois da decisão, em qualquer caso (princípio 1: toda decisão termina com a explicação), para o diagnóstico não virar uma dica gratuita.

**Aporte.** R$ 10.000, 25.000 ou 50.000 (`APORTES`), no máximo o caixa disponível (a empresa, no cooperativo). Com o caixa abaixo de R$ 10.000 (inclusive negativo) não dá para investir, mas o diagnóstico ainda vale. O valor sai do caixa na hora e fica em **custódia**: o placar mostra "investidos".

**Apuração.** Quando o jogador passa pelo Balanço (ou cai nele), o Balanço regular é calculado e, em seguida, cada aporte dele é sorteado com o rng da partida (determinístico pela seed): com a chance de sucesso sorteada para aquela oferta, o aporte volta com `valor × (1 + ganho)`; senão, com `valor × (1 − perda)`, arredondado a centenas. A tela do Balanço (e o aviso das jogadas que passam por ele) conta, para cada aporte, o que aconteceu e quanto rendeu ou custou. Regras:

- **Cooperativo:** o aporte sai do caixa da empresa e o retorno entra nele **antes da meta** do Balanço, então o investimento pesa na meta trimestral. Os aportes continuam de quem os fez e são apurados quando ele passa pelo Balanço. A quem pesa o risco é decisão do grupo (a conversa faz parte do jogo).
- **Fim da partida:** se os trimestres acabam com aportes em custódia, eles são apurados no encerramento e já entram no caixa do ranking; a tela de fim de jogo mostra a apuração. Falência da empresa ou vitória do último sobrevivente encerram sem apuração, e quem faliu perde os seus.
- O retorno **não** é multiplicado pela reputação, não altera a reputação e não mexe na sequência de erros e acertos (3.13).
- Passando pelo Balanço e caindo em Mercado na mesma jogada, o Balanço apura os aportes antigos antes da nova oferta.

**Chance de sucesso e sorteio.** Cada empresa do catálogo (4.8) tem uma chance base. A cada oferta ela varia até ±0,04 (`SORTEIO_PROBABILIDADE`), para decorar "qual empresa é furada" não bastar. A chance sorteada é a que a consultoria mostra e a que vale na apuração.

**Calibração.** Pontos de partida, a calibrar no playtest. Valor esperado por real aportado, `p × ganho − (1 − p) × perda` (4.8): as furadas ficam entre −0,10 e −0,25 e as sólidas entre +0,10 e +0,30 (depois da consultoria, o valor esperado fica negativo em quase todas, porque o honorário fixo pesa mais no aporte pequeno; só uma sólida, com aporte de R$ 50.000, segue positiva). Investir sem critério em tudo que aparece dá ≈ +0,02 por real, perto de zero (e com variância alta), e escolher só as sólidas dá ≈ +0,19, o que cumpre o princípio 2 (acertar por sorte não compensa). Um aporte de R$ 50.000 numa empresa sólida vale ≈ +R$ 10.000 em média, comparável a uma decisão de cenário de V = R$ 20.000; o teto de R$ 50.000 e o custo da consultoria são os parâmetros mais prováveis de ajuste. Com o custo atual (50% do retorno e R$ 15.000), a consultoria funciona como informação cara: quem investe depois de lê-la quase sempre tem valor esperado negativo, então ela serve sobretudo para decidir recusar ou confirmar uma suspeita. Questão em aberto nº 12.


### 3.15 Eventos: escolher uma carta

**Implementado** (`src/engine/machine.js`, fase `MOSTRAR_EVENTO`; cartas em `src/scenarios/content/eventos.js`). Decisão nº 19. Nasceu do pedido de dar ao jogador a **sensação de escolha** na casa de Evento, em vez de uma carta surpresa.

**Fluxo.** Ao cair numa casa de Evento, a pessoa vê a oferta e decide:

1. **Passar:** a vez segue, sem efeito algum e sem custo (`RECUSAR`; seguir sem decidir, `CONTINUAR`, vale o mesmo).
2. **Participar** (`PARTICIPAR`): três cartas viradas aparecem na mesa. A pessoa sabe que são **uma boa, uma ruim e uma troll**, mas não sabe qual é qual. Escolhe uma (`ESCOLHER_CARTA`, posição 0, 1 ou 2) e **não pode mais desistir**. Nada vale ainda.
3. **Revelação (Monty Hall):** o jogo revela uma das duas cartas que a pessoa não escolheu, **nunca a boa**, e a tela avisa isso. Se a escolhida foi a boa, qualquer uma das outras pode ser revelada (sorteio com o rng da partida); senão, é a outra carta não boa, sem sorteio.
4. **Manter ou trocar** (`MANTER` ou `TROCAR`): a pessoa fica com a sua carta ou troca pela que sobrou na mesa. Só agora o efeito da carta final é aplicado. Não há como voltar atrás.
5. **Carta final:** aparece com o texto, o efeito e a lição, se houver, seguida de uma lição sobre o problema de Monty Hall e das outras duas cartas, com o efeito que teriam, para a pessoa ver o que perdeu ou evitou. Depois, `CONTINUAR`.

**Por que trocar compensa.** A primeira escolha tem 1 chance em 3 de ser a boa, e como a carta revelada nunca é a boa, a que sobrou herda as outras 2 em 3. Quem **sempre troca** termina com a boa em 2 de cada 3 vezes (a ruim e a troll em 1 de 6 cada), e quem **sempre mantém** em 1 de 3. A tela não conta isso antes da decisão, só depois, na lição.

As três cartas e a ordem delas são sorteadas ao cair na casa, com o rng da partida (determinístico pela seed), quer a pessoa participe ou não. O estado fica em `eventoAtual` (ver `docs/formato-de-save.md`).

**Os três tipos.**

| Tipo | Papel | Efeito típico | Lição |
| --- | --- | --- | --- |
| **Boa** (🍀 oportunidade) | Ganho bem acima da média: investidor-anjo, contrato fora da curva, startup que triplica | +R$ 5.000 a +R$ 30.000; reputação de +2 a +8 | Sim |
| **Ruim** (💥 revés) | Perda pesada: carga roubada, sequestro de dados, recall, processo | −R$ 5.000 a −R$ 28.000; reputação de −2 a −7 | Sim |
| **Troll** (🤡) | Vexame engraçado: cartão recusado na frente dos investidores, microfone aberto, slide errado | R$ 0 a ±R$ 1.500; reputação de −1 a −5 | Não (é humor) |

As oportunidades são **ganhos fixos**, não aportes: investir continua sendo coisa da casa de Mercado (3.14). O efeito da carta é fixo e **não** é multiplicado pela reputação, como antes. Reputação que chega a zero dispara a crise de imagem (multa), inclusive por uma troll.

**Baralho.** Há 41 cartas: 16 boas, 16 ruins e 9 trolls (`tipo` em cada uma). As 18 cartas antigas de lição entraram nos baralhos conforme o sinal do efeito (as 9 positivas como boas e as 9 negativas como ruins), e 23 cartas novas se juntaram a elas. Cada tipo tem seu ciclo sem repetição (`baralhoEventos` guarda os ids das cartas ainda não vistas, de todos os tipos numa lista só); ao acabar as cartas de um tipo, aquele tipo é embaralhado de novo. Assim, as cartas boas e ruins variam de tamanho, com as novas bem maiores que as antigas, enquanto as trolls ciclam a cada 9 casas de Evento.

**Cooperativo.** O prejuízo em dinheiro da carta escolhida é reduzido em 30% quando o setor da carta tem diretoria (`docs/modo-cooperativo.md`), e o caixa e a reputação são os da empresa. Vale também para as cartas reveladas ao final, que mostram o valor já amortecido.

**Rival do solo.** Passa pela casa sem participar e sem gastar sorteios, como no Mercado (3.11).

**Valor esperado.** A média das boas é ≈ +R$ 13.000, a das ruins ≈ −R$ 13.250 e a das trolls ≈ +R$ 60; em reputação, +3,6, −3,9 e −3,1. Por participação:

| Estratégia | Boa | Ruim | Troll | Dinheiro | Reputação |
| --- | --- | --- | --- | --- | --- |
| Sempre manter | 1/3 | 1/3 | 1/3 | ≈ −R$ 65 | ≈ −1,1 |
| Sempre trocar | 2/3 | 1/6 | 1/6 | ≈ +R$ 6.500 | ≈ +1,2 |

Quem mantém joga uma aposta de variância, com leve custo de imagem, e passar é uma opção legítima. Quem **troca** tem valor esperado claramente positivo: o conhecimento do problema de Monty Hall vale dinheiro, de acordo com o princípio 3. Em ≈ 2,5 casas de Evento numa partida de 10 turnos, isso são cerca de R$ 16.000 a mais para quem troca. O rival do solo não participa (3.11), então essa vantagem só existe para a pessoa e aumenta a taxa de vitória dela. Valores e peso da vantagem a calibrar no playtest (questão em aberto nº 13).

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
| 14 | Aluguel típico do bairro (**cálculo**) | Assimetria à direita, 11 registros | **Mediana** | Calcular a mediana à mão e não se deixar levar pela média |
| 15 | Espera no pronto-atendimento (**cálculo**) | Cauda longa, 21 registros | **Percentil 90 (P90)** | Calcular um percentil por posição na lista ordenada |
| 16 | Chamados de suporte por cliente (**cálculo**) | Contagens com cauda à direita, tabela de frequências | **Média** | Calcular a média de uma tabela de frequências para projetar um total |
| 17 | Regularidade da embaladora (**cálculo**) | 8 tempos de ciclo | **Desvio padrão** | Calcular o desvio padrão amostral e distingui-lo da amplitude |
| 18 | Estabilidade da carga noturna (**cálculo**) | Dispersão com uma execução travada, 11 registros | **Amplitude interquartil (IQR)** | Calcular quartis e perceber que o IQR resiste ao outlier |
| 19 | Comparando o risco de duas filiais | Duas filiais de portes muito diferentes | **Coeficiente de variação (CV = dp / média)** | Comparar desvios padrões brutos de escalas diferentes |
| 20 | Nota de clima e outliers comportamentais | Sino simétrico com notas 0 e 10 sem critério | **Média aparada** (5% de cada ponta) | Usar a média simples, ou a mediana, quando só as pontas devem ser descartadas |
| 21 | O mistério da taxa de conversão | Taxas que sobem em cada dispositivo e caem no geral | **Paradoxo de Simpson** (mudança no peso dos grupos) | Esquecer que o total é uma média ponderada e desconfiar do painel |
| 22 | Viés na contratação ou ilusão matemática? | Mulheres com taxa de aprovação maior em Engenharia e em Vendas, e menor no geral | **Paradoxo de Simpson** (volume de candidatos por departamento) | Ler a taxa geral como prova de viés sem olhar a composição dos grupos |
| 23 | O aplicativo perfeito | Notas de usabilidade quase todas máximas, só de usuários antigos | **Viés de sobrevivência** (os insatisfeitos já foram embora) | Concluir pela base que sobrou e ignorar quem saiu |
| 24 | O alarme infalível de 99% | 1 fraude em 10.000 transações e um alarme com 1% de erro | **Falácia da taxa base** (falsos positivos) | Tratar a precisão do teste como a chance de o alarme estar certo, ignorando a raridade do evento |
| 25 | A mágica dos anúncios e guarda-chuvas | Gasto com anúncios e vendas sobem e descem juntos | **Correlação não implica causalidade** (variável oculta: a chuva) | Dobrar a verba esperando dobrar as vendas |

O cenário 21 usa o gerador `paradoxo_simpson`: as taxas são fixas (Desktop 6% → 7%, Mobile 2% → 2,5%, geral 4% → 3%) e o sorteio muda só o volume de visitas, com o Mobile indo de 50% para 8/9 do tráfego. A tela mostra a tabela de taxas (`tipo_grafico: 'segmentos'`); as visitas, que explicam a inversão, só aparecem no resultado. Decisão de projeto: os números das taxas estão escritos no texto do cenário (são constantes do gerador, não sorteio). No cenário 20 a média simples quase não se afasta da aparada (as pontas são quase simétricas); o que o cenário avalia é reconhecer a técnica que descarta as pontas. As métricas `cv` (dp / |média|) e `media_aparada` (5% de cada ponta) entram no resumo dos dados e valem como placeholders e marcadores.

Os cenários 22 a 25 vieram de um pacote de questões novas, adaptado ao formato do jogo. Os cenários 22, 24 e 25 mostram uma **tabela de séries** (`tipo_grafico: 'tabela_series'`) em vez de gráfico, e a coluna que explica a resposta fica oculta até o resultado (`dados.ocultas_ate_resultado`): os candidatos de cada grupo no 22, os alarmes disparados no 24 e a chuva de cada mês no 25. O 23 mostra o histograma das notas dos usuários que ficaram. Geradores: `paradoxo_simpson_rh` (taxas e volumes fixos: homens 5% e 20%, mulheres 8% e 25%; geral 18,5% contra 9,7%), `vies_sobrevivencia` (100 notas em meia-normal coladas no 10, média ≈ 9,8, sorteadas por seed), `taxa_base_bayes` (determinístico: 1 fraude, 9.999 legítimas, 1 alarme verdadeiro e 100 falsos, chance real de 1/101) e `correlacao_terceira_variavel` (a chuva sorteada move gasto e vendas; invariante r ≥ 0,92 entre os dois e ≥ 0,9 de cada um com a chuva). Decisões de adaptação: o setor `marketing` do pacote não existe no jogo e o 25 ficou em `dados` (diretoria de Tecnologia, que trata de engajamento digital); os gráficos de barras agrupadas (22), barras empilhadas (24) e dispersão (25) do pacote viraram tabela, como no 21; o 22 usa os valores gerais calculados (18,5% e 9,7%) em vez dos 15% e 10% do pacote, que não batiam com os volumes; e cada cenário ganhou uma justificativa `parcial` para chegar ao mínimo de 6 do pool.

### 4.2 Cenários candidatos (nível avançado e eventos)

- Tamanho de amostra pequeno
- Eixo truncado em gráfico enganoso
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
- **Implementado (sorteio por progresso):** cada cenário tem `dificuldade` de 1 a 3 (1 = a métrica certa é a mais direta; 2 = exige reconhecer o formato dos dados; 3 = exige comparar dispersão ou amostras). Ao cair numa casa de Decisão, o jogo calcula o **progresso do jogador** (casas percorridas, contando as voltas, ÷ turnos da partida × 7 — a média da soma de 2 dados de 6 faces —, limitado a 1) e converte em uma dificuldade-alvo entre 1 e 3 por uma curva `1 + progresso^p × 2`, em que o expoente `p` vem da **progressão** escolhida no menu (decisão nº 20): **Gradual** (`p` = 2,6, os fáceis duram mais), **Tradicional** (`p` = 2, o padrão: com 40% do percurso o alvo é 1,3 e, com 80%, 2,3) ou **Acelerada** (`p` = 1, subida linear). Entre os cenários que ainda restam no baralho, o peso de sorteio é `1 / (1 + 4 × (dificuldade − alvo)²)`. Assim o começo da partida favorece os fáceis e o fim favorece os difíceis, mas nenhum fica excluído, para a partida não ser previsível. O baralho continua sem repetir cenário dentro de um ciclo. O progresso é individual: quem anda mais rápido recebe cenários mais difíceis antes.
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

### 4.7 Cenários de cálculo

**Implementado** (`tipo: 'calculo'` no cenário; `src/engine/calculo.js`; conteúdo em `src/scenarios/content/cenarios.json`, cenários 14 a 18). São cenários de decisão em que a pessoa precisa **fazer a conta**, não só reconhecer a métrica.

**Dados.** Poucas observações (8 a 40), para dar para calcular à mão, em **tabela** (com botão que a copia para colar no Excel: colunas por tabulação, uma linha por registro) e, em alguns cenários, também em gráfico (`dados.exibir`). A tabela mostra os registros na ordem em que chegaram (a pessoa precisa ordená-los) ou, em dados discretos, valor e frequência (`dados.tabela`). Os dados continuam gerados por seed, com invariantes (geradores `amostra_pequena` e `contagens_assimetricas`, e os já existentes com `n` pequeno).

**Fluxo.** Métrica → **valor calculado** → justificativa → confiança. Nas opções de métrica não aparece valor algum (nos cenários comuns aparece, para comparação). Cada opção aponta (`chave`) para a métrica calculável, então a pessoa pode calcular o valor de qualquer opção que escolher.

**Margem.** O valor é aceito se `|informado − exato| ≤ máx(|exato| × margem%, 0,005)`. A margem é relativa ao valor exato da **métrica escolhida** e depende só da grandeza desse valor: **5%** se `|exato| < 100` (valores em unidades) e **2%** se `|exato| ≥ 100` (valores na centena ou mais). Não é configurada por cenário nem por opção, para que a mesma regra valha em todos os cálculos. O piso absoluto trata o valor exato zero (por exemplo, uma moda 0). A tela do valor mostra a regra ("±5% abaixo de 100 e ±2% a partir de 100", sem revelar o valor) e o resultado mostra a margem aplicada e a faixa aceita. Ela absorve arredondamentos, mas não erros de método. Como a margem cai de 5% para 2% em 100, um valor exato pouco abaixo de 100 tem faixa proporcionalmente mais larga que um pouco acima.

**Convenções avisadas na tela do valor,** porque mudam o resultado: percentis e quartis pelo método linear (`PERCENTIL.INC` e `QUARTIL.INC` das planilhas, posição `p × (n − 1) + 1`) e desvio padrão amostral (divisor `n − 1`).

**Calculadora embutida.** Na etapa do valor há uma calculadora de estatísticas (`<details>`, aberto por padrão), anunciada por uma caixa em destaque acima da tabela e dos gráficos, que opera sobre os dados da tabela do cenário: quantidade, soma, média, mediana, moda, mínimo, máximo, amplitude, Q1, Q3, amplitude interquartil (IQR = Q3 − Q1), percentil (campo P, 0 a 100, que só aparece quando a operação escolhida é o percentil), variância e desvio padrão amostrais (`calcularOperacao`, em `src/engine/calculo.js`). Usa as mesmas convenções da conferência (percentil linear, divisor `n − 1`). **Decisão de projeto:** ela faz só a operação pedida; a pessoa ainda escolhe a métrica e decide qual operação aplicar; o resultado calculado é colocado direto no campo do valor, sem confirmar (a pessoa pode ajustá-lo e envia o formulário). Não aparece na escolha da métrica, para não sugerir qual métrica usar, e não entra no estado nem na pontuação. Mostra o resultado com até 4 casas decimais, sem arredondar para a unidade do cenário.

**Pontuação.** Sem mudar a matriz de 3.5: a métrica só conta como certa se a opção for a correta **e** o valor estiver dentro da margem. Valor fora da margem com a métrica certa equivale a métrica errada (incoerência se a justificativa estiver certa, erro total se não). A tela de resultado mostra o valor informado, o valor exato, a faixa aceita e um passo a passo do cálculo (`feedback.como_calcular`), e o título do resultado diz quando o erro foi só de cálculo. O histórico guarda `valor` e `valorCorreto`.

**Decisão de projeto.** "Margem" foi lida como a **tolerância aceita no valor calculado**, e não como uma margem de erro que a pessoa declara junto com o valor. Se for desejada a segunda leitura (a pessoa informa o valor e um intervalo), é uma extensão da etapa de valor, ainda não implementada.

**Material de apoio.** Antes de iniciar, o menu informa a calculadora embutida (sem sugerir planilha ou papel, já que o jogo dispensa material externo). **Decisão:** o menu não oferece mais jogar só com questões conceituais; todos os cenários de cálculo entram em toda partida. O campo `soConceitual` continua aceito pelo motor (`novoJogo`) e nos saves, por compatibilidade, mas nenhuma tela o define.

**Fora do escopo por ora:** cenários de cálculo com duas séries; métricas sem número (frequência por nota); o relatório de fim de jogo ainda não separa acerto de método de acerto de cálculo (só a categoria do resultado entra no perfil).

### 4.8 Empresas do Mercado

**Implementado** (`EMPRESAS` em `src/scenarios/content/investimentos.js`; testes em `tests/investimentos.test.js`). 16 empresas fictícias, 4 por porte, sendo 2 de argumento sólido e 2 com falácia em cada porte. `VE` é o valor esperado por real aportado, `p × ganho − (1 − p) × perda`, (sem consultoria). A coluna "Falha" é o que a ficha esconde no argumento do fundador.

| Porte | Empresa | Falha no argumento | p | Ganho | Perda | VE |
| --- | --- | --- | --- | --- | --- | --- |
| Micro | Padaria Pão Dourado | Viés de sobrevivência (só os 3 amigos que deram certo) | 0,25 | +200% | 100% | −0,25 |
| Micro | Quiosque Sol & Mar | Regressão à média (trimestre de alta temporada como rotina) | 0,25 | +220% | 100% | −0,20 |
| Micro | Oficina do Seu Nonato | Nenhuma (15 anos de dados e clientes recorrentes) | 0,65 | +100% | 100% | +0,30 |
| Micro | Variedades Bem-Vindo | Nenhuma (conta até a loja que fechou) | 0,50 | +150% | 100% | +0,25 |
| PME | ByteStorm Labs | Nenhuma (12 clientes pagantes e as propostas perdidas) | 0,60 | +70% | 50% | +0,22 |
| PME | NutriFácil Franquias | Amostra pequena (8 clientes aprovaram o cardápio) | 0,35 | +70% | 60% | −0,15 |
| PME | Distribuidora Norte Vale | Nenhuma (lucros de todos os trimestres) | 0,70 | +45% | 40% | +0,20 |
| PME | AgroSensor | Taxa-base (sensor de 95% para praga de 1%) | 0,30 | +80% | 60% | −0,18 |
| Consolidada | Indústria Têxtil Fio Forte | Nenhuma (balanços de 42 anos, com as crises) | 0,75 | +30% | 15% | +0,19 |
| Consolidada | Rede Farma Vida | Nenhuma (publica as lojas que não decolaram) | 0,80 | +25% | 20% | +0,16 |
| Consolidada | Rápido Brasil Logística | Regressão à média (lucro recorde de um contrato único) | 0,40 | +30% | 40% | −0,12 |
| Consolidada | Agro Campo Dourado | Viés de sobrevivência (só as fazendas que prosperaram) | 0,40 | +35% | 40% | −0,10 |
| Elite | Petrolífera Atlântica S.A. | Nenhuma (relatório com campos desativados e riscos) | 0,80 | +22% | 25% | +0,13 |
| Elite | Conglomerado Financeiro Meridional | Nenhuma (inadimplência de quatro crises) | 0,85 | +15% | 20% | +0,10 |
| Elite | NeuroCore IA | Taxa-base (99% de acerto para fraude de 1 em 10.000) | 0,40 | +30% | 40% | −0,12 |
| Elite | Conglomerado Orion | Amostra pequena (3 projetos-piloto contra um histórico de 8%) | 0,40 | +30% | 40% | −0,12 |

Invariantes testados: o valor esperado de toda furada é negativo mesmo no pior sorteio da chance (+0,04) e o de toda sólida é positivo no melhor (−0,04); cada falácia do diagnóstico aparece em ao menos uma empresa; cada porte tem ao menos 2 empresas sólidas e 2 furadas; investir sem critério fica perto de zero em cada porte. As taxas e retornos diferem um pouco das faixas da proposta original para manter essas propriedades. Como o ganho sobe com o risco, o porte dos micronegócios tem ganho alto e perda total, e o dos consolidados tem retornos curtos, mas as furadas aí perdem até 40% (mais que o "−10% a −20%" da proposta), para o valor esperado poder ficar negativo com um ganho tão curto. Como criar uma empresa: [docs/criar-cenarios.md](docs/criar-cenarios.md).


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
                  ├─ Decisão ─> ESCOLHER_METRICA ─> [INFORMAR_VALOR, só em cenário de cálculo] ─> ESCOLHER_JUSTIFICATIVA ─> ESCOLHER_CONFIANCA ─> MOSTRAR_RESULTADO ─> MOSTRAR_EXPLICACAO
                  ├─ Evento ──> MOSTRAR_EVENTO ─> [PARTICIPAR ─> ESCOLHER_CARTA ─> MANTER | TROCAR (efeito aplicado) | RECUSAR] ─> CONTINUAR
                  ├─ Duelo ───> (jogador A e B respondem em tela oculta) ─> COMPARAR ─> MOSTRAR_EXPLICACAO
                  ├─ Mercado ─> MOSTRAR_MERCADO ─> [ABRIR_CONSULTORIA] [DIAGNOSTICAR] ─> INVESTIR | RECUSAR ─> CONTINUAR
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
  dinheiroInicial: 100000,
  reputacaoInicial: 50,
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
      investimentos: [           // aportes do Mercado em custódia, apurados no próximo Balanço (3.14)
        { empresaId: "bytestorm_labs", valor: 25000, prob: 0.58, ganho: 0.7, perda: 0.5, consultoria: false }
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

**Cenário de cálculo (4.7).** Acrescenta ao schema acima: `tipo: "calculo"`; em `dados`, `exibir` (`["tabela"]` ou `["tabela", "grafico"]`) e `tabela` (`"valores"` ou `"frequencias"`); em cada opção, `chave` (métrica calculável); em `feedback`, `como_calcular`. A margem não é campo do cenário (ver 4.7). O texto das opções não pode ter placeholders. O validador confere tudo isso.

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

### 5.8.1 Atalhos de teste

Para testar uma parte do jogo sem esperar o sorteio, o menu de nova partida tem a seção **Atalhos de teste** (fechada por padrão), com duas opções independentes:

- **Casa em que o peão cai:** normal (pelo tabuleiro), sempre Decisão, sempre Evento, sempre Mercado ou sempre Balanço. O peão anda os dados normalmente, mas a casa resolvida é a forçada (no Balanço forçado o resultado do Balanço também é calculado).
- **Cenários sorteados:** todos, só os de cálculo, só os sem cálculo ou um cenário específico. O baralho passa a conter apenas esses cenários (com um só, ele se repete a cada Decisão); o sorteio por dificuldade segue valendo dentro do subconjunto.

Para testar os cenários de cálculo sempre: casa "Sempre Decisão" e cenários "Só os de cálculo". A partida de teste mostra o selo "Partida de teste" no topo. As regras, a pontuação e o fim de jogo não mudam; é só uma restrição do que cai a cada rolagem, gravada em `teste` no estado.

### 5.8.2 Tela da partida

O tabuleiro ocupa toda a tela, sob um topo fixo, num retângulo de proporção aproximada de 4:3 (largura:altura, grade 9x7) em tela deitada e 3:4 (grade 7x9) em tela em pé; a trilha continua com as mesmas 28 casas no perímetro. Todas as casas são quadradas e do mesmo tamanho (os peões ficam sobrepostos ao canto, sem alterar o tamanho) e cada tipo tem uma figura: 📊 Decisão, 🎲 Evento, 💼 Mercado e 🏦 Balanço. No **centro** ficam a vez, os dados da última rolagem, o botão **Jogar** (no solo, durante a vez do rival, "Ver a jogada do rival"), o placar e o contexto da Fisher S.A. Ao rolar, os dados giram e o peão anda; ao chegar na casa, a etapa correspondente (pergunta da casa de Decisão com tabela, gráfico e alternativas; resultado; evento; balanço; fim de jogo) **aparece sobreposta ao tabuleiro**, num painel modal. Ao continuar, o painel some e o botão Jogar volta para o próximo jogador. Só a apresentação mudou: a máquina de estados e as regras são as mesmas.

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
| O investimento virar roleta de ações e diluir o caráter pedagógico (3.14) | Chance oculta e vendida como consultoria; fichas com falácias estatísticas que a pessoa precisa reconhecer; investir às cegas rende ≈ 0 em média |
| O Mercado tomar o espaço das lições de Evento | Casa própria: os Eventos seguem com cartas de lição (7 casas de Evento, 2 de Mercado) |
| As cartas trolls e os ganhos grandes dos Eventos diluírem o caráter pedagógico | Toda carta boa ou ruim traz uma lição estatística; só as trolls ficam sem lição, por serem humor. O valor esperado de participar é perto de zero, então a sorte não substitui as decisões de cenário (3.15) |
| Aporte arriscado de um jogador arruinar o caixa comum no cooperativo | Aceito: o grupo conversa sobre o risco, que faz parte do jogo (3.14) |

---

## 8. Questões em aberto

1. **Nível por jogador ou por partida?** Recomendação: por jogador.
2. **Tema e tom:** uma só empresa (startup, indústria, e-commerce) ou um conglomerado em que cada casa é uma área? Os 4 cenários atuais sugerem empresas diferentes.
3. ~~**Número de turnos:** fixo em 10, 12 ou configurável?~~ Resolvida: configurável no menu, de 1 a 64 (decisão nº 12). Falta calibrar o balanceamento nos extremos (ver decisão nº 12).
4. **Justificativa `parcial`:** conta como certa, errada ou meio-termo?
5. **Escolha da justificativa:** uma só afirmação ou seleção de 2 entre 6? (Selecionar 2 reduz o chute e permite crédito parcial.)
6. **Mecanismo de recuperação:** empréstimo, investidor-anjo ou crise com efeito atrasado?
7. **Valores de V, multiplicadores e receita do balanço:** a calibrar em playtest.
8. **Nome e identidade do jogo**, e o tom da narrativa.
9. **Stack final:** HTML/JS puro ou React; Chart.js ou SVG próprio.
10. **Plano de playtest:** quem testa, e quais métricas coletar (acerto por cenário, onde travam, o chute compensa?).
11. **Perfil de desempenho (4.6) depois do fim da partida:** o relatório já aparece na tela de fim de jogo e pode ser impresso, mas se apaga com o save em `FIM_DE_JOGO`. Falta decidir se deve ficar guardado (histórico entre partidas) e se os equívocos recorrentes entram no relatório (exigiria um rótulo legível para cada id de equívoco).
12. **Calibração do Mercado (3.14):** o teto do aporte (R$ 50.000), o custo da consultoria (50% do retorno e R$ 15.000 no fracasso), as chances e retornos de cada empresa e o bônus e a perda do diagnóstico (+3 e −2 de reputação). Observar no playtest se investir em empresas sólidas domina as decisões de cenário como fonte de dinheiro, se a consultoria é usada, se o diagnóstico é lido ou ignorado e se o cooperativo discute o risco. O catálogo tem 16 empresas, então partidas repetidas reaproveitam fichas (a chance varia ±0,04, mas a história é a mesma).
13. **Calibração dos Eventos (3.15):** o tamanho das cartas boas (de +R$ 5.000 a +R$ 30.000) e ruins (de −R$ 5.000 a −R$ 28.000), o custo em reputação das trolls (−1 a −5) e a proporção entre as cartas de lição antigas, menores, e as novas, maiores. Observar no playtest se a pessoa participa sempre ou nunca (o valor esperado está perto de zero em dinheiro e levemente negativo em reputação), se a variação de um Evento pesa mais que uma Decisão e se a falência por azar aparece. Com a troca de carta (Monty Hall), quem troca ganha ≈ +R$ 6.500 por Evento: observar se a pessoa descobre a troca, se a vantagem pesa demais frente ao rival do solo (que não participa) e se vale fazer o rival participar e trocar, ou reduzir o tamanho das cartas boas.

---

## 9. Roadmap

| Fase | Entrega | Critério de sucesso |
| --- | --- | --- |
| **0. Protótipo em papel (opcional)** | 1 cenário, 6 cartas de justificativa, marcador de dinheiro, aposta de confiança | 2 a 3 pessoas jogam e discutem; o chute não compensa |
| **1. MVP jogável** | Tabuleiro com 3 jogadores, dois dados, casas de decisão e evento, aposta de confiança, 4 cenários do nível iniciante, resultado e explicação | Uma partida completa roda do início ao fim sem erros |
| **2. Conteúdo e balanceamento** | 8+ cenários, Mercado (investimentos implementados, 3.14; faltam seguro de reputação e glossário), Duelo, Auditoria, geração por seed, testes de simulação | Chutar perde dinheiro; saber tudo ganha |
| **3. Nível avançado** | Simpson, viés de sobrevivência, taxa-base, correlação vs. causalidade | Playtest com jogadores mistos equilibrado |
| **4. Polimento** | Acessibilidade, persistência, glossário, tutorial | Pessoas novas jogam sem ajuda |
| **5. Futuro** | Repetição espaçada, modo texto livre com IA local, inglês, multiplayer online | Conforme demanda |

---

## 10. Apêndice: correções ao documento original

- **Média do Cenário 01:** com os dados `[5000, 5000, 5000, 5000, 15000, 250000]`, a média é **R$ 47.500**, não R$ 10.700. A mediana (R$ 5.000) estava correta. No novo schema, os valores são calculados a partir dos dados (`{{media}}`, `{{mediana}}`), para evitar esse tipo de erro.
- **Tamanho do dataset:** 6 valores são poucos para mostrar a forma de uma distribuição; usar de 30 a 50 pontos gerados por seed.
- **Modelo de IA:** o modelo citado é em inglês e não atende PT-BR (ver seção 6).
- **Justificativas:** o formato 5×5 foi substituído por pool único por cenário (ver seção 2, decisão 3).