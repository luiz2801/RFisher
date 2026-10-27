# Referência da API interna

Assinaturas, tipos de ação e payloads dos módulos principais: a máquina de estados ([src/engine/machine.js](../src/engine/machine.js)), as estatísticas ([src/stats/](../src/stats/)) e a persistência ([src/storage/persist.js](../src/storage/persist.js)).

Esta referência é escrita à mão a partir do código. O projeto não tem dependências, então não roda JSDoc nem TypeDoc; se a geração automática for desejada, ela exige uma dependência de desenvolvimento e um ADR próprio ([docs/adr/README.md](adr/README.md)). Quando a assinatura mudar, atualize esta página no mesmo commit.

Os tipos abaixo são descritos em notação informal (`number`, `string`, `boolean`, `Lista<T>`). O formato completo do estado está em [docs/formato-de-save.md](formato-de-save.md), que é o próprio estado serializado.

---

## 1. Máquina de estados (`src/engine/machine.js`)

### 1.1 Exportações

| Função | Assinatura | Descrição |
| --- | --- | --- |
| `reduzir` | `reduzir(estado, acao) → estado` | Aplica uma ação ao estado. Ação inválida para a fase atual devolve o próprio `estado`, sem cópia. Caso contrário devolve uma cópia nova. |
| `metaTrimestral` | `metaTrimestral(estado) → number` | Caixa mínimo exigido pelo Conselho no trimestre atual (`dinheiroInicialDe(e) + META_CRESCIMENTO_POR_JOGADOR × jogadores × (turnoAtual − 1)`). |
| `dinheiroDoEvento` | `dinheiroDoEvento(estado, carta) → number` | Valor efetivo do efeito de uma carta de evento. No cooperativo, prejuízo de carta do setor de uma diretoria é amortecido por `REDUCAO_PREJUIZO_PASSIVA`, arredondado a centenas. |

### 1.2 Formato da ação

```
acao = { tipo: string, valor?: any }
```

`tipo` escolhe a transição dentro da fase atual (`TRANSICOES[fase][tipo]`). `valor` é o payload, quando a ação tem um. Ações sem payload ignoram `valor`.

### 1.3 Fases

| Fase | Quem está na tela | Ações aceitas |
| --- | --- | --- |
| `ROLAR_DADO` | Tabuleiro, botão Jogar | `ROLAR` |
| `ESCOLHER_METRICA` | Pergunta da casa de Decisão | `ABRIR_DICA`, `USAR_HABILIDADE`, `METRICA`, `DECIDIR_BOT` |
| `INFORMAR_VALOR` | Campo do valor (só cenário de cálculo) | `VALOR` |
| `ESCOLHER_JUSTIFICATIVA` | Lista de justificativas | `JUSTIFICATIVA` |
| `ESCOLHER_CONFIANCA` | Escala de confiança | `CONFIANCA` |
| `MOSTRAR_RESULTADO` | Tela de resultado da decisão | `CONTINUAR` |
| `MOSTRAR_MERCADO` | Oferta de investimento | `ABRIR_CONSULTORIA`, `DIAGNOSTICAR`, `INVESTIR`, `RECUSAR`, `CONTINUAR` |
| `MOSTRAR_EVENTO` | Oferta e cartas da casa de Evento | `PARTICIPAR`, `ESCOLHER_CARTA`, `MANTER`, `TROCAR`, `RECUSAR`, `CONTINUAR` |
| `MOSTRAR_BALANCO` | Balanço do trimestre | `CONTINUAR` |
| `FIM_DE_JOGO` | Ranking e relatório | Nenhuma (o save é apagado) |

### 1.4 Ações e payloads

| Fase | `tipo` | `valor` | Efeito |
| --- | --- | --- | --- |
| `ROLAR_DADO` | `ROLAR` | — | Rola dois dados (`rng`), avança o peão e grava `dado`, `dados`, `distancia`, `posicao` e, se passou pela casa inicial, `balanco`. Vai para a fase da casa: `ESCOLHER_METRICA` (Decisão), `MOSTRAR_EVENTO`, `MOSTRAR_MERCADO` ou `MOSTRAR_BALANCO`. |
| `ESCOLHER_METRICA` | `ABRIR_DICA` | — | Liga `dicaUsada` (só iniciante, cenário com dica, jogador humano; sem efeito depois do Treinamento). Não muda a fase. |
| `ESCOLHER_METRICA` | `USAR_HABILIDADE` | id da diretoria (`operacoes`, `tecnologia`, `pessoas_financas`) | Usa a habilidade ativa da diretoria de quem joga (`fisher.md` 3.16): Plano B grava `opcaoRemovida`, Teste A/B grava `testeAB` (os ids das duas finalistas) e Treinamento liga `dicaLivre`. Gasta um uso (`habilidadeUsos`). Ignorada sem a diretoria, sem usos (2 por partida), se já usada no cenário, para o rival e no Treinamento sem dica ou com a dica paga aberta. Não muda a fase. |
| `ESCOLHER_METRICA` | `METRICA` | `string`: id de uma opção do cenário | Grava `metricaId` (ignora a opção removida pelo Plano B). Vai para `INFORMAR_VALOR` se o cenário é de cálculo, senão para `ESCOLHER_JUSTIFICATIVA`. |
| `ESCOLHER_METRICA` | `DECIDIR_BOT` | — | Só o rival do modo solo. Decide métrica, valor, justificativa e confiança de uma vez, com o `rng` da partida, e pontua (vai para `MOSTRAR_RESULTADO`). |
| `INFORMAR_VALOR` | `VALOR` | `number` ou `string` em pt-BR (`"5.000,50"`, `"R$ 3.200"`) | Lê o número com `lerNumero`; se for inválido, a ação é ignorada. Vai para `ESCOLHER_JUSTIFICATIVA`. |
| `ESCOLHER_JUSTIFICATIVA` | `JUSTIFICATIVA` | `string`: id de uma justificativa do cenário | Grava `justificativaId`. Vai para `ESCOLHER_CONFIANCA`. |
| `ESCOLHER_CONFIANCA` | `CONFIANCA` | `"chute" \| "duvida" \| "provavel" \| "confiante" \| "certeza"` | Grava `confianca` e pontua a decisão (`resolverEscolhas`), indo para `MOSTRAR_RESULTADO`. |
| `MOSTRAR_RESULTADO` | `CONTINUAR` | — | Encerra o turno (ver 1.5). |
| `MOSTRAR_MERCADO` | `ABRIR_CONSULTORIA` | — | Contrata a consultoria, que revela a chance e o retorno. Só com a oferta aberta. |
| `MOSTRAR_MERCADO` | `DIAGNOSTICAR` | `string`: uma das chaves de `OPCOES_DIAGNOSTICO` (`src/engine/investimentos.js`) | Grava o diagnóstico do argumento do fundador. Vale reputação conforme acerte ou erre. |
| `MOSTRAR_MERCADO` | `INVESTIR` | `number`: um de `APORTES` (10000, 25000 ou 50000) | Debita o aporte, registra o investimento e fecha a oferta. Recusa se o caixa não cobre o valor. |
| `MOSTRAR_MERCADO` | `RECUSAR` | — | Fecha a oferta sem investir. Cobra o honorário se a consultoria foi contratada. |
| `MOSTRAR_MERCADO` | `CONTINUAR` | — | Segue sem escolher; vale como `RECUSAR`. |
| `MOSTRAR_EVENTO` | `PARTICIPAR` | — | Só com cartas na mesa e oferta aberta. Vai para `decisao = 'escolhendo'`. |
| `MOSTRAR_EVENTO` | `ESCOLHER_CARTA` | `number` ou `string` numérica: índice `0`, `1` ou `2` | Escolhe uma das três cartas viradas. O jogo revela outra, nunca a boa (`cartaParaRevelar`). Vai para `decisao = 'trocando'`. |
| `MOSTRAR_EVENTO` | `MANTER` | — | Revela a carta escolhida e aplica o efeito. |
| `MOSTRAR_EVENTO` | `TROCAR` | — | Revela a carta que sobrou (não a escolhida nem a revelada) e aplica o efeito. |
| `MOSTRAR_EVENTO` | `RECUSAR` | — | Passa pela casa sem participar. Encerra o turno sem tela de resultado. |
| `MOSTRAR_EVENTO` | `CONTINUAR` | — | Com cartas na mesa (`escolhendo` ou `trocando`), é ignorada. Em qualquer outro caso encerra o turno, inclusive com a oferta aberta, que vale como passar. |
| `MOSTRAR_BALANCO` | `CONTINUAR` | — | Encerra o turno (ver 1.5). |

Para as cartas de evento, `valor` é o índice na mão (`eventoAtual.cartas`), não o id da carta.

### 1.5 Encerramento do turno

`CONTINUAR` (em `MOSTRAR_RESULTADO`, `MOSTRAR_BALANCO` e nas demais fases que o aceitam) chama a rotina interna `continuar`, que:

1. limpa `cenarioAtual`, `eventoAtual`, `mercadoAtual`, `resultado`, `balanco`, `dado`, `dados` e `jogadaExtra`;
2. só se a jogada passou pelo Balanço, aplica a falência: no competitivo, `julgarBalanco` (que pode eliminar um jogador); no cooperativo, `empresa.dinheiro < 0` encerra a partida;
3. encerra a partida se a empresa faliu, se não há ninguém ativo ou se só sobrou um jogador (com mais de um jogador);
4. se os dois dados foram iguais, o mesmo jogador rola de novo (`jogadaExtra = true`, fase `ROLAR_DADO`);
5. senão, passa a vez ao próximo jogador que não faliu; ao dar a volta, `turnoAtual` aumenta. Com `turnoAtual > turnosPorJogador`, a fase vira `FIM_DE_JOGO` e `apurarInvestimentosFinais` liquida os aportes pendentes.

### 1.6 Tipos de carta e decisões do evento

| Campo | Valores | Origem |
| --- | --- | --- |
| `TIPOS_CARTA` | `"boa"`, `"ruim"`, `"troll"` | `src/scenarios/content/eventos.js` |
| `eventoAtual.decisao` | `null`, `"escolhendo"`, `"trocando"`, `"participou"`, `"recusou"` | `machine.js` |

`null` é a oferta aberta; `"trocando"` é o momento em que uma carta já foi revelada e a pessoa decide manter ou trocar.

---

## 2. Estatísticas (`src/stats/`)

### 2.1 `metrics.js`

Todas as funções recebem um array de números e não alteram a entrada.

| Função | Assinatura | Descrição |
| --- | --- | --- |
| `soma` | `soma(v) → number` | Soma dos valores. |
| `media` | `media(v) → number` | Média aritmética. Array vazio resulta em `NaN`. |
| `mediana` | `mediana(v) → number` | Mediana; em quantidade par, média dos dois centrais. |
| `contagens` | `contagens(v) → Map<number, number>` | Frequência de cada valor. |
| `moda` | `moda(v) → number \| null` | Valor mais frequente. Em empate, vence o menor (determinístico). |
| `percentil` | `percentil(v, p) → number` | Percentil `p` (0 a 100) por interpolação linear entre postos, o mesmo método de `PERCENTIL.INC` e do NumPy. |
| `desvioPadrao` | `desvioPadrao(v) → number` | Desvio padrão amostral (divisor `n − 1`). |
| `mediaAparada` | `mediaAparada(v, prop = 0.05) → number` | Média sem a fração `prop` dos menores e dos maiores valores. |
| `resumo` | `resumo(v) → { media, mediana, moda, p90, p95, p25, p75, iqr, amplitude, dp, cv, media_aparada, maximo, minimo, ponto_medio }` | Todas as métricas acima de uma vez. `cv` é `dp / |media|`. |

### 2.2 `format.js`

| Função | Assinatura | Descrição |
| --- | --- | --- |
| `formatar` | `formatar(tipo, v) → string` | Formata `v` conforme `tipo`: `brl`, `dias`, `minutos`, `gramas`, `porcento`, `mm`, `cm`, `ms`, `seg`, `decimal` ou padrão. Usa separadores pt-BR. |
| `brl` | `brl(v) → string` | Reais, com sinal de menos tipográfico (`−`) para negativos. |
| `brlSinal` | `brlSinal(v) → string` | Como `brl`, com `+` para positivos. |
| `unidade` | `unidade(tipo) → string` | Unidade de exibição de um tipo; `""` para tipo desconhecido. |
| `lerNumero` | `lerNumero(texto) → number` | Lê número digitado em pt-BR (`"2.500"`, `"5000,5"`, `"R$ 3.200"`, `"12 min"`). Devolve `NaN` se não for número. |

`lerNumero` trata ponto isolado entre grupos de três dígitos como separador de milhar; qualquer outro ponto é decimal. Quando há vírgula, a vírgula é o decimal.

### 2.3 Cálculo de cenários (`src/engine/calculo.js`)

Usado pela máquina para aceitar o valor calculado. Não fica em `src/stats/`, mas as funções abaixo completam a API de estatística:

| Função | Assinatura | Descrição |
| --- | --- | --- |
| `ehCalculo` | `ehCalculo(def) → boolean` | Cenário de tipo `calculo`. |
| `margemPct` | `margemPct(esperado) → number` | Margem relativa aceita: 5% abaixo de 100, 2% a partir de 100. |
| `avaliarCalculo` | `avaliarCalculo(opcao, num, informado) → { chave, informado, esperado, margemPct, minimo, maximo, dentro }` | Confere o valor informado contra o valor exato da métrica escolhida (`num[opcao.chave]`). `dentro` indica se o valor está na faixa `[minimo, maximo]`; a tolerância tem piso absoluto (`MARGEM_CALCULO_PISO`). |

---

## 3. Persistência (`src/storage/persist.js`)

Chave de armazenamento: `tabuleiro-do-ceo:partida:v1`. Todas as funções capturam exceções de `localStorage` e não lançam.

| Função | Assinatura | Descrição |
| --- | --- | --- |
| `salvar` | `salvar(estado) → void` | Grava o estado serializado em JSON. Falha de armazenamento é ignorada. |
| `carregar` | `carregar() → estado \| null` | Lê o save. Devolve `null` se não houver save, se o JSON for inválido ou se `versao !== 1`, não houver `jogadores` ou `fase`. |
| `limpar` | `limpar() → void` | Remove o save. |

Quem chama: `src/main.js`, que grava depois de cada transição (`salvar`), apaga ao chegar em `FIM_DE_JOGO` (`limpar`) e ao abandonar a partida pelo botão "Nova partida", com confirmação. A máquina de estados não acessa o armazenamento. Ver [docs/formato-de-save.md](formato-de-save.md).
