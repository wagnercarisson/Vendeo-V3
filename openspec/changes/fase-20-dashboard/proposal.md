## Why

O dashboard para `has_store_with_campaigns` ainda mostra um placeholder genérico ("Seu dashboard está sendo preparado"). Usuários com loja configurada e campanhas geradas não têm visão consolidada do seu progresso — total de campanhas, campanhas prontas, taxa de sucesso, ou acesso rápido às campanhas recentes. A F19 entregou os estados vazios fundacionais; a F20 substitui o placeholder por conteúdo real.

## What Changes

- **Criar helpers agregados de métricas** em `src/lib/campaign/metrics.ts`: `countCampaigns`, `countReadyCampaigns`, `getCampaignSuccessRate`, `getRecentCampaigns`, `RecentCampaignItem`
- **Manter compatibilidade com F19** via reexport de `countCampaigns` em `src/lib/onboarding/count.ts` — nenhuma quebra em `getUserOnboardingState`
- **Substituir o placeholder do dashboard** por conteúdo real para `has_store_with_campaigns`: saudação com nome da loja, 3 cards de métricas (total, prontas, taxa de sucesso), lista de campanhas recentes (3-5), card de próximo passo adaptativo, link "Configurar loja"
- **Preservar intactos** os estados `no_store` e `has_store_no_campaigns` da F19 — nenhuma alteração nos empty states existentes
- **Construir sem thumbnails** nas campanhas recentes — apenas nome, data formatada, Badge de status e link "Abrir" (sem signed URLs, sem storage_path)
- **Saudação com hora do servidor** ("Bom dia", "Boa tarde", "Boa noite") + nome da loja
- **15-20 novos testes** (helpers, renderização do dashboard, saudação com mock de Date, responsividade, preservação de estados F19)
- **Nenhum componente novo de UI** — `Card`, `Badge`, `PageHeader`, `EmptyState` (F18) atendem todos os casos

## Capabilities

### New Capabilities

- `campaign-metrics`: Helpers agregados de métricas de campanha (`countCampaigns`, `countReadyCampaigns`, `getCampaignSuccessRate`, `getRecentCampaigns`, `RecentCampaignItem`) em `src/lib/campaign/metrics.ts`

### Modified Capabilities

- `dashboard-inteligente`: O estado `has_store_with_campaigns` muda de placeholder genérico para dashboard real com saudação, métricas, campanhas recentes, próximo passo adaptativo e links. Os estados `no_store` e `has_store_no_campaigns` permanecem inalterados (F19).

## Impact

- **Novos**: `src/lib/campaign/metrics.ts` (5 itens: 4 funções + 1 tipo)
- **Modificados**: `src/lib/onboarding/count.ts` (reescrito como reexport de `campaign/metrics`), `src/app/(app)/dashboard/page.tsx` (branch `has_store_with_campaigns` ganha conteúdo real; branches `no_store` e `has_store_no_campaigns` inalterados), `openspec/specs/dashboard-inteligente/spec.md` (requisitos atualizados), `openspec/specs/campaign-metrics/spec.md` (novo spec)
- **Verificados (inalterados)**: `src/lib/onboarding/state.ts`, `types.ts`, `microcopy.ts` (os 3 intactos; `DASHBOARD_PLACEHOLDER` pode permanecer se houver referências residuais), `src/components/ui/card.tsx`, `badge.tsx`, `page-header.tsx`, `empty-state.tsx`, `src/lib/auth/store-ownership.ts`, `src/lib/campaign/list.ts`, `types.ts`
- **Novos testes**: `src/__tests__/lib/campaign/metrics.test.ts` (6-8 testes: count, readyCount, successRate, recentes), `src/__tests__/app/dashboard/page.test.tsx` (8-10 testes: 3 estados, saudação com mock Date, métricas, recentes, next-step, responsividade)
- **Nenhuma alteração**: banco de dados, storage, middleware, next.config, API routes, design tokens, shell, componentes de UI
