# Phase 39: Brief Estruturado de Campanha — Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 19 (5 new, 7 modified code, 3 test-fixture co-migrations, 4… runbook 6 tracked)
**Analogs found:** 16 / 16 code targets; 6/6 runbook targets (doc-edit, no code analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/campaign/brief.ts` (NEW) | model (domain contract, no server-only) | transform (pure functions) | `src/lib/campaign/types.ts` + `src/lib/snapshot.ts` | exact (type-module), partial (update fn) |
| `src/lib/campaign/brief-schema.ts` (NEW) | config/model (zod) | validation | `src/lib/image-generation/schema.ts` | exact |
| `src/lib/campaign/__tests__/brief.test.ts` (NEW) | test | contract unit | `src/lib/actions/__tests__/store.test.ts` | exact |
| `src/lib/campaign/__tests__/brief-mapper.test.ts` (NEW) | test | contract unit (round-trip) | `src/lib/actions/__tests__/store.test.ts` (buildCampaignBrief tests) | role-match |
| `src/lib/campaign/__tests__/brief-snapshot.test.ts` (NEW) | test | contract unit (recursive scan) | `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` | role-match |
| `src/components/campaign/types.ts` (MOD) | model (wrapper) | transport shape | self (rename, `CampaignBrief` 37-55) | self-analog |
| `src/lib/store-identity-service.ts` (MOD) | service | request-response (build) | self (`buildCampaignBrief` 203-228) | self-analog |
| `src/app/api/campaign/generate-image/route.ts` (MOD) | controller/route | request-response (streaming) | self (snapshot build 357-380, brief creation 210-241) | self-analog |
| `src/lib/image-generation/services/image-generation-service.ts` (MOD) | service | request-response (parallel pipeline) | self (buildPromptVariables 843-938, buildCommercialRepertoire 704-759, ImageReviewInput 382-397) | self-analog |
| `src/lib/copy/mapper.ts` (MOD) | service/utility | transform | self (`mapBriefToCopyDirectorInput` 91-115) | self-analog |
| `src/lib/image-generation/services/image-review-service.ts` (MOD) | service | request-response | self (`ImageReviewInput` 9-21) | self-analog |
| `src/lib/campaign/types.ts` (MOD) | model | transport shape | self (`InputSnapshot` 38-58) | self-analog |
| `scripts/benchmark.ts` (MOD) | utility/script | batch (compat) | self (brief flat build 332-369) | self-analog |
| `route.test.ts` fixtures (MOD) | test | co-migration | self (mock setup + `mockResolvedValue({ campaignInput, store })` 218/432+) | self-analog |
| `image-generation-service.test.ts` fixtures (MOD) | test | co-migration | self (`createMinimalBrief` 13-39) | self-analog |
| `image-review-service.test.ts` fixtures (MOD) | test | co-migration | self (`ImageReviewInput` literals 36-42) | self-analog |
| `ROADMAP.md` (root) + 5 `.planning/*.md` | config/doc | runbook (D1) | self (existing listing/reference tables) | doc-edit |

---

## Pattern Assignments

### `src/lib/campaign/brief.ts` (NEW — model/domain contract, pure transform)

**Analog:** `src/lib/campaign/types.ts` (1-58) + `src/lib/snapshot.ts` (15-32) + `src/lib/image-generation/schema.ts` (39, type alias)

**WHY — the pattern being replicated:** The domain type module is a **pure `.ts` type+const module with zero server-only imports** (shared client/server contract, D4): export const literal-union types, then interfaces that reference them, then a snapshot interface that mirrors the runtime shape minus base64. The snapshot helper in `src/lib/snapshot.ts` shows the "snapshot builder as pure function deriving from input" pattern that `buildCampaignBriefSnapshot` must follow (immutable-by-construction, D6 — same philosophy as F38.2.1 `identity_snapshot`/`render_snapshot`).

**Type-module import style — no server-only** (from `src/lib/campaign/types.ts:1-4`):
```typescript
export type CampaignIntent = "offer" | "spotlight" | "exclusive";
export type CampaignStatus = "generating" | "ready" | "error";
```

**Literal-union const pattern to copy for `CampaignBriefSchemaVersion`/`ProductSource`/`CampaignImageRole`/`CampaignImageSource`** (from `schema.ts:39` plus the enum style in `types.ts:1`):
```typescript
// GenerateImageRequest.ts pattern
export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;
```
(`brief.ts` uses plain union consts + interfaces — no zod here; zod lives in `brief-schema.ts`.)

**Snapshot-builder pure-function pattern** (from `src/lib/snapshot.ts:20-31`) — this is the shape `buildCampaignBriefSnapshot(brief): CampaignBriefSnapshot` must replicate (D6/D11, derive-from-own-input, never receives external image):
```typescript
export function buildStoreProfileInputSnapshot(
  store: Pick<Store, 'segment' | ...>,
): StoreProfileInputSnapshot {
  return {
    segment: store.segment,
    subsegment: store.subsegment ?? null,
    ...
  };
}
```

**Mapper pure-function pattern for `buildCampaignBriefFromFlat`** (D5) — same signature shape as `buildCommercialFrame` in `src/lib/copy/mapper.ts:5-12` (pure, no DB): `(input, storeId, source?) => CampaignBrief`, extracting optional fields with `?? undefined`/absent semantics (absence rule D8/D9 — absent, never `{ enabled: false }`).

**Data flow:** transform (flat → domain); module is shared (no `server-only`); params: `GenerateImageRequest` + `storeId`, `source = "web_form"` default.

---

### `src/lib/campaign/brief-schema.ts` (NEW — zod schemas per domain)

**Analog:** `src/lib/image-generation/schema.ts:8-39` (`GenerateImageRequestSchema`)

**WHY — the pattern being replicated:** Zod object per domain, optional fields via `.optional()`, defaults via `.default()`, enum via `z.enum([...])`, uuid via `z.string().uuid()`, and `.strict()` to reject unknown keys. The **exactly-1-primary invariant** (D7/F39-08) is a `.superRefine()`/`.refine()` on `media.images` counting `role === "primary"` — the codebase pattern for custom validation sits in `schema.ts:32-36` (`inputValidationOverride` object + `validationContext` in `schema.ts:154-168`).

**Exact excerpt to model each domain schema on** (`src/lib/image-generation/schema.ts:8-37`):
```typescript
export const GenerateImageRequestSchema = z.object({
  storeId: z.string().uuid(),
  productName: z.string().min(1),
  originalPriceCents: z.number().int().nonnegative().optional(),
  discountedPriceCents: z.number().int().positive().optional(),
  campaignIntent: z
    .enum(["offer", "spotlight", "exclusive"])
    .optional()
    .default("offer"),
  preserveImageContext: z.boolean().optional(),
  badgeText: z.string().optional(),
  ...
  productImageDataUrl: z.string().min(1, "Imagem do produto é obrigatória"),
  mandatoryArtworkText: z.string().optional(),
  inputValidationOverride: z
    .object({ productImageCheck: z.literal("user_confirmed_continue").optional() })
    .optional(),
}).strict();
```

**Type derivation pattern** (`schema.ts:39`):
```typescript
export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;
```
Apply per domain: `productSchema`/`commercialSchema`/`mediaSchema`/`creativeContextSchema`/`metadataSchema` + `campaignBriefSchema` (tasks 2.7), then `z.infer` per domain → the interfaces in `brief.ts` can also be `z.infer`-based or hand-written (D4 allows contract in brief.ts); keep `.strict()` on `campaignBriefSchema` and an invariant refine for 1 primary.

**Data flow:** validation (transforms raw/unknown → typed `CampaignBrief`); **no server-only** (D4, shared contract).

---

### `src/lib/campaign/__tests__/brief.test.ts` (NEW — contract test)

**Analog:** `src/lib/actions/__tests__/store.test.ts:180-294` (buildCampaignBrief tests with flat `mockCampaignInput`)

**WHY — the pattern being replicated:** Vitest `describe/it/expect`, a **base-fixture builder function with `Partial<T>` overrides spread last** (`baseSnapshot(overrides)`), flat minimal input const, and assertions on nested fields (`brief.identity.state`, `brief.store.name`). New brief tests will build `CampaignBrief` objects the same way, swapping `campaignInput: {...}` for the structured `{ product, commercial, media, creativeContext, metadata }` shape.

**Fixture-builder pattern (lines 180-195) + flat input (60-65):**
```typescript
describe('buildCampaignBrief', () => {
  const baseSnapshot = (overrides: Partial<StoreIdentitySnapshot> = {}): StoreIdentitySnapshot => ({
    storeName: 'Minha Loja',
    storeSegment: 'outros',
    brandColor: '#22C55E',
    identityState: 'text_only',
    signature: { url: null, type: null },
    storeInitials: 'ML',
    brandProfile: null,
    toneOfVoice: null, subsegment: null, positioning: null,
    shortDescription: null, slogan: null,
    ...overrides,
  });

  const mockCampaignInput: CampaignInput = {
    productName: 'Produto Teste',
    discountedPriceCents: 1990,
    campaignIntent: 'offer',
    productImageDataUrl: 'data:image/jpeg;base64,abc123',
  };
```

**Nested assertion style (lines 201-204, 250-256):**
```typescript
    expect(brief.identity.state).toBe('text_only');
    expect(brief.identity.directive).toContain('Não colocar logotipo');
    expect(brief.campaignInput.productName).toBe('Produto Teste');
```

**Data flow:** contract unit — brief mínimo válido, oferta+validade, aviso on/off, 1 primary, rejeição sem imagem, `themeId` null, `schemaVersion` clareza (tasks 8.1-8.6, 8.15).

---

### `src/lib/campaign/__tests__/brief-mapper.test.ts` (NEW — round-trip mapper test)

**Analog:** `src/lib/actions/__tests__/store.test.ts` (base-fixture builder + nested assertions) — same helper base; assertions are round-trip: flat `GenerateImageRequest` → `buildCampaignBriefFromFlat` → assert `brief.product.name`/`brief.commercial.*`/`brief.media.images[0].role`/`brief.creativeContext.*` and canonical-home sleeping fields (tasks 8.7-8.11, 8.14). Also proves absence rule (8.7b/8.8): `expect(brief.commercial.validity).toBeUndefined()`.

**Also models the "contract preserved across migration" style of** `src/lib/image-generation/services/__tests__/image-generation-service.test.ts:225-260` (asserts `mandatoryArtworkText` propagates to reviewer) — copy that pattern for `legalNotice.text` compat (`mandatoryArtworkText` fix `260804-s16`).

**Data flow:** transform round-trip unit (flat → brief → snapshot).

---

### `src/lib/campaign/__tests__/brief-snapshot.test.ts` (NEW — snapshot contract test)

**Analog:** `src/lib/image-generation/services/__tests__/image-generation-service.test.ts:13-39` (`createMinimalBrief` helper) for the fixture; the recursive-sc roll pattern (D6/D12) is new but should use the depth-first recursion over `Record` — same style as `route.ts:357-380` manual snapshot (the flat snapshot this phase replaces).

**The `createMinimalBrief` helper to reuse as base (lines 13-39):**
```typescript
function createMinimalBrief(overrides?: Partial<CampaignBrief>): CampaignBrief {
  return {
    campaignInput: {
      productName: 'Produto Teste',
      discountedPriceCents: 1990,
      productImageDataUrl: 'data:image/jpeg;base64,test',
      badgeText: 'Oferta',
    } as CampaignInput,
    store: { name: 'Loja Teste', segment: 'outros', ... },
    brandProfile: null,
    identity: { state: 'text_only', imageUrl: null, directive: '' },
    ...overrides,
  };
}
```
(Note: after F39 the fields move to the structured domain shape; keep the override-spread-last convention.)

**Data flow:** contract unit — recursive no-base64 scan, immutability (serialize once), `schemaVersion` root-only.

---

### `src/components/campaign/types.ts` (MOD — rename `CampaignBrief` → `ResolvedCampaignContext`)

**Analog:** self — the current `CampaignBrief` interface (37-55) is the exact shape to retain. Rename + JSDoc note (task 3.1); imports at 1-3 unchanged; `SEGMENT_PALETTES`/helpers (73-111) untouched.

**Exact interface that stays the same (only the name changes)** (`src/components/campaign/types.ts:35-55`):
```typescript
export type CampaignInput = Omit<GenerateImageRequest, 'storeId'>;

export interface CampaignBrief {                       // → ResolvedCampaignContext
  campaignInput: CampaignInput;
  store: {
    name: string;
    segment: string;
    subsegment: string | null;
    toneOfVoice: string | null;
    positioning: string | null;
    shortDescription: string | null;
    slogan: string | null;
    brandColor: string;
  };
  brandProfile: BrandProfileSnapshot | null;
  identity: {
    state: IdentityState;
    imageUrl: string | null;
    directive: string;
  };
}
```

**Data flow:** transport shape (unchanged); consumers: `src/lib/image-generation/services/image-generation-service.ts:5` (`import type { CampaignBrief }`), `src/lib/copy/mapper.ts:1`, `src/lib/store-identity-service.ts:1`, tests. **All 4 import sites must be co-migrated** (task 3.1-3.2/8.21).

---

### `src/lib/store-identity-service.ts` (MOD — return type change)

**Analog:** self — `buildCampaignBrief` (203-228). Only the **return type annotation** changes (`Promise<CampaignBrief>` → `Promise<ResolvedCampaignContext>`); body/shape stays identical (contract test 8.21 asserts shape preserved).

**Exact function signature (203-228) + `deriveDirective` helper it delegates to (8-25):**
```typescript
export async function buildCampaignBrief(
  snapshot: StoreIdentitySnapshot,
  campaignInput: CampaignInput
): Promise<CampaignBrief> {                    // → Promise<ResolvedCampaignContext>
  const hasAsset = snapshot.signature.url !== null;
  const directive = deriveDirective(snapshot.identityState, hasAsset);

  return {
    campaignInput,
    store: {
      name: snapshot.storeName,
      segment: snapshot.storeSegment,
      subsegment: snapshot.subsegment,
      toneOfVoice: snapshot.toneOfVoice,
      positioning: snapshot.positioning,
      shortDescription: snapshot.shortDescription,
      slogan: snapshot.slogan,
      brandColor: snapshot.brandColor,
    },
    brandProfile: snapshot.brandProfile,
    identity: {
      state: snapshot.identityState,
      imageUrl: snapshot.signature.url,
      directive,
    },
  };
}
```

**Import line at the top to update (line 1):**
```typescript
import type { StoreIdentitySnapshot, BrandProfileSnapshot, IdentityState, CampaignBrief, CampaignInput } from "@/components/campaign/types";
// → swap CampaignBrief for ResolvedCampaignContext (both types come from the same module)
```

**Callers (must stay green without behavior change — F39-10/8.21):**
- `src/app/api/campaign/generate-image/route.ts:241` — `const brief = await buildCampaignBrief(validatedSnapshot, campaignInput as CampaignInput);`
- `src/lib/actions/store.ts:17-18` — re-export via `Parameters<typeof _buildCampaignBrief>` (`"use server"` wrapper, no type touch needed)

**Data flow:** request-response (server-only service, Supabase reads → transport wrapper).

---

### `src/app/api/campaign/generate-image/route.ts` (MOD — mapper at boundary + versioned snapshot)

**Analog:** self — **Snapshot flat build (357-380)** is the block to replace with `buildCampaignBriefSnapshot`; **brief creation (210-241)** is where `buildCampaignBriefFromFlat` plugs in (D5: single conversion point, one-shot).

**Flat snapshot build block — will be replaced by `const snapshot = buildCampaignBriefSnapshot(brief)` (357-380):**
```typescript
    const inputSnapshot: Record<string, unknown> = {
      productName: campaignInput.productName,
      originalPriceCents: campaignInput.originalPriceCents,
      discountedPriceCents: campaignInput.discountedPriceCents,
      badgeText: campaignInput.badgeText,
      hook: campaignInput.hook,
      cta: campaignInput.cta,
      description: campaignInput.description,
      objective: campaignInput.objective,
      campaignDetails: campaignInput.campaignDetails,
      additionalDetails: campaignInput.additionalDetails,
      targetChannel: campaignInput.targetChannel,
      format: campaignInput.format,
      validity: campaignInput.validity,
      availabilityNotes: campaignInput.availabilityNotes,
      sensitiveConstraints: campaignInput.sensitiveConstraints,
      inputValidationOverride: campaignInput.inputValidationOverride,
      mandatoryArtworkText: campaignInput.mandatoryArtworkText,
      campaignIntent: campaignInput.campaignIntent,
      preserveImageContext: campaignInput.campaignIntent === "offer"
        ? false
        : (campaignInput.preserveImageContext ?? false),
      productImage: { provided: true, mimeType: "image/jpeg" },
    };
```
The `preserveImageContext` offer-normalization rule (376-378) and the `mimeType: "image/jpeg"` + `productImage: { provided: true }` mapping are **canonical rules to port into the mapper** (specifics: `preserveImageContext` normalized, mimeType kept, D7).

**Brief creation / boundary point (210-241) — where `buildCampaignBriefFromFlat` is inserted after validation + normalization:**
```typescript
  // ── Pre-stream: Resolve store identity (backend-side) ────────────
  const { storeId, ...campaignInput } = parsed.data;
  ...
  storeSnapshot = await resolveStoreIdentity(store);
  const validatedSnapshot = await validateIdentityReference(storeSnapshot);

  // Build campaign brief
  const brief = await buildCampaignBrief(validatedSnapshot, campaignInput as CampaignInput);
```
Step 4 flow: after line 241, keep `buildCampaignBrief` (returns `ResolvedCampaignContext` with identity) but **additionally** call `buildCampaignBriefFromFlat(parsed.data, parsed.data.storeId)` once and pass the domain brief `brief.product/commercial/media/creativeContext` down via the new mapper seams (D5/D11). Orchestration after 241 (rate limit 243-253, credits 258+, stream) **untouched** (D11/6.6).

**Edge rule 400 — already present via zod `productImageDataUrl: z.string().min(1, ...)` at `schema.ts:30`**: route's `safeParse` failure block (137-154) handles it; only add a contract-level re-check inside `buildCampaignBriefFromFlat` if needed (task 7.3 — no change needed in the 400 path).

**Data flow:** request-response + streaming (unchanged orchestration); input layer shape-only change.

---

### `src/lib/image-generation/services/image-generation-service.ts` (MOD — 6.1/6.2/6.3 seams)

**Analog:** self — all `body.*` reads become `brief.product.*`/`brief.commercial.*`/`brief.media.*`/`brief.creativeContext.*`. Keep the **exact variable-set** (`buildPromptVariables` returns the same 38 keys) — golden tests by intent (offer/spotlight/exclusive), task 8.16.

**The `body` alias to eliminate (95, plus 585):**
```typescript
    const body = brief.campaignInput as GenerateImageRequest;
```

**Where `body.*` is read in `buildPromptVariables` (843-938) — subset showing the reads to re-route (889-919):**
```typescript
    return {
      productName: effectiveProductName,
      storeName: brief?.store.name ?? '',
      storeSegment,
      ...
      originalPrice: (body.originalPriceCents ?? 0) > 0
        ? this.formatPriceBRL(body.originalPriceCents ?? 0)
        : "",
      discountedPrice: body.discountedPriceCents
        ? this.formatPriceBRL(body.discountedPriceCents)
        : "",
      badgeText: body.badgeText ?? "",
      hook: body.hook ?? "",
      cta: body.cta ?? "",
      objective: body.objective ?? "",
      campaignDetails: body.campaignDetails ?? "",
      additionalDetails: body.additionalDetails ?? "",
      targetChannel: body.targetChannel ?? "Instagram",
      format: body.format ?? "quadrado 1:1",
      validity: body.validity ?? "",
      availabilityNotes: body.availabilityNotes ?? "",
      sensitiveConstraints: body.sensitiveConstraints ?? "",
      mandatoryArtworkText: body.mandatoryArtworkText ?? "",
      identityImageUrl: brief?.identity.imageUrl ?? "",
      ...
      commercialFrame,
      brandProfileSection: this.buildBrandProfileSection(brief?.brandProfile ?? null),
      ...
    };
```
→ Map to `brief.commercial.hook ?? ""`, `brief.commercial.validity?.enabled ? brief.commercial.validity.displayText ?? "" : ""`, `brief.commercial.legalNotice?.text ?? ""`, `brief.creativeContext.sensitiveConstraints ?? ""`, etc. (D8/D9 — validity/legalNotice gated on `enabled`).

**`buildCommercialRepertoire` validity heuristic (704-732) — REPLACE with `enabled/displayText` (D8, task 6.2):**
```typescript
  private buildCommercialRepertoire(body: GenerateImageRequest): string {
    ...
    if (body.validity && campaignIntent === "offer" && (
      body.validity.toLowerCase().includes("/") ||
      body.validity.toLowerCase().includes("até") ||
      body.validity.toLowerCase().includes("válida")
    )) {
      parts.push(`- Oferta válida: ${body.validity}`);
    }
    ...
  }
```
→ `if (brief.commercial.validity?.enabled && brief.commercial.validity.displayText && campaignIntent === "offer") { parts.push(`- Oferta válida: ${brief.commercial.validity.displayText}`); }` (task 6.2, contract spec scenario "validity com displayText"). **Order of parts must stay identical** (variables identical — golden tests).

**`ImageReviewInput` assembly (382-397) — the seam #5 input (D11):**
```typescript
      const reviewInput: ImageReviewInput = {
        productName: effectiveProductName,
        storeName: brief.store.name,
        campaignIntent: body.campaignIntent ?? "offer",
        preserveImageContext: body.preserveImageContext,
        badgeText: body.badgeText,
        discountedPrice: body.discountedPriceCents
          ? this.formatPriceBRL(body.discountedPriceCents)
          : undefined,
        originalPrice: (body.originalPriceCents ?? 0) > 0
          ? this.formatPriceBRL(body.originalPriceCents ?? 0)
          : undefined,
        validationContext,
        mandatoryArtworkText: body.mandatoryArtworkText,
        campaignDetails: body.campaignDetails,
        additionalDetails: body.additionalDetails,
      };
```
→ Read `brief.commercial.*`; `mandatoryArtworkText` → `brief.commercial.legalNotice?.text` **only when `enabled === true`**; `validity.displayText` when enabled (task 6.5).

**Provider/input-validation seam (task 6.3):** `body.productImageDataUrl` reads (e.g. 427 `hadProductImage: !!body.productImageDataUrl`) → `brief.media.images.find(i => i.role === "primary")?.dataUrl`; base64 lives only in the runtime `media.primary.dataUrl` (never in snapshot — D6/D7).

**Data flow:** request-response (parallel pipeline: validation → prompt assembly → generation → review); seed inputs from domain brief.

---

### `src/lib/copy/mapper.ts` (MOD — mapBriefToCopyDirectorInput reads domain)

**Analog:** self — lines 91-115. Function signature stays; **brief.campaignInput.\*** reads switch to `brief.product.*`/`brief.commercial.*`; output `CopyDirectorInput` unchanged (task 6.4); `legalNotice` must NOT enter copy; `validity.displayText` propagates when `enabled`.

**Exact reads to re-route (91-115):**
```typescript
export function mapBriefToCopyDirectorInput(
  brief: CampaignBrief,
  input: { badgeText?: string; originalPriceCents?: number; discountedPriceCents?: number }
): CopyDirectorInput {
  const campaignIntent = (brief.campaignInput.campaignIntent ?? "offer") as CampaignIntent;
  const discountedPriceCents = input.discountedPriceCents ?? brief.campaignInput.discountedPriceCents;
  const commercialFrame = buildCommercialFrame(campaignIntent, {
    badgeText: input.badgeText ?? brief.campaignInput.badgeText,
    originalPriceCents: input.originalPriceCents ?? brief.campaignInput.originalPriceCents,
    discountedPriceCents,
  });
  return {
    productName: brief.campaignInput.productName,
    description: brief.campaignInput.description,
    commercialFrame,
    campaignIntent,
    storeName: brief.store.name,
    segment: brief.store.segment,
    toneOfVoice: brief.store.toneOfVoice ?? undefined,
    positioning: brief.store.positioning ?? undefined,
    shortDescription: brief.store.shortDescription ?? undefined,
    slogan: brief.store.slogan ?? undefined,
    brandPersonality: brief.brandProfile?.brand_personality ?? undefined,
    campaignGuidelines: brief.brandProfile?.campaign_guidelines ?? undefined,
  };
}
```
→ `brief.campaignInput.productName` → `brief.product.name`; `brief.campaignInput.description` → `brief.product.description`; `brief.campaignInput.campaignIntent` → `brief.commercial.intent`; `brief.campaignInput.discountedPriceCents`/`originalPriceCents`/`badgeText` → `brief.commercial.*`. `description` currently comes from flat `description` (map to `product.description`); `copy` schema (`src/lib/copy/schema.ts:3-21`) unchanged.

**Data flow:** transform (brief → `CopyDirectorInput`); consumed by route.ts:24 + CopyDirectorService.

---

### `src/lib/image-generation/services/image-review-service.ts` (MOD — ImageReviewInput renames + validityText, source changes)

**Analog:** self — `ImageReviewInput` type (9-21) **renames** `mandatoryArtworkText?` → **`legalNoticeText?`** (canônico OpenSpec image-quality-review:17; D9) and **adds** `validityText?` (user decision, ajuste final fase 39); consumers/seam #5 call sites (image-generation-service.ts 382-397 and ~604-620) update the field name in the SAME plan as the interface (regra: nenhum plan termina com typecheck global quebrado), keeping the value sourced from `body.mandatoryArtworkText` until 39-06 re-reads the domain. The section builder `mandatoryArtworkTextSection` (~40+) changes its read to `input.legalNoticeText`. JSDoc: field originates from `commercial.legalNotice.text` (gated on `enabled`) / `commercial.validity.displayText`.

**Exact interface (9-21) — after 39-05:**
```typescript
export interface ImageReviewInput {
  productName: string;
  storeName: string;
  campaignIntent?: CampaignIntent;
  preserveImageContext?: boolean;
  badgeText?: string;
  originalPrice?: string;
  discountedPrice?: string;
  validationContext?: ValidationContext;
  legalNoticeText?: string;  // renamed from mandatoryArtworkText (canônico D9)
  campaignDetails?: string;
  additionalDetails?: string;
  validityText?: string;     // NOVO (ADITIVO) — quando validity.enabled
}
```

**Data flow:** request-response (AI vision review); prompt vars `mandatoryArtworkTextSection` (builds at ~40+) consume `input.legalNoticeText` — reviewer receives empty/undefined when `enabled=false` (D9, task 6.5). `mandatoryArtworkText` permanece APENAS no transporte flat/form (GenerateImageRequestSchema 21) e no mapper flat→brief (legalNotice).

---

### `src/lib/campaign/types.ts` (MOD — `InputSnapshot` → `CampaignBriefSnapshot`)

**Analog:** self — `InputSnapshot` (38-58) is replaced by a **type re-export/alias to the domain snapshot** defined in `brief.ts` (task 5.4/F39-14). Keep any code referencing `InputSnapshot`-shaped object compatible or update callers (currently **zero imports of `InputSnapshot` in src/** — CONTEXT confirms it's dead type since `route.ts` builds an anonymous flat object).

**Dead interface being replaced (38-58) — snapshot `productImage` becomes the `media.images[]` list:**
```typescript
export interface InputSnapshot {
  productName: string;
  originalPriceCents?: number;
  discountedPriceCents?: number;
  badgeText?: string;
  hook?: string;
  cta?: string;
  description?: string;
  objective?: string;
  campaignDetails?: string;
  additionalDetails?: string;
  targetChannel?: string;
  format?: string;
  validity?: string;
  availabilityNotes?: string;
  sensitiveConstraints?: string;
  inputValidationOverride?: string;
  campaignIntent?: CampaignIntent;
  productImage: { provided: true; mimeType: string };
  preserveImageContext?: boolean;
}
```

**Replace with (D6):**
```typescript
import type { CampaignBriefSnapshot } from "./brief";
// keep name or alias: export type { CampaignBriefSnapshot } ...
//  - schemaVersion "campaign_brief_v1" at ROOT
//  - product / commercial / media: { images: CampaignBriefSnapshotImage[] } /
//    creativeContext / metadata (NO schemaVersion in snapshot metadata)
```
`CampaignRecord.input_snapshot` (types.ts:10) stays `Record<string, unknown> | null` (jsonb tolerant; no migration — D6).

**Data flow:** transport/persistence shape (dead interface until F37 consumes it).

---

### `scripts/benchmark.ts` (MOD — build structured brief via mapper)

**Analog:** self — brief flat build (332-369) with `as any` cast (375). Co-migration: keep flat `scenario.campaign` payload, call `buildCampaignBriefFromFlat(payload, 'benchmark')` then wrap into the transport shape the service still expects (or pass structured brief via the new seams), **without breaking scenario 10 `detalhes-variados`** (validity heuristic currently exercised there — specifics note; task 9.3/8.14 compat).

**Exact block to replace (332-375):**
```typescript
    // ── Build request (wrapped as CampaignBrief) ────────────────────
    const brief = {
      campaignInput: {
        productName: scenario.campaign.productName,
        storeId: 'benchmark',
        originalPriceCents: scenario.campaign.originalPriceCents,
        discountedPriceCents: scenario.campaign.discountedPriceCents,
        badgeText: scenario.campaign.badgeText,
        hook: scenario.campaign.hook,
        cta: scenario.campaign.cta,
        description: scenario.campaign.description,
        objective: scenario.campaign.objective,
        campaignDetails: scenario.campaign.campaignDetails,
        additionalDetails: scenario.campaign.additionalDetails,
        availabilityNotes: scenario.campaign.availabilityNotes,
        validity: scenario.campaign.validity,
        targetChannel: scenario.campaign.targetChannel,
        format: scenario.campaign.format,
        campaignIntent: "offer",
        productImageDataUrl: imageDataUrl,
      },
      store: { name: scenario.store.name, segment: scenario.store.segment, ... },
      brandProfile: null,
      identity: { state: 'logo' as const, imageUrl: ..., directive: ... },
    };

    let result: BenchmarkResult;
    try {
      const generationResult = await service.generateImage(brief as any);   // ← cast removal
```

**Data flow:** batch (compat benchmark loop); pure construction via mapper; stores identity wrapper separately as today.

---

### Test fixture co-migrations (MOD)

**`route.test.ts`** — `src/app/api/campaign/generate-image/__tests__/route.test.ts`
- Analog: self. Mock setup lines 23-27 (`buildCampaignBrief: vi.fn()`) stays; the **dozens of `mockResolvedValue({ campaignInput: {}, store: {} })`** (218, 432, 460, 480, 569, 595, 678, 706, 744, 831) need the brief fed back to the route to now be a **structured domain brief produced by `buildCampaignBriefFromFlat`** (fixtures must return full `ResolvedCampaignContext`-shape objects with `campaignInput` still present, or the mock now returns `{ product, commercial, media, creativeContext, metadata }` + `store`+`identity` — task 9.1). Exact mock pattern to preserve:
```typescript
  (buildCampaignBrief as any).mockResolvedValue({
    campaignInput: { productName: 'Produto Teste', discountedPriceCents: 1990 },
    store: { name: 'Loja Teste', segment: 'outros' },
  });
```
- Also assert pre-F39 old-format campaigns still render (UAT 10.5 / snapshot spec scenario "campanha antiga pré-F39").

**`image-generation-service.test.ts`** — `src/lib/image-generation/services/__tests__/image-generation-service.test.ts`
- Analog: self `createMinimalBrief` (13-39) — re-build as structured brief (`product`/`commercial`/`media`/`creativeContext`/`metadata`); keep override-spread helper. Golden tests (task 9.4/8.16): assert `buildPromptVariables` produces the **same variable set/key names** as pre-F39 for the same input per intent offer/spotlight/exclusive.

**`image-review-service.test.ts`** — `src/lib/image-generation/services/__tests__/image-review-service.test.ts`
- Analog: self — `ImageReviewInput` literals (36-42, 89, 120, 138, 156-166, 172, 189-193, 208, 226, 243, 253) are already domain-shaped (this file only gets a **new `legalNotice.enabled=false` → no text** contract case + `validity.displayText` case; input type unchanged — task 9.2/8.20).

**Data flow:** unit/contract fixtures.

---

## Runbook trackings (D1 — no code analog; doc-edit pattern)

All 6 are **markdown doc edits** (no code pattern to copy — edit in-place; chronological history not rewritten). Source of truth: `openspec/changes/fase-39-brief-estruturado-campanha/`.

| File | Edit (per tasks 1.1-1.6) | Verified current state |
|------|--------------------------|------------------------|
| `ROADMAP.md` (root) | F39 line → Brief v1.5 (already present at 206: `39. Brief Estruturado de Campanha`); add F40 Stripe row (207 exists ✓); bullet in `<details open>` v1.5 (57/62 mentions `brief estruturado` ✓) | Largely done |
| `.planning/ROADMAP.md` | Phase numbering note (7 ✓ already F39/F40); Progress table (39-40 ✓); renumeração notes (406/467 ✓); Dependencies "Phase 39 (Stripe)" → F40 (~571/617/644/661 — check remaining); Dependency Graph (~734/750-769 ✓); "### Phase 39" section (to add); footer "Last updated" (855) | Mixed: Dependencies + Phase-39 section pending |
| `.planning/STATE.md` | `current_phase: 39` (21 ✓); Next Phases table F39 in progress/F40 future (687-688 ✓); body/Last updated (19 ✓) | Mostly done; verify Next-Phases table |
| `.planning/PROJECT.md` | Line 48 "Stripe... F39" → **F40** (`- **Stripe / compra real de créditos**: adiado para F39 (v1.7, pós-beta)` → F40) | **Pending** |
| `.planning/REQUIREMENTS.md` | ~563-565 "Stripe será implementada como F39/v1.7" → **F40/v1.7** (line 565 still says F39) | **Pending** |
| `.planning/MILESTONES.md` | Line 20 "Stripe... v1.7 (F39)" → **(F40)** (`- Stripe / Monetização Pública diferido para v1.7 (F39)`) | **Pending** |

---

## Shared Patterns

### Absence rule (D8/D9 — applies to mappers, brief-builders, snapshot builder and all contract tests)
**Source:** CONTEXT constraints + contract spec "Regra canônica de ausência" (spec line 120, 32, 90). Convention, not code: **campo não informado no transporte → ausente** (`undefined`/absent) no contrato e no snapshot. **Never** fabricate `{ enabled: false }` for `validity`/`legalNotice`. Tested via `expect(brief.commercial.validity).toBeUndefined()` (pattern from `store.test.ts:269-272`).

### Base64 never in snapshot (D6/D7 — applies to `brief.ts` types, `buildCampaignBriefSnapshot`, snapshot tests, route)
**Source:** two `CampaignBriefSnapshotImage` (no `dataUrl` field — enforcement by type) + recursive key-scan test (`dataUrl`/`base64`/`data:image/`). Precedent: `route.ts:379` `productImage: { provided: true, mimeType: "image/jpeg" }` (today) and F38.2.1 immutable-by-construction snapshot philosophy.

### Exactly-1-primary invariant (D7 — applies to `brief-schema.ts` + contract tests + route 400 rule)
**Source:** zod refine on `mediaSchema` counting `images.filter(i => i.role === "primary")`; transport edge rule already enforced by `schema.ts:30` `.min(1)` → route 400 path (route.ts:137-154).

### Generated-behavior preservation (D11 — applies to prompt seams + copy + review + golden tests)
**Source:** `buildPromptVariables` returns same 38 keys; `buildCommercialRepertoire` part ordering and wording identical; `CopyDirectorInput` (copy/schema.ts:3-21) unchanged; `ImageReviewInput` shape unchanged. Verified by golden tests per intent and compat fixture `scripts/benchmark.ts`.

### Error handling (route unchanged — applies only to new mapper code)
`buildCampaignBriefFromFlat` is **pure** (no DB, no throw beyond zod surface) — no try/catch needed; route-level errors keep the existing 400/404/500 blocks (route.ts:137-177, 220-235, 391+). Domain code throws only via zod schema `.safeParse`/`parse` — pattern: `schema.ts:8` + route.ts:137-154 (`safeParse` → `flatten().fieldErrors`).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `brief-snapshot.test.ts` recursive base64 scan | test | transform-verify | No existing recursive key-scan test in repo — build new from `createMinimalBrief` fixture + plain TS recursion; the D12 scan assertion is novel |
| (minor) `input_snapshot` versioned root `schemaVersion` read-back | persistence | read | `CampaignRecord`/`persistence.ts` treat snapshot as opaque `Record<string, unknown>` (no reader exists yet — F37 consumes); **no analog needed** this phase |

---

## Metadata

**Analog search scope:** `src/lib/campaign/`, `src/lib/image-generation/`, `src/components/campaign/`, `src/lib/copy/`, `src/lib/actions/__tests__/`, `src/app/api/campaign/generate-image/`, `scripts/`, `.planning/`, `openspec/changes/fase-39-brief-estruturado-campanha/`
**Files scanned:** 20 code + 8 spec/dir files (13 read in full or targeted ranges)
**Pattern extraction date:** 2026-08-13
**Key precedent referenced:** F38.2.1 economic snapshot (immutable-by-construction philosophy — `.planning/phases/38.2.1-economic-snapshot/`), `identity_snapshot`/`render_snapshot` in `campaign/types.ts`