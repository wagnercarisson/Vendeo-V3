# Debug Session: Inferred Accent Color Persisted as User Choice

## Phase: 04.6.7-user-color-preferences-persistence

## Symptom
After partial color choice (primary only, accent untouched), the inferred accent color is persisted in `brand_colors_chosen[1]` instead of remaining `null`.

## Root Cause
Dual-use anti-pattern: `accentColor` state serves both UX display AND persistence source. After inference fills `accentColor` with the inferred value, save paths read `accentColor` directly instead of `brandColorsChosen[1]`.

## Affected Sites in `src/components/flow/store-identity-form.tsx`

| Site | Line | Issue |
|------|------|-------|
| `executeStep2Save` guard + call | 844-846 | Reads `accentColor` instead of `brandColorsChosen[1]` |
| Primary picker onChange | 1428 | Reads `accentColor` instead of `brandColorsChosen[1]` |
| Primary picker onBlur | 1442 | Reads `accentColor` instead of `brandColorsChosen[1]` |
| Detected colors "P" button | 1511 | Reads `accentColor` instead of `brandColorsChosen[1]` |

## Fix
Replace `accentColor` with `brandColorsChosen[1]` in all 4 save sites. Keep `accentColor` for display-only purposes.

## Backend Confirmation
All backend routes are correct — they faithfully persist what they receive. Fix is fully contained in frontend.
