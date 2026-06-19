# Plan 02: Core Backend — Generate Metadata, Approve Sync, GET History & DELETE

## Objective
Implement the core backend changes: persist content_used + input_snapshot on generation, fix approve to set identity_state='visual_signature', evolve the GET endpoint to serve as history with approved_at, art_direction, and restore_eligibility, and add DELETE handler for safe signature removal.

## Tasks Executed

### Task 1: StoreIdentityArtDirectorService — Real JSON from AI response
- Modified `identity-art-director.ts` to parse JSON from `response.output.message` content
- Extracts `VisualSignatureMetadataArtDirectorOutput` with visual_direction, content_used, visual_elements, intended_palette, color_usage
- Falls back to conservative inference (all content_used fields=true) when JSON parsing fails
- Updated `VisualSignatureGenerationResult` to include `metadataArtDirectorOutput`
- Extended `CascadeResult` with optional `aiResponseMessage` field
- Modified `AiImageGenerator` to capture text output from Responses API response

### Task 2: Generate handler — Metadata enrichment
- Updated generate-without-logo route to capture `input_snapshot` (10 store fields) after generation
- Stores `input_snapshot` in `metadata.input_snapshot`
- Stores `artDirectorOutput` from AI response in `metadata.artDirectorOutput`
- Retry path uses conservative content_used (all fields true)

### Task 3: Approve handler — identity_state sync + reconcileProfiles
- Updated approve route to set `identity_state='visual_signature'` and `logo_status='generated'`
- Uses `IDENTITY_TO_LOGO_STATUS` mapping for consistency
- Replaced inline profile outdated logic with `reconcileProfiles()` call (centralized)

### Task 4: GET handler — History response
- Evolved GET visual-signature route to serve as history endpoint
- Response includes: approved_at (active=updated_at, archived=null), art_direction from metadata, restore_eligibility computed via shared DriftValidator
- Missing metadata returns reason='missing_metadata'

### Task 5: DELETE handler — Signature removal
- Added DELETE handler to visual-signature/route.ts
- Archives active signature, transitions identity_state to text_only, logo_status to explicit_none
- Preserves profile as synced fallback via reconcileProfiles(preserveCurrentAsFallback=true)
- Returns 404 with Portuguese error if no active signature

## Quality Gate
- `npm run typecheck` PASSES with zero errors
- All changes consistent with CONTEXT.md decisions D01-D04
- DriftValidator shared across GET and (future) POST restore
