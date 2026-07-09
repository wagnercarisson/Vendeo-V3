---
phase: 14-integracao-fluxo-geracao
plan: 02
subsystem: api
tags: [generate-image, ndjson, persistence, pipeline, storage, transcode, compensation]

requires:
  - phase: 12-fundacao-db-storage
    provides: campaigns table, campaign-images bucket, RLS/Storage policies
  - phase: 13-servico-persistencia-download
    provides: types.ts, persistence.ts (7 helpers), download route
  - phase: 14-integracao-fluxo-geracao (14-01)
    provides: image-processor.ts (transcodeToJpeg, buildPublicationCopySnapshot)
provides:
  - Orquestração completa do pipeline INSERT → IA → transcode → upload → updateReady
  - NDJSON result com campaignId e campaignUrl (/campanha/{campaignId})
  - Compensação: upload failure → updateCampaignError; updateReady failure → deleteCampaignImage + updateCampaignError
  - Export const runtime = "nodejs" na rota generate-image
  - 6 cenários de teste de integração (sucesso, IA error, upload error, updateReady error, 401, 404)
affects: [14-03, 15, 16]

tech-stack:
  added: []
  patterns:
    - Persistence pipeline orchestration in NDJSON streaming route
    - Compensation via uploadSucceeded flag for partial failure handling
    - Generation metadata assembly at handler level (provider.name, model, durationMs, corrections)
    - deterministic publication copy snapshot building from caption/hashtags/cta_post

key-files:
  created:
    - src/__tests__/api/campaign-generate.test.ts
  modified:
    - src/app/api/campaign/generate-image/route.ts
    - src/app/api/campaign/generate-image/__tests__/route.test.ts

key-decisions:
  - "createCampaign (INSERT generating) ocorre após validação/auth/ownership e ANTES da geração IA (D8)"
  - "Pipeline order: INSERT → IA success → dataUrlToCampaignImage → transcodeToJpeg → uploadCampaignImage → updateCampaignReady"
  - "Compensation: if upload fails → only updateCampaignError; if updateReady fails after upload OK → deleteCampaignImage + updateCampaignError"
  - "durationMs measured with performance.now() with startTime captured before stream.start()"
  - "provider.name derived from the ImageProvider instance created inside the stream closure"
  - "buildCaption and buildHashtags helpers typed with concrete types (CampaignInput, StoreIdentitySnapshot, GenerateImageServiceResult)"
  - "Pre-existing route.test.ts updated with server-only and persistence/image-processor mocks"

requirements-completed:
  - REQ-ORCHESTRATION
  - REQ-TEST-INTEGRATION

duration: 8min
completed: 2026-07-09
---

# Phase 14 Plan 02: Orquestração em generate-image — Pipeline INSERT→IA→transcode→upload→updateReady com compensação

**Pipeline completo de persistência no fluxo de geração: createCampaign (generating) → IA → transcodeToJpeg → uploadCampaignImage → updateCampaignReady, com 6 cenários de teste de integração**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-09T17:30:20Z
- **Completed:** 2026-07-09T17:37:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Adicionado `export const runtime = "nodejs"` na rota generate-image (sharp compat, Edge Runtime prevention)
- Pipeline de persistência completo: INSERT `generating` via `createCampaign` após validação/ownership, antes da IA (D8)
- Geração IA bem-sucedida → `dataUrlToCampaignImage` → `transcodeToJpeg` → `uploadCampaignImage` → `updateCampaignReady`
- Compensação por tipo de falha: erro sem upload → apenas `updateCampaignError`; erro updateReady após upload OK → `deleteCampaignImage` + `updateCampaignError`
- Metadados de geração (D7) montados no handler: `provider.name`, `IMAGE_GENERATION_RESPONSES_MODEL`, `durationMs` via `performance.now()`, `inputCorrections`
- NDJSON result emite `{ type: "result", campaignId, campaignUrl: "/campanha/{campaignId}" }`
- Erros IA (success=false) registram `updateCampaignError` e incluem `campaignId` no NDJSON
- Erros catch (timeout/provider) também registram `updateCampaignError` e incluem `campaignId`
- Helpers `buildCaption` e `buildHashtags` com tipos concretos
- Input validation e conflito continuam SEM INSERT (400/409 preservados — D8 respeitado)
- 6 cenários de teste de integração criados

## Task Commits

Each task was committed atomically:

1. **Task 1: Add runtime=nodejs and orchestrate persistence pipeline in generate-image route** — `9b98e0f` (feat)
2. **Task 2: Create integration tests for generate-image pipeline (6 scenarios)** — `e09a5bb` (test)

## Files Created/Modified

- `src/app/api/campaign/generate-image/route.ts` — Pipeline de orquestração com persistência (INSERT → IA → transcode → upload → updateReady), runtime nodejs, buildCaption/buildHashtags helpers
- `src/__tests__/api/campaign-generate.test.ts` — 6 cenários de integração (sucesso, IA error, upload error, updateReady error, 401, 404)
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` — Atualizado com mocks para persistence/image-processor

## Decisions Made

- `createCampaign` chamado após auth/ownership/validação e ANTES da geração IA — registros `generating` só são criados para requisições válidas
- Ordem do pipeline: INSERT → IA → dataUrlToCampaignImage → transcodeToJpeg → uploadCampaignImage → updateCampaignReady
- Flag `uploadSucceeded` controla compensação: se false, apenas `updateCampaignError` (sem delete pois não há imagem no Storage)
- `performance.now()` capturado antes do `stream.start()` closure para timing preciso
- `provider.name` obtido da instância `ImageProvider` criada dentro do closure do stream
- NDJSON error events em todos os branches incluem `campaignId` quando INSERT já ocorreu

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- TypeScript error TS2352: `StoreIdentitySnapshot as Record<string, unknown>` — resolvido com double cast `as unknown as Record<string, unknown>`
- Pre-existing `route.test.ts` não mockava `server-only` e os novos módulos (persistence, image-processor) — adicionados mocks necessários
- Vitest `vi.fn().mockImplementation(() => ({...}))` com arrow function não funciona com `new` — convertido para `vi.fn(function() { return {...} })`

## Next Phase Readiness

- Phase 14-02 complete (2/3 plans of Phase 14)
- Pipeline de persistência funcional com compensação
- Ready for Plan 14-03: Consumer no cliente — navegação /campanha/[id], sessionStorage adjustments

## Self-Check: PASSED

- [x] `export const runtime = "nodejs"` present in route.ts
- [x] Pipeline order: INSERT → IA → dataUrlToCampaignImage → transcodeToJpeg → uploadCampaignImage → updateCampaignReady
- [x] Compensation: error without upload → only updateCampaignError; error after upload → deleteCampaignImage + updateCampaignError
- [x] `npx vitest run src/__tests__/api/campaign-generate.test.ts` — 6 passing
- [x] `npx vitest run` — 55 test files, 502 tests passing (no regressions)
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors
- [x] `npm run build` — zero errors
- [x] All created files exist on disk (route.ts, test files, SUMMARY.md)
- [x] Commit history: `9b98e0f` (feat), `e09a5bb` (test)

---

*Phase: 14-integracao-fluxo-geracao*
*Completed: 2026-07-09*
