# Plan 02: Normalizers & Art Director Update

## Objective
Implement all normalization utilities for the intended palette and vision adjudication, then integrate them into the Store Identity Art Director normalizer.

## Tasks Executed

### Task 1: normalizeIntendedPalette
- Implements validation: each color must be valid 6-char hex (`/^#[0-9A-Fa-f]{6}$/`)
- Converts validated hex to uppercase `#RRGGBB`
- Support array filters out invalid entries
- Returns `null` if primary, accent, or background missing/invalid
- Idempotent: calling on already-normalized input produces identical result
- Handles null/undefined/empty input gracefully

### Task 2: intendedToResolved
- Maps `IntendedPalette` to `ResolvedPalette`
- `secondary = supportResolved[0] ?? primary`
- Single-line pure function, no side effects

### Task 3: composeSupport, resolveRole, RawVisionAdjudicationSchema, VisionAdjudicationError
- `composeSupport(original, contestedIndices, corrections)` — applies corrections only at contested indices, preserves confirmed supports
- `resolveRole(role, fallback, visionValue, isContested)` — returns fallback for confirmed roles (immutable), throws `VisionAdjudicationError('no_choice')` for contested+null, returns visionValue for contested+set
- `RawVisionAdjudicationSchema` — Zod schema validating all keys present, hex format, no duplicate support indices, reason is string
- `VisionAdjudicationError` — custom error class extending Error with `code` field

### Task 4: normalizeAdjudication
- Validates `RawVisionAdjudication` contract via schema
- Applies `resolveRole` per role (primary, accent, background)
- Validates cobertura total for support — every contested index must have matching correction
- Filters invalid support indices (< 0 or >= length)
- Revalidates HEX livre against probe — ∆E ≤ 18 accepted, > 18 throws `hex_outside_observed_colors`
- Duplicate indices throw `invalid_json`

### Task 5: identity-art-director.ts Normalizer Update
- Imports `normalizeIntendedPalette` from types
- Applies normalization to `parsed.intended_palette` instead of raw storage
- Validates `parsed.color_usage` structure before persisting
- Invalid color data → fields omitted (undefined), generation proceeds normally (non-blocking)

## Quality Gate
- `npm run typecheck` PASSES with zero errors
- normalizeIntendedPalette is idempotent — calling twice produces identical result
- intendedToResolved correctly derives secondary from supportResolved[0]
- composeSupport mutates only contested indices, preserves confirmed ones
- resolveRole enforces immutability of confirmed roles
- normalizeAdjudication validates all RawVisionAdjudication contract rules
- HEX livre revalidated against probe — ∆E ≤ 18 accepted, > 18 rejected
- Art Director normalizer does NOT block generation on invalid color data
