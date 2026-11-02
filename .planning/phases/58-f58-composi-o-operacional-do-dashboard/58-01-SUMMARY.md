---
phase: 58-f58-composi-o-operacional-do-dashboard
plan: 01
subsystem: dashboard-data
tags: [nextjs, server-components, supabase, i18n, credit, vitest, tdd]

# Dependency graph
requires:
  - phase: 57
    provides: "i18n server-first (getUiRenderContext, catálogos tipados) e preferência de idioma"
provides:
  - "Camada de dados server-only do dashboard: query ready-only limitada a 3 com miniaturas assinadas"
  - "Contagem ready-only via countReadyCampaigns"
  - "Estado de crédito available/zero/unavailable e opção aditiva throwOnError"
  - "Saudação pura resolvida por timeZone com fallback neutro"
  - "SectionResult<T> para isolamento de falha por seção"
affects: [58-02, 58-03, dashboard-page, dashboard-i18n]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composição server-only com DTO explícito sem storage_path"
    - "Extensão aditiva opt-in em serviço compartilhado (throwOnError default false)"
    - "Resultado discriminado SectionResult<T> com try/catch por seção"
    - "Saudação pura por Intl.DateTimeFormat(timeZone) com now injetável"

key-files:
  created:
    - src/lib/dashboard/campaigns.ts
    - src/lib/dashboard/credits.ts
    - src/lib/dashboard/greeting.ts
    - src/lib/dashboard/sections.ts
    - src/lib/dashboard/__tests__/campaigns.test.ts
    - src/lib/dashboard/__tests__/credits.test.ts
    - src/lib/dashboard/__tests__/greeting.test.ts
    - src/lib/credit/__tests__/credit-service-throw-on-error.test.ts
  modified:
    - src/lib/credit/credit-service.ts

key-decisions:
  - "Campos de crédito mantêm default false; dashboard usa throwOnError: true e PGRST116 continua sendo zero"
  - "Filtro ready-only aplicado na origem (eq status ready), não na renderização"
  - "DTO de campanha expõe apenas id, productName, createdAt e thumbnailUrl"
  - "Fuso nulo/inválido resulta em saudação neutral, sem fallback America/Sao_Paulo"
  - "Falha de seção nunca derruba a página: wrappers retornam { ok: false }"

patterns-established:
  - "DTO enxuto + URL assinada: storage_path nunca cruza a fronteira RSC/cliente"
  - "Opção aditiva em serviço compartilhado preserva chamadores existentes"
  - "Saudação determinística com now injetado e locale apenas como argumento do Intl"

requirements-completed: [REQ-58-01, REQ-58-02, REQ-58-03, REQ-58-05, REQ-58-09]

# Metrics
duration: 6min
completed: 2026-11-02
---

# Phase 58 Plan 01: Composição operacional do dashboard — camada de dados Summary

**Consulta ready-only com até 3 miniaturas assinadas, crédito com falha distinguível de zero, saudação por fuso da loja e isolamento de falha por seção, tudo coberto por testes unitários determinísticos**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-02T16:00:00Z
- **Completed:** 2026-11-02T16:06:00Z
- **Tasks:** 3
- **Files modified:** 9 (8 criados, 1 modificado)

## Accomplishments

- `queryEligibleCampaigns`/`loadEligibleCampaignOverview` consultam somente `status = "ready"`, no máximo 3, ordenadas por `created_at` desc, com miniaturas assinadas e DTO sem `storage_path`.
- `CreditService.getBalanceBreakdown` ganhou a opção aditiva `{ throwOnError?: boolean }` (default `false`, `PGRST116` tratado como zero), permitindo que o dashboard distinga falha de saldo zero.
- `loadDashboardCreditState` expõe `available`/`zero`/`unavailable`; `loadCreditSection`/`loadCampaignSection` contêm falhas via `SectionResult<T>`.
- `resolveDashboardGreeting` é pura, recebe `now`, resolve o período no `timeZone` da loja e retorna `neutral`/`welcome` nos fallbacks — sem relógio do servidor nem fuso fixo.
- TDD aplicado nas três tarefas (commits `test(...)` antes de `feat(...)`).

## Task Commits

Cada tarefa foi commitada atomicamente (TDD → test + feat):

1. **Task 1: Consulta elegível do dashboard** — `6a0bfe66` (test), `cbc69a32` (feat)
2. **Task 2: Crédito detectável e isolamento por seção** — `24f7dc3d` (test), `59e8bea0` (feat)
3. **Task 3: Saudação pura por timeZone** — `690f3838` (test), `cf2d7fab` (feat)

## Files Created/Modified

- `src/lib/dashboard/campaigns.ts` — consulta ready-only (select de 4 colunas, `.eq`, `.order`, `.limit(3)`), miniaturas via `generateBatchThumbnailUrls`, DTO sem `storage_path`.
- `src/lib/dashboard/credits.ts` — `DashboardCreditState` e `loadDashboardCreditState` usando `CreditService` com `throwOnError: true`.
- `src/lib/dashboard/sections.ts` — `SectionResult<T>` + `loadCampaignSection`/`loadCreditSection` com `try/catch`.
- `src/lib/dashboard/greeting.ts` — `resolveDashboardGreeting` pura, `Intl.DateTimeFormat(locale, { timeZone, hourCycle: "h23" })`, normalização `"24" → 0`.
- `src/lib/credit/credit-service.ts` — apenas `getBalanceBreakdown` estendido com `opts?: { throwOnError?: boolean }`.
- Testes: `campaigns.test.ts`, `credits.test.ts`, `greeting.test.ts`, `credit-service-throw-on-error.test.ts`.

## Decisions Made

- Default `throwOnError: false` preserva byte a byte todos os chamadores; dashboard opta por `true` e `PGRST116` permanece zero.
- Query do dashboard usa `createServerClient` (RLS owner-only); a assinatura de URL continua interna a `generateBatchThumbnailUrls` (sem novo client).
- O DTO nunca inclui `storage_path`, `status`, `input_snapshot` ou `error_message`.
- Falha de fuso não cai para `America/Sao_Paulo`; `timeZone` nulo/vazio/inválido resulta em `neutral`.
- `locale` é apenas argumento do formatador; não infere fuso nem altera o período.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A verificação ampla `npx vitest run src/lib/credit/__tests__` inclui 4 arquivos de integração que exigem banco real/`NEXT_PUBLIC_SUPABASE_URL` (`credit-concurrency`, `credit-f50-11-integration`, `credit-idempotency`, `operation-cost-service.integration`). Eles falham por ausência de ambiente, não por estas mudanças; os testes unitários e os três arquivos exigidos pela task passam. Fora do escopo deste plano.

## Verification

- `npx vitest run src/lib/dashboard/__tests__/campaigns.test.ts` → 10/10 passed.
- `npx vitest run src/lib/dashboard/__tests__/credits.test.ts src/lib/credit/__tests__/credit-service-throw-on-error.test.ts src/lib/credit/__tests__/demo-services.test.ts` → 17/17 passed.
- `npx vitest run src/lib/dashboard/__tests__/greeting.test.ts` → 11/11 passed.
- `npm.cmd run typecheck` → exit 0.
- Revisão estática: `campaigns.ts` não importa `countCampaigns`/`getRecentCampaigns`/`getUserOnboardingState`; `credits.ts` não importa `supabaseAdmin`; `greeting.ts` não chama `getHours()`/`Date.now()`; `storage_path` só aparece no servidor antes da assinatura.
- Nenhuma migration, API, dependência ou alteração de schema.

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

- Contratos de dados prontos para a composição visual (plano 58-02): campanhas, crédito e saudação com tipos discriminados.
- `SectionResult<T>` disponível para a página orquestrar `Promise.allSettled` sem derrubar a página.
- Sem bloqueios. A única atenção é a limitação pré-existente de `getCurrentStore` engolir erro como `null` (documentada na RESEARCH).

---
*Phase: 58-f58-composi-o-operacional-do-dashboard*
*Completed: 2026-11-02*

## Self-Check: PASSED

