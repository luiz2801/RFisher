// Lint sem dependências (ver docs/testes.md): verifica a sintaxe com `node --check`
// e barra o que não pode chegar ao CI (teste isolado com .only e `debugger`).
// Uso: node scripts/lint.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PASTAS = ['src', 'tests', 'scripts'];
const EXTENSOES = /\.(m?js)$/;

const PROIBIDOS = [
  { regra: 'teste isolado (.only)', padrao: /\b(test|describe|it|suite)\.only\s*\(/ },
  { regra: 'debugger', padrao: /^\s*debugger\s*;?\s*$/ },
];

function arquivos(pasta) {
  const saida = [];
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) saida.push(...arquivos(caminho));
    else if (EXTENSOES.test(item.name)) saida.push(caminho);
  }
  return saida;
}

const lista = PASTAS.flatMap((p) => arquivos(join(RAIZ, p))).sort();
const erros = [];

for (const arquivo of lista) {
  const rel = relative(RAIZ, arquivo);
  const r = spawnSync(process.execPath, ['--check', arquivo], { encoding: 'utf8' });
  if (r.status !== 0) erros.push(`${rel}: erro de sintaxe\n${r.stderr.trim()}`);

  readFileSync(arquivo, 'utf8')
    .split('\n')
    .forEach((linha, i) => {
      for (const { regra, padrao } of PROIBIDOS) {
        if (padrao.test(linha)) erros.push(`${rel}:${i + 1}: ${regra}: ${linha.trim()}`);
      }
    });
}

if (erros.length) {
  console.error(erros.join('\n'));
  console.error(`\nlint: ${erros.length} problema(s) em ${lista.length} arquivos.`);
  process.exit(1);
}
console.log(`lint: ${lista.length} arquivos sem problemas.`);
