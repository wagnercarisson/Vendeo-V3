## ADDED Requirements

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
