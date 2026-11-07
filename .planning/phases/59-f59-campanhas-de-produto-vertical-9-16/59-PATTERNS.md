# Phase 59: F59 — Campanhas de Produto vertical 9:16 — Pattern Map

**Mapped:** 2026-11-04
**Files analyzed:** 41 (planned new/modified)
**Analogs found:** 39 / 41 (2 have no campaign-analog: paid provider proof harness, docs/runbook)
**Scope guard:** new Product flow only. Every pattern below is **additive with 1:1 defaults**; the 1:1 runtime must never import `src/lib/product-vertical-9-16/**`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/product-vertical-9-16/format.ts` (new) | utility (pure contract) | transform | `src/lib/campaign/new-flow-marker.ts` | exact |
| `src/lib/product-vertical-9-16/safe-area.ts` (new) | config/policy (pure) | transform | `src/lib/product-1-1/policies/formato-1-1.ts` + `thumbnail-path.ts` constants | role-match |
| `src/lib/product-vertical-9-16/dimensions.ts` (new) | utility (pure) | transform | `src/lib/campaign/thumbnail/thumbnail-path.ts` | role-match |
| `src/lib/product-vertical-9-16/artifact/artifact-path.ts` (new) | utility (pure) | transform | `src/lib/product-1-1/artifact/artifact-path.ts` | exact |
| `src/lib/product-vertical-9-16/artifact/artifact-store.ts` (new) | service | file-I/O (sharp + storage) | `src/lib/product-1-1/artifact/artifact-store.ts` | exact |
| `src/lib/product-vertical-9-16/artifact/types.ts` (new) | model/types | — | `src/lib/product-1-1/artifact/types.ts` | exact |
| `src/lib/product-vertical-9-16/artifact/download-gate.ts` (new or reuse) | utility (pure decision) | request-response | `src/lib/product-1-1/artifact/download-gate.ts` | exact |
| `src/lib/product-vertical-9-16/prompt/policy-formato-9-16.ts` (new) | config/policy | transform | `src/lib/product-1-1/policies/formato-1-1.ts` | exact |
| `src/lib/product-vertical-9-16/prompt/registry.ts` + `composition.ts` (new) | service (pure) | transform | `src/lib/product-1-1/policies/registry.ts`, `prompt-composition.ts` | exact |
| `src/lib/product-vertical-9-16/orchestration/entrypoint.ts` (new) | service/orchestrator profile | request-response (NDJSON) | `src/lib/product-1-1/orchestration/generation-orchestrator.ts` (call site) | role-match |
| `src/lib/product-vertical-9-16/cost/vertical-estimate.ts` (new) | service | transform | `src/lib/ai-cost/image-pair-pricing.ts` + `pilot/spend-control.ts` | role-match |
| `src/lib/product-vertical-9-16/recovery/format-dispatch.ts` (new) | utility (pure decision) | transform | `src/lib/product-1-1/artifact/download-gate.ts` + `src/lib/campaign/new-flow-marker.ts` | role-match |
| `src/lib/product-vertical-9-16/recovery/pending-adapter.ts` (new) | service (server-only adapter) | CRUD read | `src/lib/product-1-1/pending/pending-operations-repository.ts` | role-match |
| `src/lib/product-vertical-9-16/telemetry/format-attempt.ts` (new) | utility (pure telemetry) | transform | `src/lib/ai/telemetry-sink.ts` (`buildCallMetadata`) | role-match |
| `src/lib/product-vertical-9-16/telemetry/vertical-images-adapter.ts` (new) | service (server-only adapter) | transform | `src/lib/ai/adapters/upstream-images.ts` + `telemetry-sink.ts` | role-match |
| `src/lib/product-1-1/orchestration/generation-orchestrator.ts` (mod) | service/orchestrator | request-response | itself (lines 359-440, 1184-1205, 1423-1430) | exact |
| `src/lib/product-1-1/prompt-composition.ts` (mod) | service (pure) | transform | itself (lines 120-171) | exact |
| `src/lib/product-1-1/policies/registry.ts` (mod, optional resolver seam) | config | transform | itself (108-155) | exact |
| `src/lib/product-1-1/orchestration/project-delivered-campaign.ts` (mod) | service | CRUD (DB update) | itself (116-120, 152-160) | exact |
| `src/lib/product-1-1/artifact/artifact-recovery.ts` (mod) | service | request-response | itself (80-112, 219-329) | exact |
| `src/lib/product-1-1/pending/pending-operations-repository.ts` (mod) | repository | CRUD | itself (87-111, 185-218) | exact |
| `src/lib/product-1-1/pending/resolve-pending-operation.ts` (mod) | service | request-response | itself (152-176, 288-358) | exact |
| `src/lib/campaign/thumbnail/thumbnail-path.ts` (mod) | utility (pure) | transform | itself (24-58, 61-98) | exact |
| `src/lib/campaign/display.ts` (mod) | model/mapper (pure) | transform | itself (419-558) | exact |
| `src/lib/campaign/new-flow-marker.ts` (mod, optional) | utility (pure) | transform | itself (27-49) | exact |
| `src/lib/image-generation/schema.ts` (mod) | config/schema | request-response | itself (84-92) | exact |
| `src/lib/feature-flags/feature-flag-service.ts` (mod) | config/service | CRUD (read) | itself (9-18, 34-42, 180-241) | exact |
| `src/lib/ai-cost/image-pair-pricing.ts` (mod or new vertical resolver) | service | transform | itself (196-218) | exact |
| `src/lib/product-1-1/pilot/spend-control.ts` (mod, optional) | service/gate | request-response | itself (145-196) | exact |
| `src/app/api/campaign/generate-image/route.ts` (mod) | route/controller | request-response (NDJSON) | itself (278-345, 382-520, 971-988) | exact |
| `src/app/api/campaign/[id]/download/route.ts` (mod) | route/controller | file-I/O | itself (63-110) | exact |
| `src/app/api/campaign/[id]/image-recovery/route.ts` (mod) | route/controller | request-response | itself (151-220) | exact |
| `src/app/(app)/campanhas/[id]/page.tsx` (mod) | page (RSC) | CRUD read | itself (141-154) | exact |
| `src/app/(app)/campanhas/[id]/client.tsx` (mod) | component | rendering | itself (356-365, 707-716) | exact |
| `src/app/(app)/campanhas/nova/page.tsx` (mod) | page (RSC) | CRUD read | itself (76-139) | exact |
| `src/components/flow/campaign-input-form.tsx` (mod) | component | rendering | itself (268-300, 780-789, 880-896) | exact |
| `src/components/flow/use-campaign-form.ts` (mod) | hook | client state → HTTP | itself (585-707, 714-737) | exact |
| `src/components/flow/campaign-format-selector.tsx` (new) | component | rendering | `src/components/flow/background-direction-selector.tsx` | exact |
| `src/components/flow/campaign-brief-review.tsx` (mod) | component | rendering | itself (148-186) | exact |
| `src/app/(app)/admin/product-1-1-pending/page.tsx` (mod) | page (RSC) | CRUD read | itself (26-41) | exact |
| `src/app/(app)/admin/product-1-1-pending/resolution-form.tsx` (mod) | component | rendering | itself (30-43, 62-67) | exact |
| `supabase/migrations/YYYYMMDDHHmmss_f59_product_9_16_flag.sql` (new) | migration (data-only) | seed | existing `INSERT ... ON CONFLICT DO NOTHING` flag seeds | exact |
| `docs/**` runbook (new/mod) | doc | — | existing ops runbooks | role-match |
| Provider proof harness/report (new, homolog) | test/tooling | batch (paid calls) | `src/lib/product-1-1/pilot/*` + `src/lib/lab/**` harness | partial |

---

## Pattern Assignments

### `src/lib/product-vertical-9-16/format.ts` (utility, transform)

**Analog:** `src/lib/campaign/new-flow-marker.ts` (whole file, 49 lines).

**Contract shape to copy** (lines 16-49): exported const key + discriminated result type + a single pure resolver that never throws, plus a boolean shortcut.

```ts
export const FROZEN_CONTENT_REFERENCES_KEY = "frozenContentReferences" as const;
export type CampaignFlowClassification = "new_flow" | "legacy" | "indeterminate";
export function classifyCampaignFlow(inputSnapshot: Record<string, unknown> | null | undefined): CampaignFlowClassification {
  if (inputSnapshot === null || inputSnapshot === undefined) return "legacy";
  if (typeof inputSnapshot !== "object" || Array.isArray(inputSnapshot)) return "indeterminate";
  return Object.prototype.hasOwnProperty.call(inputSnapshot, FROZEN_CONTENT_REFERENCES_KEY) ? "new_flow" : "legacy";
}
```

Vertical resolver must return a **discriminated union**, not booleans: absence of BOTH keys ⇒ `{kind:"1:1"}`; `9:16` + `f59-vertical-9-16-v1` ⇒ `{kind:"9:16"}`; any other combination ⇒ `{kind:"unavailable", reason}` (missing/malformed/unsupported/incoherent). No fallback to 1:1 for a malformed vertical (D-02, spec `format-selection` §"Format and contract version are validated as a pair").

**Test analog:** `src/lib/product-1-1/__tests__/snapshot-preflight.contract.test.ts` (table-driven fail-closed cases) and `prompt-composition.contract.test.ts` (asserts exact version strings).

**Landmines:**
- `classifyCampaignFlow` is the flow gate for download/recovery/detail. Format resolution is a **second, orthogonal** read; do not fold format into `classifyCampaignFlow` (would reclassify legacy campaigns and break the download/thumbnail-safely tests).
- `1:1` new-flow campaigns must return `1:1` without requiring version keys — `snapshot-preflight` and route idempotency compare persisted snapshots byte-for-byte.
- Empty-string / `undefined` / `null` inside `input_snapshot`: **only absent keys mean the historical 1:1**. Both keys absent ⇒ `1:1`; a PRESENT `campaignFormat` with `null`/`""`/non-string ⇒ malformed/unavailable; a present `formatContractVersion` without `campaignFormat` ⇒ incoherent/unavailable; a version-only or `9:16`-without-recognized-version ⇒ unavailable. Never treat a present-but-empty value as "missing". 59-08 restore uses this same table.

---

### `src/lib/product-vertical-9-16/safe-area.ts` (policy, transform)

**Analog:** `src/lib/product-1-1/policies/formato-1-1.ts` (immutable policy object + exported `*_VERSION`) and `thumbnail-path.ts` (frozen numeric constants with `as const`).

```ts
export const FORMATO_1_1_POLICY_VERSION = "48.2.4-formato-1-1-v1";
export const formato11Policy: ProductPromptPolicy = {
  id: "policy.formato.1-1", dimension: "formato", value: "1:1", version: FORMATO_1_1_POLICY_VERSION,
  contributions() { return [{ block: PRODUCT_PROMPT_BLOCK_LABELS.intent, lines: ["Formato: quadrado 1:1, ..."] }]; },
};
```

Vertical policy must expose `SAFE_AREA_9_16_VERSION = "safe-area-9-16-v1"`, `Object.freeze` percentages + derived px for a 1080×1920 canvas, the bottom-right rect (324×768), and a per-value `provenance: "documented" | "conservative" | "pending"`. Derive px from **constants**, never from runtime multiplication of floats in the prompt text (golden prompt tests).

**Test analog:** `src/lib/campaign/thumbnail/__tests__/thumbnail-path.test.ts` (pure constants/pattern assertions).

**Landmines:**
- Pixel values must be stable integers: top 269, bottom 672, sides 65, corner 324×768. Do not round differently per call site.
- Version string is frozen into `policy_versions`; a later change requires `v2` (spec `safe-area` §"Policy version is frozen").
- Prompt text must mark pending values as pending; never phrase them as a platform guarantee (copy rule, UI-SPEC §11).

---

### `src/lib/product-vertical-9-16/dimensions.ts` (utility, transform)

**Analog:** `src/lib/campaign/thumbnail/thumbnail-path.ts` consts + `artifact-store.ts` `ARTIFACT_SIZE` (line 34).

Export frozen `PROVIDER_SIZE = "1152x2048"`, `DELIVERED_WIDTH = 1080`, `DELIVERED_HEIGHT = 1920`, `DOWNSCALE_FACTOR = 0.9375`, and a pure `assertProviderDimensions(width,height)` returning a typed result. Keep the 16-divisibility comment next to the constant.

**Landmines:** never derive provider size by string-replacing `1080`; 1080/16 = 67.5 (explicitly rejected in spec `generation-delivery` §"Requested provider size"). Tests must assert the string literal `"1152x2048"`.

---

### `src/lib/product-vertical-9-16/artifact/artifact-path.ts` (utility, pure)

**Analog:** `src/lib/product-1-1/artifact/artifact-path.ts` (18 lines).

```ts
export const NEW_FLOW_ARTIFACT_PATH_RE =
  /^[0-9a-f]{8}-...\/product-1-1\/...\/art-1024\.jpg$/i;
export function artifactStoragePath(storeId, campaignId, operationId): string {
  return `${storeId}/${campaignId}/product-1-1/${operationId}/art-1024.jpg`;
}
```

Vertical: same UUID regex segments, `product-9-16`, `art-1080x1920.jpg`. Pure module — **no `server-only`, no `sharp`** (projection and tests import it).

**Test analog:** `src/lib/product-1-1/__tests__/artifact-store.contract.test.ts` (path/regex assertions) + `thumbnail-path.test.ts`.

**Landmines:**
- The 1:1 regex is anchored and case-insensitive; a vertical path must **not** match `NEW_FLOW_ARTIFACT_PATH_RE` (assert negative test). `downloadArtifact`/`getSignedArtifactUrl` in the 1:1 store refuse non-matching paths — the vertical store needs its own RE, not a widened 1:1 one.
- `thumbnail-path.ts` has its own `NEW_FLOW_PATH_RE` (line 41-44); a third regex must be added there (see below), not imported from the vertical module (thumbnail module must stay dependency-free).

---

### `src/lib/product-vertical-9-16/artifact/artifact-store.ts` (service, file-I/O)

**Analog:** `src/lib/product-1-1/artifact/artifact-store.ts` — the single most important analog. Copy its **structure and invariants**, not its constants.

**Imports/guard** (lines 1-19): `import "server-only"`, `sharp`, `SupabaseClient`, `supabaseAdmin`, `dataUrlToCampaignImage`, thumbnail helpers, typed errors, path module.

**Verified dimensions by full decode** (lines 94-110) — the critical pattern:

```ts
const metadata = await sharp(buffer).metadata();
if (metadata.format !== "jpeg") throw new Error(`artifact_format_not_jpeg: ${String(metadata.format)}`);
const decoded = await sharp(buffer, { failOn: "error" }).raw().toBuffer({ resolveWithObject: true });
const { width, height } = decoded.info;
if (width !== ARTIFACT_SIZE || height !== ARTIFACT_SIZE) throw new Error(`artifact_dimension_mismatch: ${width}x${height}`);
return { width, height, mimeType: "image/jpeg" };
```

Vertical pipeline (`resizeVerticalToJpeg1080x1920`): decode → assert source exactly 1152×2048 → assert aspect equality (avoid silent distortion) → `sharp(...).resize(1080,1920,{fit:"fill"?})` **without** `contain`+background (would create bands) → `.toColorspace("srgb").jpeg({quality:90})` → `verifyJpeg1080x1920`. Do **not** copy `.resize(...,{fit:"contain",background:"#FFFFFF"})` (line 63) — that is exactly the letterbox behavior D-06 forbids.

**Upload/metadata** (lines 226-260): `storage.from("campaign-images").upload(path, buffer, {contentType:"image/jpeg", upsert:false})`; map upload errors (`409`/already exists → `artifact_path_conflict`); insert into **`product_1_1_campaign_artifacts`** with decoded `width/height/mime_type`, keyed `(campaign_id, operation_id)`.

**Probe** (lines 404-484): typed union `integral|absent|invalid|indeterminate`; metadata read failure is ignored (`try/catch → null`); download exception ⇒ `indeterminate` (never `absent`); `isAbsenceError` (138-146) only accepts `404` whose message names the **object** and not the bucket. Reuse this exact absence classifier. Vertical probe must verify **1080×1920** and compare against persisted metadata defaults `1080`/`1920`.

**Signed URL** (371-393): separate method, path guard, server TTL, never called by probe (I3).

**Error types** (types.ts 44-62): copy the discriminated `ArtifactProbe` and `ProductOneToOneArtifactUploadError` shape, but define a vertical error class (or reuse `ArtifactProbe` type only). Do not overload `ProductOneToOneArtifactErrorCode` with vertical codes unless both stores stay compatible.

**Thumbnail call** (262-279): best-effort, strictly after original + metadata, wrapped in `try{}catch{}`; pass the same `ThumbnailContext`. Result must never change delivery/credit.

**Test analog:** `src/lib/product-1-1/__tests__/artifact-store.contract.test.ts` — `// @vitest-environment node`, `vi.mock("server-only")`, `vi.mock("@/lib/supabase/server")`, a hand-rolled fake `SupabaseClient` recording `uploads/inserts/downloads/signed`, and `sharp({create:{...}})` fixtures. Mirror this harness for the vertical store; add a fixture at 1152×2048 and assert the uploaded buffer decodes to 1080×1920.

**Landmines (high severity):**
- `ARTIFACT_SIZE = 1024` and `verifyJpeg1024` are module-local; **do not export/parameterize them** — copying them into a new module is cheaper and keeps 1:1 byte-identical.
- `ProductOneToOneArtifactStore` constructor uses **private** `client`/`thumbnailContext` (TypeScript `private`), so structural injection is not possible from tests. The vertical store must accept `deps` explicitly (like `ArtifactRecoveryDeps`) rather than relying on `private readonly` fields.
- The table has no format column; identity is `(campaign_id, operation_id)`. Never write a vertical row with `art-1024.jpg` or `1024` dimensions.
- `getSignedArtifactUrl` must be refused by the *other* store's path regex; assert this in tests so a vertical campaign cannot sign a 1:1 object.

---

### `src/lib/product-vertical-9-16/artifact/download-gate.ts` (pure decision)

**Analog:** `src/lib/product-1-1/artifact/download-gate.ts` (80 lines).

Copy the structure exactly: input `{operationStatus, artifactProbe, unknown?}`, `allowed/reason/storagePath|null` frozen result, terminal precedence (`delivered`/`refunded` beat `unknown`), and `artifactProbe.kind !== "integral" ⇒ blocked`. For vertical the only change is that the probe comes from the vertical store; the gate logic is format-agnostic. Prefer **reusing** the 1:1 gate function unchanged (it returns `probe.storagePath`) rather than duplicating.

**Landmine:** the route must never fall back to the 1:1 gate/store when format is malformed — format resolver runs first and returns 503/403.

---

### `src/lib/product-vertical-9-16/prompt/*` + `src/lib/product-1-1/prompt-composition.ts` (pure composition)

**Analog (1:1):** `prompt-composition.ts` 15, 28-53, 120-171 and `policies/registry.ts` 22-80, 108-155.

Composer is a deterministic serializer with fixed block order:

```ts
export const PROMPT_BLOCK_ORDER = Object.freeze([identity, typography, product, commercial, intent, promptBase, constraints]);
export function composeProductPrompt(input): ProductPromptComposition {
  const resolvedPolicies = resolveProductOneToOnePromptPolicies({ briefing, references });
  ...
  return { text: parts.join("\n\n"), blocks: Object.freeze(blocks), composerVersion: COMPOSER_VERSION,
           promptBaseVersion: PROMPT_BASE_VERSION, policyVersions: Object.freeze({...resolvedPolicies.versions}) };
}
```

**Extension point (D-01/D-10):** add a single optional parameter to `composeProductPrompt`, e.g. `resolver?: (input) => ResolvedProductPromptPolicies` (default `resolveProductOneToOnePromptPolicies`) and optionally `composerVersion`/`formatPolicy` contributions. Do **not** add a `formato: "9:16"` entry to `PRODUCT_1_1_PROMPT_POLICY_REGISTRY` — mutating the 1:1 registry changes `validateProductOneToOnePromptPolicyRegistry` expectations and the 1:1 `policyVersions` object. The vertical module should build its own frozen registry that composes 1:1 policies + `policy.formato.9-16` + safe-area contribution.

**Test analog:** `src/lib/product-1-1/__tests__/prompt-composition.contract.test.ts` (exact `COMPOSER_VERSION`, 7 blocks, policy versions, general integrity once) and `prompt-composition.equivalence.test.ts` (byte equality).

**Landmines:**
- `COMPOSER_VERSION` and `PROMPT_BASE_VERSION` are asserted literally in tests. Keep 1:1 values unchanged; vertical needs its **own** composer version constant, recorded in `policy_versions`.
- `PROMPT_BLOCK_LABELS` has exactly 7 entries and tests assert `toHaveLength(7)`. The 9:16 policy must reuse `intent` (like `formato-1-1`) or `constraints`; do not introduce a new block label in the shared enum.
- `policyVersions` is part of `computeContentFingerprint`; changing keys for 1:1 breaks snapshot binding.
- Vertical policy text must include: 9:16 canvas, full-bleed background, safe areas, prohibition of guides/letterbox/borders, "comprehensible without external caption" (spec `safe-area` §"Vertical prompt derives from the approved 1:1 baseline").

---

### `src/lib/product-vertical-9-16/orchestration/entrypoint.ts` (service/profile)

**Analog:** `src/lib/product-1-1/orchestration/generation-orchestrator.ts` — read as a **call site profile**, not as code to clone.

**Injection seams already present** (lines 359-440 `ProductOneToOneGenerationDeps`):

```ts
readonly runPreflight?, buildSnapshot?, persistSnapshot?, credit?, attempts?, artifact?, createGateway?,
readonly projectDeliveredCampaign?: typeof projectDeliveredCampaign;
readonly pilotSpend?: PilotSpendGate;
```

**Defaults resolution** (579-648): `const artifact = deps.artifact ?? new ProductOneToOneArtifactStore();`, etc. The vertical entrypoint must call `runProductOneToOneGeneration(verticalInput, { artifact: verticalStore, projectDeliveredCampaign: verticalProjection, pilotSpend, ... })`, adding three **new** optional deps: `composePrompt`, `imageSize` and `beforeReservation` (the vertical pre-reservation estimate/budget guard; default `undefined` keeps 1:1 identical).

**Provider call** (1423-1430) — the hardcoded size to parameterize:

```ts
const request: AiInvocationRequest = {
  ...providerImageRequest(input),
  prompt: composition.text,
  quality: target === "fallback" ? snapshot.fallbackQuality : snapshot.primaryQuality,
  size: "1024x1024",
  signal: controllerAbort.signal,
};
```

Change to `size: imageSize ?? "1024x1024"` where `imageSize` comes from deps with default `"1024x1024"`. Composition at line 1184 must become `const composition = composePrompt ? composePrompt(input) : composeProductPrompt({...})`, default preserving today's args exactly.

**Landmines:**
- `AiInvocationRequest.size?: string` **already exists** (`src/lib/ai/types.ts` ~75; adapter reads `request.size ?? "1024x1024"`, upstream-images.ts:123). Parameterize only the orchestrator literal; do not re-declare the field.
- `storeArtifact` input type is `{storeId, campaignId, operationId, imageDataUrl}` (270-287). The vertical store must accept the **same shape** so injection is structural; don't add a `format` field to the shared `ProductOneToOneArtifactOps` (would break 1:1 fakes).
- `projectCampaign({storeId,campaignId,operationId})` is called at 1668; the vertical projection must already be bound to the vertical expected path. `expectedArtifactPath` belongs to the **input** type, and the second argument is `deps` (`{ client }`): `projectDeliveredCampaign({ ...input, expectedArtifactPath }, { client })`. Never pass it as the second argument; the implementation reads `input.expectedArtifactPath ?? artifactStoragePath(...)`.
- The orchestrator emits NDJSON and must keep exactly one terminal event. The vertical entrypoint must return the same `Response`; do not wrap/re-serialize.
- Credit/fence order is inside the orchestrator (reserve 1232-1240 → beginPublication 1583-1592 → storeArtifact 1594-1600 → markArtUploaded 1636-1643 → deliver 1644 → project 1667-1676). Do not re-implement; only inject ops.

---

### `src/lib/product-vertical-9-16/cost/vertical-estimate.ts` + `image-pair-pricing.ts` (cost gate)

**Analog:** `src/lib/ai-cost/image-pair-pricing.ts` (196-218) for `resolveCost` shape, and `pilot/spend-control.ts` (145-196) for the pre-call gate.

```ts
async resolveCost(config: ImageModelPairConfig): Promise<ImagePairCostResolution> {
  const coverage = await this.assertExecutable(config);
  return { primary: await this.attemptCost(config.primary, coverage), fallback: await this.attemptCost(config.fallback, coverage) };
}
// attemptCost -> { model, quality, costUsd: result.pricing.imageUnitCostUsd ?? null, versionId, costSource, pricing }
```

`beginPaidCall` hard-fails without a finite positive estimate (lines 152-156: `estimate_required`), so **the vertical multiplier must be resolved before the first paid call** and passed as `estimatedUsd`.

**Required behavior:** a versioned vertical estimator keyed by `model+quality` returning `image_unit_usd * multiplier` (or, if the proof proves equivalence, `multiplier = 1` with documented evidence). Missing estimate ⇒ blocked, never fall back to the 1024 estimate (spec `generation-delivery` §"Pre-call cost estimate is resolution-aware"). Record `estimated_usd`, provider-reported cost and deviation per attempt.

**Test analog:** `credit-operation.contract.test.ts` + `copy-recovery-pilot.contract.test.ts` (fake gate/estimator injection; assert `estimate_required` path).

**Landmines:** `AiModelPricingService` rejects `versionId === "code_default"` for the new flow (image-pair-pricing 119-123); vertical must inherit that rejection. Do not mutate `ImagePairPricingService` cache keys — add a separate vertical key or wrapper.

---

### `src/lib/product-1-1/orchestration/project-delivered-campaign.ts` (mod)

**Analog:** itself.

Add `expectedArtifactPath?: string` to `ProjectDeliveredCampaignInput` (46-50) and replace the hardcoded path at 116-120:

```ts
const expectedArtifactPath = artifactStoragePath(input.storeId, input.campaignId, input.operationId);
```

with `input.expectedArtifactPath ?? artifactStoragePath(...)`. Keep every guarantee: operation must be `delivered`, campaign must belong to the same store, artifact row must exist **and** its `storage_path` must equal the expected path, idempotent no-op (142-149), never throws (171-178).

**Test analog:** `src/lib/product-1-1/__tests__/project-delivered-campaign.contract.test.ts` — add a vertical case asserting `ready` + vertical path and an `artifact_missing` case when the row points at `art-1024.jpg`.

**Landmines:** changing the signature is safe only if the param is optional; the orchestrator passes an object without it (1668) and recovery/admin call sites pass objects too. Never infer path from `campaign.storage_path` (could be stale).

---

### `src/lib/product-1-1/artifact/artifact-recovery.ts` (mod)

**Analog:** itself (80-112 deps, 219-329 recover).

Current seams:

```ts
export interface ArtifactRecoveryDeps {
  readonly artifacts?: ArtifactRecoveryProbe;           // { probeArtifact }
  readonly credit?: ArtifactRecoveryCreditOps;
  readonly projectDeliveredCampaign?: typeof projectDeliveredCampaign;
}
constructor(client = supabaseAdmin, deps = {}) {
  this.artifacts = deps.artifacts ?? new ProductOneToOneArtifactStore(client);
  ...
  this.projectCampaign = deps.projectDeliveredCampaign ?? projectDeliveredCampaign;
}
```

These seams already support vertical injection. The route must pass the SAME client as the first constructor argument and a deps object as the second: `new ProductOneToOneArtifactRecovery(client, { artifacts: new VerticalArtifactStore({ client }), projectDeliveredCampaign: (i) => projectDeliveredCampaign({ ...i, expectedArtifactPath: verticalPath(...) }, { client }) })`. The constructor is `(client, deps)` — never pass the deps object first. `recoverDelivery` semantics (invalid/indeterminate ⇒ unresolved, absent ⇒ absent, integral ⇒ credit boundary then `confirmExistingArt("integral")` then safe project) stay identical.

**Test analog:** `artifact-recovery.contract.test.ts` (fake probe + strict credit ops; asserts `integral` never calls `storeArtifact`/provider).

**Landmines:**
- `recoverDelivery` passes `"integral"` as `artKind` to `confirmExistingArt` (314-318). A vertical probe must return `integral` only for 1080×1920; a 1024×1024 object at the vertical path ⇒ `invalid` (spec scenario).
- `safeProject` is best-effort and must stay so; a projection failure must not change outcome.

---

### `src/lib/product-1-1/pending/pending-operations-repository.ts` (mod)

**Analog:** itself (87-111 interface + constructor; 185-218 probe).

Current constructor takes the **concrete class**:

```ts
export class SupabasePendingOperationsRepository implements PendingOperationsRepository {
  private readonly client: SupabaseClient;
  private readonly artifacts: ProductOneToOneArtifactStore;
  constructor(client = supabaseAdmin, artifacts: ProductOneToOneArtifactStore = new ProductOneToOneArtifactStore(client)) {...}
  async probeArtifact(storeId, campaignId, operationId) { return this.artifacts.probeArtifact({...}); }
}
```

Replace the concrete field type with a minimal **`ArtifactProber`** interface `{ probeArtifact(input:{storeId;campaignId;operationId}): Promise<ArtifactProbe> }` (the same shape as `ArtifactRecoveryProbe`). Add the format-aware options `{ resolveFormat(campaignId): Promise<{kind:"1:1"|"9:16"|"unavailable"}>; verticalArtifacts: ArtifactProber }` used by 59-06; the list selects the vertical probe per campaign from the persisted `campaigns.input_snapshot`.

**Landmines:**
- `listPendingOperations` (197-218) calls `findPendingOperation` then `probeArtifact`; using the wrong probe across formats produces false `absent`/`invalid`. Resolve format per row from the persisted `input_snapshot` (one query or join), never from the credit row.
- Malformed format must fail closed for that row (probe ⇒ unavailable / skip), never silently use the 1:1 store.
- The default must remain the 1:1 store to preserve existing tests (`recovery-seams.integration.test.ts`, `image-recovery.contract.test.ts`).

---

### `src/lib/product-1-1/pending/resolve-pending-operation.ts` (mod)

**Analog:** itself (152-176 deps; 288-307 evidence + RPC; 341-358 projection).

It already accepts `projectDeliveredCampaign` as a dependency. Two changes: (a) the repository probe must be format-aware (previous file), (b) the projection passed for a vertical row must carry `expectedArtifactPath`. Prefer deriving both from the resolved format in the caller (`admin/product-1-1-pending` page / resolution action) and passing a bound projection, rather than threading a format string through this service.

**Landmines:** `area` the evidence object is sent to RPC `admin_resolve_product_1_1_pending`; do **not** add format to `p_evidence` (RPC contract/constraints unchanged; no migration). Fast-path checks (`deliver_existing_art` requires `integral`, `refund_once` requires `absent`) are probe-driven and therefore already format-correct once the probe is right.

**Test analog:** `src/lib/product-1-1/__tests__/recovery-seams.integration.test.ts` and `src/app/(app)/admin/product-1-1-pending/__tests__/resolution-form.test.tsx`.

---

### `src/lib/campaign/thumbnail/thumbnail-path.ts` (mod)

**Analog:** itself (24-58, 61-98).

`NEW_FLOW_PATH_RE` **already exists** (24-44) and must not be re-added. Add only `VERTICAL_FLOW_PATH_RE = ^${UUID}/${UUID}/product-9-16/${UUID}/art-1080x1920\.jpe?g$` and include it in **both** `isEligibleCampaignArtPath` (76-81) and `THUMBNAIL_PATH_RES` (54-58). Keep the explicit denylist (`/inputs/`, `/logo`, `signature`, `bench/`, `lab/`) untouched.

**Generator needs no change**: `renderThumbnail` uses `fit:"inside"`, `withoutEnlargement:true`, max edge 288, WebP 78 (113-139) → 162×288 automatically.

**Test analog:** `thumbnail-path.test.ts` (positive/negative patterns, derived path) and `thumbnail-generator.test.ts` (162×288, no upscale, `upsert:false`), plus `thumbnail-safely.test.ts` for failure isolation. (`correction-thumbnail-isolation.test.ts` does not exist.)

**Landmines:**
- Do not reuse `NEW_FLOW_PATH_RE` name; a careless edit that makes the 1:1 regex accept `product-9-16` would let `deriveThumbnailPath` sign a vertical artifact under 1:1 rules and break isolation tests.
- `thumbnailPattern` strips `.jpe?g$`; the vertical extension is `.jpg`, fine.
- Thumbnail failure must remain isolated (`thumbnail-safe.ts` 19-56). Never make the vertical store await thumbnail success.

---

### `src/lib/campaign/display.ts` (mod — pure mappers only)

**Analog:** itself (419-461 `CampaignFormRestore`, 483-558 `mapRestoredForm`).

Add **structural** fields, no imports from `product-vertical-9-16` (G-NA rule stated at 110-113, 410-414):

```ts
export type RestoredBackgroundDirection = "studio" | "original" | "ambient";
export interface CampaignFormRestore {
  readonly campaignId: string;
  ...
  readonly backgroundDirection?: RestoredBackgroundDirection;
  readonly backgroundDirectionUnresolved?: boolean;
  readonly imageRestoreLimited: true;
}
```

Extend with `campaignFormat?: "1:1" | "9:16"` and `formatContractVersion?: string | null`, mapped from `snap.campaignFormat`/`snap.formatContractVersion` with strict validation (absent both ⇒ `"1:1"`; `9:16` without recognized version ⇒ leave `null` + a `formatUnavailable` flag so the form blocks; malformed ⇒ same). `mapRestoredForm` must keep returning `null` when the snapshot/product name is unusable (485-491).

The format table lives in the **neutral** `src/lib/campaign/format-resolution.ts` (re-exported by `product-vertical-9-16/format.ts`). The page resolves it server-side and passes the discriminated value structurally; `display.ts` must not import the vertical module. Add a pure `readCampaignFormatFromSnapshot(inputSnapshot)` only in that neutral module.

**Test analog:** `src/__tests__/lib/...` display tests + `refunded-recovery.test.tsx` (restore flows).

**Landmines:** `display.ts` is imported by client components and is `server-only` at top (line 1). Adding a server-only import from the vertical module would be a boundary violation; everything must be structural. `mapRestoredForm` currently defaults `campaignIntent` to `"offer"` — do not similarly default a missing vertical version to `"1:1"` when `campaignFormat === "9:16"`.

---

### `src/lib/image-generation/schema.ts` (mod)

**Analog:** itself (84-92).

```ts
export const NewFlowGenerateImageRequestSchema = GenerateImageRequestSchema.extend({
  backgroundDirection: z.enum(["studio", "ambient", "original"]),
  campaignId: z.string().uuid(),
  operationId: z.string().uuid(),
});
```

Add `campaignFormat: z.enum(["1:1","9:16"]).optional()` to the **extended** schema only. Never add it to `GenerateImageRequestSchema` (which has a legacy `format: z.string().optional()` at line 38 — do not reuse it; D-03 rejects the legacy field).

**Landmines:**
- Both schemas are `.strict()`; a vertical payload with an unknown key fails 400.
- Vertical validation must additionally reject two formats / unsupported values before reservation (spec §"Two formats cannot be submitted"). Zod enum handles values; duplicate keys are impossible in JSON — the real dual-format risk is body + persisted snapshot mismatch (409 path), not the schema.
- `detectExclusiveNewFlowFields(body)` (route 278) must **not** treat `campaignFormat` alone as a new-flow marker (a legacy store could send it). Vertical bodies already carry `backgroundDirection`, so detection still works; keep `detectExclusiveNewFlowFields` unchanged unless a test proves otherwise.

---

### `src/app/api/campaign/generate-image/route.ts` (mod)

**Analog:** itself — three insertion points.

**(a) Campaign binding/read + operation short-circuit** (382-431): `existingNewFlowCampaign` selects `id, store_id, input_snapshot`. Add format checks here, **before** `readProductOneToOneOperation` and before any reservation:

```ts
const existingNewFlowCampaign = await supabaseAdmin.from("campaigns").select("id, store_id, input_snapshot")...
```

Resolve persisted format from `existingNewFlowCampaign.data.input_snapshot`; if the request says `"9:16"` and the persisted campaign says `"1:1"` (or inverse) ⇒ 409 `operation_identity_conflict` before effects. If persisted `9:16` version is unrecognized ⇒ 503/400 unavailable (no fallback).

**(b) Frozen snapshot + hash** (827-839, 874-895): only for vertical, add `campaignFormat:"9:16"` and `formatContractVersion` to `newFlowFrozenSnapshot` before `computeFrozenContentHash`. For `1:1`/absent, add **nothing** — the persisted snapshot and hash must remain byte-identical (the idempotency comparison at 846-873 would otherwise 409 every existing campaign).

**(c) Dispatch** (513-520 / 971-988): if `campaignFormat === "9:16"`, `const { runProductVertical9x16Generation } = await import("@/lib/product-vertical-9-16/orchestration/entrypoint")` **only in that branch** and call it with the vertical profile deps; otherwise keep `runProductOneToOneGeneration` untouched.

**Landmines:**
- The vertical flag check belongs here, before reservation/provider; read it server-side fail-closed. Do **not** consult it in `image-recovery`/download/detail.
- `newFlowOrchestrationInput` (497-511) is built before the branch; keep it format-free and spread it, so 1:1 callers receive identical keys.
- The pre-reserve checks (legal/readiness/rate-limit/balance/cost/input validation/identity) at 565-802 must run for vertical too — do not short-circuit them.
- `recordGenerationAttempt` at 955 must still run before vertical dispatch.
- A dynamic `import()` in the branch is required by D-04; a top-level static import would load vertical code for 1:1 requests and violate isolation tests.

---

### `src/app/api/campaign/[id]/download/route.ts` (mod)

**Analog:** itself (63-110).

Current new-flow branch:

```ts
const flowClassification = classifyCampaignFlow(campaign.input_snapshot);
if (flowClassification === "indeterminate" || (flowClassification === "new_flow" && !newFlowOperation)) return 503;
if (newFlowOperation) {
  const artifactStore = new ProductOneToOneArtifactStore();
  const probe = await artifactStore.probeArtifact({...});
  const decision = decideNewFlowDownload({ operationStatus, unknown, artifactProbe: probe });
  if (!decision.allowed || decision.storagePath === null) return 403;
  const artifact = await artifactStore.downloadArtifact(decision.storagePath);
  ... buildSafeDownloadFilename({ productName, createdAt, extension: "jpg" })
}
```

Add format resolution from `campaign.input_snapshot` immediately after `flowClassification`: `9:16` ⇒ vertical store (`probe` + `downloadArtifact`), malformed/unrecognized version ⇒ 503; `1:1`/absent ⇒ existing code path byte-identical. Keep `buildSafeDownloadFilename` and `Content-Disposition`/`Cache-Control: private, no-store`.

**Test analog:** `src/__tests__/api/campaign-download.test.ts` + `artifact-download.integration.test.ts` (gate before bytes, no signed URL).

**Landmines:** never push `campaign.storage_path` into the vertical probe; the probe path is deterministic from `(storeId, campaignId, operationId)`. Do not sign a URL in this route.

---

### `src/app/api/campaign/[id]/image-recovery/route.ts` (mod)

**Analog:** itself (151-220).

Flow already does: `classifyCampaignFlow` → legacy 403 / indeterminate 409 → load operation → identity match → `resolveProductFlowAuthorization` → `new ProductOneToOneArtifactRecovery(client, deps).recoverDelivery(...)`. The constructor is `(client, deps)` — client first, never the deps object.

Changes: resolve persisted format after the flow checks; if `9:16` + recognized version ⇒ instantiate recovery with **vertical probe** and **vertical-bound projection**; malformed/unrecognized ⇒ fail closed (503/409) and **never** consult `product_9_16_enabled`. `operationId` continues to come from the server-side persisted operation, never the body.

**Landmines:**
- Current code returns `403` when authorization is not allowed; the vertical flag must not be mixed into that decision (flag OFF must not block recovery).
- `loadCampaignOperation` distinguishes `error` (503) from `absent` (409); preserve that.
- Do not use the client-provided `operationId` for the store call — use `load.operation.operationId` (178, 213).

**Test analog:** `image-recovery.contract.test.ts` + `recovery-seams.integration.test.ts` + `local-pilot-recovery.integration.test.ts`.

---

### `src/app/(app)/campanhas/[id]/page.tsx` + `client.tsx` (mod — detail)

**Analog:** page (141-154) probe/signed URL; client (356-365, 707-716) image render.

Page:

```ts
if (newFlowState === "delivered") {
  try {
    const artifactStore = new ProductOneToOneArtifactStore();
    const probe = await artifactStore.probeArtifact({ storeId: campaign.store_id, campaignId: id, operationId: newFlowOperation.operationId });
    if (probe.kind === "integral") props.imageUrl = await artifactStore.getSignedArtifactUrl(probe.storagePath);
  } catch { /* best effort */ }
}
```

Resolve format before this block; use the vertical store for `9:16`. Pass a structural `format?: "1:1" | "9:16"` on `CampaignPageProps` (display.ts type), not the module.

Client: both render sites use `<img className="w-full rounded-xl shadow-md">`. Wrap conditionally per UI-SPEC §9:

```tsx
{props.imageUrl && (props.newFlowFormat === "9:16" ? (
  <div className="mx-auto w-auto max-h-[70vh] aspect-[9/16] rounded-xl bg-bg-elevated overflow-hidden">
    <img src={props.imageUrl} alt={props.productName} className="h-full w-full object-contain" />
  </div>
) : (
  <img src={props.imageUrl} alt={props.productName} className="w-full rounded-xl shadow-md" />
))}
```

**Landmines:** two render sites (one per new-flow/legacy branch) must both be updated or detail differs by terminal state. `object-cover` is forbidden; no crop. If probe is not integral, keep the existing unavailable treatment — do not render an empty vertical frame.

---

### `src/app/(app)/campanhas/nova/page.tsx` (mod)

**Analog:** itself (76-139).

`eligible` is resolved server-side (80-87). Add `verticalEnabled = await new FeatureFlagService().isProduct9x16Enabled()` fail-closed, inject it as a structural prop. For restore, pass `format`/`version` from `campaign.input_snapshot` into `mapRestoredForm` (the page already resolves background direction server-side at 106-126; format is a plain snapshot read and needs no extra RPC). Pass `verticalEnabled` + `restoredForm.campaignFormat` to the client.

**Landmines:** do not let `verticalEnabled` be derived from `eligible`. Do not hide the selector when a vertical draft is restored and flag is OFF (paused state). Do not read the flag on the client.

---

### `src/components/flow/campaign-format-selector.tsx` (new component)

**Analog:** `src/components/flow/background-direction-selector.tsx` (78 lines) — copy verbatim structure/classes.

```tsx
<fieldset className="space-y-2" data-testid="flow-background-direction-selector">
  <legend className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">Direção de fundo</legend>
  {OPTIONS.map(o => (
    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${value===o.value ? "border-accent-green bg-accent-green/5" : "border-border-light hover:border-text-muted"}`}>
      <input type="radio" name="backgroundDirection" value={o.value} checked={value===o.value} onChange={...} disabled={disabled}
             aria-invalid={error?true:undefined} className="h-4 w-4 accent-accent-green" />
      <span className="text-text-primary text-sm font-body flex-1">{o.label}</span>
    </label>
  ))}
  {error && <p role="alert" className="text-accent-red text-xs font-body">{error}</p>}
</fieldset>
```

Differences required by UI-SPEC §6/§14: `min-h-[44px]`, `items-start`, `focus-within:ring-2 focus-within:ring-accent-blue/40`, `name="campaignFormat"`, helper `<p id="campaignFormat-helper" className="text-text-secondary text-xs">` always rendered, `aria-describedby` on both radios, section `aria-labelledby`. `disabled` state adds `opacity-60 cursor-not-allowed`.

**Test analog:** existing selectors are covered indirectly by `campaign-flow-credits.test.tsx`; add a focused RTL test asserting exact labels, default `1:1`, no DOM when `!eligible`, paused state (both radios disabled, `role="alert"`), and `aria-describedby` wiring.

**Landmines:** the long vertical label must wrap, not truncate; no 2-column layout. Selection must be a native radio (no button-based roving). No new icons beyond `AlertTriangle`.

---

### `src/components/flow/campaign-input-form.tsx` (mod)

**Analog:** itself.

Mount point: after the product-images block and before `Oferta` (UI-SPEC §6). Existing conditional pattern to copy (780-789):

```tsx
{eligible && (
  <BackgroundDirectionSelector value={fields.backgroundDirection} onChange={(d) => setField("backgroundDirection", d)} disabled={isSubmitting} error={...} />
)}
```

Add `verticalEnabled`/`campaignFormatPaused` props through `FormContentProps` (326-346). Paused banner: copy the amber block at 268-300 (`role="alert"`, `border-accent-amber/30 bg-accent-amber/10 px-4 py-3`, `AlertTriangle h-4 w-4 text-accent-amber`, body `text-xs text-accent-amber/90`), with exactly the copy from UI-SPEC §11.

Submit button (880-896) disabling is already driven by `submitDisabled`; make it `submitDisabled || campaignFormatPaused`, keep `disabled:opacity-50 disabled:cursor-not-allowed`, and point `title` to the paused explanation.

**Landmines:** when `!eligible`, nothing may be mounted (no banner, no helper). When flag OFF and no vertical restore, nothing mounted. When paused, both radios disabled (prevents ambiguous "1:1 choice"). Keep the legacy `preserveImageContext` checkbox rule `!eligible && intent !== offer` (795-808) unchanged.

---

### `src/components/flow/use-campaign-form.ts` (mod)

**Analog:** itself — three functions.

**Body builder** (623-707): add inside the `if (options?.eligible)` block (698-704):

```ts
body.backgroundDirection = fields.backgroundDirection ?? "studio";
if (options.identity) { body.campaignId = ...; body.operationId = ...; }
```

Add `if (fields.campaignFormat === "9:16") body.campaignFormat = "9:16";` — **omit entirely for 1:1** (byte compatibility).

**Fingerprint** (585-593): `buildEligibleDraftFingerprint` serializes the body, so adding the conditional field automatically changes identity on format switch — no extra code, but add a test that `1:1` fingerprints are unchanged from today and `9:16` differs.

**Restore** (714-737 `restoredFormToFields`): add `campaignFormat` from `restored.campaignFormat`; derive paused state from a new option `verticalEnabled === false && restored.campaignFormat === "9:16"`. Preserve the rule that `undefined` background direction is not defaulted (740-760) — analogous: a paused vertical must stay `"9:16"`, never fall back to `"1:1"`.

**Landmines:**
- Body key order is part of the fingerprint and idempotency comparison (`JSON.stringify` at 590). Appending `campaignFormat` at the end of the eligible block is safe; inserting in the middle changes fingerprints for existing vertical attempts only (none yet), but keep 1:1 order untouched.
- `confirmedBodyRef` retries the exact confirmed body (812-815); a paused state must clear/block retry rather than re-send 1:1.
- `setField` union type must accept the new field; `FieldErrors` key list must include it if validation messages are needed.

---

### `src/components/flow/campaign-brief-review.tsx` (mod)

**Analog:** itself (148-186 `dl` grid).

```tsx
<section aria-label="Oferta" className="bg-bg-surface border border-border rounded-xl p-4">
  <dl className="space-y-2">
    <div className="flex items-center gap-2">
      <dt className="text-text-muted text-sm font-body w-28 shrink-0">Tipo</dt>
      <dd className="text-text-primary text-sm font-body">{INTENT_LABELS[intent] ?? intent}</dd>
    </div>
    {fields.badge && (... <dt>Selo</dt> ...)}
```

Insert the `Formato` row **after `Tipo` and before `Selo`**, label column `w-28 shrink-0`, value exact option label; optional muted `· 1080 × 1920 px` for vertical. No row for legacy (UI-SPEC §8 — legacy has no format concept; pass a `format?: "1:1"|"9:16" | null` prop or read `fields.campaignFormat`, defaulting to no row when `eligible === false`).

**Landmines:** review is reached only before generation; do not add a conversion affordance. If paused state can reach review, disable confirm for the same reason as submit.

---

### `src/lib/feature-flags/feature-flag-service.ts` (mod)

**Analog:** itself.

Add key + method following the fail-closed pair pattern:

```ts
export const PRODUCT_1_1_TEST_STORES_ENABLED_KEY = "product_1_1_test_stores_enabled";
export const ALL_FEATURE_FLAG_KEYS = [ ... ];
isProductOneToOneTestStoresEnabled(): Promise<boolean> { return this.readFlag(PRODUCT_1_1_TEST_STORES_ENABLED_KEY, false); }
```

Add `PRODUCT_9_16_ENABLED_KEY = "product_9_16_enabled"`, include in `ALL_FEATURE_FLAG_KEYS` (order is the admin display order), and `isProduct9x16Enabled(): Promise<boolean> { return this.readFlag(KEY, false); }` — **no env override** (D-13). `readFlag` already warns and returns fallback on error/missing (72-107) → fail-closed.

**Landmines:** do not use `readProductOneToOneFlagState` for this key (it exists to distinguish missing/invalid for the flow pair); `readFlag` is enough and matches "missing/invalid ⇒ OFF". The admin form renders labels via a server-side row mapping of `ALL_FEATURE_FLAG_KEYS` — add label/description there or the row shows the raw key.

**Test analog:** `src/app/(app)/admin/feature-flags/feature-flags-form.test.tsx` + flag service unit tests (assert missing row ⇒ false and no env override).

---

### `src/app/(app)/admin/product-1-1-pending/page.tsx` + `resolution-form.tsx` (mod — admin evidence)

**Analog:** page `mapItem` (26-41); form evidence fieldset (30-43 types, 62-67 `artifactLabel`, 418-424 evidence rows).

Add an optional `format: "1:1" | "9:16"` to `PendingOperationItem` and one read-only line in the evidence fieldset: label `Formato`, value `Vertical 9:16` / `Quadrado 1:1`, absent ⇒ `Quadrado 1:1` (historical contract). The repository `PendingOperationView` must expose format (resolved from campaign `input_snapshot`); the page maps it structurally. No new action, no filter, no redesign.

**Landmines:** do not add format to the RPC evidence payload. If the repository can't resolve format (malformed), show an explicit unavailable value rather than defaulting silently — although spec says absent ⇒ 1:1, a present-but-malformed value must not read as 1:1.

---

### `supabase/migrations/YYYYMMDDHHmmss_f59_product_9_16_flag.sql` (new, data-only)

**Analog:** existing flag seeds in `supabase/migrations/*` using `INSERT ... ON CONFLICT DO NOTHING`.

```sql
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('product_9_16_enabled', false, '...')
ON CONFLICT (key) DO NOTHING;
```

**Landmines (project rules, AGENTS.md):** real UTC timestamp with seconds; verify uniqueness against current worktree + target integration branch + known parallel branches **before** creating; do not invent `000001` counters; no schema/constraint/RPC/grant changes; apply only in homolog in this phase; never rename after shared apply (known F47.1/F50.3 collision).

---

### Tests (new files to add)

| Test file | Analog to copy | What it must prove |
|---|---|---|
| `src/lib/product-vertical-9-16/__tests__/format.contract.test.ts` | `snapshot-preflight.contract.test.ts` | absence ⇒ 1:1; 9:16+version; missing/malformed/unsupported/incoherent ⇒ unavailable |
| `.../safe-area.contract.test.ts` | `thumbnail-path.test.ts` | 269/672/65/324×768, version, provenance |
| `.../artifact-path.contract.test.ts` | `artifact-store.contract.test.ts` path block | vertical regex positive, 1:1 negative, and inverse |
| `.../artifact-store.contract.test.ts` (vertical) | `product-1-1/.../artifact-store.contract.test.ts` | 1080×1920 decode, JPEG, `upsert:false`, table row, thumb 162×288, probe invalid for 1024×1024, no signed URL in probe |
| `.../prompt.contract.test.ts` | `prompt-composition.contract.test.ts` + equivalence | only format/canvas/safe-area differ; 1:1 byte-identical |
| `.../vertical-estimate.contract.test.ts` | `copy-recovery-pilot.contract.test.ts` | missing estimate blocks; `estimate_required`; retries counted |
| `.../recovery.integration.test.ts` | `recovery-seams.integration.test.ts` | pending → integral 1080×1920 → delivered → projection `ready` with vertical path; never `art-1024.jpg` |
| `src/app/api/campaign/__tests__/generate-image-format.test.ts` | route unit style | 409 mismatch pre-reserve; 1:1 branch untouched; dynamic import only vertical |
| `src/__tests__/api/campaign-download.test.ts` (extend) | itself | vertical gate + attachment; malformed ⇒ 503 |
| UI tests (extend `campaign-flow-credits.test.tsx` or new) | `refunded-recovery.test.tsx` | mount gating, paused, review row, detail aspect |

Test conventions (from `artifact-store.contract.test.ts` 1-8 and 62-90): `// @vitest-environment node` for sharp/Node code; `vi.mock("server-only", () => ({}))`; `vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }))`; hand-rolled fake client with recorded calls; `sharp({create:{width,height,channels:3,background:{r,g,b}}}).png()` fixtures; no DB/provider/credit.

---

## Shared Patterns

### Fail-closed format resolution (all read boundaries)
**Source:** `new-flow-marker.ts` 27-49; `format-selection` spec.
Every boundary (generate route, download, recovery, detail, pending list, restore) resolves format from `campaigns.input_snapshot` **once** and treats missing/malformed/unsupported/incoherent as unavailable. Never fall back to 1:1 for a `9:16` campaign, and never fall back to vertical for `1:1`.

### Typed artifact probe union + "probe never signs"
**Source:** `artifact/types.ts` 20-42; `artifact-store.ts` 395-484.
`integral | absent | invalid | indeterminate`; a thrown storage read is `indeterminate`, never `absent`; absence requires a `404` naming the object and not the bucket; `getSignedArtifactUrl` is a separate method called only after the delivery gate.

### Idempotent, never-throwing projections
**Source:** `project-delivered-campaign.ts` 67-178; `project-closed-campaign.ts`; `artifact-recovery.ts` 237-250; `resolve-pending-operation.ts` 341-386.
Projection requires persisted `delivered` + matching artifact path; returns typed reasons; never throws; failure must not trigger provider/refund; never overwrite a `ready` delivery.

### Structural UI transport (no vertical import in display/client)
**Source:** `display.ts` 110-113, 410-414, 419-461; `nova/page.tsx` 76-139.
Server pages resolve module logic; `display.ts` and client components receive plain strings/booleans. Adding `campaignFormat`/`formatContractVersion`/`verticalEnabled` as structural fields is the only allowed coupling.

### Credit/fence order (do not re-implement)
**Source:** `generation-orchestrator.ts` 1232-1240 → 1583-1601 → 1636-1644 → 1667-1676; `credit-operation-client.ts` 151-307.
reserve after snapshot & before provider → `beginPublication` before storage → `markArtUploaded` after metadata → `deliver` after fence+upload → project. Unknown ⇒ `markResultUnknown`, no refund. Refund only via `closeFailedOperation` with probe-confirmed absence and fresh epoch.

### Feature-flag read (fail-closed, server-only)
**Source:** `feature-flag-service.ts` 72-107, 180-188.
`readFlag(key, false)` with warn on error/missing; no env override for this flag; flag consulted only at generation start.

### Pure-path modules (no server-only/sharp)
**Source:** `artifact-path.ts` 1-8; `thumbnail-path.ts` 1-13; `download-gate.ts` 1-19.
Anything imported by projections, list, or client-adjacent code must stay dependency-free so tests can run without Node runtime.

---

## No Analog Found

| File | Role | Data Flow | Reason / guidance |
|---|---|---|---|
| Provider proof harness/report (14 paid calls, US$ 3.00) | tooling/test | batch | No existing paid-proof harness with budget gating. Compose from `pilot/spend-control.ts` (`beginPaidCall`/`markUnknown`), `ai-cost/image-pair-pricing.ts`, `UpstreamImagesAdapter`, and OpenSpec matrix; do not run during planning/implementation. |
| `docs/**` F59 runbook | doc | — | Use existing ops runbook structure; content defined by SPEC (`flag, paths, dimensões, safe area, rollback`). |

---

## Critical Landmine Index (read before planning)

1. **1:1 byte-compat is test-enforced.** `prompt-composition.contract.test.ts` asserts `COMPOSER_VERSION = "48.2.4-prompt-composer-v7"`, base version, 7 block labels, policy versions. Any change to shared registry/composer constants without a vertical-only path breaks it.
2. **Snapshot keys/hash.** Adding keys to a 1:1 `input_snapshot` breaks `computeFrozenContentHash` comparisons in the generate route (846-873) and `snapshot` binding tests → every 1:1 resend becomes 409.
3. **Hardcoded 1024/1080.** `ARTIFACT_SIZE=1024`, `art-1024.jpg`, `verifyJpeg1024`, `expectedWidth ?? 1024`, `size:"1024x1024"` exist in 4+ places. Vertical must never reuse them; 1:1 must never see `1080`.
4. **Projection expected path.** `projectDeliveredCampaign` only knows the 1:1 path; without `expectedArtifactPath` a vertical recovery projects `ready` with `art-1024.jpg` or fails `artifact_missing`.
5. **Concrete class in pending repo.** `SupabasePendingOperationsRepository` accepts `ProductOneToOneArtifactStore` (class), not an interface → cannot inject a vertical probe until typed as `ArtifactProber`.
6. **Private fields.** `ProductOneToOneArtifactStore` uses `private readonly` constructor params; test fakes can't patch them. Build the vertical store with an explicit `deps` object.
7. **Dynamic import only in vertical branch.** A static import in `generate-image/route.ts` loads vertical code for 1:1 requests (fails isolation intent) and bloats the legacy path.
8. **Flag must not gate reads.** `image-recovery`, download, detail, pending resolution, copy recovery must never consult `product_9_16_enabled`.
9. **Thumbnail regex isolation.** Widening `NEW_FLOW_PATH_RE` (or reusing it) for vertical lets 1:1 rules sign vertical objects; add a distinct regex to both eligibility and thumbnail lists.
10. **Amber ≠ red.** Paused restore is `accent-amber`; red only for confirmed errors. Paused must disable both radios and submit, and never write `1:1` into state/body.
11. **Review row placement.** `Formato` goes after `Tipo`, before `Selo`, inside the existing `Oferta` `dl`; no legacy row.
12. **Detail has two image render sites.** Update both (`client.tsx` 358 and 709) or vertical looks square after recovery/terminal transitions.
13. **Migration rules.** Real UTC timestamp + uniqueness check; data-only seed; no structural migration; stop and escalate if a constraint/RPC can't support reusing `product_1_1_campaign_artifacts`.

---

## Metadata

**Analog search scope:** `src/lib/product-1-1/**`, `src/lib/campaign/**`, `src/lib/ai/**`, `src/lib/ai-cost/**`, `src/lib/feature-flags/**`, `src/lib/image-generation/**`, `src/app/api/campaign/**`, `src/app/(app)/campanhas/**`, `src/app/(app)/admin/**`, `src/components/flow/**`, `src/lib/product-1-1/__tests__/**`, `src/__tests__/**`.
**Files scanned:** ~60 (≈45 source + ≈15 tests).
**Pattern extraction date:** 2026-11-04.
**Consumers:** `gsd-planner` (per-plan action references), `gsd-executor` (copy conventions), `gsd-plan-checker` (landmine coverage).
