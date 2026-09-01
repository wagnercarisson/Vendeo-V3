# Phase 41: Mídia de Campanha Mobile — Verification

**Verificado em:** 2026-08-15
**Fonte da verdade:** `openspec/changes/fase-41-midia-de-campanha-mobile/`
**Context:** `.planning/phases/41-midia-de-campanha-mobile/41-CONTEXT.md`

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **222 files / 2033 tests passed** (F40 base: 1997 → +36 na F41) |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | 0 | Sem erros |
| Lint | `npm run lint` (`eslint .`) | 0 | Sem erros |
| Build | `npm run build` (`next build`) | 0 | "Compiled successfully"; rotas pré-renderizadas OK (campanhas/nova, campanhas/[id]) |

## 2. Matriz Planos × Gates

| Plan | O que construiu | Testes associados | Typecheck | Lint |
|------|-----------------|-------------------|-----------|------|
| 41-01 | Verificação D1 (trackings F41/F42, zero resíduos) | grep (não-vitest) | ✓ | ✓ |
| 41-02 | config D10 + schema transporte `productImages[]` | `f31-2-intent-tests` + regressão ampliada 578/578 | ✓ | ✓ |
| 41-03 | Bloco descritivo 1+N nos 4 prompts | golden 38 keys (25/25) + `prompt-reframe` 4/4 | ✓ | ✓ |
| 41-04 | Domínio multi + persistência D5 (upload/remove inputs) | `brief-mapper`+`brief-snapshot` 21/21, `route.test` 47/47 | ✓ | ✓ |
| 41-05 | Provider N input_image + fallback gated + review com primary | 48/48 (3 arquivos provider/service/review) | ✓ | ✓ |
| 41-06 | Rota D2/D5/D10 (exclusividade 400, limites 413, ordem D5) | `route.test` 47/47 + 3 integração 10/10 | ✓ | ✓ |
| 41-07 | Form hook multi (HEIC/EXIF, body D2, draft multi) | form 29/29 + credits 3/3 | ✓ | ✓ |
| 41-08 | UI upload multi (galeria + câmera + grid + teto) | credits 3/3 | ✓ | ✓ |
| 41-09 | Testes 1-8 (mapper/snapshot) | `brief-mapper` 18/18 + `brief-snapshot` 10/10 | ✓ | ✓ |
| 41-10 | Testes 9-16 (UI/form) | `use-campaign-form-product-images` 9/9 + navigation 6/6 | ✓ | ✓ |
| 41-11 | Testes 17-23 (pipeline/provider/review/prompt) | provider 8/8 + service 27/27 + review 17/17 + prompts 10/10 | ✓ | ✓ |
| 41-12 | Testes 4/24-27 (rota: 400/413/storage/cleanup) | `route.test` 55/55 | ✓ | ✓ |
| 41-13 | Verificação final + UAT (este documento + `41-UAT.md`) | 4 gates verdes | ✓ | ✓ |

## 3. Matriz de Cobertura F41-01..F41-27

| Requisito | Cobertura (plano/teste) |
|-----------|-------------------------|
| F41-01 Form campo primary + seção adicionais | 41-07/41-08 (grid + seção), 41-10 Testes 9-10 |
| F41-02 source upload/camera por item | 41-07 (`addImage` source), 41-10 Teste 11 |
| F41-03 validateImage HEIC + compressImage decode canvas + PT-BR | 41-07 (`validateImage`/`compressImage`), 41-10 Testes 12-13 |
| F41-04 Teto no cliente (MAX_CAMPAIGN_IMAGES) | 41-07 (`addImage` teto), 41-08 (UI desabilita), 41-10 Teste 9 |
| F41-05 State multi productImages (id interno UI) | 41-07 (interface + helpers), 41-10 Testes 9-10 |
| F41-06 Body D2 (productImages[] sem id / legado / nunca ambos) | 41-07 (body), 41-10 Teste 14 |
| F41-07 campaign-image-upload multi + capture | 41-08 (componente), grep capture= |
| F41-08 campaign-input-form primary + seção adicionais | 41-08 (seção) |
| F41-09 Mock CampaignImageUpload credits co-migrado | 41-08 (credits test) |
| F41-10 ProductImageInputSchema + productImages + optional | 41-02 (schema), 41-09 Teste 3 |
| F41-11 MAX_CAMPAIGN_IMAGES=4 + teto agregado | 41-02 (config), 41-12 Testes 24a/24b/24c |
| F41-12 Mapper multi item-a-item + mimeType real | 41-04 (mapper), 41-09 Testes 1/2/5 |
| F41-13 Snapshot copia storagePath + N sem base64 | 41-04 (snapshot), 41-09 Testes 6/7 |
| F41-14 CampaignProductImageInput.storagePath? | 41-04 (tipo), 41-06 (rota preenche) |
| F41-15 createCampaign campaignId? | 41-04 (persistence), 41-12 Teste 25 |
| F41-16 uploadCampaignInputImage + removeCampaignInputs | 41-04 (helpers), 41-06/41-12 Testes 25-26 |
| F41-17 Rota exclusividade + limites + ordem D5 | 41-06 (rota), 41-12 Testes 4/24-27 |
| F41-18 ImageProviderInput.productImagesDataUrls? | 41-05 (types), 41-11 Teste 17 |
| F41-19 N input_image + fallback gated | 41-05 (openai), 41-11 Testes 17-19 |
| F41-20 Ponte mediaImagesDataUrls + provider input | 41-05 (service), 41-11 Teste 20 |
| F41-21 Validação primary-only | 41-06 (rota find role), 41-11 Teste 22, 41-12 Teste 26b |
| F41-22 Review com primary | 41-05 (review), 41-11 Teste 23 |
| F41-23 Bloco 1+N nos 4 prompts | 41-03 (prompts), 41-11 Teste 21 |
| F41-24 Golden EXPECTED_KEYS=38 preservado | 41-03/41-11 Teste 20 (38 keys) |
| F41-25 Testes novos ~32+ | 41-09 (1-8), 41-10 (9-16), 41-11 (17-23), 41-12 (4/24-27) — +36 testes |
| F41-26 Trackings D1 | 41-01 (grep-verificação) |
| F41-27 Verificação + UAT | 41-13 (este documento + `41-UAT.md`) |

## 4. Contagens

- **Testes:** 2033 passing (222 arquivos) — +36 vs F40 (1997)
- **Arquivos novos na F41:** `src/components/flow/__tests__/use-campaign-form-product-images.test.ts`
- **Migrations SQL:** nenhuma (D5 — snapshot `campaign_brief_v1` jsonb tolerante + bucket `campaign-images` existente; sem novas policies)
- **Resíduos "Stripe como F41":** 0 (41-01 — exceto 3 notas históricas legítimas F40 em STATE.md:18/26 e AGENTS.md:83)

---

## 5. Próximo passo

- UAT humana com roteiro em `41-UAT.md` — 6 cenários (inclui **celular real obrigatório** com iOS/HEIC e Android — D4).
