# Plan 04: Approval Route — intendedPalette Wiring

## Objective
Update the visual signature approval route to extract `intended_palette` from the signature metadata and `previousBrandColors` from the last synced profile, passing both to the Brand Profiler.

## Tasks Executed

### Task 1: intendedPalette Extraction
- After loading the signature, reads `signature.metadata.artDirectorOutput?.intended_palette`
- Re-applies `normalizeIntendedPalette()` on extracted value (idempotent safety)
- If missing or normalization returns null → `intendedPalette = null`

### Task 2: previousBrandColors Loading
- Queries last synced brand profile for the store
- Checks `manual_color_override.enabled` — only loads `brand_colors_chosen` when true
- If false or no profile exists → `previousBrandColors = []`

### Task 3: Pass to Profiler
- `intendedPalette` and `previousBrandColors` passed as `BrandProfilerInput` to `brandProfiler.generate()`

### Task 4: Profiler Failure Isolation
- Profiler call wrapped in try-catch
- If profiler returns `status = 'failed'` or throws: error logged server-side, signature remains `active`, no store sync, previous synced profile unchanged
- Response returns success (signature approved regardless of profiler outcome)

### Task 5: identity_state Always Set
- `stores.identity_state = 'visual_signature'` set regardless of profiler outcome

## Quality Gate
- `npm run typecheck` PASSES with zero errors
- intendedPalette extraction uses normalizeIntendedPalette (idempotent safety)
- previousBrandColors loaded only with manual_color_override proof
- Profiler failure is fully isolated from signature approval
- identity_state always set regardless of profiler outcome
- No new API routes — only modification to existing approve handler
