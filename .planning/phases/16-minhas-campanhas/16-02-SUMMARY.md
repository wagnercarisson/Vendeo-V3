# Plan 16-02 Summary — UI `/minhas-campanhas` + Navegação

**Status:** ✅ Complete  
**Date:** 2026-07-10  

## Created

- `src/app/minhas-campanhas/page.tsx` — Server Component: auth → store → listCampaigns
- `src/app/minhas-campanhas/client.tsx` — Client Component: lista de cards + empty state

## Modified

- `src/components/auth/auth-header.tsx` — Added "Minhas Campanhas" link before LogoutButton
- `src/app/campanha/[id]/client.tsx` — Added "← Minhas Campanhas" back link at top (all states)
- `src/app/campaign/preview/page.tsx` — Redirect authenticated+store → `/minhas-campanhas` (removed `CampaignPreviewClient` import)
- `src/middleware.ts` — Added `/minhas-campanhas` to `config.matcher`

## Implementation Details

### page.tsx
- `requirePageUser()` → `getCurrentStore(user.userId)` → redirect `/store` se null → `listCampaigns(store.id)`

### client.tsx
- Lista de cards com: thumbnail (img ou placeholder), productName, data (dd/mm/aaaa), status ("Pronta"/"Erro"), "Abrir" link, "Baixar" (só ready)
- EmptyState: "Nenhuma campanha encontrada" + CTA "Criar Primeira Campanha" → `/`
- Status spans com classe `campaign-card__status--ready` / `--error`

### Navigation
- AuthHeader: link aparece apenas após `requireUser()` bem-sucedido
- Back link em `/campanha/[id]`: presente em todos os estados (ready, generating, stale, error)
- Preview redirect: remove dead import de `CampaignPreviewClient`
