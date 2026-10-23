# Guia de contribuição

Como contribuir com o Fisher SA: fluxo de branch e pull request, política de commits, testes obrigatórios e convenções de código. As regras para agentes de IA estão em [CLAUDE.md](CLAUDE.md) e valem também para pessoas; este guia as reúne num lugar só.

Antes de mexer na lógica, leia a documentação da área (tabela na seção [Documentação](#documentação)). Se o código e a documentação divergirem, registre a divergência em vez de escolher um lado em silêncio.

## Ambiente

- Node.js 20 ou mais recente (o CI roda em 20 e 22).
- Sem dependências externas e sem build. Não há `npm install` a fazer.
- Para jogar localmente, use um servidor estático (o jogo usa ES modules, então abrir `index.html` direto não funciona):

```
npm start                # http://localhost:8000
```

Os comandos de verificação estão na seção [Testes e lint](#testes-e-lint).

## Fluxo de branch e pull request

A `main` é protegida: não aceita push direto, nem do administrador, nem force push ou exclusão. Toda mudança entra por pull request.

1. Crie uma branch a partir da `main` atualizada. Use um nome curto com prefixo, como `feat/mercado-relatorio-consultoria` ou `fix/sequencia-ao-trocar-cenario`.
2. Faça os commits seguindo a [política de commits](#política-de-commits). Rode `npm test` antes de cada um.
3. Abra o pull request contra a `main`. A descrição deve dizer o que mudou e por quê, e listar os documentos atualizados (ou por que nenhum precisou).
4. O merge exige:
   - os checks **Node 20** e **Node 22** verdes (workflow `Testes`, ver [docs/ci-cd.md](docs/ci-cd.md));
   - a branch atualizada em relação à `main`, sem conflitos e testada sobre a versão mais recente.
5. Não é exigida aprovação de revisor. Se a `main` andar enquanto o PR está aberto, atualize a branch (merge ou rebase) e espere os checks rodarem de novo.

Um PR com vários commits precisa ter **todos** os commits passando nos testes. Não deixe commits intermediários quebrados: a história da `main` deve ser sempre funcional.

## Política de commits

**Antes de todo commit, rode `npm test` e confirme que passa.** Não faça commit com testes falhando ou sem tê-los rodado. Se não for possível rodar (por exemplo, Node indisponível), não faça o commit.

Um commit é **atômico** quando representa uma única mudança lógica, completa e auto-contida:

- **Um propósito por commit**: uma feature, um bug fix, uma refatoração ou uma mudança de documentação. Não vários.
- **Sem commits "catch-all"**: um commit que toca em muitos arquivos sem motivo claro provavelmente deveria ser vários.
- **Código funcional**: depois de cada commit, `npm test` passa e a feature ou o fix já funciona, sem precisar de commits posteriores para ficar completo.

A mensagem descreve **o quê** mudou e **por quê**, não **como**, e começa pelo tipo, em português:

| Bom | Ruim |
| --- | --- |
| `Feat: balanceamento de pontos na fase 3` | `Update code` |
| `Fix: sequência não resetava ao mudar de cenário` | `Fix bug and refactor and update docs` |
| `Docs: especificação do modo cooperativo` | |

Documentação relacionada à mudança (por exemplo, atualizar `fisher.md` depois de implementar uma mecânica) pode ir no mesmo commit, desde que a mensagem deixe claro que as duas partes são necessárias para completar a mudança.

## Documentação

Quando a mudança altera a lógica, a documentação afetada é atualizada **na mesma mudança**, antes de a tarefa ser dada como concluída.

Alteração lógica é qualquer mudança em regras, máquina de estados, cenários, métricas, formato da partida salva ou fluxo de telas. Não exigem atualização: refatorações sem mudança de comportamento, ajustes só de CSS, typos e mudanças só em testes.

| O que mudou | Documento |
| --- | --- |
| Regras, mecânicas, balanceamento, especificação | [fisher.md](fisher.md) |
| Arquitetura, módulos, estados, diagramas UML | [docs/diagramas-uml.md](docs/diagramas-uml.md) e [docs/api.md](docs/api.md) |
| Decisões de arquitetura | [docs/adr/](docs/adr/) (novo ADR, ver abaixo) |
| Modo cooperativo | [docs/modo-cooperativo.md](docs/modo-cooperativo.md) |
| Formato da partida salva | [docs/formato-de-save.md](docs/formato-de-save.md) |
| Cenários, eventos e geradores | [docs/criar-cenarios.md](docs/criar-cenarios.md) |
| Tipos de teste e lacunas | [docs/testes.md](docs/testes.md) |
| Pipeline de CI e deploy | [docs/ci-cd.md](docs/ci-cd.md) |
| Estado atual, cenários, decisões em aberto, como rodar | [README.md](README.md) |

Antes de concluir uma mudança, confirme:

1. Li a documentação relevante antes de começar?
2. Os documentos acima refletem o novo comportamento?
3. Os diagramas ainda correspondem ao código?
4. Contagens e listas do README (casas, cenários, eventos) estão corretas?
5. Decisões que completam ou divergem da especificação foram registradas?
6. `npm test` passa?

### Quando escrever um ADR

Um ADR registra uma decisão técnica que tem consequências duradouras, como escolher uma tecnologia, um formato ou uma forma de organizar o código. Decisões de regra de jogo ficam em `fisher.md`, não em ADR.

Crie `docs/adr/NNNN-titulo-curto.md` com o próximo número livre, use o modelo de [docs/adr/README.md](docs/adr/README.md) e liste o ADR no índice. Um ADR aceito não é reescrito: se a decisão mudar, o novo ADR marca o antigo como substituído.

## Testes e lint

| Comando | O que faz | Quando |
| --- | --- | --- |
| `npm test` | `node --test tests/*.test.js` | Antes de cada commit; o deploy também roda |
| `npm run lint` | Sintaxe (`node --check`) e bloqueio de `test.only` e `debugger` | Antes de cada commit; o CI roda |
| `npm run test:cobertura` | Testes com relatório de cobertura em `coverage/lcov.info` | Quando quiser ver a cobertura; o CI roda |
| `node scripts/simular-bot.mjs [--calibrar]` | Simula o rival do modo solo e mostra a taxa de vitória por perfil | Ao mexer em balanceamento do bot |

Os testes usam o runner nativo `node:test`. Tipos de teste esperados e lacunas atuais estão em [docs/testes.md](docs/testes.md).

Um teste novo vai em `tests/`, com o nome do módulo (`tests/<modulo>.test.js`). Cenários com seed devem testar as invariantes em várias seeds, como os de `tests/generators.test.js`.

## Convenções de código

- **ES modules puros**: `"type": "module"` no `package.json`, imports com extensão `.js`, sem bundler e sem transpilação. Ver [ADR 0002](docs/adr/0002-es-modules-sem-bundler.md).
- **JavaScript puro, sem framework**: a interface é montada com funções que devolvem HTML escapado (`src/ui/html.js`). Ver [ADR 0001](docs/adr/0001-javascript-puro-sem-framework.md).
- **Nomes e comentários em português**: funções e variáveis seguem o domínio (`reduzir`, `novoJogo`, `progressoDoJogador`). Comentários explicam o porquê de regras não óbvias e citam a seção do `fisher.md` quando couber.
- **Motor sem efeitos colaterais**: `src/engine/` e `src/stats/` são funções puras, sem acesso a DOM, `localStorage` ou tempo. Aleatoriedade vem só do RNG da partida (`criarRng(e.rng)`), para que a partida seja reproduzível por seed.
- **Estado serializável**: o estado da partida é só dado (sem funções, `Map`, `Date` ou referências circulares), porque é a partida salva. A máquina de estados trabalha sobre uma cópia (`structuredClone`) e nunca altera o estado recebido.
- **Cenários são dados**: os enunciados, opções e justificativas ficam em `src/scenarios/content/`, sem lógica. Ver [docs/criar-cenarios.md](docs/criar-cenarios.md).
- **Sem dependências novas sem decisão registrada**: o projeto roda sem `node_modules`. Adicionar uma dependência exige um ADR, porque muda o ambiente de todos.
- **Lint limpo**: não deixe `test.only`, `describe.only`, `it.only` ou `debugger` no código.
- **Interface acessível e responsiva**: respeite `prefers-reduced-motion` e o modo escuro já previstos em `style.css`, e cheque a tela em largura de celular.

## Para agentes de IA

Quem usa agentes de IA para contribuir deve seguir [CLAUDE.md](CLAUDE.md), que tem as mesmas regras deste guia com a instrução de resumir, ao final, quais documentos foram atualizados.
