## Context

As Fases 12-14 criaram a infraestrutura de persistência de campanhas: tabela `campaigns`, bucket `campaign-images`, helpers de escrita/leitura em `persistence.ts`, rota de download via signed URL, e pipeline de geração que persiste automaticamente. A Fase 15 entregou a página individual `/campanha/[id]` com preview e download.

O que falta é o ponto de entrada: o lojista gerou uma campanha, saiu do sistema, quer voltar depois e encontrá-la. Hoje o único caminho é ter guardado o link direto. Sem a listagem, o critério de conclusão da milestone ("gerou, saiu, voltou, encontrou e baixou") não é atingido. Esta fase fecha o ciclo construindo `/minhas-campanhas`.

A fase depende de F12 (tabela `campaigns`, RLS SELECT `owner_select_campaigns`), F13 (`CampaignRecord`), F14 (dados populados via pipeline), e F15 (padrão display contract, middleware com `/campanha/:path*`).

## Goals / Non-Goals

**Goals:**
- Criar `src/lib/campaign/list.ts` com `listCampaigns(storeId)` usando `createServerClient` + RLS, filtrando `status IN ('ready', 'error')`, ordenando `created_at DESC` com `LIMIT 50`
- Implementar `generateBatchThumbnailUrls(items)` via `Promise.allSettled` com `supabaseAdmin.storage.createSignedUrl` para campanhas `ready`
- Criar Server Component `/minhas-campanhas` com `requirePageUser()` → `getCurrentStore()` (redirect `/store` se null) → `listCampaigns(storeId)`
- Criar Client Component com lista de cards (thumbnail, nome do produto, data formatada dd/mm/aaaa, status visual, "Abrir" + "Baixar" apenas para `ready`)
- Exibir estado vazio para lojistas sem campanhas com CTA "Criar Primeira Campanha" → `/`
- Adicionar link "Minhas Campanhas" no `AuthHeader` entre conteúdo e "Sair"
- Adicionar link "← Minhas Campanhas" no topo de `/campanha/[id]/client.tsx`
- Redirecionar `/campaign/preview` para `/minhas-campanhas` se autenticado com loja
- Adicionar `/minhas-campanhas` ao `config.matcher` do middleware
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

**Non-Goals:**
- Paginação visível ("Load More" ou page numbers) — `LIMIT 50` interno é suficiente
- Filtros ou busca na lista — lista simples ordenada por data
- `sharp` ou geração de miniaturas dedicadas — CSS `object-cover` resolve
- Route group `(protected)` — `AuthHeader` modificado é suficiente
- Campanhas `generating` na lista — excluídas por decisão da milestone
- Edição de publication copy — Fase 17 condicional
- Remoção física de `/campaign/preview` — redirect é mais seguro que remover rota
- Cleanup de `/api/campaign/generate` (legado) — futuro
- Supabase gen types — pós-v1.3
- Job de cleanup de `generating` stale — futuro

## Decisions

### D1 — `listCampaigns` em `src/lib/campaign/list.ts`

`CONFIRMADO`

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

export async function listCampaigns(storeId: string): Promise<CampaignListItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, product_name, status, created_at, storage_path")
    .eq("store_id", storeId)
    .in("status", ["ready", "error"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const items = (data ?? []).map(mapToListItem);
  const thumbnails = await generateBatchThumbnailUrls(items);
  return items.map(item => ({
    ...item,
    thumbnailUrl: thumbnails[item.id] ?? null,
  }));
}
```

**Motivos:**
- `createServerClient` respeita RLS — owner vê suas campanhas, outro tenant vê lista vazia
- Filtro `status IN ('ready', 'error')` — `generating` não aparece em lista normal (por decisão da milestone)
- `LIMIT 50` evita queries grandes sem virar feature de paginação
- `display.ts` permanece focado em exibição individual

### D2 — Thumbnails: signed URL server-side em batch

`CONFIRMADO`

Gerar signed URLs para thumbnail no Server Component, apenas para campanhas `ready`, usando `Promise.allSettled` para paralelismo.

```
listCampaigns(storeId)
  → SELECT com RLS, filtra ready + error
  → Para cada item ready com storage_path:
      supabaseAdmin.storage.from("campaign-images").createSignedUrl(path, 3600)
      em paralelo via Promise.allSettled
  → Se alguma falha: thumbnailUrl = null (placeholder)
  → items prontos para o Client Component
```

- `expiresIn: 3600` (1h) — mesma política da página individual e do download
- Placeholder visual para thumbnails com falha ou para campanhas `error`
- CSS `object-cover` redimensiona a imagem original — sem `sharp`, sem geração de thumbnail separada
- Se a signed URL expirar, recarregar a página gera novas URLs

### D3 — O que aparece na lista

`CONFIRMADO`

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

`CONFIRMADO`

Se `listCampaigns` retornar array vazio, exibir mensagem + CTA "Criar Primeira Campanha" → `/`.

### D5 — Navegação: link no `AuthHeader`

`CONFIRMADO`

Modificar `src/components/auth/auth-header.tsx` para incluir link `href="/minhas-campanhas"` antes do `LogoutButton`. O link aparece para todo usuário autenticado — `/minhas-campanhas` redireciona para `/store` se não houver loja. Evita `getCurrentStore` no header global.

Adicionar link "← Minhas Campanhas" no topo da página `/campanha/[id]`.

### D6 — Redirecionamento de `/campaign/preview`

`CONFIRMADO`

Adicionar verificação no início da página: se usuário autenticado com loja, redirecionar (302) para `/minhas-campanhas`. Caso contrário (não autenticado), manter comportamento existente.

### D7 — Três planos de execução

`CONFIRMADO`

| Plano | Foco | Arquivos |
|-------|------|----------|
| **16-01** | Contrato de listagem | `src/lib/campaign/list.ts`: `listCampaigns(storeId)`, `CampaignListItem`, `generateBatchThumbnailUrls` |
| **16-02** | UI `/minhas-campanhas` + navegação | `page.tsx` (Server), `client.tsx` (Client): lista, estado vazio, header, middleware, link em `/campanha/[id]` |
| **16-03** | Testes e cleanup legado | Testes do helper, page states, middleware matcher, redirect `/campaign/preview`, typecheck/lint/build |

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Muitas signed URLs em paralelo na listagem | `Promise.allSettled` + `LIMIT 50`. N máximo de 50 chamadas simultâneas — aceitável para serverless |
| Signed URL expira enquanto usuário navega na lista | 1h de validade. Recarregar a página gera novas URLs |
| Lojista com 0 campanhas vê página vazia sem orientação | Estado vazio com CTA claro "Criar Primeira Campanha" |
| Link "Minhas Campanhas" quebra se loja não tem store | AuthHeader mostra link para todo autenticado. O Server Component da página redireciona para `/store` se `getCurrentStore` for null — sem custo de `getCurrentStore` no header global |
| `/campaign/preview` ainda tem tráfego de bookmarks antigos | Redirect 302 é suave. Usuário chega ao destino correto sem erro |
