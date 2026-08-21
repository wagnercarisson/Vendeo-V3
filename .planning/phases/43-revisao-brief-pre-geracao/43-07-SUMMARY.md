---
phase: 43-revisao-brief-pre-geracao
plan: 07
subsystem: database
tags: [migration, feature-flags, rpc, admin-audit, d5, blocking-push]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (D5 — flag administrativa mínima em feature_flags, NÃO env var)
  - phase: fase-42-signup-controlado-elegibilidade-freemium
    provides: precedente de db push [BLOCKING] DEFERIDO (SUPABASE_ACCESS_TOKEN ausente)
  - phase: fase-38-1-ai-cost-accounting
    provides: precedente de db push [BLOCKING] (38-1-01-SUMMARY.md)
provides:
  - Tabela feature_flags (greenfield) + seed force_brief_vision_check (enabled=false)
  - RPC admin_update_feature_flag (atômico, motivo obrigatório, auditoria mesma transação, idempotente via operation_id)
  - CHECKs de admin_audit_log estendidos (action feature_flag_update / target_type feature_flag) via DROP/ADD preservando existentes
affects: [43-08 (rota + serviço de leitura), 43-09 (admin), 43-12 (testes 17-23), 43-13 (testes 24-26), 43-15 (UAT)]

# Tech tracking
tech-stack:
  added: [postgres feature_flags table, plpgsql RPC, admin_audit_log CHECK extension]
  patterns: [SECURITY DEFINER RPC with empty search_path, atomic update+audit same transaction, DROP/ADD CHECK extension preserving existing values, ON CONFLICT idempotent seed]

key-files:
  created: [supabase/migrations/20260821000001_f43_create_feature_flags.sql]
  modified: []

key-decisions:
  - "RPC admin_update_feature_flag idempotente via operation_id (precedente idx_admin_audit_log_operation único) — re-execução da mesma operação não re-audita nem re-aplica"
  - "target_id = feature_flags.id (UUID) atende ao target_id UUID NOT NULL do admin_audit_log; a key vai no metadata"

patterns-established:
  - "Migration de flag administrativa: greenfield + seed ON CONFLICT + RPC SECURITY DEFINER atômico com auditoria na mesma transação + extensão de CHECKs preservando valores"

requirements-completed: [F43-17, F43-18, F43-19]

# Metrics
duration: 35min
completed: 2026-08-21
---

# Plan 43-07: Migration feature_flags + RPC + CHECKs Summary

**Migration F43 criada e APLICADA NO REMOTO (`20260821000001_f43_create_feature_flags.sql`): tabela `feature_flags` (greenfield) + seed `force_brief_vision_check` (enabled=false) + RPC `admin_update_feature_flag` (atômico, motivo obrigatório, auditoria na mesma transação, idempotente) + CHECKs de `admin_audit_log` estendidos (action `feature_flag_update` / target_type `feature_flag`); push [BLOCKING] resolvido — aplicado pelo usuário no remoto (projeto `gvbzwihwgzujwsviufgy`)**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 2
- **Files modified:** 1 (migration criada)

## Accomplishments
- **Migration `20260821000001_f43_create_feature_flags.sql`** (idempotente, não destrutiva, com REVERT):
  - **Tabela `feature_flags`** (greenfield, `IF NOT EXISTS`): `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (obrigatório para o `admin_audit_log.target_id UUID NOT NULL`), `key TEXT UNIQUE NOT NULL`, `enabled BOOLEAN NOT NULL DEFAULT false`, `description TEXT`, `updated_by UUID NULL REFERENCES auth.users(id)`, `updated_at TIMESTAMPTZ DEFAULT now()`; RLS habilitado + policy service_role + grants (precedente access_requests); sem acesso anon/authenticated
  - **Seed** `force_brief_vision_check` (`enabled=false`, descrição administrativa do alinhamento) via `ON CONFLICT (key) DO NOTHING` (idempotente)
  - **RPC `admin_update_feature_flag`** (precedente `admin_review_access_request`): `SECURITY DEFINER` + `search_path = ''`; valida `p_key`/`p_reason` (motivo **obrigatório**); **idempotência via `operation_id`** (re-execução da mesma operação retorna `{ idempotent: true }` sem re-aplicar); atualiza `enabled`/`updated_by`/`updated_at` e audita na **mesma transação** em `admin_audit_log` com `action: 'feature_flag_update'`, `target_type: 'feature_flag'`, `target_id = feature_flags.id` (UUID), `metadata { key, old_value, new_value, reason }` + `operation_id`
  - **CHECKs de `admin_audit_log` estendidos** via DROP/ADD preservando valores existentes: `feature_flag_update` na action CHECK; `feature_flag` no target_type CHECK
  - **REVERT** section completo (reverse order)
- **Task 2 (aplicar/push):** **Docker/Supabase local indisponível** (daemon Docker não responde — precedente F42) e **`SUPABASE_ACCESS_TOKEN` NÃO definido** no ambiente → inicialmente registrado como **push [BLOCKING] DEFERIDO**. **RESOLVIDO PELO USUÁRIO (2026-08-21):** a migration **foi aplicada no remoto** (projeto `gvbzwihwgzujwsviufgy`) — o usuário confirmou "migration aplicada no remoto". O push [BLOCKING] está **concluído**; o código 43-08/43-09 pode consumir a `feature_flags` em produção.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Migration — feature_flags + seed + RPC + CHECKs (idempotente)** - (parte do commit do plano, feat)
2. **Task 2: Aplicar migration local + push [BLOCKING]** - RESOLVIDO (usuário aplicou a migration no remoto em 2026-08-21; token não estava disponível para o executor) — registrado no SUMMARY

## Files Created/Modified
- `supabase/migrations/20260821000001_f43_create_feature_flags.sql` - Tabela + seed + RPC + CHECKs + REVERT

## Decisions Made
- RPC idempotente via `operation_id` (existe índice único em `admin_audit_log.operation_id`) — re-execução não duplica auditoria
- `target_id = feature_flags.id` (não a `key` — o `target_id` é `UUID NOT NULL`); `metadata.key` identifica a flag

## Deviations from Plan

**Task 2 (push [BLOCKING]) — RESOLVIDO:** `supabase db push` não pôde ser executado pelo executor (Docker local indisponível + `SUPABASE_ACCESS_TOKEN` ausente no ambiente). **O usuário aplicou a migration no remoto manualmente** (projeto `gvbzwihwgzujwsviufgy`, confirmado em 2026-08-21). O push [BLOCKING] está **concluído**; a ação crítica está resolvida e o código 43-08/43-09 pode consumir a `feature_flags` em produção.

## Issues Encountered
- Docker local indisponível (daemon não responde) — `supabase status` falha
- `SUPABASE_ACCESS_TOKEN` não definido — `db push` não autentica

## User Setup Required
**Resolvido:** o usuário aplicou a migration no remoto (projeto `gvbzwihwgzujwsviufgy`) em 2026-08-21. Nenhuma ação pendente de setup.

## Next Phase Readiness
- Migration da flag pronta (arquivo) e aplicável quando o token estiver disponível
- Ordem de deploy (D5): migration → código (43-08/43-09) → smoke → UAT → produção
- Próximo: 43-08 (rota skip + normalização flag + serviço de leitura), que consome a `feature_flags` (com fallback de leitura seguro)

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*