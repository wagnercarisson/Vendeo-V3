## 1. Types, Constants & Data Structures

- [ ] 1.1 Add `IDENTITY_TO_LOGO_STATUS` mapping constant in `src/lib/brand-assets/types.ts` or dedicated constants file
- [ ] 1.2 Update `BrandProfileRecord` — add `inferred_accent_color` / `inferred_primary_color` if missing; clarify `active_logo_asset_id` doc as provenance (never nulled after set)
- [ ] 1.3 Add `LogoHistoryItem` and `LogoRestoreResponse` types in `src/lib/brand-assets/types.ts`
- [ ] 1.4 Add `DriftStatus` type (`'none' | 'drift' | null`) for history response

## 2. POST /api/store/[id]/logo — Reorder & Compensated Transition

- [ ] 2.1 Move BrandDirector execution before any profile mutation: upload + variant generation complete, archive previous active assets FIRST (prevents unique index violation), capture `input_snapshot`, then execute BrandDirector
- [ ] 2.2 Restructure success path: within compensated block → mark previous synced as outdated → insert new profile as synced → if insert fails, restore previous to synced
- [ ] 2.3 Restructure failure path: preserve previous synced profile as fallback, insert new profile as `failed` with `metadata.attempt_snapshot`
- [ ] 2.4 Populate `metadata.input_snapshot` on synced profiles with 6 store fields (segment, subsegment, tone_of_voice, name, brand_color, accent_color)
- [ ] 2.5 Set `identity_state = 'logo'` and `logo_status = 'uploaded'` via IDENTITY_TO_LOGO_STATUS mapping on stores after profile creation
- [ ] 2.6 Remove `brand_colors_chosen: analysis.logo_colors_detected` — do NOT populate brand_colors_chosen from detected colors

## 3. DELETE /api/store/[id]/logo — Soft Delete Preserving Profile

- [ ] 3.1 Change asset archiving: keep existing `assets → status = 'archived'`
- [ ] 3.2 Remove profile archiving: do NOT change profile status (leave as `synced`)
- [ ] 3.3 Preserve `active_logo_asset_id` on the profile (do NOT null it)
- [ ] 3.4 Update stores: set `identity_state = 'text_only'`, `logo_status = 'explicit_none'` in single UPDATE

## 4. GET /api/store/[id]/logo/history — History Endpoint

- [ ] 4.1 Create `src/app/api/store/[id]/logo/history/route.ts` with GET handler
- [ ] 4.2 Query `store_brand_assets` (variant_type='original', status='archived') LEFT JOIN `store_brand_profiles` (via active_logo_asset_id FK)
- [ ] 4.3 Compute `drift_status` per item: compare profile's `input_snapshot` (6 fields) against current store values; return `'none'`, `'drift'`, or `null`
- [ ] 4.4 Return ordered array with `{ asset, profile, drift_status, input_snapshot, version, created_at }`

## 5. POST /api/store/[id]/logo/restore — Restore Endpoint

- [ ] 5.1 Create `src/app/api/store/[id]/logo/restore/route.ts` with POST handler
- [ ] 5.2 Accept `{ asset_id }`, validate asset belongs to store_id and is archived
- [ ] 5.3 Archive any currently active assets (prevent unique index violation)
- [ ] 5.4 Load associated profile via `active_logo_asset_id`; extract `metadata.input_snapshot` for drift validation
- [ ] 5.5 Implement no-drift path: if profile already active synced → only re-activate assets; else → mark current as outdated, re-activate chosen profile to synced, re-activate assets
- [ ] 5.6 Implement drift path: execute BrandDirector with restored logo + current store data, mark current as outdated, create new profile (explicitando active_logo_asset_id, input_snapshot, brand_colors_chosen isolado, safe_color_tokens), re-activate assets
- [ ] 5.7 Handle BrandDirector failure on drift restore: preserve fallback profile, insert failed profile with attempt_snapshot, re-activate assets anyway
- [ ] 5.8 Update stores: `identity_state = 'logo'`, `logo_status = 'uploaded'` on success

## 6. UI Step 2 — Logo Active & Remove States

- [ ] 6.1 Add `identity_state` to store data flow (ensure component reads it from loaded store or resolves it)
- [ ] 6.2 Implement `logo` active with analysis OK state: show logo preview + "Remover logotipo" button only; hide drop zone, upload, assinatura, continuar sem logo, logotipos anteriores
- [ ] 6.3 Implement `logo` active with analysis failed state: show logo preview + warning "Análise de direção falhou, usando direção anterior" + "Remover logotipo" only
- [ ] 6.4 Implement post-remove state (`identity_state = text_only` with profile): show drop zone, "Enviar logotipo", "Criar assinatura visual"; hide "Continuar sem logo"; show "Logotipos anteriores" if archived exist
- [ ] 6.5 Wire "Remover logotipo" button to DELETE /api/store/[id]/logo; on success update local state per UX decision matrix

## 7. UI — Restore Modal

- [ ] 7.1 Create `src/components/flow/logo-restore-modal.tsx` with modal overlay and version list
- [ ] 7.2 Fetch history from GET /api/store/[id]/logo/history on modal open; handle loading, empty, error states
- [ ] 7.3 Render version cards: logo thumbnail, date, version label, visual style, palette, drift badge ("✓ Dados inalterados" / "⚠ Requer realinhamento"), action button
- [ ] 7.4 Wire "Restaurar" / "Restaurar c/ realinh" button to POST /api/store/[id]/logo/restore with asset_id
- [ ] 7.5 On restore success: close modal, update UI to logo state (preview + Remover), update local identity_state
- [ ] 7.6 Add "Logotipos anteriores" link to store-identity-form.tsx, visible per UX decision matrix

## 8. Verification

- [ ] 8.1 Manual test: POST /logo — verify BrandDirector runs before profile mutation, identity_state='logo'
- [ ] 8.2 Manual test: POST /logo with BrandDirector failure — verify profile remains synced as fallback, failed profile with attempt_snapshot
- [ ] 8.3 Manual test: DELETE /logo — verify profile stays synced, active_logo_asset_id preserved, identity_state='text_only'
- [ ] 8.4 Manual test: GET /logo/history — verify drift_status computed per item
- [ ] 8.5 Manual test: POST /logo/restore without drift — verify assets re-activated, profile re-activated
- [ ] 8.6 Manual test: POST /logo/restore with drift — verify BrandDirector executed, new profile created
- [ ] 8.7 Manual test: POST /logo/restore when profile already synced (post-remove) — verify not marked outdated
- [ ] 8.8 Manual test: UI flow — logo active → remove → re-upload → history → restore → verify visual states per UX matrix
- [ ] 8.9 Run `npm run lint` and `npm run typecheck` — zero errors
- [ ] 8.10 Run `npm run build` — zero errors
