# Phase 13: Serviço de Persistência e Download — Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Source:** OpenSpec change (`openspec/changes/fase-13-servico-persistencia-download/`)

<domain>
## Phase Boundary

Criar camada de persistência isolada para campanhas: tipos manuais (`src/lib/campaign/types.ts`), serviço de 7 helpers (`src/lib/campaign/persistence.ts`), e rota de download (`GET /api/campaign/[id]/download`). Não modifica o fluxo de geração existente (`generate-image`) — a integração será feita na Fase 14.

Depende das Fases 7–12: `supabaseAdmin`, `requireApiUser`, `requireOwnership`, tabela `public.campaigns` com RLS, bucket privado `campaign-images` com policies de Storage.
</domain>

<decisions>
## Implementation Decisions

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

`dataUrlToCampaignImage` é parser genérico que aceita PNG/JPEG/WEBP — apenas valida MIME e extrai buffer, sem transcodificação. O formato canônico de entrega é JPEG (`mimeType: "image/jpeg"` na assinatura de `uploadCampaignImage`). A transcodificação PNG/WEBP → JPEG qualidade 90 sRGB 1080×1080 é responsabilidade da F14.

### D3 — Storage sem `upsert`

`uploadCampaignImage` usa `upsert: false`. O bucket `campaign-images` não tem policy de UPDATE (imutabilidade da milestone). Para retry no mesmo `storage_path` após falha parcial, `deleteCampaignImage` + re-upload é o caminho explícito.

### D4 — Compensação delegada ao orquestrador

Os helpers são honestos: criam registro, sobem imagem, marcam sucesso/erro. `updateCampaignReady` propaga erro — não esconde, não compensa sozinho. O orquestrador (F14) captura o erro, chama `updateCampaignError` para marcar campanha como erro, e opcionalmente `deleteCampaignImage` para remover imagem órfã.

### D5 — Tipos manuais em `types.ts`

Não travar na execução de `supabase gen types`. Como os snapshots ainda estão com shape parcialmente estabilizado (v1 mínima), tipos manuais são mais práticos. Quando F14-F16 estabilizarem, vale migrar para `database.types.ts`.

Shapes mínimos v1 para cada snapshot JSONB: `input_snapshot`, `identity_snapshot`, `render_snapshot`, `publication_copy_snapshot`, `generation_metadata`.

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

Padrão idêntico ao usado em `generate-image/route.ts` e demais rotas protegidas. A rota usa `apiHandler` wrapper para capturar erros de auth.

### D7 — Storage path: formato canônico JPEG

`storage_path` sempre usa `.jpg`: `{storeId}/{campaignId}.jpg`. `uploadCampaignImage` valida `mimeType === "image/jpeg"`. A F14 garante transcodificação para JPEG sRGB qualidade 90 1080×1080 antes de chamar upload.

### D8 — UUID sem lib externa

Usar `crypto.randomUUID()` do Node.js (disponível no runtime) em vez de adicionar dependência `uuid`. Padrão já utilizado em outras partes do codebase.

### D9 — API Handler wrapper

A rota de download usa `apiHandler` de `@/lib/auth/api-handler` para capturar `UnauthorizedError`, `StoreNotFoundError` e `ForbiddenError` automaticamente, seguindo o padrão das demais rotas (`generate`, `store/[id]`, `generate-image`).

### D10 — Testes com Vitest e mocks

Testes seguem o padrão existente: `vi.mock()` para módulos do Supabase/auth, `vi.fn()` para implementações mock, `beforeEach` com `vi.restoreAllMocks()`, e imports dinâmicos nos corpos dos testes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth & Supabase patterns
- `src/lib/supabase/server.ts` — `supabaseAdmin` singleton, `createServerClient()`
- `src/lib/auth/require-user.ts` — `requireApiUser()`, `AuthenticatedUser` interface
- `src/lib/auth/store-ownership.ts` — `requireOwnership()`, `getCurrentStore()`
- `src/lib/auth/api-handler.ts` — `apiHandler` error-to-HTTP wrapper
- `src/lib/auth/csrf.ts` — `requireSameOrigin()`
- `src/lib/auth/errors.ts` — `UnauthorizedError`, `StoreNotFoundError`, `ForbiddenError`
- `src/lib/api-error-response.ts` — `unauthorized()`, `notFound()`, `forbidden()`

### Route handler patterns (app router)
- `src/app/api/store/[id]/route.ts` — Dynamic route with `requireOwnership`, `supabaseAdmin`, `apiHandler`
- `src/app/api/campaign/generate/route.ts` — Route with `requireApiUser()` + `getCurrentStore()`
- `src/app/api/campaign/generate-image/route.ts` — Route with `requireApiUser()` + `requireOwnership()`, NDJSON stream

### Existing types
- `src/lib/store.ts` — `Store` interface pattern
- `src/lib/brand-assets/types.ts` — Brand asset types pattern
- `src/lib/visual-signature/types.ts` — Visual signature types pattern

### Test patterns
- `src/__tests__/api/store-ownership-api.test.ts` — Route handler test pattern
- `src/app/api/store/[id]/__tests__/route.test.ts` — Dynamic route test pattern
- `src/lib/__tests__/snapshot.test.ts` — Unit test pattern for lib functions

### Test configuration
- `vitest.config.ts` or `src/__tests__/setup.ts` — Test environment setup

### Phase 12 foundation (DB/Storage)
- `.planning/phases/12-fundacao-db-storage/` — campaigns table DDL, bucket, RLS, Storage policies
- `supabase/migrations/20260708000001_create_campaigns_table.sql` — campaigns table
- `supabase/migrations/20260708000002_create_campaign_images_bucket.sql` — campaign-images bucket

</canonical_refs>

<specifics>
## Specific Ideas

### Tipos mínimos v1 (types.ts)
- `CampaignStatus = "generating" | "ready" | "error"`
- `CampaignRecord` com todos os campos da tabela `public.campaigns`
- `CreateCampaignInput` com `productName`, `inputSnapshot`, `identitySnapshot?`
- `CampaignReadyData` com `generationMetadata`, `renderSnapshot`, `publicationCopySnapshot`
- Shapes mínimos: `InputSnapshot`, `IdentitySnapshot`, `RenderSnapshot` (JPEG 1080×1080 sRGB q90), `PublicationCopySnapshot`, `GenerationMetadata`

### Persistence service (persistence.ts)
- 6 helpers principais + 1 secundário, todos usando `supabaseAdmin` (service_role)
- `createCampaign`: UUID via `crypto.randomUUID()`, INSERT status=generating
- `dataUrlToCampaignImage`: parser de data URL, aceita PNG/JPEG/WEBP, sem transcodificação
- `uploadCampaignImage`: Storage upload, upsert=false, contentType image/jpeg
- `updateCampaignReady`: UPDATE status=ready + snapshots + error_message=null
- `updateCampaignError`: UPDATE status=error, rejeita mensagem vazia
- `getCampaign`: SELECT via supabaseAdmin, retorna CampaignRecord | null
- `deleteCampaignImage`: Storage remove (compensação)

### Download route
- `GET /api/campaign/[id]/download` com pipeline de guards
- `apiHandler` wrapper, redirect 302 para signed URL de 3600s
- 401/400/404/502 conforme cenário

### Testes
- Persistence: 7 helpers → 16 cenários (createCampaign, dataUrlToCampaignImage, uploadCampaignImage, updateCampaignReady, updateCampaignError, getCampaign)
- Download route: 6 cenários (401, 400, 404 inexistente, 404 alien, 302, 502)

</specifics>

<deferred>
## Deferred Ideas

- Modificação do fluxo `generate-image` — Fase 14
- Página `/campanha/[id]` — Fase 15
- Página `/minhas-campanhas` + limpeza — Fase 16
- Edição `publication_copy` — Fase 6 condicional (pós-v1.3)
- Geração de tipos com `supabase gen types` — pós-F14
- Transcodificação PNG/WEBP → JPEG — Fase 14
- Cleanup de `generating` stale — futuro
- `createSignedUrl` fallback via proxy de blob — documentado, não implementado

</deferred>

---

*Phase: 13-servico-persistencia-download*
*Context gathered: 2026-07-09 via OpenSpec change (fase-13-servico-persistencia-download)*
