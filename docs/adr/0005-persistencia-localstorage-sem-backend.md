# 0005. Persistência só em `localStorage`, sem backend

- Status: Aceita

## Contexto

O jogo é hot-seat: uma pessoa ou um grupo jogam no mesmo dispositivo (README). Não há contas, ranking global nem sincronização entre aparelhos. A partida precisa sobreviver a recarregar a página, mas não precisa ser guardada para sempre.

## Decisão

A partida salva fica em `localStorage`, sob a chave `tabuleiro-do-ceo:partida:v1`, com uma única partida por navegador. Todo acesso passa por `src/storage/persist.js`, que captura as exceções (armazenamento cheio ou bloqueado) e deixa o jogo seguir sem salvar. Não existe servidor, banco de dados nem conta de usuário.

## Consequências

- **Fácil:** o site continua estático, sem custo de servidor e sem dados pessoais sob responsabilidade do projeto.
- **Fácil:** a falha de armazenamento nunca derruba a partida.
- **Difícil:** a partida fica presa ao navegador. Trocar de aparelho ou limpar os dados do site perde a partida.
- **Difícil:** o formato do save não tem migração automática; a política de versão está em `docs/formato-de-save.md`.
- **Vigiar:** o save guarda a partida inteira, incluindo o estado do RNG. Qualquer campo novo precisa de valor padrão para saves antigos, como os campos já tratados em `src/engine/state.js`.
- **Vigiar:** o relatório de fim de jogo pode ser impresso ou salvo em PDF, já que o save é apagado ao fim da partida (README). Se o save passar a sobreviver ao fim, o relatório perde esse papel de guarda.
