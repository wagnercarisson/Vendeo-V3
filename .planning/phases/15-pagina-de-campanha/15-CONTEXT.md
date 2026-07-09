# Phase 15: Página de Campanha — Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Source:** OpenSpec change (`openspec/changes/fase-15-pagina-de-campanha/`)

<domain>
## Phase Boundary

Criar a Server Component `/campanha/[id]` com preview e download da campanha persistida. O lojista que gerou uma campanha (F14) é redirecionado para esta página, onde pode visualizar o resultado final, ver o kit de publicação (caption, hashtags, cta_post), e baixar o arquivo original.

Depende da Fase 13: `types.ts` (`CampaignRecord`, `PublicationCopySnapshot`), `persistence.ts` (7 helpers — não modifica).
Depende da Fase 14: pipeline de geração que persiste e navega para `/campanha/[id]`.

**Critério de conclusão da milestone:** O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la. (Fases 15-16 pendentes — F15 cobre a visualização individual, F16 cobre a listagem.)
</domain>

<decisions>
## Implementation Decisions

### D1 — `getCampaignForDisplay` com RLS, não `supabaseAdmin`

CONFIRMADO

O helper `getCampaign` em `persistence.ts` usa `supabaseAdmin` (service role), correto para operações de backend. Para a página, a consulta usa `createServerClient` com a sessão do usuário, respeitando a RLS SELECT policy (`owner_select_campaigns`).

```
createServerClient(cookies)
  .from("campaigns")
  .select("*")
  .eq("id", id)
  .maybeSingle()

Não é owner → RLS filtra → data = null → notFound()
Não existe → maybeSingle → null → notFound()
É owner → retorna CampaignRecord
```

**display.ts exports:** `getCampaignForDisplay(id)` (leitura RLS), `generateSignedPreviewUrl(storagePath)` (signed URL, caller condiciona), `computeDisplayStatus(campaign)` (deriva estado de exibição). Nenhum substitui os helpers em `persistence.ts`.

### D2 — Signed URL server-side, condicionada a `ready`

CONFIRMADO

A signed URL para exibição da imagem é gerada pelo Server Component **após** autorização RLS, e **apenas** se `status === "ready"`.

```
getCampaignForDisplay(id) → RLS autoriza → data retorna
  → se status === "ready":
      supabaseAdmin.storage.from("campaign-images").createSignedUrl(storagePath, 3600)
  → se generating, error ou stale: signedUrl = null
```

- `expiresIn: 3600` (1h) — mesma política da rota de download
- Se expirar, recarregar a página gera nova URL
- Botão "Baixar" reusa `GET /api/campaign/[id]/download` — não gera nova signed URL

### D3 — 4 estados na UI

CONFIRMADO

| Estado | Trigger | UI |
|--------|---------|-----|
| `ready` | `displayStatus === "ready"` | Imagem + caption + hashtags + cta_post + botão baixar |
| `generating` | `displayStatus === "generating"` | Spinner + "Sua campanha está sendo gerada..." + auto-poll 5s |
| `stale` | `displayStatus === "stale"` | "Geração interrompida. Tente novamente." + CTA nova campanha |
| `error` | `displayStatus === "error"` | Mensagem amigável + CTA "Criar Nova Campanha" |
| 404 | data = null (não existe ou outro tenant) | `notFound()` → página 404 padrão |

**displayStatus — lógica server-side em `page.tsx`:**
```ts
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";

function computeDisplayStatus(campaign: CampaignRecord): DisplayStatus {
  if (campaign.status === "ready") return "ready";
  if (campaign.status === "error") return "error";
  if (campaign.status === "generating") {
    const staleThreshold = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000;
    const isStale = Date.now() - new Date(campaign.updated_at).getTime() > staleThreshold;
    return isStale ? "stale" : "generating";
  }
  return "error";
}
```

O Client Component recebe `displayStatus` já calculado — não importa `config.ts` nem calcula stale.

### D4 — Polling sem API nova

CONFIRMADO

Enquanto `generating`, o Client Component chama `router.refresh()` a cada 5 segundos, forçando o Server Component a reexecutar `getCampaignForDisplay(id)`. Quando o backend transiciona o status para `ready` ou `error`, a nova renderização reflete o estado atual.

- Não cria `/api/campaign/[id]/status`
- Não duplica lógica de auth ou RLS
- `router.refresh()` reexecuta o Server Component, que aplica o mesmo pipeline (RLS → signed URL condicionada)

### D5 — Kit de publicação exibido como snapshot imutável

CONFIRMADO

O `publication_copy_snapshot` (caption, hashtags, cta_post) é gerado e persistido na F14. A F15 apenas exibe os campos mapeados com fallback (null → string vazia / array vazio). Snapshot imutável na v1.3 — edição futura usaria `publication_copy_current` (F17 condicional).

### D6 — Client Component props contract

CONFIRMADO

O Client Component recebe props pré-processadas pelo Server Component, incluindo valores pré-computados para evitar lógica condicional no cliente:

| Prop | Tipo | Origem |
|------|------|--------|
| `imageUrl` | `string \| null` | `generateSignedPreviewUrl(storagePath)` — só preenchido se `ready` |
| `caption` | `string` | `publication_copy_snapshot.caption` com fallback `""` |
| `hashtags` | `string[]` | `publication_copy_snapshot.hashtags` com fallback `[]` |
| `ctaPost` | `string` | `publication_copy_snapshot.cta_post` com fallback `""` |
| `displayStatus` | `"ready" \| "generating" \| "stale" \| "error"` | Computado server-side |
| `productName` | `string` | `product_name` com fallback `""` |
| `createdAt` | `string` | `created_at` com fallback |
| `updatedAt` | `string` | `updated_at` com fallback |
| `downloadUrl` | `string` | Pré-computado: `"/api/campaign/${id}/download"` |

### D7 — Três planos de execução

CONFIRMADO

| Plano | Foco | Arquivos |
|-------|------|----------|
| **15-01** | Data/display contract | `display.ts` com `getCampaignForDisplay`, `generateSignedPreviewUrl`, `computeDisplayStatus`, mapeamento snapshots |
| **15-02** | UI `/campanha/[id]` | `page.tsx` (Server) + `client.tsx` (Client): 4 estados guiados por `displayStatus` + 404 |
| **15-03** | Testes e middleware | `display.test.ts`, testes de página (4 estados + 404), middleware matcher |

```
15-01 ──► 15-02 ──► 15-03
```

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 — Serviço de Persistência
- `.planning/phases/13-servico-persistencia-download/13-CONTEXT.md` — Context and decisions
- `src/lib/campaign/types.ts` — CampaignRecord, PublicationCopySnapshot, CampaignStatus
- `src/lib/campaign/persistence.ts` — 7 helpers (getCampaign com supabaseAdmin, NÃO usar para display)

### Phase 14 — Integração no Fluxo de Geração
- `.planning/phases/14-integracao-fluxo-geracao/14-CONTEXT.md` — Context and decisions
- `.planning/phases/14-integracao-fluxo-geracao/14-03-PLAN.md` — Consumer navigate to /campanha/[id]

### Auth patterns
- `src/lib/auth/require-user.ts` — `requirePageUser()`, `requireApiUser()`
- `src/lib/auth/store-ownership.ts` — `getCurrentStore(userId)`
- `src/lib/supabase/server.ts` — `createServerClient()` (RLS-aware, uses cookies)

### Image generation config
- `src/lib/image-generation/config.ts` — `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` (300000ms = 5min)

### Storage helpers
- `src/lib/campaign/persistence.ts:56-80` — `uploadCampaignImage` pattern (supabaseAdmin.storage)

### OpenSpec change artifacts (source of truth)
- `openspec/changes/fase-15-pagina-de-campanha/proposal.md` — Why, What Changes, Impact
- `openspec/changes/fase-15-pagina-de-campanha/design.md` — Goals, Non-Goals, Decisions D1-D7
- `openspec/changes/fase-15-pagina-de-campanha/tasks.md` — Task breakdown per plan
- `openspec/changes/fase-15-pagina-de-campanha/specs/campaign-display-contract/spec.md` — display.ts spec
- `openspec/changes/fase-15-pagina-de-campanha/specs/campaign-page-ui/spec.md` — Page UI spec (4 states + middleware)
- `openspec/changes/fase-15-pagina-de-campanha/specs/campaign-page-tests/spec.md` — Test spec

### Middleware
- `src/middleware.ts` — Current config.matcher (precisa adicionar `/campanha/:path*`)

</canonical_refs>

<specifics>
## Specific Ideas

### display.ts (new — src/lib/campaign/display.ts)
- `import "server-only"`
- `getCampaignForDisplay(id: string)` — valida UUID v4, `createServerClient()` → `from("campaigns").select("*").eq("id", id).maybeSingle()`, retorna `CampaignRecord | null`
- `generateSignedPreviewUrl(storagePath: string)` — `supabaseAdmin.storage.from("campaign-images").createSignedUrl(storagePath, 3600)`, retorna URL ou null se path vazio. NÃO valida status — o caller condiciona.
- `computeDisplayStatus(campaign: CampaignRecord)` — deriva `ready | generating | stale | error` de `status` + `updated_at` + `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000`
- Mapeamento de snapshots com fallback (null → "" / []) para props serializáveis

### page.tsx (new — src/app/campanha/[id]/page.tsx)
- Server Component: `requirePageUser()` → `getCurrentStore(user.userId)` (redirect `/store` se null) → `getCampaignForDisplay(id)` (notFound se null)
- Calcular `displayStatus` server-side
- Se `status === "ready"`: gerar signed URL via `generateSignedPreviewUrl`
- Pré-computar `downloadUrl = "/api/campaign/${id}/download"`
- Passar props para Client Component

### client.tsx (new — src/app/campanha/[id]/client.tsx)
- Client Component com props: `imageUrl`, `caption`, `hashtags`, `ctaPost`, `displayStatus`, `createdAt`, `updatedAt`, `productName`, `downloadUrl`
- Estado `ready`: imagem + caption + hashtags + cta_post + botão "Baixar Original"
- Estado `generating`: spinner + "Sua campanha está sendo gerada..." + polling via `router.refresh()` a cada 5s com cleanup
- Estado `stale`: "Geração interrompida. Tente novamente." + CTA "Criar Nova Campanha"
- Estado `error`: mensagem amigável + CTA "Criar Nova Campanha"

### middleware.ts (modificado)
- Adicionar `/campanha/:path*` ao `config.matcher`

### Testes
- `src/__tests__/lib/campaign/display.test.ts` — getCampaignForDisplay (owner, não owner, inexistente, UUID inválido), generateSignedPreviewUrl (path válido, path vazio), computeDisplayStatus (ready, generating, stale, error)
- Testes de página: 4 estados (ready, generating, stale, error) + 404 (notFound)
- `src/middleware.ts` — verificar que matcher contém `/campanha/:path*`

</specifics>

<deferred>
## Deferred Ideas

- `/minhas-campanhas` + listagem — Fase 16
- Header/nav com "Minhas Campanhas" — Fase 16
- Thumbnail strategy — Fase 16
- Edição de publication copy — condicional pós-v1.3
- Expandir `render_snapshot` para diretivas visuais — pós-v1.3
- Cleanup de `/api/campaign/generate` (legado) — futuro
- Reescrever `/campaign/preview` — fora do escopo
- Job de cleanup de `generating` stale no banco — futuro

</deferred>

---

*Phase: 15-pagina-de-campanha*
*Context gathered: 2026-07-09 via OpenSpec change (fase-15-pagina-de-campanha)*
