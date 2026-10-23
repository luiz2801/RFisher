# Fisher SA — políticas para agentes

Estas regras valem para todo agente (Claude Code, subagentes) que alterar este repositório.

## 1. Documentação antes e depois da lógica

**Antes** de alterar a lógica, leia a documentação relevante (tabela abaixo) para entender as regras e decisões vigentes. Não altere a lógica com base apenas no código. Se o código e a documentação divergirem, aponte a divergência ao usuário em vez de escolher um lado em silêncio.

**Depois** de alterar a lógica, atualize sempre a documentação afetada, na mesma mudança e antes de dar a tarefa por concluída.

Alteração lógica é qualquer mudança em:

- regras, pontuação, reputação, papéis ou configuração (`src/engine/`);
- máquina de estados, fases ou transições (`src/engine/machine.js`);
- cenários, geradores, eventos ou invariantes matemáticos (`src/scenarios/`);
- métricas e estatísticas (`src/stats/`);
- formato da partida salva (`src/storage/`);
- fluxo de telas e interações do jogador (`src/ui/`).

Não exigem atualização: refatorações sem mudança de comportamento, ajustes só de CSS, typos e mudanças só em testes.

Onde atualizar:

| O que mudou | Documento |
| --- | --- |
| Regras, mecânicas, balanceamento, especificação | `fisher.md` |
| Arquitetura, módulos, estados, diagramas UML | `docs/diagramas-uml.md` |
| Modo cooperativo | `docs/modo-cooperativo.md` |
| Estado atual, cenários, decisões em aberto, como rodar | `README.md` |

Antes de concluir, verifique:

1. Li a documentação relevante antes de começar?
2. Os documentos acima refletem o novo comportamento?
3. Os diagramas ainda correspondem ao código?
4. Contagens e listas do README (casas, cenários, eventos) estão corretas?
5. Decisões que completam ou divergem da especificação foram registradas?
6. `npm test` passa?

No resumo final ao usuário, diga quais documentos foram atualizados (ou por que nenhum precisou).

## 2. Commits exigem `npm test`

Antes de fazer qualquer commit, rode `npm test` e confirme que passa. Não faça commit com testes falhando ou sem tê-los rodado. Se não for possível rodar (por exemplo, Node indisponível no ambiente), não faça o commit: avise o usuário e peça que ele rode ou autorize explicitamente o commit sem os testes.
