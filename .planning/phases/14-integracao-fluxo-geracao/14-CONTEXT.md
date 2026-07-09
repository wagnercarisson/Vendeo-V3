# Phase 14: Integração no Fluxo de Geração — Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Source:** OpenSpec change (`openspec/changes/fase-14-integracao-fluxo-geracao/`)

<domain>
## Phase Boundary

Modificar o fluxo de geração (`generate-image`) para salvar a campanha pós-renderização: orquestrar `createCampaign` → IA → `dataUrlToCampaignImage` → `transcodeToJpeg` → `uploadCampaignImage` → `updateCampaignReady`, com compensação via `updateCampaignError` + `deleteCampaignImage` em falha. Ajustar o consumer no cliente para navegar para `/campanha/[id]` em vez de `/campaign/preview`.

Depende da Fase 13: `types.ts`, `persistence.ts` (7 helpers), e rota de download.
</domain>

<decisions>
## Implementation Decisions

### D1 — JPEG canônico (.jpg) vigente (reforço)

O artifacto da milestone menciona `{storeId}/{campaignId}.png`, mas F13 já consolidou JPEG como formato canônico. `uploadCampaignImage` só aceita `image/jpeg`. A F14 reforça com transcodificação PNG/WEBP → JPEG sRGB q90 1080×1080 em `transcodeToJpeg`.

### D2 — Transcodificação com sharp

O provider de IA pode devolver PNG ou WEBP. `dataUrlToCampaignImage` parser extrai o buffer sem transcodificar. `uploadCampaignImage` só aceita `image/jpeg`. Sharp é o padrão da indústria, performático (<50ms para 1080×1080), compatível com Node.js/Vercel.

Pipeline:
```
dataUrl da IA (PNG/WEBP) → dataUrlToCampaignImage(dataUrl) → transcodeToJpeg(buffer, mimeType) → uploadCampaignImage(storeId, id, { buffer: jpegBuffer, mimeType: "image/jpeg" })
```

### D3 — `publication_copy_snapshot` realinhado para shape da milestone

O shape atual (title, subtitle, hook, cta, badgeText, priceDisplay) reflete dados da arte, não da publicação. O shape correto da milestone é o "kit de publicação": caption, hashtags, cta_post (snake_case no JSONB).

### D4 — `sessionStorage` mantido para rascunho, removido como fonte de verdade

| Uso | Decisão |
|-----|---------|
| `campaign_preview` (pós-geração) | Remover — campanha está no banco |
| `campaign_draft_image` (rascunho) | Manter — imagem do produto antes do submit |
| `useInputPreservation` | Manter — rascunho dos campos de texto |

### D5 — Result NDJSON só após persistência completa

Ordem: 1. INSERT generating → 2. Geração IA → 3. dataUrlToCampaignImage → 4. transcodeToJpeg → 5. uploadCampaignImage → 6. updateCampaignReady → 7. emitir NDJSON com campaignId/campaignUrl

Política de compensação:
- Upload falha: apenas `updateCampaignError` — não há imagem para deletar
- UpdateReady falha (upload OK): `deleteCampaignImage` + `updateCampaignError`

### D6 — `export const runtime = "nodejs"` explícito

Sharp é incompatível com Edge Runtime. A declaração explícita previne regressão futura.

### D7 — Metadados de geração montados no handler

O handler usa `provider.name` da mesma instância do provider criada para `ImageGenerationService`, o modelo (`IMAGE_GENERATION_RESPONSES_MODEL`), mede `durationMs` com `performance.now()`, e extrai `corrections` de `result.inputCorrections`. Não modifica o `ImageGenerationService`.

### D8 — Validação + conflito ANTES do INSERT

Validação de input e detecção de conflito (via `InputValidationService`) ocorrem antes do INSERT. Não queremos persistir tentativas inválidas.

### D9 — `generation_metadata no JSONB usa camelCase

Consistente com a interface `GenerationMetadata` em `types.ts` (durationMs, generatedAt). O JSONB armazena como blob — snake_case vs camelCase é irrelevante para o banco.

### D10 — Três planos de execução sequenciais

| Plano | O quê |
|-------|-------|
| **14-01** | Image processor + publication copy |
| **14-02** | Orquestração em generate-image |
| **14-03** | Consumer no cliente |

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 — Serviço de Persistência
- `.planning/phases/13-servico-persistencia-download/13-CONTEXT.md` — Context and decisions
- `.planning/phases/13-servico-persistencia-download/13-01-PLAN.md` — Types & Persistence Service
- `src/lib/campaign/types.ts` — Current types (PublicationCopySnapshot needs realignment)
- `src/lib/campaign/persistence.ts` — 7 helpers (createCampaign, dataUrlToCampaignImage, uploadCampaignImage, updateCampaignReady, updateCampaignError, getCampaign, deleteCampaignImage)

### Route handler (generate-image)
- `src/app/api/campaign/generate-image/route.ts` — Current NDJSON streaming route (needs orchestration changes)

### Client consumer
- `src/components/flow/use-campaign-form.ts` — Current form hook (needs navigation change)

### OpenSpec change artifacts (source of truth)
- `openspec/changes/fase-14-integracao-fluxo-geracao/proposal.md` — Why, What Changes, Impact
- `openspec/changes/fase-14-integracao-fluxo-geracao/design.md` — Goals, Non-Goals, Decisions D1-D10
- `openspec/changes/fase-14-integracao-fluxo-geracao/tasks.md` — Task breakdown per plan
- `openspec/changes/fase-14-integracao-fluxo-geracao/specs/campaign-image-processor/spec.md` — transcodeToJpeg + buildPublicationCopySnapshot spec
- `openspec/changes/fase-14-integracao-fluxo-geracao/specs/campaign-persistence-service/spec.md` — Orchestration pipeline spec
- `openspec/changes/fase-14-integracao-fluxo-geracao/specs/campaign-generation-navigation/spec.md` — Client navigation spec
- `openspec/changes/fase-14-integracao-fluxo-geracao/specs/campaign-types/spec.md` — PublicationCopySnapshot realignment specs

### Auth patterns
- `src/lib/auth/api-handler.ts` — `apiHandler` wrapper
- `src/lib/auth/require-user.ts` — `requireApiUser()`
- `src/lib/auth/store-ownership.ts` — `requireOwnership()`
- `src/lib/auth/csrf.ts` — `requireSameOrigin()`

### Image generation config
- `src/lib/image-generation/config.ts` — `IMAGE_GENERATION_RESPONSES_MODEL`, timeouts

</canonical_refs>

<specifics>
## Specific Ideas

### image-processor.ts (new)
- `transcodeToJpeg(buffer, mimeType)` — sharp: PNG/WEBP/JPEG → JPEG sRGB q90 1080×1080, `fit=contain`, background `#FFFFFF`, retorna `{ buffer, mimeType: "image/jpeg" }`
- `buildPublicationCopySnapshot(data)` — retorna `{ caption, hashtags, cta_post }`

### types.ts (modified)
- `PublicationCopySnapshot` realinhado: `caption: string`, `hashtags: string[]`, `cta_post: string`
- Remover: `title`, `subtitle?`, `hook`, `cta`, `badgeText`, `priceDisplay`

### generate-image/route.ts (modified)
- `export const runtime = "nodejs"`
- Pipeline: INSERT generating → IA → transcode → upload → updateReady → NDJSON estendido
- `createCampaign` após auth/ownership/identity/validação
- NDJSON: `{ type: "result", campaignId, campaignUrl }` onde campaignUrl = `/campanha/${campaignId}`
- Erro IA/transcode/upload: `updateCampaignError`
- Erro updateReady após upload OK: `deleteCampaignImage` + `updateCampaignError`

### use-campaign-form.ts (modified)
- Remover gravação `campaign_preview` em sessionStorage
- Navegar para `campaignUrl` via `router.push`
- Manter `campaign_draft_image` e `useInputPreservation`

### Testes
- `src/__tests__/lib/campaign/processor.test.ts` — 6 cenários (4 transcode + 2 buildPublicationCopySnapshot)
- `src/__tests__/api/campaign-generate.test.ts` — 6 cenários (sucesso, erro IA, erro upload, erro updateReady, sem auth, ownership mismatch)

</specifics>

<deferred>
## Deferred Ideas

- Página `/campanha/[id]` — Fase 15
- Página `/minhas-campanhas` + limpeza — Fase 16
- Edição publication copy — Fase 6 condicional (pós-v1.3)
- Fallback de signed URL via blob proxy — documentado na F13, não implementado
- Cleanup de `generating` stale — futuro
- Geração de tipos com `supabase gen types` — pós-F14
- Remoção física de `/campaign/preview` — Fase 15 (pode virar redirect)
- Stub `/campanha/[id]` para evitar 404 temporário — a decidir com o time

</deferred>

---

*Phase: 14-integracao-fluxo-geracao*
*Context gathered: 2026-07-09 via OpenSpec change (fase-14-integracao-fluxo-geracao)*