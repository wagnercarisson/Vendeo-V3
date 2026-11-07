---
phase: 59
slug: f59-campanhas-de-produto-vertical-9-16
status: draft
shadcn_initialized: false
preset: none
created: 2026-11-04
language: pt-BR
---

# Phase 59 — UI Design Contract (F59 — Campanhas de Produto vertical 9:16)

> Visual and interaction contract for the **UI slice** of F59.
> The phase is mostly backend (provider, artifact pipeline, recovery, billing, flag).
> This contract covers **only the visible surfaces** touched by the change and is
> derived from `59-CONTEXT.md` (D-03, D-08, D-12, D-13), the approved OpenSpec
> (`proposal.md`, `design.md` D-03/D-08/D-12/D-13, `specs/campaign-input-ui`,
> `specs/product-vertical-format-selection`) and the registered design system.

---

## 1. Scope Guardrails (read first)

**Primary focal anchor (unchanged):** the form submit CTA `Revisar e gerar`. This phase
introduces **no second primary action** anywhere.

**In scope (exactly five surfaces):**

| # | Surface | Nature of change |
|---|---------|------------------|
| 1 | `/campanhas/nova` — **formato da campanha** selector | New gated radio group (new flow + flag ON) |
| 2 | `/campanhas/nova` — **rascunho vertical restaurado com flag OFF** | Paused state: choice visible, submission blocked |
| 3 | `/campanhas/nova` — **revisão do brief** (`CampaignBriefReview`) | One read-only `Formato` line |
| 4 | `/campanhas/[id]` — **detalhe** | Art preview aspect follows persisted format; list untouched |
| 5 | Admin evidence (`image-model-pair` / pending resolution evidence) | One read-only `Formato` line |

**Explicitly out of scope (do NOT design/build):**
- Redesign of list/dashboard cards, new navigation, new pages, new icons sets.
- Any new design system, token, light mode, font or component library.
- New Copy Director surface, copy-per-platform UI, video/carousel/publication UI.
- Any "converter formato", "trocar formato", or re-render affordance. **None may exist.**
- Any activation/flag toggle, cohort or per-store control in the lojista flow.
- Editing an existing campaign's format after creation.

**Locked product decisions applied (not re-opened):**
- Exactly one format per new-flow campaign; default `1:1`.
- Labels: `Quadrado 1:1 — feed` · `Vertical 9:16 — Stories e Reels (imagem estática)`.
- Selector exists **only** for new-flow eligible stores **with `product_9_16_enabled` ON**.
- Restored vertical draft with flag OFF stays visible, submission blocked, **no silent switch to 1:1**.
- Vertical delivery is a still image (1080 × 1920); no video; safe areas follow Vendeo policy
  and may vary by platform; **no unrestricted placement claim**.
- 1:1 payload, prompt, art and behavior are byte-compatible with today.

---

## 2. Design System

| Property | Value |
|----------|-------|
| Tool | none — registered custom design system (`openspec/design-system/MASTER.md`) |
| Preset | not applicable (`components.json` absent) |
| Component library | custom primitives in `src/components/ui/*` (no radix/base-ui) |
| Icon library | `lucide-react` (no emojis — MASTER §12) |
| Fonts | `Poppins` (headings/labels) + `Open Sans` (body/helper) |

**Reuse, do not reinvent:**

- Radio-row pattern: `BackgroundDirectionSelector`
  (`src/components/flow/background-direction-selector.tsx`) and `IntentSelector`
  (`src/components/flow/campaign-input-form.tsx`) — verbatim classes.
- Helpers: `FieldHint` (`src/components/ui/field-hint.tsx`).
- Paused/warning banner: amber banner pattern from `campaign-page-client.tsx`
  (`generationPaused`) and `restorationNotice` in `campaign-input-form.tsx`.
- Review rows: `CampaignBriefReview` `dl` grid (`w-28` label + value).
- Submit CTA + disabled semantics: existing form submit button (unchanged).
- Detail art surface: existing campaign detail client (aspect handled by container only).

**No new visual language is introduced.** If a requirement is not written here, the
existing component wins.

---

## 3. Spacing

Registered scale (multiples of 4 only; MASTER §4).

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| `space-2xs` | 4px | Icon/label inner gap |
| `space-xs` | 8px | Gap between format options (`space-y-2`), label → helper |
| `space-sm` | 12px | Helper top margin (`mt-2` acceptable as 8–12) |
| `space-md` | 16px | Option row inner padding (`p-3` = 12px + border ⇒ ≥44px) |
| `space-lg` | 24px | Separation from adjacent form sections |
| `space-xl` | 32px | Reserved |

**Exceptions:** none. **Touch targets:** every option row ≥ **44px** height
(`min-h-[44px]` + `p-3`); every button ≥ 44px (existing).

Content width: `/campanhas/nova` stays `max-w-5xl` (page) with the form at `max-w-3xl`;
detail stays `max-w-2xl` (existing). No width change.

---

## 4. Typography

Reuses MASTER §3 verbatim. **No new size or weight.**

| Role | Size | Weight | Line height | Font | Where |
|------|------|--------|-------------|------|-------|
| Group label / legend | 12px `text-xs` | 500 | 1.2 | Poppins, uppercase, `tracking-wider` | `Formato da campanha` |
| Option label | 14px `text-sm` | 400 | 1.5 | Open Sans | Radio row text |
| Helper / scope note | 12px `text-xs` | 400 | 1.4 | Open Sans | Vertical helper |
| Paused banner title | 14px `text-sm` | 600 | 1.2 | Poppins | `Novo envio vertical pausado` |
| Paused banner body | 12px `text-xs` | 400 | 1.4 | Open Sans | Explanation |
| Review label / value | 14px `text-sm` | 400 | 1.5 | Open Sans | `Formato` row |

Long vertical label (`Vertical 9:16 — Stories e Reels (imagem estática)`) **wraps**,
never truncates, max 2 lines on mobile.

---

## 5. Color

60/30/10 split, dark OLED only (MASTER §2). No light mode, no `#FFFFFF` background.

| Role | Token | Value | Usage here |
|------|-------|-------|------------|
| Dominant (60%) | `bg-bg-deep` | `#020617` | Page background |
| Secondary (30%) | `bg-bg-surface` / `bg-bg-elevated` | `#0F172A` / `#1E293B` | Option rows, review cards, detail surface |
| Accent (10%) | `accent-green` | `#22C55E` | **Reserved:** the single primary CTA `Revisar e gerar`; **selected** option row border + `bg-accent-green/5` tint |
| Focus | `accent-blue` | `#3B82F6` | Focus ring only (`ring-accent-blue`, `/20` halo) |
| Attention (paused) | `accent-amber` | `#F59E0B` | **Paused vertical submission** banner (restore with flag OFF) |
| Error | `accent-red` | `#EF4444` | Submit/field/server errors only |

**Rule — paused ≠ error.** The flag-OFF restored state is **amber** (temporary
unavailability), never red. Red is only for confirmed failures/validation errors.

**Rule — selection is not color-only:** selected state = checked native radio + green
border/tint + (unchanged) accessible `checked` state. No additional dot/check icon is added.

---

## 6. Surface 1 — Formato da campanha (selector)

**Route:** `/campanhas/nova` (`src/app/(app)/campanhas/nova/page.tsx` →
`CampaignPageClient` → `CampaignInputForm`). No new route.

**Placement (single, fixed):** after the product-images block (including the
`Imagens adicionais` helper) and **before the `Oferta` section heading**. The format
governs the whole output, so it must be visible before offer details; it must not be
buried next to the submit CTA.

**Mount condition (server-decided booleans only):**

| Condition | Rendered? |
|-----------|-----------|
| `eligible === true` **AND** vertical flag ON | **Yes** (new submission) |
| `eligible === false` (legacy flow) | No — legacy form untouched, no field in body |
| flag OFF **and** draft not restored from a vertical campaign | No — no empty banner, no placeholder |
| flag OFF **and** draft restored from a vertical campaign | **Yes**, paused (see §7) |

**Anatomy:**

```
<section data-testid="flow-campaign-format-selector"
         aria-labelledby="campaignFormat-heading">
  ├─ <h2 id="campaignFormat-heading">  "Formato da campanha"
  ├─ <fieldset>
  │    <legend class="sr-only">      "Selecione o formato da campanha"
  │    ├─ ( ) Quadrado 1:1 — feed                                    [default]
  │    └─ ( ) Vertical 9:16 — Stories e Reels (imagem estática)
  │          aria-describedby="campaignFormat-vertical-helper"
  └─ <p id="campaignFormat-vertical-helper">  vertical scope note
</section>
```

**Option row (verbatim pattern; do not restyle):**

- Row: `flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors min-h-[44px]`
- Default: `border-border-light hover:border-text-muted`
- Selected: `border-accent-green bg-accent-green/5`
- Radio: `mt-0.5 h-4 w-4 accent-accent-green` (`type="radio"`, `name="campaignFormat"`)
- Label text: `text-text-primary text-sm font-body flex-1`
- Row focus visibility (additive, MASTER §11): `focus-within:ring-2 focus-within:ring-accent-blue/40`
- Options **always stacked** (single column) — no 2-column layout at any breakpoint.
- `disabled` state: row `opacity-60 cursor-not-allowed`, radio native `disabled`.

**Helper (vertical scope note) — always rendered when the selector is mounted**
(stable layout; explains the vertical option even when 1:1 is selected):

- Text token: **`text-text-secondary`** (9:1), `text-xs`, `font-body`, line-height 1.4.
  Not `text-muted` — this copy carries essential scope information.
- Content: see §11 (single source of truth).
- Referenced by the vertical radio via `aria-describedby`; also referenced by the
  1:1 radio so screen-reader users hear the same scope note.

**Data / payload contract (UI side only):**

- Local state `campaignFormat: "1:1" | "9:16"`, initialized `"1:1"` (or the restored value).
- `"9:16"` only: the POST body includes `campaignFormat: "9:16"`.
- `"1:1"`: **no** `campaignFormat` key is sent (byte-compatible 1:1 payload).
- The format is part of the draft fingerprint ⇒ changing it produces a **new**
  campaign identity (new `campaignId` / `operationId`).
- Changing format on a **new** draft is allowed and explicit; once submitted it is frozen.

---

## 7. Surface 2 — Restored vertical draft with flag OFF (paused)

**Trigger:** `restoredForm.campaignFormat === "9:16"` and the vertical flag is OFF at
restore time (server-side read, fail-closed).

**Contract:** the vertical choice **remains visible and selected**; submission is
**blocked**; the UI **never** selects or submits `1:1` on its own.

**Anatomy (in place, above the selector):**

```
<div id="campaignFormat-paused" role="alert"
     class="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-4 py-3">
  ├─ <AlertTriangle aria-hidden class="h-4 w-4 text-accent-amber" />
  ├─ title  (Poppins 600, text-sm, text-accent-amber)
  └─ body   (Open Sans 400, text-xs, text-accent-amber/90)
</div>
<section data-testid="flow-campaign-format-selector" ...>   ← selector stays mounted
```

**Selector in paused state:**

- Both options visible; `Vertical 9:16` **checked**.
- Both radios `disabled` (no implicit 1:1 switch, no per-click ambiguity).
- Mobile/desktop identical.
- The group is described by the paused banner (`aria-describedby="campaignFormat-paused"`).

**Submit button:**

- Disabled (`disabled` + `aria-disabled="true"`), keeping the existing
  `disabled:opacity-50 disabled:cursor-not-allowed` styling.
- `title`/`aria-describedby` points to the paused explanation.
- Clicking/entering does nothing; **no** silent 1:1 submission and **no** new identity.

**Existing campaigns remain reachable:** detail, download, recovery and admin resolution
are untouched by this state (server-side); the form only blocks **new** submissions.

**Flag ON at restore:** the vertical option is selected, selectable, and a new attempt
submits `campaignFormat: "9:16"` again (format frozen).

---

## 8. Surface 3 — Revisão do brief (`CampaignBriefReview`)

Adds **one read-only row** to the existing `Oferta` section `dl` (no new card, no new
section, no layout redesign). Order: after `Tipo`, before `Selo`.

```
<dt>Formato</dt>
<dd>{formatLabel}</dd>        // exact option label, see §10
```

- Label column keeps `w-28 shrink-0`; value wraps (`text-text-primary text-sm font-body`).
- Vertical campaigns **may** append a muted size hint `· 1080 × 1920 px`
  (`text-text-muted text-xs`) — delivery fact, no promise of platform fit. 1:1 shows no hint.
- Paused (flag OFF) is reached only before review; if the state is reached, the review
  confirm is disabled for the same reason as the submit (no silent format switch).
- No `Formato` row is added for legacy campaigns (no format concept).

---

## 9. Surface 4 — Detalhe (`/campanhas/[id]`) and list

**List (`/campanhas`, dashboard, pending lists): unchanged.** No badge, no new column,
no card redesign. `storage_path` + `deriveThumbnailPath` already recognize the vertical
path; the thumbnail renders in the existing square thumb slot.

**Detail — art container only:**

- The persisted format decides the preview aspect ratio:
  - `9:16` ⇒ container `aspect-[9/16]`, `max-h-[70vh] w-auto mx-auto`, `object-contain`,
    `rounded-xl`, `bg-bg-elevated`; **no crop, no distortion, no letterbox bands inside
    the image**, no `object-cover`.
  - `1:1` / absent ⇒ current square container, unchanged.
- `alt` text unchanged (product name). No new overlay, no format badge required.
- If the artifact is unavailable/invalid, the **existing** unavailable/error treatment
  is reused (fail-closed); do not render an empty vertical frame.
- Download control/label unchanged (server supplies safe attachment name).

**"No conversion" rule:** no surface offers format switch, convert, re-render or
"gerar no outro formato". Resend/retry keeps the frozen format.

---

## 10. Surface 5 — Admin evidence

**One additive read-only line** in the existing evidence summary:
`Formato: Vertical 9:16` or `Formato: Quadrado 1:1` (Open Sans 14px; label
`text-text-muted`, value `text-text-primary`). No redesign, no new action, no filter.
Absent format in a new-flow campaign reads `Quadrado 1:1` (historical contract).

---

## 11. Copywriting Contract (PT-BR, exact strings)

| Element | Copy |
|---------|------|
| Group label | `Formato da campanha` |
| Screen-reader legend | `Selecione o formato da campanha` |
| Option 1 (default) | `Quadrado 1:1 — feed` |
| Option 2 | `Vertical 9:16 — Stories e Reels (imagem estática)` |
| Vertical helper (scope note) | `Imagem estática, sem vídeo. As áreas seguras seguem a política do Vendeo e podem variar conforme a plataforma.` |
| Paused banner — title | `Novo envio vertical pausado` |
| Paused banner — body | `Este rascunho foi criado no formato Vertical 9:16. O envio de novas campanhas verticais está temporariamente indisponível. Sua escolha de formato foi preservada.` |
| Submit disabled (paused) — tooltip/description | `O envio de novas campanhas verticais está indisponível no momento.` |
| Format revoked at submit (server, pre-credit) | `O formato Vertical 9:16 está temporariamente indisponível. Nada foi cobrado. Sua escolha foi preservada — tente novamente mais tarde.` |
| Format invalid/unsupported (server) | `Não foi possível confirmar o formato desta campanha. Nada foi cobrado.` |
| Review row label | `Formato` |
| Review value | exact option label (§ above) |
| Review vertical hint (optional) | `1080 × 1920 px` |
| Detail unavailable (reuse) | existing unavailable copy — unchanged |
| Admin evidence | `Formato: Vertical 9:16` · `Formato: Quadrado 1:1` |
| Destructive actions | **None in this phase** — no confirmation dialog required |

**Copy rules enforced:**
- Never write "vídeo", "Reels com movimento", "todos os posicionamentos",
  "compatível com todas as redes", "Stories e Feed" or any unrestricted claim.
- Never write "converta", "troque o formato", "gere nos dois formatos".
- Never imply the restored draft switched to 1:1.
- "Nada foi cobrado" appears **only** on a blocked/rejected pre-credit submission.
- No emojis, no marketing jargon.

---

## 12. Interaction & State Contract

| State | Behavior |
|-------|----------|
| New draft, flag ON, eligible | Selector mounted; `1:1` checked; no `campaignFormat` in body. |
| New draft, flag ON — user selects vertical | `9:16` checked; helper visible; body gains `campaignFormat: "9:16"`; **new** draft identity (fingerprint change). |
| New draft, flag ON — user returns to 1:1 | `1:1` checked; `campaignFormat` removed from body; 1:1 payload byte-compatible. |
| Legacy / not eligible | Selector **not mounted**; no banner; body unchanged. |
| Flag OFF, new draft | Selector **not mounted**; no banner; existing 1:1 behavior. |
| Flag OFF, restored vertical draft | Paused (§7): vertical checked, radios disabled, amber banner, submit disabled, `1:1` never auto-selected/submitted. |
| Flag ON, restored vertical draft | Vertical checked and selectable; new attempt submits `9:16`. |
| Flag ON, restored 1:1 draft | `1:1` checked; no vertical pre-selection. |
| Submit (normal) | Unchanged flow: `Revisar e gerar` → review (format row) → generation. |
| Format revoked between render and POST | Server rejects pre-credit; keep all draft fields; show the revocation copy in the existing `ErrorState`; selector stays on the user's choice (no silent 1:1). |
| Malformed/unsupported persisted format | Fail-closed: unavailable state via existing error surface; never reinterpret as 1:1. |
| Generation running | Unchanged (`GenerationProgress`); format is already frozen. |
| Failure + refunded / unknown | Unchanged existing surfaces; format preserved on restore. |
| Reduced motion | Unchanged: 150–300ms transitions; no new animation; no layout-shifting hover. |

**Never:** auto-switch format, submit a different format than displayed, offer conversion,
reuse a 1:1 artifact path for a vertical campaign, or show a vertical thumbnail cropped.

---

## 13. Component Inventory

| Component | Kind | Source / Notes |
|-----------|------|----------------|
| `CampaignInputForm` | reuse + extend | `src/components/flow/campaign-input-form.tsx`; add the format group as part of `FormContent`, gated by `eligible && verticalEnabled` or paused-restore |
| `useCampaignForm` | reuse + extend | `src/components/flow/use-campaign-form.ts` — `campaignFormat` field, body inclusion, restore hydration, fingerprint participation, paused flag |
| Format selector | screen-local | Thin component mirroring `BackgroundDirectionSelector` (fieldset + radio rows + helper); `data-testid="flow-campaign-format-selector"` |
| Paused banner | screen-local | Amber banner; reuses `generationPaused` styling; `role="alert"` |
| `CampaignBriefReview` | reuse + extend | add `Formato` row only |
| `CampaignPageClient` / detail client | reuse | pass format booleans/values structurally; no `display.ts` → vertical-module import |
| `FieldHint` | reuse | helper styling if a shared component is preferred over a plain `<p>` |
| `ErrorState` | reuse | revocation/invalid-format messages |
| Admin evidence block | reuse + extend | add one read-only line |

Icons (lucide only, `aria-hidden` when decorative): `AlertTriangle` (paused banner),
`AlertCircle` (errors), `Loader2` (existing spinner). No new icons.

Suggested test ids: `flow-campaign-format-selector`,
`campaign-format-option-1-1`, `campaign-format-option-9-16`,
`campaign-format-paused`, `review-format-value`.

---

## 14. Accessibility

- **Radio semantics:** native `<fieldset>` + `<legend>` (legend may be `sr-only` when the
  visible group heading is an `h2` referenced by `aria-labelledby`). All radios share
  `name="campaignFormat"`; exactly one `checked` at all times. Arrow-key navigation and
  roving selection come from the native radio group — do not reimplement with buttons.
- **Labels:** every radio has an associated `<label>` (wrap the input or `htmlFor`);
  the visible option text is the accessible name — no `aria-label` overriding it.
- **`aria-describedby`:** vertical radio → helper id + paused id (when paused); 1:1 radio
  → helper id (same scope note); submit button → paused id when blocked.
- **Announcements:** paused banner `role="alert"`; server errors via existing
  `role="alert"` `ErrorState`; no `aria-live` duplication.
- **Focus:** visible ring via `focus-within:ring-2 focus-within:ring-accent-blue/40` on the
  option row and the registered `focus:ring-2 focus:ring-accent-blue/20` on the input;
  focus order: 1:1 → vertical → next form field. Disabled radios are not focusable.
- **Touch targets:** ≥44px per option row; no target smaller than 44px on mobile.
- **Color:** selection and paused state conveyed by text + radio state + icon, never hue
  alone. Text contrast: option text `text-primary` (18.5:1), helper `text-secondary` (9:1),
  paused body `accent-amber/90` on `accent-amber/10` over `#020617`.
- **Zoom/reflow:** at 200% and 320px width, labels wrap without horizontal scroll.
- **Semantics:** `<section aria-labelledby>` for the group; no nested interactive elements;
  disabled submit keeps its accessible name (`Revisar e gerar`).
- `prefers-reduced-motion` respected; no new motion.

---

## 15. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| `< 640px` | Options stacked full width; vertical label wraps to 2 lines; helper full width; paused banner full width above the group; submit remains full width (existing). |
| `≥ 640px` | Identical stacked layout, constrained to the existing form width; **no** side-by-side format cards (long label would break). |
| `≥ 1024px` | No change beyond the form `max-w-3xl`; no sticky/affixed format control. |
| Detail | Vertical art constrained by `max-h-[70vh]` and centered; never overflows viewport horizontally; no horizontal scroll at any width. |

No layout shift when helper/paused banner is present: the helper is always present when
the selector is mounted; the paused banner replaces nothing (it is additive above).

---

## 16. Verification (UI)

**Automated (focused):**
1. Selector present when `eligible && verticalEnabled`; absent when `!eligible`; absent
   when flag OFF and no restored vertical.
2. Default is `1:1`; exactly one radio checked; both option labels exact.
3. Selecting vertical adds `campaignFormat: "9:16"` and changes draft identity;
   returning to 1:1 removes the key and preserves 1:1 byte-compatibility.
4. Legacy / not eligible: body has **no** `campaignFormat` and no selector in the DOM.
5. Restore vertical + flag ON ⇒ vertical checked; submit includes `"9:16"`.
6. Restore vertical + flag OFF ⇒ vertical checked, radios disabled, paused banner
   rendered, submit disabled, **no** `1:1` in body/state, no forged 1:1 request.
7. Review renders `Formato` with the exact label for both formats; legacy has no row.
8. Detail container uses `aspect-[9/16]` for vertical and square for 1:1/absent.
9. Accessibility assertions: fieldset/legend, `aria-describedby` wiring,
   44px min height, `role="alert"` on paused banner, and disabled state announced.

**Visual / manual:**
- Dark OLED theme, tokens only; no new colors; Poppins/Open Sans as specified.
- Vertical helper reads as scope information, not marketing; no video/all-placements claim.
- 320px width and 200% zoom: no clipping, no horizontal scroll, label wraps.
- Keyboard: Tab reaches the group; arrows change selection (when enabled); focus ring
  visible; paused state cannot be submitted by Enter.
- 1:1 regression: the form, review and detail are visually identical to today.

**Gates (from the phase):** typecheck, lint, build, focused tests, 1:1 regression,
OpenSpec strict, `git diff --check`. Visual acceptance with real Stories/Reels
overlays happens in homolog (separate gate) — this UI contract does not assert visual
safe-area correctness of the generated art.

---

## 17. Traceability (UI ↔ requirement)

| UI element | Requirement / Decision |
|------------|------------------------|
| Selector mount gating (eligible + flag) | `product-vertical-format-selection` §1; D-03; `campaign-input-ui` delta |
| Labels and vertical helper | `product-vertical-format-selection` §2; D-03 |
| Default 1:1 / exactly one format | `product-vertical-format-selection` §1 |
| `1:1` sends no format key | D-02/D-03; §1 "square snapshot unchanged" |
| Format in draft fingerprint | D-03; `format-selection` "frozen at creation" |
| Restored vertical preserved (flag ON) | `format-selection` §4; D-03 |
| Paused restore with flag OFF, blocked submit, no silent 1:1 | `format-selection` §4; `campaign-input-ui` ADDED requirement; D-03 |
| Review `Formato` row | ADDED requirement (restore preserves display) |
| Detail aspect by persisted format | D-13 (`read by persisted format`) |
| List untouched | D-12; D-13 |
| Admin evidence line | D-14 (`UI administrativa ganha apenas a identificação do formato`) |
| No conversion surface | `format-selection` §5 |
| 1:1 isolation / byte-compatibility | `format-selection` §6; D-01 |

---

## 18. Non-Blocking Recommendations (agent discretion)

Recorded, not blocking; sensible defaults where upstream was silent.

1. **Placement of the selector** — after product images, before `Oferta` (rationale:
   governs the whole piece; avoids burying it near submit). [default]
2. **Radio group vs. segmented control** — radio rows chosen to match
   `IntentSelector`/`BackgroundDirectionSelector` and to accommodate the long vertical
   label without truncation. No segmented control. [default]
3. **Both radios disabled in paused state** — prevents any ambiguity between "explicit
   1:1 choice" and "silent switch"; the pause is temporary and the draft is preserved. [default]
4. **Helper always visible when mounted** — avoids layout shift and explains vertical
   before selection. [default]
5. **Review size hint** (`1080 × 1920 px`) — optional, muted; add only if it does not
   compete with the value. [default]
6. **No format badge on detail/list** — D-12 forbids card redesign; the visible aspect
   ratio already communicates the format. [locked by D-12]
7. **Detailed aspect handling uses container classes only** — no image re-processing,
   no client-side crop. [default]

---

## 19. Checker Sign-Off

_Pending — `status: draft`. `gsd-ui-checker` validates the 6 dimensions and upgrades to
`approved`._
