# Rate Limit

> Synced from `fase-25-integracao-transacional-pipeline` (ADDED).

## Purpose

Rate limit de geração de campanhas por loja, com tabela `generation_rate_events`, consulta de janela deslizante (10/hora, 30/dia), e guard que retorna HTTP 429 antes de qualquer operação paga.

## Requirements

### Requirement: Tabela generation_rate_events

O sistema SHALL criar a tabela `public.generation_rate_events` via migration `20260717000001_create_generation_rate_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.generation_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'generation_attempt',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_rate_events_lookup
  ON public.generation_rate_events (store_id, event_type, created_at DESC);
```

O sistema SHALL ativar RLS na tabela com policy `owner_select_generation_rate_events` permitindo SELECT apenas para o owner da store, e GRANT SELECT TO authenticated.

O INSERT na tabela SHALL ser feito via `supabaseAdmin` (service role), seguindo o padrão de `CreditService` e `campaign persistence` no repositório — não via client autenticado. Por isso a migration não inclui GRANT INSERT; o `recordGenerationAttempt()` é operação server-side no pipeline.

#### Scenario: Migration cria tabela com colunas corretas

- **WHEN** a migration `20260717000001` é executada
- **THEN** a tabela `generation_rate_events` existe
- **AND** tem as colunas `id`, `store_id`, `user_id`, `campaign_id`, `event_type`, `metadata`, `created_at`
- **AND** o índice `idx_generation_rate_events_lookup` existe em `(store_id, event_type, created_at DESC)`
- **AND** RLS está habilitado

#### Scenario: Owner pode SELECT na tabela

- **WHEN** um usuário autenticado que é dono da store consulta `generation_rate_events` para sua loja
- **THEN** o SELECT retorna os registros

#### Scenario: Não owner não vê registros

- **WHEN** um usuário autenticado que NÃO é dono da store consulta `generation_rate_events`
- **THEN** o SELECT retorna vazio (RLS filtra)

### Requirement: Consulta de rate limit (janela deslizante)

O sistema SHALL prover uma função `checkRateLimit(storeId)` que consulta o número de tentativas nas janelas de 1 hora e 24 horas:

```sql
-- Contagem na última hora
SELECT COUNT(*) FROM public.generation_rate_events
WHERE store_id = $1
  AND event_type = 'generation_attempt'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Contagem nas últimas 24h
SELECT COUNT(*) FROM public.generation_rate_events
WHERE store_id = $1
  AND event_type = 'generation_attempt'
  AND created_at > NOW() - INTERVAL '24 hours';
```

#### Scenario: Abaixo do limite em ambas as janelas

- **WHEN** `checkRateLimit(storeId)` retorna contagem < 10 na última hora E < 30 nas últimas 24h
- **THEN** retorna `{ allowed: true, remaining: { hourly: 10 - count1h, daily: 30 - count24h }, resetTime }`

#### Scenario: Excedido na janela de 1 hora

- **WHEN** contagem na última hora >= 10
- **THEN** retorna `{ allowed: false, reason: "hourly_limit_exceeded" }`

#### Scenario: Excedido na janela de 24 horas

- **WHEN** contagem nas últimas 24h >= 30
- **THEN** retorna `{ allowed: false, reason: "daily_limit_exceeded" }`

### Requirement: Registro imediato da tentativa

O sistema SHALL registrar a tentativa de geração em `generation_rate_events` imediatamente após passar no rate limit guard, antes de qualquer operação paga (saldo check, validação de input, chamada de IA). O INSERT deve ter `campaign_id = null` porque a campanha ainda não existe.

#### Scenario: INSERT após guard, antes de qualquer IA

- **WHEN** o rate limit guard passa
- **THEN** um registro é inserido em `generation_rate_events` com `event_type = 'generation_attempt'`, `campaign_id = null`
- **AND** isso acontece antes do saldo check, InputValidationService ou qualquer chamada de IA

#### Scenario: Evento permanece mesmo se geração falhar

- **WHEN** a geração falha após o registro da tentativa
- **THEN** o registro em `generation_rate_events` permanece (já consumiu uma vaga na janela)

### Requirement: Rate limit guard respeita rateLimitEnabled flag

O sistema SHALL verificar `rateLimitEnabled` da launch config antes de consultar `checkRateLimit()`. Quando `rateLimitEnabled = false`, `checkRateLimit()` SHALL retornar `{ allowed: true }` sem consultar o banco.

O registro em `generation_rate_events` SHALL continuar sendo feito mesmo quando `rateLimitEnabled = false`, para auditoria.

#### Scenario: rateLimitEnabled=false → bypass

- **WHEN** `VENDEO_RATE_LIMIT_ENABLED=false` está configurado
- **AND** `POST /api/campaign/generate-image` é chamado com 20 tentativas na última hora
- **THEN** `checkRateLimit()` retorna `{ allowed: true }`
- **AND** a tentativa é registrada em `generation_rate_events` (auditoria)
- **AND** o pipeline prossegue normalmente

#### Scenario: rateLimitEnabled=true → comportamento normal

- **WHEN** `VENDEO_RATE_LIMIT_ENABLED=true` (default)
- **AND** `POST /api/campaign/generate-image` é chamado com 10+ tentativas na última hora
- **THEN** `checkRateLimit()` retorna `{ allowed: false, reason: "hourly_limit_exceeded" }`
- **AND** retorna HTTP 429

### Requirement: Rate limit guard retorna HTTP 429

O sistema SHALL, se `checkRateLimit(storeId)` retornar `{ allowed: false }`, interromper o fluxo e retornar HTTP 429 Too Many Requests antes de qualquer operação paga.

#### Scenario: 429 na janela horária

- **WHEN** `POST /api/campaign/generate-image` é chamado com 10+ tentativas na última hora
- **THEN** retorna HTTP 429 com body contendo `error: "rate_limit_exceeded"` e `retryAfter` em segundos

#### Scenario: 429 na janela diária

- **WHEN** `POST /api/campaign/generate-image` é chamado com 30+ tentativas nas últimas 24h
- **THEN** retorna HTTP 429
