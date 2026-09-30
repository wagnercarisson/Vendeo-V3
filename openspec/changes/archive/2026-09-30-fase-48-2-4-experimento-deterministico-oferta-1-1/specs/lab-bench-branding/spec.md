# Lab Bench Branding — delta (F48.2.4)

## REMOVED Requirements

### Requirement: Branding apenas exibido e registrado, sem uso automático na geração

**Reason**: Na F48.2.4 o branding persistido passa a ser usado automaticamente na geração: a direção visual integra o prompt compilado e a referência canônica de identidade é transportada ao modelo (`lab-bench-identity-transport`). O contrato antigo ("sem uso automático na geração" e "logo/assinatura não é enviado ao modelo") torna-se contraditório com o comportamento novo.

**Migration**: O uso do branding passa a ser regido pelo requisito "Branding persistido como contrato obrigatório da geração da bancada" (adicionado abaixo), que cobre direção visual, identidade canônica e evidência sem recriar a direção de marca.

## ADDED Requirements

### Requirement: Branding persistido como contrato obrigatório da geração da bancada

A bancada SHALL usar o branding persistido como **contrato obrigatório** e fonte de verdade, sem reinterpretá-lo nem recriá-lo: a direção visual consolidada SHALL integrar o prompt compilado pela **seleção determinística por prioridade** definida nesta capacidade, e a referência canônica de identidade SHALL ser transportada ao modelo conforme `lab-bench-identity-transport`. A bancada SHALL NOT criar nova direção de marca, nova precedência de cores nem inventar identidade ausente.

#### Scenario: Direção visual integra o prompt sem recriar a marca

- **WHEN** o prompt é composto
- **THEN** a direção visual consolidada do branding integra o prompt compilado
- **AND** nenhuma nova direção de marca é criada

#### Scenario: Identidade canônica é transportada ao modelo

- **WHEN** a geração é executada
- **THEN** a referência canônica de identidade é transportada ao modelo conforme `identity_state`
- **AND** nenhuma identidade é inventada ou substituída silenciosamente

#### Scenario: Branding é registrado como evidência

- **WHEN** a geração é persistida
- **THEN** o snapshot do branding é registrado na evidência
- **AND** nenhuma URL assinada é persistida

### Requirement: Mapeamento mínimo do branding para o prompt

O bloco `[IDENTIDADE E DIREÇÃO VISUAL]` SHALL enviar a **menor representação** que preserve a direção visual da loja, por **seleção determinística por prioridade**: (a) **sempre** nome da loja (`storeName`) e cor da marca resolvida (`brandColor`); (b) **um único** campo de direção visual pela cadeia de fallback `campaignBrief` → `campaignGuidelines` → `visualStyle` → `visualTone` → `brandPersonality`, usando o primeiro não vazio e **nunca** enviando simultaneamente os cinco; (c) direção tipográfica (`typographyDirection`) explicitamente no bloco próprio. Os demais campos SHALL permanecer **apenas na evidência**. A seleção SHALL ser determinística e SHALL NOT usar deduplicação semântica/embedding nem IA.

#### Scenario: Nome e cor sempre presentes

- **WHEN** o bloco de identidade é composto
- **THEN** o nome da loja e a cor da marca resolvida são sempre enviados
- **AND** nenhuma nova direção de marca é criada

#### Scenario: Apenas um campo de direção visual é enviado

- **WHEN** a loja possui mais de um campo de direção visual
- **THEN** apenas o primeiro não vazio da cadeia `campaignBrief` → `campaignGuidelines` → `visualStyle` → `visualTone` → `brandPersonality` é enviado
- **AND** os cinco campos nunca são enviados simultaneamente

#### Scenario: Direção tipográfica é explícita

- **WHEN** a loja possui direção tipográfica
- **THEN** ela é enviada explicitamente no bloco `[DIREÇÃO TIPOGRÁFICA]`

#### Scenario: Seleção é determinística e não semântica

- **WHEN** os campos de branding são selecionados
- **THEN** a seleção usa prioridade determinística e não deduplicação semântica/embedding
- **AND** a mesma entrada produz a mesma seleção
