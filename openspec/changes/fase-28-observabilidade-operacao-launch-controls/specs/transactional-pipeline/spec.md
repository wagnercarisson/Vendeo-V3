## ADDED Requirements

### Requirement: Launch config checks no início do pré-stream

O sistema SHALL verificar as flags de launch config no início do handler `POST /api/campaign/generate-image`, antes de qualquer operação:

1. `generationPaused` → HTTP 503, sem qualquer operação
2. `v15Enabled` → master switch; quando false, pipeline roda como v1.4 (sem crédito, sem Copy Director, sem rate limit)
3. `rateLimitEnabled` → guard opcional
4. `creditsChargingEnabled` → saldo check opcional
5. `copyDirectorEnabled` → Copy Director opcional

#### Scenario: generationPaused=true → 503 antes de tudo

- **WHEN** `VENDEO_GENERATION_PAUSED=true` está configurado
- **AND** `POST /api/campaign/generate-image` é chamado
- **THEN** retorna HTTP 503 com mensagem "Geração temporariamente indisponível."
- **AND** nenhuma operação é executada (sem log, sem telemetria, sem consulta de saldo, sem IA)

#### Scenario: v15Enabled=false → pipeline v1.4

- **WHEN** `VENDEO_V15_ENABLED=false` está configurado
- **AND** `POST /api/campaign/generate-image` é chamado
- **THEN** pipeline ignora `creditsChargingEnabled`, `copyDirectorEnabled`, `rateLimitEnabled`
- **AND** pipeline não verifica saldo (`getBalance`/`reserveCredit`)
- **AND** pipeline não chama `CopyDirectorService` (usa fallback determinístico)
- **AND** pipeline não aplica rate limit
- **AND** pipeline gera campanha com comportamento equivalente a v1.4

#### Scenario: creditsChargingEnabled=false → sem verificação de saldo

- **WHEN** `VENDEO_CREDITS_CHARGING_ENABLED=false` está configurado
- **AND** `VENDEO_V15_ENABLED=true`
- **THEN** pipeline não chama `getBalance()` nem `reserveCredit()`
- **AND** toda geração prossegue sem verificação de saldo

#### Scenario: copyDirectorEnabled=false → fallback determinístico

- **WHEN** `VENDEO_COPY_DIRECTOR_ENABLED=false` está configurado
- **AND** `VENDEO_V15_ENABLED=true`
- **THEN** pipeline não chama `CopyDirectorService.generateCopy()`
- **AND** `publication_copy_snapshot` é populado via `buildPublicationCopySnapshot()` determinístico

### Requirement: traceId gerado por request

O sistema SHALL gerar um `traceId` via `randomUUID()` no início de cada request a `POST /api/campaign/generate-image` e propagá-lo em todas as chamadas a `logPipelineEvent()` e inserts de telemetria.

#### Scenario: traceId único por request

- **WHEN** dois requests simultâneos chegam a `POST /api/campaign/generate-image`
- **THEN** cada request tem um `traceId` diferente

#### Scenario: traceId presente em logs e telemetria

- **WHEN** o pipeline executa com sucesso
- **THEN** todos os eventos de log emitidos contêm o mesmo `traceId`
- **AND** os registros em `generation_events` contêm o mesmo `trace_id`

### Requirement: Logging estruturado em todas as etapas

O sistema SHALL emitir `logPipelineEvent()` em todas as etapas do pipeline (pré-stream, paralelo, pós-paralelo), com eventos `running` e `complete|failed` para cada etapa.

#### Scenario: Pré-stream inteiro logado

- **WHEN** o pré-stream executa com sucesso
- **THEN** eventos são emitidos para: `rate_limit_check`, `balance_check`, `campaign_create`, `credit_reserve`
- **AND** cada etapa tem ao menos 1 evento `running` e 1 `complete`

#### Scenario: Paralelo inteiro logado

- **WHEN** os ramos paralelos executam com sucesso
- **THEN** eventos são emitidos para: `copy_generation`, `image_generation`
- **AND** cada etapa tem ao menos 1 evento `running` e 1 `complete`

#### Scenario: Pós-paralelo inteiro logado

- **WHEN** o pós-paralelo executa com sucesso
- **THEN** eventos são emitidos para: `merge`, `upload`, `update_ready`, `credit_confirm`
- **AND** cada etapa tem ao menos 1 evento `running` e 1 `complete`

#### Scenario: Etapa com erro tem evento failed

- **WHEN** qualquer etapa do pipeline falha
- **THEN** um evento com `status: "failed"`, `errorCode` e `errorMessage` é emitido para aquela etapa

### Requirement: Telemetria persistida no pipeline

O sistema SHALL persistir telemetria em `generation_events` após:
- Copy Director completar ou falhar (`campaign_copy`)
- Image Director completar ou falhar (`campaign_image`)
- Pipeline completo finalizar (`campaign_pipeline`)

A inserção SHALL ser best-effort (try/catch), nunca bloqueando o pipeline.

#### Scenario: Telemetria após Copy Director

- **WHEN** Copy Director completa com sucesso
- **THEN** um registro `campaign_copy` é inserido em `generation_events` com tokens, custo, modelo, provedor

#### Scenario: Telemetria após Image Director

- **WHEN** Image Director completa com sucesso
- **THEN** um registro `campaign_image` é inserido em `generation_events` com custo, modelo, provedor

#### Scenario: Telemetria pipeline completo

- **WHEN** o pipeline finaliza (sucesso)
- **THEN** um registro `campaign_pipeline` é inserido em `generation_events` com custo total, duração total, metadata dos ramos

#### Scenario: Falha de INSERT não quebra pipeline

- **WHEN** o INSERT em `generation_events` falha (ex: timeout de rede)
- **THEN** o erro é logado via `console.error`
- **AND** o pipeline continua normalmente
- **AND** o usuário recebe a resposta normalmente

### Requirement: Log e telemetria sem dados sensíveis

O sistema SHALL garantir que nenhum evento de log ou registro de telemetria contenha:
- Imagens em base64
- Prompt completo enviado ao provider
- Dados sensíveis (senhas, tokens, API keys)

#### Scenario: Prompt completo não vaza

- **WHEN** `logPipelineEvent()` ou INSERT de telemetria inclui dados do prompt
- **THEN** o prompt completo nunca está presente nos campos emitidos
