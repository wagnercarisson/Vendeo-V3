## Context

A Fase 13 estabeleceu 7 helpers atômicos em `persistence.ts`, tipos em `types.ts`, e a rota de download. `generate-image/route.ts` continua operando isolada — faz geração IA, devolve NDJSON com data URL, e o consumer salva em `sessionStorage`.

Esta fase conecta esses dois mundos: o route handler de geração orquestra o pipeline completo de persistência, transformando a campanha efêmera em um registro durável que pode ser revisitado, baixado e listado (F15/F16). O alignment doc definiu 10 decisões de arquitetura (D1–D10) que guiam todo o design.

## Goals / Non-Goals

**Goals:**
- Instalar sharp e criar `src/lib/campaign/image-processor.ts` com `transcodeToJpeg` (dataUrl → JPEG sRGB q90 1080×1080) e `buildPublicationCopySnapshot` (caption, hashtags, cta_post)
- Realinhar `PublicationCopySnapshot` em `types.ts` para o shape da milestone
- Modificar `generate-image/route.ts`: INSERT `generating` antes da IA, transcode + upload + updateReady/Error após geração, NDJSON estendido com `campaignId` + `campaignUrl`
- Declarar `export const runtime = "nodejs"` na rota generate-image
- Ajustar `use-campaign-form.ts` para navegar para `/campanha/[id]` mantendo rascunho do formulário
- Testes do processor (6 cenários) e de integração (6 cenários)
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

**Non-Goals:**
- Página `/campanha/[id]` — Fase 15
- Página `/minhas-campanhas` + limpeza — Fase 16
- Edição publication copy — Fase 6 condicional (pós-v1.3)
- Fallback de signed URL via blob proxy — documentado na F13, não implementado
- Cleanup de `generating` stale — futuro
- Geração de tipos com `supabase gen types` — pós-F14
- Remoção física de `/campaign/preview` — Fase 15 (pode virar redirect)

## Decisions

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
- **Upload falha:** apenas `updateCampaignError` — não há imagem para deletar
- **UpdateReady falha (upload OK):** `deleteCampaignImage` + `updateCampaignError`

### D6 — `export const runtime = "nodejs"` explícito

Sharp é incompatível com Edge Runtime. A declaração explícita previne regressão futura.

### D7 — Metadados de geração montados no handler

O handler usa `provider.name` da mesma instância do provider criada para `ImageGenerationService`, o modelo (`IMAGE_GENERATION_RESPONSES_MODEL`), mede `durationMs` com `performance.now()`, e extrai `corrections` de `result.inputCorrections`. Não modifica o `ImageGenerationService`.

### D8 — Validação + conflito ANTES do INSERT

Validação de input e detecção de conflito (via `InputValidationService`, que chama IA) ocorrem antes do INSERT. Não queremos persistir tentativas inválidas. O custo da validação é baixo comparado à geração de imagem.

### D9 — `generation_metadata` no JSONB usa camelCase

Consistente com a interface `GenerationMetadata` em `types.ts` (durationMs, generatedAt). O JSONB armazena como blob — snake_case vs camelCase é irrelevante para o banco.

### D10 — Três planos de execução sequenciais

| Plano | O quê |
|-------|-------|
| **14-01** | Image processor + publication copy |
| **14-02** | Orquestração em generate-image |
| **14-03** | Consumer no cliente |

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Sharp incompatível com Edge/Vercel | `export const runtime = "nodejs"` explícito. Testar em preview deploy |
| Transcodificação aumenta latência | <50ms para 1080×1080 — menor custo comparado à chamada IA |
| `publication_copy_snapshot` shape diverge entre F14 e F15 | Shape congelado após F14. F15 consome o que F14 escreve |
| Falha parcial entre upload e updateReady | Compensação: updateCampaignError + deleteCampaignImage |
| `campaignUrl` no NDJSON diverge da URL real | URL construída pelo backend: `/campanha/${campaignId}` |
| Stub `/campanha/[id]` para evitar 404 temporário | Decisão do time: incluir stub mínimo na F14 ou aceitar 404 até F15 |