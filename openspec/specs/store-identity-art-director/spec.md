> **Purpose**: Defines the Store Identity Art Director — a dedicated AI professional responsible exclusively for creating visual signatures for stores without a logo. Separate from campaign concerns. Generates professional visual signatures (PNG), reference cards, and creative metadata.

## Requirements

### Requirement: Store Identity Art Director prompt

The system SHALL have a dedicated prompt file at `prompts/store-identity-art-director.md` for the Store Identity Art Director — a distinct AI professional responsible exclusively for creating visual signatures for stores without a logo.

The prompt SHALL NOT mix roles with campaign generation, CTA, product, or offer creation. The Store Identity Art Director SHALL NOT generate campaign art, promotional copy, or product imagery.

The prompt SHALL receive store cadastral data: name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state.

When a previous version was rejected, the prompt SHALL also receive rejection context: "A versão anterior foi rejeitada porque: [motivo]. Busque uma direção criativa completamente diferente — não apenas uma variação pequena da anterior."

#### Scenario: Prompt file exists

- **WHEN** inspecting `prompts/`
- **THEN** a file `store-identity-art-director.md` SHALL exist
- **AND** the file SHALL contain instructions for visual signature generation only

#### Scenario: Prompt excludes campaign concerns

- **WHEN** the prompt is inspected
- **THEN** it SHALL NOT reference product generation, CTA creation, offer design, or campaign art
- **AND** it SHALL NOT include instructions for pricing, promotional copy, or product imagery

#### Scenario: Rejection context is accepted

- **WHEN** the prompt is inspected
- **THEN** it SHALL define how rejection context from previous attempts is processed
- **AND** it SHALL instruct the AI to seek a completely new creative direction, not a minor variation

### Requirement: Visual signature generation output

The Store Identity Art Director SHALL produce the following outputs per generation:

1. **Visual signature** — PNG image, clean and reusable brand mark, store name as the main element, transparent or simple/solid background, optionally including a symbol or icon
2. **Reference card** — PNG image on neutral background showing the signature in context, to help the Campaign Director interpret the brand identity
3. **Creative metadata** — JSON structure with: `creative_description` (textual direction), `suggested_colors` (array of hex values), `visual_direction` (e.g., "Moderna e minimalista"), `elements_used` (array of design elements)

The generated visual signature SHALL:
- Look professional and publishable
- Use brand color(s) as accent
- NOT contain pricing, products, offers, CTAs, or promotional copy
- NOT be generic "initials in circle"
- NOT be campaign art

#### Scenario: Output includes PNG + reference card + metadata

- **WHEN** the Store Identity Art Director completes a generation
- **THEN** the output SHALL include a PNG signature, a PNG reference card (if generated), and structured creative metadata
- **AND** the metadata SHALL include `creative_description`, `suggested_colors`, `visual_direction`

#### Scenario: Signature avoids generic design

- **WHEN** a visual signature is generated
- **THEN** it SHALL NOT be a simple circle with initials
- **AND** it SHALL contain the store name as the main prominent element

### Requirement: Generation cascade with existing patterns

The Store Identity Art Director SHALL reuse the existing progress/timeout/retry patterns from the project's image generation pipeline.

Cascade:
1. Attempt 1: full generation (signature + reference card + metadata) with configurable timeout
2. If timeout or error: retry once with simplified prompt — using same retry patterns as existing image generation
3. If retry fails: controlled error — no typographic fallback
4. Error message: "Não foi possível criar sua assinatura visual agora. Pode haver instabilidade temporária no serviço de IA, problema de conexão ou servidor. Tente novamente mais tarde."
5. Validation of infra timeout limits (Vercel hobby: 60s) before confirming inline processing

#### Scenario: First attempt succeeds

- **WHEN** the generation completes within timeout
- **THEN** the signature, reference card, and metadata SHALL be returned
- **AND** no retry SHALL be triggered

#### Scenario: Timeout triggers simplified retry

- **WHEN** the first attempt times out
- **THEN** the system SHALL retry once with a simplified prompt
- **AND** the retry SHALL use the existing project retry pattern

#### Scenario: Retry also fails returns controlled error

- **WHEN** the retry also fails
- **THEN** the system SHALL return the controlled error message
- **AND** no typographic fallback SHALL be generated

### Requirement: Image quality criteria

The visual signature SHALL be validated before being presented to the lojista:
- Valid PNG with content
- Store name appears in the image (basic heuristic or LLM-based validation)
- NOT a generic circle+initials design

If validation fails, the system SHALL log the rejection and proceed to the fallback cascade.

#### Scenario: Invalid signature is rejected

- **WHEN** the generated image fails visual validation
- **THEN** the system SHALL NOT present it to the lojista
- **AND** SHALL proceed to retry or error cascade

#### Scenario: Valid signature is presented

- **WHEN** the generated image passes visual validation
- **THEN** the system SHALL present it to the lojista for approval

### Requirement: IntendedPalette normalization

The system SHALL have a `normalizeIntendedPalette(raw: unknown): IntendedPalette | null` function defined in the visual signature types module that normalizes the IA's raw JSON output into a validated `IntendedPalette`:

```typescript
interface IntendedPalette {
  primary: string;     // uppercase #RRGGBB
  accent: string;      // uppercase #RRGGBB
  background: string;  // uppercase #RRGGBB
  support: string[];   // uppercase #RRGGBB
}
```

Normalization rules:
- Validate each color field as a valid 6-character hex code (`/^#[0-9A-Fa-f]{6}$/`)
- Convert validated hex values to uppercase `#RRGGBB` format
- `support` array SHALL keep only valid hex entries (invalid entries filtered out)
- If `primary`, `accent`, or `background` are missing or invalid, return `null`
- The function SHALL be **idempotent**: calling it on already-normalized input produces the same result

#### Scenario: Normalizes valid input

- **WHEN** `normalizeIntendedPalette` receives `{ primary: "#22c55e", accent: "#1e40af", background: "#0f172a", support: ["#3b82f6"] }`
- **THEN** it SHALL return `{ primary: "#22C55E", accent: "#1E40AF", background: "#0F172A", support: ["#3B82F6"] }`

#### Scenario: Returns null on invalid required field

- **WHEN** `normalizeIntendedPalette` receives `{ primary: "invalid", accent: "#1e40af", background: "#0f172a" }`
- **THEN** it SHALL return `null`

#### Scenario: Filters invalid support entries

- **WHEN** `normalizeIntendedPalette` receives support with `["#3B82F6", "invalid", "#FF6600"]`
- **THEN** support SHALL be `["#3B82F6", "#FF6600"]`

#### Scenario: Idempotent on already-normalized input

- **WHEN** `normalizeIntendedPalette` is called twice on the same valid input
- **THEN** the second call SHALL return exactly the same result as the first

### Requirement: intended_palette in creative metadata

The Store Identity Art Director's output stored in `store_visual_signatures.metadata.artDirectorOutput` SHALL include two new fields alongside the existing `creative_description`, `suggested_colors`, `visual_direction`, and `elements_used`:

1. **`intended_palette: IntendedPalette`** — the structured semantic color palette extracted from the IA's JSON response and normalized via `normalizeIntendedPalette()`. Omitted entirely (not present) when normalization returns `null`.

2. **`color_usage: ColorUsage`** — natural language description of how each color role is used in the signature:

```typescript
interface ColorUsage {
  primary: string;     // e.g., "cor principal da marca, aplicada no nome da loja"
  accent: string;      // e.g., "destaque para elementos decorativos"
  support: string;     // e.g., "cores de apoio para variação visual"
  background: string;  // e.g., "fundo da assinatura"
}
```

Both `intended_palette` and `color_usage` SHALL be:
1. Extracted from the IA's raw JSON response
2. Validated/normalized
3. Persisted in `metadata.artDirectorOutput`

#### Scenario: intended_palette and color_usage persisted

- **WHEN** a visual signature is generated successfully with valid color data
- **THEN** `metadata.artDirectorOutput.intended_palette` SHALL be a valid `IntendedPalette`
- **AND** `metadata.artDirectorOutput.color_usage` SHALL be a valid `ColorUsage`
- **AND** both SHALL have uppercase `#RRGGBB` hex values where applicable

#### Scenario: intended_palette omitted on normalization failure

- **WHEN** the IA returns invalid color data (e.g., missing primary)
- **THEN** `metadata.artDirectorOutput.intended_palette` SHALL NOT be set
- **AND** the generation SHALL NOT be blocked
- **AND** the brand profiler SHALL receive `intendedPalette = null` at approval time

### Requirement: ColorUsage and suggested_colors — different purposes

The existing `suggested_colors` (array of hex values for design inspiration) and the new `intended_palette` (structured semantic roles) serve different purposes. Both SHALL coexist in `metadata.artDirectorOutput`:

- `suggested_colors` — loosely ordered design inspiration for the brand profiler's semantic analysis
- `intended_palette` — structured declaration with defined roles (primary, accent, background, support)

The normalizer SHALL extract both independently from the IA's JSON response.

#### Scenario: Both fields coexist

- **WHEN** inspecting `metadata.artDirectorOutput`
- **THEN** `suggested_colors` SHALL be present (existing behavior)
- **AND** `intended_palette` SHALL be present as a separate field (new)
- **AND** `color_usage` SHALL be present as a separate field (new)
- **AND** they SHALL NOT be derived from each other
