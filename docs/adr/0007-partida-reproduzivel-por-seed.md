# 0007. Partida reproduzível por seed

- Status: Aceita

## Contexto

Os dados dos cenários, o sorteio das cartas, a ordem das opções e o resultado de cada dado vêm de números aleatórios. Para testar invariantes em muitos casos, reproduzir um bug ou calibrar o rival do modo solo, o mesmo ponto de partida precisa dar o mesmo resultado sempre. Retomar uma partida salva também precisa continuar exatamente de onde parou.

## Decisão

Toda aleatoriedade vem de um RNG determinístico (mulberry32, `src/engine/rng.js`) alimentado por uma seed. O estado do RNG (`rng`) faz parte da partida salva. A máquina cria o gerador com `criarRng(e.rng)`, usa e grava de volta `e.rng = rng.estado`. Nenhuma transição usa `Math.random` ou o relógio. A seed padrão do menu é o horário atual, mas ela pode ser informada para reproduzir uma partida.

## Consequências

- **Fácil:** `tests/generators.test.js` verifica que a mesma seed gera os mesmos dados, e que as invariantes valem em 1.000 seeds por cenário.
- **Fácil:** a calibração do bot (`scripts/simular-bot.mjs`) é repetível.
- **Fácil:** partida retomada do save segue igual à que teria sido sem interromper.
- **Difícil:** toda nova chamada aleatória muda a sequência das seguintes. Isso altera partidas salvas em andamento e as calibrações; a mudança deve ser anotada no README junto com a recalibração.
- **Vigiar:** qualquer `Math.random`, `Date.now()` ou `crypto` novo dentro de `src/engine/`. O lint não pega isso; a revisão e os testes de reprodutibilidade precisam pegar.
