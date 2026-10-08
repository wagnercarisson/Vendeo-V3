# Product 1:1 Generation Orchestration

## ADDED Requirements

### Requirement: Preflight e execução da política

A execução SHALL resolver configuração fail-closed e exigir pricing `complete` para principal e fallback antes de reserva/provider. Política limita principal a duas tentativas e fallback a uma; rate_limit repete uma vez no principal; indisponibilidade explícita pode ir ao fallback; quota/faturamento não.

#### Scenario: Pricing incompleto bloqueia
- **WHEN** qualquer par tem pricing parcial/ausente
- **THEN** não reserva crédito nem chama provider

#### Scenario: Limite de tentativas respeitado
- **WHEN** tentativas falham conforme política
- **THEN** principal não excede duas e total não excede três chamadas

### Requirement: Telemetria e falha segura

Cada tentativa SHALL registrar modelo/qualidade/alvo/número/run-trace/resultado/custo por par. Falha operacional retorna `IMG-001` + referência opaca e diagnóstico durável, sem motivo interno. O fluxo não invoca revisor automático.

#### Scenario: Falha correlacionável
- **WHEN** geração falha operacionalmente
- **THEN** diagnóstico recuperável por referência é persistido e mensagem pública sanitizada
