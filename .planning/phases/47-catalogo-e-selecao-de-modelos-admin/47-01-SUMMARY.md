---
phase: 47-catalogo-e-selecao-de-modelos-admin
plan: 01
subsystem: database
tags: [migration, supabase, ai-model-catalog, ai-model-selection, audit]

requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: registry F46 com 11 capacidades e defaults primary/fallback
provides:
  - migration local F47 com catálogo, seleção, RPCs, RLS, CHECKs, seeds e REVERT
  - verificador local idempotente com 22 cenários aprovados, incluindo chamada real de admin_get_ai_costs
  - correção forward do lint de admin_create_store_for_user
  - correção forward de admin_get_ai_costs com created_at projetado no CTE filtered_ge
affects: [47-02, 47-03, 47-04, 47-08]

tech-stack:
  added: []
  patterns:
    - migration forward para corrigir dependência histórica sem editar migration aplicada
    - credenciais locais derivadas de `npx supabase status -o env`

key-files:
  created:
    - supabase/migrations/20260914000001_f47_ai_model_catalog_selection.sql
    - supabase/migrations/20260914000002_f47_fix_admin_create_store_lint.sql
    - supabase/migrations/20260914000003_f47_fix_admin_get_ai_costs_created_at.sql
    - scripts/verify/47-01-f47-migration-verification.mjs
    - .planning/phases/47-catalogo-e-selecao-de-modelos-admin/47-01-SUMMARY.md

decisions:
  - "O verificador recusa API_URL/DB_URL fora de localhost/127.0.0.1."
  - "Analytics/vector são dispensáveis; o checkpoint usa API, banco e auth locais."
  - "A limpeza do actor temporário suspende o trigger append-only apenas durante a limpeza local das auditorias desse actor."
  - "O erro real de admin_get_ai_costs foi corrigido antes de liberar o plano seguinte; o warning de v_report_version_id permanece não bloqueante."

requirements: [ai-model-catalog, ai-model-selection]
requirements-completed: [ai-model-catalog, ai-model-selection]

completed: 2026-09-14
---

# Phase 47 Plan 01 Summary

Migration F47 local criada e validada no Supabase local. O verificador criou e removeu um actor temporário local, invocou a RPC real `admin_get_ai_costs` e aprovou todos os cenários de catálogo, RLS/revoke, RPCs, validações, deprecated, idempotência e auditoria.

## Tasks

- Task 1: tracking F47 iniciado sem reescrever o histórico F46.
- Task 2: catálogo com exatamente 12 seeds explícitos, seleção, RPCs SECURITY DEFINER, auditoria atômica e REVERT.
- Task 3: verificador local usando credenciais exclusivamente de `npx supabase status -o env`.
- Task 4: Docker/Supabase local disponível; reset e verificação executados. Analytics/vector permaneceram parados e dispensáveis.
- Correção adicional: migration forward `20260914000002` restaura a assinatura ausente de `create_store_with_initial_grant` e corrige `admin_create_store_for_user` sem editar migrations históricas.
- Correção bloqueante: migration forward `20260914000003` restaura a projeção de `ge.created_at` em `admin_get_ai_costs`, preservando assinatura, grants, filtros e shape de resposta.

## Gate Results

| Gate | Resultado |
|---|---|
| `node --check scripts/verify/47-01-f47-migration-verification.mjs` | PASS |
| `npx supabase db reset` | PASS |
| `node scripts/verify/47-01-f47-migration-verification.mjs` | PASS — 22/22, incluindo RPC real |
| `npx supabase db lint --local` | PASS sem erros; permanece apenas warning não bloqueante de `v_report_version_id` |

## Divergence

O warning não bloqueante de variável não lida em `begin_campaign_correction_submission` permanece documentado e adiado. O erro runtime de `admin_get_ai_costs` foi corrigido pela migration forward e confirmado por lint e invocação real local.

## Commits

- `628ade36` — tracking/start F47
- `84c84cce` — migration F47 catalog/selection
- `0943966f` — verificador local
- `484a8153` — correção forward de `admin_create_store_for_user`, verificador via status env e summary inicial
- `2993081f` — correção forward de `admin_get_ai_costs` e teste RPC real
- `b7a452b4` — atualização final deste summary

## Self-Check

- [x] Banco local resetado
- [x] Verificador recusando remoto
- [x] Actor temporário criado/removido
- [x] 22/22 cenários aprovados
- [x] Nenhuma migration histórica editada
- [x] Nenhuma migration remota aplicada
- [x] Lint sem erros; warning não bloqueante documentado
