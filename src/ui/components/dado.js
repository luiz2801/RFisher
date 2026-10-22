// Dado visual com pips (bolinhas), desenhado em CSS puro via grid 3x3 (ver style.css `.dado`).
const PIPS = Array.from({ length: 9 }, () => '<span class="pip"></span>').join('');

export function dadoHtml(face) {
  return `<span class="dado" data-face="${face}" aria-hidden="true">${PIPS}</span>`;
}

// Par de dados com a soma visível ao lado, para o placar fixo do tabuleiro.
export function parDadosHtml(d1, d2, total) {
  return `<div class="dados-par" aria-label="Dados: ${d1} e ${d2}, total ${total}">
    ${dadoHtml(d1)}${dadoHtml(d2)}<span class="dado-total">= ${total}</span>
  </div>`;
}
