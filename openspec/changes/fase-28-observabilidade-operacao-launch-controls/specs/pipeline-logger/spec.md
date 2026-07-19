## ADDED Requirements

### Requirement: logPipelineEvent() emite JSON estruturado

O sistema SHALL prover uma função `logPipelineEvent(event: PipelineEvent)` em `src/lib/logging/pipeline-logger.ts` que emite JSON via `console.log(JSON.stringify(event))`.

```typescript
export interface PipelineEvent {
  event: string;
  traceId: string;
  campaignId?: string;
  storeId?: string;
  userId?: string;
  phase: string;
  status: "running" | "complete" | "failed";
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}
```

#### Scenario: Emite JSON com todos os campos obrigatórios

- **WHEN** `logPipelineEvent()` é chamado com `event`, `traceId`, `phase`, `status`
- **THEN** a saída é uma string JSON válida contendo `event`, `traceId`, `phase`, `status`
- **AND** `console.log` é chamado exatamente uma vez

#### Scenario: Campos opcionais aparecem quando fornecidos

- **WHEN** `logPipelineEvent()` é chamado com `campaignId`, `storeId`, `userId`, `durationMs`
- **THEN** esses campos estão presentes no JSON emitido

#### Scenario: errorCode e errorMessage em eventos de falha

- **WHEN** `logPipelineEvent()` é chamado com `status: "failed"`, `errorCode` e `errorMessage`
- **THEN** JSON emitido contém `errorCode` e `errorMessage`

### Requirement: logPipelineEvent() sanitiza dados sensíveis

O sistema SHALL garantir que `logPipelineEvent()` jamais inclua em `metadata`:
- Strings base64 (imagens, arquivos)
- O prompt completo enviado ao provider
- Dados sensíveis (senhas, tokens, API keys)

#### Scenario: Não inclui base64 em metadata

- **WHEN** `metadata` contém uma entrada com valor string que parece base64 (match de regex `/^[A-Za-z0-9+/=]{100,}$/`)
- **THEN** o valor é substituído por `"[REDACTED]"` no JSON emitido

#### Scenario: Não inclui prompt completo em metadata

- **WHEN** `metadata` contém chave `"prompt"` ou termina com `"Prompt"` (case insensitive)
- **THEN** o valor é substituído por `"[REDACTED]"` no JSON emitido

### Requirement: logPipelineEvent() é fire-and-forget

A função SHALL nunca lançar exceção — qualquer erro interno (JSON.stringify, console.log) é silenciosamente ignorado.

#### Scenario: Erro interno não propaga

- **WHEN** `JSON.stringify` lança erro (ex: circular reference em metadata)
- **THEN** `logPipelineEvent()` não propaga o erro
- **AND** a função retorna sem emitir log

### Requirement: traceId propagado

O sistema SHALL gerar um `traceId` via `randomUUID()` no início de cada request e propagá-lo em todas as chamadas a `logPipelineEvent()`.

#### Scenario: Múltiplas chamadas com mesmo traceId

- **WHEN** 3 chamadas a `logPipelineEvent()` são feitas com o mesmo `traceId`
- **THEN** todas as 3 linhas de log contêm o mesmo valor de `traceId`

### Requirement: Pipeline stages obrigatórios

O sistema SHALL emitir eventos de log para cada etapa do pipeline:

**PRÉ-STREAM:** `rate_limit_check`, `balance_check`, `campaign_create`, `credit_reserve`
**PARALELO:** `copy_generation`, `image_generation`
**PÓS-PARALELO:** `merge`, `upload`, `update_ready`, `credit_confirm`, `credit_refund`

Cada etapa SHALL emitir pelo menos 2 eventos: `running` (no início) e `complete|failed` (ao finalizar).

#### Scenario: Etapa emite running + complete

- **WHEN** uma etapa do pipeline executa com sucesso
- **THEN** um evento com `status: "running"` é emitido no início
- **AND** um evento com `status: "complete"` e `durationMs` é emitido ao finalizar

#### Scenario: Etapa com falha emite running + failed

- **WHEN** uma etapa do pipeline falha
- **THEN** um evento com `status: "running"` é emitido no início
- **AND** um evento com `status: "failed"`, `errorCode` e `errorMessage` é emitido
