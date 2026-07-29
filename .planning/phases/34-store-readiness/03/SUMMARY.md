# Plan 03: Step 2 UX + Billing Card — Summary

**Status:** ✅ Complete  
**Wave:** 2  
**Phase:** 34-store-readiness  
**Date:** 2026-07-29

## Deliverables

### Step 2 Renaming + Badge
- Step 2 stepper label: "Logo e Cores" → "Direção Visual" + badge "Necessário"
- Step 2 heading: "Logo e Cores" → "Direção Visual" with updated subtitle
- Surgical changes only (form is ~2050 lines)

### Post-Step-1 Success Message
- Both create and edit modes: "Loja salva. Agora configure a direção visual."

### Query Param Support
- `store-page-client.tsx`: reads `?required=visual-direction` via `useSearchParams`
- `StoreIdentityForm`: accepts `initialStep` prop, opens directly on Step 2
- Accessing `/loja?required=visual-direction` opens form on Step 2

### Billing Card (Step 1)
- Collapsible card "Dados para faturamento (opcional)" with expand/collapse toggle
- Auto-expands when CNPJ data resolved (address fields pre-filled)
- 10 billing fields (email, phone, street, number, complement, neighborhood, city, state, zipcode)
- "Confirmar dados de faturamento" button — disabled without minimum required data
- Calls `POST /api/store/billing/confirm` with ownership validation

### API Route
- `POST /api/store/billing/confirm` — auth + ownership check + upsert
- `billing_data_confirmed_at` set server-side when `confirmed: true`

### TypeScript
- `npx tsc --noEmit` — exit 0
