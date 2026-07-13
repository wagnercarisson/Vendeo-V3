# 18-01: UI Base + Estrutura + Redirects

**Status:** ✓ Complete
**Date:** 2026-07-13
**Commit:** 900be21

## Deliverables

### UI Components (src/components/ui/)
- `button.tsx` — Client, 3 variants (primary/secondary/ghost), loading state with Loader2
- `card.tsx` — Server, bg-bg-surface, border, rounded-xl
- `input.tsx` — Client, label, error, design token styling
- `badge.tsx` — Server, 4 variants (ready/error/generating/default)
- `empty-state.tsx` — Server, icon/title/description/action
- `skeleton.tsx` — Server, width/height/rounded with animate-pulse
- `page-header.tsx` — Title, optional breadcrumbs with/without href, actions slot

### Route Structure (src/app/(app)/)
- `layout.tsx` — skeleton (will be filled in 18-02)
- `dashboard/page.tsx` — empty
- `campanhas/page.tsx` — empty
- `campanhas/nova/page.tsx` — campaign form migrated from root
- `campanhas/[id]/page.tsx` — empty
- `loja/page.tsx` — empty
- `conta/page.tsx` — empty

### Root Layout Cleanup
- AuthHeader removed from root layout
- `<header>` element removed
- Root layout simplified to html/body/fonts/globals only

### Redirects (next.config.ts)
- `/` → `/dashboard` (301)
- `/minhas-campanhas` → `/campanhas` (301)
- `/campanha/:id` → `/campanhas/:id` (301)
- `/store` → `/loja` (301)
- `/campaign/preview` → `/campanhas/nova` (301)

### Tests
- 7 test files in `src/__tests__/components/ui/`
- 13 scenarios total — all passing
- TypeScript: clean | Lint: clean

## Verification
- [x] 7 componentes UI criados
- [x] Estrutura (app)/ criada com pages vazias
- [x] Campaign form migrado para /campanhas/nova
- [x] Root layout sem AuthHeader
- [x] Root page redireciona para /dashboard
- [x] 5 redirects 301 em next.config.ts
- [x] 13 testes passando
- [x] typecheck e lint limpos
