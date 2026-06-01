## 1. Database & Storage Setup

- [ ] 1.1 Create migration file `supabase/migrations/*_create_store_visual_signatures.sql` with all columns, CHECK constraints (`type`, `status`, `generation_mode`), partial unique index `WHERE status = 'active'`, and `updated_at` trigger
- [ ] 1.2 Create `visual-signatures` bucket in Supabase Storage with public read policy
- [ ] 1.3 Configure RLS grants/permissions on `store_visual_signatures` table consistent with existing project patterns
- [ ] 1.4 Create `src/lib/visual-signature/types.ts` with TypeScript types matching the database schema

## 2. Visual Signature Generator Service

- [ ] 2.1 Create `VisualSignatureGenerator` interface in `src/lib/visual-signature/generator.ts` abstracting the generation approach
- [ ] 2.2 Create prompt `prompts/visual-signature-generator.md` for AI description (Abordagem A)
- [ ] 2.3 Implement `AiDescriptionGenerator` that calls AI, parses JSON response, and returns render params
- [ ] 2.4 Implement programmatic SVG renderer that converts design params to SVG then PNG
- [ ] 2.5 Implement upload to Supabase Storage and persistence in `store_visual_signatures` table
- [ ] 2.6 Implement the "Criar Agora" flow (generate 3 variations, return as drafts)
- [ ] 2.7 Implement the "Deixar o Vendeo Criar" flow (best-effort with timeout, fallback on failure)

## 3. Fallback Typographic Generator

- [ ] 3.1 Implement `TypographicFallbackGenerator` in `src/lib/visual-signature/typographic-fallback.ts`
- [ ] 3.2 Build SVG template for initials circle (brand color bg + white text) + store name below
- [ ] 3.3 Convert SVG to PNG (investigate `@img/sharp` or `resvg-js` — avoid native deps)
- [ ] 3.4 Upload fallback PNG to Storage and persist as `fallback_typographic` with status `active`

## 4. API / Server Actions

- [ ] 4.1 Create server action to generate 3 visual signature variations (return as drafts)
- [ ] 4.2 Create server action to generate 1 automatic signature with best-effort + fallback on failure
- [ ] 4.3 Create server action to activate a chosen signature (set status to `active`, archive previous)
- [ ] 4.4 Create server action to list active signature and available drafts for a store
- [ ] 4.5 Validate `store_id`, `status` transitions, and permissions on all server actions
- [ ] 4.6 Ensure the activate action archives the previous active signature atomically

## 5. Store Identity Extension

- [ ] 5.1 Extend `resolveStoreIdentity()` in `src/lib/store.ts` to check active visual signature when `logo_url` is null
- [ ] 5.2 Extend `StoreIdentitySnapshot` type to include `visualSignatureUrl` and `visualSignatureType`
- [ ] 5.3 Add `getActiveVisualSignature(storeId)` query helper

## 6. UI — Modal & Picker

- [ ] 6.1 Create `VisualSignaturePicker` component showing selectable variation cards
- [ ] 6.2 Create visual signature modal (reusable for post-save and manage flows)
- [ ] 6.3 Integrate modal into `store-identity-form.tsx` — trigger after save when no logo
- [ ] 6.4 Add "Criar / Alterar Assinatura Visual" section to the store identity page
- [ ] 6.5 Implement confirmation dialog for signature replacement

## 7. Quality Gate

- [ ] 7.1 Generate first visual signature prototype and evaluate against the "simple publishable brand mark" standard
- [ ] 7.2 If quality is insufficient, reassess approach before integrating with campaign pipeline (postpone 8.x tasks)

## 8. Campaign Pipeline Integration

- [ ] 8.1 Extend `CampaignRenderParams` with `visualSignatureUrl` and `visualSignatureType`
- [ ] 8.2 Load visual signature asset in the post-generation/render flow and apply it to the store identity zone — do NOT inject into the AI image generation prompt
- [ ] 8.3 Update `CampaignRenderer` store identity zone to handle visual signature rendering
- [ ] 8.4 Update `CAMPAIGN_VISUAL_SYSTEM.md` store identity section with new priority rules

## 9. Validation & Testing

- [ ] 9.1 Manual visual test: generate 2 campaigns for same store without logo, verify same signature appears
- [ ] 9.2 Manual visual test: upload logo, verify logo takes priority over signature
- [ ] 9.3 Manual test: trigger fallback generation (simulate AI failure), verify persisted asset
- [ ] 9.4 Manual test: replace signature, verify old one goes to archived and new one appears in next campaign
- [ ] 9.5 Verify that AI generation failure does not block campaign creation
- [ ] 9.6 Run `npm run typecheck` and `npm run lint` — no new errors
- [ ] 9.7 Run `npm run build` — successful build
