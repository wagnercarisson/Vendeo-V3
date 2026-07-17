## ADDED Requirements

### Requirement: Campo optional no GenerateImageRequestSchema

O sistema SHALL adicionar o campo opcional `mandatoryArtworkText?: string` no schema `GenerateImageRequestSchema` (Zod).

#### Scenario: Campo aceito no schema

- **WHEN** `GenerateImageRequestSchema` valida body com `mandatoryArtworkText: "Imagens meramente ilustrativas"`
- **THEN** a validação passa e o campo é preservado

#### Scenario: Campo ausente não quebra

- **WHEN** `GenerateImageRequestSchema` valida body sem `mandatoryArtworkText`
- **THEN** a validação passa (campo é opcional)

### Requirement: Campo propagado no inputSnapshot

O sistema SHALL guardar `mandatoryArtworkText` no `inputSnapshot.mandatoryArtworkText` para auditoria.

#### Scenario: mandatoryArtworkText presente no inputSnapshot

- **WHEN** uma geração com `mandatoryArtworkText` preenchido é concluída
- **THEN** `inputSnapshot.mandatoryArtworkText` contém o valor enviado

### Requirement: Campo propagado no brief do Image Director

O sistema SHALL propagar `mandatoryArtworkText` no `CampaignBrief.campaignInput` enviado ao Image Director, com instrução: "Incluir obrigatoriamente na arte, em tipografia mínima legível: [texto]".

#### Scenario: Image Director recebe mandatoryArtworkText

- **WHEN** o pipeline monta o brief para o Image Director com `mandatoryArtworkText` preenchido
- **THEN** `brief.campaignInput.mandatoryArtworkText` contém o valor
- **AND** o prompt visual inclui instrução de renderização obrigatória

### Requirement: Campo NÃO entra no CopyDirectorInput

O sistema SHALL NÃO incluir `mandatoryArtworkText` no `CopyDirectorInput`, mantendo a fronteira entre copy (texto persuasivo) e texto obrigatório na arte (visual).

#### Scenario: mandatoryArtworkText ausente no Copy Director

- **WHEN** `mapBriefToCopyDirectorInput` é chamado com input contendo `mandatoryArtworkText`
- **THEN** o `CopyDirectorInput` resultante NÃO contém o campo

### Requirement: Campo NÃO entra no publication_copy_snapshot

O sistema SHALL NÃO incluir `mandatoryArtworkText` no `publication_copy_snapshot`, pois é contrato visual, não de copy.

#### Scenario: publication_copy_snapshot sem mandatoryArtworkText

- **WHEN** uma geração com `mandatoryArtworkText` preenchido é concluída
- **THEN** `publication_copy_snapshot` NÃO contém o campo `mandatoryArtworkText`

### Requirement: Componente de campo no formulário

O sistema SHALL prover um componente `MandatoryArtworkField` opcional no formulário de campanha, posicionado abaixo do campo CTA.

#### Scenario: Campo renderizado no formulário

- **WHEN** o formulário de campanha é renderizado
- **THEN** há um campo opcional "Texto obrigatório na arte" (ou similar) abaixo do CTA
- **AND** o campo é um textarea ou input de texto livre
- **AND** o campo é opcional (sem validação de required)
