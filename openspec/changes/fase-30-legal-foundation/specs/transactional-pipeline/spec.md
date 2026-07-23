## MODIFIED Requirements

### Requirement: Pipeline em 3 zonas (pré-stream, paralelo, pós) (MODIFIED)

O sistema SHALL estruturar o handler `POST /api/campaign/generate-image` em três zonas com responsabilidades distintas:

**PRÉ-STREAM (síncrono, fora do ReadableStream):** parse + auth + ownership + **legal clearance** + rate limit + saldo check + input validation + criar campanha + reservar crédito. Produz Response HTTP direto (400, 401, 403, 429, 402, 409, 500). Nunca chama IA paga se alguma condição falhar.

- **Legal clearance** SHALL be verified BEFORE rate limit and balance check
- If `requireLegalClearance()` returns `{ ok: false }`, SHALL return HTTP 403 with:
  ```json
  {
    "error": { "message": "Ação bloqueada por pendência legal.", "reason": "...", "requiredDocuments": [...] }
  }
  ```

#### Scenario: Legal clearance fails returns 403 before rate limit

- **WHEN** `POST /api/campaign/generate-image` é chamado com legal clearance pendente
- **THEN** retorna HTTP 403 Forbidden
- **AND** Nenhuma chamada de IA é feita
- **AND** Nenhum rate limit check é executado

#### Scenario: Legal clearance passes continues normally

- **WHEN** `POST /api/campaign/generate-image` é chamado com legal clearance ok
- **THEN** rate limit guard é executado
- **AND** fluxo normal do pipeline prossegue

#### Scenario: Pipeline regression — generation with clearance succeeds

- **WHEN** `POST /api/campaign/generate-image` é chamado com legal clearance ok e saldo suficiente
- **THEN** a geração prossegue e completa normalmente (regressão zero)
