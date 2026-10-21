# Fisher SA

Jogo de tabuleiro digital e educativo de estatística. Especificação completa em [fisher.md](fisher.md). Documentação arquitetural e diagramas UML em [docs/diagramas-uml.md](docs/diagramas-uml.md).

## Rodar

O jogo usa ES modules, então precisa de um servidor local (abrir o `index.html` direto não funciona):

```
npm start        # http://localhost:8000
npm test         # testes (node:test, sem dependências)
```

## Estado atual (Fase 1, MVP jogável)

- Trilha de 20 casas, 1 a 3 jogadores em hot-seat, dado, aposta de confiança, métrica e justificativa.
- Casas: Decisão, Evento e Balanço. Duelo, Mercado e Auditoria ficam para a Fase 2.
- 4 cenários do nível iniciante, com dados gerados por seed e invariantes testados em 1.000 seeds.
- Partida salva em `localStorage` a cada transição.

Decisões tomadas onde a especificação deixava em aberto:

- Justificativa `parcial` conta como errada (`PARCIAL_CONTA_COMO_CORRETA` em `src/engine/scoring.js`).
- Reputação: 0 a 100, começa em 50; multiplica só os ganhos (×0,8 a ×1,3); em zero há multa de R$ 10.000.
- Cenários em módulos JS (`src/scenarios/content/`) com o formato da seção 5.5, em vez de arquivos JSON.
- Com só 4 cenários, eles se repetem numa partida (com dados novos a cada vez).
- Sem mecanismo de recuperação ainda: ninguém é eliminado, mas o dinheiro pode ficar negativo.
