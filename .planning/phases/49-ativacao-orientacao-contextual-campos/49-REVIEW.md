---
phase: 49-ativacao-orientacao-contextual-campos
reviewed: 2026-09-18T19:23:56Z
depth: deep
base_sha: 05b1a74b289afd5af0c5a96cc72c5b43c79031d0
files_reviewed: 24
files_reviewed_list:
  - src/lib/store-onboarding/field-guidance.ts
  - src/lib/campaign/field-guidance.ts
  - src/components/ui/field-hint.tsx
  - src/components/ui/expandable-help.tsx
  - src/components/ui/recommended-badge.tsx
  - src/components/campaign/mandatory-artwork-field.tsx
  - src/components/flow/store-identity-form.tsx
  - src/components/flow/campaign-input-form.tsx
  - src/components/flow/campaign-image-upload.tsx
  - src/components/flow/campaign-brief-review.tsx
  - src/__tests__/components/ui/expandable-help.test.tsx
  - src/__tests__/components/ui/field-hint.test.tsx
  - src/__tests__/components/ui/recommended-badge.test.tsx
  - src/components/campaign/__tests__/mandatory-artwork-field.test.tsx
  - src/components/flow/__tests__/campaign-brief-review.orientation.test.tsx
  - src/components/flow/__tests__/campaign-brief-review.test.tsx
  - src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx
  - src/components/flow/__tests__/campaign-input-form.orientation.test.tsx
  - src/components/flow/__tests__/phase49-fences.test.ts
  - src/components/flow/__tests__/store-identity-form.orientation.test.tsx
  - src/lib/campaign/__tests__/field-guidance.correspondence.test.ts
  - src/lib/campaign/__tests__/field-guidance.test.ts
  - src/lib/store-onboarding/__tests__/field-guidance.correspondence.test.ts
  - src/lib/store-onboarding/__tests__/field-guidance.test.ts
findings:
  critical: 0
  high: 0
  medium: 3
  low: 5
  total: 8
status: issues
---

# Phase 49: Code Review Report

**Reviewed:** 2026-09-18T19:23:56Z
**Depth:** deep
**Files Reviewed:** 24 (10 production + 14 test)
**Base SHA:** `05b1a74b289afd5af0c5a96cc72c5b43c79031d0`
**Status:** issues

## Summary

Phase 49 is a presentation/content-only phase: it adds contextual field guidance to the store identity form and the campaign form, introduces three small UI primitives (`FieldHint`, `ExpandableHelp`, `RecommendedBadge`), a pure price-feedback function, and separates the brief-review "Avisos" categories. I reviewed the production changes and the new/co-migrated test files, and verified the phase fences.

**Fence verification (all pass):**
- `git diff --name-only 05b1a74b289afd5af0c5a96cc72c5b43c79031d0..HEAD -- prompts src/lib/ai src/lib/campaign/brief.ts src/lib/campaign/brief-schema.ts src/lib/image-generation/services/art-director-briefing.ts src/components/flow/use-campaign-form.ts src/components/campaign/validity-field.tsx src/lib/store-onboarding/tabs.ts src/lib/store-onboarding/reason-text.ts src/lib/store-onboarding/draft-store.ts src/hooks/use-onboarding-tabs.ts src/hooks/use-drift-detection.ts src/lib/drift.ts src/app/api supabase` → **empty output**.
- Recomputed the 59 protected SHA-256 hashes from `49-BASELINE.txt`: **59/59 identical, 0 diverged, 0 missing**.
- `product.description` remains absent from `art-director-briefing.ts` (grep exit code 1 → 0 occurrences).

**Overall assessment:** The core logic is correct — the price-feedback state machine exactly mirrors `inferIntent`/`availableOptions`, the four `aria-describedby` groups resolve to existing elements in every state, the disclosure primitive is keyboard-operable with coherent `aria-expanded`, and the brief-review separation is derived from the same `fields` values with no body/snapshot change. No security issues were found (no injection surface, no secrets, no user content rendered as HTML). The defects below are concentrated in **single-source-of-truth adherence** (D14) and **accessibility robustness** rather than functional correctness.

## Findings

### ME-01: `RecommendedBadge` duplicates the "Recomendado" literal instead of consuming the single-source constant

**Severity:** medium
**File:** `src/components/ui/recommended-badge.tsx:11` (constant: `src/lib/store-onboarding/field-guidance.ts:101`)
**Issue:** `RecommendedBadge` renders the hardcoded string `Recomendado` while the phase's canonical microcopy module exports `RECOMMENDED_LABEL = "Recomendado"`. A repo-wide search shows the constant is referenced **only by tests** (`store-identity-form.orientation.test.tsx:243`, `field-guidance.test.ts:66`); no production component imports it. This violates D14 and the `campaign-field-orientation` spec scenario "Strings sem duplicação divergente" ("as strings provêm do módulo de conteúdo único — e não há cópias divergentes"). The component's own test (`recommended-badge.test.tsx:10,18`) also hardcodes the literal, so only the orientation test would catch drift, and the exported constant is effectively dead in production.
**Fix:**
```tsx
import { RECOMMENDED_LABEL } from "@/lib/store-onboarding/field-guidance";

export function RecommendedBadge() {
  return (
    <span className="ml-1.5 font-heading font-medium text-[11px] uppercase tracking-wide text-accent-blue">
      {RECOMMENDED_LABEL}
    </span>
  );
}
```

### ME-02: Unsafe `as StoreToneOfVoice` cast can render an empty described-by paragraph for legacy tone values

**Severity:** medium
**File:** `src/components/flow/store-identity-form.tsx:2019`
**Issue:** `TONE_OF_VOICE_DESCRIPTIONS[formData.tone_of_voice as StoreToneOfVoice]` casts a free-form `string` (`use-store-form.ts:23`, initialized from `initialStore.tone_of_voice ?? ""`) to the literal union. The database column is a plain `tone_of_voice TEXT` with no `CHECK` constraint (`supabase/migrations/20260602000003_add_store_direction_fields.sql:6`), so a legacy/unknown value is reachable. In that case the lookup returns `undefined`, and the code still renders `<FieldHint id={toneDescriptionId}>{undefined}</FieldHint>` — an empty `<p>` that the select's `aria-describedby` (line 2010) points to. The `as` cast also defeats the compile-time guarantee the guidance module advertises in its header comment ("uma chave inválida falha em `tsc`").
**Fix:** Add a safe lookup to the guidance module and guard rendering:
```ts
// src/lib/store-onboarding/field-guidance.ts
export function toneOfVoiceDescription(value: string): string | undefined {
  return (TONE_OF_VOICE_DESCRIPTIONS as Record<string, string | undefined>)[value];
}
```
```tsx
const toneDescription = toneOfVoiceDescription(formData.tone_of_voice);
// ...
{toneDescription !== undefined && (
  <FieldHint id={toneDescriptionId}>{toneDescription}</FieldHint>
)}
```
(Keep the `aria-describedby` entry conditional on the same `toneDescription !== undefined`.)

### ME-03: Static hint/group ids in `CampaignImageUpload` violate the `useId` convention

**Severity:** medium
**File:** `src/components/flow/campaign-image-upload.tsx:58` (`aria-labelledby="productImages-label"`), `:65` (`id="productImages-label"`), `:70` (`id="productImages-required"`)
**Issue:** The `contextual-field-help` spec requires the hint↔field association to use "id estável gerado por `useId`". This component already imports and uses `useId` for `imageErrorId` (lines 28–29), but the group label id and the sr-only required-text id are hardcoded literals. Hardcoded ids are not instance-safe: rendering `CampaignImageUpload` more than once on a page produces duplicate ids and breaks `aria-labelledby`/`aria-describedby` resolution. The same pattern appears in `store-identity-form.tsx:1483` (`id="fiscal-section-helper"`).
**Fix:**
```tsx
const base = useId();
const labelId = `${base}-label`;
const requiredId = `${base}-required`;
const imageErrorId = `${base}-error`;
// ...
<div role="group" aria-labelledby={labelId}
     aria-describedby={[requiredId, error ? imageErrorId : null].filter(Boolean).join(" ")}
     aria-invalid={error ? true : undefined}>
  <label id={labelId} ...>
  <span id={requiredId} className="sr-only">Imagem do produto obrigatória</span>
```
Update `campaign-input-form.orientation.test.tsx:296,298` to read the id from the DOM instead of asserting the literal.

### LO-01: Image-group error association is on a non-focusable element

**Severity:** low
**File:** `src/components/flow/campaign-image-upload.tsx:56-63`
**Issue:** `aria-invalid`/`aria-describedby` are placed on the `role="group"` wrapper, which is not focusable. The actionable controls a keyboard/AT user reaches — the "Galeria" button (`:140`) and "Câmera" button (`:149`) — carry no error association, and the actual file inputs are `className="hidden"` (not focusable). As a result, focusing the actionable controls does not announce the required/error state, weakening the D13 accessibility guarantee even though the error text is visible.
**Fix:** Attach `aria-describedby` (and `aria-invalid` where valid) to the two actionable buttons, or make the drop zone focusable (`tabIndex={0}` + `role="button"` + key handler) and associate the error with it.

### LO-02: "Neutral" intermediate price feedback is rendered in the warning color (amber)

**Severity:** low
**File:** `src/components/flow/campaign-input-form.tsx:592-597` (tone decided at `:594`, from `estadoSoPrecoAnterior` at `:361-362`)
**Issue:** D9 and the `campaign-field-orientation` spec require the "só preço anterior" message to be **neutral** ("mensagem neutra"), but the implementation sets `tone="amber"` (`text-accent-amber`), which is this app's warning color (e.g. `store-identity-form.tsx:1472`). This conflicts with the phase's stated principle of no negative/warning signals and with the UAT §3 criterion ("Sem advertência negativa permanente").
**Fix:** Render all four feedback states with the default `secondary` tone, or introduce a non-warning informational tone. Remove `estadoSoPrecoAnterior` if it is no longer needed.

### LO-03: Review displays untrimmed mandatory-artwork text while the body trims it

**Severity:** low
**File:** `src/components/flow/campaign-brief-review.tsx:74` (gate) and `:249` (render)
**Issue:** `hasMandatoryArtworkText` is computed with `.trim()`, but the rendered value is the raw `fields.mandatoryArtworkTextFree`. The body uses `buildMandatoryArtworkText`, which trims (`use-campaign-form.ts:410`). Leading/trailing whitespace and blank lines shown in the review therefore differ from what is actually sent, and `whitespace-pre-line` makes the divergence visible.
**Fix:** Render the trimmed value: `{fields.mandatoryArtworkTextFree.trim()}` (or derive both the gate and the display from one trimmed local).

### LO-04: Hardcoded `fiscal-section-helper` id

**Severity:** low
**File:** `src/components/flow/store-identity-form.tsx:1483`
**Issue:** `<FieldHint id="fiscal-section-helper">` uses a static id. Nothing references it via `aria-describedby`, so the id serves no purpose, and it would duplicate if the form were ever rendered twice. This is the same convention deviation as ME-03.
**Fix:** Derive the id from `useId()` (consistent with the other hints) or remove the `id` prop entirely.

### LO-05: Cross-surface label inconsistency and a spec/UAT wording contradiction

**Severity:** low
**File:** `src/components/campaign/campaign-adjustments-panel.tsx:72` vs `src/lib/campaign/field-guidance.ts:34`
**Issue:** The post-generation adjustments panel still labels the field `Preço Final`, while the campaign form and the brief review now use `Preço de venda (final)` / `Preço de venda`. This panel is outside the phase's declared surface, so it is not a fence violation, but it is a user-visible inconsistency the phase introduced by renaming only part of the flow. Separately, the default (no prices) feedback string `"Sem preço, a campanha será de Destaque ou Exclusividade."` — mandated by D9 — is permanently visible and begins with "Sem preço", which the UAT §3 pollution criterion lists as an example of a negative permanent warning. The code correctly follows D9; the artifact wording should be reconciled.
**Fix:** Align the adjustments panel label with `DISCOUNTED_PRICE_LABEL` (import it), or explicitly record it as deferred; clarify the UAT §3 example so it does not contradict the D9 no-price message.

## Positive Observations

- `priceFeedbackMessage` (`src/lib/campaign/field-guidance.ts:71-94`) exactly mirrors `inferIntent` and the real `availableOptions` expression (`use-campaign-form.ts:640-643`); the 4-state correspondence test is a faithful mirror and the "só anterior" neutral state is correctly handled.
- `ExpandableHelp` keeps the controlled region in the DOM with `hidden`, so `aria-controls` always resolves; collapsed-by-default, native `<button type="button">`, `aria-expanded` coherent, `min-h-[44px]`.
- `campaign-brief-review.tsx` derives the separated "Avisos" categories from the same `fields` values and reuses `ILLUSTRATIVE_NOTICE_TEXT`, preserving the body/snapshot contract.
- Every `aria-describedby` in the reviewed components resolves to an element that is rendered under the identical condition (verified for all store and campaign fields).
- The phase fences are fully intact (empty protected diff + 59/59 hashes), and `product.description` still does not reach the art-director briefing.

---

_Reviewed: 2026-09-18T19:23:56Z_
_Reviewer: gsd-code-reviewer (adversarial)_
_Depth: deep_
