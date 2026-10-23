# Formato da partida salva e política de versão

Descreve o que o jogo grava no `localStorage`, quando grava, e as regras para mudar esse formato sem quebrar partidas em andamento. O código está em [src/storage/persist.js](../src/storage/persist.js) (leitura e escrita) e [src/engine/state.js](../src/engine/state.js) (criação do estado).

As seções [Formato atual](#formato-atual) e [Comportamento atual](#comportamento-atual) descrevem o que o código faz hoje. A [Política de versão](#política-de-versão) é a regra proposta para mudanças futuras; trechos que o código ainda não cumpre estão marcados como **pendente**.

## Princípios

- A partida salva **é** o estado do jogo (`estado` da máquina de estados), serializado como JSON. Não há um formato separado: o que o motor usa é o que se grava.
- O estado é só dado serializável (sem funções, `Map`, `Date` nem referências circulares). Isso permite `structuredClone` na máquina e `JSON.stringify` no save.
- A partida é determinística: a `seed` e o estado do gerador (`rng`) estão no save, então retomar uma partida reproduz exatamente o que viria.
- O save é um conforto, não um requisito. Qualquer falha de armazenamento é ignorada e o jogo continua funcionando.

## Onde e quando

| Item | Valor |
| --- | --- |
| Armazenamento | `localStorage` do navegador, só no dispositivo do jogador |
| Chave | `tabuleiro-do-ceo:partida:v1` |
| Quantidade | Uma única partida salva por navegador |
| Gravação | Ao iniciar a partida e a cada ação que muda o estado (cada transição da máquina) |
| Remoção | Ao chegar a `FIM_DE_JOGO` e ao abandonar a partida (botão "Nova partida", com confirmação) |
| Retomada | Botão "Continuar partida salva" no menu |

A chave termina em `:v1`. Ela só muda em ruptura de formato (ver [Política de versão](#política-de-versão)).

## Formato atual

Versão do formato: **`versao: 1`**.

### Raiz

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `versao` | número | Versão do formato. Hoje sempre `1`. |
| `modo` | `'competitivo'` \| `'cooperativo'` | Modo de jogo. Ausente em saves antigos (tratado como competitivo). |
| `empresa` | objeto \| `null` | `{ dinheiro, reputacao }` da empresa. Só no cooperativo; `null` no competitivo. |
| `seed` | inteiro (32 bits) | Semente informada ou sorteada no início. |
| `rng` | inteiro (32 bits) | Estado atual do gerador de números aleatórios (mulberry32). |
| `turnoAtual` | inteiro ≥ 1 | Trimestre atual. Aumenta quando todos os jogadores jogaram. |
| `turnosPorJogador` | inteiro (1 a 64) | Duração da partida, escolhida no menu. |
| `dinheiroInicial` | inteiro | Caixa inicial escolhido no menu (de cada jogador, ou da empresa no cooperativo). Base da meta trimestral e das faixas finais do cooperativo. Ausente em saves antigos (vale `100000`; `dinheiroInicialDe`). |
| `falencia` | booleano | Só no cooperativo: a empresa quebrou (caixa negativo ao fim de uma jogada que passou pelo Balanço) e a partida acabou (`fisher.md` 3.12). Ausente em saves antigos (vale `false`; `empresaFalida`). |
| `jogadorAtual` | inteiro | Índice em `jogadores` de quem joga. |
| `fase` | texto | Fase da máquina de estados (ver abaixo). |
| `dado` | 2–12 \| `null` | Soma dos dois dados da última rolagem. |
| `dados` | `[d1, d2]` \| `null` | Faces dos dois dados da última rolagem; `dado` é a soma. Se forem iguais, o `CONTINUAR` seguinte mantém o jogador da vez (`fisher.md` 3.2). |
| `jogadaExtra` | booleano | O jogador da vez rola de novo por ter tirado dados iguais; só serve para mostrar o aviso. Ausente em saves antigos (vale `false`). |
| `balanco` | objeto \| `null` | Resultado do Balanço se o jogador passou pela casa inicial na vez. |
| `jogadores` | lista | Um objeto por jogador (ver abaixo). |
| `baralhoCenarios` | lista de ids | Cenários ainda não sorteados no ciclo atual. A ordem não indica o próximo: o sorteio é ponderado pela dificuldade (ver `fisher.md` 4.5). |
| `baralhoEventos` | lista de ids | Eventos ainda não sorteados no ciclo atual. |
| `baralhoInvestimentos` | objeto | Por porte (`micro`, `pme`, `consolidada`, `elite`), os ids das empresas do Mercado ainda não ofertadas no ciclo daquele porte (`fisher.md` 3.14). Ausente em saves antigos (vale `{}`). |
| `cenarioAtual` | objeto \| `null` | Decisão em andamento. |
| `eventoAtual` | objeto \| `null` | Carta de evento em exibição. |
| `mercadoAtual` | objeto \| `null` | Oferta do Mercado em exibição (ver abaixo). Ausente em saves antigos (vale `null`). |
| `apuracaoFinal` | lista \| `null` | Só em `FIM_DE_JOGO` pelo fim dos trimestres: `{ jogador, nome, investimentos }` de cada jogador cujos aportes foram apurados no encerramento (`fisher.md` 3.14); `investimentos` tem o formato dos itens de `balanco.investimentos`. `null` se não sobrou aporte. Ausente em saves antigos (vale `null`). |
| `resultado` | objeto \| `null` | Resultado da última decisão, na tela de resultado. |
| `soConceitual` | booleano | Partida sem cenários de cálculo (jogador sem planilha ou papel; `fisher.md` 4.7). Ausente em saves antigos (vale `false`). |
| `teste` | objeto \| `null` | Atalhos de teste do menu (`fisher.md` 5.8.1): `{ casa, cenarios }`, com `casa` em `'decisao'`, `'evento'`, `'mercado'`, `'balanco'` ou `null` (normal) e `cenarios` uma lista de ids que restringe o baralho, ou `null` (todos). `null` em partida normal. Ausente em saves antigos (vale `null`). |

Valores de `fase`: `ROLAR_DADO`, `ESCOLHER_METRICA`, `INFORMAR_VALOR`, `ESCOLHER_JUSTIFICATIVA`, `ESCOLHER_CONFIANCA`, `MOSTRAR_RESULTADO`, `MOSTRAR_EVENTO`, `MOSTRAR_MERCADO`, `MOSTRAR_BALANCO`, `FIM_DE_JOGO`.

### `jogadores[]`

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | inteiro | Índice do jogador. |
| `nome` | texto | Nome digitado (sempre escapado ao exibir). |
| `nivel` | `'iniciante'` \| `'avancado'` | Nível de dificuldade. |
| `dinheiro` | inteiro | Carteira individual. No cooperativo não muda (o caixa é da empresa). |
| `reputacao` | 0–100 | Reputação individual. No cooperativo não muda. |
| `posicao` | 0–27 | Casa no tabuleiro (`balanco`, `decisao`, `evento` ou `mercado`; as casas 9 e 23, em índice, são de Mercado). |
| `distancia` | inteiro ≥ 0 | Casas percorridas no total, contando as voltas (soma dos dados). Define a dificuldade dos cenários sorteados. Ausente em saves antigos (vale `posicao`). |
| `historico` | lista | Decisões tomadas: `{ cenario, conceito, metrica, justificativa, confianca, resultado, delta, equivocos }`, mais `valor` (o número informado) e `valorCorreto` (dentro da margem) nas decisões de cenários de cálculo (`fisher.md` 4.7). `conceito` e `equivocos` (ids dos equívocos da opção e da justificativa escolhidas) alimentam o perfil de desempenho (`fisher.md` 4.6); ausentes em saves antigos, são recalculados a partir do conteúdo. |
| `falido` | booleano | Caixa negativo ao fim de uma jogada que passou pelo Balanço: o jogador saiu da disputa, é pulado nos turnos e perde (competitivo e solo, `fisher.md` 3.12). Ausente em saves antigos (vale `false`; `ehFalido`). |
| `negativado` | booleano | Passou pelo Balanço com o caixa negativo e aguarda o veredito, porque há rival negativado com saldo pior que ainda não passou pelo Balanço (competitivo e solo, `fisher.md` 3.12). Limpo após o veredito. Ausente em saves antigos (vale `false`). |
| `sequencia` | objeto | `{ erros, acertos }`: erros totais ou sucessos absolutos seguidos até a última decisão (só um dos dois é maior que zero); define o fator que multiplica o dinheiro da decisão seguinte (`fisher.md` 3.13); só decisões de cenário a alteram, não Evento nem Balanço. Ausente em saves antigos (vale `{ erros: 0, acertos: 0 }`; `sequenciaDe`). |
| `bot` | `'facil'` \| `'medio'` \| `'dificil'` \| `null` | Perfil do rival controlado pelo computador (modo solo, `fisher.md` 3.11); `null` para uma pessoa. Ausente em saves antigos (vale pessoa). |
| `papeis` | lista de ids de diretoria | Só no cooperativo; vazio no competitivo. |
| `investimentos` | lista | Aportes do Mercado em custódia, à espera do próximo Balanço do jogador (`fisher.md` 3.14): `{ empresaId, nome, porte, valor, prob, ganho, perda, consultoria, turnoAporte }`. `ganho` já vem descontado da penalidade da consultoria, quando `consultoria` é `true`. Esvazia quando o Balanço (ou o fim da partida) apura. Ausente em saves antigos (vale `[]`; `investimentosDe`). |
| `merito`, `habilidadeUsos` | inteiros | Reservados para o cooperativo; **ainda não usados** pelo motor. |

### Campos de contexto da fase

- **`cenarioAtual`**: `{ id, series, num, vars, ordemOpcoes, ordemJustificativas, confianca, dicaUsada, metricaId, valorInformado, justificativaId }`. `series` são os dados sorteados; `num` as métricas calculadas; `vars` os textos já formatados para os placeholders. `valorInformado` é o número calculado pela pessoa (ou pelo rival) e só é preenchido em cenários de cálculo; ausente em saves antigos (vale `null`). As escolhas começam em `null` e são preenchidas conforme a fase avança.
- **`eventoAtual`**: `{ id, crise, dinheiro }`. `dinheiro` já inclui o amortecimento do cooperativo.
- **`confianca`** (em `historico`, `cenarioAtual` e `resultado`): uma das chaves `chute`, `duvida`, `provavel`, `confiante` ou `certeza`. Saves antigos, que só usavam `chute` e `certeza`, continuam válidos.
- **`resultado`**: `{ cenarioId, metricaId, justificativaId, confianca, dicaUsada, metricaCorreta, justificativaCorreta, categoria, delta, multiplicador, multiplicadorSequencia, sequencia, deltaReputacao, crise }`. `multiplicadorSequencia` é o ônus ou bônus aplicado e `sequencia` a sequência depois da decisão (ambos ausentes em saves antigos, valendo ×1). Em cenários de cálculo acrescenta `valorCorreto` e `calculo: { chave, informado, esperado, margemPct, minimo, maximo, dentro }`. `metricaCorreta` diz se a *opção* era a correta; a `categoria` já considera também o valor (`fisher.md` 4.7). Ausentes em saves antigos e em cenários comuns.
- **`mercadoAtual`**: `{ empresaId, porte, prob, ganho, perda, consultoria, diagnostico, analise, aporte, decisao }`. `prob` é a chance de sucesso já sorteada para a oferta (a base do catálogo ±0,04), oculta da tela até `consultoria` ser `true`. `diagnostico` é a falácia apontada (uma das chaves de `FALACIAS`, ou `'nenhuma'`) e `analise` o veredito, `{ falha, correta, deltaReputacao, crise }`, preenchido ao decidir. `decisao` é `null` (aberta), `'investiu'` (com `aporte`) ou `'recusou'`. Para o rival do solo vale `{ empresaId: null, decisao: 'recusou' }`.
- **`balanco`**: `{ receita, custos, liquido, investimentos }` e, no cooperativo, `bonusRh` e `meta: { valor, cumprida, dinheiro, reputacao, crise }`. `investimentos` lista o que cada aporte apurado rendeu: `{ empresaId, nome, valor, consultoria, desfecho, retorno, credito, liquido, texto }`, com `desfecho` `'sucesso'` ou `'fracasso'`; é vazia sem aportes e ausente em saves antigos (vale `[]`). `liquido` não inclui os investimentos.

Os campos de contexto só existem nas fases em que fazem sentido e são zerados em `CONTINUAR`.

### Dependência do conteúdo

O save guarda **ids** de cenários, opções, justificativas e eventos (`cenarioAtual.id`, `metricaId`, `baralhoCenarios`, `historico`...). Ao exibir, o jogo procura esses ids no conteúdo atual (`src/scenarios/content/`). Portanto o conteúdo faz parte do contrato do save (ver [Mudanças de conteúdo](#mudanças-de-conteúdo)).

## Comportamento atual

- **Validação ao carregar** (`carregar`): devolve o estado só se o JSON é válido, `versao === 1`, `jogadores` é uma lista e `fase` existe. Qualquer outro caso devolve `null`, e o menu aparece sem a opção de continuar.
- **Falha de armazenamento** (`salvar`, `limpar`): erros são engolidos (cota cheia, modo privado, `localStorage` bloqueado).
- **Saves antigos sem `modo`:** `ehCooperativo` trata ausência como competitivo, e a partida retoma normalmente.
- Não há migração entre versões: um save de outra versão é descartado em silêncio.
- A validação não confere o conteúdo dos campos (tipos, faixas, ids existentes). Um save adulterado ou corrompido com a estrutura mínima passa na validação.

## Política de versão

### O que é uma mudança de formato

Qualquer alteração em `src/storage/` ou na forma do estado criado em `novoJogo` e transformado em `src/engine/machine.js`: campos acrescentados, removidos, renomeados, com outro tipo ou outro significado. Também conta mudar o valor de uma constante que o save "congela" (por exemplo, o tamanho do tabuleiro ou a lista de fases).

### Classificação e o que fazer

| Tipo de mudança | Exemplo | Versão | Ação obrigatória |
| --- | --- | --- | --- |
| **Compatível** (acrescenta campo opcional, com padrão seguro quando ausente) | `modo` no cooperativo | Mantém | Código tolera ausência do campo; teste com save antigo; documentar aqui |
| **Migrável** (muda a forma, mas dá para converter) | Renomear `dinheiro` para `caixa` | Incrementa (`versao: 2`) | Escrever `migrar(v1) → v2`; teste de migração com fixture; documentar |
| **Incompatível** (não dá para converter com segurança) | Mudar o tabuleiro de 28 para 40 casas no meio da partida | Incrementa e **descarta** saves antigos | Avisar na tela do menu; documentar o motivo |

Regras:

1. **Prefira mudanças compatíveis.** Todo campo novo deve ter um padrão seguro quando ausente, e o código que o lê deve usar esse padrão (como `ehCooperativo` faz).
2. **Nunca reutilize o significado de um campo existente.** Crie um campo novo.
3. **Incremente `versao` só quando precisar.** Mudanças compatíveis não incrementam; migráveis e incompatíveis sim.
4. **A chave do `localStorage` (`...:v1`) muda só em ruptura total**, quando não se quer sequer ler o save antigo. Em migração, a chave se mantém e o conteúdo é convertido ao carregar.
5. **Migração é uma cadeia:** `v1 → v2 → v3`, cada passo uma função pura sobre o JSON. O código mantém todos os passos desde a menor versão suportada.
6. **Versão desconhecida (maior que a do código)** é descartada, nunca interpretada. Isso protege quem abre uma versão antiga do jogo depois de uma nova.
7. **Fixtures:** cada versão do formato tem um save de exemplo em `tests/fixtures/` (uma partida em cada fase relevante, nos dois modos). Os testes carregam todas as fixtures com o código atual.
8. **Atualize a documentação na mesma mudança:** este arquivo (tabelas e histórico), `docs/diagramas-uml.md` (estado) e, se for regra de jogo, o `fisher.md`.

### Mudanças de conteúdo

Como o save referencia ids do conteúdo, alterar o conteúdo também pode quebrar partidas em andamento.

| Mudança de conteúdo | Efeito em saves | Regra |
| --- | --- | --- |
| Corrigir um texto (contexto, feedback, rótulos) | Nenhum | Livre |
| Acrescentar cenário ou evento | Nenhum (entra no próximo ciclo do baralho) | Livre |
| Alterar parâmetros de um gerador | Nenhum para decisões já sorteadas (os dados estão no save) | Livre |
| Remover ou renomear **cenário**, **evento**, **opção** ou **justificativa** | Pode quebrar a decisão ou o baralho salvos | Não renomear. Se for inevitável, tratar como mudança migrável |
| Mudar o significado de uma opção (a correta passa a ser outra) | Resultado incoerente com o que o jogador viu | Criar um novo cenário com outro `id` |
| Trocar o `setor` de um cenário ou evento | Nenhum para decisões em curso | Livre |

**Pendente:** hoje o jogo não valida ids ao carregar. Se `cenarioAtual.id` não existir no conteúdo, a tela falha. A proteção prevista é descartar o save (ou limpar os ids inexistentes dos baralhos) na validação de `carregar`.

### Pendências para cumprir esta política

- [ ] Validar tipos e faixas ao carregar (`fase` conhecida, `posicao` em 0–27, `jogadorAtual` válido, ids existentes no conteúdo).
- [ ] Descartar versão maior que a suportada de forma explícita (hoje o `=== 1` já cumpre, mas sem aviso ao jogador).
- [ ] Mostrar no menu um aviso quando existe save inválido ou de versão incompatível.
- [ ] Criar `tests/fixtures/` com um save de cada versão, inclusive um **anterior à existência do campo `modo`**.
- [ ] Testes de `persist.js`: `carregar` com chave ausente, JSON inválido, versão diferente, sem `jogadores`; `salvar` e `limpar` com `localStorage` falho (ver [testes.md](testes.md), seção 8).
- [ ] Decidir se `merito` e `habilidadeUsos` ficam no formato (hoje não são usados).

## Histórico de versões

| Versão | Mudança | Compatibilidade |
| --- | --- | --- |
| 1 | Formato inicial. | n/a |
| 1 (sem incremento) | Acrescentados `modo`, `empresa`, `papeis`, `merito`, `habilidadeUsos` para o modo cooperativo. | Compatível: save sem `modo` é competitivo |
| 1 (sem incremento) | Acrescentado `jogadores[].distancia`; o sorteio de cenários passa a ser ponderado pela dificuldade. | Compatível: save sem `distancia` usa `posicao` |
| 1 (sem incremento) | Acrescentados `conceito` e `equivocos` em `jogadores[].historico[]`, para o perfil de desempenho. | Compatível: entradas sem esses campos são completadas pelo conteúdo |
| 1 (sem incremento) | Acrescentado `jogadores[].bot`, para o rival do modo solo. O modo solo grava `modo: 'competitivo'`. | Compatível: jogador sem `bot` é uma pessoa |
| 1 (sem incremento) | Nova fase `INFORMAR_VALOR`; `cenarioAtual.valorInformado`; `resultado.valorCorreto` e `resultado.calculo`; `historico[].valor` e `historico[].valorCorreto`, para os cenários de cálculo (`fisher.md` 4.7). | Compatível: saves antigos não têm esses campos e nunca estiveram na nova fase; o código trata a ausência como cenário comum |
| 1 (sem incremento) | Acrescentado `teste`, com os atalhos de teste do menu (casa forçada e baralho restrito). | Compatível: save sem `teste` é uma partida normal |
| 1 (sem incremento) | Acrescentado `soConceitual`, para jogar sem os cenários de cálculo. | Compatível: save sem `soConceitual` inclui todos os cenários |
| 1 (sem incremento) | Acrescentado `jogadores[].sequencia`, e `resultado.multiplicadorSequencia` e `resultado.sequencia`, para as sequências de erros e acertos (`fisher.md` 3.13). | Compatível: save sem `sequencia` começa a contar do zero |
| 1 (sem incremento) | Acrescentado `dinheiroInicial`, o caixa inicial escolhido no menu. | Compatível: save sem `dinheiroInicial` usa R$ 100.000 |
| 1 (sem incremento) | Casa e fase de Mercado (`MOSTRAR_MERCADO`), com os investimentos (`fisher.md` 3.14): `mercadoAtual`, `apuracaoFinal`, `baralhoInvestimentos`, `jogadores[].investimentos` e `balanco.investimentos`. A trilha passou a ter 2 casas de Mercado no lugar de 2 de Evento (casas 10 e 24). | Compatível: os campos ausentes valem vazio e o save antigo nunca esteve na nova fase; o código trata a ausência como sem investimentos. Num save antigo em andamento, as casas 10 e 24 passam a ser de Mercado, e uma jogada que cairia ali em Evento vira oferta de investimento |

Ao mudar o formato, acrescente uma linha aqui.
