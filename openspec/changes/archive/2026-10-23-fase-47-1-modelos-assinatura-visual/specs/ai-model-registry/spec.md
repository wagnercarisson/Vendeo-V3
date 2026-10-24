## ADDED Requirements

### Requirement: Luna com Responses restrito à Assinatura Visual

A allowlist do registry SHALL aceitar `gpt-6-luna` com o protocolo `responses`
para a capacidade `visual_signature_image`, de forma aditiva, preservando
`chat-completions` para as capacidades existentes. A combinação SHALL NOT ser
aceita para `campaign_image` nem para `visual_signature_validation`.

#### Scenario: Luna na Assinatura Visual
- **WHEN** `visual_signature_image` é resolvida com a configuração dedicada
- **THEN** `gpt-6-luna` com `responses` é aceito
- **AND** o protocolo é compatível com a capacidade

#### Scenario: Luna não vaza para campanha
- **WHEN** `campaign_image` é resolvida
- **THEN** `gpt-6-luna/responses` não é aceito
- **AND** o comportamento existente permanece

#### Scenario: Luna não vaza para validação
- **WHEN** `visual_signature_validation` é resolvida
- **THEN** `gpt-6-luna/responses` não é aceito
- **AND** a validação continua no modelo configurado

### Requirement: Defaults preservados

A change SHALL NOT alterar os defaults do registry. `visual_signature_image`
continua com default `gpt-5.5/responses`; a configuração dedicada é uma escolha
explícita e não substitui o default.

#### Scenario: Default inalterado
- **WHEN** nenhuma configuração dedicada existe
- **THEN** o default de `visual_signature_image` permanece `gpt-5.5/responses`
- **AND** nenhum outro default muda
