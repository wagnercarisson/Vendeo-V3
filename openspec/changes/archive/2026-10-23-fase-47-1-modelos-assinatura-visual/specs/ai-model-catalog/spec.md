## ADDED Requirements

### Requirement: Luna Responses registrado para a Assinatura Visual

O catálogo SHALL registrar a tupla
`visual_signature_image / image / openai / gpt-6-luna / responses` como ativa,
com nota de fonte e `validated_at` nulo/ausente enquanto a validação real não
ocorrer. O registro SHALL ser idempotente e SHALL falhar em divergência, sem
`ON CONFLICT DO NOTHING` silencioso.

#### Scenario: Registro ativo
- **WHEN** o catálogo é lido para `visual_signature_image`
- **THEN** `gpt-6-luna/responses` aparece como ativo
- **AND** `gpt-5.5/responses` permanece ativo

#### Scenario: Reexecução idempotente
- **WHEN** o registro é reaplicado
- **THEN** a tupla existente é conferida
- **AND** uma divergência de segmento/status falha explicitamente

#### Scenario: Sem vazamento de capacidade
- **WHEN** `campaign_image` ou `visual_signature_validation` é consultada
- **THEN** não há linha de `gpt-6-luna/responses` para essas capacidades
- **AND** as linhas existentes são preservadas

### Requirement: Nenhum pricing é semeado pela migration de catálogo

A migration de catálogo SHALL NOT inserir ou alterar linhas de
`ai_model_pricing`. Pricing é dado operacional local e será diagnosticado e,
se necessário, semeado por procedimento autorizado separado.

#### Scenario: Pricing intocado pela migration
- **WHEN** a migration de catálogo é aplicada
- **THEN** nenhuma linha de pricing é criada ou alterada
- **AND** o preflight informa a cobertura existente
