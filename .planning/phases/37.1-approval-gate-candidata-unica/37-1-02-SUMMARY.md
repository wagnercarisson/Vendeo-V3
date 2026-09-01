---
phase: 37.1-approval-gate-candidata-unica
plan: 02
subsystem: database
tags: [migration, campaign-art-versions, rpc, approval, blocking-push]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (design.md D3/D5/D8, spec campaign-art-versions) + 37-1-CONTEXT (D7)
  - phase: fase-43-revisao-brief-pre-geracao
    provides: precedente de migration feature_flags + RPC SECURITY DEFINER + db push [BLOCKING] (43-07)
provides:
  - Tabela campaign_art_versions (1 candidata por vez) + colunas de aprovação em campaigns + índice único parcial 1-approved + CHECK campaigns_approved_requires_version + seed campaign_approval_enabled=false
  - RPC approve_campaign_art_version transacional (SECURITY DEFINER, guarded update + defensivo + repontar campaigns)
  - Schema aplicado no remoto (db push resolvido — aplicação manual pelo usuário)
affects: [37-1-03 (flag), 37-1-04 (tipos/persistência), 37-1-05 (display), 37-1-06 (generate-image v1), 37-1-08 (rota approve), 37-1-10/11 (testes fonte)]

# Tech tracking
tech-stack:
  added: [postgres campaign_art_versions table, plpgsql approve_campaign_art_version RPC]
  patterns: [SECURITY DEFINER RPC with empty search_path, guarded update FOR UPDATE, UNIQUE partial index 1-approved, DROP/ADD CHECK via idempotent DO block, ON CONFLICT idempotent seed, REVERT section]

key-files:
  created: [supabase/migrations/20260901000001_f37_1_create_campaign_art_versions.sql, supabase/migrations/20260901000002_f37_1_approve_campaign_art_version_rpc.sql]
  modified: []

key-decisions:
  - "CHECK campaigns_approved_requires_version via bloco idempotente DO $$ (ADD CONSTRAINT IF NOT EXISTS não portável no Supabase)"
  - "Defensivo (D8): UPDATE marca demais linhas ativas como discarded (storage_path=NULL, asset_deleted_at=now()) — no-op na 37.1 (só v1)"
  - "Sem backfill e sem alteração de chk_generation_events_type (D7/D8)"

patterns-established:
  - "Migration de base de aprovação: tabela + colunas aditivas + índice único parcial + CHECK idempotente + seed flag + RPC SECURITY DEFINER transacional + REVERT"

requirements-completed: [F37.1-03, F37.1-04, F37.1-05, F37.1-06, F37.1-07, F37.1-08]

# Metrics
duration: 30min
completed: 2026-09-01
---

# Phase 37.1 Plan 02: Migrations campaign_art_versions + RPC approve Summary

**Migrations da fatia criadas e APLICADAS NO REMOTO (aplicação manual pelo usuário, projeto `gvbzwihwgzujwsviufgy`): tabela `campaign_art_versions` (1 candidata por vez, RLS service_role-only) + colunas de aprovação em `campaigns` + índice único parcial 1-approved + CHECK `campaigns_approved_requires_version` + seed `campaign_approval_enabled=false`; e RPC `approve_campaign_art_version` transacional (SECURITY DEFINER, guarded update + defensivo + repontar campaigns)**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 3
- **Files modified:** 2 (migrations criadas)

## Accomplishments

- **Migration `20260901000001_f37_1_create_campaign_art_versions.sql`** (idempotente, não destrutiva, com REVERT):
  - **Tabela `campaign_art_versions`** (`IF NOT EXISTS`): `id uuid PK DEFAULT gen_random_uuid()`, `campaign_id uuid FK CASCADE`, `version_number smallint CHECK 1..3`, `status CHECK pending/approved/rejected`, `correction_in_progress boolean NOT NULL DEFAULT false` (decisão 5), `storage_path text NULL`, `asset_status text NOT NULL DEFAULT 'active' CHECK active/discarded`, `asset_deleted_at timestamptz`, `brief_snapshot jsonb NOT NULL`, `render_snapshot`/`generation_metadata`/`rejection_reason` jsonb, `created_at timestamptz DEFAULT now()`, `UNIQUE (campaign_id, version_number)`; RLS habilitado + policy service_role + grants + REVOKE anon/authenticated (padrão feature_flags F43)
  - **Colunas em `campaigns`** (`ADD COLUMN IF NOT EXISTS`): `approval_status` default `'pending_approval'` + CHECK, `rejection_count` smallint default 0 CHECK 0..2, `approved_version_id` uuid FK, `approved_at` timestamptz
  - **CHECK `campaigns_approved_requires_version`** via bloco idempotente `DO $$ ... IF NOT EXISTS (pg_constraint) ... END $$` (sem `ADD CONSTRAINT IF NOT EXISTS` — não portável)
  - **Índice único parcial** `campaign_art_versions_one_approved_per_campaign` ON (campaign_id) WHERE status='approved' — 1 approved por campanha
  - **Seed** `campaign_approval_enabled = false` (descrição administrativa) via `ON CONFLICT (key) DO NOTHING`
  - **Sem backfill** (nenhum INSERT em campaign_art_versions para campanhas existentes) e **sem alteração** de `chk_generation_events_type` (grep confirmado)
- **Migration `20260901000002_f37_1_approve_campaign_art_version_rpc.sql`**:
  - **RPC `approve_campaign_art_version(p_campaign_id uuid, p_version_id uuid)`** RETURNS jsonb — `SECURITY DEFINER` + `SET search_path=''` + identificadores schema-qualified (padrão F43); em um bloco transacional (ROLLBACK automático): (1) `SELECT ... FOR UPDATE` da versão (guarded update) → `version_not_found`; (2) validações → `version_campaign_mismatch` (404) / `version_not_pending` (409) / `version_not_active` (409); (3) **defensivo (D8)** `UPDATE campaign_art_versions SET asset_status='discarded', storage_path=NULL, asset_deleted_at=now()` para as demais ativas (no-op na 37.1); (4) `UPDATE ... SET status='approved'`; (5) `UPDATE campaigns SET storage_path=v_storage_path, approved_version_id, approved_at=now(), approval_status='approved'` (repontar — decisão 3); `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO service_role` + REVERT
- **Task 3 (db push [BLOCKING]):** `SUPABASE_ACCESS_TOKEN` não definido no ambiente e sem token file (precedente F43-07). **RESOLVIDO:** usuário aplicou as 2 migrations manualmente no remoto (projeto `gvbzwihwgzujwsviufgy`) — confirmado "Aplicado, pode continuar" (2026-09-01). O push [BLOCKING] está **concluído**; o código 37-1-03+ pode consumir `campaign_art_versions`/`approve_campaign_art_version` em produção.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Migration 1 — campaign_art_versions + colunas campaigns + índice + CHECK + seed + RLS** - `72097f3d` (feat)
2. **Task 2: Migration 2 — RPC approve_campaign_art_version transacional** - `72097f3d` (feat, mesmo commit)
3. **Task 3: [BLOCKING] supabase db push no remoto + verificação** - RESOLVIDO (usuário aplicou manualmente em 2026-09-01) — registrado no SUMMARY

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/20260901000001_f37_1_create_campaign_art_versions.sql` - Tabela + colunas campaigns + índice + CHECK + seed + RLS + REVERT
- `supabase/migrations/20260901000002_f37_1_approve_campaign_art_version_rpc.sql` - RPC transacional + REVERT

## Decisions Made

- CHECK condicional idempotente via `DO $$` (não `ADD CONSTRAINT IF NOT EXISTS` — não portável no Supabase)
- Defensivo no RPC marca demais linhas ativas como discarded na mesma transação (D8) — no-op na 37.1 (só v1)
- Sem backfill; sem alteração de `chk_generation_events_type` (telemetria via metadata/campaign_art_versions, D8)

## Deviations from Plan

**Task 3 (push [BLOCKING]) — RESOLVIDO:** `supabase db push` não pôde ser executado pelo executor (`SUPABASE_ACCESS_TOKEN` ausente no ambiente). **O usuário aplicou as 2 migrations manualmente no remoto** (projeto `gvbzwihwgzujwsviufgy`, confirmado 2026-09-01). O push [BLOCKING] está **concluído**.

## Issues Encountered

- `SUPABASE_ACCESS_TOKEN` não definido — `db push` não autentica (precedente F43-07)
- Resolvido via aplicação manual pelo usuário no remoto

## User Setup Required

**Resolvido:** o usuário aplicou as migrations no remoto (projeto `gvbzwihwgzujwsviufgy`) em 2026-09-01. Nenhuma ação pendente de setup.

## Next Phase Readiness

- Base de dados da fatia pronta e aplicada no remoto — código 37-1-03+ pode consumir `campaign_art_versions`/`approve_campaign_art_version`
- Ordem de deploy (D3): migration → código (37-1-03..37-1-09) → smoke → UAT
- Próximo: **37-1-03** (flag `campaign_approval_enabled` em `feature-flag-service.ts` — constante + ALL_FEATURE_FLAG_KEYS + isCampaignApprovalEnabled fail-closed)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
