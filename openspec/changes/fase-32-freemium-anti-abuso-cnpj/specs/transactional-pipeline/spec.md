## MODIFIED Requirements

### Requirement: Pipeline em 3 zonas — legal clearance inclui reaceite v1.2

O sistema SHALL manter o guard `requireLegalClearance({ capability: "content_generation" })` no pré-stream, que agora verifica também o aceite de `terms_of_service` versão `"v1.2"`. O mapa `CAPABILITY_DOCUMENTS` é atualizado automaticamente via `getCurrentVersion()` — nenhum código novo é necessário no pipeline, pois a F30 já implementa verificação por versão vigente.

#### Scenario: Legal clearance bloqueia sem v1.2

- **WHEN** `POST /api/campaign/generate-image` é chamado
- **AND** loja não aceitou `terms_of_service` v1.2
- **THEN** retorna HTTP 403 antes de qualquer operação (rate limit, saldo, IA)