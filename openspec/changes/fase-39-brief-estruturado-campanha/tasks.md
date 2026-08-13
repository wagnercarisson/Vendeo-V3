## 1. Trackings — Renumeração F39/F40 (D1 runbook)

- [ ] 1.1 `ROADMAP.md` (raiz): linha 39 → "Brief Estruturado de Campanha | v1.5 | 0/0 | ○ Pending"; adicionar linha 40 → "Stripe / Monetização Pública | v1.7 | 0/0 | ○ Pending"; menções "F39 (Stripe)" → "Stripe (F40)"; bullet da F39 no `<details open>` do v1.5 — D1
- [ ] 1.2 `.planning/ROADMAP.md`: nota "Phase numbering" (linha 7) com F39 = Brief/F40 = Stripe; tabela Progress; notas de renumeração (~405/466); menções "Phase 39 (Stripe)" em Dependencies (~570/616/644/661) → F40; Dependency Graph (~734); seção "### Phase 39 — Brief Estruturado de Campanha"; rodapé "Last updated" — D1
- [ ] 1.3 `.planning/STATE.md`: `current_phase: 39` + status; tabela "Next Phases" (F39 in progress, F40 future renumerada); corpo "Current Position" + "Last updated" — D1
- [ ] 1.4 `.planning/PROJECT.md`: "Stripe... F39" → **F40** (linha 48); rodapé "Last updated" — D1
- [ ] 1.5 `.planning/REQUIREMENTS.md`: seção v1.7 "Stripe... F39/v1.7" → **F40/v1.7** (~563-565) — D1
- [ ] 1.6 `.planning/MILESTONES.md`: "diferido para v1.7 (F39)" → **(F40)** (linha 20) — D1

## 2. Contrato de domínio — CampaignBrief (brief.ts + brief-schema.ts)

- [ ] 2.1 `src/lib/campaign/brief.ts`: constantes `CampaignBriefSchemaVersion = "campaign_brief_v1"`, `CampaignBriefSource = "web_form" | "api"`, `ProductSource = "manual" | "catalog"`, `CampaignImageRole` (`primary|variation|combo_item|reference`), `CampaignImageSource` (`upload|camera`) — D3/D6/D7
- [ ] 2.2 `src/lib/campaign/brief.ts`: interfaces `CampaignProductImageInput` (runtime com `dataUrl?`) e `CampaignBriefSnapshotImage` (snapshot sem `dataUrl` por construção, `provided: true`, reservados `storagePath?`/`productAssetId?`) — D6/D7
- [ ] 2.3 `src/lib/campaign/brief.ts`: `CampaignBriefProduct` (`source`, `catalogProductId?`, `name`, `brand?`, `sizeOrVariant?`, `description?`), `CampaignOfferValidity` (`enabled`, `displayText?`, `endDate?`), `CampaignOfferLegalNotice` (`enabled`, `text?`) — D3/D8/D9
- [ ] 2.4 `src/lib/campaign/brief.ts`: `CampaignBriefCommercial` (intent + preços + badge + `validity?` + `legalNotice?` + availabilityNotes + campaignDetails + additionalDetails + campos adormecidos `hook?`/`cta?`/`objective?`/`targetChannel?`/`format?`), `CampaignBriefCreativeContext` (`preserveImageContext?`, `themeId?`, `sensitiveConstraints?`), `CampaignBrief` (product/commercial/media/creativeContext/metadata) — D3/D9/D10/D11
- [ ] 2.5 `src/lib/campaign/brief.ts`: helper `getCampaignLegalNotice(brief)` — leitura direta do campo canônico `commercial.legalNotice` (sem espelho) — D9
- [ ] 2.6 `src/lib/campaign/brief.ts`: `CampaignBriefSnapshot` (schemaVersion no ROOT, product/commercial/media/creativeContext/metadata sem schemaVersion) — D6
- [ ] 2.7 `src/lib/campaign/brief-schema.ts`: zod schemas por domínio (`productSchema`/`commercialSchema`/`mediaSchema`/`creativeContextSchema`/`metadataSchema` + `campaignBriefSchema`), com invariante de **exatamente 1 imagem `primary`** e legalNotice/validity aninhados em commercial (sem seção top-level) — D6/D7/D8/D9
- [ ] 2.8 Garantir `brief.ts` sem `server-only` (contrato compartilhado) — D4

## 3. Rename do wrapper — ResolvedCampaignContext (D4)

- [ ] 3.1 `src/components/campaign/types.ts`: renomear `CampaignBrief` → `ResolvedCampaignContext` mantendo shape `{ campaignInput, store, brandProfile, identity }`; atualizar imports/consumidores — D4
- [ ] 3.2 `src/lib/store-identity-service.ts`: `buildCampaignBrief` passa a retornar `ResolvedCampaignContext`; callers sem quebra — D4
- [ ] 3.3 Verificar que `brand_profile.campaign_brief` (campo do Brand Profiler) permanece inalterado (string) — D4

## 4. Mapper flat → CampaignBrief (fronteira da rota — D5/D11)

- [ ] 4.1 `src/lib/campaign/brief.ts`: implementar `buildCampaignBriefFromFlat(input: GenerateImageRequest, storeId, source = "web_form"): CampaignBrief` — função pura (sem DB) — D5
- [ ] 4.2 Mapear campos equivalentes: `productName`→`product.name`; preços/badge/intent→`commercial.*`; `preserveImageContext`→`creativeContext`; `description`→`product.description`; `availabilityNotes`/`campaignDetails`/`additionalDetails`→`commercial.*`; campos adormecidos mapeados 1:1 com lar canônico: `hook`/`cta`/`objective`/`targetChannel`/`format`→`commercial.*`, `sensitiveConstraints`→`creativeContext` — D5/D11
- [ ] 4.3 `validity` (string) → `commercial.validity = { enabled: true, displayText }`; ausente → campo ausente — D8
- [ ] 4.4 `mandatoryArtworkText` → `commercial.legalNotice = { enabled: true, text }`; ausente → campo ausente — D9
- [ ] 4.5 `productImageDataUrl` + mimeType → `media.images[0]` runtime (`role: "primary"`, `source: "upload"`, `id` uuid, `dataUrl` só no runtime) — D7
- [ ] 4.6 `themeId` presente e `null` no `creativeContext` — D10

## 5. Builder de snapshot versionado (D6)

- [ ] 5.1 `src/lib/campaign/brief.ts`: implementar `buildCampaignBriefSnapshot(brief): CampaignBriefSnapshot` — deriva imagens DO PRÓPRIO brief, remove `dataUrl`, preserva `id`/`role`/`source`/`mimeType`/`provided` — D6/D7
- [ ] 5.2 `schemaVersion: "campaign_brief_v1"` no ROOT do snapshot; `metadata` do snapshot SEM `schemaVersion` (canônico no root; `metadata.schemaVersion` só no runtime) — D6
- [ ] 5.3 Normalização: `validity`/`legalNotice` ausentes no brief → ausentes no snapshot (nunca `enabled: true` fabricado) — D8/D9
- [ ] 5.4 `src/lib/campaign/types.ts`: `InputSnapshot` → `CampaignBriefSnapshot` (versionado) — D6

## 6. Pipeline — costuras de consumo (D11)

- [ ] 6.1 `src/lib/image-generation/services/image-generation-service.ts`: `buildPromptVariables` lê `brief.product`/`brief.commercial`/`brief.media`/`brief.creativeContext` em vez de `body.*`; conjunto de variáveis **idêntico** (regressão por golden test) — D11
- [ ] 6.2 `buildCommercialRepertoire`: decide `validity` por `enabled/displayText` — sem heurística de string (`/`, `até`, `válida`) — D8
- [ ] 6.3 Ponte explícita `media.primary.dataUrl` → provider de imagem E `InputValidationService`/revisor de visão (base64 só em memória/transporte) — D11
- [ ] 6.4 `src/lib/copy/mapper.ts`: `mapBriefToCopyDirectorInput` lê do domínio (`brief.product`/`brief.commercial`); saída `CopyDirectorInput` inalterada; `legalNotice` NÃO entra no copy; `validity.displayText` propagada quando `enabled` — D11/D8/D9
- [ ] 6.5 `src/lib/image-generation/services/image-review-service.ts`: `ImageReviewInput` montado do domínio (productName, storeName, intent, preços, campaignDetails); `legalNotice.text` no review **só quando `enabled === true`**; `validity.displayText` quando habilitada — D11/D9/D8
- [ ] 6.6 Orquestração da rota (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterada** — D11

## 7. Rota — integração do mapper + snapshot (D5/D6)

- [ ] 7.1 `src/app/api/campaign/generate-image/route.ts`: converter flat → `CampaignBrief` na fronteira (único ponto) e passar o brief ao pipeline — D5/D11
- [ ] 7.2 Montar `input_snapshot` via `buildCampaignBriefSnapshot` (versionado `campaign_brief_v1`) — D6
- [ ] 7.3 Regra de borda preservada: `productImageDataUrl` ausente → 400 (imagem obrigatória) — D7

## 8. Testes de contrato (D12)

- [ ] 8.1 `src/lib/campaign/__tests__/brief.test.ts`: brief mínimo válido (`manual`, 1 imagem `primary`, produto nomeado) — D4/D5
- [ ] 8.2 `brief.test.ts`: oferta com preço + validade (`validity.enabled` + `displayText`) — D8
- [ ] 8.3 `brief.test.ts`: `legalNotice.enabled=false` → nada na arte (prompt/copy/review vazios); `enabled=true` + text → texto propaga (compat `mandatoryArtworkText`) — D9
- [ ] 8.4 `brief.test.ts`: sempre existe exatamente 1 `role: "primary"`; rejeição sem imagem (400) — D7
- [ ] 8.5 `brief.test.ts`: `product.source` default `manual`; `catalogProductId` opcional não-apontando tabela — D3
- [ ] 8.6 `brief.test.ts`: `themeId` presente e `null` no contrato — D10
- [ ] 8.7 `src/lib/campaign/__tests__/brief-mapper.test.ts`: round-trip flat→brief preserva campos equivalentes (nome, preços, badge, intent, preserveImageContext) — D5/D11
- [ ] 8.7a `brief-mapper.test.ts`: round-trip flat→brief→snapshot preserva os campos adormecidos no lar canônico (`hook`/`cta`/`objective`/`targetChannel`/`format`→`commercial`, `sensitiveConstraints`→`creativeContext`) — D11
- [ ] 8.7b `brief-mapper.test.ts`: regra canônica de ausência — campos adormecidos não informados ficam **ausentes** (nunca `{ enabled: false }` fabricado para `validity`/`legalNotice`) — D8/D9
- [ ] 8.8 `brief-mapper.test.ts`: `validity` (string) → `displayText`; sem string → ausente; `mandatoryArtworkText` → `legalNotice.text`; ausente → ausente — D8/D9
- [ ] 8.9 `brief-mapper.test.ts`: `productImageDataUrl` → `media.images[0]` runtime com `role`/`source`/mimeType; `dataUrl` fica só no runtime — D7
- [ ] 8.10 `brief-mapper.test.ts`: `buildCampaignBriefSnapshot(brief)` deriva imagens do próprio brief (remove `dataUrl`, preserva id/role/source/mimeType/provided) — D6/D7
- [ ] 8.11 `brief-mapper.test.ts`: snapshot com `schemaVersion` no root, metadata sem `schemaVersion`; legalNotice só dentro de `commercial` — D6
- [ ] 8.12 `src/lib/campaign/__tests__/brief-snapshot.test.ts`: **snapshot nunca contém dataUrl/base64** (varredura recursiva de chaves + por tipo) — D6
- [ ] 8.13 `brief-snapshot.test.ts`: snapshot imutável por construção (serializado uma vez; catálogo futuro não o altera) — D3
- [ ] 8.14 `brief-mapper.test.ts`: compat payload atual (benchmark scenarios) → mesmo brief equivalente — D5/D11
- [ ] 8.15 `brief.test.ts`: teste de clareza `metadata.schemaVersion` — existe no runtime, NÃO no snapshot (ninguém assume o contrário) — D6
- [ ] 8.16 Mappers de consumo: `buildPromptVariables` com brief estruturado produz MESMO conjunto de variáveis que o flat para o mesmo input — D11
- [ ] 8.17 `buildCommercialRepertoire` decide por `validity.enabled/displayText` (não heurística) — D8
- [ ] 8.18 provider/input-validation recebe `media.primary.dataUrl` (base64 em memória; snapshot nunca expõe) — D11
- [ ] 8.19 `mapBriefToCopyDirectorInput` lê do domínio e mantém `CopyDirectorInput` equivalente — D11
- [ ] 8.20 `ImageReviewInput` montado do domínio (productName, storeName, intent, preços, legalNotice, campaignDetails); revisor recebe legalNotice quando `enabled=true`, não quando `false`; validity quando habilitada — D11/D9/D8
- [ ] 8.21 `ResolvedCampaignContext` mantém o shape consumido pelo pipeline; `buildCampaignBrief` retorna `ResolvedCampaignContext` sem quebrar callers — D4

## 9. Regressão e co-migração de fixtures (D5/D11/D12)

- [ ] 9.1 Atualizar fixtures de `route.test.ts` (dezenas de `mockResolvedValue({ campaignInput: {}, store: {} })`) para o novo fluxo flat→brief — D5
- [ ] 9.2 Atualizar fixtures de `image-generation-service.test.ts` e `image-review-service.test.ts` (briefs passam a ser estruturados) — D5
- [ ] 9.3 Atualizar `scripts/benchmark.ts` para montar o brief estruturado via mapper (payload flat mantido) — D5
- [ ] 9.4 Golden tests por intent (offer/spotlight/exclusive): prompts finais idênticos aos atuais — D11

## 10. Verificação

- [ ] 10.1 `npx vitest run` — novos + existentes passando (incluindo migrados) — D12
- [ ] 10.2 `npm run typecheck` — zero erros
- [ ] 10.3 `npm run lint` — zero erros
- [ ] 10.4 `npm run build` — build bem-sucedido
- [ ] 10.5 UAT local: gerar campanha offer/spotlight/exclusive pelo form → resultado idêntico ao atual; snapshot exibe estrutura versionada no admin/DB; aviso ilustrativo desmarcado → arte sem o texto; validade na arte quando esperado; campanha antiga (pré-F39) continua exibindo/baixando normalmente — D2/D6/D8/D9
