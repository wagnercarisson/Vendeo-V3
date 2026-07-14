## 1. Plano 20-01 — Métricas e Recentes

- [x] 1.1 Criar `src/lib/campaign/metrics.ts` com `"server-only"`, `countCampaigns`, `countReadyCampaigns`, `getCampaignSuccessRate`, `getRecentCampaigns`, `RecentCampaignItem` — conforme D1 do design.md
- [x] 1.2 Reescrever `src/lib/onboarding/count.ts` como reexport de `@/lib/campaign/metrics` — mantendo compatibilidade F19 (D2)
- [x] 1.3 Verificar que `getUserOnboardingState` em `state.ts` continua funcionando com o reexport (nenhuma alteração em state.ts)
- [x] 1.4 Verificar que `DASHBOARD_PLACEHOLDER` em `microcopy.ts` não é mais referenciado pelo dashboard; manter constante se zero referências residuais (não remover se quebrar build)
- [x] 1.5 Criar testes unitários em `src/__tests__/lib/campaign/metrics.test.ts`:
  - `countCampaigns` retorna total (ready + error)
  - `countCampaigns` retorna 0 quando não há campanhas
  - `countReadyCampaigns` retorna apenas ready
  - `getCampaignSuccessRate` retorna 0% quando total = 0
  - `getCampaignSuccessRate` retorna 100% quando todos ready
  - `getCampaignSuccessRate` retorna 50% quando metade ready
  - `getRecentCampaigns` retorna N itens ordenados por data
  - `getRecentCampaigns` retorna array vazio sem campanhas
- [x] 1.6 Rodar `npm run typecheck`, `npm run lint` — zero erros

## 2. Plano 20-02 — Dashboard Completo

- [x] 2.1 Modificar `src/app/(app)/dashboard/page.tsx`:
  - Manter branches `no_store` e `has_store_no_campaigns` inalterados (F19 preservado)
  - Substituir `has_store_with_campaigns`: de `<EmptyState>` placeholder para conteúdo real
  - Após confirmar `has_store_with_campaigns`, chamar `getCurrentStore(user.userId)` para obter `store.id` e `store.name`
  - Chamar `countCampaigns(store.id)`, `countReadyCampaigns(store.id)`, `getRecentCampaigns(store.id, 5)` em paralelo com `Promise.all`
  - Calcular `rate = total > 0 ? Math.round((ready / total) * 100) : 0`
- [x] 2.2 Implementar saudação com hora do servidor:
  - Função `getGreeting(storeName)` que retorna "Bom dia", "Boa tarde", "Boa noite" + nome da loja
  - Fallback "Bem-vindo ao Vendeo" quando `storeName` for null
- [x] 2.3 Implementar 3 cards de métricas (`<Card>` da F18) em grid responsivo:
  - Total de Campanhas (valor de `countCampaigns`)
  - Campanhas Prontas (valor de `countReadyCampaigns`)
  - Taxa de Sucesso (valor de `rate` com `%`)
  - Grid: `grid-cols-1 md:grid-cols-3 gap-4`
- [x] 2.4 Implementar seção "Campanhas Recentes":
  - Lista de 3-5 itens com nome, data formatada (dd/mm), `<Badge>` de status, link "Abrir" → `/campanhas/[id]`
  - Link "Ver todas as campanhas →" → `/campanhas`
  - Sem thumbnails (tipo `RecentCampaignItem`, sem `storagePath`, sem signed URLs)
- [x] 2.5 Implementar card de próximo passo adaptativo (`<Card>` da F18):
  - Se `recentCampaigns[0]` existe: "Revise sua última campanha: {{productName}}" + CTA → `/campanhas/[latestId]`
  - Se lista vazia (edge case): "Criar nova campanha" + CTA → `/campanhas/nova`
  - Opção secundária "Nova" sempre visível no mesmo card
- [x] 2.6 Adicionar link discreto "Configurar loja" → `/loja` no dashboard
- [x] 2.7 Rodar `npm run typecheck`, `npm run lint` — zero erros

## 3. Plano 20-03 — Testes e Acabamento Responsivo

- [x] 3.1 Criar testes de renderização do dashboard em `src/__tests__/app/dashboard/dashboard-page.test.tsx`:
  - Estado `no_store` → empty state "Configure sua loja" (F19 preservado)
  - Estado `has_store_no_campaigns` → empty state "Crie sua primeira campanha" (F19 preservado)
  - Estado `has_store_with_campaigns` → saudação "Bom dia, Loja Teste" (mock Date 10h)
  - Estado `has_store_with_campaigns` → saudação "Boa tarde, Loja Teste" (mock Date 14h)
  - Estado `has_store_with_campaigns` → saudação "Boa noite, Loja Teste" (mock Date 21h)
  - Estado `has_store_with_campaigns` → 3 cards de métricas visíveis
  - Estado `has_store_with_campaigns` → lista de campanhas recentes com link "Ver todas"
  - Estado `has_store_with_campaigns` → card de próximo passo com CTA para última campanha
  - Texto "Seu dashboard está sendo preparado" não aparece no dashboard real
- [x] 3.2 Testes de responsividade:
  - Grid de métricas tem classes `grid-cols-1 md:grid-cols-3`
  - Cards têm `gap-4` consistente
- [x] 3.3 Testes de edge cases:
  - Lista de recentes vazia não quebra o dashboard
  - Card de próximo passo com fallback "Criar nova campanha" quando lista vazia
  - Taxa de sucesso 0%, 50%, 100% via helpers
- [x] 3.4 Rodar `npm run typecheck`, `npm run lint` — zero erros

## 4. Verificação Final

- [x] 4.1 Dashboard real visível para `has_store_with_campaigns` com saudação, métricas, recentes, next-step, links
- [x] 4.2 Estados vazios da F19 preservados: `no_store` e `has_store_no_campaigns`
- [x] 4.3 `countCampaigns` importado de `@/lib/onboarding/count` ainda funciona (compatibilidade F19)
- [x] 4.4 Nenhuma signed URL gerada no dashboard
- [x] 4.5 `DASHBOARD_PLACEHOLDER` não é mais referenciado pelo dashboard (pode permanecer em microcopy.ts)
- [x] 4.6 Rodar `npm run typecheck` — zero erros
- [x] 4.7 Rodar `npm run lint` — zero erros
- [x] 4.8 Rodar `npx vitest run` — todos os testes passando (15-20 novos + existentes)
- [x] 4.9 Rodar `npm run build` — build bem-sucedido
