# Fisher SA

Jogo de tabuleiro digital e educativo de estatística. Especificação completa em [fisher.md](fisher.md). Documentação arquitetural e diagramas UML em [docs/diagramas-uml.md](docs/diagramas-uml.md). Tipos de teste esperados e lacunas atuais em [docs/testes.md](docs/testes.md). Como criar cenários, eventos e geradores em [docs/criar-cenarios.md](docs/criar-cenarios.md). Formato da partida salva e política de versão em [docs/formato-de-save.md](docs/formato-de-save.md).

## Rodar

O jogo usa ES modules, então precisa de um servidor local (abrir o `index.html` direto não funciona):

```
npm start                # http://localhost:8000
npm test                 # testes (node:test, sem dependências)
npm run test:cobertura   # testes + cobertura: resumo no terminal e coverage/lcov.info
npm run lint             # sintaxe (node --check) e bloqueio de test.only e debugger
node scripts/simular-bot.mjs [--calibrar]   # balanceamento do rival do modo solo (taxa de vitória por perfil)
```

Requer Node.js 20 ou mais recente. O CI (`.github/workflows/test.yml`, GitHub Actions) roda `lint` e `test:cobertura` em Node 20 e 22 a cada pull request e push na `main`, e publica o `lcov.info` como artefato.

## Deploy

O workflow `.github/workflows/deploy.yml` publica o jogo no GitHub Pages a cada push na `main` (depois de `npm run lint` e `npm test` passarem) ou manualmente (Actions → Deploy GitHub Pages → Run workflow). O site é estático e sem build: só `index.html`, `style.css` e `src/` vão para o ar. Configuração única: em Settings → Pages → Source, escolha **GitHub Actions**. Endereço: https://luiz2801.github.io/RFisher/

A `main` é protegida (Settings → Branches): não aceita push direto, nem do administrador, nem force push ou exclusão. Toda mudança entra por pull request, que só pode ser mergeado com os checks `Node 20` e `Node 22` do workflow de testes verdes e com a branch atualizada em relação à `main` (sem conflitos e testada sobre a versão mais recente). Não é exigida aprovação de revisor.

## Estado atual

- Modos competitivo, cooperativo e solo. O solo é o competitivo contra um rival controlado pelo computador, em três perfis (Estagiário(a), Analista, Sênior). O rival acerta com a frequência do perfil, menos nos cenários difíceis, aposta por uma certeza interna ruidosa e foi calibrado por simulação para que um jogador de acerto 0,6 vença 70%, 50% e 30% das partidas (`fisher.md` 3.11, `scripts/simular-bot.mjs`).
- Trilha ampliada de 28 casas no perímetro de uma grade 9x7 (7x9 em tela em pé) (1 casa de Balanço, 18 de Decisão e 9 de Evento), 1 a 3 jogadores em hot-seat, dois dados (soma, 2 a 12) com animação de rolagem e o peão saltando casa a casa até a posição final, aposta de confiança em 5 níveis (×0,5 a ×1,5), métrica e justificativa.
- Configuração da partida no menu: rounds por jogador (trimestres, de 1 a 64, padrão 10) e caixa inicial (R$ 10.000 a R$ 1.000.000, padrão R$ 100.000), em campos numéricos. O motor também limita os dois valores (`novoJogo`). No cooperativo, a meta de caixa e as faixas finais acompanham o caixa inicial (`fisher.md`, decisão nº 12).
- Sequências (`fisher.md` 3.13): cada sucesso absoluto seguido multiplica o ganho por 1,1 (teto ×2) e cada erro total seguido por 0,9 (piso ×0,5); o erro total custa o inverso do fator (mais com erros seguidos, menos com acertos seguidos). Sucesso e erro exigem todas as etapas certas (ou erradas): métrica e justificativa nos conceituais, mais o valor nos de cálculo. Resposta parcial zera a sequência; Evento e Balanço não a alteram. Por jogador, e o placar mostra a sequência em andamento.
- Casas: Decisão, Evento e Balanço. Duelo, Mercado e Auditoria ficam para a Fase 2.
- 25 cenários de tomada de decisão estatística com dados gerados por seed e invariantes matemáticos testados em 1.000 seeds cada (os cenários 14 a 18 são de cálculo, ver abaixo). Cada um tem dificuldade 1 a 3 (entre parênteses) e o sorteio favorece os mais difíceis conforme o jogador avança na trilha (ver abaixo):
  1. *Salários na startup* (dif. 1): Assimetria à direita e outliers (Média vs. Mediana).
  2. *SLA de e-commerce* (dif. 2): Cauda longa de atrasos severos (Percentil 90 / P90).
  3. *Estoque de calçados* (dif. 1): Variáveis discretas e reposição por demanda (Moda).
  4. *Precisão de peças industriais* (dif. 2): Mesma média e espalhamentos distintos (Desvio padrão).
  5. *Avaliações do aplicativo* (dif. 2): Distribuição bimodal/polarizada (Frequência por nota).
  6. *Tempo de suporte no SAC* (dif. 3): Sensibilidade a outliers na dispersão (Amplitude Interquartil / IQR).
  7. *Linha de envase de café* (dif. 1): Distribuição normal e simétrica sem outliers (Média aritmética como estimador ótimo).
  8. *Teste A/B de conversão* (dif. 3): Variabilidade amostral e consistência (Desvio padrão e tamanho da amostra).
  9. *Portão do centro de distribuição* (dif. 1): Restrição física em que toda a frota precisa passar (Máximo, não um valor típico).
  10. *Tempo de resposta da API* (dif. 2): Cauda longa e contrato que pede 95% das requisições (P95, não P90).
  11. *Resolução no primeiro contato* (dif. 2): Assimetria à esquerda, com poucos valores muito baixos (Mediana).
  12. *Onde aplicar o caixa da folha* (dif. 3): Fundo com média maior e muito mais oscilação (Desvio padrão como risco).
  13. *Projeção de receita do aplicativo* (dif. 3): Maioria de zeros, mediana zero (Média para projetar totais).
  14. *Aluguel típico do bairro* (dif. 1, cálculo): Assimetria à direita (Mediana, calculada à mão sobre 11 registros).
  15. *Espera no pronto-atendimento* (dif. 2, cálculo): Cauda longa (P90 por posição na lista ordenada de 21 registros).
  16. *Chamados de suporte por cliente* (dif. 3, cálculo): Contagens com cauda à direita em tabela de frequências (Média para projetar um total).
  17. *Regularidade da embaladora* (dif. 2, cálculo): Oito tempos de ciclo (Desvio padrão amostral, não a amplitude).
  18. *Estabilidade da carga noturna* (dif. 3, cálculo): Uma execução travada (IQR, calculado pelos quartis).
  19. *Comparando o risco de duas filiais* (dif. 3): Filiais de portes muito diferentes (Coeficiente de variação, não o desvio padrão bruto).
  20. *Nota de clima e outliers comportamentais* (dif. 2): Notas 0 e 10 dadas sem critério sobre um sino (Média aparada).
  21. *O mistério da taxa de conversão* (dif. 3): A conversão sobe em cada dispositivo e cai no geral (Paradoxo de Simpson). Em vez de histograma, mostra uma tabela de taxas; as visitas aparecem só no resultado.
  22. *Viés na contratação ou ilusão matemática?* (dif. 3): As mulheres têm taxa de aprovação maior em Engenharia e em Vendas, mas menor no geral (Paradoxo de Simpson). Tabela de taxas; os candidatos por departamento aparecem só no resultado.
  23. *O aplicativo perfeito (para quem ficou)* (dif. 2): Pesquisa de satisfação só com usuários antigos, com notas quase máximas (Viés de sobrevivência).
  24. *O alarme infalível de 99%* (dif. 3): Um alarme de IA com 1% de erro para 1 fraude em 10.000 transações (Falácia da taxa base). Os alarmes disparados aparecem só no resultado.
  25. *A mágica dos anúncios e guarda-chuvas* (dif. 1): Gasto com anúncios e vendas de guarda-chuvas sobem e descem juntos (Correlação não implica causalidade). A chuva de cada mês, a variável oculta, aparece só no resultado.
- Cenários de cálculo (`tipo: 'calculo'`, `fisher.md` 4.7): os dados vêm em tabela (e, em alguns, também em gráfico) e a decisão tem quatro etapas: **métrica → valor calculado → justificativa → confiança**. O valor é aceito dentro de uma **margem** relativa ao valor exato da métrica escolhida (5% para valores abaixo de 100 e 2% a partir de 100, conforme a grandeza do valor exato, mostrada na tela); percentis e quartis pelo método linear (como `PERCENTIL.INC` das planilhas) e desvio padrão amostral. A métrica só conta como certa com a opção certa **e** o valor dentro da margem. O resultado mostra o valor informado, o correto, a faixa aceita e o passo a passo. Um botão copia a tabela em texto com tabulações (vírgula decimal, sem unidade) para colar no Excel. Na etapa do valor há uma **calculadora de estatísticas embutida** (média, mediana, quartis, IQR, percentil, desvio padrão etc.) que opera sobre os dados da tabela; ela não preenche o campo do valor nem pontua. O rival do solo informa o valor exato da métrica que escolhe.
- Dificuldade crescente: o progresso do jogador (casas percorridas, contando voltas, em relação ao percurso esperado da partida) define uma dificuldade-alvo de 1 a 3, e os cenários do baralho são sorteados com peso maior perto dessa dificuldade. Nenhum cenário é excluído e o baralho não repete dentro de um ciclo. Não há indicação da dificuldade na tela.
- 18 cartas de eventos (9 positivas e 9 negativas) com lições estatísticas práticas (eixo truncado, correlação vs causalidade, viés de sobrevivência, regressão à média, paradoxo de Simpson, falácia do apostador, viés de autosseleção, comparações múltiplas, valor esperado, etc.). Todo setor tem ao menos um cenário e um evento.
- Perfil de desempenho por jogador (`perfilDesempenho` em `src/engine/desempenho.js`, `fisher.md` 4.6): cada cenário declara o conceito que avalia (16 conceitos em `src/scenarios/content/conceitos.js`), e o histórico de decisões é agregado por conceito em pontos fortes e deficiências, cruzando acerto e certeza declarada (domina, inseguro, equívoco convicto, lacuna), com equívocos recorrentes e calibração da confiança.
- Relatório de desempenho no fim de jogo, um por pessoa (o rival do computador fica de fora): acertos totais, parciais e erros, assuntos que mais e menos domina e sugestões de estudo com links gratuitos em português para cada um dos 16 conceitos (`src/scenarios/content/materiais.js`, `fisher.md` 4.6). Pode ser impresso ou salvo em PDF, já que o save é apagado no fim da partida.
- Escolha de setor no menu de nova partida: cada jogador escolhe a diretoria que representa (Operações, Tecnologia ou Pessoas e Finanças), que é o mesmo setor nos dois modos. No competitivo e no solo é só o cargo exibido (`diretoria` no jogador); no cooperativo define os `papeis` e o efeito passivo (`docs/modo-cooperativo.md` seção 1). Não repete entre jogadores (exceto no solo e no cooperativo com 2); escolha inválida cai na atribuição padrão por ordem.
- Material de apoio no menu de nova partida (`fisher.md` 4.7): informa a calculadora embutida, sugere planilha (ou lápis e papel) como alternativa, para os cenários de cálculo e permite jogar só com questões conceituais (20 dos 25 cenários), sem contas.
- Atalhos de teste no menu de nova partida (`fisher.md` 5.8.1): forçar a casa (Decisão, Evento ou Balanço) e restringir os cenários (só os de cálculo, só os sem cálculo ou um específico), para cair sempre no que se quer testar. A partida mostra o selo "Partida de teste".
- Tela da partida (`fisher.md` 5.8.2): tabuleiro em tela cheia com o botão **Jogar** no centro; ao chegar na casa, a pergunta (ou resultado, evento, balanço) aparece sobreposta ao tabuleiro.
- Jogada extra em dados iguais: a tela mostra o aviso "Dados iguais!" antes de rolar de novo.
- Partida salva em `localStorage` a cada transição.

Decisões tomadas onde a especificação deixava em aberto:

- Confiança em escala de 5 níveis (`chute`, `duvida`, `provavel`, `confiante`, `certeza`; ×0,5 a ×1,5 em degraus de 0,25), em vez do binário chute/certeza da especificação original. Ganhos e perdas são arredondados a centenas.
- Justificativa `parcial` conta como errada (`PARCIAL_CONTA_COMO_CORRETA` em `src/engine/scoring.js`).
- Reputação: 0 a 100, começa em 50; multiplica só os ganhos (×0,8 a ×1,3); em zero há multa de R$ 10.000.
- Banco de cenários num único arquivo JSON (`src/scenarios/content/cenarios.json`, array com o formato da seção 5.5), em vez de um arquivo por cenário e do `schema.json` previsto; a validação é o `validarCenario`. Os cenários continuam sendo dados, sem lógica. Eventos, conceitos e materiais seguem em módulos JS.
- Modo solo gravado como `modo: 'competitivo'` com um jogador `bot`, em vez de um terceiro modo: as regras são as mesmas do competitivo. O rival joga no nível da pessoa e decide numa única ação (`DECIDIR_BOT`), mostrada na tela de resultado.
- Perfis do rival calibrados contra um jogador simulado de acerto 0,6, à falta de dados de playtest. Depois do playtest, trocar a referência pelo acerto real medido no `historico` e recalibrar.
- Sugestões de estudo do relatório: deficiências primeiro, depois conceitos acertados sem confiança; sem nenhum dos dois, conceitos que a partida não cobrou. Materiais da Wikipédia em português por conceito e o curso de Estatística e probabilidade da Khan Academy para todos. Os equívocos recorrentes ainda não entram no relatório (faltam rótulos legíveis).
- Cenários de cálculo: "margem" foi lida como a tolerância aceita no valor calculado (e não como um intervalo que a pessoa declara junto). Valor fora da margem invalida a métrica (a matriz de pontuação não mudou), e o valor é conferido contra a métrica escolhida. A regra de margem (5% abaixo de 100, 2% a partir de 100) é um ponto de partida a calibrar no playtest. O relatório de fim de jogo ainda não separa erro de método de erro de cálculo.
- Rounds e caixa inicial escolhidos no menu (`fisher.md`, decisão nº 12). O balanceamento só foi calibrado para o padrão (10 rounds, R$ 100.000): valores das casas, balanço e multas são absolutos, e o crescimento da meta do cooperativo também, então caixas muito altos ou baixos deixam as faixas do cooperativo fáceis ou inalcançáveis. A calibrar no playtest.
- Falência (`fisher.md` 3.12, decisão nº 13): caixa negativo na jogada em que passa pelo Balanço elimina o jogador (competitivo e solo) ou encerra a partida (cooperativo). Foi pedida expressamente e diverge do princípio 4 da especificação ("ninguém é eliminado"). "Balanço negativado" foi lido como caixa < 0. Fora do Balanço o caixa pode ficar negativo sem eliminar. Se outro jogador também está negativado, com saldo pior, e ainda não passou pelo Balanço, o veredito espera por ele e perde quem tiver o menor saldo entre os que passaram negativados (`julgarBalanco`). Sem mecanismo de recuperação ainda (empréstimo, investidor-anjo), então o chute sistemático pode eliminar; a calibrar no playtest.
- Sequências de erros e acertos (`fisher.md` 3.13, decisão nº 14): o fator acumulado (×1,1 por sucesso, ×0,9 por erro) multiplica o ganho do sucesso e, invertido, a perda do erro total; a resposta parcial (sorte ou incoerência) zera a sequência em vez de contar como erro ou acerto. Como "ônus de 0,9x" aplicado a uma perda a reduziria, a perda usa o inverso do fator (ver 3.13). Fatores e limites são pontos de partida a calibrar no playtest. A sequência é por jogador, mesmo no cooperativo. A calibração do rival do solo se manteve (reconferida por simulação).
- Dados iguais (`fisher.md` 3.2, decisão nº 15): quem tira os dois dados com a mesma face resolve a casa e joga de novo, na mesma vez e sem gastar trimestre (`jogadaExtra` no estado). Sem limite de repetições; não vale para quem faliu na jogada. Vale também para o rival do solo.
- Dificuldade dos cenários atribuída à mão (6 com nível 1, 9 com nível 2 e 10 com nível 3) e ainda a calibrar no playtest, junto com o passo médio dos dois dados (7) e a seletividade do sorteio (`src/engine/config.js`). Ainda não há cenários ambíguos (fisher.md 4.5).
