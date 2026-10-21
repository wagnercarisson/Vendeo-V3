## ADDED Requirements

### Requirement: Geração da Assinatura Visual usa a configuração congelada

O sistema SHALL usar o orquestrador, o preset, o modelo da tool, a qualidade,
o reasoning e a versão congelados no início da operação quando existir
configuração dedicada da Assinatura Visual no ambiente local aprovado. Todas as
tentativas da mesma operação SHALL reutilizar o mesmo snapshot. Quando não
existir configuração dedicada, a geração SHALL preservar o caminho herdado.

#### Scenario: Geração com configuração dedicada
- **WHEN** a configuração dedicada está vigente e o ambiente é aprovado
- **THEN** a geração usa o orquestrador e o preset congelados
- **AND** a imagem é gerada em uma única chamada Responses com a tool explícita

#### Scenario: Retry usa o mesmo snapshot
- **WHEN** a primeira tentativa falha e o retry ocorre na mesma operação
- **THEN** o orquestrador, o modelo da tool, a qualidade, o reasoning e a versão permanecem iguais
- **AND** uma mudança administrativa entre tentativas não altera a geração

#### Scenario: Sem configuração dedicada
- **WHEN** não existe configuração dedicada
- **THEN** a geração usa a seleção herdada
- **AND** o payload legado permanece compatível

### Requirement: Metadados separam modelo Responses, modelo da tool, qualidade e configuração

A assinatura e a telemetria da geração SHALL registrar, separadamente, o
modelo Responses (orquestrador), o modelo da tool, a qualidade, o preset, o
reasoning e o `config_version_id`. O campo legado `model` SHALL continuar
representando o modelo Responses para compatibilidade.

#### Scenario: Metadados completos
- **WHEN** uma assinatura é persistida com configuração dedicada
- **THEN** os metadados contêm `responses_model`, `image_model`, `image_quality`, `visual_signature_preset`, `reasoning_effort` e `config_version_id`
- **AND** o campo `model` legado permanece o modelo Responses

#### Scenario: Retry com novo operation_run_id
- **WHEN** o retry cria outro `operation_run_id`
- **THEN** o `config_version_id` congelado permanece nos metadados
- **AND** os modelos e a qualidade permanecem os mesmos

### Requirement: Parsing e fallback da intenção criativa são registrados separadamente

O sistema SHALL registrar separadamente o resultado do parsing do JSON de
intenção criativa e a aplicação de fallback. Valores de fallback SHALL NOT ser
apresentados como direção efetivamente retornada pelo modelo. O contrato SHALL
preservar `visual_direction`, `content_used` e `intended_palette`.

#### Scenario: JSON válido
- **WHEN** a resposta contém JSON válido com `visual_direction` e `content_used`
- **THEN** `creative_intent_parse_status` é `parsed_json`
- **AND** `creative_intent_fallback_applied` é `false`
- **AND** `creative_intent_source` é `model`

#### Scenario: JSON ausente
- **WHEN** a resposta não contém JSON
- **THEN** `creative_intent_parse_status` é `no_json`
- **AND** o fallback é aplicado com `creative_intent_fallback_applied=true`
- **AND** `creative_intent_source` é `fallback`

#### Scenario: JSON incompleto
- **WHEN** o JSON existe mas não contém `visual_direction` ou `content_used`
- **THEN** o status é `incomplete_json`
- **AND** o motivo do fallback é registrado separadamente
- **AND** os valores de fallback não são tratados como saída do modelo

#### Scenario: Paleta intencional
- **WHEN** `intended_palette` está presente e é normalizável
- **THEN** `intended_palette_status` é `present_normalized`
- **AND** o contrato de aprovação, perfil de marca e drift permanece compatível

#### Scenario: `content_used` presente
- **WHEN** `content_used` está presente no JSON
- **THEN** `content_used_present` é `true`
- **AND** seus valores são preservados para aprovação, perfil de marca e drift

### Requirement: Telemetria enriquecida e tentativas identificadas

O sistema SHALL enriquecer o envelope bufferizado de
`visual_signature_image` com os campos de parsing antes do flush, preservando
um único evento por tentativa real. Cada tentativa SHALL registrar
`attempt_number`, `retry_used`, `retry_prompt_variant` e `credential_scope`.
Resultados obtidos no retry com prompt simplificado SHALL ser identificados e
não equiparados ao resultado do prompt inicial.

#### Scenario: Enriquecimento antes do flush
- **WHEN** o parsing da intenção é concluído antes do flush
- **THEN** o envelope da imagem contém `creative_intent_*`
- **AND** existe apenas um evento para aquela tentativa

#### Scenario: Retry identificado
- **WHEN** a segunda tentativa da mesma geração é usada
- **THEN** `attempt_number=2`, `retry_used=true` e `retry_prompt_variant='simplified'`
- **AND** o resultado é reportado separadamente da comparação inicial

#### Scenario: Credencial por chamada
- **WHEN** imagem/validação e perfil de marca usam credenciais diferentes
- **THEN** cada chamada registra `credential_scope='validation'` ou `'normal'`
- **AND** o UAT contabiliza as duas credenciais

### Requirement: Fluxos existentes da Assinatura Visual permanecem preservados

A change SHALL NOT alterar os contratos de validação semântica, Storage, draft,
aprovação, rejeição, histórico, drift ou geração do perfil de marca. A
regressão desses fluxos SHALL ser provada.

#### Scenario: Aprovação e perfil de marca
- **WHEN** uma assinatura gerada com configuração dedicada é aprovada
- **THEN** o fluxo existente de aprovação e perfil de marca continua funcionando
- **AND** a paleta e o `content_used` permanecem disponíveis

#### Scenario: Draft e histórico
- **WHEN** a configuração dedicada é usada
- **THEN** draft, histórico e Storage mantêm o comportamento existente
- **AND** nenhum novo estado é introduzido

#### Scenario: Drift
- **WHEN** o drift é recalculado após uma geração
- **THEN** a política existente permanece inalterada
- **AND** os metadados novos não quebram a leitura
