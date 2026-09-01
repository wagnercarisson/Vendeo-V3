---
phase: 37.1-approval-gate-candidata-unica
plan: 08
subsystem: api
tags: [approve-route, rpc, approval, api, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (design.md D6/D8, spec campaign-approval-gate "Rota POST") + isCampaignApprovalEnabled (37-1-03) + RPC approve_campaign_art_version (37-1-02)
  - phase: fase-43-revisao-brief-pre-geracao
    provides: precedente de mapeamento de erro do RPC via msg.includes (admin feature-flags)
provides:
  - Rota POST /api/campaign/[id]/approve com pipeline de guards na ordem estrita do D6
  - Mapeamento de erros do RPC: version_not_found/version_campaign_mismatch → 404; version_not_pending/version_not_active → 409; outro → 500
  - Sucesso → 200 { campaignUrl: "/campanhas/{id}", status: "approved" }
  - Anti-concorrência: segunda aprovação → 409 (idempotente)
affects: [37-1-09 (UI aprovar → POST approve), 37-1-11 (testes rota), 37-1-14 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [route guard pipeline order, RPC error mapping via message.includes, zod strict body, force-dynamic API route]

key-files:
  created: [src/app/api/campaign/[id]/approve/route.ts]
  modified: []

key-decisions:
  - "requireOwnership → 404 (mesmo status de inexistente — sem enumeração)"
  - "campaign.status !== 'ready' → 409 antes do RPC (sem candidata para aprovar)"
  - "Body zod strict { versionId: uuid } — sem campos extras"

patterns-established:
  - "Rota de mutação transacional: CSRF → auth → UUID → getCampaign → ownership → flag → status → body zod → RPC com mapeamento de erros"

requirements-completed: [F37.1-18]

# Metrics
duration: 24min
completed: 2026-09-01
---

# Phase 37.1 Plan 08: Rota POST /api/campaign/[id]/approve Summary

**Rota de aprovação transacional (D6/D8): `POST /api/campaign/[id]/approve` com pipeline de guards na ordem estrita (requireSameOrigin → requireApiUser → UUID v4 → getCampaign → requireOwnership → isCampaignApprovalEnabled → status ready → zod body strict `{ versionId: uuid }`), chamada ao RPC `approve_campaign_art_version` com mapeamento de erros (version_not_found/version_campaign_mismatch → 404; version_not_pending/version_not_active → 409; outro → 500) e resposta `200 { campaignUrl, status: "approved" }`**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 1 (src/app/api/campaign/[id]/approve/route.ts — criado)

## Accomplishments

- **Task 1 — Pipeline de guards (D6):**
  - Arquivo criado com `export const dynamic = "force-dynamic"`, `UUID_V4_REGEX`, `ApproveBodySchema = z.object({ versionId: z.string().uuid() }).strict()` e `export const POST = apiHandler(...)`
  - Ordem estrita confirmada por grep: `requireSameOrigin` (28) → `requireApiUser` (30) → `UUID_V4_REGEX.test` → 400 (33) → `getCampaign` → 404 (37) → `requireOwnership` → 404 (42) → `!isCampaignApprovalEnabled` → 403 (44) → `campaign.status !== "ready"` → 409 (48) → `ApproveBodySchema.safeParse` → 400 com issues (59)
- **Task 2 — Chamada RPC + mapeamento + resposta (D8):**
  - `supabaseAdmin.rpc("approve_campaign_art_version", { p_campaign_id: id, p_version_id: parsed.data.versionId })` (67)
  - Mapeamento (padrão `msg.includes`): `version_not_found`/`version_campaign_mismatch` → `notFound("Version not found")` (404); `version_not_pending`/`version_not_active` → 409 `{ error: "Version already resolved or invalid" }`; demais → 500 `{ error: msg }`
  - Sucesso → `200 { campaignUrl: "/campanhas/{id}", status: "approved" }` — o `data` do RPC não é exposto (telemetria via `campaign_art_versions.status` + `campaigns.approved_at`, D8 — sem novo generation_type)
- **Verificação de aceitação:** grep de 15 marcadores presentes (POST apiHandler, force-dynamic, 4 guards, flag, not ready, schema, rpc, 4 códigos de erro, campaignUrl, status approved) + `.strict()` presente; ordem de guards confirmada por grep (CSRF → auth → UUID → getCampaign → ownership → flag → ready → zod → rpc); typecheck com erros apenas em `display.test.ts` (fixtures — 37-1-14).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Pipeline de guards da rota POST /api/campaign/[id]/approve** - `405a85a5` (feat)
2. **Task 2: Chamada RPC + mapeamento de erros + resposta 200** - `405a85a5` (feat, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/app/api/campaign/[id]/approve/route.ts` - Rota de aprovação (guards + RPC + mapeamento)

## Decisions Made

- `requireOwnership` → 404 (mesmo status de campanha inexistente — sem enumeração de dono)
- `campaign.status !== 'ready'` → 409 antes do RPC (sem candidata para aprovar em generating/error)
- Body zod strict (`versionId: z.string().uuid()` com `.strict()`) — campos extras rejeitados
- Anti-concorrência: RPC guarded update + índice único parcial → segunda aprovação retorna `version_not_pending` → 409 (idempotente)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum - typecheck sem erros novos (apenas fixtures de `display.test.ts`, co-migração 37-1-14).

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Aprovação transacional via RPC com mapeamento de status correto (400/403/404/409/200)
- Anti-concorrência: segunda aprovação → 409 (idempotente); telemetria sem novo generation_type
- Próximo: **37-1-09** (UI — page.tsx deriva o estado, componente `CampaignApprovalView`, client.tsx roteia pending → revisão; consume esta rota via fetch POST)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
