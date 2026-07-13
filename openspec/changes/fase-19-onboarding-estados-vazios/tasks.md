## 1. Plano 19-01 — Fundação do Onboarding Helper

- [ ] 1.1 Criar `src/lib/onboarding/types.ts` com `OnboardingState` (union type de 3 strings) e `EmptyStateCopy` (interface com `icon`, `title`, `description`, `ctaLabel?`, `ctaHref?`)
- [ ] 1.2 Criar `src/lib/onboarding/count.ts` com `countCampaigns(storeId)` — `"server-only"`, `SELECT COUNT(*)` com `head:true`, filtro `store_id` + `status IN ('ready','error')`
- [ ] 1.3 Criar `src/lib/onboarding/state.ts` com `getUserOnboardingState(userId)` — `"server-only"`, chama `getCurrentStore` + `countCampaigns`, retorna os 3 estados
- [ ] 1.4 Criar `src/lib/onboarding/microcopy.ts` com constantes: `DASHBOARD_NO_STORE`, `DASHBOARD_NO_CAMPAIGNS`, `DASHBOARD_PLACEHOLDER`, `CAMPAIGNS_NO_STORE`, `CAMPAIGNS_NO_CAMPAIGNS`
- [ ] 1.5 Criar testes unitários em `src/__tests__/lib/onboarding/`:
  - `state.test.ts`: mock `getCurrentStore` e `countCampaigns`, testar 3 estados (no_store, has_store_no_campaigns, has_store_with_campaigns)
  - `count.test.ts`: mock `supabase.from().select().eq().in()`, testar count com e sem resultados
  - `microcopy.test.ts`: testar que todas as constantes têm `icon`, `title`, `description` preenchidos; se `ctaLabel` presente, `ctaHref` também
- [ ] 1.6 Rodar `npm run typecheck`, `npm run lint` — zero erros

## 2. Plano 19-02 — Dashboard Inteligente

- [ ] 2.1 Modificar `src/app/(app)/dashboard/page.tsx`:
  - Converter para async Server Component
  - Chamar `requirePageUser()` e `getUserOnboardingState(user.userId)`
  - Switch pelos 3 estados renderizando `<PageHeader title="Dashboard" />` + `<EmptyState>` apropriado
  - Estado `no_store`: empty state com `DASHBOARD_NO_STORE` + CTA → `/loja`
  - Estado `has_store_no_campaigns`: empty state com `DASHBOARD_NO_CAMPAIGNS` + CTA → `/campanhas/nova`
  - Estado `has_store_with_campaigns`: empty state com `DASHBOARD_PLACEHOLDER` (sem CTA)
- [ ] 2.2 Criar testes do dashboard em `src/__tests__/app/dashboard/` (5-6 cenários):
  - Renderiza empty state "Configure sua loja" quando `no_store` + CTA → `/loja`
  - Renderiza empty state "Crie sua primeira campanha" quando `has_store_no_campaigns` + CTA → `/campanhas/nova`
  - Renderiza placeholder neutro quando `has_store_with_campaigns` (sem CTA, sem métricas)
  - `<PageHeader>` com título "Dashboard" presente em todos os estados
  - Propaga erro para error boundary do Next.js quando `getUserOnboardingState` lança
  - `getUserOnboardingState` é chamado com `user.userId`
- [ ] 2.3 Rodar `npm run typecheck`, `npm run lint` — zero erros

## 3. Plano 19-03 — Campanhas + Detalhe sem Loja

- [ ] 3.1 Modificar `src/app/(app)/campanhas/page.tsx`:
  - Substituir `if (!store) { redirect("/loja"); }` por `if (!store) { return <EmptyState> }` com `CAMPAIGNS_NO_STORE` + CTA → `/loja`
  - Garantir que `countCampaigns` NÃO é chamado quando `no_store` (early return)
- [ ] 3.2 Modificar `src/app/(app)/campanhas/[id]/page.tsx`:
  - Substituir `redirect("/loja")` por `notFound()` quando `!store`
- [ ] 3.3 Verificar `src/app/(app)/campanhas/nova/page.tsx`: confirmar que `redirect("/loja")` permanece inalterado (sem modificações)
- [ ] 3.4 Revisar `src/app/(app)/campanhas/client.tsx`: empty state "Nenhuma campanha ainda" deve referenciar `CAMPAIGNS_NO_CAMPAIGNS` de `microcopy.ts` (se ainda usa texto inline, substituir pela constante)
- [ ] 3.5 Criar testes em `src/__tests__/app/campanhas/` (5-6 cenários):
  - Sem loja em `/campanhas` → renderiza empty state "Configure sua loja" com CTA `/loja` (NÃO redireciona)
  - Sem loja em `/campanhas/[id]` → `notFound()` chamado (NÃO redireciona para `/loja`)
  - Sem loja em `/campanhas/nova` → `redirect("/loja")` é chamado (mantido)
  - Loja sem campanhas → renderiza empty state "Nenhuma campanha ainda" com CTA → criar
  - Loja com campanhas → renderiza lista
  - `countCampaigns` não é chamado quando `no_store` em `/campanhas` (performance)
- [ ] 3.6 Rodar `npm run typecheck`, `npm run lint` — zero erros

## 4. Verificação Final

- [ ] 4.1 Dashboard mostra os 3 estados corretamente: `no_store` → CTA loja, `has_store_no_campaigns` → CTA criar, `has_store_with_campaigns` → placeholder
- [ ] 4.2 `/campanhas` sem loja mostra empty state e não redireciona
- [ ] 4.3 `/campanhas/[id]` sem loja retorna 404 (não redireciona)
- [ ] 4.4 `/campanhas/nova` sem loja redireciona para `/loja` (mantido)
- [ ] 4.5 Fluxo de loja (`/loja`) intacto — nenhuma alteração
- [ ] 4.6 Todas as strings de empty state estão em `src/lib/onboarding/microcopy.ts`
- [ ] 4.7 Nenhuma query desnecessária é feita (ex.: `countCampaigns` não é chamado se `no_store`)
- [ ] 4.8 Rodar `npm run typecheck` — zero erros
- [ ] 4.9 Rodar `npm run lint` — zero erros
- [ ] 4.10 Rodar `npx vitest run` — todos os testes passando (15+ novos + existentes)
- [ ] 4.11 Rodar `npm run build` — build bem-sucedido
