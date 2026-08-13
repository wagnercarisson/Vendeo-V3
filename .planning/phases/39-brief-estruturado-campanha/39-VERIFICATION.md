# Phase 39: Brief Estruturado de Campanha — Verification

**Data:** 2026-08-13
**Status:** TODOS OS GATES VERDES

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **216 files passed (216)** · **1950 tests passed (1950)** · Duration 23.55s |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | 0 | Sem erros |
| Lint | `npm run lint` (`eslint .`) | 0 | Sem erros |
| Build | `npm run build` (`next build`) | 0 | Build completo — rotas/API/Middleware listados; sem erros |

### Associação gates → planos

- **Golden tests por intent (offer/spotlight/exclusive)** — `image-generation-service.test.ts` (8.16/8.17/8.18) verdes no gate 1 → **evidência de F39-15/F39-19** (conjunto de 38 variáveis idêntico, comportamento de geração preservado)
- **Contrato de domínio** — `brief.test.ts` (21 testes), `brief-mapper.test.ts` (14), `brief-snapshot.test.ts` (7) → **evidência de F39-01..F39-14**
- **Copy + review** — `copy-director-service.test.ts` (8.19), `image-review-service.test.ts` (8.20) → **evidência de F39-17/F39-18**
- **Rota + snapshot versionado** — `route.test.ts` (46 testes, test #26 asserta `schemaVersion: 'campaign_brief_v1'` + `commercial.legalNotice`) → **evidência de F39-09/F39-19/F39-20**

---

## 2. Grep Gates (contratos)

| Verificação | Resultado |
|-------------|-----------|
| `server-only` em `brief.ts`/`brief-schema.ts` (import) | ✅ 0 ocorrências (contrato compartilhado, D4) |
| `dataUrl` no tipo `CampaignBriefSnapshotImage` | ✅ ausente por construção (D6/D7/F39-12) |
| `mandatoryArtworkText` como campo de `ImageReviewInput` | ✅ 0 — campo canônico é `legalNoticeText` (D9); nome residual apenas como chave de prompt `mandatoryArtworkTextSection` (placeholder, mantido por design) |
| Heurística de validade (`includes("/")`, `até`, `válida`) em `buildCommercialRepertoire` | ✅ 0 — decisão por `validity.enabled/displayText` (D8) |
| `body = brief.campaignInput as GenerateImageRequest` no serviço | ✅ 0 — serviço 100% domínio (F39-15) |
| `productImage: { provided: true` no route.ts (snapshot flat) | ✅ 0 — substituído por `buildCampaignBriefSnapshot` |
| `@ts-expect-error` em testes de contrato (brief-mapper/snapshot/review) | ✅ 0 — provas por asserts de runtime (`"schemaVersion" in snapshot.metadata`, `"dataUrl" in snapshot.media.images[0]`) |

---

## 3. Matriz de Cobertura F39-01..F39-21

| Requisito | Coberto por | Plano |
|-----------|-------------|-------|
| F39-01 | `CampaignBrief` domínio 5 blocos (brief.ts) + teste 8.1 | 39-02 |
| F39-02 | `CampaignBriefProduct` source manual + catalogProductId reservado + teste 8.5 | 39-02 |
| F39-03 | `CampaignProductImageInput` runtime com dataUrl? | 39-02 |
| F39-04 | `CampaignBriefCommercial` domínios semânticos + adormecidos | 39-02/39-04 |
| F39-05 | `CampaignOfferValidity { enabled, displayText?, endDate? }` + testes 8.2/8.7 | 39-02/39-04 |
| F39-06 | `CampaignOfferLegalNotice` canônico + `getCampaignLegalNotice` + testes 8.3 | 39-02 |
| F39-07 | `CampaignBriefCreativeContext.themeId?` (sempre null) + teste 8.6 | 39-02/39-04 |
| F39-08 | Invariante exatamente-1-primary (superRefine) + testes 8.4 | 39-02 |
| F39-09 | `buildCampaignBriefFromFlat` puro na fronteira + testes round-trip 8.7-8.11/8.14 | 39-04/39-07 |
| F39-10 | Rename `CampaignBrief` → `ResolvedCampaignContext` + teste 8.21 | 39-03 |
| F39-11 | Snapshot `campaign_brief_v1` versionado (schemaVersion ROOT) + teste 8.15 | 39-04 |
| F39-12 | `CampaignBriefSnapshotImage` sem dataUrl por tipo + varredura recursiva 8.12 | 39-02/39-04 |
| F39-13 | `buildCampaignBriefSnapshot` derive-from-own-input + imutabilidade 8.13 | 39-04 |
| F39-14 | `InputSnapshot` → `CampaignBriefSnapshot` | 39-03 |
| F39-15 | `buildPromptVariables` conjunto idêntico (golden 8.16) | 39-06 |
| F39-16 | Ponte `media.primary.dataUrl` → provider/InputValidation (teste 8.18) | 39-06 |
| F39-17 | `mapBriefToCopyDirectorInput` do domínio, legalNotice fora (8.19) | 39-05 |
| F39-18 | `ImageReviewInput` do domínio gated (8.20) | 39-05/39-06 |
| F39-19 | Comportamento de geração preservado (golden por intent + rota inalterada) | 39-06/39-07 |
| F39-20 | Testes de contrato (~49 novos) + co-migração fixtures + gates verdes | 39-02..39-08 |
| F39-21 | Trackings D1 renumeração F39/F40 nos 6 arquivos | 39-01 |

---

## 4. Resumo de Testes Novos por Arquivo

| Arquivo | Testes |
|---------|--------|
| `src/lib/campaign/__tests__/brief.test.ts` | 21 |
| `src/lib/campaign/__tests__/brief-mapper.test.ts` | 14 |
| `src/lib/campaign/__tests__/brief-snapshot.test.ts` | 7 |
| `src/lib/copy/__tests__/copy-director-service.test.ts` (8.19 adicionados) | +4 |
| `src/lib/image-generation/services/__tests__/image-review-service.test.ts` (8.20 adicionados) | +4 |
| `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` (golden 8.16-8.18) | +5 |

**Total geral de testes da suíte:** 1950 (216 files) — crescimento de ~38-49 testes de contrato na fase.

---

## 5. Conclusão

A F39 (Brief Estruturado de Campanha, v1.5) está implementada com:
- Domínio estruturado `CampaignBrief` (product/commercial/media/creativeContext/metadata) compartilhado client/server
- Wrapper renomeado para `ResolvedCampaignContext` (sem quebra de callers)
- Mapper puro `buildCampaignBriefFromFlat` na fronteira + builder versionado `buildCampaignBriefSnapshot` (sem base64)
- Pipeline (prompts/copy/review/snapshot) consumindo o domínio com **comportamento de geração preservado** (golden tests)
- `legalNoticeText` como contrato canônico do `ImageReviewInput` (D9) + `validityText`
- Rota com snapshot versionado `campaign_brief_v1`; sem migration SQL (jsonb tolerante)
- 4 gates verdes: vitest 1950/1950 · typecheck · lint · build

**Verificação manual (UAT) pendente** — ver `39-UAT.md`.
