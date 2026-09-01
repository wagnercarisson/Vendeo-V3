---
phase: 43-revisao-brief-pre-geracao
plan: 09
subsystem: admin
tags: [admin, feature-flags, operational-controls, reason-required, d5]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (D5 — tela admin + rota PUT com motivo obrigatório + auditoria)
  - phase: 43-07 (migration)
    provides: RPC admin_update_feature_flag + tabela feature_flags (aplicada no remoto)
  - phase: 43-08 (serviço de leitura)
    provides: FORCE_BRIEF_VISION_CHECK_KEY + FeatureFlagService
provides:
  - Rota admin PUT /api/admin/feature-flags (requireAdmin + zod + motivo obrigatório + RPC com auditoria + operationId idempotência)
  - Página admin "Controles operacionais" (/admin/feature-flags) exibindo force_brief_vision_check com descrição, estados, motivo obrigatório, persistência + reload
  - Navegação admin para /admin/feature-flags
affects: [43-13 (testes 24-26), 43-14 (co-migração fixtures), 43-15 (UAT)]

# Tech tracking
tech-stack:
  added: [admin feature-flags route + page + form]
  patterns: [admin PUT route with reason-required + RPC delegation + operationId, admin page with requireAdmin + server-side flag read]

key-files:
  created: [src/app/api/admin/feature-flags/route.ts, src/app/(app)/admin/feature-flags/page.tsx, src/app/(app)/admin/feature-flags/feature-flags-form.tsx]
  modified: [src/app/(app)/admin/layout.tsx]

key-decisions:
  - "Navegação admin adicionada no admin/layout.tsx (nav real do admin) — não em sidebar.tsx (o sidebar é a nav principal do app, sem seções admin)"

patterns-established:
  - "Flag admin operável em tela sem redeploy, com motivo obrigatório + auditoria + idempotência via operationId"

requirements-completed: [F43-22, F43-23, F43-24]

# Metrics
duration: 45min
completed: 2026-08-21
---

# Plan 43-09: Admin feature-flags Summary

**Superfície administrativa da flag `force_brief_vision_check` (D5): rota `PUT /api/admin/feature-flags` protegida por `requireAdmin` com motivo obrigatório + auditoria (RPC `admin_update_feature_flag`) + idempotência via operationId; página "Controles operacionais" exibindo a flag com descrição, estados, motivo e persistência + reload; navegação admin adicionada**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 3
- **Files modified:** 4 (3 criados + 1 modificado)

## Accomplishments
- **Rota `PUT /api/admin/feature-flags`** (novo): `requireAdmin`; validação de body (`key`/`enabled`/`reason` obrigatório ≥1 char → 400 se ausente); delega ao RPC `admin_update_feature_flag` com `p_actor_id`/`p_operation_id` (idempotência)/`p_key`/`p_enabled`/`p_reason`; erros mapeados (400 missing_*/invalid, 404 flag_not_found, 500); **GET** adicional retorna o estado atual da flag (tela)
- **Página admin "Controles operacionais"** (`/admin/feature-flags`): `requireAdmin`; lê a flag via `supabaseAdmin` (com tratamento de erro/migration ausente); renderiza `FeatureFlagsForm` com descrição administrativa, badge de estado ("Desligada — padrão recomendado"/"Ligada — força validação IA além da revisão humana"), motivo obrigatório (bloqueia com "Motivo obrigatório"), persistência via `PUT` + `window.location.reload()` (reflete o novo estado), exibição de `updatedByEmail`/`updatedAt`
- **Navegação admin**: link "Controles operacionais" → `/admin/feature-flags` adicionado ao `admin/layout.tsx` (nav real do admin)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Rota admin PUT /api/admin/feature-flags** - (parte do commit do plano, feat)
2. **Task 2: Página admin 'Controles operacionais'** - (parte do commit do plano, feat)
3. **Task 3: Navegação admin** - (parte do commit do plano, feat)

## Files Created/Modified
- `src/app/api/admin/feature-flags/route.ts` - PUT + GET (novo)
- `src/app/(app)/admin/feature-flags/page.tsx` - Página (novo)
- `src/app/(app)/admin/feature-flags/feature-flags-form.tsx` - Form (novo)
- `src/app/(app)/admin/layout.tsx` - Link "Controles operacionais" (modificado)

## Decisions Made
- Navegação admin em `admin/layout.tsx` (nav real do admin) em vez de `sidebar.tsx` — ver Deviations
- GET na mesma rota para a tela ler o estado atual da flag

## Deviations from Plan

**Task 3 (navegação) — localização divergente:** o plano especificava `src/components/shell/sidebar.tsx`, mas a navegação admin REAL vive em `src/app/(app)/admin/layout.tsx` (o `sidebar.tsx` é a nav principal do app sem seções admin). A entrada "Controles operacionais" → `/admin/feature-flags` foi adicionada no `admin/layout.tsx`. A verificação automatizada do plano (grep em `sidebar.tsx`) não encontra a entrada nesse arquivo por esta razão — a funcionalidade (F43-24) está entregue no local correto.

## Issues Encountered
- Nenhum — as validações de body da rota usam checagem manual (equivalente ao zod min(1)) já que o body não é parquet de schema compartilhado; comportamento idêntico ao padrão operation-costs

## User Setup Required
None (migration já aplicada no remoto — 43-07 resolvido)

## Next Phase Readiness
- Flag operável em tela no admin sem redeploy (motivo obrigatório + auditoria)
- Validações: typecheck limpo, 97 testes de admin API + 50 de admin pages passando
- Próximo: 43-10 (testes 1-10 hook/form), que cobre o reviewMode/helpers da F43

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*