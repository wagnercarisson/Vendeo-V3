> **Purpose**: Delta spec for creative-direction-context — corrects the color resolution priority for campaign rendering. `brand_colors_chosen` is no longer the primary source; `safe_color_tokens` takes precedence. This ensures the campaign director receives the palette that the marketing director decided as final, not the user's UI choice.

## MODIFIED Requirements

### Requirement: Brand profile consumed as creative brief context

The system SHALL use the updated color resolution priority when assembling the CreativeBrief during prompt assembly. The priority SHALL be:

- **Color resolution priority (updated)**:
  1. `safe_color_tokens.primary` — the AI-decided final palette (highest priority)
  2. `inferred_primary_color` — the AI's raw inference
  3. `store.brand_color` — denormalized fallback on stores table
  4. `SEGMENT_COLOR_FALLBACK[segment]` — segment-based fallback

- **Previous behavior (overridden)**: `brand_colors_chosen` was the primary source. It is now used ONLY for UI pre-fill in the color pickers and as input signal to the inference service. It SHALL NOT be the source for campaign rendering color resolution.

The `brandColors` variable injected into the Campaign Director prompt SHALL use `safe_color_tokens` as the source when available:

```typescript
// Resolved brand color for campaign context
let brandColor: string;
const profile = getActiveProfile(store.id);

if (profile?.safe_color_tokens?.primary && isValidHex(profile.safe_color_tokens.primary)) {
  brandColor = profile.safe_color_tokens.primary;
} else if (profile?.inferred_primary_color && isValidHex(profile.inferred_primary_color)) {
  brandColor = profile.inferred_primary_color;
} else if (store.brand_color && isValidHex(store.brand_color)) {
  brandColor = store.brand_color;
} else {
  brandColor = getDefaultBrandColor(store.segment);
}
```

#### Scenario: Campaign uses safe_color_tokens color

- **WHEN** a campaign is generated for a store with a synced brand profile
- **AND** the profile has `safe_color_tokens.primary = "#4A6FA5"`
- **THEN** the `brandColors` in the prompt SHALL use `#4A6FA5`
- **AND** `brand_colors_chosen` SHALL NOT override this value

#### Scenario: Campaign falls back through chain

- **WHEN** a campaign is generated for a store with a profile that has no `safe_color_tokens.primary`
- **AND** the profile has `inferred_primary_color = "#22C55E"`
- **THEN** the `brandColors` in the prompt SHALL use `#22C55E`

#### Scenario: No brand profile uses store.brand_color or segment fallback

- **WHEN** a campaign is generated for a store with no synced brand profile
- **AND** `store.brand_color` is set to `#3B82F6`
- **THEN** the `brandColors` in the prompt SHALL use `#3B82F6`
