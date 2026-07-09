## Context

A Fase 12 estabeleceu a infraestrutura: tabela `public.campaigns` com RLS, bucket privado `campaign-images` com policies de Storage, ambos funcionando. Contudo, não há camada de código que os utilize. A Fase 13 preenche essa lacuna criando um serviço de persistência isolado (`src/lib/campaign/persistence.ts`), tipos manuais (`types.ts`), e a rota de download (`/api/campaign/[id]/download`).

Esta fase opera sobre a infraestrutura já criada (Fase 12) e os guards de auth/multitenancy já consolidados (Fases 7–11): `requireApiUser`, `requireOwnership`, `supabaseAdmin`. **Não altera** o fluxo de geração existente (`generate-image`) — a integração será feita na Fase 14.

## Goals / Non-Goals

**Goals:**
- Criar `src/lib/campaign/types.ts` com `CampaignStatus`, `CampaignRecord`, `CreateCampaignInput`, `CampaignReadyData` e shapes mínimos v1 dos 5 snapshots JSONB
- Criar `src/lib/campaign/persistence.ts` com 6 helpers principais (`createCampaign`, `dataUrlToCampaignImage`, `uploadCampaignImage`, `updateCampaignReady`, `updateCampaignError`, `getCampaign`) e 1 helper secundário (`deleteCampaignImage`)
- Criar `GET /api/campaign/[id]/download/route.ts` com validação UUID, `requireOwnership`, signed URL de 3600s e redirect 302
- Criar testes unitários: cobertura completa do serviço de persistência (16 cenários) e da rota de download (6 cenários)
- `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

**Non-Goals:**
- Modificação do fluxo `generate-image` — Fase 14
- Página `/campanha/[id]` — Fase 15
- Página `/minhas-campanhas` + limpeza — Fase 16
- Edição publication copy — Fase 6 condicional (pós-v1.3)
- Geração de tipos com `supabase gen types` — pós-F14
- Transcodificação PNG/WEBP → JPEG — Fase 14
- Cleanup de `generating` stale — futuro
- `createSignedUrl` fallback via proxy de blob — documentado, não implementado

## Decisions

### D1 — Operações atômicas independentes (não monolíticas)

Helpers exportados individualmente, cada um com uma responsabilidade:

```
createCampaign(storeId, input)        → INSERT campaigns status=generating, retorna { id, storage_path }
dataUrlToCampaignImage(dataUrl)       → função pura: valida MIME, extrai buffer, sem transcodificação
uploadCampaignImage(storeId, id, img) → Storage upload em campaign-images/{storeId}/{id}.jpg, upsert:false
updateCampaignReady(id, data)         → UPDATE status='ready' + snapshots + error_message:null
updateCampaignError(id, msg)          → UPDATE status='error' + error_message (rejeita msg vazia)
getCampaign(id)                       → SELECT via supabaseAdmin, retorna CampaignRecord | null
deleteCampaignImage(storagePath)      → Storage remove, helper secundário para compensação
```

**Motivo:** A Fase 14 orquestrará essas operações em sequência. Manter cada operação independente permite testar isoladamente e torna a orquestração futura explícita.

### D2 — `dataUrlToCampaignImage` antes de `uploadCampaignImage`

`dataUrlToCampaignImage` é parser genérico que aceita PNG/JPEG/WEBP — apenas valida MIME e extrai buffer, sem transcodificação. O formato canônico de entrega é JPEG (`mimeType: "image/jpeg"` na assinatura de `uploadCampaignImage`). Se a data URL for PNG/WEBP, o parser extrai o buffer, mas `uploadCampaignImage` rejeitará por MIME diferente de `image/jpeg`. A transcodificação PNG/WEBP → JPEG qualidade 90 sRGB 1080×1080 é responsabilidade da F14.

### D3 — Storage sem `upsert`

`uploadCampaignImage` usa `upsert: false`. O bucket `campaign-images` não tem policy de UPDATE (imutabilidade da milestone). Para retry no mesmo `storage_path` após falha parcial (ex.: Storage OK mas DB UPDATE falhou), `deleteCampaignImage` + re-upload é o caminho explícito.

### D4 — Compensação delegada ao orquestrador

Os helpers são honestos: criam registro, sobem imagem, marcam sucesso/erro. `updateCampaignReady` propaga erro — não esconde, não compensa sozinho. O orquestrador (F14) captura o erro, chama `updateCampaignError` para marcar a campanha como erro, e opcionalmente `deleteCampaignImage` para remover imagem órfã.

### D5 — Tipos manuais em `types.ts`

Não travar na execução de `supabase gen types`. Como os snapshots ainda estão com shape parcialmente estabilizado (v1 mínima), tipos manuais são mais práticos. Quando F14-F16 estabilizarem, vale migrar para `database.types.ts`.

Shapes mínimos v1 definidos no alignment doc para cada snapshot JSONB: `input_snapshot` (entrada do lojista sem data URL bruta), `identity_snapshot` (identidade da loja), `render_snapshot` (metadados de render: JPEG 1080×1080 sRGB q90), `publication_copy_snapshot` (copy publicável), `generation_metadata` (provedor, modelo, duração).

### D6 — Download route: `requireApiUser` + `supabaseAdmin` + `requireOwnership`

```
GET /api/campaign/[id]/download
  → requireApiUser()
  → validar [id] como UUID v4 — se malformado: 400
  → getCampaign(id) via supabaseAdmin
  → se null: 404
  → requireOwnership(campaign.store_id, user.userId)
  → se não pertencer: 404 (mesmo status — sem vazamento de existência)
  → createSignedUrl(storage_path, 3600)
  → redirect 302 para signed URL
  → se createSignedUrl falha: 502
```

Padrão idêntico ao usado em `generate-image/route.ts` e demais rotas protegidas.

### D7 — Storage path: formato canônico JPEG

`storage_path` sempre usa `.jpg`: `{storeId}/{campaignId}.jpg`. `uploadCampaignImage` valida `mimeType === "image/jpeg"`. A F14 garante transcodificação para JPEG sRGB qualidade 90 1080×1080 antes de chamar o upload.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| `createSignedUrl` falha em produção | Rota retorna 502. Fallback via `supabase.storage.download()` + proxy de blob documentado no alignment da milestone |
| Data URL malformada chega ao `uploadCampaignImage` | `dataUrlToCampaignImage` valida e rejeita antes |
| Buffer não-JPEG chega ao `uploadCampaignImage` | Assinatura de tipo `mimeType: "image/jpeg"` é contrato. F14 garante formato antes do upload |
| Upload com `upsert: false` falha por path existente | Retry explícito via `deleteCampaignImage` + re-upload |
| Shape dos snapshots muda em F14-F16 | Tipos manuais em `types.ts` facilitam ajuste sem quebrar `database.types.ts` |
| Sem `supabase gen types`, tipos manuais dessincronizados | Risco aceito. Sincronização planejada pós-F14 |
| UUID malformado chega ao `getCampaign` sem validação | Rota valida UUID antes de chamar `getCampaign`. Helper assume ID válido |
