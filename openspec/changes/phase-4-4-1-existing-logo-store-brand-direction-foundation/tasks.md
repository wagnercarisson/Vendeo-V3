> **Notas de implementação:**
> - **Bucket `store-brand-assets`**: Criar via Supabase Dashboard ou migration SQL com política de acesso pública somente para leitura (SELECT) para URLs públicas, e inserção restrita a service_role. O bucket não deve exigir autenticação do lojista para leitura dos assets (as URLs públicas são usadas na renderização das campanhas). CORS configurado para o domínio da aplicação.
> - **`resolveStoreIdentity`**: Esta função é síncrona e usada em contexto de renderização. Para não quebrar o fluxo existente, resolver brand assets em um snapshot/contexto antes de chamar o renderer — não fazer chamada assíncrona ao banco dentro do componente de renderização. O `StoreIdentitySnapshot` deve ser enriquecido com dados do brand profile e logo variants no momento da montagem do CreativeBrief, antes da renderização.

## 1. Database Migrations

**Ordem obrigatória**: store_brand_assets antes de store_brand_profiles, pois profiles tem FK → store_brand_assets(id).

- [ ] 1.1 Create migration `supabase/migrations/*_create_store_brand_assets.sql` (timestamp mais antigo) with full table schema: id, store_id, asset_type, variant_type, source, parent_asset_id (self-FK), storage_path (nullable — pode ser null quando status = 'failed'), mime_type, width, height, size_bytes, checksum, version, status, metadata, created_at, updated_at. Include CHECK constraints for status ('active','archived','failed'), variant_type ('original','normalized','on_light','on_dark','square_safe','horizontal_safe'), source ('user_upload','system_generated'), storage_path required check: `CHECK (status IN ('failed') OR storage_path IS NOT NULL)` (storage_path obrigatório quando active ou archived), partial unique index `(store_id, asset_type, variant_type) WHERE status = 'active'`, and updated_at trigger
- [ ] 1.2 Create migration `supabase/migrations/*_create_store_brand_profiles.sql` (timestamp posterior a 1.1) with full table schema: id, store_id, source, active_logo_asset_id (FK → store_brand_assets.id), logo_colors_detected, brand_colors_chosen, safe_color_tokens, visual_style, visual_tone, typography_direction, brand_personality, campaign_guidelines, campaign_brief, confidence_score, metadata, version, status, created_at, updated_at. Include CHECK constraint for status ('processing','synced','outdated','failed','archived'), partial unique index `(store_id) WHERE status = 'synced'`, and updated_at trigger
- [ ] 1.3 Create migration `supabase/migrations/*_add_store_direction_fields.sql` (timestamp posterior a 1.2) adding columns subsegment, tone_of_voice, positioning, short_description, slogan to stores table via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (all nullable text)
- [ ] 1.4 Apply all migrations in timestamp order and verify they are idempotent

## 2. Storage Setup

- [ ] 2.1 Create Supabase Storage bucket `store-brand-assets` with appropriate security rules (authenticated or service-role access based on project config)
- [ ] 2.2 Configure CORS if needed for direct upload access

## 3. Image Processing Utilities

- [ ] 3.1 Install `sharp` as project dependency and verify availability in Node.js server runtime (not edge)
- [ ] 3.2 Create server utility `src/lib/image-processing.ts` with functions: `validateImage(buffer)`, `getImageDimensions(buffer)`, `checkImageIntegrity(buffer)`
- [ ] 3.3 Implement variant generation functions in `src/lib/image-processing.ts`: `generateNormalized(buffer)`, `generateOnLight(buffer)`, `generateOnDark(buffer)`, `generateSquareSafe(buffer)`, `generateHorizontalSafe(buffer)`, each returning processed buffer + metadata (width, height, size_bytes)

## 4. Store Brand Assets API — Logo Upload

- [ ] 4.1 Implement `POST /api/store/[id]/logo` endpoint: accept multipart/form-data, validate extension (png/jpg/jpeg/webp), reject SVG with message "Formatos aceitos: PNG, JPG ou WEBP."
- [ ] 4.2 Add server-side validation: verify real MIME type via sharp/file-type, enforce 5MB limit, verify minimum 200x200px dimensions, check file integrity
- [ ] 4.3 Persist original file to Supabase Storage bucket `store-brand-assets` under path `{store_id}/original/{uuid}.{ext}`
- [ ] 4.4 Calculate next version: query max version from existing store_brand_assets for this store, increment by 1 (or start at 1 if none)
- [ ] 4.5 Archive previous active assets and profile BEFORE inserting new ones: set status='archived' for all active store_brand_assets (original + all variants) for this store, set previous synced brand profile status to 'outdated' — this avoids unique constraint violation when inserting new active records
- [ ] 4.6 Create store_brand_assets record for original with variant_type='original', source='user_upload', parent_asset_id=null, version={calculated}, status='active'
- [ ] 4.7 Generate all 5 technical variants (normalized, on_light, on_dark, square_safe, horizontal_safe) via sharp, upload each to storage path `{store_id}/{variant_type}/{uuid}.png`, create store_brand_assets records with source='system_generated', parent_asset_id=original.id, version={calculated}, status='active' (or 'failed' if generation errors)
- [ ] 4.8 Execute Store Brand Director analysis inline, create brand profile with status 'synced' (success) or 'failed' (error) — see section 6 for prompt/LLM integration
- [ ] 4.9 Return HTTP 201 with original asset, all variant records, and the created brand profile (synced or failed)
- [ ] 4.10 Implement `GET /api/store/[id]/logo` returning active logo data with all active technical variants
- [ ] 4.11 Implement `GET /api/store/[id]/logo/versions` returning version history ordered by version descending
- [ ] 4.12 Implement `DELETE /api/store/[id]/logo` soft delete: set store_brand_assets status to 'archived', set brand profile status to 'archived', preserve storage files

## 5. Store Brand Profile API

- [ ] 5.1 Implement `GET /api/store/[id]/brand-profile` returning active brand profile (status = 'synced'), or null if none exists
- [ ] 5.2 Implement `POST /api/store/[id]/brand-profile/generate` that re-runs Store Brand Director analysis inline, creates new profile, archives previous as 'outdated'
- [ ] 5.3 Implement `PATCH /api/store/[id]/brand-profile/colors` accepting `{ colors: string[] }` to update brand_colors_chosen in-place
- [ ] 5.4 Implement `POST /api/store/[id]/brand-profile/archive` to set active profile status to 'archived'

## 6. Store Brand Director — AI Analysis Integration

- [ ] 6.1 Create prompt file `prompts/store-brand-director-with-logo.md` with instructions for: logo visual analysis, color extraction (max 5 hex), style/tone/personality inference, cross-reference with store data (segment, subsegment, city, state, tone_of_voice, positioning, short_description, slogan), campaign guidelines/brief generation, logo preservation directive (never redesign/recolor/alter the logo)
- [ ] 6.2 Implement LLM call function in AI abstraction layer that sends logo image + store data to configured provider with the Store Brand Director prompt
- [ ] 6.3 Parse LLM JSON response into brand profile fields (logo_colors_detected, safe_color_tokens, visual_style, visual_tone, typography_direction, brand_personality, campaign_guidelines, campaign_brief, confidence_score)
- [ ] 6.4 Integrate LLM call into POST /api/store/[id]/logo: after saving original and variants, execute analysis inline, create brand profile with status 'synced' on success or 'failed' on error
- [ ] 6.5 Handle LLM failure gracefully: profile created as 'failed' with error metadata, upload still succeeds, lojista can retry via regenerate endpoint

## 7. Store API Extensions

- [ ] 7.1 Extend `PATCH /api/store/[id]` to accept and persist new fields: subsegment, tone_of_voice, positioning, short_description, slogan (all optional)
- [ ] 7.2 Pre-resolve store_brand_assets in `StoreIdentitySnapshot`/resolution flow before calling `resolveStoreIdentity` or renderer. Query active brand assets for the store, resolve the appropriate variant URL, and include logo_variant_url in the snapshot. Do NOT perform async database calls inside `resolveStoreIdentity` or renderer components — brand asset data must be resolved at the snapshot/context level before rendering. Priority: brand assets original > visual signature > store name text

## 8. Store Identity UI

- [ ] 8.1 Add logo upload section to store-identity page with drag-and-drop or click-to-upload, showing accepted formats and 5MB limit
- [ ] 8.2 Implement upload flow: client-side format validation, progress indicator, circular preview after success, simple status ("Enviando...", "Processando...", "Pronto")
- [ ] 8.3 Add color suggestion swatches below the color picker when brand profile exists with logo_colors_detected — no conflict modal if lojista chooses different color
- [ ] 8.4 Add new form fields: Subsegmento (text), Tom de Voz (dropdown/select), Posicionamento (text), Descrição Curta (textarea), Slogan (text) — all optional
- [ ] 8.5 Connect new fields to PATCH /api/store/[id] on save
- [ ] 8.6 Update store preview component to show logo image (circular crop) when uploaded instead of color swatch

## 9. Campaign Integration — Brand Profile Consumption

- [ ] 9.1 Extend `CreativeBrief` assembly to check for synced brand profile and inject campaign_guidelines, campaign_brief, brand_personality, visual_style, visual_tone, brand_colors_chosen as prompt context variables (directional, not mandatory)
- [ ] 9.2 Integrate brand_colors_chosen into CampaignRenderer color resolution as highest priority (profile colors > store brand_color > segment fallback)
- [ ] 9.3 Implement logo variant selection for render context: dark theme uses on_dark variant, fallback → original → normalized → store name text
- [ ] 9.4 Ensure all brand profile context is empty-string when no synced profile exists — existing segment-based fallback applies unchanged

## 10. Verification

- [ ] 10.1 Run TypeScript type check and fix any type errors
- [ ] 10.2 Run linter and fix lint issues
- [ ] 10.3 Verify build succeeds (`npm run build` or equivalent)
- [ ] 10.4 Manual test: upload valid PNG logo → verify original saved, variants generated, brand profile created as synced
- [ ] 10.5 Manual test: upload SVG → verify rejected with correct error message
- [ ] 10.6 Manual test: upload file >5MB → verify rejected
- [ ] 10.7 Manual test: upload corrupted file → verify rejected
- [ ] 10.8 Manual test: second upload → verify previous assets archived, new version created, profile outdated
- [ ] 10.9 Manual test: soft delete logo → verify assets archived, profile archived, storage preserved
- [ ] 10.10 Manual test: campaign generation with brand profile → verify profile colors used, on_dark variant selected
- [ ] 10.11 Manual test: campaign generation without brand profile → verify segment fallback unchanged
