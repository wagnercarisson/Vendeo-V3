---
phase: 29-1-1
plan: 02
name: "Frontend — Modal UI + Ocultar Modal Antigo"
subsystem: "visual-signature-ui"
tags: ["frontend", "modal", "credits-ui"]
key-files:
  - src/components/flow/visual-signature-approval-modal.tsx
  - src/components/flow/store-visual-signature-section.tsx
metrics:
  files-changed: 2
  lines-added: 62
  lines-removed: 159
  commits: 1
---

## Frontend — Modal UI + Ocultar Modal Antigo

### What was built

1. **Removed `"exhausted"` phase** from ApprovalState and all render code
2. **Removed "Tentativa X/3" badge** from display and feedback phases
3. **Removed attempt >= 3 redirect** in handleReject (no more fetch-for-re-evaluation)
4. **Added `"insufficient_credits"` phase** — renders when API returns 402:
   - AlertCircle icon with `text-amber-500`
   - "Créditos insuficientes para gerar assinatura visual."
   - "Cada geração de assinatura visual consome 1 crédito."
   - "Ver meus créditos" → navigates to `/conta`
   - "Tentar novamente" → retries generation
5. **Updated checking phase** to fetch `?limit=6` and store `allLoadedSignatures` + `totalSignatures`
6. **Added "Ver versões anteriores" button** in display phase when `allLoadedSignatures.length > 1`
7. **Removed VisualSignatureModal import, state, and JSX** from store-visual-signature-section.tsx
8. **Cleaned up remaining quota wording** (exhausted/"after 3 attempts" messages)

### Deviations

None.

### Self-Check: PASSED

- TypeScript: ✓
- Lint: ✓
- Build: ✓
