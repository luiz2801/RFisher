# Documentação Arquitetural e Diagramas UML - Fisher SA

Este documento consolida a modelagem UML e arquitetural do projeto **Fisher SA**, detalhando sua estrutura de dados, máquina de estados, ciclo de vida de execução e separação em camadas.

---

## 1. Diagrama de Classes e Entidades (Estrutural)

Modela o estado da partida, as entidades de negócio (jogadores, cenários, cartas de evento) e os serviços/módulos do sistema.

```mermaid
classDiagram
    direction TB

    class GameState {
        +int versao
        +int seed
        +int rng
        +int turnoAtual
        +int turnosPorJogador
        +int jogadorAtual
        +Fase fase
        +int dado
        +int[] dados
        +Balanco balanco
        +List~Jogador~ jogadores
        +List~string~ baralhoCenarios
        +List~string~ baralhoEventos
        +CenarioInstanciado cenarioAtual
        +EventoAtual eventoAtual
        +Resultado resultado
        +Teste teste
        +boolean soConceitual
    }

    class Jogador {
        +int id
        +string nome
        +Nivel nivel
        +number dinheiro
        +number reputacao
        +int posicao
        +int distancia
        +List~HistoricoDecisao~ historico
        +PerfilBot bot
    }

    class HistoricoDecisao {
        +string cenario
        +string conceito
        +string metrica
        +string justificativa
        +Confianca confianca
        +CategoriaResultado resultado
        +number delta
        +List~string~ equivocos
        +number valor
        +boolean valorCorreto
    }

    class CenarioDef {
        +string id
        +int versao
        +string tipo
        +Object calculo
        +string idioma
        +Nivel nivel
        +int dificuldade
        +string conceito
        +string titulo
        +string contexto
        +string dica
        +number valor_base
        +DadosCenario dados
        +List~Opcao~ opcoes
        +List~Justificativa~ justificativas
        +Feedback feedback
    }

    class Opcao {
        +string id
        +string chave
        +number margem_pct
        +string texto
        +boolean correta
        +string equivoco
    }

    class Justificativa {
        +string id
        +string texto
        +TipoJustificativa tipo
        +string equivoco
    }

    class EventoCarta {
        +string id
        +string titulo
        +string texto
        +string licao
        +number dinheiro
        +number reputacao
    }

    class RngService {
        +int estado
        +prox() number
        +entre(min, max) number
        +inteiro(min, max) int
        +normal(media, dp) number
        +embaralhar(lista) Array
    }

    class BotService {
        +acertoEfetivo(perfil, dificuldade) number
        +confiancaDaCerteza(certeza) Confianca
        +decidirBot(def, perfil, rng, num) Escolha
    }

    class CalculoService {
        +ehCalculo(def) boolean
        +margemPct(def, opcao) number
        +avaliarCalculo(def, opcao, num, informado) AvaliacaoCalculo
        +valorEsperado(def, cenarioAtual) number
        +notaDeMetodo(chave) string
        +calcularOperacao(valores, id, p) number
        +formatarResultadoCalculadora(r) string
    }

    class DificuldadeService {
        +dificuldadeAlvo(progresso) number
        +pesoDificuldade(dificuldade, progresso) number
        +escolherPorDificuldade(candidatos, progresso, rng) string
    }

    class ScoringEngine {
        +multiplicadorReputacao(reputacao) number
        +justificativaConta(tipo) boolean
        +classificar(metricaCorreta, justCorreta) CategoriaResultado
        +resolverDecisao(params) ResultadoDecisao
        +receitaBalanco(reputacao) number
    }

    class BoardService {
        +Array~string~ CASAS
        +int NUM_CASAS
        +avancar(posicao, passos) Object
        +coordenadas(i) Object
    }

    class ScenarioLoader {
        +obterCenario(id) CenarioDef
        +instanciar(def, rng) Object
        +validarCenario(def, rng) List
        +preencher(texto, vars) string
    }

    class StorageService {
        +salvar(estado) void
        +carregar() GameState
        +limpar() void
    }

    GameState "1" *-- "1..3" Jogador : contém
    Jogador "1" *-- "*" HistoricoDecisao : registra
    GameState "1" o-- "0..1" CenarioDef : executa em 'decisao'
    GameState "1" o-- "0..1" EventoCarta : aciona em 'evento'
    CenarioDef "1" *-- "5" Opcao : possui
    CenarioDef "1" *-- "6..8" Justificativa : possui
    
    GameState ..> RngService : utiliza seed/estado
    GameState ..> BoardService : consulta trilha
    GameState ..> DificuldadeService : sorteia cenário por progresso
    GameState ..> BotService : decide a vez do rival (modo solo)
    GameState ..> CalculoService : confere o valor dos cenários de cálculo
    BotService ..> CalculoService : informa o valor no cenário de cálculo
    ScenarioLoader ..> CenarioDef : gerencia/instancia
    ScoringEngine <.. GameState : calcula pontuação
    StorageService ..> GameState : serializa/deserializa
```

---

## 2. Diagrama de Máquina de Estados (Comportamental)

Modela o fluxo de fases do motor de turnos em `src/engine/machine.js`. Cada transição é uma função pura `(estado, acao) -> novoEstado`.

```mermaid
stateDiagram-v2
    [*] --> MENU : Início / Sem jogo ativo
    
    MENU --> ROLAR_DADO : NOVA partida / CONTINUAR_SALVA
    
    state TurnoAtivo {
        [*] --> ROLAR_DADO
        
        ROLAR_DADO --> ESCOLHER_METRICA : ROLAR (caiu em 'decisao')
        ROLAR_DADO --> MOSTRAR_EVENTO : ROLAR (caiu em 'evento')
        ROLAR_DADO --> MOSTRAR_BALANCO : ROLAR (caiu em 'balanco')
        
        state FluxoDecisao {
            ESCOLHER_METRICA --> ESCOLHER_METRICA : ABRIR_DICA (só iniciante; marca dicaUsada e reduz o bônus de confiança)
            ESCOLHER_METRICA --> ESCOLHER_JUSTIFICATIVA : METRICA(id) (só pessoa, cenário comum)
            ESCOLHER_METRICA --> INFORMAR_VALOR : METRICA(id) (só pessoa, cenário de cálculo)
            INFORMAR_VALOR --> ESCOLHER_JUSTIFICATIVA : VALOR(número ou texto pt-BR)
            ESCOLHER_METRICA --> MOSTRAR_RESULTADO : DECIDIR_BOT (só rival do modo solo)
            ESCOLHER_JUSTIFICATIVA --> ESCOLHER_CONFIANCA : JUSTIFICATIVA(id)
            ESCOLHER_CONFIANCA --> MOSTRAR_RESULTADO : CONFIANCA('chute' | 'duvida' | 'provavel' | 'confiante' | 'certeza')
        }
        
        MOSTRAR_RESULTADO --> ValidaFimTurno : CONTINUAR
        MOSTRAR_EVENTO --> ValidaFimTurno : CONTINUAR
        MOSTRAR_BALANCO --> ValidaFimTurno : CONTINUAR
        
        state ValidaFimTurno <<choice>>
        ValidaFimTurno --> ROLAR_DADO : turnoAtual <= turnosPorJogador\n(próximo jogador ou nova rodada)
    }

    ValidaFimTurno --> FIM_DE_JOGO : turnoAtual > turnosPorJogador
    FIM_DE_JOGO --> MENU : NOVA partida (limpa storage)
```

---

## 3. Diagrama de Sequência (Comportamental)

Demonstra a ordem de chamada e a comunicação assíncrona/reativa orientada por eventos desde a interação na interface até a persistência no armazenamento.

```mermaid
sequenceDiagram
    autonumber
    actor Jogador as Jogador (User)
    participant UI as UI (main.js / views.js)
    participant Machine as Engine (machine.js)
    participant RNG as RNG (rng.js)
    participant Board as Board (board.js)
    participant Loader as ScenarioLoader (loader.js)
    participant Scoring as Scoring (scoring.js)
    participant Storage as Persist (persist.js)

    Jogador->>UI: Clica em "Rolar os dados" (data-acao="ROLAR")
    UI->>Machine: reduzir(estado, { tipo: 'ROLAR' })
    activate Machine
    Machine->>RNG: inteiro(1, 6)
    RNG-->>Machine: d1 (ex: 4)
    Machine->>RNG: inteiro(1, 6)
    RNG-->>Machine: d2 (ex: 3)
    Note over Machine: dado = d1 + d2
    Machine->>Board: avancar(j.posicao, dado)
    Board-->>Machine: { posicao, passouInicio }
    
    alt Passou pelo início
        Machine->>Scoring: receitaBalanco(reputacao)
        Scoring-->>Machine: receita
        Note over Machine: Aplica balanço financeiro
    end

    Note over Machine: distancia += dado; progresso = distancia / (turnos × 7)

    alt Casa == 'decisao'
        Machine->>Machine: sacarCenario (peso por dificuldade vs. progresso)
        Machine->>Loader: instanciar(obterCenario(id), rng)
        Loader-->>Machine: { series, num, vars }
        Note over Machine: fase = 'ESCOLHER_METRICA'
    else Casa == 'evento'
        Note over Machine: Aplica efeito e fase = 'MOSTRAR_EVENTO'
    else Casa == 'balanco'
        Note over Machine: fase = 'MOSTRAR_BALANCO'
    end
    
    Machine-->>UI: novoEstado
    deactivate Machine
    
    opt Vez do rival (modo solo) e fase 'ESCOLHER_METRICA'
        UI->>Machine: reduzir(estado, { tipo: 'DECIDIR_BOT' })
        Machine->>Machine: decidirBot(def, perfil, rng, num) e pontua como uma pessoa
        Machine-->>UI: novoEstado (fase: 'MOSTRAR_RESULTADO')
    end

    UI->>Storage: salvar(novoEstado)
    UI->>UI: render()
    
    Note over Jogador, UI: O Jogador seleciona Métrica -> (Valor calculado, só em cenário de cálculo) -> Justificativa -> Confiança
    Jogador->>UI: Confirma Confiança ("certeza")
    UI->>Machine: reduzir(estado, { tipo: 'CONFIANCA', valor: 'certeza' })
    activate Machine
    Machine->>Scoring: resolverDecisao(params)
    Scoring-->>Machine: { delta, deltaReputacao, categoria, ... }
    Machine-->>UI: novoEstado (fase: 'MOSTRAR_RESULTADO')
    deactivate Machine
    
    UI->>Storage: salvar(novoEstado)
    UI->>UI: render()
```

---

## 4. Diagrama de Pacotes e Arquitetura (Módulos)

Apresenta as camadas do projeto e a direção das dependências entre módulos ES6:

```mermaid
graph TD
    subgraph UI_Layer["Camada UI (src/ui/)"]
        MAIN["main.js<br/>(Dispatcher e Eventos)"]
        VIEWS["views.js<br/>(Templates HTML puros)"]
        HTML["html.js<br/>(Escape/Helpers)"]
        GRAFICO["components/grafico.js<br/>(SVG / Visualização)"]
    end

    subgraph Engine_Layer["Camada Engine (src/engine/)"]
        MACHINE["machine.js<br/>(Redutor / Transições)"]
        STATE["state.js<br/>(Fábrica de Estado)"]
        BOARD["board.js<br/>(Trilha e Posições)"]
        DIFICULDADE["dificuldade.js<br/>(Sorteio por dificuldade)"]
        BOT["bot.js<br/>(Rival do modo solo)"]
        SCORING["scoring.js<br/>(Cálculo de Pontos)"]
        CALCULO["calculo.js<br/>(Margem e valor dos cenários de cálculo)"]
        DESEMPENHO["desempenho.js<br/>(Perfil por conceito e relatório de fim de jogo)"]
        RNG["rng.js<br/>(Mulberry32 PRNG)"]
        CONFIG["config.js<br/>(Constantes Globais)"]
    end

    subgraph Scenarios_Layer["Camada Cenários (src/scenarios/)"]
        LOADER["loader.js<br/>(Interpolação e Validação)"]
        GENERATORS["generators.js<br/>(Geração com Invariantes)"]
        CONTENT["content/<br/>(cenarios.json, eventos.js, conceitos.js, materiais.js)"]
    end

    subgraph Stats_Layer["Camada Stats (src/stats/)"]
        METRICS["metrics.js<br/>(Média, Mediana, Moda, DP, P90)"]
        FORMAT["format.js<br/>(Formatação BRL, número, etc.)"]
    end

    subgraph Storage_Layer["Camada Storage (src/storage/)"]
        PERSIST["persist.js<br/>(LocalStorage Wrapper)"]
    end

    %% Relações
    MAIN --> MACHINE
    MAIN --> VIEWS
    MAIN --> PERSIST
    VIEWS --> GRAFICO
    VIEWS --> HTML
    VIEWS --> DESEMPENHO

    MACHINE --> STATE
    MACHINE --> BOARD
    MACHINE --> DIFICULDADE
    MACHINE --> BOT
    MACHINE --> CALCULO
    MACHINE --> FORMAT
    BOT --> CONFIG
    BOT --> CALCULO
    CALCULO --> CONFIG
    VIEWS --> CALCULO
    VIEWS --> FORMAT
    MAIN --> FORMAT
    BOT --> SCORING
    DIFICULDADE --> CONFIG
    MACHINE --> SCORING
    MACHINE --> RNG
    MACHINE --> LOADER
    MACHINE --> CONFIG
    MACHINE --> DESEMPENHO
    DESEMPENHO --> SCORING
    DESEMPENHO --> LOADER
    DESEMPENHO --> CONTENT

    LOADER --> GENERATORS
    LOADER --> CONTENT
    LOADER --> METRICS
    LOADER --> FORMAT
    LOADER --> CALCULO

    GENERATORS --> METRICS
    SCORING --> CONFIG
```

---

## 5. Descrição dos Componentes Principais

| Módulo | Responsabilidade Principal |
| :--- | :--- |
| **`src/engine/machine.js`** | Máquina de estados finitos que orquestra as transições a partir de ações do jogador. |
| **`src/engine/state.js`** | Fábrica inicial do estado (`novoJogo`, que aceita `soConceitual`, para excluir os cenários de cálculo, e os atalhos de teste do menu: casa forçada e baralho restrito, ver `fisher.md` 5.8.1) e funções seletoras puras (`jogadorAtual`, `ehBot`, `classificacao`, `progressoDoJogador`). |
| **`src/engine/bot.js`** | Rival do modo solo: acerta métrica e justificativa com a probabilidade do perfil (menor nos cenários difíceis), escolhe distratores ao errar e deriva a confiança de uma certeza interna ruidosa. Perfis em `config.js`, calibração em `scripts/simular-bot.mjs` (`fisher.md` 3.11). |
| **`src/engine/dificuldade.js`** | Dificuldade-alvo a partir do progresso do jogador e sorteio ponderado de cenários do baralho. |
| **`src/engine/rng.js`** | Gerador pseudo-aleatório determinístico baseado no algoritmo `mulberry32` com estado serializável em 32-bits. |
| **`src/engine/desempenho.js`** | Perfil de desempenho do jogador a partir do histórico: domínio e diagnóstico por conceito, pontos fortes, deficiências, equívocos recorrentes e calibração da certeza; e o relatório de fim de jogo (`relatorioDesempenho`): acertos e erros, assuntos que mais e menos domina e sugestões de estudo com os materiais de `content/materiais.js` (`fisher.md` 4.6). |
| **`src/engine/calculo.js`** | Cenários de cálculo (`fisher.md` 4.7): reconhece o tipo, avalia o valor informado contra o valor exato da métrica escolhida dentro de uma margem relativa e fornece as notas de método (percentil linear, desvio padrão amostral) e as operações da calculadora embutida na etapa do valor (`calcularOperacao`, que não altera o estado). |
| **`src/engine/scoring.js`** | Algoritmos de pontuação, multiplicadores de reputação, regras de aposta e crise de imagem. |
| **`src/scenarios/generators.js`** | Síntese de dados estatísticos com validação de invariantes conceituais. |
| **`src/scenarios/loader.js`** | Instanciação de cenários, cálculo de resumo estatístico e substituição de variáveis nos enunciados. |
| **`src/stats/metrics.js`** | Cálculos estatísticos fundamentais (média, mediana, moda, desvio padrão, percentil 90). |
| **`src/stats/format.js`** | Formatação dos números por formato de cenário (R$, dias, minutos, s, ...) e leitura (`lerNumero`) do valor digitado em pt-BR. |
| **`src/storage/persist.js`** | Camada de persistência em `window.localStorage` para salvamento automático a cada transição. |
| **`src/ui/`** | Renderização reativa baseada em strings HTML puras e SVG (`grafico.js`), delegando ações de volta ao `main.js`. |
