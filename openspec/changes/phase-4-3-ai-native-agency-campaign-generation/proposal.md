## Why

Phase 4.2 delivered a working CSS-based campaign renderer with AI-generated copy and visual parameters, but the final art still looks programmatic — it does not achieve the "agency-quality" visual standard needed for a lojista to confidently publish. The CSS renderer is inherently limited to fixed layouts, hardcoded zone proportions, and segment palettes. Phase 4.3 shifts the visual engine from programmatic rendering to AI-native image generation, where a strong visual AI model (acting as director of marketing + art director) produces a finished, flat, professional 1:1 square campaign image ready for Instagram preview — closing the gap between "functional" and "publicável com confiança."

## What Changes

- **New AI-native image generation service** — Assembles a marketing-directed prompt from store identity + campaign data, sends the product image as visual reference, and generates a final campaign art piece via an OpenAI image-capable model, preferably through the existing AI provider strategy where possible. Alternative visual providers are out of scope unless OpenAI fails the spike.
- **New isolated API endpoint** `POST /api/campaign/generate-image` — Dedicated endpoint for the AI-native generation flow; existing `/api/campaign/generate` remains untouched and operational
- **Pre-validation before generation** — Before calling the image model, the system runs a visual input check: if the user typed "neskau" and the product image shows "Nescau", correct automatically; if there's a real conflict (e.g., "Pepsi" typed but Coca-Cola image), prompt the user; if confidence is low, ask before generating
- **Automatic quality review after generation** — Every generated image passes an AI review that checks for wrong prices, wrong store name, wrong product name, illegible text, invented information, product deformation, and weak visual quality
- **Limited correction lifecycle** — Maximum: 1 initial generation → 1 correction attempt (preserving composition) → 1 full regeneration attempt if correction fails → controlled error. No open loops.
- **Versioned prompt files** in a root `prompts/` directory — Simple, editable Markdown files for the image generation director prompt, the image reviewer prompt, and the input-visual conflict check prompt
- **Preview page adapted** — Preview now displays the AI-generated flat image as primary output; the CSS renderer is no longer the primary output path
- **CSS renderer as legacy fallback** — `CampaignRenderer` remains available as a legacy/fallback renderer. It is not the primary output path for agency-grade campaign art in Phase 4.3, but no code is removed or invalidated.

### Existing Flow Reuse

The existing store and campaign forms must be reused. This phase must not create a separate demo-only flow. The user enters through the same existing campaign creation flow → `/campaign/preview` path with no new pages or parallel flows.

### Out of Scope (explicit)

- Multi-format generation (stories, reels, WhatsApp)
- Layer-based or component-level editing of the final art
- Campaign history or definitive storage
- No prompt/image persistence — generated images, final prompts, and review results may be kept only in temporary request/session/client state during this phase. No definitive persistence.
- Database migrations or schema changes
- Dashboard, analytics, pricing, or auth
- Broad refactoring of the existing renderer

## Capabilities

### New Capabilities

- `ai-image-generation`: Core service that orchestrates AI-native campaign image generation — assembles a prompt from store identity (name, segment, palette, tone) + campaign data (product, image, price, objective), includes the store logo when available (otherwise store name as brand signature fallback), sends the product image as visual reference to a visual AI model, receives and processes the generated 1:1 square campaign art (at provider native size — normalization to 1080×1080 deferred to export phase), and handles the full generation lifecycle including error handling and correction loops. Exposes the `POST /api/campaign/generate-image` endpoint. Do not generate a persistent store signature/logo in this phase unless strictly necessary.
- `image-quality-review`: Automatic AI-based quality review of generated campaign images **after** generation. Detects wrong prices, wrong store name, wrong product name, illegible text, invented commercial information, product deformation, and amateur-quality visuals. Correction lifecycle: 1 initial generation → 1 correction attempt (preserving composition) → 1 full regeneration attempt → controlled error. No open loops.
- `prompt-management`: Versioned, locatable, editable Markdown prompt files in a root `prompts/` directory. Three prompts in this phase: `campaign-image-director.md` (director of marketing/art director persona for generation), `campaign-image-reviewer.md` (quality review criteria — applied **after** generation), `campaign-input-visual-check.md` (pre-generation conflict detection between typed product name and product image). Simple format — no complex template architecture.

### Modified Capabilities

- `campaign-preview-page`: Preview page adapted to display AI-generated flat campaign image as primary output. CSS renderer shown as legacy fallback option. Preview payload may contain a temporary generated image data URL / base64 / object URL, without definitive persistence.
- `campaign-visual-renderer`: CampaignRenderer is no longer the primary output path for agency-grade campaign art in Phase 4.3. It remains available as legacy/fallback renderer. No code is removed or invalidated.

## Impact

- **New files**: `src/lib/image-generation/` service directory, `src/app/api/campaign/generate-image/route.ts` endpoint, `prompts/` directory with 3 markdown files
- **Modified files**: `src/app/campaign/preview/page.tsx` (preview adaptation), `src/components/campaign/types.ts` (new preview payload variant)
- **New dependencies**: No new external provider dependency should be introduced unless the existing OpenAI integration cannot support image generation. First attempt: extend existing provider strategy.
- **AI provider extension**: The existing `AIProvider` abstraction may need extension for image generation capabilities (vision input, image output), or a parallel image provider interface
- **No database changes**: No migrations, no new tables, no storage persistence in this phase
- **Existing endpoint preserved**: `POST /api/campaign/generate` remains fully operational and unchanged
