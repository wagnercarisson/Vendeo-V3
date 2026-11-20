## ADDED Requirements

### Requirement: Step de expansão preserva o snapshot econômico durável

O step de expansão SHALL obter `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` exclusivamente do snapshot durável da campanha/operação e encaminhá-los à execução da expansão. A leitura SHALL ocorrer uma única vez por execução do step, **depois do preflight e antes do último recheck de cancelamento/prazo**, e SHALL ter espera limitada. O recheck existente SHALL permanecer a última verificação antes do `acquire`; nenhuma consulta nova SHALL ocorrer entre o recheck e o `acquire`. A consulta SHALL ser restrita à identidade já validada (`campaigns.id = campaignId` e `campaigns.store_id = storeId`). A leitura SHALL ser best-effort: ausência, snapshot malformado, exceção, rejeição da dependência injetada ou timeout resultam em `null` explícito, sem bloquear, sem consumir tentativa por causa da telemetria, sem chamada adicional ao provider e sem alterar o desfecho da expansão. O step SHALL NOT consultar os parâmetros econômicos vigentes nem recalcular o snapshot.

#### Scenario: Expansão individual em geração inicial

- **WHEN** o fluxo 9:16 individual executa o step de expansão com snapshot econômico persistido
- **THEN** o step encaminha os dois valores ao módulo de expansão
- **AND** a telemetria registra os valores congelados

#### Scenario: Expansão no fluxo conjunto 1:1+9:16

- **WHEN** o fluxo conjunto executa o step de expansão com snapshot econômico persistido no `resumeContext` conjunto
- **THEN** o step encaminha os mesmos dois valores ao módulo de expansão
- **AND** o comportamento é idêntico ao fluxo individual

#### Scenario: Continuação ou retry não atualiza o snapshot

- **WHEN** a operação é continuada ou a expansão é repetida após os parâmetros econômicos vigentes mudarem
- **THEN** o step usa os valores persistidos na captura original
- **AND** não lê o câmbio/valor do crédito atuais como substitutos

#### Scenario: Falha, malformação, rejeição ou timeout da leitura resultam em null

- **WHEN** a leitura do snapshot não encontra a linha, encontra `resumeContext` ausente/malformado, lança exceção, tem a dependência injetada rejeitada ou excede a espera limitada
- **THEN** os dois valores são `null` explícitos
- **AND** a expansão prossegue sem bloquear, sem consumir tentativa por causa da telemetria e sem consultar os parâmetros vigentes

#### Scenario: Recheck final continua sendo a última verificação

- **WHEN** a leitura econômica termina (com sucesso, `null` ou timeout)
- **THEN** o recheck de cancelamento/prazo é executado depois dela
- **AND** nenhuma nova consulta ocorre entre o recheck e o `acquire`
- **AND** se o prazo tiver esgotado, a execução suspende sem `acquire`

#### Scenario: Consulta restrita à identidade validada

- **WHEN** o leitor consulta a campanha
- **THEN** filtra simultaneamente por `id = campaignId` e `store_id = storeId`
- **AND** não lê campanha, loja ou operação de outra identidade

#### Scenario: Base quadrada mantém o comportamento reconstruído

- **WHEN** a base quadrada é executada com snapshot econômico persistido
- **THEN** a reconstrução durável continua fornecendo os valores econômicos à telemetria da base
- **AND** nenhuma alteração na base é necessária para esta correção
