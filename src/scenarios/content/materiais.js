// Materiais de estudo sugeridos no relatório de fim de jogo, por conceito (catálogo em conceitos.js).
// `revisar` diz em uma frase o que estudar; `links` são leituras gratuitas em português.
const wiki = (titulo, artigo) => ({ titulo, fonte: 'Wikipédia', url: `https://pt.wikipedia.org/wiki/${artigo}` });

// Curso completo, sugerido a todo jogador ao lado dos materiais de cada conceito.
export const MATERIAL_GERAL = {
  titulo: 'Estatística e probabilidade (curso gratuito)',
  fonte: 'Khan Academy',
  url: 'https://pt.khanacademy.org/math/statistics-probability',
};

export const MATERIAIS = {
  mediana: {
    revisar: 'Compare média e mediana em dados assimétricos: a mediana resiste a valores extremos, a média é puxada por eles.',
    links: [wiki('Mediana', 'Mediana_(estatística)'), wiki('Assimetria', 'Assimetria_(estatística)'), wiki('Outlier', 'Outlier')],
  },
  percentil: {
    revisar: 'Entenda o que um percentil garante (P90: 90% dos casos ficam abaixo) e escolha o percentil que o contrato ou a meta pede.',
    links: [wiki('Percentil', 'Percentil'), wiki('Quartil', 'Quartil')],
  },
  moda: {
    revisar: 'Use a moda em dados discretos ou categóricos, quando importa o valor mais frequente, e não um valor "médio" que ninguém compra.',
    links: [wiki('Moda', 'Moda_(estatística)'), wiki('Distribuição de frequências', 'Distribuição_de_frequências')],
  },
  desvio_padrao: {
    revisar: 'Separe centro de dispersão: duas séries com a mesma média podem ter riscos muito diferentes, e o desvio padrão mede essa diferença.',
    links: [wiki('Desvio padrão', 'Desvio_padrão'), wiki('Variância', 'Variância'), wiki('Dispersão estatística', 'Dispersão_estatística')],
  },
  distribuicao: {
    revisar: 'Olhe a forma dos dados antes de resumir: numa distribuição polarizada, média e mediana escondem os dois grupos.',
    links: [wiki('Distribuição de frequências', 'Distribuição_de_frequências'), wiki('Histograma', 'Histograma')],
  },
  iqr: {
    revisar: 'Meça a dispersão do miolo dos dados com a amplitude interquartil quando há outliers que inflam o desvio padrão e a amplitude total.',
    links: [wiki('Amplitude interquartil', 'Amplitude_interquartil'), wiki('Diagrama de caixa (boxplot)', 'Diagrama_de_caixa'), wiki('Quartil', 'Quartil')],
  },
  media: {
    revisar: 'Reconheça quando a média é a melhor escolha: dados simétricos, sem outliers, em que média e mediana praticamente coincidem.',
    links: [wiki('Média aritmética', 'Média_aritmética'), wiki('Distribuição normal', 'Distribuição_normal'), wiki('Tendência central', 'Tendência_central')],
  },
  variabilidade_amostral: {
    revisar: 'Desconfie de diferenças medidas em amostras pequenas: quanto menor a amostra, maior a oscilação por acaso.',
    links: [wiki('Erro padrão', 'Erro_padrão'), wiki('Margem de erro', 'Margem_de_erro'), wiki('Lei dos grandes números', 'Lei_dos_grandes_números')],
  },
  extremos: {
    revisar: 'Quando todo caso precisa caber (uma porta, um limite físico), o que decide é o máximo, não um valor típico nem um percentil.',
    links: [wiki('Estatística descritiva', 'Estatística_descritiva'), wiki('Percentil', 'Percentil'), wiki('Outlier', 'Outlier')],
  },
  media_para_total: {
    revisar: 'Para projetar um total (receita, custo), multiplique a média pelo número de casos; a mediana ignora o peso dos valores altos.',
    links: [wiki('Valor esperado', 'Valor_esperado'), wiki('Média aritmética', 'Média_aritmética'), wiki('Assimetria', 'Assimetria_(estatística)')],
  },
  cv: {
    revisar: 'Compare a dispersão de séries em escalas diferentes dividindo o desvio padrão pela média: o desvio absoluto de quem fatura mais sempre parece maior.',
    links: [wiki('Coeficiente de variação', 'Coeficiente_de_variação'), wiki('Desvio padrão', 'Desvio_padrão')],
  },
  media_aparada: {
    revisar: 'Quando há extremos dos dois lados que não representam o grupo, descarte uma fração de cada ponta e calcule a média do restante.',
    links: [wiki('Média aparada', 'Média_aparada'), wiki('Outlier', 'Outlier'), wiki('Média aritmética', 'Média_aritmética')],
  },
  paradoxo_simpson: {
    revisar: 'Lembre que um total é uma média ponderada: se o peso dos grupos muda, o resultado geral pode cair mesmo com todos os grupos melhorando.',
    links: [wiki('Paradoxo de Simpson', 'Paradoxo_de_Simpson'), wiki('Média ponderada', 'Média_ponderada')],
  },
};
