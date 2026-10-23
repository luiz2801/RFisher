# Pipeline de CI e deploy

Explica os dois workflows do GitHub Actions, o que cada job faz, as matrizes de teste e como o site chega ao GitHub Pages. Os arquivos são [.github/workflows/test.yml](../.github/workflows/test.yml) (CI) e [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) (deploy). Regras de branch e de merge estão em [CONTRIBUTING.md](../CONTRIBUTING.md).

## Visão geral

| Workflow | Arquivo | Dispara em | Job(s) | Função |
| --- | --- | --- | --- | --- |
| `Testes` | `test.yml` | Qualquer pull request; push na `main` | `Node 20`, `Node 22` | Lint e testes com cobertura, em duas versões de Node |
| `Deploy GitHub Pages` | `deploy.yml` | Push na `main`; execução manual | `testes`, `deploy` | Testa de novo e publica o site |

Os dois workflows são independentes, mas rodam sobre o mesmo código: o PR passa pelo `Testes`, e o push na `main` (depois do merge) passa pelos dois.

## Workflow `Testes` (test.yml)

### Gatilhos e controle de concorrência

- `pull_request` (sem filtro de branch) e `push` na `main`.
- `permissions: contents: read`: o job só lê o repositório.
- `concurrency` por workflow e ref com `cancel-in-progress: true`: um novo push na mesma branch cancela a execução anterior ainda em andamento.

### Matriz

```yaml
strategy:
  fail-fast: false
  matrix:
    node: [20, 22]
```

- O nome do job é `Node ${{ matrix.node }}`, então os checks aparecem como **Node 20** e **Node 22**. Esses são os nomes exigidos pela proteção da `main`. Se o nome do job mudar, a regra de merge deixa de encontrar o check e bloqueia todos os PRs.
- `fail-fast: false`: se uma versão falhar, a outra roda até o fim, para mostrar se o problema é só de uma versão.
- Requisito mínimo: Node 20 (README).

### Passos

| Passo | Comando | Observação |
| --- | --- | --- |
| Checkout | `actions/checkout@v4` | |
| Node | `actions/setup-node@v4` com `node-version: ${{ matrix.node }}` | |
| Instalar dependências | `npm ci` se houver `package-lock.json`; senão, só imprime aviso | Hoje não há lock, porque o projeto não tem dependências |
| Lint | `npm run lint` | Sintaxe com `node --check` e bloqueio de `test.only` e `debugger` |
| Testes com cobertura | `npm run test:cobertura` | Roda `node --test` com `--experimental-test-coverage` e grava `coverage/lcov.info` |
| Publicar lcov | `actions/upload-artifact@v4` | Só no Node 22; artefato `cobertura-lcov` com `if-no-files-found: error` |

Pontos de atenção:

- O CI roda `test:cobertura`, e não `npm test`. Os testes são os mesmos; a diferença é o relatório de cobertura. A regra do projeto de rodar `npm test` antes de cada commit continua valendo localmente (`CONTRIBUTING.md`).
- A cobertura **só é reportada**. Ainda não há meta mínima, então um teste a menos não reprova o build. A meta está em aberto (`docs/testes.md`).
- O artefato `cobertura-lcov` é publicado só pelo Node 22 (condição `if: matrix.node == 22` no passo).

## Workflow `Deploy GitHub Pages` (deploy.yml)

### Gatilhos e permissões

- `push` na `main` e `workflow_dispatch` (Actions → Deploy GitHub Pages → Run workflow), para republicar sem commit novo.
- `permissions`: `contents: read`, `pages: write` e `id-token: write`. As duas últimas permitem publicar no Pages com o token OIDC do próprio workflow, sem segredo guardado no repositório.
- `concurrency: group: pages` com `cancel-in-progress: false`: um deploy em andamento não é cancelado. Deploys empilham na ordem, para o site nunca ficar pela metade.

### Job `testes`

Roda antes do deploy e repete a verificação, só no Node 22:

1. `npm run lint`
2. `npm test`

Ele não roda `npm ci` nem `test:cobertura`. Hoje não é preciso, porque o projeto não tem dependências. **Se um dia houver `package-lock.json` ou dependências, este job precisa do passo `npm ci`**, como o `test.yml` já tem.

O comentário no workflow explica por que o lint está aqui: o `node --check` pega erro de sintaxe em arquivo sem teste, como `src/main.js`, que não tem teste próprio e poderia quebrar o site sem nenhum teste falhar.

### Job `deploy`

- `needs: testes`: só roda se o job de testes passar.
- `environment: github-pages`, com a URL de saída `steps.deployment.outputs.page_url`.
- Passos:
  1. **Checkout**.
  2. **Montar site**: cria `_site/` e copia `index.html`, `style.css` e a pasta `src/`. Cria `_site/.nojekyll`, para o Pages não tentar processar o site com Jekyll.
  3. **`actions/configure-pages@v5`**: prepara o Pages.
  4. **`actions/upload-pages-artifact@v3`** com `path: _site`: envia o site como artefato.
  5. **`actions/deploy-pages@v4`** (com `id: deployment`): publica.

O site é estático e sem build (ver [ADR 0002](adr/0002-es-modules-sem-bundler.md)), então o que o navegador precisa é exatamente o que é copiado. **O que fica fora de `_site/` não vai ao ar**: `tests/`, `scripts/`, `docs/`, `fisher.md` e `coverage/`.

Como o deploy copia a pasta `src/` inteira, qualquer arquivo novo dentro de `src/` é publicado. Não coloque lá nada que não deva ser público.

### Configuração única no GitHub

Em Settings → Pages → Source, escolha **GitHub Actions**. Sem isso, o job `deploy` falha ou o site não é atualizado. O endereço publicado está no README.

## Proteção da `main`

As regras de proteção são configuradas no GitHub (Settings → Branches), não em arquivo do repositório:

- sem push direto, nem para o administrador;
- sem force push e sem exclusão da branch;
- merge só com os checks `Node 20` e `Node 22` verdes e com a branch atualizada em relação à `main`;
- sem exigência de aprovação de revisor.

O workflow `Deploy GitHub Pages` não é check obrigatório de merge: ele só roda depois que o código já está na `main`. Por isso o job `testes` dele repete a verificação.

## Reproduzir o CI localmente

```
npm run lint
npm test
npm run test:cobertura   # opcional: gera coverage/lcov.info
```

Para testar o site como ele é publicado, `npm start` serve a raiz do repositório. Ele expõe também `tests/` e `docs/`, que não vão ao ar, então use-o só para jogar, não para conferir o que o Pages publica.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| PR não pode ser mergeado, check "Node 20" ausente | Nome do job mudou, ou o workflow não disparou | Confira o nome em `test.yml` e a proteção da `main` |
| PR bloqueado com "branch desatualizada" | A `main` andou | Atualize a branch da `main` e espere os checks de novo |
| `Deploy` falha em `testes` após o merge | Teste ou lint quebrou na `main` | Corrija por PR; o deploy não publica código que não passou |
| `Deploy` falha em `deploy` | Pages não configurado como GitHub Actions | Ajuste em Settings → Pages → Source |
| Site não mostra a última mudança | Deploy ainda rodando, ou cache do navegador | Espere o job terminar e recarregue sem cache |
| `Testes` falha só em uma das versões | Diferença de comportamento entre Node 20 e 22 | Reproduza com a versão que falhou e corrija o código, sem desativar a versão |
