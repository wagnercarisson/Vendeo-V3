---
phase: 37.1-approval-gate-candidata-unica
plan: 06
subsystem: api
tags: [generate-image, art-version, fail-safe, feature-flag, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (design.md D4/D8/D10, spec ai-image-generation) + isCampaignApprovalEnabled (37-1-03) + createArtVersion (37-1-04)
provides:
  - generate-image insere a v1 (pending/active, brief_snapshot = campaign_brief_v1 persistido) quando a flag está ligada
  - Fail-safe: falha no insert → log + continua (campanha legacy, D1)
  - Flag off → nenhuma inserção (comportamento atual)
  - Mock de feature-flag-service co-migrado (isCampaignApprovalEnabled default false)
affects: [37-1-07 (gates), 37-1-09 (revisão da candidata), 37-1-12 (testes flag on), 37-1-14 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [fail-safe side-effect after createCampaign, feature flag read in pre-stream hot path, mock co-migration preserving existing suite]

key-files:
  created: []
  modified: [src/app/api/campaign/generate-image/route.ts, src/app/api/campaign/generate-image/__tests__/route.test.ts]

key-decisions:
  - "v1 reaproveita campaign.storagePath (path da geração inicial {storeId}/{campaignId}.jpg); convenção v{n}.jpg é da regeração (37.2)"
  - "Falha no insert → log + continua (fail-safe D1); campanha exibida como legacy"
  - "Inserção condicionada a if (await isCampaignApprovalEnabled()) — flag off → zero inserções"

patterns-established:
  - "Efeito colateral fail-safe pós-criação: try/catch que apenas loga (nunca propaga para o fluxo de geração)"

requirements-completed: [F37.1-15]

# Metrics
duration: 22min
completed: 2026-09-01
---

# Phase 37.1 Plan 06: generate-image insere v1 Summary

**Mudança mínima no pipeline (D8/D10): no `POST /api/campaign/generate-image`, imediatamente após o `logPipelineEvent` de `campaign_create` (status complete), quando `isCampaignApprovalEnabled()` for true, a v1 é inserida em `campaign_art_versions` via `createArtVersion(campaign.id, 1, campaign.storagePath, inputSnapshot)` — candidata pending/active com `brief_snapshot` = o mesmo objeto `campaign_brief_v1` persistido — em try/catch fail-safe (falha → log + continua, campanha legacy); flag off → nenhuma inserção; core de geração (providers/prompts/créditos/stream) intocado**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 2 (route.ts + route.test.ts)

## Accomplishments

- **Task 1 — Inserção da v1 (flag on) com fail-safe (D4/D8/D10):**
  - Imports adicionados: `createArtVersion` de `@/lib/campaign/persistence` (junto aos imports de persistência) e `isCampaignApprovalEnabled` de `@/lib/feature-flags/feature-flag-service` (junto ao import existente de `isForceBriefVisionCheckEnabled`)
  - Bloco inserido IMEDIATAMENTE após o `logPipelineEvent({ event: "campaign_create", ..., status: "complete", campaignId: campaign.id, ... })` e DENTRO do try pré-stream, com fail-safe PRÓPRIO:
    ```ts
    try {
      if (await isCampaignApprovalEnabled()) {
        await createArtVersion(campaign.id, 1, campaign.storagePath, inputSnapshot);
      }
    } catch (err) {
      console.error(`[generate-image] createArtVersion v1 failed (fail-safe) — ...`);
    }
    ```
  - `campaign.storagePath` reaproveita o path da geração inicial (`{storeId}/{campaignId}.jpg`; convenção `v{n}.jpg` é da regeração 37.2); `render_snapshot`/`generation_metadata`/`rejection_reason` ficam NULL (defaults)
  - `inputSnapshot` = exatamente o objeto `campaign_brief_v1` persistido em `campaigns.input_snapshot` (mesma variável, `buildCampaignBriefSnapshot(brief)` da linha :452)
  - **Nenhuma alteração** em providers/prompts/ImageGenerationService/créditos/stream/upload de inputs (git diff confirmado: apenas bloco novo + imports)
- **Task 2 — Flag off → nenhuma inserção + regressão da rota (D1/D8):**
  - Confirmado por leitura: inserção ocorre APENAS dentro do `if (await isCampaignApprovalEnabled())` — flag off → o bloco try não insere nada (zero linhas em `campaign_art_versions`)
  - Mock de `@/lib/feature-flags/feature-flag-service` no `route.test.ts` co-migrado com `mockIsCampaignApprovalEnabled` (hoisted, default `async () => false`) — única mudança permitida nesta task; suíte existente preservada
  - `npx vitest run src/app/api/campaign/generate-image/__tests__/route.test.ts` — **60/60 PASS**
- **Verificação de aceitação:** grep de `createArtVersion` (import + chamada com `campaign.id, 1, campaign.storagePath, inputSnapshot`), `isCampaignApprovalEnabled` (import + leitura), `fail-safe` presentes; chamada dentro de try/catch que apenas loga; git diff sem alterações em providers/prompts/créditos/stream; typecheck com erros apenas em `display.test.ts` (fixtures — 37-1-14); suíte da rota verde.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Inserção da v1 (flag on) após createCampaign com fail-safe** - `5e468651` (feat)
2. **Task 2: Confirmar flag off → nenhuma inserção + regressão da rota (mock co-migrado)** - `5e468651` (feat, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/app/api/campaign/generate-image/route.ts` - Bloco de inserção da v1 (fail-safe) + imports
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - Mock co-migrado com `isCampaignApprovalEnabled` default false

## Decisions Made

- v1 reaproveita `campaign.storagePath` (D4) — convenção `{storeId}/{campaignId}/v{n}.jpg` é da regeração (37.2)
- Fail-safe (D1): falha no insert da v1 → log de erro operacional + geração continua; campanha nasce sem versões → exibida como legacy
- Inserção condicionada à flag (fail-closed false) — flag off nunca insere (drift de comportamento impossível)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum - mock co-migrado sem quebrar a suíte existente (60/60 PASS); typecheck segue com erro apenas nas fixtures de `display.test.ts` (37-1-14).

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Campanha nova sob a flag nasce com v1 em `campaign_art_versions` (pending, active, brief_snapshot = snapshot persistido) — revisão (37-1-09) e gates (37-1-07) têm o que exibir/bloquear
- Core de geração (providers/prompts/créditos) intocado
- Próximo: **37-1-07** (gates de aprovação em `GET /api/campaign/[id]/download` e `PATCH /api/campaign/[id]/publication-copy` — 403 quando pending/regenerating com flag on)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
