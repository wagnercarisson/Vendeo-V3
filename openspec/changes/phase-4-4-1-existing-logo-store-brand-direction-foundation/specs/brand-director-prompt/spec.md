## ADDED Requirements

### Requirement: Store Brand Director prompt file

The system SHALL have a dedicated prompt file at `prompts/store-brand-director-with-logo.md`. This prompt SHALL be used when the Store Brand Director analyzes a store's logo and data to generate a structured brand profile.

The prompt SHALL instruct the LLM to:
1. Analyze the provided logo image visually (colors, style, tone, personality)
2. Extract dominant colors from the logo (maximum 5 hex values)
3. Infer the store's visual style, visual tone, typography direction, and brand personality
4. Cross-reference with store metadata: segment, subsegment, city, state, tone_of_voice, positioning, short_description, slogan
5. Generate campaign guidelines and a structured brief for the Campaign Director
6. Return all results as a structured JSON object matching the store_brand_profiles schema fields

The prompt SHALL explicitly instruct the LLM NOT to suggest redesigning, recoloring, or creatively altering the logo. The logo SHALL be preserved as-is. The analysis is for creative direction context only.

#### Scenario: Prompt file exists

- **WHEN** the project is inspected
- **THEN** a file SHALL exist at `prompts/store-brand-director-with-logo.md`
- **AND** the file SHALL contain instructions for logo analysis and brand profile generation

### Requirement: Store Brand Director JSON output schema

The Store Brand Director LLM call SHALL return a structured JSON object with the following fields:

```typescript
{
  logo_colors_detected: string[],       // max 5 hex colors
  safe_color_tokens: {
    primary: string,                    // main brand hex
    secondary: string,                  // secondary hex
    accent: string                      // accent hex
  },
  visual_style: string,                 // e.g. "moderno e minimalista"
  visual_tone: string,                  // e.g. "profissional e acolhedor"
  typography_direction: string,         // e.g. "sans-serif limpa e moderna"
  brand_personality: string,            // e.g. "confiável, inovadora e próxima do cliente"
  campaign_guidelines: string,          // 2-3 sentence guidelines for campaign generation
  campaign_brief: string,               // structured brief for Campaign Director
  confidence_score: number              // 0.0 to 1.0
}
```

#### Scenario: LLM returns valid JSON

- **WHEN** the Store Brand Director LLM responds
- **THEN** the response SHALL be valid JSON matching the defined schema
- **AND** the system SHALL parse and persist the values to store_brand_profiles

#### Scenario: LLM returns invalid JSON

- **WHEN** the Store Brand Director LLM response is not valid JSON
- **THEN** the system SHALL record the error in metadata
- **AND** set the brand profile status to `failed`

### Requirement: Store identity data passed to prompt

The Store Brand Director prompt SHALL receive the following store data as context variables:

- `store_name`: Store name
- `segment`: Store segment slug (e.g., `moda-vestuario`)
- `subsegment`: Optional subsegment text
- `city`: Optional city
- `state`: Optional state
- `tone_of_voice`: Optional tone of voice
- `positioning`: Optional market positioning
- `short_description`: Optional short description
- `slogan`: Optional store slogan

All optional fields SHALL be passed as empty string when not filled.

#### Scenario: Store data interpolated into prompt

- **WHEN** the Store Brand Director is invoked
- **THEN** the prompt SHALL include all available store data fields
- **AND** unfilled optional fields SHALL be passed as empty strings

### Requirement: Logo preservation directive

The Store Brand Director prompt SHALL include an explicit directive that the logo must not be redesigned, recolored, recreated, or creatively altered. The analysis is observational and directional only. All detected characteristics are suggestions for creative alignment, not modifications to the logo.

#### Scenario: Prompt contains preservation instruction

- **WHEN** reading the prompt file
- **THEN** it SHALL contain an explicit instruction that the logo must be preserved as-is
- **AND** that no creative modification to the logo should be suggested
