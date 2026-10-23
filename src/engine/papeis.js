// Diretorias do modo cooperativo. Cada cenário e evento pertence a um setor, e cada setor a uma diretoria.
export const DIRETORIAS = {
  operacoes: { nome: 'Operações', cargo: 'Diretor(a) de Operações', icone: '📦', foco: 'SLA de entregas, giro de estoque e linhas fabris', setores: ['logistica', 'producao'] },
  tecnologia: { nome: 'Tecnologia', cargo: 'Diretor(a) de Tecnologia', icone: '💻', foco: 'Testes A/B, engajamento digital e algoritmos', setores: ['dados', 'produto'] },
  pessoas_financas: {
    nome: 'Pessoas e Finanças',
    cargo: 'Diretor(a) de Pessoas e Finanças',
    icone: '🧑‍💼',
    foco: 'Equidade salarial, suporte ao cliente e controle financeiro',
    setores: ['rh', 'atendimento', 'financeiro'],
  },
};

export const SETORES = Object.values(DIRETORIAS).flatMap((d) => d.setores);

export const diretoriaDoSetor = (setor) => Object.keys(DIRETORIAS).find((k) => DIRETORIAS[k].setores.includes(setor));

// Todo setor tem responsável: 1 jogador acumula tudo, 2 dividem, 3 têm uma diretoria cada.
// `escolhas` traz a diretoria preferida de cada jogador; com 2 jogadores só a do primeiro conta
// (o segundo fica com as demais) e com 3 só vale se for uma permutação. Escolha inválida cai no padrão.
export function atribuirPapeis(n, escolhas = []) {
  const ids = Object.keys(DIRETORIAS);
  if (n <= 1) return [ids];
  if (n === 2) {
    const c = ids.includes(escolhas[0]) ? escolhas[0] : ids[0];
    return [[c], ids.filter((id) => id !== c)];
  }
  const validas = escolhas.length >= 3 && new Set(escolhas.slice(0, 3)).size === 3 && escolhas.slice(0, 3).every((id) => ids.includes(id));
  return validas ? escolhas.slice(0, 3).map((id) => [id]) : ids.map((id) => [id]);
}
