---
phase: 58-f58-composi-o-operacional-do-dashboard
plan: 04
subsystem: dashboard-page
tags: [nextjs, react, server-components, i18n, dashboard, vitest, accessibility]
depends_on: ["58-01", "58-02", "58-03"]
affects: [dashboard-page, dashboard-loading]
tech-stack:
  added: []
  patterns:
    - "Orquestração server-first com Promise.allSettled por seção"
    - "Data formatada por locale + fuso da loja com UTC explícito como fallback"
    - "loading.tsx resolvendo locale no servidor sem provider ou resolvedor paralelo"
key-files:
  created:
    - src/lib/dashboard/format.ts
    - src/lib/dashboard/__tests__/format.test.ts
    - src/__tests__/app/dashboard/dashboard-localization.test.tsx
    - src/__tests__/app/dashboard/dashboard-layout-order.test.tsx
    - src/__tests__/app/dashboard/dashboard-loading.test.tsx
  modified:
    - src/app/(app)/dashboard/page.tsx
    - src/app/(app)/dashboard/loading.tsx
    - src/__tests__/app/dashboard/dashboard-page.test.tsx
  deleted:
    - src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx
key-decisions:
  - "Falhas de campanha/crédito/fuso/anúncio são isoladas por seção via Promise.allSettled"
  - "Sem loja, retorno antecipado antes de qualquer consulta de crédito/campanha/fuso/anúncio"
  - "Placements desktop explícitos com col-start/row-start; nunca CSS order"
  - "loading.tsx é Server Component assíncrono e usa messages.loading.statusLabel"
requirements-completed: [REQ-58-01, REQ-58-02, REQ-58-03, REQ-58-04, REQ-58-05, REQ-58-06, REQ-58-07, REQ-58-08, REQ-58-09, REQ-58-10, REQ-58-11]
duration: 8min
completed: 2026-11-02
---

# Phase 58 Plan 04: Página operacional e loading Summary

**Dashboard server-first com estados isolados, localização por bloco e esqueletos na ordem final — 87 testes verdes e typecheck limpo**

## Performance

- **Duration:** 8 min
- **Tasks:** 3 (auto)
- **Files modified:** 9 (5 criados, 3 modificados, 1 removido)

## Accomplishments

- `page.tsx` reescrita como orquestrador server-first: `requirePageUser` → `getCurrentStore` + `getUiRenderContext` em paralelo; sem loja retorna antes de qualquer consulta.
- Com loja, `Promise.allSettled` isola campanhas, créditos, fuso e anúncio; cada falha vira estado local sem derrubar as demais seções.
- Saudação resolvida por `resolveDashboardGreeting` com `timeZone` de `getStoreMarketSettings` e textos do namespace.
- Grid com ordem DOM créditos → campanhas → novidades e placements desktop explícitos (`lg:col-start-*`/`lg:row-start-*`), sem CSS `order`.
- `formatDashboardDate` formata por `locale` e `timeZone ?? "UTC"`, provado com o instante que muda de dia civil entre São Paulo e UTC.
- `loading.tsx` virou Server Component assíncrono com `requirePageUser` + `getUiRenderContext` + `getDashboardMessages`, `role="status"`, label localizado e esqueletos `aria-hidden` na ordem final; `StatsSkeleton count={4}` removido.
- Quatro suítes de página comprovam matriz de estados, falhas parciais, localização/`lang`, ordem responsive e loading.

## Task Commits

1. **Task 1: Página operacional, formatação e loading** — `ed58ea78` (feat)
2. **Task 2: Matriz de estados e localização/lang** — `01d0af53` (test)
3. **Task 3: Ordem responsive e esqueletos** — `20a07a40` (test)

## Files Created/Modified

- `src/lib/dashboard/format.ts` — formatação determinística de data por locale/fuso.
- `src/app/(app)/dashboard/page.tsx` — composição operacional server-first.
- `src/app/(app)/dashboard/loading.tsx` — esqueletos na ordem final com locale server-side.
- `src/__tests__/app/dashboard/dashboard-page.test.tsx` — matriz de estados e links.
- `src/__tests__/app/dashboard/dashboard-localization.test.tsx` — textos e atributos `lang` em pt-BR/es-419 e timeout.
- `src/__tests__/app/dashboard/dashboard-layout-order.test.tsx` — ordem DOM, placements e alvos de 44 px.
- `src/__tests__/app/dashboard/dashboard-loading.test.tsx` — status localizado e esqueletos.
- Removido `src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx` (comportamento antigo de `BalanceDisplay`/onboarding).

## Decisions Made

- `Promise.allSettled` com fallbacks tipados (`{ ok: false }`, `timeZone: null`, `entry: null`) mantém cada seção independente.
- A seção de novidades é decidida por `entry`, não por `excerpt`; trecho nulo mantém título/data/ações.
- `lang` na raiz só em es-419; nome de loja/produto usam `lang=""`; título/trecho editorial usam `lang="pt-BR"`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run src/lib/dashboard/__tests__/format.test.ts` → 4/4 passed.
- `npx vitest run src/__tests__/app/dashboard/dashboard-page.test.tsx src/__tests__/app/dashboard/dashboard-localization.test.tsx` → 16/16 passed.
- `npx vitest run src/__tests__/app/dashboard/dashboard-layout-order.test.tsx src/__tests__/app/dashboard/dashboard-loading.test.tsx` → 10/10 passed.
- `npx vitest run src/__tests__/app/dashboard src/lib/dashboard src/components/dashboard` → 13 arquivos / 87 testes passed.
- `npm.cmd run typecheck` → exit 0.
- Revisão estática: `page.tsx` sem `getUserOnboardingState`/`countCampaigns`/`getRecentCampaigns`/`getCampaignSuccessRate`/`BalanceDisplay`/`PageHeader`/`getGreeting`; `loading.tsx` sem `StatsSkeleton`/`count={4}`.
- Nenhuma alteração em `src/app/(app)/layout.tsx`, `src/components/shell/**`, `src/app/(app)/admin/**` ou `document.documentElement.lang`.

## Known Stubs

None.

## Threat Flags

None. Mitigações T-58-04-01…06 cobertas por `requirePageUser` no topo, DTOs sem `storage_path`, isolamento por seção, propagação de erro desconhecido, `lang` escopado e fuso exclusivo de `getStoreMarketSettings`.

## Next Phase Readiness

- Plano 58-05 pode validar visualmente a página, o loading e o comportamento de anúncio no navegador.
- Sem bloqueios.

---

*Phase: 58-f58-composi-o-operacional-do-dashboard*
*Completed: 2026-11-02*

## Self-Check: PASSED
