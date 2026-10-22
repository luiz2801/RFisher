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

O workflow `.github/workflows/deploy.yml` publica o jogo no GitHub Pages a cada push na `main` (depois de `npm test` passar) ou manualmente (Actions → Deploy GitHub Pages → Run workflow). O site é estático e sem build: só `index.html`, `style.css` e `src/` vão para o ar. Configuração única: em Settings → Pages → Source, escolha **GitHub Actions**. Endereço: https://luiz2801.github.io/RFisher/

## Estado atual

- Modos competitivo, cooperativo e solo. O solo é o competitivo contra um rival controlado pelo computador, em três perfis (Estagiário(a), Analista, Sênior). O rival acerta com a frequência do perfil, menos nos cenários difíceis, aposta por uma certeza interna ruidosa e foi calibrado por simulação para que um jogador de acerto 0,6 vença 70%, 50% e 30% das partidas (`fisher.md` 3.11, `scripts/simular-bot.mjs`).
- Trilha ampliada de 28 casas em grade 8x8 (1 casa de Balanço, 18 de Decisão e 9 de Evento), 1 a 3 jogadores em hot-seat, dois dados (soma, 2 a 12) com animação de rolagem e o peão saltando casa a casa até a posição final, aposta de confiança em 5 níveis (×0,5 a ×1,5), métrica e justificativa.
- Casas: Decisão, Evento e Balanço. Duelo, Mercado e Auditoria ficam para a Fase 2.
- 18 cenários de tomada de decisão estatística com dados gerados por seed e invariantes matemáticos testados em 1.000 seeds cada (os cenários 14 a 18 são de cálculo, ver abaixo). Cada um tem dificuldade 1 a 3 (entre parênteses) e o sorteio favorece os mais difíceis conforme o jogador avança na trilha (ver abaixo):
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
- Cenários de cálculo (`tipo: 'calculo'`, `fisher.md` 4.7): os dados vêm em tabela (e, em alguns, também em gráfico) e a decisão tem quatro etapas: **métrica → valor calculado → justificativa → confiança**. O valor é aceito dentro de uma **margem** relativa ao valor exato da métrica escolhida (1% a 3%, mostrada na tela); percentis e quartis pelo método linear (como `PERCENTIL.INC` das planilhas) e desvio padrão amostral. A métrica só conta como certa com a opção certa **e** o valor dentro da margem. O resultado mostra o valor informado, o correto, a faixa aceita e o passo a passo. Um botão copia a tabela em texto com tabulações (vírgula decimal, sem unidade) para colar no Excel. O rival do solo informa o valor exato da métrica que escolhe.
- Dificuldade crescente: o progresso do jogador (casas percorridas, contando voltas, em relação ao percurso esperado da partida) define uma dificuldade-alvo de 1 a 3, e os cenários do baralho são sorteados com peso maior perto dessa dificuldade. Nenhum cenário é excluído e o baralho não repete dentro de um ciclo. Não há indicação da dificuldade na tela.
- 18 cartas de eventos (9 positivas e 9 negativas) com lições estatísticas práticas (eixo truncado, correlação vs causalidade, viés de sobrevivência, regressão à média, paradoxo de Simpson, falácia do apostador, viés de autosseleção, comparações múltiplas, valor esperado, etc.). Todo setor tem ao menos um cenário e um evento.
- Perfil de desempenho por jogador (`perfilDesempenho` em `src/engine/desempenho.js`, `fisher.md` 4.6): cada cenário declara o conceito que avalia (10 conceitos em `src/scenarios/content/conceitos.js`), e o histórico de decisões é agregado por conceito em pontos fortes e deficiências, cruzando acerto e certeza declarada (domina, inseguro, equívoco convicto, lacuna), com equívocos recorrentes e calibração da confiança.
- Relatório de desempenho no fim de jogo, um por pessoa (o rival do computador fica de fora): acertos totais, parciais e erros, assuntos que mais e menos domina e sugestões de estudo com links gratuitos em português para cada um dos 10 conceitos (`src/scenarios/content/materiais.js`, `fisher.md` 4.6). Pode ser impresso ou salvo em PDF, já que o save é apagado no fim da partida.
- Atalhos de teste no menu de nova partida (`fisher.md` 5.8.1): forçar a casa (Decisão, Evento ou Balanço) e restringir os cenários (só os de cálculo, só os sem cálculo ou um específico), para cair sempre no que se quer testar. A partida mostra o selo "Partida de teste".
- Partida salva em `localStorage` a cada transição.

Decisões tomadas onde a especificação deixava em aberto:

- Confiança em escala de 5 níveis (`chute`, `duvida`, `provavel`, `confiante`, `certeza`; ×0,5 a ×1,5 em degraus de 0,25), em vez do binário chute/certeza da especificação original. Ganhos e perdas são arredondados a centenas.
- Justificativa `parcial` conta como errada (`PARCIAL_CONTA_COMO_CORRETA` em `src/engine/scoring.js`).
- Reputação: 0 a 100, começa em 50; multiplica só os ganhos (×0,8 a ×1,3); em zero há multa de R$ 10.000.
- Banco de cenários num único arquivo JSON (`src/scenarios/content/cenarios.json`, array com o formato da seção 5.5), em vez de um arquivo por cenário e do `schema.json` previsto; a validação é o `validarCenario`. Os cenários continuam sendo dados, sem lógica. Eventos, conceitos e materiais seguem em módulos JS.
- Modo solo gravado como `modo: 'competitivo'` com um jogador `bot`, em vez de um terceiro modo: as regras são as mesmas do competitivo. O rival joga no nível da pessoa e decide numa única ação (`DECIDIR_BOT`), mostrada na tela de resultado.
- Perfis do rival calibrados contra um jogador simulado de acerto 0,6, à falta de dados de playtest. Depois do playtest, trocar a referência pelo acerto real medido no `historico` e recalibrar.
- Sugestões de estudo do relatório: deficiências primeiro, depois conceitos acertados sem confiança; sem nenhum dos dois, conceitos que a partida não cobrou. Materiais da Wikipédia em português por conceito e o curso de Estatística e probabilidade da Khan Academy para todos. Os equívocos recorrentes ainda não entram no relatório (faltam rótulos legíveis).
- Cenários de cálculo: "margem" foi lida como a tolerância aceita no valor calculado (e não como um intervalo que a pessoa declara junto). Valor fora da margem invalida a métrica (a matriz de pontuação não mudou), e o valor é conferido contra a métrica escolhida. Margens (1% a 3%) a calibrar no playtest. O relatório de fim de jogo ainda não separa erro de método de erro de cálculo.
- Sem mecanismo de recuperação ainda: ninguém é eliminado, mas o dinheiro pode ficar negativo.
- Dificuldade dos cenários atribuída à mão (5 com nível 1, 7 com nível 2 e 6 com nível 3) e ainda a calibrar no playtest, junto com o passo médio dos dois dados (7) e a seletividade do sorteio (`src/engine/config.js`). Ainda não há cenários ambíguos (fisher.md 4.5).
