---
phase: 38-credit-operation-costs
plan: 01
subsystem: database
tags: [supabase, migration, rls, rpc, credit, audit]

requires:
  - phase: 24
    provides: reserve_credit RPC e tabelas de crédito (inalterados nesta fase)
provides:
  - Tabelas credit_operation_costs + credit_operation_cost_audit no remoto
  - RPC admin_update_operation_cost (SECURITY DEFINER, XOR, idempotente, transacional)
  - Seeds campaign_generation=1 e visual_signature_generation=1
  - RLS service_role-only (sem GRANT authenticated)
affects:
  - 38-02 (OperationCostService lê credit_operation_costs)
  - 38-05 (admin muta via RPC)
  - 38-08 (verificação I1–I6 no banco real)

tech-stack:
  added: []
  patterns:
    - "RPC admin XOR + audit snapshot completo old/new nos dois eixos"
    - "UNIQUE parcial em operation_id para idempotência de mutação financeira"
    - "Trigger imutável append-only em audit (padrão admin_audit_log)"

key-files:
  created:
    - supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql
  modified: []

key-decisions:
  - "Migration única F38 com tabelas + triggers + RLS + RPC + seeds"
  - "RPC não cria chaves — operation_key_not_found se ausente (enum versionado no TS)"
  - "Cabeçalho do SQL evita segunda ocorrência literal de SECURITY DEFINER (verify grep == 1)"

patterns-established:
  - "Fonte única de custo por operação no banco; cliente nunca lê tabelas direto"

requirements-completed:
  - F38-DB-01
  - F38-DB-02
  - F38-DB-03
  - F38-DB-04

duration: 15min
completed: 2026-08-07
---

# Phase 38: Plan 01 — Migration + Schema Push Summary

**Fonte única de custo por operação aplicada no remoto: tabelas, audit append-only, RPC admin e seeds.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

- Migration `20260807000001_f38_create_credit_operation_costs.sql` criada com schema D2/D8
- `supabase db push --linked --yes` exit 0; migration list confirma remoto
- RPC `admin_update_operation_cost` com XOR, reason obrigatório, idempotência e grants service_role-only
- Seeds `campaign_generation=1` e `visual_signature_generation=1` (updated_by NULL)

## Task Commits

1. **Task 1: Migration SQL** - `ca42292` (feat)
2. **Task 2: Schema push** - evidência operacional (push remoto; sem diff de código)

**Plan metadata:** (este SUMMARY)

## Files Created/Modified

- `supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql` — tabelas, triggers, RLS, RPC, seeds, REVERT

## Push Evidence

- `npx supabase db push --linked --yes` → Finished supabase db push (exit 0)
- `npx supabase migration list` → `20260807000001 | 20260807000001 | 2026-08-07 00:00:01`
- Validação pg_proc completa (I1–I6) deferida para 38-08

## Deviations

- Nenhum desvio de contrato. Comentário de cabeçalho usa "definer" em vez de "SECURITY DEFINER" para satisfazer verify `grep -c "SECURITY DEFINER" == 1`.
