## 1. CampaignRenderer Component

- [ ] 1.1 Create `CampaignRenderer` component with props interface (`CampaignSpec` + `StoreIdentitySnapshot` + `productImageUrl`)
- [ ] 1.2 Implement 1080×1080 fixed reference container with responsive scaling (`w-full max-w-[1080px] aspect-[1/1]`)
- [ ] 1.3 Implement product image zone (~55% height, `object-fit: cover`, centered) with gradient overlay
- [ ] 1.4 Implement badge zone (top-right corner, pill shape, accent color from palette, omitted if no text)
- [ ] 1.5 Implement product name zone (Poppins 700, center, 42px/36px based on length, max 2 lines)
- [ ] 1.6 Implement price zone (strikethrough original if present, discounted price in accent color, 44px fallback)
- [ ] 1.7 Implement description zone (Open Sans 400, conditional hide, CTA shift up)
- [ ] 1.8 Implement CTA pill button (accent color background, white text, Poppins 700, fallback "Aproveite Agora!")
- [ ] 1.9 Implement store identity zone (circular logo or initials fallback, store name below)
- [ ] 1.10 Implement error/fallback states: missing product image error, logo load failure → initials fallback

## 2. Preview Page

- [ ] 2.1 Create `src/app/campaign/preview/page.tsx` route
- [ ] 2.2 Implement sessionStorage payload reader with empty state ("Nenhuma campanha encontrada") and error state
- [ ] 2.3 Implement desktop layout: art left + adjustments panel right (≥768px)
- [ ] 2.4 Implement mobile layout: art full-width, adjustments collapsed below (<768px)
- [ ] 2.5 Wire CampaignRenderer into preview page with responsive container

## 3. Quick Adjustments Panel

- [ ] 3.1 Create `CampaignAdjustmentsPanel` component
- [ ] 3.2 Implement title text override with undo (resets to original spec value)
- [ ] 3.3 Implement discounted price display override (visual-only, no recalculation) with undo
- [ ] 3.4 Implement badge text override with undo
- [ ] 3.5 Wire adjustments state to re-render CampaignRenderer locally without API calls

## 4. Campaign Input Form Wiring

- [ ] 4.1 Add `storeIdentity` prop to `CampaignInputForm` and forward to `useCampaignForm`
- [ ] 4.2 Modify `useCampaignForm` submit: call `POST /api/campaign/generate`, compose `PreviewPayload`, store in sessionStorage, navigate to `/campaign/preview`
- [ ] 4.3 Implement loading state: disable form fields and button during generation, freeze payload from submit-time state
- [ ] 4.4 Implement error state for API failures with retry option
- [ ] 4.5 Ensure object URL lifecycle: revoke on new campaign/preview exit, NOT on navigation to preview; tab close handled by browser

## 5. Verification

- [ ] 5.1 Run `npm run typecheck`
- [ ] 5.2 Run `npm run lint`
- [ ] 5.3 Run `npm run build`
