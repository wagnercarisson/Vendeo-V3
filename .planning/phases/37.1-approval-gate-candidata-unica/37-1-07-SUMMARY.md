---
phase: 37.1-approval-gate-candidata-unica
plan: 07
subsystem: api
tags: [download, publication-copy, approval-gate, 403, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (design.md D2/D8 + decisão 4, specs campaign-download-route + publication-copy-route) + isCampaignApprovalEnabled (37-1-03) + listArtVersions (37-1-04) + computeApprovalState/isDeliveryReleased (37-1-05)
provides:
  - Gate de aprovação em GET /api/campaign/[id]/download (403 pending/regenerating com flag on)
  - Gate de aprovação em PATCH /api/campaign/[id]/publication-copy (403 antes de persistir)
  - not_enabled/legacy/approved → comportamento atual (fail-closed)
  - Flag off → zero lookups adicionais (fast path)
affects: [37-1-09 (UI), 37-1-12 (testes gated 16.x), 37-1-14 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [approval gate after ownership before delivery, fail-closed delivery check, minimal query overhead]

key-files:
  created: []
  modified: [src/app/api/campaign/[id]/download/route.ts, src/app/api/campaign/[id]/publication-copy/route.ts]

key-decisions:
  - "Gate posicionado APÓS requireOwnership e ANTES do download/update (nada é tocado em 403)"
  - "Custo: 2 lookups simples (flag + versões); fast path para flag off (zero lookups adicionais)"
  - "Erro 403 uniforme: { error: 'Campaign pending approval' } nas 2 rotas"

patterns-established:
  - "Gate de aprovação idêntico nas rotas de entrega (padrão do contrato <interfaces> do plano 37-1-07)"

requirements-completed: [F37.1-16, F37.1-17]

# Metrics
duration: 24min
completed: 2026-09-01
---

# Phase 37.1 Plan 07: Gates download + publication-copy Summary

**Gates de aprovação (D2/decisão 4) inseridos nas rotas de entrega: `GET /api/campaign/[id]/download` e `PATCH /api/campaign/[id]/publication-copy` derivam o estado (via `isCampaignApprovalEnabled()` + `listArtVersions` + `computeApprovalState`) logo após `requireOwnership`; `!isDeliveryReleased(state)` (pending/regenerating com flag on) → 403 `{ error: "Campaign pending approval" }`; not_enabled/legacy/approved → comportamento atual; flag off → zero lookups adicionais (fail-closed D1)**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 2 (download/route.ts + publication-copy/route.ts)

## Accomplishments

- **Task 1 — Gate em GET /api/campaign/[id]/download (D2/decisão 4):**
  - Imports: `listArtVersions` (persistence), `computeApprovalState`/`isDeliveryReleased` (display), `isCampaignApprovalEnabled` (feature-flag-service)
  - Gate inserido IMEDIATAMENTE após `await requireOwnership(...)` e ANTES do `.download(campaign.storage_path)`:
    ```ts
    if (await isCampaignApprovalEnabled()) {
      const versions = await listArtVersions(campaign.id);
      const state = computeApprovalState(campaign, versions, true);
      if (!isDeliveryReleased(state)) {
        return NextResponse.json({ error: "Campaign pending approval" }, { status: 403 });
      }
    }
    ```
  - Fluxo de sucesso intacto (download de `campaign.storage_path` — aprovada repontada no approve; legacy/not_enabled como hoje); guards existentes (401/400/404/502) inalterados
- **Task 2 — Gate em PATCH /api/campaign/[id]/publication-copy (decisão 4):**
  - Mesmos imports + gate logo após `requireOwnership` e ANTES do `request.json()`/validação/UPDATE (nada persistido em 403)
  - Fluxo de sucesso intacto: validação 400, `restore: true` → `publication_copy_current: null`, dados normais → update 200; guards CSRF/auth/404 inalterados
- **Verificação de aceitação:** grep nas 2 rotas (`isCampaignApprovalEnabled`/`listArtVersions`/`isDeliveryReleased`/`Campaign pending approval` presentes); posicionamento confirmado (gate em download:40 < download:47; gate em copy:44 < update:69); typecheck com erros apenas em `display.test.ts` (fixtures — 37-1-14); suítes existentes verdes (download 6/6, publication-copy 8/8 — nenhuma co-migração necessária nesta etapa).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Gate de aprovação em GET /api/campaign/[id]/download** - `86e91e8d` (feat)
2. **Task 2: Gate de aprovação em PATCH /api/campaign/[id]/publication-copy** - `86e91e8d` (feat, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/app/api/campaign/[id]/download/route.ts` - Gate de aprovação (403) + imports
- `src/app/api/campaign/[id]/publication-copy/route.ts` - Gate de aprovação (403, antes de persistir) + imports

## Decisions Made

- Gate posicionado APÓS `requireOwnership` e ANTES do download/update (decisão 4 — nada é tocado em 403)
- Estado derivado de `campaign_art_versions` (single source, D8) — não de coluna adicional
- 2 lookups simples por request (flag + versões); fast path flag off (zero lookups)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum - suítes existentes de download (6) e copy (8) verdes sem co-migração; os testes novos dos cenários 403/200/legacy ficam no plano 37-1-12.

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Download e copy bloqueados (403) para pending/regenerating com flag on; liberados para not_enabled/legacy/approved
- Flag off → nenhuma mudança de comportamento (fail-closed); custo mínimo de queries
- Próximo: **37-1-08** (rota `POST /api/campaign/[id]/approve` — guards + RPC transacional + mapeamento de erros)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
