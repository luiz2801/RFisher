// Cenários do nível iniciante. Textos com valores usam placeholders ({{media}} etc.)
// calculados a partir dos dados gerados, nunca números escritos à mão.

const impacto = { reputacao_acerto: 5, reputacao_erro: -10 };

const cenario01 = {
  id: 'cenario_01_salarios',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  titulo: 'Política salarial na startup',
  contexto:
    'Você vai divulgar, no anúncio da vaga aberta, o salário representativo da sua equipe de {{n}} pessoas. Qual número deve aparecer no anúncio?',
  dica: 'Quando há valores muito fora do padrão, pense em qual métrica não é arrastada por eles.',
  valor_base: 20000,
  dados: {
    gerador: {
      tipo: 'assimetria_direita',
      parametros: { n: 30, base: 5000, ruido: 0.15, outliers: [{ valor: 250000, qtd: 1 }] },
    },
    formato: 'brl',
    rotulo_x: 'Salário (R$)',
    rotulo_y: 'Funcionários',
    tipo_grafico: 'histograma',
    descricao_acessivel: 'A maioria dos salários está na faixa baixa e um valor muito alto aparece isolado à direita.',
  },
  opcoes: [
    { id: 'mediana', texto: 'Mediana ({{mediana}})', correta: true },
    { id: 'media', texto: 'Média aritmética ({{media}})', correta: false, equivoco: 'ignora_outliers' },
    { id: 'moda', texto: 'Moda ({{moda}})', correta: false, equivoco: 'moda_para_continuo' },
    { id: 'ponto_medio', texto: 'Ponto médio entre o menor e o maior ({{ponto_medio}})', correta: false, equivoco: 'confunde_amplitude' },
    { id: 'maximo', texto: 'Maior salário ({{maximo}})', correta: false, equivoco: 'extremo_como_tipico' },
  ],
  justificativas: [
    { id: 'j1', texto: 'Um salário muito alto isolado puxa a média para cima, e a mediana não é afetada por isso.', tipo: 'correta' },
    { id: 'j2', texto: 'Os salários estão concentrados em poucos valores, então a mediana reflete bem a maioria.', tipo: 'parcial' },
    { id: 'j3', texto: 'A mediana é o valor que mais se repete, por isso representa a equipe.', tipo: 'erro_conceitual', equivoco: 'confunde_mediana_moda' },
    { id: 'j4', texto: 'A média usa todos os dados, então é sempre mais justa e completa.', tipo: 'erro_conceitual', equivoco: 'ignora_outliers' },
    { id: 'j5', texto: 'A mediana é mais fácil de calcular.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'Outliers puxam a mediana tanto quanto a média.', tipo: 'afirmacao_falsa', equivoco: 'mediana_sensivel' },
  ],
  feedback: {
    por_equivoco: {
      ignora_outliers: 'A média foi puxada para cima pelo salário de {{maximo}}. Quase ninguém da equipe ganha perto de {{media}}.',
      moda_para_continuo: 'A moda ({{moda}}) é só o valor que por acaso mais apareceu. Em salários, que variam de pessoa para pessoa, ela diz pouco sobre o conjunto.',
      confunde_amplitude: 'O ponto médio entre o menor ({{minimo}}) e o maior ({{maximo}}) depende só dos dois extremos e ignora onde está a maioria.',
      extremo_como_tipico: 'O maior salário ({{maximo}}) é justamente o valor menos típico da equipe.',
      confunde_mediana_moda: 'O valor que mais se repete é a moda. A mediana é o valor do meio quando os dados estão ordenados.',
      mediana_sensivel: 'A mediana só olha para a posição do meio: trocar o maior salário por um ainda maior não a muda.',
    },
    explicacao_correta:
      'Com valores extremos, a mediana ({{mediana}}) representa melhor o salário típico, porque não é arrastada por eles. A média ({{media}}) foi puxada pelo salário de {{maximo}}.',
    revelacao: {
      marcadores: [
        { chave: 'mediana', rotulo: 'Mediana', correto: true },
        { chave: 'media', rotulo: 'Média' },
      ],
    },
  },
  impacto,
};

const cenario02 = {
  id: 'cenario_02_sla',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  titulo: 'Prazo de entrega do e-commerce',
  contexto:
    'Sua loja online vai prometer um prazo de entrega no site. O gráfico mostra o tempo de entrega dos últimos {{n}} pedidos. Qual métrica define um prazo que cubra a grande maioria dos clientes (9 em cada 10)?',
  dica: 'Você quer um prazo que quase todo mundo consiga cumprir, inclusive os clientes que tiveram atraso.',
  valor_base: 20000,
  dados: {
    gerador: {
      tipo: 'cauda_longa',
      parametros: { n: 40, base: 2.5, ruido: 0.6, proporcaoCauda: 0.15, caudaMin: 12, caudaMax: 30 },
    },
    formato: 'dias',
    rotulo_x: 'Tempo de entrega (dias)',
    rotulo_y: 'Pedidos',
    tipo_grafico: 'histograma',
    descricao_acessivel: 'A maioria das entregas é rápida, mas existe um grupo pequeno de entregas muito atrasadas à direita.',
  },
  opcoes: [
    { id: 'p90', texto: 'Percentil 90, o P90 ({{p90}})', correta: true },
    { id: 'media', texto: 'Média ({{media}})', correta: false, equivoco: 'media_oculta_falhas' },
    { id: 'mediana', texto: 'Mediana ({{mediana}})', correta: false, equivoco: 'mediana_cobre_90' },
    { id: 'moda', texto: 'Moda ({{moda}})', correta: false, equivoco: 'moda_para_continuo' },
    { id: 'maximo', texto: 'Maior tempo registrado ({{maximo}})', correta: false, equivoco: 'extremo_como_tipico' },
  ],
  justificativas: [
    { id: 'j1', texto: 'O P90 é o prazo dentro do qual 90% dos pedidos chegam, e expõe a cauda de atrasos que a média e a mediana escondem.', tipo: 'correta' },
    { id: 'j2', texto: 'A maioria das entregas é rápida, então um prazo baseado nelas descreve bem a experiência típica.', tipo: 'parcial' },
    { id: 'j3', texto: 'O P90 é a média dos 90% menores tempos.', tipo: 'erro_conceitual', equivoco: 'confunde_percentil_media' },
    { id: 'j4', texto: 'A média considera todas as entregas, então já representa bem a experiência de todos os clientes.', tipo: 'erro_conceitual', equivoco: 'media_oculta_falhas' },
    { id: 'j5', texto: 'O P90 é mais bonito de mostrar no relatório.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'A mediana garante que 90% dos pedidos chegam dentro do prazo.', tipo: 'afirmacao_falsa', equivoco: 'mediana_cobre_90' },
  ],
  feedback: {
    por_equivoco: {
      media_oculta_falhas: 'A média ({{media}}) mistura as entregas rápidas com as muito atrasadas e esconde que parte dos clientes espera bem mais, até {{maximo}}.',
      mediana_cobre_90: 'A mediana ({{mediana}}) cobre só 50% dos pedidos: metade dos clientes recebe depois dela.',
      moda_para_continuo: 'Em tempos de entrega, que variam muito, a moda ({{moda}}) é só o valor que por acaso mais se repetiu.',
      extremo_como_tipico: 'O maior tempo ({{maximo}}) é o pior caso isolado. Prometer isso afastaria clientes sem necessidade.',
      confunde_percentil_media: 'O percentil é um ponto de corte, não uma média: o P90 é o valor abaixo do qual ficam 90% dos dados.',
    },
    explicacao_correta:
      'O P90 ({{p90}}) é o prazo que 9 em cada 10 pedidos cumprem. A média ({{media}}) parece boa, mas esconde a cauda de atrasos que prejudica a experiência de parte dos clientes.',
    revelacao: {
      marcadores: [
        { chave: 'p90', rotulo: 'P90', correto: true },
        { chave: 'media', rotulo: 'Média' },
        { chave: 'mediana', rotulo: 'Mediana' },
      ],
    },
  },
  impacto,
};

const cenario03 = {
  id: 'cenario_03_estoque',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  titulo: 'Estoque de calçados',
  contexto:
    'Sua rede de calçados vai fazer a reposição do estoque. O gráfico mostra a numeração dos últimos {{n}} pares vendidos. Qual numeração você deve comprar em maior quantidade?',
  dica: 'Aqui os dados são categorias (numerações). Pergunte-se: o que você quer saber é o "meio" ou o que mais sai?',
  valor_base: 20000,
  dados: {
    gerador: {
      tipo: 'categorico_discreto',
      parametros: { n: 60, tamanhoMin: 35, pesos: [4, 8, 22, 12, 9, 8, 7, 6, 5, 4] },
    },
    formato: 'numero',
    rotulo_x: 'Numeração',
    rotulo_y: 'Pares vendidos',
    tipo_grafico: 'barras_discretas',
    descricao_acessivel: 'Uma numeração se destaca como a mais vendida, e as demais diminuem aos poucos para os dois lados.',
  },
  opcoes: [
    { id: 'moda', texto: 'Moda (numeração {{moda}})', correta: true },
    { id: 'media', texto: 'Média ({{media}})', correta: false, equivoco: 'media_em_discreto' },
    { id: 'mediana', texto: 'Mediana (numeração {{mediana}})', correta: false, equivoco: 'mediana_ignora_frequencia' },
    { id: 'maximo', texto: 'Maior numeração vendida ({{maximo}})', correta: false, equivoco: 'extremo_como_tipico' },
    { id: 'ponto_medio', texto: 'Ponto médio entre a menor e a maior numeração ({{ponto_medio}})', correta: false, equivoco: 'confunde_amplitude' },
  ],
  justificativas: [
    { id: 'j1', texto: 'Queremos saber qual numeração vende mais, e isso é a moda, o valor que mais se repete. A média daria um número que nem existe.', tipo: 'correta' },
    { id: 'j2', texto: 'Os dados são numerações inteiras, então precisamos de um valor que exista de verdade na lista.', tipo: 'parcial' },
    { id: 'j3', texto: 'A moda é a soma de todas as numerações dividida pela quantidade de pares.', tipo: 'erro_conceitual', equivoco: 'confunde_moda_media' },
    { id: 'j4', texto: 'A média usa todos os dados, então é a melhor forma de decidir quanto comprar de cada tamanho.', tipo: 'erro_conceitual', equivoco: 'media_em_discreto' },
    { id: 'j5', texto: 'A moda é mais fácil de calcular.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'A moda só pode ser calculada quando os dados são contínuos.', tipo: 'afirmacao_falsa', equivoco: 'moda_so_continuo' },
  ],
  feedback: {
    por_equivoco: {
      media_em_discreto: 'A média é {{media}}, uma numeração que nem existe nas prateleiras. Comprar pela média deixaria faltar justamente os tamanhos que mais saem.',
      mediana_ignora_frequencia: 'A mediana ({{mediana}}) é o tamanho do meio quando tudo é ordenado, mas a numeração {{moda}} vendeu mais pares.',
      extremo_como_tipico: 'A maior numeração ({{maximo}}) é a das pontas do gráfico, uma das que menos saem.',
      confunde_amplitude: 'O ponto médio ({{ponto_medio}}) só depende da menor e da maior numeração e ignora quanto cada uma vende.',
      confunde_moda_media: 'Soma dividida pela quantidade é a média. A moda é o valor que mais se repete.',
      moda_so_continuo: 'É o contrário: a moda é a principal medida de tendência central para dados em categorias, como numerações.',
    },
    explicacao_correta:
      'Para decidir o que comprar, importa saber o que mais sai. A moda (numeração {{moda}}) mostra isso. A média ({{media}}) resulta numa numeração que não existe.',
    revelacao: {
      marcadores: [
        { chave: 'moda', rotulo: 'Moda', correto: true },
        { chave: 'media', rotulo: 'Média' },
        { chave: 'mediana', rotulo: 'Mediana' },
      ],
    },
  },
  impacto,
};

const cenario04 = {
  id: 'cenario_04_pecas',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  titulo: 'Precisão de peças industriais',
  contexto:
    'Duas máquinas produzem eixos de {{media_a}}. As duas têm a mesma média, mas você suspeita que uma delas produz mais peças fora da especificação. Qual métrica revela a diferença entre elas?',
  dica: 'Se a média é igual nas duas, ela não ajuda a separá-las. O que mais pode ser diferente?',
  valor_base: 20000,
  dados: {
    gerador: {
      tipo: 'mesma_media_variancia_distinta',
      parametros: { n: 30, media: 50, dpA: [0.08, 0.15], dpB: [0.7, 1.1], nomes: ['Máquina A', 'Máquina B'] },
    },
    formato: 'mm',
    rotulo_x: 'Diâmetro (mm)',
    rotulo_y: 'Peças',
    tipo_grafico: 'histograma',
    descricao_acessivel: 'As duas máquinas estão centradas no mesmo valor, mas as peças da Máquina A ficam coladas nele e as da Máquina B se espalham bastante.',
  },
  opcoes: [
    { id: 'dp', texto: 'Desvio padrão (A: {{dp_a}} · B: {{dp_b}})', correta: true },
    { id: 'media', texto: 'Média (A: {{media_a}} · B: {{media_b}})', correta: false, equivoco: 'ignora_dispersao' },
    { id: 'mediana', texto: 'Mediana (A: {{mediana_a}} · B: {{mediana_b}})', correta: false, equivoco: 'tendencia_central' },
    { id: 'moda', texto: 'Moda', correta: false, equivoco: 'tendencia_central' },
    { id: 'quantidade', texto: 'Quantidade de peças produzidas ({{n}} por máquina)', correta: false, equivoco: 'metrica_irrelevante' },
  ],
  justificativas: [
    { id: 'j1', texto: 'Com médias iguais, o que diferencia as máquinas é o quanto as medidas se espalham em torno da média, e isso o desvio padrão mede.', tipo: 'correta' },
    { id: 'j2', texto: 'É preciso comparar algo além do valor central, porque ele sozinho não distingue as máquinas.', tipo: 'parcial' },
    { id: 'j3', texto: 'O desvio padrão é a média das medidas de cada máquina.', tipo: 'erro_conceitual', equivoco: 'confunde_dp_media' },
    { id: 'j4', texto: 'Se as médias são iguais, as duas máquinas têm a mesma qualidade.', tipo: 'erro_conceitual', equivoco: 'ignora_dispersao' },
    { id: 'j5', texto: 'A máquina mais nova costuma ser a mais precisa.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'Quando as médias são iguais, os desvios padrão também precisam ser iguais.', tipo: 'afirmacao_falsa', equivoco: 'dp_depende_da_media' },
  ],
  feedback: {
    por_equivoco: {
      ignora_dispersao: 'As médias são idênticas ({{media_a}} nas duas), então não separam as máquinas. A diferença está no espalhamento: {{dp_b}} na B contra {{dp_a}} na A.',
      tendencia_central: 'Mediana e moda também descrevem o centro dos dados, e o centro é o mesmo nas duas máquinas. Falta olhar o espalhamento.',
      metrica_irrelevante: 'As duas produzem {{n}} peças, e a quantidade não diz nada sobre a precisão de cada peça.',
      confunde_dp_media: 'O desvio padrão mede o quanto os valores se afastam da média, e não é uma média das medidas.',
      dp_depende_da_media: 'Média e desvio padrão são independentes: duas séries com a mesma média podem ter espalhamentos bem diferentes, como aqui ({{dp_a}} e {{dp_b}}).',
    },
    explicacao_correta:
      'As duas máquinas têm a mesma média ({{media_a}}), mas o desvio padrão da B ({{dp_b}}) é muito maior que o da A ({{dp_a}}). A B produz mais peças longe do valor desejado.',
    revelacao: {
      marcadores: [{ chave: 'media', rotulo: 'Média (igual nas duas)', correto: true }],
    },
  },
  impacto,
};

export const CENARIOS = [cenario01, cenario02, cenario03, cenario04];
