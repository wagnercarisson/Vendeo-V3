## 1. Database & Storage Setup

- [x] 1.1 Create migration file `supabase/migrations/*_create_store_visual_signatures.sql` with all columns, CHECK constraints (`type`, `status`, `generation_mode`), partial unique index `WHERE status = 'active'`, and `updated_at` trigger
- [x] 1.2 Create `visual-signatures` bucket in Supabase Storage with public read policy
- [x] 1.3 Configure RLS grants/permissions on `store_visual_signatures` table consistent with existing project patterns
- [x] 1.4 Create `src/lib/visual-signature/types.ts` with TypeScript types matching the database schema

## 2. Visual Signature Generator — Image First (Abordagem B)

### 2.A Image Generation (Primary)

- [x] 2.A.1 Create `prompts/visual-signature-generator.md` for direct AI image generation (not JSON) — prompt asks for brand mark image with rules against pricing, products, CTAs
- [x] 2.A.2 Implement `AiImageGenerator` in `src/lib/visual-signature/ai-image-generator.ts`
- [x] 2.A.3 Add basic image validation before persisting
- [x] 2.A.4 Include `generation_tier` in metadata JSONB on all persisted records: `image_direct` for AI image, `image_retry` for retry, `typographic` for zero-AI

## 3. Fallback Generators

### 3.A Typographic Fallback (last resort, zero-AI)

- [x] 3.A.1 Implement `TypographicFallbackGenerator` in `src/lib/visual-signature/typographic-fallback.ts`
- [x] 3.A.2 Build SVG template for initials circle (brand color bg + white text) + store name below
- [x] 3.A.3 Upload fallback SVG directly to Storage (no PNG conversion required — browsers render SVG natively)
- [x] 3.A.4 Persist as `fallback_typographic` with status `active`
- [x] 3.B.1 Implement `uploadToStorage()` in `src/lib/visual-signature/persistence.ts`
- [x] 3.B.2 Implement `persistSignature()` — inserts record into `store_visual_signatures` table

## 4. Server Actions (orchestrated cascade)

- [x] 4.1 Create server action `generateVariations(storeId)` with cascade: AI image → AI image retry → typographic — MUST produce exactly 3 cards or error if impossible
- [x] 4.2 Create server action `generateAutomatic(storeId)` with same cascade
- [x] 4.3 Create server action `activateSignature(storeId, signatureId)` — archive previous active, set chosen to active
- [x] 4.4 Create server action `listSignatures(storeId)` — return active + drafts for store
- [x] 4.5 Validate store_id, UUID, status transitions on all server actions
- [x] 4.6 Ensure atomicity of activate (archive → activate)

## 5. Store Identity Extension

- [x] 5.1 Extend `resolveStoreIdentity()` in `src/lib/store.ts` to check active visual signature when `logo_url` is null
- [x] 5.2 Extend `StoreIdentitySnapshot` type to include `visualSignatureUrl` and `visualSignatureType`
- [x] 5.3 Add `getActiveVisualSignature(storeId)` query helper

## 6. UI — Modal & Picker

- [x] 6.1 Create `VisualSignaturePicker` component showing selectable variation cards (140×80px previews)
- [x] 6.2 Create visual signature modal with 4 option cards (no close button)
- [x] 6.3 Integrate modal into `store-identity-form.tsx` — trigger after save when no logo and no active signature
- [x] 6.4 Add "Identidade Visual" section to the store identity page with preview and alter button

## 7. Logo Upload (minimal flow)

- [x] 7.1 Create migration `supabase/migrations/*_create_store_logos_storage.sql` for `store-logos` bucket (idempotent insert, public read, service_role insert/update/delete policies)
- [x] 7.2 Create API route `src/app/api/stores/[storeId]/logo/route.ts` — accepts multipart form, validates type/size, uploads to Storage, saves `logo_url` on `stores` row
- [x] 7.3 Add file upload field to store identity form (triggered by modal option "Tenho logotipo e quero enviar agora")
- [x] 7.4 Update `resolveStoreIdentity()` priority: `logo_url` > visual signature > typographic fallback

## 8. Campaign Pipeline Integration (technically implemented — BLOCKED by quality gate)

> ⚠️ **Blocker:** All 8.x tasks are implemented in code but MUST NOT be considered accepted until the quality gate (section 9) passes.
> The integration exists technically, but is blocked from use/approval until visual evaluation is complete.

- [~] 8.1 Extend `CampaignRenderParams` with `visualSignatureUrl` and `visualSignatureType` — **BLOCKED by quality gate**
- [~] 8.2 Load visual signature asset in the post-generation/render flow and apply to the store identity zone — do NOT inject into the AI image generation prompt — **BLOCKED by quality gate**
- [~] 8.3 Update `CampaignRenderer` store identity zone to handle visual signature rendering with priority: logo → visualSignature → initials fallback — **BLOCKED by quality gate**
- [~] 8.4 Update `CAMPAIGN_VISUAL_SYSTEM.md` store identity section with new priority rules — **BLOCKED by quality gate**

## 9. Quality Gate (blocks section 8 acceptance)

- [ ] 9.1 Generate first visual signature prototype via AI image and evaluate:
  - Looks like a real brand mark (not initials-only, not campaign art)
  - Store name is correctly rendered and readable
  - Colors/style match brand segment and tone
  - No pricing, products, offers, or promotional copy
  - No visual artifacts or distortion
- [ ] 9.2 After quality gate passes: remove `[~]` BLOCKED markers from section 8 items

## 10. Validation & Testing

- [ ] 10.1 Manual visual test: generate 2 campaigns for same store without logo, verify same signature appears
- [ ] 10.2 Manual visual test: upload logo, verify logo takes priority over signature
- [ ] 10.3 Manual test: simulate AI image failure, verify cascade to typographic fallback
- [ ] 10.4 Manual test: replace signature, verify old archived and new appears in next campaign
- [ ] 10.5 Verify that AI generation failure does not block campaign creation
- [x] 10.6 Run `npm run typecheck` and `npm run lint` — no new errors
- [x] 10.7 Run `npm run build` — successful build
