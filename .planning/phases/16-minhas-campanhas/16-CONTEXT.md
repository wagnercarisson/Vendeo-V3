# Phase 16: Minhas Campanhas — Context

**Gathered:** 2026-07-10
**Status:** Ready for planning
**Source:** OpenSpec change (`openspec/changes/fase-16-minhas-campanhas/`)

<domain>
## Phase Boundary

Criar a página `/minhas-campanhas` com listagem de campanhas persistidas. O lojista que gerou campanhas (F14) e tem uma página individual (F15) agora precisa de um ponto de entrada para **encontrar** campanhas passadas — o elo que faltava para fechar o critério da milestone v1.3 ("gerou, saiu, voltou, encontrou e baixou").

Depende da Fase 13: `CampaignRecord`, `persistence.ts` (helpers — não modifica).
Depende da Fase 15: `display.ts` (padrão de display contract), middleware com `/campanha/:path*`, padrão de página com auth → store → dados.

**Critério de conclusão da milestone:** O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la. Esta fase fecha o ciclo.

</domain>

<decisions>
## Implementation Decisions

### D1 — `listCampaigns` em `src/lib/campaign/list.ts`

CONFIRMADO

Criar arquivo separado em `src/lib/campaign/list.ts`. `display.ts` já tem responsabilidade de exibição individual; adicionar listagem lá hinchiria com duas responsabilidades distintas.

```typescript
// list.ts — contrato de listagem
import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export interface CampaignListItem {
  id: string;
  productName: string;
  status: CampaignStatus;
  createdAt: string;
  thumbnailUrl: string | null;
  storagePath: string;
}
```

**Motivos:**
- `createServerClient` respeita RLS — owner vê suas campanhas, outro tenant vê lista vazia
- Filtro `status IN ('ready', 'error')` — `generating` não aparece em lista normal (por decisão da milestone)
- `LIMIT 50` evita queries grandes sem virar feature de paginação
- `display.ts` permanece focado em exibição individual

### D2 — Thumbnails: signed URL server-side em batch

CONFIRMADO

Gerar signed URLs para thumbnail no Server Component, apenas para campanhas `ready`, usando `Promise.allSettled` para paralelismo.

- `expiresIn: 3600` (1h) — mesma política da página individual e do download
- Placeholder visual para thumbnails com falha ou para campanhas `error`
- CSS `object-cover` redimensiona a imagem original — sem `sharp`, sem geração de thumbnail separada
- Se a signed URL expirar, recarregar a página gera novas URLs

### D3 — O que aparece na lista

CONFIRMADO

| Campo | Origem | Notas |
|-------|--------|-------|
| Thumbnail | `signedUrl` do `storage_path` | Só para `ready`. `error` = placeholder |
| Produto | `product_name` | Denormalizado no INSERT da F14 |
| Data | `created_at` | Formatada como "dd/mm/aaaa" |
| Status | `status` | `ready` ou `error` |
| "Abrir" | Link → `/campanha/[id]` | Leva à página persistida da F15 |
| "Baixar" | Link → `/api/campaign/[id]/download` | **Apenas para `ready`**. `error` não tem artefato baixável confiável |

Campanhas `generating` são excluídas da lista normal (invariante da milestone).

### D4 — Estado vazio

CONFIRMADO

Se `listCampaigns` retornar array vazio, exibir mensagem + CTA "Criar Primeira Campanha" → `/`.

### D5 — Navegação: link no `AuthHeader`

CONFIRMADO

Modificar `src/components/auth/auth-header.tsx` para incluir link `href="/minhas-campanhas"` antes do `LogoutButton`. O link aparece para todo usuário autenticado — `/minhas-campanhas` redireciona para `/store` se não houver loja. Evita `getCurrentStore` no header global.

Adicionar link "← Minhas Campanhas" no topo da página `/campanha/[id]`.

### D6 — Redirecionamento de `/campaign/preview`

CONFIRMADO

Adicionar verificação no início da página: se usuário autenticado com loja, redirecionar (302) para `/minhas-campanhas`. Caso contrário (não autenticado), manter comportamento existente.

### D7 — Três planos de execução

CONFIRMADO

| Plano | Foco | Arquivos |
|-------|------|----------|
| **16-01** | Contrato de listagem | `src/lib/campaign/list.ts`: `listCampaigns(storeId)`, `CampaignListItem`, `generateBatchThumbnailUrls` |
| **16-02** | UI `/minhas-campanhas` + navegação | `page.tsx` (Server), `client.tsx` (Client): lista, estado vazio, header, middleware, link em `/campanha/[id]` |
| **16-03** | Testes e cleanup legado | Testes do helper, page states, middleware matcher, redirect `/campaign/preview`, typecheck/lint/build |

```
16-01 ──► 16-02 ──► 16-03
```

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 — Serviço de Persistência
- `.planning/phases/13-servico-persistencia-download/13-CONTEXT.md` — Context and decisions
- `src/lib/campaign/types.ts` — CampaignRecord, CampaignStatus, CampaignListItem deriva daqui
- `src/lib/campaign/persistence.ts` — 7 helpers (getCampaign, uploadCampaignImage patterns)

### Phase 14 — Integração no Fluxo de Geração
- `.planning/phases/14-integracao-fluxo-geracao/14-CONTEXT.md` — Context and decisions

### Phase 15 — Página de Campanha
- `.planning/phases/15-pagina-de-campanha/15-CONTEXT.md` — Context and decisions
- `.planning/phases/15-pagina-de-campanha/15-01-PLAN.md` — display.ts pattern
- `.planning/phases/15-pagina-de-campanha/15-02-PLAN.md` — page + client pattern
- `src/lib/campaign/display.ts` — display contract pattern (individual display)

### Auth patterns
- `src/lib/auth/require-user.ts` — `requirePageUser()`, `requireApiUser()`
- `src/lib/auth/store-ownership.ts` — `getCurrentStore(userId)`
- `src/lib/supabase/server.ts` — `createServerClient()` (RLS-aware, uses cookies), `supabaseAdmin`

### OpenSpec change artifacts (source of truth)
- `openspec/changes/fase-16-minhas-campanhas/proposal.md` — Why, What Changes, Impact
- `openspec/changes/fase-16-minhas-campanhas/design.md` — Goals, Non-Goals, Decisions D1-D7
- `openspec/changes/fase-16-minhas-campanhas/tasks.md` — Task breakdown per plan
- `openspec/changes/fase-16-minhas-campanhas/specs/list-contract/spec.md` — list.ts spec
- `openspec/changes/fase-16-minhas-campanhas/specs/campaign-list-ui/spec.md` — Page + nav spec
- `openspec/changes/fase-16-minhas-campanhas/specs/campaign-list-tests/spec.md` — Test spec
- `openspec/changes/fase-16-minhas-campanhas/specs/campaign-preview-page/spec.md` — Redirect spec (MODIFIED)
- `openspec/changes/fase-16-minhas-campanhas/specs/store-ownership-pages/spec.md` — Redirect spec (MODIFIED)

### Files to be modified
- `src/components/auth/auth-header.tsx` — Add "Minhas Campanhas" link before LogoutButton
- `src/app/campanha/[id]/client.tsx` — Add "← Minhas Campanhas" back link
- `src/app/campaign/preview/page.tsx` — Redirect authenticated+store → `/minhas-campanhas`
- `src/middleware.ts` — Add `/minhas-campanhas` to config.matcher

### Middleware
- `src/middleware.ts` — Current config.matcher (precisa adicionar `/minhas-campanhas`)

</canonical_refs>

<specifics>
## Specific Ideas

### list.ts (new — src/lib/campaign/list.ts)
- `import "server-only"`
- `listCampaigns(storeId: string)` — `createServerClient()` → `from("campaigns").select("id, product_name, status, created_at, storage_path").eq("store_id", storeId).in("status", ["ready", "error"]).order("created_at", { ascending: false }).limit(50)`, retorna `CampaignListItem[]`
- `generateBatchThumbnailUrls(items: CampaignListItem[])` — `Promise.allSettled` com `supabaseAdmin.storage.from("campaign-images").createSignedUrl(path, 3600)` apenas para `ready` com `storagePath` não vazio, retorna `Record<id, string | null>`

### page.tsx (new — src/app/minhas-campanhas/page.tsx)
- Server Component: `requirePageUser()` → `getCurrentStore(user.userId)` (redirect `/store` se null) → `listCampaigns(store.id)` → passar `campaigns` serializável ao Client Component

### client.tsx (new — src/app/minhas-campanhas/client.tsx)
- Client Component que recebe `campaigns: CampaignListItem[]`:
  - Lista de cards com thumbnail, nome, data "dd/mm/aaaa", status, "Abrir", "Baixar" (só ready)
  - Estado vazio: "Nenhuma campanha encontrada" + CTA "Criar Primeira Campanha" → `/`
</specifics>

<deferred>
## Deferred Ideas

- Paginação visível ("Load More") — `LIMIT 50` interno é suficiente para v1.3
- Filtros ou busca na lista — lista simples ordenada por data
- `sharp` ou geração de miniaturas dedicadas — CSS `object-cover` resolve
- Route group `(protected)` — AuthHeader modificado é suficiente
- Campanhas `generating` na lista — excluídas por decisão da milestone
- Edição de publication copy — Fase 17 condicional
- Remoção física de `/campaign/preview` — redirect é mais seguro que remover rota
- Cleanup de `/api/campaign/generate` (legado) — futuro
- Supabase gen types — pós-v1.3
- Job de cleanup de `generating` stale — futuro

</deferred>

---

*Phase: 16-minhas-campanhas*
*Context gathered: 2026-07-10 via OpenSpec change (fase-16-minhas-campanhas)*
