# Architecture Decision Records

Registro das decisões técnicas do Fisher SA, no formato de [ADR (Architecture Decision Record)](https://adr.github.io/) em markdown. Cada ADR responde: qual era o problema, o que foi decidido e quais são as consequências, inclusive as ruins.

Decisões de **regra de jogo** (pontuação, balanceamento, mecânicas) não ficam aqui: estão em [fisher.md](../../fisher.md) e nas decisões numeradas da seção de decisões do README.

## Índice

| Nº | Título | Status |
| --- | --- | --- |
| [0001](0001-javascript-puro-sem-framework.md) | JavaScript puro, sem framework de interface | Aceita |
| [0002](0002-es-modules-sem-bundler.md) | ES Modules nativos, sem bundler | Aceita |
| [0003](0003-maquina-de-estados-reducer-puro.md) | Máquina de estados como reducer puro, sem biblioteca | Aceita |
| [0004](0004-testes-com-node-test.md) | Testes com `node:test`, sem dependências | Aceita |
| [0005](0005-persistencia-localstorage-sem-backend.md) | Persistência só em `localStorage`, sem backend | Aceita |
| [0006](0006-cenarios-como-dados.md) | Cenários como dados, sem lógica | Aceita |
| [0007](0007-partida-reproduzivel-por-seed.md) | Partida reproduzível por seed | Aceita |
| [0008](0008-multiplayer-lan-webrtc-sem-servidor.md) | Multiplayer em rede local via WebRTC sem servidor | Aceita |

## Modelo

```markdown
# NNNN. Título no imperativo ou como afirmação

- Status: Proposta | Aceita | Substituída por NNNN
- Data: AAAA-MM-DD

## Contexto
Qual problema ou restrição levou à decisão.

## Decisão
O que foi decidido, em uma ou duas frases no presente.

## Consequências
O que fica mais fácil, o que fica mais difícil e o que precisa ser vigiado.
```

## Como propor um ADR

1. Crie o arquivo com o próximo número livre (`NNNN-titulo-curto.md`) e status **Proposta**.
2. Abra um pull request com o ADR e, se for o caso, o código que o aplica.
3. Ao mergear, mude o status para **Aceita** e inclua a linha no índice.
4. Para trocar uma decisão, crie um ADR novo que substitua o antigo e marque o antigo como **Substituída por NNNN**. Não reescreva um ADR aceito.

## Nota sobre os ADRs iniciais

Os ADRs de 0001 a 0007 registram decisões que já estavam no projeto. Os motivos foram reconstruídos a partir do README, das docs e do código, não de uma ata da época. Se algum motivo não corresponder ao que foi pensado, corrija o ADR no próprio pull request que o corrige.
