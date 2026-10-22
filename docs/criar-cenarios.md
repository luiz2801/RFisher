# Guia de autoria de conteúdo

Como adicionar ou alterar **cenários** (casas de Decisão), **cartas de evento** (casas de Evento) e **geradores de dados**. Para quem escreve conteúdo, com ou sem experiência no motor do jogo.

Referências: regras em [fisher.md](../fisher.md) (seções 3 e 4), schema original na seção 5.5 e validação na seção 5.8. Este guia descreve o que o **código atual** aceita. Onde ele difere do `fisher.md`, a diferença está na seção [Diferenças em relação ao fisher.md](#diferenças-em-relação-ao-fishermd).

## Onde fica cada coisa

| O quê | Arquivo |
| --- | --- |
| Cenários (lista `CENARIOS`) | [src/scenarios/content/iniciante.js](../src/scenarios/content/iniciante.js) |
| Cartas de evento (lista `EVENTOS`) | [src/scenarios/content/eventos.js](../src/scenarios/content/eventos.js) |
| Geradores de dados e invariantes | [src/scenarios/generators.js](../src/scenarios/generators.js) |
| Placeholders, instanciação e validador | [src/scenarios/loader.js](../src/scenarios/loader.js) |
| Métricas calculadas (média, P90, ...) | [src/stats/metrics.js](../src/stats/metrics.js) |
| Formatos de número (R$, dias, ...) | [src/stats/format.js](../src/stats/format.js) |
| Setores e diretorias | [src/engine/papeis.js](../src/engine/papeis.js) |

## Ideia central

Um cenário não guarda números. Ele guarda uma **receita**: um gerador, parâmetros e textos com **placeholders**. A cada vez que a casa é sorteada, o gerador cria dados novos a partir da seed da partida, o jogo calcula as métricas e os textos são preenchidos. Decorar a resposta não adianta, mas a resposta correta precisa continuar correta para qualquer sorteio. É isso que o **invariante** do gerador garante.

Consequência prática: **nunca escreva um número de dado à mão no texto**. Use `{{media}}`, `{{p90}}` etc.

## Criar um cenário

### Passo a passo

1. Defina o **equívoco** que o cenário ensina (por exemplo, "usar a média quando há outliers") e a **métrica correta**.
2. Escolha ou crie um **gerador** que produza dados em que essa métrica é claramente a correta (ver [Geradores](#geradores)).
3. Escreva o objeto do cenário em `iniciante.js` seguindo o [modelo](#modelo-de-cenário).
4. Inclua o cenário no array exportado `CENARIOS`, no final do arquivo.
5. Rode `npm test`. O validador e os testes de invariante rodam sobre todos os cenários automaticamente.
6. Adicione um teste específico do invariante em `tests/generators.test.js` (como os dos cenários 1 e 4 a 13).
7. Atualize a documentação (ver [Checklist](#checklist-antes-de-concluir)).

### Modelo de cenário

```js
const cenarioNN = {
  id: 'cenario_09_exemplo',          // único; snake_case
  setor: 'logistica',                // um de SETORES (ver tabela de setores)
  conceito: 'percentil',             // id de CONCEITOS (src/scenarios/content/conceitos.js)
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  dificuldade: 1,                    // 1 a 3; define quando o cenário tende a aparecer
  titulo: 'Título curto da situação',
  contexto: 'Você precisa decidir X com base em {{n}} registros. Qual métrica deve usar?',
  dica: 'Pista mostrada só a jogadores de nível iniciante.',
  valor_base: 20000,                 // V: base do dinheiro ganho ou perdido
  dados: {
    gerador: { tipo: 'cauda_longa', parametros: { /* depende do gerador */ } },
    formato: 'dias',                 // como formatar os números (ver Formatos)
    rotulo_x: 'Tempo (dias)',
    rotulo_y: 'Pedidos',
    tipo_grafico: 'histograma',      // 'histograma' ou 'barras_discretas'
    descricao_acessivel: 'Texto que descreve o gráfico para quem não o vê.',
  },
  opcoes: [ /* exatamente 5 */ ],
  justificativas: [ /* de 6 a 8 */ ],
  feedback: { por_equivoco: { /* ... */ }, explicacao_correta: '...', revelacao: { marcadores: [ /* ... */ ] } },
  impacto,                           // constante { reputacao_acerto: 5, reputacao_erro: -10 }
};
```

### Campos

| Campo | Regra |
| --- | --- |
| `id` | Único entre todos os cenários. |
| `setor` | Obrigatório e válido (ver [Setores](#setores)). No modo cooperativo define quem é o responsável pela decisão. |
| `conceito` | Obrigatório, id de `CONCEITOS` em [src/scenarios/content/conceitos.js](../src/scenarios/content/conceitos.js). Diz o que o cenário avalia; o perfil de desempenho do fim de jogo agrega erros e acertos por conceito (`fisher.md` 4.6). Reutilize um conceito existente se o cenário treina a mesma ideia; para um novo, acrescente id e nome ao catálogo. |
| `dificuldade` | Obrigatório, inteiro de 1 a 3 (`DIFICULDADE_MAX`). Ver [Dificuldade](#dificuldade). |
| `contexto` | Narrativa e pergunta. Pode usar placeholders. |
| `dica` | Opcional. Aparece só para jogadores de nível iniciante. |
| `valor_base` | V da matriz de pontuação (`fisher.md` 3.5). Hoje todos usam 20.000; o nível avançado multiplica por 1,5. |
| `dados.formato` | Define a formatação de todos os placeholders numéricos. |
| `dados.tipo_grafico` | `barras_discretas` para dados inteiros e poucos valores (numerações, notas); qualquer outro valor vira histograma. |
| `dados.descricao_acessivel` | Obrigatória por convenção: é a descrição textual do gráfico (`fisher.md` 5.9). |
| `impacto` | Variação de reputação por acerto e por erro. Reutilize a constante `impacto` do arquivo, salvo motivo para variar. |

### Dificuldade

O jogo sorteia cenários com dificuldade crescente ao longo da partida (`fisher.md` 4.5): quanto mais o jogador avançou na trilha, mais o sorteio favorece cenários de dificuldade alta. Escolha o valor pelo que o jogador precisa fazer, não pela conta:

| Valor | Critério | Cenários atuais |
| --- | --- | --- |
| 1 | A métrica correta é a mais direta (centro de um conjunto com ou sem um único valor atípico, a categoria mais frequente, ou o máximo quando todos precisam caber). | 01, 03, 07, 09 |
| 2 | Exige reconhecer o formato dos dados (cauda longa, bimodal, assimetria à esquerda), ler a definição de um percentil ou pensar em dispersão. | 02, 04, 05, 10, 11 |
| 3 | Exige comparar dispersão robusta com sensível a outliers, comparar amostras, pesar risco contra média, ou perceber que o objetivo (um total) muda a métrica. | 06, 08, 12, 13 |

Mantenha ao menos um cenário em cada nível, senão o início ou o fim da partida perde o efeito (há teste para isso). O peso de sorteio e o passo médio do dado estão em `src/engine/config.js`; a lógica, em `src/engine/dificuldade.js`.

### Opções de métrica

Exatamente **5**, com **uma** correta. Cada errada precisa de um `equivoco`.

```js
{ id: 'mediana', texto: 'Mediana ({{mediana}})', correta: true },
{ id: 'media', texto: 'Média aritmética ({{media}})', correta: false, equivoco: 'ignora_outliers' },
```

- Mostre o valor calculado no texto da opção (`{{mediana}}`), para o jogador comparar números reais.
- Os distratores devem ser equívocos reais e plausíveis, não opções absurdas.
- A ordem é embaralhada a cada partida; não dependa dela.

### Justificativas

De **6 a 8**, com **exatamente uma** `correta`. Tipos aceitos:

| `tipo` | Para que serve | Conta como certa? | Precisa de `equivoco`? |
| --- | --- | --- | --- |
| `correta` | O raciocínio completo e certo. | Sim | Não |
| `parcial` | Meia verdade: certa, mas incompleta. | **Não** (decisão atual, ver README) | Não |
| `erro_conceitual` | Confunde um conceito (ex.: mediana com moda). | Não | Sim |
| `afirmacao_falsa` | Afirma algo matematicamente falso. | Não | Sim |
| `irrelevante` | Verdadeira ou não, mas sem relação com a decisão. | Não | Não |

Um pool típico tem 1 `correta`, 1 `parcial`, 2 `erro_conceitual`, 1 `irrelevante` e 1 `afirmacao_falsa`, como nos cenários existentes.

A justificativa é avaliada **separadamente** da métrica. Por isso é possível acertar a métrica por sorte (justificativa errada) ou ter a justificativa certa com a métrica errada. Escreva as erradas para que, de fato, não sustentem a métrica correta.

### Equívocos e feedback

Um `equivoco` é um identificador (`ignora_outliers`) que liga uma opção ou justificativa errada a uma explicação em `feedback.por_equivoco`. Regras:

- Todo `equivoco` usado em opções ou justificativas **precisa** ter entrada em `feedback.por_equivoco`.
- O mesmo equívoco pode aparecer em uma opção e em uma justificativa; o feedback é o mesmo.
- O feedback mostrado ao jogador vem da **justificativa** escolhida, se ela tiver `equivoco`; caso contrário, uma mensagem padrão por tipo.
- Escreva o feedback explicando **o que o jogador deveria ter notado nos dados**, usando os números do sorteio.

`feedback.explicacao_correta` aparece quando o jogador erra e resume por que a métrica correta é a correta.

### Revelação visual

```js
revelacao: {
  marcadores: [
    { chave: 'mediana', rotulo: 'Mediana', correto: true },
    { chave: 'media', rotulo: 'Média' },
  ],
}
```

Cada marcador desenha uma linha no gráfico do resultado. `chave` é uma das métricas da [tabela de placeholders](#placeholders). Em cenários com duas séries, a chave sem sufixo se refere à série A; use `chave: 'media'` e o jogo resolve por série. O marcador `correto: true` destaca a resposta certa.

### Placeholders

Escreva `{{nome}}` em `contexto`, `dica`, `opcoes[].texto`, `justificativas[].texto`, `feedback.por_equivoco` e `feedback.explicacao_correta`. O jogo substitui pelo valor calculado dos dados sorteados e formatado conforme `dados.formato`.

| Placeholder | Significado |
| --- | --- |
| `{{n}}` | Número de observações da série A |
| `{{media}}`, `{{mediana}}`, `{{moda}}` | Medidas de centro |
| `{{p25}}`, `{{p75}}`, `{{p90}}`, `{{p95}}` | Percentis |
| `{{iqr}}` | Amplitude interquartil (P75 − P25) |
| `{{amplitude}}` | Máximo − mínimo |
| `{{dp}}` | Desvio padrão amostral (n − 1) |
| `{{minimo}}`, `{{maximo}}`, `{{ponto_medio}}` | Extremos e ponto médio |

Em cenários com mais de uma série, use o sufixo da série: `{{media_a}}`, `{{dp_b}}`. Sem sufixo vale a série A. Um placeholder inexistente é erro de validação.

### Formatos

`dados.formato` aceita: `brl` (R$ 1.234), `dias`, `minutos`, `gramas`, `porcento`, `mm` (duas casas), `cm` e `ms` (inteiros) e qualquer outro valor, que usa o formato numérico simples (`numero`). Todos usam separadores de `pt-BR`. Para um formato novo, acrescente um `case` em [src/stats/format.js](../src/stats/format.js) e um teste.

### Setores

O setor liga o cenário a uma diretoria no **modo cooperativo** (ver [modo-cooperativo.md](modo-cooperativo.md)).

| Diretoria | Setores |
| --- | --- |
| Operações | `logistica`, `producao` |
| Tecnologia | `dados`, `produto` |
| Pessoas e Finanças | `rh`, `atendimento`, `financeiro` |

Equilibre o conteúdo: todo setor deve ter cenários e eventos, senão uma diretoria quase nunca decide nada.

## Geradores

Um gerador cria os dados do cenário e declara um **invariante**: a condição matemática que prova que a resposta correta continua correta. Se o sorteio não satisfaz o invariante, o jogo sorteia de novo (até 200 vezes, depois lança erro).

### Reutilizar um gerador existente

Ajuste só os `parametros` e o texto do cenário.

| Gerador | Parâmetros | Invariante | Cenário |
| --- | --- | --- | --- |
| `assimetria_direita` | `n`, `base`, `ruido`, `outliers[{valor, qtd}]` | média > 1,5 × mediana e máximo > 10 × mediana | 01 |
| `cauda_longa` | `n`, `base`, `ruido`, `proporcaoCauda`, `caudaMin`, `caudaMax` | P90 > 3 × média | 02, 10 |
| `categorico_discreto` | `n`, `tamanhoMin`, `pesos[]` | moda destacada, moda ≠ mediana, média não inteira | 03 |
| `mesma_media_variancia_distinta` | `n`, `media`, `dpA[min,max]`, `dpB[min,max]`, `nomes[2]` | médias iguais (< 0,01) e dp B > 5 × dp A | 04 |
| `bimodal_polarizado` | `n`, `pesos[5]` | picos em 1 e 5, vale em 3, média central | 05 |
| `dispersao_outliers` | `n`, `baseMin`, `baseMax`, `outliers[]` | dp > 3 × IQR, mediana ≤ 25, IQR > 0 | 06 |
| `distribuicao_normal_simetrica` | `n`, `media`, `dp` | \|média − mediana\| < 0,6 e média ≈ 500 | 07 |
| `comparacao_amostral` | `nA`, `mediaA`, `dpA`, `nB`, `mediaB`, `dpB`, `nomes[2]` | dp B > 4 × dp A e média B > média A | 08, 12 |
| `limite_fisico` | `n`, `media`, `dp` (valores inteiros) | máximo − P95 ≥ 0,25 × dp e máximo > média + 1,5 × dp | 09 |
| `assimetria_esquerda` | `n`, `base`, `ruido`, `outliers[{valor, qtd}]` | mediana − média > 6 % da mediana e mínimo < metade da mediana | 11 |
| `inflado_em_zero` | `n`, `proporcaoZero`, `valorMin`, `valorMax` | mediana = 0, ao menos 55 % de zeros e média > 10 % do máximo | 13 |

Atenção: alguns invariantes têm números fixos do cenário original (por exemplo, média ≈ 500 em `distribuicao_normal_simetrica`). Mudar os parâmetros para fora desse intervalo faz o gerador falhar. Se precisar de outros valores, torne o invariante dependente dos parâmetros.

### Criar um gerador novo

1. Em `generators.js`, acrescente uma entrada em `GERADORES` com `gerar(parametros, rng)` e `invariante(series)`.
2. `gerar` devolve `{ series: [{ nome, valores }] }`. Use **apenas** o `rng` recebido (`prox`, `entre`, `inteiro`, `normal`, `embaralhar`). Nunca `Math.random()` nem `Date.now()`: isso quebraria a reprodutibilidade por seed e o save.
3. `invariante` recebe um array de arrays de valores (uma série por posição) e devolve `true` ou `false`.
4. Escolha um invariante que prove o ponto pedagógico, não só "dados válidos".
5. Escreva o teste em `tests/generators.test.js` com as propriedades nomeadas.
6. Se o cenário usar o gráfico discreto, confirme que os valores são inteiros.

Dicas: `padronizado(n, media, dp, rng, casas)` gera uma série com média e desvio exatos; os invariantes devem ter folga para que o sorteio passe em poucas tentativas.

## Criar uma carta de evento

Em `eventos.js`, acrescente um objeto a `EVENTOS`:

```js
{
  id: 'regressao_media',            // único
  setor: 'rh',                      // um de SETORES
  titulo: 'A ilusão do mês recorde',
  texto: 'Situação narrada como acontecimento na empresa.',
  licao: 'O conceito estatístico em uma frase.',
  dinheiro: -5000,                  // pode ser positivo ou negativo
  reputacao: -2,
}
```

- **Sorte ou revés com mini-lição:** o texto narra o fato; a `licao` nomeia o conceito. Há eventos bons (o jogador evitou o erro) e ruins (caiu nele).
- O efeito é fixo e **não** é multiplicado pela reputação.
- No cooperativo, o prejuízo (`dinheiro < 0`) de um evento do setor de uma diretoria é reduzido em 30 % (`REDUCAO_PREJUIZO_PASSIVA`). Ganhos não são alterados.
- Reputação que chega a 0 dispara a crise de imagem (multa e recuperação parcial).
- Ordens de grandeza usadas hoje: dinheiro de −10.000 a +10.000 e reputação de −5 a +5. Mantenha o equilíbrio entre cartas positivas e negativas (hoje 9 positivas e 9 negativas), senão o jogo tende a punir sem compensar.
- Eventos não têm validação além do setor. Revise à mão: id único, `licao` presente, valores numéricos.

## Estilo de escrita

- Português do Brasil, tom de situação de trabalho (você é a pessoa que decide).
- Frases curtas. Um conceito por cenário.
- Evite jargão não ensinado e siglas sem explicação (defina o P90 na dica ou no feedback).
- Não revele a resposta no `contexto` nem na `dica`.
- O feedback explica **por que** o equívoco é tentador e **o que** nos dados o desmente.
- Distratores plausíveis: o jogador precisa sentir que errou por um motivo compreensível.

## Validação

`npm test` executa, entre outros, estes testes sobre todo o conteúdo:

- `validarCenario` em várias seeds. Ele reporta: dificuldade inválida ou ausente, setor inválido, conceito fora do catálogo, número de opções ≠ 5, opções corretas ≠ 1, justificativas fora de 6–8, justificativas corretas ≠ 1, `equivoco` sem feedback, opção errada sem `equivoco`, tipo de justificativa inválido, placeholder inexistente e marcador sem valor.
- Unicidade dos `id` dos cenários.
- `dificuldade` inteira de 1 a 3 em todo cenário, com ao menos um cenário por nível.
- Invariantes de todos os geradores em 1.000 seeds.
- Todas as telas renderizam sem `{{`, sem `undefined` e sem HTML injetado.
- Todo evento tem setor válido.

O validador **não** confere que a opção marcada `correta` é de fato a correta matematicamente. Isso é responsabilidade do invariante e da revisão humana.

## Checklist antes de concluir

- [ ] `id` único; `setor` válido; `conceito` do catálogo; `dificuldade` de 1 a 3.
- [ ] 5 opções (1 correta); 6–8 justificativas (1 `correta`).
- [ ] Todo `equivoco` tem feedback.
- [ ] Nenhum número de dado escrito à mão; só placeholders.
- [ ] O invariante prova o ponto pedagógico e passa em 1.000 seeds.
- [ ] Teste específico do gerador adicionado ou atualizado.
- [ ] `dados.formato` e rótulos dos eixos corretos; `descricao_acessivel` escrita.
- [ ] Cenário incluído em `CENARIOS` (ou evento em `EVENTOS`).
- [ ] README atualizado: contagem e lista de cenários e eventos (obrigatório pelo `CLAUDE.md`).
- [ ] `fisher.md` atualizado se o conteúdo mudar a especificação (seção 4).
- [ ] `docs/diagramas-uml.md` atualizado se a estrutura mudar (novo gerador ou módulo).
- [ ] `npm test` passa.

## Diferenças em relação ao fisher.md

O schema da seção 5.5 do `fisher.md` é anterior à implementação. O código atual difere em:

| Ponto | `fisher.md` 5.5 | Código |
| --- | --- | --- |
| Tamanho da amostra | `dados.gerador.n` | `dados.gerador.parametros.n` |
| `setor` | ausente | obrigatório (modo cooperativo) |
| `conceito` | presente no exemplo da 5.5 | obrigatório, validado contra `CONCEITOS` |
| `dica` | ausente | opcional, só para iniciantes |
| `dados.formato` | ausente | formata os placeholders |
| `feedback.revelacao` | lista de nomes (`["histograma_com_media_e_mediana"]`) | objeto com `marcadores[{chave, rotulo, correto}]` |
| Validação por JSON Schema/Zod | prevista | substituída por `validarCenario` |

Estas diferenças ainda precisam ser reconciliadas no `fisher.md`.
