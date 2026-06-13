## 1. Database Migration — ✅

- [x] 1.1 Create `supabase/migrations/20260612000001_add_identity_state_fields.sql` with:
  - `identity_state` (TEXT, DEFAULT 'text_only', CHECK 'text_only'/'logo'/'visual_signature') on `stores`
  - `text_only_origin` (TEXT, DEFAULT 'implicit', CHECK 'implicit'/'explicit') on `stores`
  - `manual_color_override` (BOOLEAN, DEFAULT false) on `stores`
  - `previous_identity_snapshot` (JSONB, nullable) on `stores`
  - `manual_color_override` (JSONB, DEFAULT '{"enabled": false}') on `store_brand_profiles`
  - Updated CHECK constraint on `store_brand_profiles.source` to include `'text_only'`
- [x] 1.2 Apply migration locally and verify `stores` and `store_brand_profiles` schemas

## 2. Types / Interfaces — ✅

- [x] 2.1 Update `Store` interface to include fields from migration: `identity_state`, `text_only_origin`, `manual_color_override`, `previous_identity_snapshot`
- [x] 2.2 Update `BrandProfileRecord` type to include `manual_color_override` field
- [x] 2.3 Define `TextOnlyInferenceInput` and `TextOnlyInferenceResult` types matching `BrandProfilerWithoutLogoResult` shape (safe_color_tokens, visual_style, visual_tone, typography_direction, brand_personality, campaign_guidelines, campaign_brief, inferred_primary_color, inferred_accent_color, confidence_score)

## 3. Brand Inference Prompt — ✅

- [x] 3.1 Create `prompts/store-brand-inference.md` — prompt for AI to infer visual identity from store data alone (name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state) with optional user color preferences as signal
- [x] 3.2 Verify prompt is loadable via `PromptLoader`

## 4. BrandTextOnlyInferenceService — ✅

- [x] 4.1 Create `src/lib/brand-assets/text-only-inference-service.ts` — service loads prompt, fills template, calls OpenAI, validates output, returns `TextOnlyInferenceResult`. Does NOT persist or update store state (route handles that). Throws on API key missing in production; returns mock in development.

## 5. API Routes — ✅

- [x] 5.1 Create `src/app/api/store/[id]/brand-profile/infer/route.ts`:
  - `POST` handler, synchronous (blocks until inference completes)
  - Accept body: `{ textOnlyOrigin: 'explicit' | 'implicit', userChosenColors?: string[], manualColorOverride?: boolean }`
  - In-memory lock per store_id (Map<string, boolean>), return 429 on concurrent request
  - Timeout inherited from Vercel/Next.js platform (accepted during UAT)
  - Calls `BrandTextOnlyInferenceService.infer()` — service returns result, route handles persistence
  - On success: persist profile with `source='text_only'`, `status='synced'`, `brand_colors_chosen` from user input, `manual_color_override.enabled` based on user color choice; update `stores` (identity_state, text_only_origin, logo_status, manual_color_override, brand_color synced from safe_color_tokens.primary); return profile data
  - On failure (service throws): persist profile with `status='failed'`, still update `stores` (identity_state, text_only_origin, logo_status); return non-blocking 200 with `{ success: false, message }`
- [x] 5.2 Update `PATCH /api/store/[id]/brand-profile` to handle color changes:
  - Update `brand_colors_chosen` with new colors
  - Set `manual_color_override.enabled = true` in profile
  - Set `stores.manual_color_override = true`
  - Do NOT change `safe_color_tokens`
  - Do NOT sync `stores.brand_color`

## 6. Creative Direction Context — ✅

- [x] 6.1 Update `src/lib/actions/store.ts` — `resolveStoreIdentity`:
  - Add new block for `source = 'text_only'` with color priority: `safe_color_tokens.primary > inferred_primary_color > store.brand_color > SEGMENT_COLOR_FALLBACK[segment]`
  - Existing `without_logo` block unchanged (TODO for 4.6.3)
  - `brand_colors_chosen` excluded from rendering hierarchy

## 7. Store Identity UI — Step 2 — ✅

- [x] 7.1 Update `src/components/flow/store-identity-form.tsx`:
  - Handle `identity_state = 'text_only'` alongside `logo_status` throughout Step 2
  - "Continuar sem logo" click: set `identity_state='text_only'`, `logo_status='explicit_none'`, `text_only_origin='explicit'`, trigger `POST /api/store/[id]/brand-profile/infer`
  - Save (Salvar) without logo: set `identity_state='text_only'`, `text_only_origin='implicit'`, save optional colors, trigger inference
  - Inference loading state: spinner with "Aguarde enquanto o Vendeo gera uma direção visual para sua loja..."
  - On success: pre-fill color pickers, update preview, show chip "✓ Direção visual definida pelo Vendeo"
  - On failure: show warning message, show "Gerar direção visual agora" retry button
  - "Continuar sem logo" link hidden via `logoStatus === null` guard (resilient to DEFAULT 'text_only')
  - Color picker pre-fill: `brand_colors_chosen` if non-empty, else `safe_color_tokens.primary` / `inferred_accent_color`
  - Color chips from `safe_color_tokens` displayed below pickers
  - Color change triggers `PATCH /api/store/[id]/brand-profile`
- [x] 7.2 Update `src/components/flow/store-preview.tsx`:
  - When `identity_state='text_only'` and synced profile exists, display: `visual_style`, `visual_tone`, `brand_personality`, color chips from `safe_color_tokens`, chip "✓ Direção visual definida pelo Vendeo"
  - Color swatch follows `safe_color_tokens.primary > inferred_primary_color > store.brand_color > SEGMENT_COLOR_FALLBACK[segment]`

## 8. Verification — ✅

- [x] 8.1 Run TypeScript check (`npx tsc --noEmit`) and fix type errors
- [x] 8.2 Run linter and fix any issues
- [x] 8.3 Run build (`npm run build`) and verify it succeeds
- [x] 8.4 Manual flow test: create store → Step 2 → click "Continuar sem logo" → verify inference trigger, spinner, result in UI, profile in DB
- [x] 8.5 Manual flow test: create store → Step 2 → Save without logo (with and without colors) → verify inference and dual-population
- [x] 8.6 Manual failure test: simulate API error → trigger inference → verify non-blocking 200, profile `failed`, stores updated, retry button shown
