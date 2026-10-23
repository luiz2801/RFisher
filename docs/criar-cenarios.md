# Guia de autoria de conteúdo

Como adicionar ou alterar **cenários** (casas de Decisão), **cartas de evento** (casas de Evento), **empresas do Mercado** (casas de Mercado) e **geradores de dados**. Para quem escreve conteúdo, com ou sem experiência no motor do jogo.

Referências: regras em [fisher.md](../fisher.md) (seções 3 e 4), schema original na seção 5.5 e validação na seção 5.8. Este guia descreve o que o **código atual** aceita. Onde ele difere do `fisher.md`, a diferença está na seção [Diferenças em relação ao fisher.md](#diferenças-em-relação-ao-fishermd).

## Onde fica cada coisa

| O quê | Arquivo |
| --- | --- |
| Banco de cenários, incluindo os de cálculo (array JSON) | [src/scenarios/content/cenarios.json](../src/scenarios/content/cenarios.json) |
| Margem, valor exato e notas de método dos cenários de cálculo | [src/engine/calculo.js](../src/engine/calculo.js) |
| Cartas de evento (lista `EVENTOS`) | [src/scenarios/content/eventos.js](../src/scenarios/content/eventos.js) |
| Empresas do Mercado (lista `EMPRESAS`, portes e falácias) | [src/scenarios/content/investimentos.js](../src/scenarios/content/investimentos.js) |
| Regras do Mercado (portes por reputação, aportes, penalidade da consultoria) | [src/engine/config.js](../src/engine/config.js) |
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
3. Escreva o objeto do cenário seguindo o [modelo](#modelo-de-cenário).
4. Acrescente-o ao array de `cenarios.json`. O arquivo é JSON puro: aspas duplas em chaves e textos, sem comentários nem vírgula final. O loader o importa com `import ... with { type: 'json' }` (Node 20.10+ e navegadores recentes).
5. Rode `npm test`. O validador e os testes de invariante rodam sobre todos os cenários automaticamente.
6. Adicione um teste específico do invariante em `tests/generators.test.js` (como os dos cenários 1 e 4 a 25).

Para um cenário em que a pessoa **calcula** o valor, siga o passo a passo acima e depois a seção [Cenários de cálculo](#cenários-de-cálculo).
7. Atualize a documentação (ver [Checklist](#checklist-antes-de-concluir)).

### Modelo de cenário

```jsonc
// Um elemento do array de cenarios.json (comentários e aspas simples só neste exemplo; o arquivo é JSON puro).
{
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
  impacto: { reputacao_acerto: 5, reputacao_erro: -10 },
};
```

### Campos

| Campo | Regra |
| --- | --- |
| `id` | Único entre todos os cenários. |
| `setor` | Obrigatório e válido (ver [Setores](#setores)). No modo cooperativo define quem é o responsável pela decisão. |
| `conceito` | Obrigatório, id de `CONCEITOS` em [src/scenarios/content/conceitos.js](../src/scenarios/content/conceitos.js). Diz o que o cenário avalia; o perfil de desempenho do fim de jogo agrega erros e acertos por conceito (`fisher.md` 4.6). Reutilize um conceito existente se o cenário treina a mesma ideia; para um novo, acrescente id e nome ao catálogo e, em [src/scenarios/content/materiais.js](../src/scenarios/content/materiais.js), o que revisar e os links de estudo sugeridos no relatório de fim de jogo (um teste exige materiais para todo conceito). |
| `dificuldade` | Obrigatório, inteiro de 1 a 3 (`DIFICULDADE_MAX`). Ver [Dificuldade](#dificuldade). |
| `contexto` | Narrativa e pergunta. Pode usar placeholders. |
| `dica` | Opcional. Só para jogadores de nível iniciante, e oculta por padrão: o jogador precisa pedir ("Mostrar dica"), e isso reduz pela metade o bônus de confiança nos ganhos daquela decisão (`fisher.md` 3.4). |
| `valor_base` | V da matriz de pontuação (`fisher.md` 3.5). Hoje todos usam 20.000; o nível avançado multiplica por 1,5. |
| `dados.formato` | Define a formatação de todos os placeholders numéricos. |
| `tipo` | Opcional. `'calculo'` para um cenário em que a pessoa calcula e informa o valor (ver [Cenários de cálculo](#cenários-de-cálculo)). Ausente é um cenário comum. |
| `dados.tipo_grafico` | `barras_discretas` para dados inteiros e poucos valores (numerações, notas); `segmentos` para a tabela de taxas por segmento do cenário 21; `tabela_series` para a tabela dos cenários 22, 24 e 25 (ver [Tabela de séries](#tabela-de-séries)); qualquer outro valor vira histograma. |
| `dados.descricao_acessivel` | Obrigatória por convenção: é a descrição textual do gráfico (`fisher.md` 5.9). |
| `impacto` | Variação de reputação por acerto e por erro. Todos os cenários usam `{ reputacao_acerto: 5, reputacao_erro: -10 }`, salvo motivo para variar. |

### Dificuldade

O jogo sorteia cenários com dificuldade crescente ao longo da partida (`fisher.md` 4.5): quanto mais o jogador avançou na trilha, mais o sorteio favorece cenários de dificuldade alta. Escolha o valor pelo que o jogador precisa fazer, não pela conta:

| Valor | Critério | Cenários atuais |
| --- | --- | --- |
| 1 | A métrica correta é a mais direta (centro de um conjunto com ou sem um único valor atípico, a categoria mais frequente, ou o máximo quando todos precisam caber) ou o erro é o clássico "correlação não é causa". | 01, 03, 07, 09, 14, 25 |
| 2 | Exige reconhecer o formato dos dados (cauda longa, bimodal, assimetria à esquerda), ler a definição de um percentil ou pensar em dispersão, ou perceber quem ficou de fora da amostra. | 02, 04, 05, 10, 11, 15, 17, 20, 23 |
| 3 | Exige comparar dispersão robusta com sensível a outliers, comparar amostras, pesar risco contra média, perceber que o objetivo (um total) muda a métrica, que um total é uma média ponderada ou que um alarme sobre evento raro gera mais falsos positivos que acertos. | 06, 08, 12, 13, 16, 18, 19, 21, 22, 24 |

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

Cada marcador desenha uma linha no gráfico do resultado. `chave` é uma das métricas da [tabela de placeholders](#placeholders). Em cenários com duas séries, a chave sem sufixo se refere à série A; use `chave: 'media'` e o jogo resolve por série. O marcador `correto: true` destaca a resposta certa. Um marcador é uma linha na escala dos dados, então só serve para métricas de **posição** (`media`, `mediana`, `moda`, `p25`, `p75`, `p90`, `p95`, `maximo`, `minimo`, `ponto_medio`, `media_aparada`). Para dispersão (`iqr`, `dp`, `amplitude`, `cv`) marque as bordas, como `p25` e `p75` para o IQR: uma linha "IQR" cairia na posição do valor do IQR no eixo, que não é onde a faixa central está.

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
| `{{cv}}` | Coeficiente de variação (dp / \|média\|), número puro; use com `formato: 'decimal'` |
| `{{media_aparada}}` | Média sem os 5% menores e os 5% maiores valores |
| `{{minimo}}`, `{{maximo}}`, `{{ponto_medio}}` | Extremos e ponto médio |

Em cenários com mais de uma série, use o sufixo da série: `{{media_a}}`, `{{dp_b}}`. Sem sufixo vale a série A. Um placeholder inexistente é erro de validação.

### Formatos

`dados.formato` aceita: `brl` (R$ 1.234), `dias`, `minutos`, `gramas`, `porcento`, `mm` (duas casas), `cm` e `ms` (inteiros), `seg` (segundos, até uma casa), `decimal` (até três casas, sem unidade, para médias como 1,325) e qualquer outro valor, que usa o formato numérico simples (`numero`, até uma casa). Todos usam separadores de `pt-BR`. Para um formato novo, acrescente um `case` em [src/stats/format.js](../src/stats/format.js) e um teste.

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
| `distribuicao_normal_simetrica` | `n`, `media`, `dp`, `outliers[{valor, qtd}]` (opcional) | sem `outliers`: \|média − mediana\| < 0,15 × dp e \|média − `media`\| < 0,2 × dp; com `outliers`: só eles ficam fora do intervalo dos valores extremos e \|média aparada − `media`\| < 0,2 × dp | 07, 20 |
| `comparacao_amostral` | `nA`, `mediaA`, `dpA`, `nB`, `mediaB`, `dpB`, `nomes[2]` | dp B > 4 × dp A e média B > média A | 08, 12 |
| `limite_fisico` | `n`, `media`, `dp` (valores inteiros) | máximo − P95 ≥ 0,25 × dp e máximo > média + 1,5 × dp | 09 |
| `assimetria_esquerda` | `n`, `base`, `ruido`, `outliers[{valor, qtd}]` | mediana − média > 6 % da mediana e mínimo < metade da mediana | 11 |
| `inflado_em_zero` | `n`, `proporcaoZero`, `valorMin`, `valorMax` | mediana = 0, ao menos 55 % de zeros e média > 10 % do máximo | 13 |
| `amostra_pequena` | `n`, `media`, `dp`, `casas` (padrão 0) | valores positivos, dp dentro de 10 % do pedido e amplitude > 1,8 × dp | 17 |
| `paradoxo_simpson` | `taxasAntes[2]`, `taxasDepois[2]` (Desktop, Mobile), `metadeAntesMin/Max`, `nonoDepoisMin/Max` (milhares de visitas) | taxas sobem nos dois segmentos, a geral cai e a fatia do Mobile cresce | 21 |
| `paradoxo_simpson_rh` | `taxasEngenharia[2]`, `taxasVendas[2]` (Homens, Mulheres, em %), `volumeH_Eng`, `volumeM_Eng`, `volumeH_Ven`, `volumeM_Ven` (candidatos) | mulheres com taxa maior nos dois departamentos e menor no geral, com a maioria delas em Engenharia e a deles em Vendas | 22 |
| `vies_sobrevivencia` | `amostra`, `nota_ativos` (média das notas, até 10) | máximo ≤ 10, mínimo ≥ 8 e média a menos de 0,15 de `nota_ativos` | 23 |
| `taxa_base_bayes` | `total_transacoes`, `taxa_fraude`, `precisao_ia` (determinístico) | alarmes falsos > 50 × alarmes verdadeiros e chance real de fraude < 5% | 24 |
| `correlacao_terceira_variavel` | `meses`, `r_pearson` (correlação alvo entre gasto e vendas) | r(gasto, vendas) ≥ `r_pearson` − 0,03 e r de cada um com a chuva ≥ 0,9 | 25 |
| `contagens_assimetricas` | `n`, `pesos[]` (contagens 0, 1, 2, ...) | média ≥ 0,2 acima da mediana, a ≥ 0,5 da moda e P90 > 1,5 × média | 16 |

Os cenários 14, 15 e 18 reaproveitam `assimetria_direita`, `cauda_longa` e `dispersao_outliers` com `n` pequeno.

Um invariante recebe também os `parametros` do cenário como segundo argumento (`invariante(series, parametros)`), então pode depender deles (como `amostra_pequena` faz).

Atenção: alguns invariantes têm números fixos do cenário original. Mudar os parâmetros para fora desse intervalo faz o gerador falhar. Se precisar de outros valores, torne o invariante dependente dos parâmetros (como `distribuicao_normal_simetrica` já faz).

`dados.tipo_grafico: 'segmentos'` (cenário 21) troca o histograma por uma tabela de taxas; o gerador precisa entregar as séries na ordem do `paradoxo_simpson`.

#### Tabela de séries

`dados.tipo_grafico: 'tabela_series'` (cenários 22, 24 e 25) mostra uma tabela em que **cada série é uma coluna** e cada posição dos valores, uma linha. Campos de `dados`:

| Campo | Papel |
| --- | --- |
| `rotulos_linhas` | Nome de cada linha (ex.: `["Engenharia", "Vendas", "Geral"]`); uma por posição dos valores. |
| `formatos` | Formato de cada série, na ordem (ver [Formatos](#formatos)); sem ele vale `dados.formato`. |
| `ocultas_ate_resultado` | Índices das séries que só aparecem na tela de resultado: o dado que explica a resposta (candidatos, alarmes, a variável oculta). |
| `legenda` | Título da tabela. |
| `descricao_acessivel` | Descrição lida por leitores de tela (a tabela a referencia por `aria-describedby`). |

Como o cenário não tem histograma, `rotulo_x` e `rotulo_y` não são usados.

### Criar um gerador novo

1. Em `generators.js`, acrescente uma entrada em `GERADORES` com `gerar(parametros, rng)` e `invariante(series)`.
2. `gerar` devolve `{ series: [{ nome, valores }] }`. Use **apenas** o `rng` recebido (`prox`, `entre`, `inteiro`, `normal`, `embaralhar`). Nunca `Math.random()` nem `Date.now()`: isso quebraria a reprodutibilidade por seed e o save.
3. `invariante` recebe um array de arrays de valores (uma série por posição) e devolve `true` ou `false`.
4. Escolha um invariante que prove o ponto pedagógico, não só "dados válidos".
5. Escreva o teste em `tests/generators.test.js` com as propriedades nomeadas.
6. Se o cenário usar o gráfico discreto, confirme que os valores são inteiros.

Dicas: `padronizado(n, media, dp, rng, casas)` gera uma série com média e desvio exatos; os invariantes devem ter folga para que o sorteio passe em poucas tentativas.

## Cenários de cálculo

Um cenário `tipo: 'calculo'` entrega os dados numa **tabela** (e, se quiser, também num gráfico) e pede que a pessoa escolha a métrica, **calcule o valor** com os dados, justifique e declare a confiança (`fisher.md` 4.7). O modelo é o de um cenário comum, com estas diferenças:

```jsonc
{
  id: 'cenario_NN_exemplo',
  tipo: 'calculo',
  /* setor, conceito, dificuldade, titulo, contexto, dica, valor_base como no modelo comum */
  dados: {
    gerador: { tipo: 'cauda_longa', parametros: { n: 21, /* ... */ } },   // poucos registros, para calcular à mão
    formato: 'minutos',
    exibir: ['tabela'],                   // 'tabela' é obrigatório; acrescente 'grafico' para mostrar também o gráfico
    tabela: 'valores',                    // 'valores' (registros na ordem sorteada) ou 'frequencias' (valor e quantidade)
    rotulo_x: 'Espera (min)',             // cabeçalho da coluna de valores
    rotulo_y: 'Pacientes',
    tipo_grafico: 'histograma',
    descricao_acessivel: '...',
  },
  opcoes: [
    // `chave` é a métrica calculável (uma de `num`: media, mediana, moda, p25, p75, p90, p95, iqr, amplitude, dp, maximo, minimo, ponto_medio).
    // O texto NÃO pode ter placeholders: revelaria o valor.
    { id: 'p90', chave: 'p90', texto: 'Percentil 90 (P90)', correta: true },
    { id: 'media', chave: 'media', texto: 'Média', correta: false, equivoco: 'media_oculta_falhas' },
  ],
  feedback: {
    /* por_equivoco e explicacao_correta como no modelo comum (podem usar placeholders) */
    como_calcular: 'Passo a passo do cálculo, com os valores sorteados ({{p90}}).',   // obrigatório
    revelacao: { marcadores: [] },        // pode ficar vazio se o cenário não mostra gráfico
  },
};
```

Regras e cuidados:

- **Poucos registros** (de 8 a 40) e valores que dê para ordenar e somar à mão. A tabela mostra os registros na ordem sorteada, então a pessoa precisa ordená-los.
- **A margem não se configura no cenário.** Ela segue a grandeza do valor exato da métrica escolhida: 5% abaixo de 100 e 2% a partir de 100 (`MARGEM_CALCULO_UNIDADES_PCT`, `MARGEM_CALCULO_CENTENAS_PCT`, `MARGEM_CALCULO_LIMITE` em `src/engine/config.js`). Por isso, ao escrever os dados, cuide de valores exatos perto de 100, em que a faixa muda. Há um piso absoluto (`MARGEM_CALCULO_PISO`) para quando o valor exato é zero.
- **Convenções:** percentis e quartis usam o método linear (posição `p × (n − 1) + 1`, como `PERCENTIL.INC` e `QUARTIL.INC`) e o desvio padrão é o amostral (`n − 1`). A tela de valor avisa isso. Se a convenção mudar o resultado além da margem, o cenário é injusto: ajuste `n` para o percentil cair numa posição inteira, como nos cenários 15 e 18.
- **Todas as opções precisam de número:** não use métricas sem valor (como "distribuição de frequências").
- **O valor é conferido contra a métrica escolhida,** não contra a correta. A métrica só conta como certa com a opção correta **e** o valor dentro da margem (pontuação em `fisher.md` 3.5 e 4.7).
- **Escreva `como_calcular` com a conta,** usando placeholders. É o que o jogador lê ao errar.
- O rival do computador informa o valor exato da métrica que escolher, então não precisa de nada a mais.

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

## Criar uma empresa do Mercado

Em `investimentos.js`, acrescente um objeto a `EMPRESAS` (regras em `fisher.md` 3.14 e a tabela do catálogo em 4.8):

```js
{
  id: 'padaria_pao_dourado',        // único
  porte: 'micro',                   // micro | pme | consolidada | elite (a reputação do jogador define qual aparece)
  nome: 'Padaria Pão Dourado',
  setor: 'Comércio de alimentos',
  tempo: '3 anos',                  // tempo de mercado, em texto
  fundador: 'O que o fundador diz, em uma ou duas frases. É aqui que mora a falácia.',
  historico: [6, 7, 5, 6],          // lucro (prejuízo) dos 4 últimos trimestres, em R$ mil
  prob: 0.25,                       // chance de sucesso, oculta (só o relatório da consultoria a mostra)
  ganho: 2.0,                       // retorno do sucesso sobre o aporte (2,0 = +200%)
  perda: 1.0,                       // fração do aporte perdida no fracasso (1 = perda total)
  falha: 'sobrevivencia',           // sobrevivencia | taxa_base | regressao_media | amostra_pequena | null (argumento sólido)
  explicacao: 'O que a ficha escondia, e por que a falha enganava.',
  sucesso: 'Narrativa do desfecho bom, mostrada no Balanço.',
  fracasso: 'Narrativa do desfecho ruim.',
}
```

- **A falha e o valor esperado andam juntos.** Empresa com `falha` é uma furada e precisa de valor esperado negativo, `prob × ganho − (1 − prob) × perda < 0`. Empresa com `falha: null` precisa de argumento realmente sólido (dados completos, inclusive os casos ruins) e de valor esperado positivo. Isso vale mesmo no pior sorteio da chance: a cada oferta `prob` varia até ±0,04 (`SORTEIO_PROBABILIDADE`).
- **A pista precisa estar no texto do `fundador`** (ou no `historico`), sem nomear a falácia. Quem lê deve poder descobrir; a `explicacao` só aparece depois da decisão.
- **Mantenha a proporção:** cada porte com ao menos 2 empresas sólidas e 2 furadas, e cada falácia em ao menos uma empresa. O investimento às cegas deve ficar perto de zero em média (o teste confere por porte), senão o chute passa a compensar.
- A consultoria cobra 50% do ganho e R$ 15.000 no fracasso, então quase nenhuma empresa tem valor esperado positivo depois dela; isso é intencional (ela é informação cara). Não ajuste o catálogo para compensar.
- O `historico` e os números de `prob`, `ganho` e `perda` só aparecem no relatório da consultoria; a pista da falácia precisa estar no texto do `fundador`.
- Empresas novas entram no baralho de seu porte no próximo ciclo. Não renomeie nem remova um `id`: aportes salvos referenciam o id (a apuração tolera id ausente, mas perde a narrativa).
- Narrativas de sucesso e fracasso são exibidas no Balanço ao apurar; escreva-as de modo a fazer sentido para qualquer um dos dois desfechos, sem citar números.

## Estilo de escrita

- Português do Brasil, tom de situação de trabalho (você é a pessoa que decide).
- Frases curtas. Um conceito por cenário.
- Evite jargão não ensinado e siglas sem explicação (defina o P90 na dica ou no feedback).
- Não revele a resposta no `contexto` nem na `dica`.
- O feedback explica **por que** o equívoco é tentador e **o que** nos dados o desmente.
- Distratores plausíveis: o jogador precisa sentir que errou por um motivo compreensível.

## Validação

`npm test` executa, entre outros, estes testes sobre todo o conteúdo:

- `validarCenario` em várias seeds. Ele reporta: dificuldade inválida ou ausente, setor inválido, conceito fora do catálogo, número de opções ≠ 5, opções corretas ≠ 1, justificativas fora de 6–8, justificativas corretas ≠ 1, `equivoco` sem feedback, opção errada sem `equivoco`, tipo de justificativa inválido, placeholder inexistente, marcador sem valor e marcador de dispersão (`iqr`, `dp`, `amplitude`, `cv`).
- Unicidade dos `id` dos cenários.
- `dificuldade` inteira de 1 a 3 em todo cenário, com ao menos um cenário por nível.
- Invariantes de todos os geradores em 1.000 seeds.
- Cenários de cálculo: `dados.exibir` com `tabela`, cada opção com `chave` calculável e sem placeholders no texto, e `feedback.como_calcular` presente.
- Todas as telas renderizam sem placeholder não substituído, sem `undefined` e sem HTML injetado.
- Todo evento tem setor válido.
- Empresas do Mercado (`tests/investimentos.test.js`): ids únicos, campos e textos presentes, valor esperado negativo para toda furada e positivo para toda sólida (mesmo no pior sorteio), portes com empresas dos dois tipos, cada falácia usada, investimento às cegas perto de zero.

O validador **não** confere que a opção marcada `correta` é de fato a correta matematicamente. Isso é responsabilidade do invariante e da revisão humana.

## Checklist antes de concluir

- [ ] `id` único; `setor` válido; `conceito` do catálogo; `dificuldade` de 1 a 3.
- [ ] 5 opções (1 correta); 6–8 justificativas (1 `correta`).
- [ ] Todo `equivoco` tem feedback.
- [ ] Nenhum número de dado escrito à mão; só placeholders.
- [ ] O invariante prova o ponto pedagógico e passa em 1.000 seeds.
- [ ] Teste específico do gerador adicionado ou atualizado.
- [ ] Cenário de cálculo: convenção de percentil/desvio avisada na tela, `como_calcular` escrito e valores exatos conferidos em relação ao limiar de 100 da margem.
- [ ] `dados.formato` e rótulos dos eixos corretos; `descricao_acessivel` escrita.
- [ ] Cenário incluído em `cenarios.json` (ou evento em `EVENTOS`).
- [ ] README atualizado: contagem e lista de cenários e eventos (obrigatório pelo `CLAUDE.md`).
- [ ] `fisher.md` atualizado se o conteúdo mudar a especificação (seção 4).
- [ ] Empresa do Mercado: `falha` coerente com o sinal do valor esperado, pista no texto do fundador, `explicacao` e narrativas escritas, catálogo (4.8) e README atualizados.
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
