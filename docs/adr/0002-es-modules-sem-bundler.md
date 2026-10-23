# 0002. ES Modules nativos, sem bundler

- Status: Aceita

## Contexto

O código roda direto no navegador, e o deploy publica o site sem etapa de build. Os testes e os scripts rodam no Node. O README registra que o jogo precisa de um servidor local porque usa ES modules.

## Decisão

O projeto usa ES modules nativos: `"type": "module"` no `package.json`, imports relativos com a extensão `.js` e nenhum bundler (Webpack, Vite, Rollup ou similar). O navegador carrega `src/main.js` com `<script type="module">`, e o Node executa os testes e os scripts do mesmo jeito.

## Consequências

- **Fácil:** o código publicado é o código-fonte. O deploy copia `index.html`, `style.css` e `src/` como estão (`.github/workflows/deploy.yml`).
- **Fácil:** depurar no navegador mostra os arquivos originais, com os mesmos nomes.
- **Difícil:** é preciso servir os arquivos por HTTP (`npm start`). Abrir `index.html` direto pelo sistema de arquivos não funciona.
- **Difícil:** não há minificação nem tree-shaking. O tamanho do código cresce sem controle automático.
- **Vigiar:** imports sem extensão ou caminhos que dependem de `index`. O navegador não resolve isso, e o Node também exige a extensão.
