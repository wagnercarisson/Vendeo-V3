---
status: diagnosed
trigger: "Investigate why Visual Signature restore is not detecting drift when critical store fields (name, segment) have been changed"
created: 2026-06-19T17:00:00Z
updated: 2026-06-19T17:00:00Z
---

## Current Focus

hypothesis: "The retry path in generate-without-logo/route.ts causes artDirectorOutput to lose content_used in metadata, making validateDrift return early with missing_metadata before it can check name/segment drift"
test: "Trace the retry path execution — second metadata update at line 281-291 uses stale result.signature.metadata (from persistSignature) which has artDirectorOutput without content_used, overwriting the first update's correct metadata"
expecting: "The final metadata in DB has artDirectorOutput without content_used for retry-path signatures"
next_action: "Verify by reading the generate-without-logo route lines 170-291 to confirm the double-update bug"

## Symptoms

expected: "When store name or segment changes, the VS restore flow should detect drift (critical_drift with fields=['name','segment']) and either warn the user or block restore"
actual: "VS restore does not detect drift when name/segment change. The restore may proceed without warning, or the metadata shows missing_metadata instead of critical_drift"
errors: "No explicit error — drift just isn't reported as critical_drift"
reproduction: "1. Generate a VS, 2. Change store name or segment, 3. Try to restore the archived VS"
started: "Likely since the generate-without-logo route was implemented with the two-update metadata pattern"

## Eliminated

- hypothesis: "The restore route doesn't call validateDrift"
  evidence: "restore/route.ts lines 70-80 DO call validateDrift with current store data, input_snapshot from metadata, and content_used from artDirectorOutput"
  timestamp: "2026-06-19T17:00:00Z"

- hypothesis: "The approve route bypasses drift"
  evidence: "Approve route does NOT call validateDrift, but it's a different flow (approving a freshly generated VS, not restoring an old one). The user specifically said 'restore' not 'approve'."
  timestamp: "2026-06-19T17:00:00Z"

- hypothesis: "The GET listing route doesn't check drift"
  evidence: "GET visual-signature/route.ts lines 53-86 DO compute restore_eligibility using validateDrift for each signature"
  timestamp: "2026-06-19T17:00:00Z"

- hypothesis: "The frontend ignores the drift response"
  evidence: "visual-signature-history-modal.tsx lines 83-93 DO check data.success === false && data.drift and show appropriate error messages"
  timestamp: "2026-06-19T17:00:00Z"

- hypothesis: "input_snapshot is not stored in metadata"
  evidence: "generate-without-logo/route.ts lines 268-291 DO update metadata with input_snapshot after generation. Both success and retry paths add it."
  timestamp: "2026-06-19T17:00:00Z"

- hypothesis: "The validateDrift function doesn't check name/segment"
  evidence: "drift-validator.ts lines 48-54 DO check snapshot.name !== current.name and snapshot.segment !== current.segment unconditionally"
  timestamp: "2026-06-19T17:00:00Z"

## Evidence

- timestamp: "2026-06-19T17:00:00Z"
  checked: "restore/route.ts lines 66-92 — the drift check in the restore API"
  found: "Restore route correctly extracts metadata.input_snapshot (line 67), constructs artDirectorOutput (line 68), and calls validateDrift with currentStoreData (lines 70-80). If has_drift is true, returns { success: false, drift: { critical: true, fields: [...], reason: ... } } (lines 82-92). The logic LOOKS correct."
  implication: "If drift is not detected, it must be because validateDrift returns has_drift: false or because content_used is null causing early return with missing_metadata."

- timestamp: "2026-06-19T17:00:00Z"
  checked: "drift-validator.ts lines 33-41 — the early return condition in validateDrift"
  found: "validateDrift returns missing_metadata (has_drift: true) if input.input_snapshot OR input.content_used is falsy. This early return happens BEFORE the name/segment comparison on lines 48-54. If content_used is null, name/segment drift is never checked."
  implication: "Missing content_used prevents name/segment drift from being detected — the function returns has_drift: true but with fields: [] and reason: 'missing_metadata', not 'critical_drift'."

- timestamp: "2026-06-19T17:00:00Z"
  checked: "identity-art-director.ts lines 86-148 — how artDirectorOutput is stored in metadata during initial persist"
  found: "persistSignature is called at line 135 with metadata containing artDirectorOutput (type VisualSignatureArtDirectorOutput, defined at types.ts lines 143-148). This type has NO content_used field — it only has creative_description, suggested_colors, visual_direction, elements_used. The VisualSignatureMetadataArtDirectorOutput type (with content_used) is stored separately as metadataArtDirectorOutput in the return value (line 150-155)."
  implication: "The INITIAL persist always stores artDirectorOutput WITHOUT content_used. The content_used is only added later via a separate UPDATE in generate-without-logo/route.ts."

- timestamp: "2026-06-19T17:00:00Z"
  checked: "generate-without-logo/route.ts lines 281-291 — the metadata update in the success path"
  found: "In the success path, the update at lines 281-291 spreads result.signature.metadata (which has artDirectorOutput without content_used), then overrides artDirectorOutput with result.metadataArtDirectorOutput (which HAS content_used). This is correct — the final metadata has artDirectorOutput with content_used."
  implication: "Signatures from the main success path should have correct metadata with content_used."

- timestamp: "2026-06-19T17:00:00Z"
  checked: "generate-without-logo/route.ts lines 201-254 — retry path metadata handling (ATTEMPT 2)"
  found: "CRITICAL BUG: In the retry path, persistSignature is called at lines 202-214 (stores artDirectorOutput without content_used). FIRST update at lines 229-247 correctly adds input_snapshot and overrides artDirectorOutput with content_used. BUT then at line 249, result is set using the SAME signature object from persistSignature (with STALE metadata, before the first update). metadataArtDirectorOutput is explicitly set to null at line 252. The code then falls into the 'if (result)' block at line 265 where a SECOND update at lines 281-291 runs, using result.signature.metadata (STALE — has artDirectorOutput without content_used), adding input_snapshot but NOT overriding artDirectorOutput (because metadataArtDirectorOutput is null). This OVERWRITES the first update's correct metadata."
  implication: "For retry-path signatures, the final metadata has artDirectorOutput WITHOUT content_used. This causes validateDrift to return missing_metadata (early return) before checking name/segment. The specific fields that changed are never identified."

- timestamp: "2026-06-19T17:00:00Z"
  checked: "visual-signature/route.ts (GET) lines 41-86 — how restore eligibility is computed in the listing"
  found: "The GET route checks 'content_used' in artDirectorOutput (line 53). If missing, it goes to the else branch with reason: 'missing_metadata' and can_restore: false. If content_used exists, it calls validateDrift which correctly checks name/segment."
  implication: "For retry-path signatures, the GET route shows can_restore: false with reason: 'missing_metadata' — so the UI shows 'Restauro indisponível' with tooltip about old signatures. For main-path signatures, drift is correctly detected as critical_drift with specific fields."

- timestamp: "2026-06-19T17:00:00Z"
  checked: "store-identity-form.tsx lines 839-855 — how drift is checked during store data save (logo drift)"
  found: "The store-identity-form uses a SEPARATE drift detection system (use-drift-detection.ts + drift.ts computeDriftStatus) that checks logo-related drift (segment, subsegment, tone_of_voice, name, brand_color, accent_color). This is unrelated to VS restore drift detection."
  implication: "There are TWO independent drift systems: (1) logo drift via drift.ts computeDriftStatus, (2) VS restore drift via drift-validator.ts validateDrift. The bug is in system (2)."

## Resolution

root_cause: "[FOUND] In generate-without-logo/route.ts, the retry path (ATTEMPT 2, lines 170-259) has a double-update bug: the first update (lines 229-247) correctly sets metadata with both input_snapshot and artDirectorOutput (with content_used), but then result is set with stale metadata from persistSignature (line 249, using the same `signature` object). The second update (lines 281-291, outside the retry block, shared with success path) uses `result.signature.metadata` — which is STALE and has artDirectorOutput without content_used — and since `result.metadataArtDirectorOutput` is explicitly `null` (line 252), the artDirectorOutput is NOT overridden. This overwrites the first update's correct metadata with metadata that has artDirectorOutput WITHOUT content_used. When validateDrift is later called, content_used is null, causing an early return with missing_metadata before name/segment drift is ever checked."

fix: "DO NOT apply fix yet — analysis pending verification. Options: (1) Skip the second update for the retry path by restructuring the code, (2) Set result.metadataArtDirectorOutput to the correct value in the retry path instead of null, (3) Fetch fresh metadata from DB before the second update, (4) Include input_snapshot and proper artDirectorOutput in the initial persistSignature call so the second update is benign."
verification: ""
files_changed:
  - "src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts"

## Double-Update Sequence (Retry Path)

Step 1: persistSignature (line 202-214)
  metadata = { generation_tier, provider, model, elapsedMs, artDirectorOutput(no content_used) }

Step 2: FIRST UPDATE (lines 229-247)
  metadata = { ...old, input_snapshot: {...}, artDirectorOutput: { visual_direction, content_used: {...} } }
  ✓ Correct — content_used present in artDirectorOutput

Step 3: result = { signature: staleSignature, metadataArtDirectorOutput: null } (lines 249-254)
  signature.metadata = STALE (from step 1, before step 2)

Step 4: Falls through to `if (result)` at line 265

Step 5: SECOND UPDATE (lines 281-291), using STALE metadata:
  metadata = { ...staleMetadata(no input_snapshot, artDirectorOutput without content_used), input_snapshot: {...} }
  Since metadataArtDirectorOutput is null: ...(null ? {...} : {}) → {}
  → artDirectorOutput NOT overridden → remains WITHOUT content_used
  ✗ BUG: content_used lost from final metadata
