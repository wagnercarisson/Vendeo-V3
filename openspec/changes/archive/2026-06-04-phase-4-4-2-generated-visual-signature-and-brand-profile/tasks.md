## 1. Database Migrations

- [x] 1.1 Create migration `20260603000001_alter_store_brand_profiles_source.sql` — alter CHECK constraint to include `without_logo`, add columns `visual_signature_id`, `inferred_primary_color`, `inferred_accent_color`, `identity_art_director_output`
- [x] 1.2 Create migration `20260603000002_add_store_logo_status.sql` — add `logo_status` TEXT and `visual_signature_attempts` INTEGER NOT NULL DEFAULT 0 to `stores` table
- [x] 1.3 Create migration `20260603000003_create_generation_events.sql` — create `generation_events` table with all columns, CHECK constraints, and indexes
- [x] 1.4 Apply all migrations via `supabase db push` (manual infra step)

## 2. Prompts

- [x] 2.1 Create `prompts/store-identity-art-director.md` — dedicated prompt for visual signature creation for stores without logo. Separate from campaign concerns. Includes instructions for rejection context, quality criteria, and creative metadata output format.
- [x] 2.2 Create `prompts/store-brand-profiler.md` — dedicated prompt for brand profile inference from store cadastral data + approved identity art director outputs (creative_description, suggested_colors, visual_direction, elements_used). No heavy image analysis, but not blind to approved signature.
- [x] 2.3 Verify existing prompts (`campaign-image-director.md`, `store-brand-director-with-logo.md`) remain unchanged — campaign director never creates visual identity

## 3. Types and Constants

- [x] 3.1 Add `logo_status` type (`'uploaded' | 'generated' | 'explicit_none' | 'failed' | 'exhausted' | null`) to types
- [x] 3.2 Add `VisualSignatureWithoutLogoInput` and `VisualSignatureArtDirectorOutput` types
- [x] 3.3 Add `BrandProfilerInput` and `BrandProfilerWithoutLogoResult` types (extending existing BrandDirectorResult)
- [x] 3.4 Add `GenerationEventRecord` type and `GenerationEventInsert` type
- [x] 3.5 Extend `Store` interface with `logo_status` and `visual_signature_attempts`

## 4. Store Identity Art Director Service

- [x] 4.1 Implement `StoreIdentityArtDirectorService.generate()` — sends store data + rejection context to LLM with prompt `store-identity-art-director.md`, returns visual signature PNG + reference card + creative metadata
- [x] 4.2 Implement cascade: attempt 1 → if timeout/error → retry with simplified prompt → if retry fails → controlled error (no typographic fallback)
- [x] 4.3 Integrate with existing image generation progress/timeout/retry patterns
- [x] 4.4 Implement visual validation: valid PNG, store name present, reject circle+initials (basic + LLM semantic review)
- [x] 4.5 Upload generated assets to bucket `visual-signatures/{store_id}/{uuid}.png` (+ `{uuid}_reference.png` for reference card)
- [x] 4.6 Persist signature in `store_visual_signatures` with status `draft` (pending approval)

## 5. Store Brand Profiler (Without Logo) Service

- [x] 5.1 Implement `BrandProfilerWithoutLogoService.generate()` — sends store data + identity art director outputs to LLM with prompt `store-brand-profiler.md`, returns structured brand profile
- [x] 5.2 Persist brand profile with `source = 'without_logo'`, `status = 'synced'`, `active_logo_asset_id = null`
- [x] 5.3 Mark previous synced profile as `outdated` ONLY when new profile succeeds (status = synced)
- [x] 5.4 On failure: persist profile as status = `failed`, keep previous synced profile unchanged

## 6. API Endpoints

- [x] 6.1 Implement `POST /api/store/[id]/visual-signature/generate-without-logo` — generates 1 visual signature via Store Identity Art Director, increments `visual_signature_attempts`, returns asset + metadata
- [x] 6.2 Implement `POST /api/store/[id]/visual-signature/reject` — archives current asset with metadata (rejected, reason, attempt_number), updates generation_events with rejected=true, does NOT increment attempts. If attempts >= 3, returns all 3 signatures for re-evaluation.
- [x] 6.3 Implement `POST /api/store/[id]/visual-signature/approve` — sets asset to active, archives previous, updates generation_events with approved=true, triggers brand profiler, updates store (logo_status=generated, attempts=0)
- [x] 6.4 Implement `POST /api/store/[id]/brand-profile/generate-without-logo` — generates brand profile from store data + identity art director outputs, persists with source=without_logo, marks previous outdated only on success
- [x] 6.5 Implement `PATCH /api/store/[id]/logo-status` — updates logo_status and visual_signature_attempts on stores
- [x] 6.6 Extend `PATCH /api/store/[id]` to accept logo_status and visual_signature_attempts

## 7. Generation Events / Metrics Service

- [x] 7.1 Implement `insertGenerationEvent()` — best-effort insert into generation_events table, never blocks generation
- [x] 7.2 Implement `updateGenerationEventDecision()` — updates approved/rejected on existing event by asset_id + attempt_number
- [x] 7.3 Integrate event creation into visual signature generation (type = `visual_signature`, has_logo = false)
- [ ] 7.4 Integrate event creation into brand profile generation (type = `brand_profile_without_logo` / `brand_profile_with_logo`) — not yet recorded in approve route or brand-profile/generate-without-logo route
- [x] 7.5 Integrate decision update into approval and rejection flows

## 8. UI — Store Identity Form (Step 2: Logo e Cores)

- [x] 8.1 Add explicit "Enviar logotipo" button below drag-and-drop area, triggering same file input
- [x] 8.2 Add "Não tenho logo" button (outline style, Sparkles icon) with tooltip explaining visual signature + brand profile generation
- [x] 8.3 Add "Continuar sem logo" discrete link (text-text-muted, no border, no background) with tooltip explaining store will use name + colors only
- [x] 8.4 Wire "Não tenho logo" button to open the visual signature generation & approval modal
- [x] 8.5 Wire "Continuar sem logo" to set logo_status = explicit_none, update preview to show name + colors
- [x] 8.6 After signature approval: update preview to show approved signature, pre-fill primary and accent colors from brand profile
- [x] 8.7 After approval: allow lojista to edit colors manually before saving (no conflict warning)

## 9. UI — Visual Signature Approval Modal

- [x] 9.1 Create approval modal component showing generated signature preview (~400x400px) + attempt indicator (1/3, 2/3, 3/3)
- [x] 9.2 Implement "Aprovar" button → triggers approval flow (signature active, brand profiler, colors pre-filled, return to Logo e Cores)
- [x] 9.3 Implement "Não gostei, gerar outra versão" button → archives current, shows optional feedback field, triggers next generation
- [x] 9.4 At attempt 3/3: disable "Não gostei, gerar outra versão" button with tooltip "Limite de 3 versões atingido"
- [x] 9.5 At attempt 3/3: display all 3 generated signatures for re-evaluation, allow approving any or continue without logo
- [x] 9.6 Implement "Continuar sem logo" at exhausted state → logo_status = explicit_none, attempts = 3, signatures remain archived for future re-evaluation
- [x] 9.7 Handle modal close without decision → signature remains as draft, resume on next visit
- [x] 9.8 Sequential generation: exactly 1 per invocation, wait for decision before next

## 10. UI — Visual Signature Section

- [x] 10.1 Update `StoreVisualSignatureSection` to reflect all logo_status states: null, generated, explicit_none, failed, exhausted
- [x] 10.2 For exhausted state: show limit message with re-evaluation option (re-open approval modal with 3 archived signatures)
- [x] 10.3 For explicit_none + attempts=3: show "Continuou sem logo após 3 tentativas" with option to re-evaluate archived signatures

## 11. Identity Resolution Update

- [x] 11.1 Update `resolveStoreIdentity` to handle new resolution order: brand assets > visual signature + without_logo profile > without_logo profile (name only) > name fallback
- [x] 11.2 Ensure logo_status informs UI behavior but does not block resolution chain
- [x] 11.3 Pass brand profile even when resolved identity is name-only (no logo, no signature)

## 12. Error Handling

- [x] 12.1 Implement controlled error for technical failure (timeout/model/connection): logo_status = failed, message about temporary instability, "Tentar novamente" button (no attempt increment)
- [x] 12.2 Ensure no typographic fallback "bonitinho", monogram, initials, or fake logo on failure
- [x] 12.3 Empty/null signature means campaign rendering uses store name in simple typography with saved colors

## 13. Verification

- [x] 13.1 `npx next build` — type check passes
- [x] 13.2 Lint — no issues
- [x] 13.3 Manual test: "Não tenho logo" flow generates signature, shows approval modal
- [x] 13.4 Manual test: approve signature → returns to Logo e Cores with signature preview + pre-filled colors
- [x] 13.5 Manual test: reject and regenerate up to 3 versions, button disables at 3/3
- [x] 13.6 Manual test: exhausted state shows all 3 signatures for re-evaluation
- [x] 13.7 Manual test: continue without logo at exhausted state → explicit_none + attempts=3
- [ ] 13.8 Manual test: technical error shows controlled message, no fake fallback
- [x] 13.9 Manual test: generation_events created and updated on approval/rejection
- [ ] 13.10 Manual test: brand profile without logo created after approval, previous preserved on failure
