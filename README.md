# Fisher SA

Jogo de tabuleiro digital e educativo de estatística. Especificação completa em [fisher.md](fisher.md). Documentação arquitetural e diagramas UML em [docs/diagramas-uml.md](docs/diagramas-uml.md).

## Rodar

O jogo usa ES modules, então precisa de um servidor local (abrir o `index.html` direto não funciona):

```
npm start        # http://localhost:8000
npm test         # testes (node:test, sem dependências)
```

## Estado atual

- Trilha ampliada de 28 casas em grade 8x8 (1 casa de Balanço, 18 de Decisão e 9 de Evento), 1 a 3 jogadores em hot-seat, dado, aposta de confiança, métrica e justificativa.
- Casas: Decisão, Evento e Balanço. Duelo, Mercado e Auditoria ficam para a Fase 2.
- 8 cenários de tomada de decisão estatística com dados gerados por seed e invariantes matemáticos testados em 1.000 seeds cada:
  1. *Salários na startup*: Assimetria à direita e outliers (Média vs. Mediana).
  2. *SLA de e-commerce*: Cauda longa de atrasos severos (Percentil 90 / P90).
  3. *Estoque de calçados*: Variáveis discretas e reposição por demanda (Moda).
  4. *Precisão de peças industriais*: Mesma média e espalhamentos distintos (Desvio padrão).
  5. *Avaliações do aplicativo*: Distribuição bimodal/polarizada (Frequência por nota).
  6. *Tempo de suporte no SAC*: Sensibilidade a outliers na dispersão (Amplitude Interquartil / IQR).
  7. *Linha de envase de café*: Distribuição normal e simétrica sem outliers (Média aritmética como estimador ótimo).
  8. *Teste A/B de conversão*: Variabilidade amostral e consistência (Desvio padrão e tamanho da amostra).
- 10 cartas de eventos com lições estatísticas práticas (eixo truncado, correlação vs causalidade, viés de sobrevivência, regressão à média, paradoxo de Simpson, etc.).
- Partida salva em `localStorage` a cada transição.

Decisões tomadas onde a especificação deixava em aberto:

- Justificativa `parcial` conta como errada (`PARCIAL_CONTA_COMO_CORRETA` em `src/engine/scoring.js`).
- Reputação: 0 a 100, começa em 50; multiplica só os ganhos (×0,8 a ×1,3); em zero há multa de R$ 10.000.
- Cenários em módulos JS (`src/scenarios/content/`) com o formato da seção 5.5, em vez de arquivos JSON.
- Sem mecanismo de recuperação ainda: ninguém é eliminado, mas o dinheiro pode ficar negativo.
