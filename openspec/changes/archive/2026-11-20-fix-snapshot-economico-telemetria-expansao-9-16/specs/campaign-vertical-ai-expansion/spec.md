## ADDED Requirements

### Requirement: Snapshot econômico congelado na telemetria da expansão

A telemetria da expansão SHALL registrar, em cada evento de chamada real, o `usdBrlRateAtGeneration` e o `creditValueBrlAtGeneration` capturados no início do run e persistidos no snapshot durável da campanha/operação. Os dois valores SHALL ser repassados tanto ao contexto principal do sink de buffering quanto ao contexto criado por envelope no flush. A telemetria SHALL NOT reler câmbio ou valor do crédito vigentes no momento da expansão, SHALL NOT converter ausência em zero ou em valor atual e SHALL NOT usar um valor de outra operação. Indisponibilidade de leitura econômica SHALL degradar para `null` explícito, sem bloquear a expansão nem alterar seu resultado. Operações antigas sem snapshot econômico SHALL permanecer com `null` explícito.

#### Scenario: Expansão registra os valores congelados do run

- **WHEN** a expansão executa uma chamada real com snapshot econômico persistido (`usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` definidos)
- **THEN** o evento call-level registra exatamente esses dois valores
- **AND** o evento registra os mesmos valores independentemente de o custo ter sido reportado pelo provider ou calculado por tokens

#### Scenario: Contexto por envelope também recebe os valores

- **WHEN** o `BufferingAiTelemetrySink` entrega envelopes no flush e cria o contexto do sink padrão
- **THEN** esse contexto recebe `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` do snapshot congelado
- **AND** nenhum contexto da expansão persiste `null` por omissão quando o snapshot existe

#### Scenario: Operação antiga sem snapshot preserva null explícito

- **WHEN** a campanha/operação não possui snapshot econômico legível
- **THEN** os dois campos são registrados como `null`
- **AND** a expansão prossegue sem bloquear, sem inventar zero e sem consultar o parâmetro vigente como substituto

#### Scenario: Parâmetros vigentes mudam entre etapas

- **WHEN** o câmbio ou o valor do crédito simulados mudam depois da captura do snapshot e antes da expansão/retry
- **THEN** a telemetria da expansão mantém os valores originais capturados no run
- **AND** não utiliza os valores vigentes alterados

### Requirement: Cobertura única da expansão individual e conjunta

A propagação do snapshot econômico SHALL ocorrer no ponto compartilhado de execução da expansão, de modo que o fluxo 9:16 individual e o fluxo conjunto `1:1+9:16` tenham o mesmo comportamento, inclusive em continuação e retry.

#### Scenario: Fluxo individual e conjunto usam a mesma cobertura

- **WHEN** a expansão é executada pelo fluxo 9:16 individual ou pelo fluxo conjunto `1:1+9:16`
- **THEN** ambos encaminham o snapshot econômico congelado ao módulo de expansão
- **AND** ambos registram os valores nos eventos de telemetria sem caminhos divergentes
