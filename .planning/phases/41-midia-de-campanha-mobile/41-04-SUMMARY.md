---
phase: 41-midia-de-campanha-mobile
plan: 04
subsystem: campaign
tags: [domain, mapper, snapshot, persistence, storage]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D2/D3 mapper multi + D5 persistência de inputs (storagePath, campaignId pré-gerado)
  - phase: 41-02
    provides: GenerateImageRequest.productImages[] (transporte aditivo)
provides:
  - brief.ts: mimeTypeFromDataUrl + mapper productImages[] item-a-item + storagePath no runtime/snapshot
  - persistence.ts: createCampaign(campaignId?) + uploadCampaignInputImage + removeCampaignInputs
  - types.ts: CreateCampaignInput com campaignId?/storagePaths?
affects: [41-06 (rota D5), 41-09 (testes 1-8), 41-12 (testes rota)]

# Tech tracking
tech-stack:
  added: []
  patterns: [mapper espelha transporte (roles/source), mimeType real derivado do dataUrl, storagePath aditivo no snapshot, transcode JPEG no upload de inputs]

key-files:
  created: []
  modified: [src/lib/campaign/brief.ts, src/lib/campaign/persistence.ts, src/lib/campaign/types.ts, src/app/api/campaign/generate-image/__tests__/route.test.ts]

key-decisions:
  - "D5: inputs sobem ao bucket campaign-images em {storeId}/{campaignId}/inputs/{imageId}.jpg (transcode JPEG, upsert:false); campaignId pré-gerado pela rota; removeCampaignInputs compensa falha pré-stream"
  - "F41-12: mimeType real derivado do dataUrl (corrige quirk 'image/jpeg' fixo da F39)"

requirements-completed: [F41-12, F41-13, F41-14, F41-15, F41-16]

# Metrics
duration: 45min
completed: 2026-08-15
---

# Plan 41-04: Domínio Multi + Persistência de Inputs Summary

**Mapper flat→domínio cresce para productImages[] item-a-item com mimeType real derivado do dataUrl (mimeTypeFromDataUrl) e legado = 1 elemento; CampaignProductImageInput ganha storagePath? (preenchido pela rota) e o snapshot copia storagePath quando presente; createCampaign aceita campaignId pré-gerado; uploadCampaignInputImage/removeCampaignInputs persistem os inputs no bucket campaign-images**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-15T18:35:00Z
- **Completed:** 2026-08-15T19:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- **brief.ts — helper `mimeTypeFromDataUrl(dataUrl)`:** regex `/^data:(image\/(png|jpeg|webp));base64,/` → `match?.[1] ?? "image/jpeg"` (corrige o quirk `"image/jpeg"` fixo da F39)
- **brief.ts — `CampaignProductImageInput`:** ganha `storagePath?: string` (doc: preenchido pela ROTA após o upload, antes do snapshot)
- **brief.ts — mapper `buildCampaignBriefFromFlat`:** `const productImages = input.productImages ?? (input.productImageDataUrl ? [1 primary/upload] : []);` + `.map(item)` com `id: crypto.randomUUID()`, `role`/`source` espelhados do transporte, `mimeType: mimeTypeFromDataUrl(img.dataUrl) ?? img.mimeType` (dataUrl como fonte primária — F41-12); storagePath não preenchido aqui (rota preenche pós-upload, D5); zero bifurcação (legado = productImages de 1 elemento)
- **brief.ts — snapshot `buildCampaignBriefSnapshot`:** no `.map()` das imagens, `...(i.storagePath ? { storagePath: i.storagePath } : {})` após `mimeType` (copia quando presente; sem fabricação); N imagens sem base64; shape do `CampaignBriefSnapshotImage` inalterado
- **persistence.ts — `createCampaign(storeId, input, campaignId?)`:** `const campaignIdFinal = campaignId ?? crypto.randomUUID();` usado no storagePath e no INSERT (ausente → regressão UUID interno)
- **persistence.ts — `uploadCampaignInputImage(storeId, campaignId, imageId, { buffer, mimeType })`:** path `{storeId}/{campaignId}/inputs/{imageId}.jpg`, transcode via `transcodeToJpeg`, `contentType: "image/jpeg"`, `upsert: false`, throw no error, retorna `{ storagePath }`
- **persistence.ts — `removeCampaignInputs(storeId, campaignId)`:** `.list({storeId}/{campaignId}/inputs/, { limit: 100 })` → `.remove(paths)`; no-op quando vazio; falha pós-stream continua com `deleteCampaignImage` (D5)
- **types.ts — `CreateCampaignInput`:** ganha `campaignId?` e `storagePaths?: Array<{ imageId, storagePath }>`
- **Co-migração mock:** `route.test.ts` mockava `config` sem `MAX_CAMPAIGN_IMAGES` (o schema importa a constante) → adicionado `MAX_CAMPAIGN_IMAGES: 4` ao mock

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | brief.ts — mimeTypeFromDataUrl + storagePath runtime + mapper multi + snapshot copia storagePath | `42074a6` |
| 2 | persistence.ts + types.ts — createCampaign campaignId? + uploadCampaignInputImage + removeCampaignInputs | `1a2afca` |

## Files Created/Modified
- `src/lib/campaign/brief.ts` - helper + mapper multi + storagePath runtime/snapshot
- `src/lib/campaign/persistence.ts` - createCampaign 3º param + 2 helpers novos
- `src/lib/campaign/types.ts` - CreateCampaignInput estendido
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - mock config MAX_CAMPAIGN_IMAGES

## Validation

- Greps: `export function mimeTypeFromDataUrl` (1), `storagePath?: string` (2 — runtime novo + snapshot pré-existente), `input.productImages ??` (1), `...(i.storagePath` (1), `mimeType: "image/jpeg"` hardcode (0), `uploadCampaignInputImage` (1), `removeCampaignInputs` (1), `inputs/${imageId}.jpg` (1), `transcodeToJpeg` (3), `campaignId?: string` em types (1), `storagePaths?:` (1)
- **Testes:** `brief-mapper.test.ts` + `brief-snapshot.test.ts` → **21 passed**; `route.test.ts` → **47 passed**; regressão ampliada → **75 files / 578 tests passed**
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Seguir D2/D3/D5 do CONTEXT: mapper apenas espelha o transporte; mimeType real do dataUrl; storagePath aditivo no snapshot; campaignId pré-gerado; inputs JPEG imutáveis no bucket

## Deviations from Plan

- **Co-migração do mock de config em `route.test.ts` (regra-mãe de co-migração imediata)** — o schema.ts (41-02) importa `MAX_CAMPAIGN_IMAGES`; o mock do route.test.ts não o exportava e a suíte quebrou ao carregar o schema. Adicionado `MAX_CAMPAIGN_IMAGES: 4` ao mock (mínimo delta); os asserts de rota D5/D10 permanecem no escopo do 41-06.

**Total deviations:** 1 auto-fixed (mock config route.test.ts). **Impact:** nenhum — suíte verde.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa. Sem migration SQL (D5 — bucket e snapshot jsonb tolerantes).

## Next Phase Readiness
- 41-04 (domínio + persistência) completo — a rota (41-06) pode usar `uploadCampaignInputImage`/`removeCampaignInputs` e `createCampaign(campaignId)`
- Próximo: 41-07 (form hook multi) e 41-06 (rota D5/D10)
- Sem migrations; typecheck e suítes verdes

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
