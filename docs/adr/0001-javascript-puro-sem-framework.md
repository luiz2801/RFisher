# 0001. JavaScript puro, sem framework de interface

- Status: Aceita

## Contexto

O Fisher SA é um jogo de tabuleiro digital e educativo, jogado em hot-seat no navegador, sem backend (README). A interface tem poucas telas e uma só partida por vez, e o projeto é mantido por uma equipe pequena e acadêmica. O site é publicado no GitHub Pages como arquivos estáticos.

## Decisão

A interface é escrita em JavaScript puro. As telas são funções que devolvem strings HTML (`src/ui/views.js`), com escape centralizado em `esc` (`src/ui/html.js`). Eventos são delegados num único elemento raiz (`src/main.js`). Não há React, Vue, Svelte nem outro framework.

## Consequências

- **Fácil:** nada a instalar, nada a atualizar, e o site cabe nos arquivos que o deploy copia (`index.html`, `style.css`, `src/`).
- **Fácil:** o motor (`src/engine/`) não sabe que existe interface. Testar regra não exige navegador.
- **Difícil:** a renderização recria o HTML inteiro a cada ação. Aceitável nas telas atuais, mas uma tela muito maior pediria reavaliar.
- **Difícil:** não há reatividade nem componentes prontos. O escape é disciplina do código: todo dado vindo de fora da máquina passa por `esc`. A área de segurança está em `docs/testes.md` (tipo 10).
- **Vigiar:** se a interface crescer para várias telas com estado próprio, reabrir esta decisão em um novo ADR.
