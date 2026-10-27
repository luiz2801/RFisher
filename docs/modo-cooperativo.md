# Proposta: modo cooperativo com diretorias

**Status:** fase 1 (base) implementada; fases 2 e 3 pendentes. Decisão registrada no histórico do [fisher.md](../fisher.md) (nº 9).

**Implementado na fase 1:** campo `setor` em cenários e eventos (validado), `modo` e `empresa` no estado, acessor `carteira(e)`, papéis por número de jogadores (`src/engine/papeis.js`), efeito passivo de Pessoas e Finanças (consultoria do Mercado pela metade do preço) e de prejuízo amortecido em 30% nos eventos de setor (hoje de todas as diretorias e válidos nos três modos, ver a seção 2), meta de caixa no Balanço (bônus de R$ 10.000 e +3 de reputação, ou corte de R$ 8.000 e −5), classificação final por faixas e a UI correspondente. Os valores estão em `src/engine/config.js`.

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

- **3 jogadores:** cada um escolhe a sua diretoria no menu (sem repetir), e todo setor tem um responsável.
- **2 jogadores:** o primeiro escolhe uma diretoria no menu e o segundo fica com as outras duas.
- **1 jogador:** acumula todas as diretorias e joga sem consultoria.

**Lacunas a resolver:**
- Operações tem 4 cenários e as outras diretorias têm 2.
- Financeiro não tem cenário próprio. Sugestões: risco e desvio padrão de um investimento, ou média geométrica de retornos.

---

## 2. Habilidades dos papéis

**Implementado** (`fisher.md` 3.16). As habilidades valem nos **três modos**, não só no cooperativo: no competitivo e no solo a diretoria é a escolhida no menu, e no cooperativo vêm de `papeis` (quem acumula diretorias acumula as habilidades). Cada diretoria tem uma habilidade ativa, usada na escolha da métrica (2 usos por partida por jogador, uma vez por cenário), e um efeito passivo. As ativas dão **informação**, nunca a resposta. A justificativa continua obrigatória (princípio 2 do fisher.md: acertar por sorte não pode compensar).

| Papel | Habilidade ativa | Efeito passivo |
| --- | --- | --- |
| Operações | **Plano B:** remove uma métrica incorreta da lista | −30% de prejuízo nos eventos de logística e produção |
| Tecnologia | **Teste A/B:** revela as duas métricas finalistas (a correta e uma errada), sem dizer qual é qual | −30% de prejuízo nos eventos de dados e produto |
| Pessoas e Finanças | **Treinamento:** abre a `dica` do cenário sem reduzir o bônus de confiança | −30% de prejuízo nos eventos de RH, atendimento e financeiro e **consultoria pela metade do preço** (25% do retorno e R$ 7.500) |

O **Dashboard** (resumo estatístico dos dados) foi trocado pelo Teste A/B por repetir o que o gráfico já mostra. A **Rota alternativa** da proposta original (rolar o dado duas vezes) foi trocada pelo Plano B: o dado é o de movimento, então ela não atuaria na decisão. O +2 de reputação por Balanço de Pessoas e Finanças, da fase 1, foi retirado.

**Eventos (`fisher.md` 3.15).** Na casa de Evento quem joga escolhe participar ou passar, e o grupo pode discutir antes. Ao participar, escolhe uma de três cartas viradas (uma boa, uma ruim e uma troll), o jogo revela uma das outras, e o grupo decide se mantém a carta ou troca (Monty Hall). O efeito da carta final vale para a empresa. O efeito passivo de prejuízo (−30%) vale para a carta escolhida e para o valor mostrado nas outras duas, reveladas ao final.

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

- **Meta trimestral no Balanço:** a empresa precisa de um caixa mínimo que cresce a cada trimestre. Se cumprir, ganha um bônus de investidor. Se falhar, sofre um corte de orçamento (perde reputação e dinheiro). Nenhum jogador é eliminado individualmente (princípio 4), mas a empresa **vai à falência** se o caixa ficar negativo ao fim de uma jogada que passou pelo Balanço: a partida termina na hora, com a faixa Falência (`fisher.md` 3.12).
- **Casa de Crise (fase 2):** sorteia um setor, e o diretor decide com valor dobrado enquanto o grupo debate.
- **Recuperação de quem está atrás:** com caixa comum, não existe mais "alguém atrás" no sentido financeiro. Resolve a questão nº 6. Quem tiver mérito baixo recebe feedback, não penalidade de dinheiro.
- **Fim de jogo:** classificação da empresa por faixas de caixa e reputação: Falência, Sobrevivência, Crescimento ou Líder de mercado.

---

## 4.1 Investimentos no Mercado

**Implementado** (`fisher.md` 3.14). As casas de Mercado funcionam também no cooperativo, com estas diferenças:

- O porte da empresa ofertada vem da **reputação da empresa**, e o aporte sai do **caixa da empresa** (no máximo o caixa disponível).
- A consultoria sai **pela metade do preço**, efeito passivo de Pessoas e Finanças, que vale em qualquer modo para quem tem a diretoria (`CONSULTORIA_PENALIDADE_RH` = 25% do retorno do sucesso e `CONSULTORIA_HONORARIO_RH` = R$ 7.500, no fracasso ou na hora de quem não investe). Como todo setor tem responsável no cooperativo, o desconto vale sempre. Substituiu o antigo +2 de reputação por Balanço, que era um bônus fixo e sem decisão do grupo.
- Cada aporte fica registrado em quem o fez (`jogadores[].investimentos`) e é apurado quando **essa pessoa** passa pelo Balanço. O retorno entra no caixa da empresa **antes da meta trimestral**, então um investimento bem-sucedido ajuda a cumprir a meta e um aporte em custódia reduz o caixa que a meta compara. O risco que o aporte de um jogador impõe ao orçamento comum é assunto do grupo: a conversa faz parte do jogo (como nas decisões de cenário).
- Diagnóstico certo ou errado do argumento do fundador muda a reputação da empresa.
- Os aportes ainda em custódia no fim dos trimestres são apurados no encerramento e entram no caixa final, que define a faixa da empresa. Falência da empresa encerra a partida sem apuração.
- O painel da empresa mostra o total investido.

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
| Um jogador faz um investimento arriscado e pesa no caixa comum | Aceito: o grupo discute o risco. O aporte tem teto de R$ 50.000 e só pode usar o caixa disponível (4.1) |
| Habilidades desbalanceadas | Cada habilidade só dá informação e tem limite de uso |

---

## 7. Impacto no código

- **`src/engine/state.js`:** adicionar `modo`, `empresa: { dinheiro, reputacao }` e, em cada jogador, `papel`, `merito` e `habilidadeUsos` (hoje um objeto com os usos de cada habilidade). Criar um acessor `carteira(e)`, porque `machine.js` hoje altera `jogadorAtual(e).dinheiro` diretamente.
- **`src/engine/board.js`:** cada casa de decisão passa a ter setor. `style.css` ganha uma cor por setor.
- **`src/engine/machine.js`:** novas ações (`PEDIR_PARECER`, `DAR_PARECER`; `USAR_HABILIDADE` já existe) e a meta no Balanço.
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
- A meta trimestral escala com o número de turnos configurado (10 por padrão)? Hoje parte do caixa inicial escolhido no menu e cresce R$ 2.000 por jogador a cada trimestre, sem depender do número de turnos; as faixas finais são múltiplos do caixa inicial (50%, 125%, 175%). Com caixa inicial muito diferente do padrão (R$ 100.000), o crescimento fixo deixa as faixas fáceis ou inalcançáveis (`fisher.md`, decisão nº 12).
- Qual o tamanho do bônus de investidor e do corte de orçamento?
