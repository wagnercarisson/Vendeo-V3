# Image Generation Model Pair Config

## MODIFIED Requirements

### Requirement: Pricing e configuração fail-closed

O sistema SHALL exigir, antes da reserva/provider, pricing `complete` para principal e fallback; SHALL resolver configuração vigente sem default silencioso e congelá-la no snapshot.

#### Scenario: Pricing ausente/parcial
- **WHEN** cobertura de qualquer par não é complete
- **THEN** execução é bloqueada antes de reserva/provider

#### Scenario: Configuração ausente/divergente
- **WHEN** par não valida contra catálogo
- **THEN** falha fechada sem escolher modelo silenciosamente
