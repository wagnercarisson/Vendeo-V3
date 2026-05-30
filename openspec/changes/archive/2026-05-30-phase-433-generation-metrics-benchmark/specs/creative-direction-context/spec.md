## MODIFIED Requirements

### Requirement: Commercial repertoire extracted from additional details

**Modification:** The extracted repertoire is inspiration for the director — NOT mandatory visual instructions. The director MAY choose which elements strengthen the visual piece; not every detail needs to appear in the art. Some information may be better suited for captions, hashtags, or supplementary text (future phase).

The system SHALL parse the following form fields for commercially actionable arguments:
- `additionalDetails` — free-form text
- `availabilityNotes` — availability information (e.g., "poucas unidades", "cores variadas")
- `validity` — promotion validity period
- `campaignDetails` — additional campaign context

The extracted repertoire SHALL be a single PT-BR string inserted into the prompt as optional creative fuel for the director — NOT as mandatory instructions. The director SHALL use judgment to select what strengthens the visual piece. When no actionable arguments are found, the repertoire string SHALL be empty.

#### Scenario: Commercial repertoire extracted from availability notes

- **WHEN** `availabilityNotes` contains "poucas unidades"
- **THEN** the commercial repertoire SHALL include `"Disponibilidade limitada: poucas unidades"` as an optional visual argument
- **AND** the director MAY choose to display this or not based on visual composition

#### Scenario: Empty commercial repertoire

- **WHEN** no actionable arguments are found in additional details, availability notes, validity, or campaign details
- **THEN** the commercial repertoire string SHALL be empty
- **AND** generation SHALL proceed normally

## ADDED Requirements

### Requirement: creativeContextGuidance considers segment and product category

The system SHALL inject an optional `creativeContextGuidance` variable into the director prompt. This variable SHALL provide a tone/approach suggestion that considers:
- Store segment
- Inferred product category (from input validation)
- Whether there is a category conflict or alignment between segment and product

The guidance SHALL be a single short PT-BR sentence. When there is a category conflict, the guidance SHALL balance both universes without polluting the prompt.

Examples:
- Food store selling energy drink: `"Valorize energia e disposição. Preço é oportunidade."`
- Popular/variedades store selling premium electronics: `"Equilibre varejo popular com desejo por tecnologia."`
- Fashion store selling sports shoes: `"Valorize estilo e performance. Preço é investimento."`

#### Scenario: creativeContextGuidance generated from segment and category

- **WHEN** `buildPromptVariables()` is called
- **THEN** the returned record SHALL include `creativeContextGuidance`
- **AND** the value SHALL consider both store segment and inferred category

#### Scenario: Category conflict balanced in guidance

- **WHEN** store segment is `"variedades"` and inferred category is `"eletronicos"`
- **THEN** the guidance SHALL balance popular retail with technology desire
- **AND** SHALL NOT force either universe exclusively
