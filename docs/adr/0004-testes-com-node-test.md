# 0004. Testes com `node:test`, sem dependências

- Status: Aceita

## Contexto

O projeto não tem dependências externas nem `node_modules` versionado. O CI precisa rodar em Node 20 e 22 sem instalar nada além do próprio Node. O README registra que `npm test` usa `node:test`, sem dependências.

## Decisão

Os testes usam o runner nativo `node:test` e as asserções de `node:assert/strict`. O script `npm test` é `node --test tests/*.test.js`. Não há Jest, Mocha, Vitest nem ferramenta de cobertura externa: a cobertura usa a opção nativa `--experimental-test-coverage` (`npm run test:cobertura`). O lint é um script próprio em `scripts/lint.mjs`, sem ESLint.

## Consequências

- **Fácil:** o CI não precisa de `npm ci` (não há `package-lock.json`); o workflow já tem o passo condicional para o caso de existir um.
- **Fácil:** qualquer pessoa com Node instalado roda a suíte, sem configuração.
- **Difícil:** `node:test` tem menos recursos que Jest (mocks e matchers ricos). Hoje os testes usam asserções simples sobre funções puras, então a falta desses recursos ainda não aparece; se aparecer, é motivo para reavaliar.
- **Difícil:** a cobertura é marcada como experimental pelo próprio Node. Por isso o CI só a reporta, sem exigir meta (`docs/ci-cd.md`).
- **Vigiar:** se um dia o projeto precisar de dependência de teste (por exemplo, para testes de navegador), o novo ADR deve dizer como o CI passa a instalá-la.
