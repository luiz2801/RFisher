const CHAVE = 'tabuleiro-do-ceo:partida:v1';

export function salvar(estado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* sem armazenamento: o jogo segue funcionando, só não retoma depois */
  }
}

export function carregar() {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE));
    return e && e.versao === 1 && Array.isArray(e.jogadores) && e.fase ? e : null;
  } catch {
    return null;
  }
}

export function limpar() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ver salvar() */
  }
}
