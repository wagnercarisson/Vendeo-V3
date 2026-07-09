---
phase: 14-integracao-fluxo-geracao
plan: 01
subsystem: campaign
tags: sharp, image-processing, typescript, vitest

requires:
  - phase: 13-servico-persistencia-download
    provides: persistence.ts (dataUrlToCampaignImage, uploadCampaignImage), types.ts

provides:
  - transcodeToJpeg - transcodifica PNG/WEBP/JPEG → JPEG sRGB q90 1080×1080
  - buildPublicationCopySnapshot - builder type-safe para shape caption/hashtags/cta_post
  - PublicationCopySnapshot realinhado para shape da milestone v1.3
  - 6 cenários de teste (4 transcode + 2 copy builder)

affects:
  - 14-02-orquestracao-generate-image
  - 15-pagina-campanha

tech-stack:
  added:
    - sharp ^0.34.5 (runtime dependency para transcodificação de imagens)
  patterns:
    - sharp pipeline: resize(fit=contain, bg=#FFFFFF) + jpeg(q=90) mantido como canônico
    - server-only directive em módulos Node.js exclusivos
    - vi.mock chain pattern para sharp (resize → jpeg → toBuffer)

key-files:
  created:
    - src/lib/campaign/image-processor.ts
    - src/__tests__/lib/campaign/processor.test.ts
  modified:
    - package.json
    - src/lib/campaign/types.ts

key-decisions:
  - "Sharp v0.34.5 como runtime dep para transcodificação PNG/WEBP → JPEG canônico"
  - "fit=contain + background branco para canvas 1080×1080 sem distorção"
  - "buildPublicationCopySnapshot como função identidade type-safe (sem transformação)"
  - "PublicationCopySnapshot removido de 6 campos antigos para 3 (caption, hashtags, cta_post)"
  - "CampaignReadyData mantido como Record<string, unknown> sem quebra de contrato"

patterns-established:
  - "Novos módulos server-only: import 'server-only' como primeira linha"
  - "Testes de processor: vi.mock('sharp', chain pattern) + beforeEach + dynamic import"

requirements-completed:
  - REQ-IMAGE-PROCESSOR
  - REQ-PUBLICATION-COPY
  - REQ-TEST-PROCESSOR

duration: 3min
completed: 2026-07-09
---

# Phase 14 Plan 01: Image Processor + Publication Copy Summary

**Sharp-based transcodificação PNG/WEBP/JPEG → JPEG sRGB q90 1080×1080, builder de publication copy, e realinhamento de PublicationCopySnapshot para o shape da milestone v1.3 (caption, hashtags, cta_post) com 6 cenários de teste**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-09T17:23:24Z
- **Completed:** 2026-07-09T17:27:05Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Installed sharp v0.34.5 as runtime dependency for Node.js image transcoding
- Created `transcodeToJpeg` — accepts PNG/WEBP/JPEG, outputs JPEG sRGB q90 1080×1080 with `fit=contain` and white background, rejects unsupported MIME with descriptive error
- Created `buildPublicationCopySnapshot` — type-safe identity builder for `{ caption, hashtags, cta_post }`
- Realigned `PublicationCopySnapshot` interface: removed 6 old fields (title, subtitle, hook, cta, badgeText, priceDisplay), added 3 new (caption, hashtags, cta_post)
- CampaignReadyData unchanged — continues using `Record<string, unknown>`
- 6 test cases covering all transcode scenarios (PNG, WEBP, JPEG idempotent, unsupported rejection) and copy builder (shape verification, empty values)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install sharp and create image-processor.ts** - `47e8e5d` (feat)
2. **Task 2: Realign PublicationCopySnapshot in types.ts** - `798b55e` (feat)
3. **Task 3: Create processor tests (6 scenarios)** - `75fd0b1` (test)

**Plan metadata:** *(committed below)*

## Files Created/Modified

- `src/lib/campaign/image-processor.ts` - transcodeToJpeg + buildPublicationCopySnapshot (49 lines)
- `src/lib/campaign/types.ts` - PublicationCopySnapshot realinhado (3 fields, -6 old fields)
- `package.json` - sharp ^0.34.5 added to dependencies
- `src/__tests__/lib/campaign/processor.test.ts` - 6 cenários de teste (110 lines)

## Decisions Made

- **Sharp v0.34.5** installed as runtime dependency. Industry standard, performant (<50ms for 1080×1080), compatible with Node.js/Vercel. Resolves the gap between `dataUrlToCampaignImage` (parser puro que aceita PNG/WEBP/JPEG) and `uploadCampaignImage` (só aceita `image/jpeg`).
- **fit=contain + background branco** garante canvas final 1080×1080 sem distorção, preservando aspect ratio original com preenchimento branco quando necessário.
- **buildPublicationCopySnapshot como função identidade** — sem transformação lógica. A montagem determinística do conteúdo (caption, hashtags, cta_post) acontece no route handler (14-02). O builder é garantia de tipo, não gerador de conteúdo.
- **PublicationCopySnapshot** removido de 6 campos (title, subtitle?, hook, cta, badgeText, priceDisplay) para 3 (caption, hashtags, cta_post), alinhado com o shape JSONB no banco (`publication_copy_snapshot`).
- **CampaignReadyData** mantido como `Record<string, unknown>` para as sub-propriedades. A mudança em PublicationCopySnapshot não quebra contratos.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm install sharp` did not auto-add to package.json (npm config quirk on Windows). Added manually after verifying version in node_modules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for **14-02 (Orquestração em generate-image)**: pipeline INSERT → IA → transcode → upload → updateReady
- `transcodeToJpeg` conecta `dataUrlToCampaignImage` ao `uploadCampaignImage`
- `buildPublicationCopySnapshot` disponível para montagem do snapshot no handler
- 6 testes validam o comportamento do processor

## Self-Check: PASSED

- [x] `src/lib/campaign/image-processor.ts` - exists
- [x] `src/__tests__/lib/campaign/processor.test.ts` - exists
- [x] `.planning/phases/14-integracao-fluxo-geracao/14-01-SUMMARY.md` - exists
- [x] Commit `47e8e5d` (Task 1) - verified
- [x] Commit `798b55e` (Task 2) - verified
- [x] Commit `75fd0b1` (Task 3) - verified
- [x] `npx vitest run src/__tests__/lib/campaign/processor.test.ts` - 6 passing
- [x] `npm run typecheck` - exits 0
- [x] `npm run lint` - exits 0

---

*Phase: 14-integracao-fluxo-geracao*
*Completed: 2026-07-09*
