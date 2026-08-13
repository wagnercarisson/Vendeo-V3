# Phase 39: Brief Estruturado de Campanha — Context

**Gathered:** 2026-08-13
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-39-brief-estruturado-campanha/`)

<domain>
## Phase Boundary

O Vendeo recebe o input da campanha como payload **flat de 21 campos** (`GenerateImageRequestSchema`, zod `.strict()`, `src/lib/image-generation/schema.ts:8-37`), resolve a identidade da loja no backend e passa um wrapper de transporte (`CampaignBrief` atual em `src/components/campaign/types.ts:37`) direto ao pipeline paralelo. O `input_snapshot` é um `Record<string, unknown>` **flat e sem versionamento**, e existem **três conceitos diferentes de "brief"** no código — colisão de nomeação que bloqueia a F37 (revisão/aprovação), catálogo de produtos, múltiplas imagens e câmera.

**Estado real verificado em código:**
- `GenerateImageRequestSchema` — 21 campos flat `.strict()` (`src/lib/image-generation/schema.ts:8-39`); `GenerateImageRequest = z.infer` em `schema.ts:39`. Campos obrigatórios: `storeId` (uuid), `productName`, `productImageDataUrl` (min 1). ~11 campos "adormecidos" (sem UI): `hook`/`cta`/`objective`/`targetChannel`/`format`/`validity`/`availabilityNotes`/`sensitiveConstraints` existem no schema **e nos prompts**
- `CampaignBrief` (wrapper de transporte) em `src/components/campaign/types.ts:37-55` — shape `{ campaignInput, store, brandProfile, identity }`; `CampaignInput = Omit<GenerateImageRequest, 'storeId'>` (`types.ts:35`); `BrandProfileSnapshot` (`types.ts:7-15`)
- `buildCampaignBrief` em `src/lib/store-identity-service.ts:203-228` — `(snapshot, campaignInput) => Promise<CampaignBrief>`; re-exportado como server action `src/lib/actions/store.ts:17`
- A rota monta o snapshot flat manualmente: `route.ts:357-380` grava `input_snapshot` com 20 chaves + `productImage: { provided: true, mimeType: "image/jpeg" }` — o `productImageDataUrl` **já não entra no snapshot**; `createCampaign` em `route.ts:382-387`
- Pipeline lê o corpo flat: `const body = brief.campaignInput as GenerateImageRequest` (`image-generation-service.ts:95` e `:585`); ~20 leituras `body.*` em `buildPromptVariables` (`:864-916` → 38 variáveis), `buildCommercialRepertoire` (`:704-759` — heurística de validade `/`,`até`,`válida` em `:726-732`), montagem do `ImageReviewInput` (`:382-397`), `validatePrompts` (`:605-620`)
- `mapBriefToCopyDirectorInput` (`src/lib/copy/mapper.ts:91-115`) lê `brief.campaignInput.*`/`brief.store.*`/`brief.brandProfile?.*` → `CopyDirectorInput` (`copy/schema.ts:3-21`)
- Revisor: `ImageReviewInput` (`image-review-service.ts:9-21`) montado com `mandatoryArtworkText`/`campaignDetails`/`additionalDetails` (fix `260804-s16` diretor↔revisor mantido)
- `InputSnapshot` (`src/lib/campaign/types.ts:38-58`) — 20 campos, **sem nenhum import em src/** (tipo desatualizado vs. objeto real na rota)
- `supabase/migrations/` — **nenhuma migration *brief*/campaign_brief** (79 arquivos .sql; últimos F38.x)

**O que esta fase entrega:**
- **Novo `CampaignBrief` de domínio estruturado** — `src/lib/campaign/brief.ts` + `src/lib/campaign/brief-schema.ts`: `product` (dados estáveis do produto, separado da oferta — D3), `commercial` (preços, validade, aviso legal, disponibilidade — D8/D9), `media` (imagens com role/source — D7), `creativeContext` (`preserveImageContext`, `themeId?` reservado — D10), `metadata` (source + schemaVersion). Zod por domínio. `brief.ts` **sem server-only** (D4 — contrato compartilhado)
- **Rename do wrapper atual → `ResolvedCampaignContext`** (`src/components/campaign/types.ts`, `src/lib/store-identity-service.ts`) — elimina a colisão de nomeação (D4); `buildCampaignBrief` retorna `ResolvedCampaignContext` mantendo shape
- **Mapper `buildCampaignBriefFromFlat` na fronteira da rota** (`POST /api/campaign/generate-image`) — form continua flat (Opção 1, D5); conversão única na rota; campos adormecidos com lar canônico 1:1 (`hook`/`cta`/`objective`/`targetChannel`/`format`→commercial, `sensitiveConstraints`→creativeContext); regra de ausência (campo não informado → ausente, nunca `{ enabled: false }` fabricado); sem imagem → 400
- **Snapshot versionado `campaign_brief_v1`** — `input_snapshot` estruturado com `schemaVersion` no ROOT, seções por domínio; **nunca contém base64** (por tipo `CampaignBriefSnapshotImage` sem `dataUrl` + teste de varredura); `InputSnapshot` → `CampaignBriefSnapshot`; builder `buildCampaignBriefSnapshot` deriva imagens do próprio brief (D6/D7)
- **Contrato de mídia `media.images[]`** com `id`/`role`/`source`/`mimeType`/`dataUrl?` (só runtime); invariante de **exatamente 1 imagem `primary`**; nesta fase 1 imagem via `productImageDataUrl` (D7)
- **`commercial.validity { enabled, displayText?, endDate? }`** — substitui a heurística frágil de string (`/`, `até`, `válida`) no `buildCommercialRepertoire` (D8)
- **`commercial.legalNotice { enabled, text? }`** — substitui `mandatoryArtworkText` solto; `enabled=false` → nada na arte; campo canônico único em `commercial.legalNotice` (helper `getCampaignLegalNotice(brief)` — D9)
- **`creativeContext.themeId?: string | null`** reservado — nenhum sistema de temas (D10)
- **5 costuras de mappers + builder de snapshot** — ① flat→brief na rota; ② brief→prompts (`buildPromptVariables`/`buildCommercialRepertoire` — variáveis **idênticas**); ③ brief→provider/input-validation (`media.primary.dataUrl`, base64 só em memória); ④ brief→copy (`mapBriefToCopyDirectorInput`); ⑤ brief→review (`ImageReviewInput`); ⑥ `buildCampaignBriefSnapshot`. **Comportamento de geração preservado** (golden tests por intent). **Orquestração da rota inalterada** (D11)
- **Testes de contrato** — brief mínimo, oferta+validade, aviso on/off, imagem primary, rejeição sem imagem, snapshot sem base64, round-trip flat→brief→snapshot, ponte provider, mappers preservam comportamento, compat benchmark (D12)

## Constraints

- **NENHUMA migration SQL** nesta fase (D6) — `input_snapshot` continua `jsonb` tolerante; validação no TS + testes de contrato; se a F37 exigir CHECK, entra lá (padrão F38.2.1)
- **Form não muda** — continua enviando payload flat (Opção 1, D5); `GenerateImageRequestSchema` HTTP **inalterado**
- **Sem catálogo de produtos por loja** (D3) — `source: "catalog"`/`catalogProductId?` são contrato **reservado**; `source: "manual"` é o único produzido
- **Sem múltiplas imagens na UI, sem câmera** (D7) — contrato pronto, implementação em fase própria
- **Sem revisão pré-geração / aprovação (F37)** nem **CRUD de temas** (D10) — F37 é a próxima fase e consome o snapshot
- **Sem refatoração grande da rota** (D11) — só a camada de input muda de shape; orquestração (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) inalterada
- **`metadata.schemaVersion` existe apenas no brief runtime** — canônico no ROOT do snapshot; sem duplicação (D6)
- **Base64 nunca entra no snapshot** — garantido por tipo (`CampaignBriefSnapshotImage` sem `dataUrl`) e por teste (varredura recursiva)
- **`legalNotice` e `validity` vivem apenas dentro de `commercial`** — sem seção top-level, sem espelho; leitura via helper
- Regra de ausência: campo não informado → ausente (nunca `{ enabled: false }` fabricado)
- `brief.ts` e `brief-schema.ts` **sem `server-only`** (contrato compartilhado cliente/servidor — D4)

## Dependencies

- F24 (pipeline de créditos), F31.1–F31.3 (intents, prompts, diretores, revisor, quality gate)
- F38.2.1 (Snapshot Econômico — padrão de snapshot imutável a replicar; precedente de invariante)
- 38.2.1 = precedente de snapshot imutável: mesma filosofia de `identity_snapshot`/`render_snapshot`/snapshot econômico F38.2.1
- **Antecede a F37** (Revisão e Aprovação da Arte — consome o snapshot versionado desta fase). Os 3 conceitos de "brief" (domínio novo, wrapper renomeado, `brand_profile.campaign_brief`) ficam distintos
- **F40 (Stripe)** também renumerada (D1): F39 = Brief (v1.5), Stripe → F40 (v1.7)

## Key Requirements

- F39-01: `CampaignBrief` domínio estruturado (brief.ts sem server-only) — product/commercial/media/creativeContext/metadata
- F39-02: `CampaignBriefProduct` com origem (`manual` default) + `catalogProductId?` reservado (catálogo subsequente)
- F39-03: `CampaignProductImageInput` runtime com `dataUrl?` (base64 só em memória/transporte)
- F39-04: `CampaignBriefCommercial` com domínios semânticos + campos adormecidos com lar canônico 1:1
- F39-05: `CampaignOfferValidity { enabled, displayText?, endDate? }` — decisão por `enabled/displayText`, sem heurística
- F39-06: `CampaignOfferLegalNotice { enabled, text? }` canônico em commercial + helper `getCampaignLegalNotice`
- F39-07: `CampaignBriefCreativeContext` com `themeId?` reservado (sempre null) + `sensitiveConstraints`
- F39-08: Invariante de exatamente 1 imagem `primary` (zod) + regra de borda sem imagem → 400
- F39-09: Mapper `buildCampaignBriefFromFlat` (função pura) na fronteira da rota — round-trip preservando campos
- F39-10: Rename wrapper → `ResolvedCampaignContext` (D4) sem quebra de callers
- F39-11: Snapshot `campaign_brief_v1` versionado — `schemaVersion` no ROOT, seções por domínio, metadata do snapshot SEM schemaVersion
- F39-12: `CampaignBriefSnapshotImage` sem `dataUrl` por tipo + teste de varredura recursiva (nunca base64)
- F39-13: Builder `buildCampaignBriefSnapshot` deriva imagens do próprio brief; snapshot imutável por construção
- F39-14: `InputSnapshot` → `CampaignBriefSnapshot` (versionado)
- F39-15: Costura ② brief→prompts — `buildPromptVariables`/`buildCommercialRepertoire` do domínio; conjunto de variáveis **idêntico** (golden tests por intent)
- F39-16: Costura ③ ponte `media.primary.dataUrl` → provider de imagem + InputValidationService/revisor
- F39-17: Costura ④ `mapBriefToCopyDirectorInput` lê do domínio; saída `CopyDirectorInput` inalterada; `legalNotice` NÃO entra no copy; `validity.displayText` propagada quando enabled
- F39-18: Costura ⑤ `ImageReviewInput` montado do domínio — legalNotice/validity só quando habilitados
- F39-19: Comportamento de geração preservado (golden tests por intent offer/spotlight/exclusive) + orquestração da rota inalterada
- F39-20: Testes de contrato (~34+) + co-migração de fixtures (`route.test.ts`, `image-generation-service.test.ts`, `image-review-service.test.ts`, `scripts/benchmark.ts`) + gates verdes (`npx vitest run`, typecheck, lint, build)
- F39-21: Trackings D1 (renumeração F39/F40 nos 6 arquivos: ROADMAP raiz, `.planning/ROADMAP.md`, STATE, PROJECT, REQUIREMENTS, MILESTONES)

## Out of Scope

- Catálogo de produtos por loja (persistência, storage, CRUD, reuso, edição, histórico) — fase subsequente que consumirá este contrato (D3)
- Múltiplas imagens completas na UI e captura de câmera (D7)
- Revisão pré-geração / aprovação pós-geração (F37) e regeração com imagem original (dependerá de asset persistido na F37 — D2)
- CRUD de temas / direção visual de tema / `themeSnapshot` (D10)
- Migração do form para payload estruturado (D5 — Opção 1 mantém flat)
- CHECK no banco para `schemaVersion` (D6 — JSONB tolerante + validação TS/testes)
- Pacotes de crédito / precificação pública (F40/Stripe)
- Qualquer migration SQL
</domain>

<decisions>
## Implementation Decisions

### D1 — Numeração: F39 = Brief, Stripe → F40 + runbook de trackings
`DECIDIDO` (Q&A — precedente F37 D11). F39 = Brief Estruturado de Campanha (v1.5); Stripe/Monetização Pública → F40 (v1.7). Runbook de atualização em 6 arquivos (`ROADMAP` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) na ordem da D1. Artefatos históricos não reescritos; `openspec/changes/fase-39-brief-estruturado-campanha/` = fonte da verdade.

### D2 — Sequenciamento: v1.5, antes da F37
`DECIDIDO`. F39 entra antes da F37 (Revisão/Aprovação). F37 consome o snapshot estruturado para pré-revisão/aprovação e reconstrói brief semântico. Ressalva: snapshot sem base64 — regeração fiel pode depender de asset persistido (F37).

### D3 — Produto separado de Oferta (catálogo = fase subsequente)
`DECIDIDO`. `product` (source/catalogProductId?/name/brand?/sizeOrVariant?/description?) ≠ `commercial` (preços/validade/aviso/disponibilidade/badge). `source: "manual"` única produzida; `"catalog"` reservado. Campanha sempre armazena snapshot do produto/oferta da geração — nunca depende do produto "vivo".

### D4 — Novo `CampaignBrief` (domínio) + rename do wrapper → `ResolvedCampaignContext`
`DECIDIDO`. `CampaignBrief` = domínio estruturado (novo, `src/lib/campaign/brief.ts`); wrapper de transporte `CampaignBrief` → `ResolvedCampaignContext`; `brand_profile.campaign_brief` inalterado. `buildCampaignBrief` retorna `ResolvedCampaignContext` com mesmo shape (teste de contrato).

### D5 — Opção 1: transporte flat mantido, mapper na fronteira da rota
`DECIDIDO`. Form continua flat; rota converte uma vez via `buildCampaignBriefFromFlat`. Sem contrato duplo eterno (flat = transporte, brief = domínio). Co-migração de testes na mesma fase. Regra de borda: sem `productImageDataUrl` → 400.

### D6 — Snapshot versionado `campaign_brief_v1`
`DECIDIDO`. `schemaVersion` canônico no ROOT; `metadata.schemaVersion` só no runtime. `CampaignBriefSnapshotImage` ≠ `CampaignProductImageInput` (snapshot sem dataUrl por construção). Sem CHECK no banco. Dois tipos de imagem por construção.

### D7 — Contrato de mídia `media.images[]` com role/source
`DECIDIDO`. `id` uuid + `role` (`primary|variation|combo_item|reference`) + `source` (`upload|camera`) + `mimeType` + `dataUrl?` (só transporte). Invariante: exatamente 1 `primary`. Nesta fase 1 imagem upload.

### D8 — Validade estruturada `commercial.validity { enabled, displayText?, endDate? }`
`DECIDIDO`. Substitui heurística de string. Ausente quando não informado (nunca `enabled: false` fabricado). `endDate` reservado.

### D9 — Aviso ilustrativo estruturado `commercial.legalNotice { enabled, text? }`
`DECIDIDO`. `enabled=false` → nada na arte (nem prompt, nem revisão). `mandatoryArtworkText` → `legalNotice.text` com `enabled: true`. Campo canônico único + helper `getCampaignLegalNotice(brief)` — sem espelho.

### D10 — Preparação para temas: `creativeContext.themeId?` reservado
`DECIDIDO`. `themeId?: string | null` sempre `null` nesta fase. Nenhum sistema de temas.

### D11 — Mappers para o pipeline (5 costuras + builder de snapshot)
`DECIDIDO`. ① flat→brief (rota); ② brief→prompts (`buildPromptVariables`/`buildCommercialRepertoire` — variáveis idênticas, regressão por golden test); ③ brief→provider/input-validation (`media.primary.dataUrl`); ④ brief→copy (`mapBriefToCopyDirectorInput`); ⑤ brief→review (`ImageReviewInput`); ⑥ `buildCampaignBriefSnapshot` (deriva do próprio brief). Orquestração da rota inalterada.

### D12 — Testes de contrato
`DECIDIDO`. Cobertura mínima (~34+ testes): brief mínimo; oferta+validade; aviso on/off; 1 imagem primary; rejeição sem imagem; snapshot nunca contém base64 (por tipo + varredura); round-trip flat→brief→snapshot; ponte provider com `media.primary.dataUrl`; mappers preservam comportamento; compat benchmark; `metadata.schemaVersion` só no runtime.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte da verdade (OpenSpec F39)
- `openspec/changes/fase-39-brief-estruturado-campanha/proposal.md` — What Changes / Impact
- `openspec/changes/fase-39-brief-estruturado-campanha/design.md` — decisões D1–D12 (contexto real em código nas linhas 5-16)
- `openspec/changes/fase-39-brief-estruturado-campanha/tasks.md` — 10 seções de tarefas (1 trackings … 10 verificação)
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/campaign-brief-contract/spec.md` — contract (9 requirements)
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/campaign-brief-mapper/spec.md` — mapper + rename + borda 400
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/campaign-brief-snapshot/spec.md` — snapshot versionado + sem base64
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/campaign-brief-pipeline-adapters/spec.md` — 4 costuras de consumo
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/transactional-pipeline/spec.md` — copy mapper do domínio
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/mandatory-artwork-text/spec.md` — legalNotice (D9) compat
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/image-quality-review/spec.md` — ImageReviewInput do domínio
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/ai-image-generation/spec.md` — buildPromptVariables/repertoire do domínio
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/campaign-types/spec.md` — InputSnapshot → CampaignBriefSnapshot
- `openspec/changes/fase-39-brief-estruturado-campanha/specs/identity-aware-campaign-briefing/spec.md` — ResolvedCampaignContext (D4)

### Código afetado (estado real verificado)
- `src/lib/image-generation/schema.ts` — `GenerateImageRequestSchema` (21 campos flat, linhas 8-39)
- `src/components/campaign/types.ts` — `CampaignBrief` wrapper (37-55), `CampaignInput` (35), `BrandProfileSnapshot` (7-15)
- `src/lib/store-identity-service.ts` — `buildCampaignBrief` (203-228) → retornará `ResolvedCampaignContext`
- `src/app/api/campaign/generate-image/route.ts` — validação (137-154), mocks + snapshot flat manual (357-380), orquestração (47-844), `buildCampaignBrief` (241)
- `src/lib/image-generation/services/image-generation-service.ts` — `body = brief.campaignInput` (95, 585), `buildPromptVariables` (843-938), `buildCommercialRepertoire` (704-759), `ImageReviewInput` (382-397)
- `src/lib/copy/mapper.ts` — `mapBriefToCopyDirectorInput` (91-115)
- `src/lib/image-generation/services/image-review-service.ts` — `ImageReviewInput` (9-21)
- `src/lib/campaign/types.ts` — `InputSnapshot` (38-58)
- `src/lib/campaign/persistence.ts` — `createCampaign` (CreateCampaignInput com snapshot)
- `src/lib/actions/store.ts` — re-export `buildCampaignBrief`
- Testes: `src/app/api/campaign/generate-image/__tests__/route.test.ts`, `src/lib/image-generation/services/__tests__/image-generation-service.test.ts`, `.../image-review-service.test.ts`, `src/lib/actions/__tests__/store.test.ts`
- `scripts/benchmark.ts` — monta brief flat (332-369) com cast `as any` (375)

### Precedentes de snapshot imutável
- `.planning/phases/38.2.1-economic-snapshot/` — snapshot econômico imutável por construção (padrão F38.2.1)
- `.planning/phases/fase-39-brief-estruturado-campanha/../38-1-ai-cost-accounting/` — custos por entrega (call-level)
</canonical_refs>

<specifics>
## Specific Ideas

- **D11 diagrama (design.md:186-196):** flat → mapper#1 → CampaignBrief → #{2 prompts, 3 provider/input-validation, 4 copy (mapBriefToCopyDirectorInput), 5 review (ImageReviewInput), builder snapshot}
- **Serias de prompt idênticas** — `buildPromptVariables` (38 variáveis) com brief estruturado produz **exatamente** o mesmo conjunto que com o flat; golden tests por intent offer/spotlight/exclusive
- **`commercialFrame`** — regra atual: `campaignIntent !== "offer" ? "QUADRO:" : preços (DE/POR) + badge + validade quando disponível`; decisão por `validity.enabled/displayText` sem heurística
- **Regra de ausência (canônica):** campo não informado no transporte → ausente no contrato e no snapshot. `validity`/`legalNotice` sem valor → campo `undefined`/ausente, NUNCA `{ enabled: false }`.
- **`preserveImageContext`** — normalizado para `false`/omitido quando `campaignIntent === "offer"` (regra existente na rota `route.ts:376-378`)
- **mimeType** — snapshot atual grava `image/jpeg` fixo; manter `mimeType: "image/jpeg"` no mapper (D7)
- **id da imagem** — uuid gerado na montagem do brief; builder de snapshot **deriva do próprio brief** (nunca recebe imagem externa) — evita divergência de id
- **Benchmark** — `scripts/benchmark.ts:375` faz `generateImage(brief as any)`; co-migrar para montar brief estruturado via mapper (payload flat mantido) mas **sem quebrar os cenários** (validity heurística testada no cenário 10 `detalhes-variados`)
</specifics>

<deferred>
## Deferred Ideas

- Catálogo de produtos por loja (fase subsequente que consumirá este contrato) — D3
- Múltiplas imagens na UI + câmera — D7 (contrato pronto, implementação própria)
- Revisão pré-geração / aprovação (F37) — próxima fase; consumo do snapshot
- CRUD de temas / direção visual de tema / themeSnapshot — D10
- Migração do form para payload estruturado — D5
- CHECK no banco para schemaVersion — D6 (se F37 exigir, entra lá)
- Pacotes de crédito / precificação pública — F40/Stripe
</deferred>