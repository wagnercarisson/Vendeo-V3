---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 02
subsystem: database
tags: [supabase, migration, postgres, rls, credit-ledger]

requires:
  - phase: 50-01
    provides: "baseline de não-mudança + inventário de consumidores de balance"
provides:
  - "Migration estrutural F50: colunas demo + CHECKs + benefit_type demo + 4 tabelas novas + privacy_notice_version"
  - "Schema pronto para as RPCs (50-03) e serviços (50-04)"
affects: [credit-tables, credit-expiration, freemium-entitlement, credit-notifications, product-events, support-protocol, account-retention, beta-access-request]

tech-stack:
  added: []
  patterns:
    - "CHECK composto de coerência do bucket demo (demo_balance > 0 → campos não-nulos)"
    - "RLS: service_role ALL + owner SELECT (notificações excluindo support_notice; data_subject_requests owner)"

key-files:
  created:
    - "supabase/migrations/20260920000001_f50_demo_credits.sql"
  modified: []

key-decisions:
  - "Migration única (20260920000001) sem documentos legais (50-10 publica em migration separada)"
  - "Backfill default — sem expiração retroativa (D8)"
  - "email_status CHECK com 5 estados (pending/processing/sent/failed/suppressed)"

patterns-established:
  - "Outbox credit_notifications com índice único (store_id, kind, dedup_key)"

requirements-completed: [credit-tables, credit-expiration, freemium-entitlement, credit-notifications, product-events, support-protocol, account-retention, beta-access-request]

duration: 25min
completed: 2026-09-20
---

# Phase 50 Plan 02: Migration estrutural (colunas demo + CHECKs + 4 tabelas) Summary

**Migration estrutural da F50 aplicada localmente e verificada — 5 colunas demo em `credit_balances`, tipos `demo`/`expiration`, `benefit_type='demo'`, 4 tabelas novas com RLS/grants/índices únicos e `privacy_notice_version` em `access_requests`, sem publicar documentos legais.**

## Performance

- **Duration:** 25min
- **Started:** 2026-09-20
- **Completed:** 2026-09-20
- **Tasks:** 7 (2.7 = checkpoint human-action aprovado)
- **Files modified:** 1 (migration nova)

## Accomplishments

- `credit_balances` ganhou 5 colunas demo com defaults seguros + CHECK composto `chk_credit_balances_demo_coherence` (demo>0 → `demo_expires_at`/`demo_cycle_id`/`origin_demo_grant_tx_id` não-nulos).
- `credit_transactions` CHECK `type` ampliado para 9 tipos (7 legados + `demo` + `expiration`) e `amount_sign` com `demo > 0` / `expiration < 0`.
- `sync_credit_balances_total` atualizado para `demo_balance + bonus_balance + purchased_balance`.
- `freemium_entitlements.benefit_type` inclui `'demo'` (sem conversão de `onboarding`).
- 4 tabelas novas (`credit_notifications`, `product_events`, `support_credit_requests`, `data_subject_requests`) com CHECKs, RLS (service_role ALL + owner SELECT) e índices únicos de dedup.
- `access_requests.privacy_notice_version` adicionado (aviso versionado auditável).
- Migration aplicada localmente (`supabase migration up --local`) e verificada via psql: colunas/tabelas/CHECKs confirmados.

## Task Commits

1. **Tasks 2.1–2.6 + 2.7 (migration aplicada local)** - `30d52c81` (feat)

**Plan metadata:** (commit `docs(50-02): complete ...`)

## Files Created/Modified

- `supabase/migrations/20260920000001_f50_demo_credits.sql` - Migration estrutural da F50 (343 linhas) com seção REVERT comentada.

## Decisions Made

- Seguiu a especificação exatamente; sem decisões adicionais de produto.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Ressalva registrada para o 50-03 (do usuário):** a migration `20260920000001_f50_demo_credits.sql` já está registrada como aplicada; portanto `supabase migration up --local` **não** reaplicará as RPCs acrescentadas no 50-03. O 50-03 deve acrescentar todas as RPCs ao arquivo e, ao concluir, executar um `supabase db reset --local` controlado para reaplicar a migration completa desde o início, seguido da verificação integral das estruturas e RPCs (evita falsa validação). Registrado como tarefa adicional no 50-03 (não invalida o 50-02).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema estrutural pronto para as RPCs (50-03).
- Próximo plano: **50-03 (RPCs SQL)** — com a ressalva do reset local após acrescentar as RPCs.

---
*Phase: 50-demonstracao-gratuita-validade-creditos*
*Completed: 2026-09-20*
