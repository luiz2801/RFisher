// Diretorias do modo cooperativo. Cada cenário e evento pertence a um setor, e cada setor a uma diretoria.
export const DIRETORIAS = {
  operacoes: { nome: 'Operações', cargo: 'Diretor(a) de Operações', icone: '📦', setores: ['logistica', 'producao'] },
  tecnologia: { nome: 'Tecnologia', cargo: 'Diretor(a) de Tecnologia', icone: '💻', setores: ['dados', 'produto'] },
  pessoas_financas: {
    nome: 'Pessoas e Finanças',
    cargo: 'Diretor(a) de Pessoas e Finanças',
    icone: '🧑‍💼',
    setores: ['rh', 'atendimento', 'financeiro'],
  },
};

export const SETORES = Object.values(DIRETORIAS).flatMap((d) => d.setores);

export const diretoriaDoSetor = (setor) => Object.keys(DIRETORIAS).find((k) => DIRETORIAS[k].setores.includes(setor));

// Todo setor tem responsável: 1 jogador acumula tudo, 2 dividem, 3 têm uma diretoria cada.
export function atribuirPapeis(n) {
  const ids = Object.keys(DIRETORIAS);
  if (n <= 1) return [ids];
  if (n === 2) return [[ids[0]], [ids[1], ids[2]]];
  return ids.map((id) => [id]);
}
