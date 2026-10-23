# 0003. Máquina de estados como reducer puro, sem biblioteca

- Status: Aceita

## Contexto

Cada turno do jogo passa por fases bem definidas: rolar o dado, escolher a métrica, informar o valor, escolher a justificativa e a confiança, ver o resultado, passar pelo Mercado, pelo Evento ou pelo Balanço. Ações fora de ordem (um clique duplo, uma tela antiga) não podem corromper a partida. A partida também precisa ser salva a cada transição (`docs/formato-de-save.md`).

## Decisão

A máquina de estados é uma função pura `reduzir(estado, acao)` em `src/engine/machine.js`. A tabela `TRANSICOES` mapeia `fase → tipo de ação → transição`. Cada transição recebe uma cópia do estado (`structuredClone`) e devolve o estado novo. Ação que não pertence à fase atual é ignorada e devolve o próprio estado. Não há biblioteca de máquina de estados (XState e similares).

## Consequências

- **Fácil:** as transições são testáveis uma a uma, sem interface (`tests/machine.test.js`, `tests/integracao-partida.test.js`).
- **Fácil:** o estado é só dado, então o save é `JSON.stringify` do próprio estado. Não existe um formato paralelo para manter.
- **Fácil:** ação inválida não corrompe nada; o único custo é a ação sumir sem aviso. A tela já só oferece as ações válidas.
- **Difícil:** `structuredClone` a cada ação custa mais que mutar, mas a partida é pequena e a troca compensa.
- **Difícil:** não há diagrama gerado a partir da tabela. O diagrama de estados está escrito à mão em `docs/diagramas-uml.md` e precisa ser atualizado junto com `TRANSICOES`.
- **Vigiar:** uma transição que chame `Math.random` ou o relógio quebra a reprodutibilidade. A aleatoriedade vem só do RNG da partida (ver [ADR 0007](0007-partida-reproduzivel-por-seed.md)).
