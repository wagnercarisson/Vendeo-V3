---
phase: 58-f58-composi-o-operacional-do-dashboard
plan: 02
subsystem: dashboard-i18n
tags: [i18n, catalogs, isolation, react, vitest, tdd]

# Dependency graph
requires:
  - phase: 57
    provides: "Fundação i18n F57.4 (SupportedUiLocale, catálogos tipados, getCatalog)"
provides:
  - "Namespace dashboard isolado com catálogos pt-BR/es-419 e paridade estrutural/placeholders"
  - "Prova estática de que shell, layout e admin não importam o namespace do dashboard"
  - "VerificationBanners/ReadinessBanner/ReadinessCheckBanner localizáveis por props opcionais com default pt-BR"
affects: [58-03, dashboard-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Namespace de catálogo por rota fora do barrel global"
    - "Catálogo es-419 com satisfies para paridade estrutural em compilação"
    - "Props de mensagens opcionais com defaults pt-BR em componentes compartilhados"
    - "Prova de isolamento estática via node:fs/readFileSync"

key-files:
  created:
    - src/lib/i18n/dashboard/messages.ts
    - src/lib/i18n/dashboard/catalogs/pt-BR.ts
    - src/lib/i18n/dashboard/catalogs/es-419.ts
    - src/lib/i18n/dashboard/get-messages.ts
    - src/lib/i18n/dashboard/index.ts
    - src/lib/i18n/dashboard/__tests__/catalogs.test.ts
    - src/lib/i18n/dashboard/__tests__/isolation.test.ts
    - src/components/verification/__tests__/verification-banners-render.test.tsx
  modified:
    - src/components/verification/verification-banners.tsx
    - src/components/readiness/readiness-banner.tsx
    - src/components/readiness/readiness-check-banner.tsx
    - src/components/readiness/__tests__/readiness-banner.test.tsx

key-decisions:
  - "Namespace dashboard vive em src/lib/i18n/dashboard e nunca é reexportado pelo barrel global"
  - "pt-BR é anotado : DashboardMessages e es-419 usa satisfies DashboardMessages"
  - "Banners recebem mensagens opcionais; sem props mantêm exatamente os textos pt-BR atuais"
  - "ReadinessBanner não ganha ação de dispensa; apenas ícone lucide X e alvo de 44px"

requirements-completed: [REQ-58-06, REQ-58-07, REQ-58-11]

# Metrics
duration: 4min
completed: 2026-11-02
---

# Phase 58 Plan 02: Namespace de localização do dashboard e avisos localizáveis Summary

**Namespace `dashboard` tipado e congelado em pt-BR/es-419, isolamento comprovado por teste estático e avisos compartilhados localizáveis por props opcionais sem regressão dos defaults**

## Performance

- **Duration:** 4 min
- **Tasks:** 3
- **Files modified:** 12 (8 criados, 4 modificados)

## Accomplishments

- `DashboardMessages` sem index signature/`any`, com 8 namespaces e 39 chaves; `ptBRDashboardMessages` anotado e `es419DashboardMessages` verificado por `satisfies`.
- Catálogos congelados em todos os níveis, com teste de paridade de chaves, igualdade de placeholders (`{count}`, `{product}`, `{date}`), strings não vazias e lista exata de chaves.
- `getDashboardMessages` resolve por `SupportedUiLocale`; barrel local não é reexportado por `src/lib/i18n/index.ts`.
- Teste de isolamento lê estaticamente barrel global, `messages.ts`, `get-catalog.ts`, `layout.tsx`, `app-shell.tsx` e toda a árvore `src/app/(app)/admin`, além de provar ausência de `dashboard.*` no catálogo global e de `server-only` no namespace.
- `VerificationBanners`/`ReadinessBanner`/`ReadinessCheckBanner` aceitam mensagens opcionais, preservam português como default e localizam título, itens, CTA e `aria-label` de fechar.
- `ReadinessBanner` troca o glifo `❌` por `X` do lucide e aplica `min-h-[44px]`; `ApprovedBanner` fecha com alvo 44×44.

## Task Commits

1. **Task 1: Tipos, catálogos e resolvedor** — `01ec1503` (test), `febcac50` (feat)
2. **Task 2: Prova de isolamento** — `405522df` (test)
3. **Task 3: Props opcionais nos avisos** — `f87351c0` (feat)

## Files Created/Modified

- `src/lib/i18n/dashboard/messages.ts` — interfaces readonly e `DashboardMessages`.
- `src/lib/i18n/dashboard/catalogs/pt-BR.ts` — fonte de verdade congelada.
- `src/lib/i18n/dashboard/catalogs/es-419.ts` — paridade via `satisfies`; copy proposta pendente de revisão humana (RESEARCH A1).
- `src/lib/i18n/dashboard/get-messages.ts` — resolvedor por `SupportedUiLocale`.
- `src/lib/i18n/dashboard/index.ts` — barrel local de tipos, catálogos e resolvedor.
- `src/lib/i18n/dashboard/__tests__/catalogs.test.ts` — paridade estrutural/placeholders/congelamento.
- `src/lib/i18n/dashboard/__tests__/isolation.test.ts` — prova estática de fronteira e payload.
- `src/components/verification/verification-banners.tsx` — `VerificationMessages`, defaults e alvo 44px.
- `src/components/readiness/readiness-banner.tsx` — `ReadinessMessages`, ícone lucide `X`, CTA 44px.
- `src/components/readiness/readiness-check-banner.tsx` — repasse de `messages`.
- `src/components/verification/__tests__/verification-banners-render.test.tsx` — render default/localizado e `aria-label`.
- `src/components/readiness/__tests__/readiness-banner.test.tsx` — casos es-419 e ausência de `❌`.

## Decisions Made

- O namespace do dashboard permanece fora de `src/lib/i18n/index.ts`, `messages.ts` e `get-catalog.ts`; o teste de isolamento é a barreira contra regressão.
- `ReadinessBanner` não recebe ação de fechar: o contrato da UI-SPEC limita o fechamento ao `ApprovedBanner`.
- Os textos pt-BR default foram mantidos byte a byte nos componentes para preservar consumidores e admin.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `npx vitest run src/lib/i18n/dashboard/__tests__/catalogs.test.ts` → 6/6 passed (RED antes da implementação).
- `npx vitest run src/lib/i18n/dashboard/__tests__/isolation.test.ts src/lib/i18n/__tests__/catalogs.test.ts` → 10/10 passed.
- `npx vitest run src/components/verification src/components/readiness` → 19/19 passed.
- `npx vitest run src/lib/i18n/dashboard src/components/verification src/components/readiness` → 30/30 passed.
- `npm.cmd run typecheck` → exit 0 (prova o `satisfies`).
- Grep em `src/lib/i18n/index.ts`, `messages.ts`, `get-catalog.ts`, `layout.tsx`, `app-shell.tsx` e `src/app/(app)/admin/**` → nenhum import de `i18n/dashboard` ou `dashboard/catalogs`.

## TDD Gate Compliance

- Task 1: commit `test(...)` (`01ec1503`) com falha de módulo ausente antes do commit `feat(...)` (`febcac50`).
- Task 2: tarefa exclusivamente de teste de prova (sem arquivo de origem de comportamento); commit único `test(...)` (`405522df`).
- Task 3: `tdd="false"` no plano; implementação e testes no mesmo commit `feat(...)` (`f87351c0`).

## Known Stubs

None.

## Threat Flags

None. Mitigações T-58-02-01…04 cobertas pelo teste de isolamento, `Object.freeze`, defaults escapados em React e varredura de admin.

## Next Phase Readiness

- Plano 58-03 pode importar `getDashboardMessages` diretamente do namespace local e repassar sub-objetos a `VerificationBanners`/`ReadinessCheckBanner` sem tocar no catálogo global.
- Sem bloqueios.

---

*Phase: 58-f58-composi-o-operacional-do-dashboard*
*Completed: 2026-11-02*

## Self-Check: PASSED
