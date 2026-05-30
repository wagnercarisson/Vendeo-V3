## MODIFIED Requirements

### Requirement: campaign-image-director.md prompt content

The `campaign-image-director.md` prompt SHALL retain all existing sections (briefing, technical specs, composition guidelines, mandatory instructions, segment observations, additional notes). Three new sections SHALL be appended at the end, after the "**Canal:** {{targetChannel}} — formato {{format}}" line.

#### Scenario: New sections are appended to existing prompt

- **WHEN** inspecting the `campaign-image-director.md` prompt file
- **THEN** the content SHALL include the three new sections after all existing content
- **AND** all existing sections SHALL remain unchanged in content and order

The appended sections are:

```markdown
## Direção Criativa Contextual

{{creativePersona}}

### Categoria do Produto

O produto anunciado é da categoria: **{{inferredCategory}}**

{{categoryConflictDirective}}

### Repertório Comercial

Considere os seguintes detalhes como argumentos visuais opcionais — use apenas se fizerem sentido para a composição:
{{commercialRepertoire}}

### Instruções de Validação

{{inputValidationSummary}}
```

### Requirement: Prompt template variables extended

The system SHALL support the following new `{{variable}}` placeholders for the `campaign-image-director.md` prompt, in addition to all existing variables:

- `{{creativePersona}}` — persona string: `"Você é um diretor de marketing especializado em {segment label}."`
- `{{inferredCategory}}` — product category inferred from image (fallback to store segment)
- `{{hasCategoryConflict}}` — `"sim"` or `"nao"` indicating whether product category differs from store segment
- `{{categoryConflictDirective}}` — conditional directive string (empty when no conflict)
- `{{commercialRepertoire}}` — commercially actionable arguments extracted from additional details, or empty
- `{{inputValidationSummary}}` — sanitized summary of what occurred during pre-validation

#### Scenario: New variables are interpolated at runtime

- **WHEN** `PromptLoader.load('campaign-image-director', variables)` is called with the new variables
- **THEN** the returned string SHALL have each `{{variable}}` placeholder replaced with the corresponding value

### Requirement: campaign-input-visual-check.md prompt extended for category inference

The `campaign-input-visual-check.md` prompt SHALL be updated to instruct the vision model to also return an `inferredCategory` field in the JSON response. The model SHALL analyze the product image to determine the product's broad category (e.g., "bebidas-energeticos", "calcados-esportivos", "cosmeticos", "eletronicos").

The expected JSON response format SHALL be extended:

```json
{
  "classification": "match",
  "confidence": 0.95,
  "inferredCategory": "bebidas-energeticos"
}
```

#### Scenario: Input check returns inferredCategory

- **WHEN** the vision model analyzes the product image
- **THEN** the response SHALL include `inferredCategory` alongside the existing classification fields
- **AND** the value SHALL be a string representing the product's category
