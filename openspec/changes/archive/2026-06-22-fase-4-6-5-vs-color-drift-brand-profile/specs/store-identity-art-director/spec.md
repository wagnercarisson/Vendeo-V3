> **Delta spec for fase 4.6.5 — VS Color Drift & Brand Profile Alignment**
> 
> Referenced canonical spec: `openspec/specs/store-identity-art-director/spec.md`

## ADDED Requirements

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
