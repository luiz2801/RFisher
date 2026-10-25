# Estratégia de testes

Este documento lista os tipos de teste que o Fisher SA deve ter, o que cada um cobre, a situação atual e as lacunas. É derivado de uma varredura de `src/`, `tests/`, `fisher.md` (seção 5.8) e `docs/`.

O projeto é JavaScript puro (ES modules), sem dependências e sem build. Os testes usam o runner nativo `node:test` (`npm test` roda `node --test tests/*.test.js`). Qualquer tipo novo deve seguir essa restrição, salvo decisão registrada em contrário (ver [Decisões em aberto](#decisões-em-aberto)).

## Resumo

| # | Tipo | Alvo principal | Situação |
| --- | --- | --- | --- |
| 1 | Unitário de regras | `src/engine/scoring.js`, `config.js`, `board.js`, `papeis.js`, `state.js` | Parcial (`board.js` e `classificarEmpresa` cobertos) |
| 2 | Unitário de estatística e formatação | `src/stats/` | Coberto (`metrics.js`, `format.js`) |
| 3 | Unitário do RNG | `src/engine/rng.js` | Coberto |
| 4 | Máquina de estados (transições) | `src/engine/machine.js` | Parcial |
| 5 | Invariantes e propriedades | `src/scenarios/generators.js` | Coberto |
| 6 | Validação de conteúdo | `src/scenarios/content/`, `loader.js` | Parcial (testes negativos cobertos) |
| 7 | Simulação e balanceamento | motor completo | Parcial |
| 8 | Persistência e compatibilidade de save | `src/storage/persist.js`, `state.js` | Coberto (falta só a validação rígida, ver decisões em aberto) |
| 9 | Renderização de telas (HTML) | `src/ui/views.js`, `components/grafico.js` | Parcial (`grafico.js` coberto) |
| 10 | Segurança (XSS) | `src/ui/html.js`, `views.js` | Parcial |
| 11 | Acessibilidade | `src/ui/` | Ausente |
| 12 | Integração do navegador (`main.js`) | `src/main.js` | Ausente |
| 13 | Regressão de documentação | `README.md`, `fisher.md`, `docs/` | Ausente |
| 14 | Integração da partida (reducer + save) | `machine.js`, `persist.js` | Coberto |
| 15 | Multiplayer em rede local (LAN) | `src/net/`, `src/ui/views-multi.js` | Coberto (`tests/net-*.test.js`) |

## 1. Unitário de regras

Funções puras do motor, testadas com valores calculados à mão a partir de `fisher.md` seção 3.

- **Pontuação** (`scoring.js`): as quatro categorias (`sucesso`, `sorte`, `incoerencia`, `erro_total`), os cinco níveis de confiança, os dois níveis de jogador, arredondamento a centenas e ausência de `-0`.
- **Multiplicador de reputação**: pontos de controle 0 → ×0,8, 50 → ×1,0, 100 → ×1,3; valores fora de 0–100 são limitados; multiplica só ganhos, nunca perdas.
- **Sequências** (`fisher.md` 3.13): fator ×1,1 por acerto (teto 2) e ×0,9 por erro (piso 0,5); sucesso rende o fator e erro total custa o inverso; sem fator no acerto parcial; soma-se à reputação e ao nível; `atualizarSequencia` estende, troca ou zera; na máquina, a sequência é por jogador, a resposta parcial interrompe, Evento e Balanço não a alteram e save sem `sequencia` conta do zero; o placar mostra a sequência (`tests/scoring.test.js`, `tests/machine.test.js`, `tests/views.test.js`).
- **Variação de reputação** por categoria, vinda de `impacto` do cenário.
- **`justificativaConta`**: `parcial` conta como errada enquanto `PARCIAL_CONTA_COMO_CORRETA` for `false`. Deve existir um teste para cada valor da constante (decisão em aberto no README).
- **`receitaBalanco`**: receita nos três pontos de reputação.
- **Tabuleiro** (`board.js`): `avancar` com e sem volta completa (`passouInicio`), em especial a posição 27 + dado e o limite exato `total === NUM_CASAS`; `coordenadas` devolve 28 células distintas no perímetro da grade 9x7 (e da 7x9); contagem de casas (1 balanço, 18 decisão, 7 evento, 2 mercado) bate com o README.
- **Papéis** (`papeis.js`): `atribuirPapeis` para 1, 2 e 3 jogadores cobre as três diretorias sem repetição; todo setor de `SETORES` pertence a exatamente uma diretoria; `diretoriaDoSetor` para setor inexistente.
- **Estado inicial** (`state.js`): `novoJogo` nos dois modos (empresa só no cooperativo, papéis só no cooperativo); `classificacao` e `vencedores` com empate de dinheiro e de reputação; `classificarEmpresa` em cada limite de faixa (exatamente 175 %, 125 %, 50 % do caixa inicial e reputação 75, 60); `turnos`, `dinheiroInicial` e `reputacaoInicial` limitados a 1–64, R$ 10.000–1.000.000 e 10–100 (valor inválido cai no padrão), `reputacaoInicialDe` para saves antigos, e meta e faixas do cooperativo acompanhando o caixa inicial (`tests/machine.test.js`).

- **Perfil de desempenho** (`desempenho.js`): escala de certeza, evidência de domínio, os quatro diagnósticos, calibração, ordenação de pontos fortes e deficiências, equívocos pesados pela certeza, histórico antigo sem `conceito`, o histórico gravado pela máquina numa partida inteira, e o relatório de fim de jogo (contagem de acertos, parciais e erros, ordem das sugestões, conceitos não vistos, partida sem decisões e materiais para todo conceito).

**Situação:** `tests/scoring.test.js` cobre pontuação, multiplicador e anti-chute. `tests/desempenho.test.js` cobre o perfil de desempenho. `tests/board.test.js` cobre `avancar` (com e sem volta, casa 27 e limite exato) e a contagem de casas (1 balanço, 18 decisões, 7 eventos e 2 mercados), e `tests/machine.test.js` cobre `classificarEmpresa` em cada limite de faixa. Faltam `papeis.js`, `state.js` (empates de `classificacao` e `vencedores`) e `receitaBalanco` isolado.

## 2. Unitário de estatística e formatação

Os números mostrados aos jogadores vêm de `src/stats/`; um erro aqui ensina estatística errada.

- `media`, `mediana` (quantidade par e ímpar), `moda` (empate resolve para o menor valor), `percentil` (interpolação linear, compatível com NumPy, p = 0 e 100, lista de um elemento), `desvioPadrao` (amostral, n − 1), `resumo` (todas as chaves, `iqr`, `amplitude`, `ponto_medio`).
- Valores de referência conferidos contra uma fonte externa (NumPy ou planilha), registrados no teste.
- `formatar` para cada tipo (`brl`, `dias`, `minutos`, `gramas`, `porcento`, `mm`, `cm`, `ms`, padrão), separadores `pt-BR`, arredondamento; `brl` e `brlSinal` com negativos e zero.

**Situação:** `tests/stats-metrics.test.js` cobre `metrics.js`: mediana de lista par e unitária, moda com empate, percentil p0/p100, lista unitária e interpolação, desvio padrão amostral e `resumo`. Os valores de referência foram calculados à mão e estão comentados no teste; falta a conferência registrada contra NumPy ou planilha. `tests/stats-format.test.js` cobre `format.js`: `formatar` em todos os tipos e no padrão, `brl` e `brlSinal` com sinal de menos tipográfico, `unidade` e `lerNumero`. Observação: `unidade('toString')` devolve a função herdada de `Object.prototype` (`UNIDADES` é um objeto simples); sem impacto hoje, pois o tipo vem do conteúdo dos cenários, e por isso não há teste fixando esse caso.

## 3. Unitário do RNG

A reprodutibilidade por seed é pilar do projeto (partida salva, invariantes, simulação).

- Mesma seed → mesma sequência; seeds diferentes → sequências diferentes.
- `prox` em [0, 1); `inteiro(min, max)` inclui os dois extremos e nunca sai do intervalo; `entre`.
- `embaralhar` é permutação (mesmos elementos), não altera a lista original e é determinística.
- `normal`: média e desvio aproximados em amostra grande (tolerância explícita), sem `NaN` nem `Infinity`.
- O estado exposto (`rng.estado`) retoma a sequência exatamente de onde parou (usado no save).

**Situação:** coberto em `tests/rng.test.js`: determinismo por seed, `prox` em [0, 1), `entre`, extremos de `inteiro`, `embaralhar` (permutação, não altera a original, determinístico), `normal` (média e desvio com tolerância explícita) e retomada pelo `estado`.

## 4. Máquina de estados

`reduzir(estado, acao)` é uma função pura; cada fase tem um conjunto fixo de ações válidas.

- **Tabela de transições:** para cada fase (`ROLAR_DADO`, `ESCOLHER_METRICA`, `INFORMAR_VALOR`, `ESCOLHER_JUSTIFICATIVA`, `ESCOLHER_CONFIANCA`, `MOSTRAR_RESULTADO`, `MOSTRAR_EVENTO`, `MOSTRAR_BALANCO`, `FIM_DE_JOGO`) × cada tipo de ação, só a combinação válida muda o estado; as demais devolvem o mesmo objeto.
- **Ordem da decisão:** métrica → justificativa → confiança (ver `docs/diagramas-uml.md`); em cenário de cálculo, métrica → valor → justificativa → confiança. Coberto em `tests/calculo.test.js`: `INFORMAR_VALOR` só aceita número (ou texto pt-BR) e só nessa fase, e o cenário comum não passa por ela.
- **Entradas inválidas:** métrica ou justificativa que não pertence ao cenário, confiança fora da escala (`chute`, `duvida`, `provavel`, `confiante`, `certeza`), `valor` ausente.
- **Pureza:** o estado anterior não é alterado (`structuredClone`).
- **Fim de turno e de jogo:** rotação de jogadores, incremento de `turnoAtual`, `FIM_DE_JOGO` após `turnosPorJogador`.
- **Falência** (`fisher.md` 3.12): caixa negativo ao continuar, numa jogada com Balanço, marca o jogador como `falido` e ele é pulado nos turnos seguintes; caixa negativo fora do Balanço não elimina (competitivo e cooperativo); caixa zero não quebra; com dois jogadores o sobrevivente vence na hora; falido perde mesmo com mais dinheiro; jogador único sem vencedor; no cooperativo a empresa quebra e a partida acaba na faixa Falência; veredito adiado enquanto um rival negativado, com saldo pior, não passa pelo Balanço (perde o de menor saldo depois, seja quem esperava, seja o rival; ou quem esperava, se o rival se recupera; rival com saldo melhor não faz esperar); aviso de falência (e de veredito adiado) na tela e placar com o falido marcado.
- **Baralhos:** `sacarCenario` e `sacarCarta` esgotam o baralho e reembaralham sem repetir carta dentro de um ciclo (as cartas de evento, por tipo); com mais decisões que cenários, todos aparecem.
- **Dificuldade por progresso:** `dificuldadeAlvo`, `pesoDificuldade` e `escolherPorDificuldade`; o progresso (`progressoDoJogador`) conta voltas e aceita save sem `distancia`; a dificuldade média sorteada na 2ª metade da partida é maior que na 1ª; o baralho não repete dentro de um ciclo; a progressão escolhida (gradual, tradicional, acelerada) muda o ritmo da dificuldade-alvo e uma inválida ou ausente vale a tradicional. Coberto em `tests/dificuldade.test.js`.
- **Crise de imagem:** reputação em 0 aplica `MULTA_CRISE` e vai a `REPUTACAO_POS_CRISE`, em decisão, evento e balanço; o dinheiro pode ficar negativo (e, se a jogada passou pelo Balanço, isso é falência).
- **Balanço:** disparado ao passar pela casa 0 (inclusive cair nela), no competitivo e no cooperativo; cálculo de `receita − CUSTOS_BALANCO`.
- **Cooperativo:** `metaTrimestral` por trimestre e por nº de jogadores; meta cumprida (bônus) e falha (corte); bônus do RH; amortecimento do prejuízo de eventos do setor da diretoria (`REDUCAO_PREJUIZO_PASSIVA`) e nenhum amortecimento em ganhos ou setores sem diretor; caixa da empresa separado da carteira dos jogadores.
- **Competitivo:** carteira individual, sem `empresa`.
- **Investimentos do Mercado** (`fisher.md` 3.14): a oferta abre na casa de Mercado com o porte da reputação; `INVESTIR` debita e registra o aporte, ignora valor fora das faixas ou acima do caixa; só se decide uma vez; a consultoria corta o ganho guardado em 50% e cobra R$ 15.000 no fracasso (o crédito pode ficar negativo), e contratar o relatório sem investir (recusar ou seguir sem decidir) debita os R$ 15.000 na hora, sem cobrar de novo quem investe; o diagnóstico certo rende e o errado custa reputação (inclusive a crise de imagem); `CONTINUAR` sem decidir vale recusar; o rival do solo não recebe oferta; o Balanço apura só os aportes de quem passa por ele, antes da nova oferta e antes da falência; no cooperativo usa o caixa da empresa e conta para a meta; o fim da partida apura o que sobrou (e não apura para quem faliu); save antigo sem os campos de investimento (`tests/investimentos.test.js`).

**Situação:** `tests/machine.test.js` cobre determinismo, os atalhos de teste (casa forçada e baralho restrito), fim de partida, ação inválida por fase, pureza, ordem da decisão, JSON e todo o cooperativo. Também cobre, desde o relatório de testes: bônus do RH, valores exatos e limite (`>=`) da meta do Balanço, estrutura de `balanco.meta`, amortecimento passivo de eventos (todas as cartas, nos dois modos, escolhidas pelo fluxo de participar e escolher) e a crise de imagem nos três pontos de origem (decisão, evento e Balanço cooperativo), inclusive a crise que empurra o caixa para negativo e leva à falência. Cobre também a casa de Evento (`fisher.md` 3.15): oferta sem efeito, participar, escolher a carta pela posição, a troca no estilo Monty Hall (a carta revelada nunca é a boa nem a escolhida, trocar leva à que sobrou, o efeito só vale ao decidir e, em 600 sementes, trocar dá a boa em ≈ 2/3 das vezes e manter em ≈ 1/3), passar, ações inválidas, o rival que não participa, o baralho por tipo sem repetição no ciclo, o save de formato antigo, as telas em `tests/views.test.js` e a retomada do save com as cartas na mesa em `tests/persist.test.js`. Faltam entradas inválidas de `valor` nas demais fases, o esgotamento e reembaralhamento dos baralhos e a tabela completa fase × ação.

## 5. Invariantes e propriedades dos geradores

Cada gerador de `generators.js` declara um `invariante` que garante o ponto pedagógico do cenário (por exemplo, média > 1,5 × mediana no cenário 1).

- Os invariantes valem em 1.000 seeds para todos os cenários (`fisher.md` 5.8).
- Teste específico por cenário, com as propriedades matemáticas nomeadas (cenários 1, 4, 5, 6, 7 e 8 já existem).
- Mesma seed → mesmos dados.
- Gerador que não satisfaz o invariante em 200 tentativas lança erro (testar com gerador forçado a falhar).
- `verificarInvariante` rejeita séries que violam a regra.
- Toda série tem o tamanho e o formato esperados (sem `NaN`, valores dentro do domínio, discretos inteiros).

**Situação:** coberto, inclusive `tiposDeGerador`, gerador desconhecido e a falha após exatamente 200 tentativas (com gerador forçado a falhar). Falta o teste específico dos cenários 2 (P90) e 3 (moda).

## 6. Validação de conteúdo

Cenários e eventos são dados; o conteúdo é validado como código.

- `validarCenario` em todo cenário, com várias seeds (já existe), incluindo `dificuldade` de 1 a 3 e ao menos um cenário por nível.
- Regras: exatamente 5 opções e 1 correta, 6 a 8 justificativas e exatamente 1 `correta`, todo `equivoco` com feedback, opção errada com equivoco, tipos de justificativa válidos, setor válido, placeholders existentes, marcadores de revelação com valor.
- **Testes negativos** do validador: uma regra violada por vez, cada uma gerando exatamente um erro (em `tests/scenarios.test.js`; a regra de `equivoco` obrigatório em justificativa `erro_conceitual`/`afirmacao_falsa` não existe no validador, ver decisões em aberto).
- Ids de cenário e de evento únicos (`tests/scenarios.test.js` confere o conteúdo das 41 cartas e que o valor esperado de participar fica perto de zero); todo evento tem setor válido, `tipo` válido (`boa`, `ruim` ou `troll`), dinheiro e reputação numéricos, e lição nas cartas boas e ruins.
- **Coerência pedagógica:** `cenario.opcoes[correta]` corresponde ao gabarito calculado a partir dos dados (por exemplo, a opção correta do cenário 1 é a mediana, e o valor mostrado vem de `resumo`).
- Distribuição por setor: todo setor de `SETORES` tem pelo menos um cenário e um evento (necessário para o cooperativo).
- Contagem de cenários e eventos igual à do README (30 cenários, 41 eventos: 16 boas, 16 ruins e 9 trolls).
- **Empresas do Mercado** (`tests/investimentos.test.js`): ids únicos e campos válidos, narrativas, valor esperado por tipo (furada negativa, sólida positiva, mesmo no pior sorteio da chance), portes com empresas dos dois tipos, todas as falácias usadas e o investimento às cegas perto de zero.
- **Cenários de cálculo** (`tests/calculo.test.js`): o validador recusa opção que revela o valor, opção sem `chave`, falta de `como_calcular` e `exibir` sem tabela; margem de 5% abaixo de 100 e 2% a partir de 100, relativa ao valor exato, com piso para valor zero; valor conferido contra a métrica escolhida (e não a correta); valor fora da margem invalida a métrica; o rival informa o valor exato; `lerNumero` entende pt-BR; a tela do valor mostra tabela, margem e campo sem revelar a resposta; o resultado mostra valor informado, exato, faixa e como calcular; partida inteira reproduzível com save a cada ação; a calculadora embutida aparece só na etapa do valor, bate com as métricas do cenário e recusa P fora de 0 a 100, lista vazia e desvio com um registro.

**Situação:** `tests/scenarios.test.js` cobre a validação geral, ids únicos, placeholders e setores. Os testes negativos atômicos do validador estão cobertos (opções, justificativas, tipo, equívocos, marcador, dificuldade, setor, conceito, placeholder). Faltam coerência do gabarito, cobertura por setor e contagem.

## 7. Simulação e balanceamento

Valida que o jogo premia conhecimento e não sorte (`fisher.md` 5.8 e 3.5).

- Quem chuta termina com menos dinheiro que quem sabe tudo (já existe).
- O dado não decide a partida (já existe).
- Esperança do chute total ≈ −0,27 × V × confiança (já existe, em `scoring.test.js`).
- Rival do modo solo (já existe, em `bot.test.js`): acerto empírico igual ao do perfil, confiança crescente com o perfil, partida reproduzível com save, taxa de vitória da referência decrescente do fácil ao difícil, chutador perde do fácil. A calibração em si fica em `scripts/simular-bot.mjs`, por ser lenta.
- Jogador que acerta 70 % fica entre os dois (o `fisher.md` pede os três perfis; hoje só há dois).
- Nos dois níveis (`iniciante`, `avancado`) e com 1, 2 e 3 jogadores.
- Cooperativo: equipe que sabe tudo chega a faixa superior; equipe que chuta chega a `falencia` ou `sobrevivencia`; nenhuma faixa é inalcançável. A calibração das constantes de `config.js` é marcada como "a calibrar" e deve ser acompanhada por um teste de relatório, não de aprovação rígida.
- Sem partida que não termina, sem `NaN` em dinheiro ou reputação, reputação sempre em 0–100.
- Mercado: investir sem critério rende perto de zero por porte e investir só nas sólidas rende bem mais (cálculo exato sobre o catálogo, em `tests/investimentos.test.js`); a frequência de sucesso de um aporte acompanha a chance. Falta simular partidas inteiras com uma política de investimento e medir o efeito no ranking (questão em aberto nº 12 do `fisher.md`).

Observação: testes estatísticos devem usar seeds fixas e margens amplas para não ficarem instáveis.

**Situação:** parcial, faltam o perfil de 70 %, a matriz de níveis e jogadores e as propriedades do cooperativo sob simulação.

## 8. Persistência e compatibilidade de save

- Estado sobrevive a `JSON.stringify` / `JSON.parse` e a partida continua igual (já existe, nos dois modos).
- `carregar` devolve `null` para: chave ausente, JSON inválido, `versao` diferente de 1, sem `jogadores`, sem `fase`.
- `salvar` e `limpar` não lançam erro quando `localStorage` falha (cota excedida, modo privado); testar com um `localStorage` falso.
- Ida e volta `salvar` → `carregar` com um `localStorage` falso em memória.
- **Compatibilidade retroativa:** um save sem o campo `modo` (versões antigas) é tratado como competitivo (`ehCooperativo`). Manter fixtures de saves antigos em `tests/fixtures/`; ao alterar o formato (`src/storage/`), incrementar a versão e adicionar o teste de migração ou descarte.
- Partida salva no meio de cada fase retoma e termina.

**Situação:** `tests/persist.test.js` cobre `persist.js` com um `localStorage` falso (restaurado ao fim de cada teste): ida e volta, chave ausente, JSON inválido, `versao` diferente de 1, sem `jogadores`, sem `fase`, `limpar`, e falhas de cota sem lançar erro. Em `tests/fixtures/` há cinco saves estáticos (`save-v1-competitivo`, `save-v1-cooperativo`, `save-legado-sem-modo`, `save-legado-sem-distancia`, `save-legado-sem-dinheiro-inicial`); cada um é carregado, renderizado e jogado até o fim, e os legados conferem os defaults seguros. A retomada (salvar, carregar, `deepEqual` e terminar igual) é testada em cada fase, nos dois modos. Para regenerar as fixtures, conduza uma partida com `novoJogo` e `reduzir` até `ESCOLHER_CONFIANCA` e remova os campos do legado.

## 9. Renderização de telas

As views são funções puras `estado → string HTML`, testáveis sem navegador.

- Todas as telas de uma partida renderizam, em ambos os modos, sem placeholder não substituído e sem `undefined` (já existe).
- Mercado: a oferta mostra o fundador e os lucros, e esconde retornos e chance até o relatório da consultoria; aportes acima do caixa desabilitados; a decisão mostra o veredito do diagnóstico e a explicação do argumento; o rival do solo vê o Mercado sem oferta; o placar e o painel da empresa mostram o dinheiro investido; o Balanço (e o aviso de quem passa por ele) lista o retorno dos investimentos, inclusive em save antigo sem a lista; o fim de jogo mostra a apuração final com nome escapado (`tests/views.test.js`).
- Cada fase tem uma view e nenhuma fase cai no ramo padrão.
- Conteúdo condicional: dica só para `iniciante`, oculta até ser pedida (`ABRIR_DICA`), com bônus de confiança reduzido nos ganhos; revelação de marcadores no resultado; aviso de crise; banner de balanço; meta do Balanço no cooperativo; placar competitivo versus painel da empresa; empate no fim de jogo; faixas de fim cooperativo.
- Formatos numéricos em `pt-BR` e sinais (+/−) corretos nos deltas.
- **`grafico.js`**: `calcularBarras` (discreto: uma barra por inteiro; contínuo: 12 faixas, valor máximo cai na última faixa, soma das barras = nº de valores), `calcularDominio` (folga, série constante, discreto), `calcularTicks` (marcas redondas, todas dentro do domínio, sem ruído de ponto flutuante).
- **Snapshots** opcionais de telas-chave, para detectar mudança involuntária de marcação (usar `assert.snapshot` do `node:test` somente se a versão do Node o suportar).

**Situação:** `tests/views.test.js` cobre o menu e a travessia completa. `tests/grafico.test.js` cobre `calcularBarras`, `calcularDominio`, `calcularTicks` e a marcação acessível de `grafico`. Falta o conteúdo condicional das views.

## 10. Segurança (XSS)

O jogo usa `innerHTML` com texto digitado pelo jogador (nome).

- `esc` neutraliza `& < > " '` (já existe).
- Nenhuma view injeta `nome` sem `esc`: testar nome malicioso em todas as fases e nos dois modos (já existe para o competitivo; ampliar para o cooperativo e para o menu com partida salva).
- Texto vindo de um save corrompido ou adulterado no `localStorage` também é escapado (nome, ids).
- Atributos `data-*` e `aria-label` com valores escapados.

**Situação:** parcial.

## 11. Acessibilidade

Exigida pelo `fisher.md` 5.9.

- **Automático (HTML estático):** todo gráfico tem `role`, título, descrição textual e tabela de dados alternativa; botões com rótulo; `aria-label` no dado; hierarquia de títulos; campos do formulário com `label`.
- **Cor não é o único indicador** de acerto ou erro: toda marcação de acerto/erro tem texto ou ícone.
- **Manual (checklist, a cada mudança de UI):** navegação completa por teclado, foco movido para o painel a cada transição, contraste (WCAG AA) em tema padrão, leitor de tela em uma partida completa.
- Opcional: auditoria com axe ou Lighthouse no navegador, fora do `npm test`.

**Situação:** ausente.

## 12. Integração do navegador

`main.js` liga estado, views, armazenamento e eventos do DOM, e não tem teste.

- Fluxo ponta a ponta: menu → configurar → jogar uma partida inteira → fim → nova partida.
- Retomar partida salva depois de recarregar a página.
- Despacho de ações pelos `data-acao`; `NOVA` pede confirmação durante a partida; `ABRIR_CONFIG` (abre o assistente da tela inicial, com navegação Anterior/Próximo), `CONTINUAR_SALVA`; mudança do nº de jogadores mostra/esconde os campos.
- Saneamento do formulário: `n` limitado a 1–`MAX_JOGADORES`, nome vazio vira "Jogador N", nível e modo inválidos caem no padrão, seed é uma lista (aleatória ou Mercado 1 a 20): vazia gera aleatória, valor da lista reproduz e valor fora da lista cai em aleatória.
- Partida terminada limpa o save.

Duas opções, a decidir (ver abaixo): (a) extrair a lógica de `iniciar` para um módulo puro testável com `node:test`; (b) adotar um teste de navegador (Playwright), o que quebra a regra "sem dependências".

**Situação:** ausente.

## 13. Regressão de documentação

`CLAUDE.md` exige que a documentação acompanhe a lógica. Parte da verificação pode virar teste barato.

- Contagem de casas, cenários e eventos citada no README é igual à do código.
- Constantes citadas em `fisher.md` e `docs/modo-cooperativo.md` (valores iniciais, multiplicadores, metas) conferem com `config.js` e `scoring.js`.
- Todo arquivo de `src/` aparece em `docs/diagramas-uml.md`.

**Situação:** ausente. Prioridade baixa.

## 14. Integração da partida

O projeto não tem rotas HTTP; o equivalente a um teste de API é conduzir uma partida inteira pelo reducer `reduzir`, como o `main.js` faz a cada clique, passando pela persistência.

- Partida completa nos dois modos (`competitivo` e `cooperativo`), com um jogador que sempre acerta.
- Salvar a cada ação e recarregar do save no meio da partida: o estado final é idêntico (`deepEqual`) ao da partida sem interrupção.

**Situação:** coberto em `tests/integracao-partida.test.js`.

## 15. Multiplayer em rede local (LAN)

O multiplayer serverless via WebRTC (`RTCDataChannel`) é testado sem depender de rede externa ou APIs de navegador fechadas, utilizando transporte simulado em memória (`transporte-falso.js`):

- **Códigos de convite e protocolo** (`tests/net-codigo.test.js`): compactação com `deflate-raw`, codificação base64url, integridade de SDP, rejeição de payloads inválidos e validação de schema das mensagens com limites de tamanho (`MAX_DO_DONO`, `MAX_DO_CONVIDADO`).
- **Regras da sala e lobby** (`tests/net-sala.test.js`): validação de vagas (2 a 3), regras de transição de fase, início válido sem repetição de diretorias, substituição de jogador por bot e retorno ao lobby para revanche.
- **Piloto automático de bots e resiliência** (`tests/net-piloto.test.js`): avanço determinístico de bots em todas as fases da máquina de estados, teste de propriedades simulando quedas súbitas em qualquer ponto do jogo e condução até `FIM_DE_JOGO`.
- **Sessão do anfitrião e do convidado** (`tests/net-sessao.test.js`): partida multiplayer completa conduzida via rede simulada, pings, detecção de silêncio (8s aviso, 60s substituição), ressincronização de estado e encerramento de sala.
- **Telas e modo espectador** (`tests/net-views.test.js`): modal multiplayer (escolha, passo 1, passo 2 com aviso de 15s, lobby dono e convidado), visão de espectador com pronomes em terceira pessoa e botões desabilitados, revanche e relatórios colapsados no fim de jogo.

**Situação:** coberto em `tests/net-codigo.test.js`, `tests/net-sala.test.js`, `tests/net-piloto.test.js`, `tests/net-sessao.test.js` e `tests/net-views.test.js`.

## Prioridades sugeridas

1. **Alta:** persistência (8), RNG (3), tabuleiro e papéis (1), baralhos e crise de imagem (4). Tudo puro e barato, e protege os pilares de reprodutibilidade e de save.
2. **Média:** estatística e formatação (2), `grafico.js` e conteúdo condicional das views (9), testes negativos do validador e cobertura por setor (6), simulação com perfil de 70 % (7).
3. **Baixa:** acessibilidade automática (11), regressão de documentação (13), integração do navegador (12).

## Convenções

- Um arquivo `tests/<módulo>.test.js` por área; nomes de teste em português, descrevendo o comportamento.
- Seeds fixas, nunca `Date.now()` nem `Math.random()` em testes.
- Testes estatísticos com tolerância explícita e comentada.
- Fixtures de saves antigos em `tests/fixtures/`.
- Todo bug corrigido ganha um teste que falha antes da correção.
- `npm test` deve passar antes de concluir qualquer mudança (regra do `CLAUDE.md`).
- `npm run lint` deve passar: o lint (`scripts/lint.mjs`) roda `node --check` em `src/`, `tests/` e `scripts/` e falha em `test.only`, `describe.only` e `debugger`.

## Esteira de CI

`.github/workflows/test.yml` (GitHub Actions) roda em todo pull request e em push na `main`, com matriz Node 20 e 22 (`fail-fast: false`), permissão só de leitura e cancelamento de execuções antigas da mesma ref. Etapas: `npm ci` só se houver `package-lock.json`, `npm run lint`, `npm run test:cobertura` e upload do `coverage/lcov.info` como artefato (só no Node 22).

Os checks `Node 20` e `Node 22` são obrigatórios na proteção da `main`: o merge de um pull request exige os dois verdes e a branch atualizada em relação à `main`, e não há push direto (a regra vale também para administradores).

`.github/workflows/deploy.yml` publica no GitHub Pages a cada push na `main`, com o job `deploy` dependente de `npm run lint` e `npm test` no Node 22. O lint entra no deploy porque o `npm test` não carrega arquivos sem teste (como `src/main.js`), e um erro de sintaxe neles quebraria o jogo no navegador. O Node 20 fica só no workflow de testes: o site roda no navegador, e o merge na `main` já exige o check `Node 20`. O Pages usa a origem **GitHub Actions**; com a origem legacy ("Deploy from a branch"), o GitHub publicaria a `main` também por conta própria, sem testes.

## Decisões tomadas

- **Lint e cobertura sem dependências.** O lint é um script próprio (sintaxe e bloqueio de `.only`/`debugger`), não ESLint nem Prettier; a cobertura usa `node --test --experimental-test-coverage` com os reporters nativos `spec` e `lcov`. Adotar regras de estilo ou formatação exigiria dependências e deve ser decidido antes.
- **Sem limite mínimo de cobertura.** O CI apenas reporta a cobertura; a meta continua em aberto (abaixo).
- **Node 20 e 22 (LTS) no CI.** Os scripts passam `tests/*.test.js` sem aspas, para o shell expandir o glob: o `node --test` só aceita glob a partir do Node 21.

## Decisões em aberto

- **Validação rígida em `carregar()`:** hoje só confere `versao`, `jogadores` e `fase`. Um save com `posicao: 99`, `jogadorAtual` fora do intervalo ou cenário fora do catálogo é aceito. Decidir se `persist.js` passa a devolver `null` nesses casos; só então escrever os testes.
- **`equivoco` em justificativas:** `docs/criar-cenarios.md` exige `equivoco` em toda justificativa `erro_conceitual` ou `afirmacao_falsa`, mas `validarCenario` só cobra nas opções. Decidir se o validador passa a cobrar ou se a documentação é flexibilizada (os 30 cenários atuais já cumprem a regra).
- Como testar `main.js` e a UI no navegador sem dependências (extrair lógica pura ou aceitar Playwright).
- Se o `JSON Schema`/Zod citado em `fisher.md` 5.8 será adotado; hoje `validarCenario` o substitui.
- Meta de cobertura de código: `npm run test:cobertura` mede e o CI reporta, mas não há limite definido.
