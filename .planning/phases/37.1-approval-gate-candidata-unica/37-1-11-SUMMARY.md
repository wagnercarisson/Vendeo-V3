---
phase: 37.1-approval-gate-candidata-unica
plan: 11
subsystem: testing
tags: [approve-route, tests, rpc, guards, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (tasks.md seção 14, spec campaign-approval-gate) + rota approve (37-1-08) + migration 20260901000002 (37-1-02) + isCampaignApprovalEnabled (37-1-03)
  - phase: fase-43-revisao-brief-pre-geracao
    provides: precedente de mock de RPC com error.message (admin feature-flags)
provides:
  - Testes 14.1-14.3 (RPC transacional por fonte, mapeamento 404/409, só candidata ativa aprovável)
  - Testes 14.4 (guards: ownership 404, flag off 403, não-ready 409, body 400, uuid param 400, inexistente 404)
  - Fail-closed comprovado: rpc NÃO chamado quando bloqueado (5 asserts)
affects: [37-1-14 (regressão), 37-1-15 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [route test with full auth/rpc mocks, RPC error mapping scenarios, source-anchored transaction assertion]

key-files:
  created: [src/__tests__/api/campaign-approve-route.test.ts]
  modified: []

key-decisions:
  - "Transação do RPC verificada por FONTE (migration SQL) — unit tests sem banco; db push real no remoto (37-1-02)"
  - "Nenhum teste exercita fluxo de correção; rejection_count nunca alterada (schema-only, 37.2)"

patterns-established:
  - "Teste de rota de mutação: mocks de auth/ownership/flag/rpc + cenários de guard com assert de rpc não chamado (fail-closed por construção)"

requirements-completed: [F37.1-24]

# Metrics
duration: 18min
completed: 2026-09-01
---

# Phase 37.1 Plan 11: Testes da rota approve Summary

**Testes 14.1-14.4 da aprovação (tasks.md seção 14): RPC transacional `approve_campaign_art_version` verificado por FONTE na migration (guarded update `FOR UPDATE` + defensivo `asset_status='discarded'` + repontar `approval_status='approved'`), mapeamento de erros na rota (version_campaign_mismatch/version_not_found → 404; version_not_pending/version_not_active → 409; sucesso → 200 `{ campaignUrl, status: "approved" }`) e guards fail-closed (ownership 404, flag off 403, não-ready 409, body inválido 400, uuid do param 400, campanha inexistente 404) com assert de que o RPC NÃO é chamado quando bloqueado — 12/12 testes verdes**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 1 (src/__tests__/api/campaign-approve-route.test.ts — criado)

## Accomplishments

- **Task 1 — Testes 14.1-14.3 (RPC por fonte + mapeamento + só candidata ativa):**
  - Mocks do contrato: `requireSameOrigin` (no-op), `requireApiUser` (`{ userId: "owner-1" }`), `requireOwnership` (resolvido ou lança `StoreNotFoundError`), `getCampaign` (fixture com status controlável), `isCampaignApprovalEnabled` (controlável), `supabaseAdmin.rpc` (controlável por cenário)
  - **14.1:** lê `supabase/migrations/20260901000002_f37_1_approve_campaign_art_version_rpc.sql` e asserta as 7 strings: `FOR UPDATE`, `version_not_found`, `version_campaign_mismatch`, `version_not_pending`, `version_not_active`, `asset_status = 'discarded'` (defensivo), `approval_status = 'approved'` (repontar campaigns)
  - **14.2:** `version_not_active` → 409 E `mockRpc` chamado com `("approve_campaign_art_version", { p_campaign_id, p_version_id })`; `version_not_pending` → 409 (versão já resolvida)
  - **14.3:** `version_campaign_mismatch` → 404; `version_not_found` → 404; sucesso → 200 com body `{ campaignUrl: "/campanhas/{id}", status: "approved" }`
- **Task 2 — Teste 14.4 (guards da rota):**
  - Não-dono (`requireOwnership` lança `StoreNotFoundError`) → 404 (mesmo status de inexistente — sem enumeração) e rpc não chamado
  - Flag off (`isCampaignApprovalEnabled` false) → 403 e rpc não chamado
  - Campanha não ready (`status: "generating"`) → 409 e rpc não chamado
  - Body inválido (`versionId: "not-a-uuid"`) → 400 (zod strict) e rpc não chamado
  - UUID do parâmetro inválido → 400 antes de `getCampaign` (assert de que `getCampaign` não foi chamado)
  - Campanha inexistente (`getCampaign` → null) → 404 e rpc não chamado
  - **5 asserts de `mockRpc).not.toHaveBeenCalled()`** — fail-closed por construção
- **Verificação de aceitação:** `npx vitest run src/__tests__/api/campaign-approve-route.test.ts` — **12/12 PASS**; zero funções de correção importadas (grep); `rejection_count` apenas na fixture (nunca alterada nos mocks — grep count 1); assert de rpc não chamado em 5 cenários.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Testes 14.1-14.3 — RPC transacional (fonte) + mapeamento de erros + só candidata ativa** - `a6a68260` (test)
2. **Task 2: Teste 14.4 — guards da rota (ownership 404, flag off 403, não-ready 409, body inválido 400)** - `a6a68260` (test, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/api/campaign-approve-route.test.ts` - Testes 14.1-14.4 da rota approve

## Decisions Made

- Transação do RPC verificada por FONTE (migration SQL) — unit tests sem banco; constraint real aplicada no remoto (37-1-02)
- Guards fail-closed comprovados por assert de rpc não chamado (403/409/400/404 por construção)
- Nenhum fluxo de correção exercitado; `rejection_count` intocada (schema-only na 37.1)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum - 12/12 testes PASS na primeira execução.

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Fluxo de aprovação provado: rota + mapeamento de erros + transação do RPC (fonte)
- Guards fail-closed comprovados (rpc não chamado quando bloqueado)
- Próximo: **37-1-12** (testes de generate-image v1 flag on/off/fail-safe — 15.x — e de download/copy gated — 16.x)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
