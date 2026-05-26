## Why

Campaign generation currently ends at the API response — a `CampaignSpec` JSON is returned but never visualised. The lojista has no way to see the generated campaign art before publishing. Without a visual preview, the core value proposition ("campanha profissional pronta para publicar") is incomplete. This phase delivers the first visual rendering and preview flow, closing the gap between generation and publication.

## What Changes

- **CampaignRenderer component**: Pure React component that renders a fixed 1080×1080 reference composition from a `CampaignSpec` + store identity data, following `CAMPAIGN_VISUAL_SYSTEM.md` layout rules — scales responsively in the browser while preserving layout, hierarchy, safe zones, and publication-quality readability
- **`/campaign/preview` route**: Client preview page with rendered art + quick adjustments panel (title, price, badge) — no export/persist/approve yet
- **CampaignInputForm wiring**: On successful generation, store a preview payload in sessionStorage and navigate to `/campaign/preview`:
  ```json
  {
    "campaignSpec": CampaignSpec,
    "storeIdentity": StoreIdentitySnapshot,
    "productImageUrl": "string | null",
    "generatedAt": "ISO-8601"
  }
  ```
  The store identity data must be resolved from the existing client-side store state. If the current form flow does not expose enough store identity data, stop and report the gap before adding API or contract changes.
- **Quick local adjustments**: Edit title copy, price display, and badge text locally; re-render `CampaignRenderer` without new API call
- **Empty/error state**: Guide user back to campaign input when no spec is found

## Capabilities

### New Capabilities
- `campaign-visual-renderer`: Pure React component that renders a fixed 1080×1080 reference composition from a CampaignSpec + store identity data, following CAMPAIGN_VISUAL_SYSTEM.md composition rules, safe zones, typography scale, and color palette — scales responsively while preserving layout and readability
- `campaign-preview-page`: Client route `/campaign/preview` displaying the rendered campaign art with a quick adjustments panel for local copy/price/badge edits, empty/error states, and responsive scaling
- `campaign-generation-navigation`: Wiring from CampaignInputForm to store preview payload in sessionStorage on successful generation and redirect to `/campaign/preview`

### Modified Capabilities
- `campaign-input-flow`: after successful generation, the form stores preview data (CampaignSpec + store identity snapshot) in sessionStorage and navigates to `/campaign/preview`

## Acceptance Criteria

- CampaignRenderer preserves a square 1080×1080 reference composition
- Preview scales responsively without breaking aspect ratio
- Product image, badge, title, price, CTA and store identity are visually balanced
- Text does not overflow unsafe areas
- Missing logo falls back to store name
- Missing optional price/badge fields do not break the layout
- Quick adjustments update the visual locally without API calls
- Empty preview state guides the user back to campaign input
- Visual composition follows UI/UX Pro Max guidance for hierarchy, readability, contrast, spacing, CTA prominence, brand consistency, and professional publication quality
- No database changes, no export, no approval, no persistence
- `npm run typecheck`, `npm run lint`, and `npm run build` pass

## Impact

- **New component**: `src/components/campaign/campaign-renderer.tsx` — pure visual renderer
- **New component**: `src/components/campaign/campaign-adjustments-panel.tsx` — quick edit controls
- **New route**: `src/app/campaign/preview/page.tsx` — preview page
- **Modified**: `src/components/flow/campaign-input-form.tsx` — add navigation to preview on success
- **Modified**: `src/components/flow/use-campaign-form.ts` — add preview payload storage + redirect
- **No API changes.** If required data is missing client-side, stop and report the gap before modifying the API
- **No database changes, no new dependencies**
- **No export/download, no persist/approve, no campaign history**
