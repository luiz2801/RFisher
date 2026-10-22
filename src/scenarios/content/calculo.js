// Cenários de cálculo (fisher.md 4.7): os dados chegam em tabela (e, às vezes, em gráfico) e a pessoa escolhe
// a métrica, calcula o valor, justifica e declara a confiança. Os textos das opções não revelam valores;
// só o feedback usa placeholders ({{media}} etc.), calculados a partir dos dados sorteados.
// Poucas observações por cenário, para dar para calcular à mão.

const impacto = { reputacao_acerto: 5, reputacao_erro: -10 };

const cenario14 = {
  id: 'cenario_14_alugueis',
  tipo: 'calculo',
  setor: 'financeiro',
  conceito: 'mediana',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  dificuldade: 1,
  titulo: 'Aluguel típico do bairro',
  contexto:
    'Uma imobiliária vai divulgar o aluguel típico dos apartamentos do bairro. A tabela traz o valor de {{n}} aluguéis anunciados. Escolha a métrica, calcule-a com os dados da tabela e informe o valor que deve aparecer na divulgação.',
  dica: 'Veja se algum valor da tabela destoa muito dos demais e pense em qual métrica não é puxada por ele.',
  valor_base: 20000,
  calculo: { margem_pct: 1 },
  dados: {
    gerador: {
      tipo: 'assimetria_direita',
      parametros: { n: 11, base: 2000, ruido: 0.15, outliers: [{ valor: 30000, qtd: 1 }] },
    },
    formato: 'brl',
    exibir: ['tabela', 'grafico'],
    tabela: 'valores',
    rotulo_x: 'Aluguel (R$)',
    rotulo_y: 'Anúncios',
    tipo_grafico: 'histograma',
    descricao_acessivel: 'A maioria dos aluguéis está na faixa baixa e um valor muito alto aparece isolado à direita.',
  },
  opcoes: [
    { id: 'mediana', chave: 'mediana', texto: 'Mediana', correta: true },
    { id: 'media', chave: 'media', texto: 'Média aritmética', correta: false, equivoco: 'ignora_outliers' },
    { id: 'moda', chave: 'moda', texto: 'Moda', correta: false, equivoco: 'moda_para_continuo' },
    { id: 'ponto_medio', chave: 'ponto_medio', texto: 'Ponto médio entre o menor e o maior', correta: false, equivoco: 'confunde_amplitude' },
    { id: 'maximo', chave: 'maximo', texto: 'Maior aluguel', correta: false, equivoco: 'extremo_como_tipico' },
  ],
  justificativas: [
    { id: 'j1', texto: 'Um aluguel muito alto isolado puxa a média para cima, e a mediana, que é o valor do meio, não é afetada por ele.', tipo: 'correta' },
    { id: 'j2', texto: 'A maioria dos aluguéis está concentrada em valores parecidos, então um valor central descreve bem o bairro.', tipo: 'parcial' },
    { id: 'j3', texto: 'A mediana é o aluguel que mais aparece na tabela.', tipo: 'erro_conceitual', equivoco: 'confunde_mediana_moda' },
    { id: 'j4', texto: 'A média usa todos os valores da tabela, então é sempre a melhor medida do aluguel típico.', tipo: 'erro_conceitual', equivoco: 'ignora_outliers' },
    { id: 'j5', texto: 'Imobiliárias costumam divulgar números redondos.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'O aluguel mais alto puxa a mediana tanto quanto puxa a média.', tipo: 'afirmacao_falsa', equivoco: 'mediana_sensivel' },
  ],
  feedback: {
    por_equivoco: {
      ignora_outliers: 'A média ({{media}}) foi puxada pelo aluguel de {{maximo}}. Quase nenhum apartamento custa perto disso.',
      moda_para_continuo: 'A moda ({{moda}}) depende de repetições por acaso na tabela e diz pouco sobre o aluguel do bairro.',
      confunde_amplitude: 'O ponto médio entre o menor ({{minimo}}) e o maior ({{maximo}}) depende só dos dois extremos: {{ponto_medio}} não é o aluguel de ninguém.',
      extremo_como_tipico: 'O maior aluguel ({{maximo}}) é justamente o menos típico do bairro.',
      confunde_mediana_moda: 'O valor que mais se repete é a moda. A mediana é o valor do meio quando os dados estão ordenados.',
      mediana_sensivel: 'A mediana só olha para a posição do meio: trocar o maior aluguel por outro ainda maior não a muda.',
    },
    explicacao_correta:
      'Com um valor extremo, a mediana ({{mediana}}) representa melhor o aluguel típico. A média ({{media}}) foi puxada para cima pelo aluguel de {{maximo}}.',
    como_calcular:
      'Ordene os {{n}} valores do menor para o maior. Como a quantidade é ímpar, a mediana é o valor do meio: {{mediana}}. Para a média, some todos os valores e divida por {{n}}: {{media}}.',
    revelacao: {
      marcadores: [
        { chave: 'mediana', rotulo: 'Mediana', correto: true },
        { chave: 'media', rotulo: 'Média' },
      ],
    },
  },
  impacto,
};

const cenario15 = {
  id: 'cenario_15_espera',
  tipo: 'calculo',
  setor: 'atendimento',
  conceito: 'percentil',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  dificuldade: 2,
  titulo: 'Espera no pronto-atendimento',
  contexto:
    'Um pronto-atendimento quer afixar na recepção um tempo de espera que 9 em cada 10 pacientes consigam cumprir. A tabela traz a espera de {{n}} pacientes. Escolha a métrica, calcule-a e informe o valor.',
  dica: 'Você quer um número que cubra quase todo mundo, inclusive quem esperou muito. Para um percentil, ordene os dados e conte posições.',
  valor_base: 20000,
  calculo: { margem_pct: 1 },
  dados: {
    gerador: {
      tipo: 'cauda_longa',
      parametros: { n: 21, base: 25, ruido: 6, proporcaoCauda: 0.15, caudaMin: 200, caudaMax: 300 },
    },
    formato: 'minutos',
    exibir: ['tabela'],
    tabela: 'valores',
    rotulo_x: 'Espera (min)',
    rotulo_y: 'Pacientes',
    tipo_grafico: 'histograma',
    descricao_acessivel: 'A maioria dos pacientes espera pouco, mas um grupo pequeno espera muito mais.',
  },
  opcoes: [
    { id: 'p90', chave: 'p90', texto: 'Percentil 90 (P90)', correta: true },
    { id: 'media', chave: 'media', texto: 'Média', correta: false, equivoco: 'media_oculta_falhas' },
    { id: 'mediana', chave: 'mediana', texto: 'Mediana', correta: false, equivoco: 'mediana_cobre_90' },
    { id: 'maximo', chave: 'maximo', texto: 'Maior espera registrada', correta: false, equivoco: 'extremo_como_tipico' },
    { id: 'amplitude', chave: 'amplitude', texto: 'Amplitude (maior espera menos a menor)', correta: false, equivoco: 'amplitude_nao_e_prazo' },
  ],
  justificativas: [
    { id: 'j1', texto: 'O P90 é o tempo dentro do qual 90% dos pacientes são atendidos; ele inclui quem esperou muito, o que a média e a mediana escondem.', tipo: 'correta' },
    { id: 'j2', texto: 'A maioria dos pacientes espera pouco, então um número baseado nesse grupo descreve a experiência típica.', tipo: 'parcial' },
    { id: 'j3', texto: 'O P90 é a média dos 90% menores tempos de espera.', tipo: 'erro_conceitual', equivoco: 'confunde_percentil_media' },
    { id: 'j4', texto: 'A média considera todos os pacientes, então já representa bem a espera de quem mais demorou.', tipo: 'erro_conceitual', equivoco: 'media_oculta_falhas' },
    { id: 'j5', texto: 'Hospitais costumam usar painéis digitais na recepção.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'A mediana garante que 90% dos pacientes esperam menos que ela.', tipo: 'afirmacao_falsa', equivoco: 'mediana_cobre_90' },
  ],
  feedback: {
    por_equivoco: {
      media_oculta_falhas: 'A média ({{media}}) mistura os atendimentos rápidos com as esperas muito longas e esconde que parte dos pacientes aguarda bem mais, até {{maximo}}.',
      mediana_cobre_90: 'A mediana ({{mediana}}) cobre só 50% dos pacientes: a outra metade espera mais que isso.',
      extremo_como_tipico: 'A maior espera ({{maximo}}) é o pior caso isolado; afixá-la exageraria o tempo para quase todos.',
      amplitude_nao_e_prazo: 'A amplitude ({{amplitude}}) é a diferença entre a maior e a menor espera. Mede dispersão e não é um tempo que alguém possa esperar.',
      confunde_percentil_media: 'O percentil é um ponto de corte, não uma média: o P90 é o valor abaixo do qual ficam 90% dos dados.',
    },
    explicacao_correta:
      'O P90 ({{p90}}) é o tempo que 9 em cada 10 pacientes cumprem. A média ({{media}}) parece boa, mas esconde a cauda de esperas longas.',
    como_calcular:
      'Ordene as {{n}} esperas do menor para o maior e pegue a posição 0,9 × (n − 1) + 1 da lista ordenada, interpolando quando não for inteira: {{p90}}.',
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

const cenario16 = {
  id: 'cenario_16_chamados',
  tipo: 'calculo',
  setor: 'produto',
  conceito: 'media_para_total',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  dificuldade: 3,
  titulo: 'Chamados de suporte por cliente',
  contexto:
    'O suporte de um aplicativo por assinatura vai dimensionar a equipe do mês seguinte, quando terá 2.000 clientes. A tabela mostra quantos chamados cada um de {{n}} clientes abriu neste mês. Qual métrica permite projetar o total de chamados da base inteira? Escolha-a, calcule o valor por cliente e informe.',
  dica: 'Para projetar um total, pense em qual métrica, multiplicada pelo número de clientes, devolve a soma real dos chamados.',
  valor_base: 20000,
  calculo: { margem_pct: 3 },
  dados: {
    gerador: {
      tipo: 'contagens_assimetricas',
      parametros: { n: 40, pesos: [14, 12, 6, 4, 3, 1] },
    },
    formato: 'decimal',
    exibir: ['tabela', 'grafico'],
    tabela: 'frequencias',
    rotulo_x: 'Chamados no mês',
    rotulo_y: 'Clientes',
    tipo_grafico: 'barras_discretas',
    descricao_acessivel: 'Muitos clientes abriram zero ou um chamado, e poucos abriram vários, com cauda à direita.',
  },
  opcoes: [
    { id: 'media', chave: 'media', texto: 'Média', correta: true },
    { id: 'mediana', chave: 'mediana', texto: 'Mediana', correta: false, equivoco: 'mediana_para_total' },
    { id: 'moda', chave: 'moda', texto: 'Moda', correta: false, equivoco: 'moda_para_total' },
    { id: 'p90', chave: 'p90', texto: 'Percentil 90 (P90)', correta: false, equivoco: 'percentil_para_total' },
    { id: 'maximo', chave: 'maximo', texto: 'Maior número de chamados', correta: false, equivoco: 'extremo_como_tipico' },
  ],
  justificativas: [
    { id: 'j1', texto: 'O total é a soma de todos os chamados: a média multiplicada pelo número de clientes devolve essa soma, inclusive a parte de quem abre muitos chamados.', tipo: 'correta' },
    { id: 'j2', texto: 'A média usa todos os valores da tabela, então é uma boa medida do cliente típico.', tipo: 'parcial' },
    { id: 'j3', texto: 'A mediana não é afetada por valores extremos, então sempre dá a melhor projeção.', tipo: 'erro_conceitual', equivoco: 'mediana_para_total' },
    { id: 'j4', texto: 'A moda é o número de chamados mais comum, então multiplicá-la pelos clientes dá o total.', tipo: 'erro_conceitual', equivoco: 'moda_para_total' },
    { id: 'j5', texto: 'Equipes de suporte costumam ser dimensionadas no começo do mês.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'Multiplicar a mediana pelo número de clientes dá sempre o total exato de chamados.', tipo: 'afirmacao_falsa', equivoco: 'mediana_para_total' },
  ],
  feedback: {
    por_equivoco: {
      mediana_para_total: 'A mediana ({{mediana}}) ignora o peso de quem abre vários chamados. Multiplicada pela base, subestima o total.',
      moda_para_total: 'A moda ({{moda}}) é só o valor mais comum e não leva em conta os clientes com mais chamados. Multiplicada pela base, subestimaria muito o total.',
      percentil_para_total: 'O P90 ({{p90}}) descreve o cliente que mais chama, não o cliente médio: multiplicá-lo pela base superestima o total.',
      extremo_como_tipico: 'O máximo ({{maximo}}) é o cliente mais ativo. Projetá-lo para todos superestima o total.',
    },
    explicacao_correta:
      'Para projetar um total, a média ({{media}} chamados por cliente) é a métrica certa: média × número de clientes devolve a soma. A mediana ({{mediana}}) e a moda ({{moda}}) ignoram quem abre muitos chamados.',
    como_calcular:
      'Multiplique cada número de chamados pela quantidade de clientes que o abriu, some tudo e divida por {{n}} (o total de clientes da amostra): {{media}} chamados por cliente.',
    revelacao: {
      marcadores: [
        { chave: 'media', rotulo: 'Média', correto: true },
        { chave: 'mediana', rotulo: 'Mediana' },
      ],
    },
  },
  impacto,
};

const cenario17 = {
  id: 'cenario_17_embaladora',
  tipo: 'calculo',
  setor: 'producao',
  conceito: 'desvio_padrao',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  dificuldade: 2,
  titulo: 'Regularidade da embaladora',
  contexto:
    'A supervisora quer saber o quanto o tempo de ciclo de uma embaladora oscila de um ciclo para outro. A tabela traz o tempo de {{n}} ciclos. Escolha uma métrica de variabilidade que use todas as medições, calcule-a e informe o valor.',
  dica: 'Procure uma medida que considere a distância de cada ciclo até o tempo médio, e não apenas os extremos.',
  valor_base: 20000,
  calculo: { margem_pct: 3 },
  dados: {
    gerador: {
      tipo: 'amostra_pequena',
      parametros: { n: 8, media: 60, dp: 12, casas: 0 },
    },
    formato: 'seg',
    exibir: ['tabela'],
    tabela: 'valores',
    rotulo_x: 'Tempo de ciclo (s)',
    rotulo_y: 'Ciclos',
    tipo_grafico: 'histograma',
    descricao_acessivel: 'Tempos de ciclo em torno de um minuto, com variação de poucos segundos entre os ciclos.',
  },
  opcoes: [
    { id: 'dp', chave: 'dp', texto: 'Desvio padrão', correta: true },
    { id: 'amplitude', chave: 'amplitude', texto: 'Amplitude (maior tempo menos o menor)', correta: false, equivoco: 'amplitude_so_extremos' },
    { id: 'media', chave: 'media', texto: 'Média', correta: false, equivoco: 'ignora_dispersao' },
    { id: 'mediana', chave: 'mediana', texto: 'Mediana', correta: false, equivoco: 'ignora_dispersao' },
    { id: 'maximo', chave: 'maximo', texto: 'Maior tempo de ciclo', correta: false, equivoco: 'extremo_como_tipico' },
  ],
  justificativas: [
    { id: 'j1', texto: 'O desvio padrão mede o quanto cada ciclo se afasta, em média, do tempo médio, usando todas as medições.', tipo: 'correta' },
    { id: 'j2', texto: 'O desvio padrão é um número só, fácil de comparar com o de outras máquinas.', tipo: 'parcial' },
    { id: 'j3', texto: 'A amplitude é a melhor medida de variabilidade porque usa os dois ciclos mais importantes: o mais lento e o mais rápido.', tipo: 'erro_conceitual', equivoco: 'amplitude_so_extremos' },
    { id: 'j4', texto: 'Se a média for baixa, a máquina é regular, então a média já mede a variabilidade.', tipo: 'erro_conceitual', equivoco: 'ignora_dispersao' },
    { id: 'j5', texto: 'A embaladora fica na ala leste da fábrica.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'O desvio padrão é a própria média dos tempos de ciclo.', tipo: 'afirmacao_falsa', equivoco: 'dp_igual_media' },
  ],
  feedback: {
    por_equivoco: {
      amplitude_so_extremos: 'A amplitude ({{amplitude}}) olha só o ciclo mais lento e o mais rápido: mudar esses dois altera muito o resultado e os demais não pesam.',
      ignora_dispersao: 'A média ({{media}}) e a mediana ({{mediana}}) dizem onde os tempos se concentram, não o quanto eles variam.',
      extremo_como_tipico: 'O maior tempo ({{maximo}}) é um único ciclo e não diz quanto os tempos oscilam.',
      dp_igual_media: 'O desvio padrão ({{dp}}) mede o espalhamento em torno da média ({{media}}). São grandezas diferentes.',
    },
    explicacao_correta:
      'O desvio padrão ({{dp}}) usa todos os ciclos e mede o quanto se afastam do tempo médio ({{media}}). A amplitude ({{amplitude}}) depende só de dois deles.',
    como_calcular:
      'Calcule a média ({{media}}). Para cada ciclo, eleve ao quadrado a diferença até a média e some tudo. Divida a soma por n − 1 (aqui, {{n}} − 1) e extraia a raiz quadrada: {{dp}}.',
    revelacao: { marcadores: [] },
  },
  impacto,
};

const cenario18 = {
  id: 'cenario_18_carga_noturna',
  tipo: 'calculo',
  setor: 'dados',
  conceito: 'iqr',
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'iniciante',
  dificuldade: 3,
  titulo: 'Estabilidade da carga noturna',
  contexto:
    'A equipe de dados monitora quanto tempo a carga noturna leva para rodar. A tabela traz a duração de {{n}} execuções, e uma delas travou. Você quer um indicador de variação que não seja distorcido por essa execução fora do padrão. Escolha a métrica, calcule-a e informe o valor.',
  dica: 'Pense em qual medida de variação olha só para os valores do meio da lista ordenada.',
  valor_base: 20000,
  calculo: { margem_pct: 2 },
  dados: {
    gerador: {
      tipo: 'dispersao_outliers',
      parametros: { n: 11, baseMin: 10, baseMax: 22, outliers: [140] },
    },
    formato: 'minutos',
    exibir: ['tabela', 'grafico'],
    tabela: 'valores',
    rotulo_x: 'Duração (min)',
    rotulo_y: 'Execuções',
    tipo_grafico: 'histograma',
    descricao_acessivel: 'A maioria das execuções dura entre dez e vinte e dois minutos, e uma execução isolada, à direita, durou muito mais.',
  },
  opcoes: [
    { id: 'iqr', chave: 'iqr', texto: 'Amplitude interquartil (IQR)', correta: true },
    { id: 'dp', chave: 'dp', texto: 'Desvio padrão', correta: false, equivoco: 'dp_sensivel_outlier' },
    { id: 'amplitude', chave: 'amplitude', texto: 'Amplitude (maior duração menos a menor)', correta: false, equivoco: 'amplitude_so_extremos' },
    { id: 'media', chave: 'media', texto: 'Média', correta: false, equivoco: 'centro_nao_e_dispersao' },
    { id: 'mediana', chave: 'mediana', texto: 'Mediana', correta: false, equivoco: 'centro_nao_e_dispersao' },
  ],
  justificativas: [
    { id: 'j1', texto: 'O IQR usa só os valores do meio (do 1º ao 3º quartil), então a execução que travou não o distorce.', tipo: 'correta' },
    { id: 'j2', texto: 'O IQR mostra a variação da maior parte das execuções.', tipo: 'parcial' },
    { id: 'j3', texto: 'O desvio padrão é sempre a melhor medida de variação, porque usa todos os valores.', tipo: 'erro_conceitual', equivoco: 'dp_sensivel_outlier' },
    { id: 'j4', texto: 'A amplitude mostra melhor a variação, porque inclui a execução que travou.', tipo: 'erro_conceitual', equivoco: 'amplitude_so_extremos' },
    { id: 'j5', texto: 'A carga noturna roda quando poucos usuários estão no sistema.', tipo: 'irrelevante' },
    { id: 'j6', texto: 'Um valor extremo altera pouco o desvio padrão, porque os demais valores compensam.', tipo: 'afirmacao_falsa', equivoco: 'dp_robusto' },
  ],
  feedback: {
    por_equivoco: {
      dp_sensivel_outlier: 'O desvio padrão ({{dp}}) foi inflado pela execução de {{maximo}} e fica muito acima da variação da maioria, que o IQR ({{iqr}}) mostra.',
      amplitude_so_extremos: 'A amplitude ({{amplitude}}) depende só da maior e da menor duração: a execução travada decide sozinha o resultado.',
      centro_nao_e_dispersao: 'A média ({{media}}) e a mediana ({{mediana}}) indicam onde as durações se concentram, não o quanto variam.',
      dp_robusto: 'É o contrário: o desvio padrão eleva as distâncias ao quadrado, então um valor extremo pesa muito. Aqui ele chegou a {{dp}}.',
    },
    explicacao_correta:
      'O IQR ({{iqr}}) mede a variação dos 50% centrais e ignora a execução travada. O desvio padrão ({{dp}}) foi inflado por ela.',
    como_calcular:
      'Ordene as {{n}} durações. O 1º quartil (P25) é {{p25}} e o 3º quartil (P75) é {{p75}}, pelo método linear. IQR = P75 − P25 = {{iqr}}.',
    revelacao: {
      marcadores: [
        { chave: 'p25', rotulo: 'P25', correto: true },
        { chave: 'p75', rotulo: 'P75', correto: true },
      ],
    },
  },
  impacto,
};

export const CENARIOS_CALCULO = [cenario14, cenario15, cenario16, cenario17, cenario18];
