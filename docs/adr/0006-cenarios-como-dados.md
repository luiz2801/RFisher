# 0006. Cenários como dados, sem lógica

- Status: Aceita

## Contexto

O jogo tem 25 cenários de decisão estatística, 41 cartas de evento e as empresas do Mercado. O conteúdo cresce e é ajustado com frequência, e quem escreve enunciados não deveria precisar entender o motor. Também é preciso validar o conteúdo sem executar código de cenário.

## Decisão

Os cenários ficam em `src/scenarios/content/cenarios.json`, um array no formato da seção 5.5 de `fisher.md`. Cada cenário declara o gerador de dados, as opções, as justificativas e o conceito avaliado, mas não tem código. A validação é feita por `validarCenario` (`src/scenarios/loader.js`). Eventos, conceitos e materiais de estudo seguem em módulos JS (`eventos.js`, `conceitos.js`, `materiais.js`), porque têm lógica mínima de agrupamento. O README registra que o `schema.json` previsto na especificação não foi criado.

## Consequências

- **Fácil:** adicionar um cenário é editar dados. O passo a passo está em `docs/criar-cenarios.md`.
- **Fácil:** os testes de conteúdo (`tests/scenarios.test.js`, `tests/generators.test.js`) varrem todos os cenários e checam as invariantes de cada gerador.
- **Difícil:** o JSON único cresce e gera conflitos de merge quando duas pessoas editam cenários ao mesmo tempo.
- **Difícil:** erro de digitação no JSON só aparece no teste ou na validação, não no editor. Por isso `validarCenario` existe.
- **Vigiar:** lógica escondida em cenário (por exemplo, um campo que muda o cálculo do motor). Se um cenário precisar de comportamento novo, o comportamento vai para o motor e o cenário só declara que o usa.
