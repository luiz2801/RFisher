# Histórico de prompts enviados a agentes

Registro de todos os prompts passados a agentes (ferramenta `Agent`) neste repositório, com o tipo de agente e o nível de esforço (`effort`) usados.

Written for: mantenedores do projeto Fisher SA que querem auditar o uso de agentes.

## Método de levantamento

As chamadas foram procuradas nas transcrições de sessão do Claude Code em `/home/luiz/.claude/projects/-home-luiz-desktop-UFPA-fisher-sa/`, incluindo as subpastas `subagents/` (que não existem neste projeto). Foram procurados blocos `tool_use` com `name` igual a `Agent` ou `Task`, e o campo `subagent_type` com algum valor.

## Resultado

Nenhuma chamada a agente foi encontrada. Nenhuma transcrição contém um bloco `tool_use` da ferramenta `Agent`, nem `subagent_type` com valor. As ocorrências da palavra `Agent` nas transcrições vêm do snapshot da lista de ferramentas e do prompt de sistema, não de chamadas reais. Os valores de `effort` encontrados nas transcrições (`low`, `medium`, `high`, `xhigh`) são configurações da sessão principal, não de agentes.

## Registro

| Data (UTC) | Sessão | Agente (`subagent_type`) | Modelo | Esforço | Prompt | Motivo / resultado |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | Nenhuma chamada registrada até a data de geração deste documento. |

## Como manter este registro

Ao usar a ferramenta `Agent`, acrescente uma linha à tabela acima com a data, a sessão, o `subagent_type`, o modelo, o `effort`, o prompt completo (ou um link para ele) e o resultado.
