## Context

The campaign generation flow currently ends at the API response. `CampaignInputForm` sends data to `/api/campaign/generate`, receives a `CampaignSpec` JSON, and shows a success message — but no visual preview exists. The lojista cannot see the generated art before deciding what to do next.

The existing codebase has:
- `CampaignInputForm` + `useCampaignForm` hook — form state, validation, submission
- `CampaignPageClient` — orchestrator that loads store identity and renders the form
- `/api/campaign/generate` — returns `CampaignSpec` (commercial_copy, offer, visual_parameters, generation_metadata)
- `CAMPAIGN_VISUAL_SYSTEM.md` — detailed rendering spec (zones, typography, colors, safe areas, variations)
- `campaign-preview.md` — page layout spec (art preview + adjustments panel)

No rendering or preview infrastructure exists yet. This design covers the first visual preview layer only — no export, no persist, no approval.

## Goals / Non-Goals

**Goals:**
- Pure React `CampaignRenderer` component that visually composes a `CampaignSpec` into a fixed 1080×1080 reference layout
- `/campaign/preview` route displaying the rendered art + quick adjustments panel
- sessionStorage-based navigation from form → preview (no new API)
- Client-side adjustments (title, price, badge) that re-render locally without API calls
- Responsive scaling of the 1080×1080 composition in the browser
- Empty/error state guiding user back to campaign input

**Non-Goals:**
- Export or download of the campaign image
- Persistence of the campaign (no database writes)
- Approval workflow or history
- Multiple variation rendering (one layout per preview)
- Canvas/SVG-based pixel-level rendering engine
- API contract changes

## Decisions

### 1. Rendering approach: CSS composition (Tailwind + aspect-ratio container)

- **Chosen:** CSS-based composition using Tailwind utility classes inside a fixed-aspect-ratio container
- **Alternatives considered:**
  - **Canvas API (HTML Canvas / react-konva):** More pixel control, but over-engineering for a browser preview. Canvas would require reimplementing text layout, overflow handling, and responsive scaling manually.
  - **SVG renderer:** Good for export fidelity, but complex text wrapping and responsive scaling add overhead. SVG makes sense for Phase 5 (export pipeline).
  - **HTML2Canvas / dom-to-image:** Heavy dependency, async rendering, inconsistent output. Better suited for export than preview.
- **Rationale:** CSS is the fastest path to a faithful preview. The 1080×1080 reference composition uses `width: min(100%, 1080px)` with `aspect-[1/1]` to preserve square ratio while scaling down. Zone positions use percentage-based sizing matching `CAMPAIGN_VISUAL_SYSTEM.md` zone distribution. For Phase 4.1 (preview only), CSS fidelity is sufficient — the export pipeline in Phase 5 will use a separate rendering engine.

### 2. Component architecture

```
PreviewPage (page.tsx)
├── reads preview payload from sessionStorage
├── manages local adjustment state (title, price, badge overrides)
└── renders:
    ├── CampaignRenderer ← CampaignSpec + adjustments + store identity
    └── CampaignAdjustmentsPanel ← triggers setState on the page
```

- `CampaignRenderer` is a pure presentational component — it renders what it receives, no side effects, no state
- `CampaignAdjustmentsPanel` emits change events upward; the preview page owns the adjusted state
- This keeps the renderer testable and the adjustment logic isolated

### 3. Store identity: passed explicitly through props

- `CampaignPageClient` resolves the store identity once and passes a `storeIdentity` prop into `CampaignInputForm`
- `CampaignInputForm` forwards it to `useCampaignForm` — the hook uses the snapshot only to compose the preview payload after successful generation
- No extra fetch and no API change

```typescript
interface StoreIdentitySnapshot {
  storeName: string;
  storeSegment: string;
  brandColor: string;
  logoUrl: string | null;
}
```

- `brandColor` is resolved via `resolveStoreIdentity` from `src/lib/store.ts` (already used by `StoreIdentityBlock`)

### 4. Preview payload in sessionStorage

```typescript
interface PreviewPayload {
  campaignSpec: CampaignSpec;
  storeIdentity: StoreIdentitySnapshot;
  productImageUrl: string | null;
  generatedAt: string;
}
```

- `productImageUrl` is the existing client-side object URL from `useCampaignForm`'s image preview (`URL.createObjectURL`) — no file, blob, or base64 stored in sessionStorage
- When using `URL.createObjectURL`, the object URL must NOT be revoked when navigating from campaign input to preview. It must remain valid for the preview route and only be revoked when starting a new campaign, clearing the preview payload, or leaving the preview flow
- Written by `useCampaignForm` on successful API response
- Read by `PreviewPage` on mount
- Cleared when navigating back to campaign input or on explicit "new campaign"
- sessionStorage (not localStorage) so it's cleared on tab close — appropriate for an in-progress preview

### 5. Quick adjustments: local state override

- The preview page holds a `localAdjustments` state object that can override:
  - `title` (overrides `commercial_copy.title`)
  - `discountedPriceDisplay` (overrides `offer.discounted_price_display`)
  - `badgeText` (overrides `offer.badge_text`)
- When an override is set, `CampaignRenderer` receives the merged spec instead of the original
- No API call — purely client-side `useState`
- An "undo" button resets individual overrides to the original spec values

### 6. Responsive scaling

- Container: `w-full max-w-[1080px] aspect-[1/1] mx-auto`
- Inner content uses percentage-based sizing relative to the container
- Font sizes use `clamp()` or relative units scaled to container width
- This ensures the composition fills available width responsively while keeping square proportions
- On mobile (< 640px), the art fills full width with no side panel; adjustments collapse below

### 7. Empty/error state

- On mount, if no valid `PreviewPayload` exists in sessionStorage → show empty state with message "Nenhuma campanha encontrada" + button "Criar Nova Campanha" → navigates to the campaign input route
- On error reading/parsing payload → show error state + retry/back button
- Both states use the existing pattern from `CampaignPageClient` (icon + heading + message + action)

### 8. CampaignRenderer internal composition mapping

The component maps `CampaignSpec` + store identity to the visual zones defined in `CAMPAIGN_VISUAL_SYSTEM.md`:

| Zone | Source | Notes |
|------|--------|-------|
| Background | visual_parameters.background_style → segment palette from CAMPAIGN_VISUAL_SYSTEM.md §8 | Fallback to white |
| Product image | `productImageUrl` from preview payload (§4) | Object URL, stored in sessionStorage alongside spec |
| Badge | offer.badge_text + visual_parameters.badge_style | Top-right per §3.3 |
| Product name | offer.product_name | §3.4 typography rules |
| Price | offer.original_price_display + offer.discounted_price_display | §3.5 strikethrough logic |
| Description | commercial_copy.subtitle | §3.6 |
| CTA | commercial_copy.cta | §3.7 pill button |
| Store identity | StoreIdentitySnapshot | §3.8 logo/initials + name |

## Risks / Trade-offs

- **[CSS fidelity gap]** CSS rendering in browser may differ from final exported PNG. Text rendering, anti-aliasing, and color profiles are browser-dependent.
  - **Mitigation:** Document this as a known limitation in Phase 4.1. Phase 5 (export pipeline) will use a deterministic renderer (e.g., `@vercel/og` or node-canvas) for pixel-level control.
- **[Product image not in CampaignSpec]** The current `/api/campaign/generate` response does not include the product image URL. The image is uploaded client-side but not returned by the API.
  - **Mitigation:** Use the existing client-side product image object URL and store it as `productImageUrl` in the preview payload. No file, blob, or base64 stored in sessionStorage.
- **[sessionStorage size limit]** sessionStorage quota is ~5-10MB. A product image blob could approach limits.
  - **Mitigation:** Store only the object URL (not the image data itself). If the object URL is unavailable or invalid (e.g., after page refresh), show an explicit preview error state instead of silently rendering a placeholder — the product image is essential for campaign validation.
- **[Over-adjustment expectations]** The quick adjustments panel may lead users to expect Canva-level editing freedom.
  - **Mitigation:** Clearly label as "Ajustes Rápidos" with constrained fields only. Follow the Anti-Canva rules from CAMPAIGN_VISUAL_SYSTEM.md §10.
- **[No variation rendering]** The current spec lists 5 layout variations (A-E) but rendering only one layout per preview.
  - **Mitigation:** Explicit non-goal for this phase. The `visual_parameters.layout_preset` field determines which variation to render.

## Migration Plan

No migration needed — this is additive code with no existing visual layer to replace.

1. Create `src/components/campaign/campaign-renderer.tsx` — pure component
2. Create `src/components/campaign/campaign-adjustments-panel.tsx` — adjustment form
3. Create `src/app/campaign/preview/page.tsx` — preview route with loading/empty/error/ready states
4. Modify `src/components/flow/use-campaign-form.ts` — capture preview payload, store in sessionStorage
5. Modify `src/components/flow/campaign-input-form.tsx` — navigate on success
6. Verify with `npm run typecheck && npm run lint && npm run build`

Rollback: revert changes to `use-campaign-form.ts` and `campaign-input-form.tsx`, delete new files.

## Final Implementation Decisions

1. **Product image:** Use the existing client-side object URL and store it as `productImageUrl` in the preview payload. No file, blob, or base64 stored in sessionStorage. This works for SPA navigation. If the preview page is refreshed and the URL is no longer valid, show an explicit preview error state — the product image is essential for campaign validation.
2. **Product image unavailable:** If `productImageUrl` is missing or invalid, show an explicit preview error state. No silent placeholder for product-offer campaigns.
3. **Store identity flow:** `CampaignPageClient` resolves store identity once and passes it through `CampaignInputForm` into `useCampaignForm`. No extra fetch and no API change.
4. **Unsupported layout_preset:** If `visual_parameters.layout_preset` is missing or unsupported, fall back to the primary product-offer layout (Variation A from CAMPAIGN_VISUAL_SYSTEM.md §7). Do not break the preview.
5. **No API changes, no database changes, no new dependencies.**
