# Proposta: modo cooperativo com diretorias

**Status:** fase 1 (base) implementada; fases 2 e 3 pendentes. Decisão registrada no histórico do [fisher.md](../fisher.md) (nº 9).

**Implementado na fase 1:** campo `setor` em cenários e eventos (validado), `modo` e `empresa` no estado, acessor `carteira(e)`, papéis por número de jogadores (`src/engine/papeis.js`), efeito passivo de Pessoas e Finanças (+2 de reputação por Balanço) e de prejuízo amortecido em 30% nos eventos de setor, meta de caixa no Balanço (bônus de R$ 10.000 e +3 de reputação, ou corte de R$ 8.000 e −5), classificação final por faixas e a UI correspondente. Os valores estão em `src/engine/config.js`. O passivo de Operações ainda não tem efeito, porque não há eventos de logística nem de produção.

**Relaciona-se com:** questão em aberto nº 2 (tema e tom), nº 6 (mecanismo de recuperação) e nº 1 do roadmap.

---

## Conceito

Os jogadores são a diretoria de **uma só empresa**. O caixa e a reputação são compartilhados, então a empresa ganha ou perde junto. Cada jogador comanda um setor e tem mérito individual.

O modo competitivo continua disponível. A escolha entre os dois fica no estado do jogo (`modo: 'cooperativo' | 'competitivo'`).

---

## 1. Setores e cenários

Cada cenário e evento ganha um campo `setor`.

| Diretoria (papel) | Setores | Cenários atuais |
| --- | --- | --- |
| **Operações** (Logística) | Logística, Produção e Qualidade | 02 SLA, 03 Estoque, 04 Peças, 07 Envase |
| **Tecnologia** (T.I.) | T.I. e Dados, Produto | 05 Avaliações, 08 Teste A/B |
| **Pessoas e Finanças** (RH) | RH, Atendimento, Financeiro | 01 Salários, 06 SAC; eventos de auditoria e eixo truncado |

- **3 jogadores:** cada um assume uma diretoria, e todo setor tem um responsável.
- **2 jogadores:** as 3 diretorias são divididas entre os dois.
- **1 jogador:** acumula todas as diretorias e joga sem consultoria.

**Lacunas a resolver:**
- Operações tem 4 cenários e as outras diretorias têm 2.
- Financeiro não tem cenário próprio. Sugestões: risco e desvio padrão de um investimento, ou média geométrica de retornos.

---

## 2. Habilidades dos papéis

Cada diretoria tem uma habilidade ativa, usada de 1 a 2 vezes por partida, e um efeito passivo. As habilidades dão **informação**, nunca a resposta. A justificativa continua obrigatória (princípio 2 do fisher.md: acertar por sorte não pode compensar).

| Papel | Habilidade ativa | Efeito passivo |
| --- | --- | --- |
| Operações | **Rota alternativa:** rola o dado duas vezes e escolhe um dos resultados | Perde menos dinheiro em eventos de cadeia e estoque |
| Tecnologia | **Dashboard:** mostra o resumo estatístico do cenário (n, mín., máx., quartis) | Reduz o prejuízo de eventos de dados enganosos (eixo truncado, taxa-base) |
| Pessoas e Finanças | **Treinamento:** libera a `dica` do cenário (o campo já existe no schema) | +2 de reputação a cada Balanço |

---

## 3. Consultoria entre setores

Quando um jogador cai numa casa de decisão de **outro** setor:

1. Quem caiu é o **decisor**. Só ele escolhe as opções.
2. O decisor pode pedir um **parecer** ao diretor do setor da casa, uma vez por turno.
3. O diretor vê o cenário e indica uma métrica, sem ver as justificativas.
4. O decisor aceita ou rejeita o parecer. A confiança continua sendo dele.
5. Se o parecer acertou, o diretor ganha **pontos de mérito**. Se errou e foi seguido, perde reputação pessoal.

Nos cenários de cálculo (`fisher.md` 4.7), o decisor também informa o valor calculado; o parecer do diretor indica só a métrica, e o cálculo continua sendo dele.

Assim ninguém vira "quarterback": cada um responde pelo seu papel. A regra mantém a discussão, que é onde se aprende (decisão nº 6 do histórico).

---

## 4. Pressão cooperativa

Sem pressão, o cooperativo fica morno.

- **Meta trimestral no Balanço:** a empresa precisa de um caixa mínimo que cresce a cada trimestre. Se cumprir, ganha um bônus de investidor. Se falhar, sofre um corte de orçamento (perde reputação e dinheiro). Ninguém é eliminado (princípio 4).
- **Casa de Crise (fase 2):** sorteia um setor, e o diretor decide com valor dobrado enquanto o grupo debate.
- **Recuperação de quem está atrás:** com caixa comum, não existe mais "alguém atrás" no sentido financeiro. Resolve a questão nº 6. Quem tiver mérito baixo recebe feedback, não penalidade de dinheiro.
- **Fim de jogo:** classificação da empresa por faixas de caixa e reputação: Falência, Sobrevivência, Crescimento ou Líder de mercado.

---

## 5. Camada competitiva leve

- **Destaque do ano:** ranking individual por mérito (decisões com justificativa correta, ponderadas pelo nível, e pareceres certos). Não define vitória, mas serve como avaliação formativa.
- **Meta de setor:** cada papel tem um objetivo próprio que rende um bônus pequeno. Exemplo: "Tecnologia: 3 sucessos em cenários de dados".
- **Relatório final por setor:** usa o `historico` que já é gravado, com taxa de acerto e equívocos mais comuns de cada pessoa. Serve de material de debate.

---

## 6. Riscos

| Risco | Mitigação |
| --- | --- |
| O jogador de nível alto domina as decisões | Só o decisor clica, e o parecer é limitado a um por turno. O multiplicador de nível continua sendo o de quem decide |
| Perda da comparação competitiva | Manter os dois modos, com `modo` no estado. Comparar os dois em playtest |
| Calibragem da meta | Escalar com o número de jogadores e turnos. Calibrar por simulação (fase 2 do roadmap) |
| Habilidades desbalanceadas | Cada habilidade só dá informação e tem limite de uso |

---

## 7. Impacto no código

- **`src/engine/state.js`:** adicionar `modo`, `empresa: { dinheiro, reputacao }` e, em cada jogador, `papel`, `merito` e `habilidadeUsos`. Criar um acessor `carteira(e)`, porque `machine.js` hoje altera `jogadorAtual(e).dinheiro` diretamente.
- **`src/engine/board.js`:** cada casa de decisão passa a ter setor. `style.css` ganha uma cor por setor.
- **`src/engine/machine.js`:** novas ações (`PEDIR_PARECER`, `DAR_PARECER`, `USAR_HABILIDADE`) e a meta no Balanço.
- **Schema e `src/scenarios/loader.js`:** campo `setor` obrigatório, validado nos testes.
- **`src/ui/views.js`:** tela de escolha de papel, painel da empresa e etapa de parecer.

**Atenção:** há alterações não commitadas em `src/main.js`, `src/ui/views.js` e `style.css`. Implementar só depois de commitá-las, para não colidir.

---

## 8. Ordem sugerida

1. **Base:** campo `setor`, caixa compartilhado, papéis com efeito passivo, meta no Balanço e classificação final.
2. **Interação:** habilidades ativas e parecer entre setores.
3. **Profundidade:** mérito individual, metas de setor, Casa de Crise e cenários de Financeiro.

---

## Questões em aberto

- Quantos pareceres por turno e por partida?
- O mérito pesa mais que o dinheiro no destaque do ano?
- A meta trimestral escala com o número de turnos configurado (10 por padrão)?
- Qual o tamanho do bônus de investidor e do corte de orçamento?
