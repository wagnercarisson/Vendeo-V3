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
  - verificador local idempotente com 21 cenários aprovados
  - correção forward do lint de admin_create_store_for_user
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
    - scripts/verify/47-01-f47-migration-verification.mjs
    - .planning/phases/47-catalogo-e-selecao-de-modelos-admin/47-01-SUMMARY.md

decisions:
  - "O verificador recusa API_URL/DB_URL fora de localhost/127.0.0.1."
  - "Analytics/vector são dispensáveis; o checkpoint usa API, banco e auth locais."
  - "A limpeza do actor temporário suspende o trigger append-only apenas durante a limpeza local das auditorias desse actor."

requirements: [ai-model-catalog, ai-model-selection]
requirements-completed: [ai-model-catalog, ai-model-selection]

completed: 2026-09-14
---

# Phase 47 Plan 01 Summary

Migration F47 local criada e validada no Supabase local. O verificador criou e removeu um actor temporário local e aprovou todos os cenários de catálogo, RLS/revoke, RPCs, validações, deprecated, idempotência e auditoria.

## Tasks

- Task 1: tracking F47 iniciado sem reescrever o histórico F46.
- Task 2: catálogo com exatamente 12 seeds explícitos, seleção, RPCs SECURITY DEFINER, auditoria atômica e REVERT.
- Task 3: verificador local usando credenciais exclusivamente de `npx supabase status -o env`.
- Task 4: Docker/Supabase local disponível; reset e verificação executados. Analytics/vector permaneceram parados e dispensáveis.
- Correção adicional: migration forward `20260914000002` restaura a assinatura ausente de `create_store_with_initial_grant` e corrige `admin_create_store_for_user` sem editar migrations históricas.

## Gate Results

| Gate | Resultado |
|---|---|
| `node --check scripts/verify/47-01-f47-migration-verification.mjs` | PASS |
| `npx supabase db reset` | PASS |
| `node scripts/verify/47-01-f47-migration-verification.mjs` | PASS — 21/21 |
| `npx supabase db lint --local` | DIVERGÊNCIA — erro preexistente em `admin_get_ai_costs` (`generation_events.created_at` ausente); erro de `admin_create_store_for_user` removido |

## Divergence

O lint local ainda reporta `public.admin_get_ai_costs`, originado antes da F47, e o warning preexistente de variável não lida em `begin_campaign_correction_submission`. Nenhum desses itens foi alterado neste plano. A migration F47 e a correção forward aplicam no reset; nada foi enviado ao remoto e nenhum deploy foi executado.

## Commits

- `628ade36` — tracking/start F47
- `84c84cce` — migration F47 catalog/selection
- `0943966f` — verificador local
- pendente — correção forward, verificador via status env e summary deste ciclo

## Self-Check

- [x] Banco local resetado
- [x] Verificador recusando remoto
- [x] Actor temporário criado/removido
- [x] 21/21 cenários aprovados
- [x] Nenhuma migration histórica editada
- [x] Nenhuma migration remota aplicada
- [ ] Lint global sem divergências preexistentes
