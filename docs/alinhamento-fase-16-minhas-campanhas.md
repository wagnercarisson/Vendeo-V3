# Alinhamento Fase 16 — Lista de Campanhas `/minhas-campanhas` (v1.3)

## Contexto

```
v1.3 — Persistência e Entrega da Campanha (milestone)
  ├── Phase 12 — Fundação DB/Storage                                 ✅ completa
  ├── Phase 13 — Serviço de Persistência e Download                  ✅ completa
  ├── Phase 14 — Integração no Fluxo de Geração                      ✅ completa
  ├── Phase 15 — /campanha/[id]                                      ✅ completa
  ├── Phase 16 — /minhas-campanhas                                   ← esta fase
  └── Phase 17 (cond) — Edição Publication Copy                     (condicional)
```

A milestone v1.3 promete que o lojista **"gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la"**. Hoje as campanhas persistem (F12-14), a página individual existe (F15), mas não há um ponto de entrada para o lojista **encontrar** campanhas passadas — ele só acessa a campanha se guardou o link ou se acabou de gerar. Esta fase fecha o ciclo com a listagem de campanhas.

**Dependências:** F12 (tabela `campaigns`, RLS SELECT), F13 (`CampaignRecord`, rota de download), F15 (página individual, padrão de display contract, middleware com `/campanha/:path*`).

---

## Propósito

1. Criar a página `/minhas-campanhas` com autenticação e ownership via RLS
2. Criar helper `listCampaigns(storeId)` com consulta RLS via `createServerClient`, filtrando `status IN ('ready', 'error')`, ordenando por `created_at DESC` com `LIMIT 50` interno
3. Renderizar lista visual: thumbnail (signed URL), nome do produto, data, status, "Abrir" e "Baixar" (apenas para `ready`)
4. Exibir estado vazio para lojistas sem campanhas, com CTA para gerar a primeira
5. Adicionar link "Minhas Campanhas" na navegação (`AuthHeader`)
6. Desativar `/campaign/preview` como destino relevante — redirecionar para `/minhas-campanhas`

**Entrega verificável:**
- O lojista acessa `/minhas-campanhas` e vê a lista de campanhas da sua loja
- Cada campanha mostra thumbnail, nome do produto, data, status, "Abrir". "Baixar" aparece apenas para `ready`
- Campanhas `error` mostram status com indicação visual e "Abrir" (leva para `/campanha/[id]`, que já exibe estado de erro + CTA "Criar Nova Campanha")
- Lojista sem campanhas vê estado vazio com CTA para gerar
- O link "Minhas Campanhas" aparece no header quando autenticado
- `/campaign/preview` redireciona para `/minhas-campanhas`
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F15)

```
                                      ANTES (F15)                        DEPOIS (F16)
═══════════════════════════════════════════════════════════════════════════════════════════
/minhas-campanhas                    ✗ não existe                        ✓ página completa

listCampaigns(storeId)               ✗ não existe                        ✓ RLS via createServerClient
                                                                           status IN ('ready','error')
                                                                           ORDER BY created_at DESC
                                                                           LIMIT 50 interno

Thumbnail na lista                   ✗ não existe                        ✓ signed URL server-side batch
                                                                           fallback: placeholder

Lista:
  ready: thumbnail + dados + Abrir + Baixar   ✗                         ✓
  error: status + Abrir (sem Baixar)          ✗                         ✓
  empty: "Nenhuma campanha" + CTA             ✗                         ✓

Navegação:
  AuthHeader: apenas "Sair"         ✗                                   ✓ "Minhas Campanhas" + "Sair"
  Link no header                    ✗                                   ✓

/campaign/preview                   rota morta (sessionStorage           ✓ redireciona para
                                    não é mais escrito)                    /minhas-campanhas

Middleware matcher:
  /minhas-campanhas                 ✗                                   ✓ adicionado

Testes                              ✗                                   ~15-20 novos
```

---

## Decisões de Arquitetura

### D1 — `listCampaigns` em `src/lib/campaign/list.ts`

`CONFIRMADO`

Criar arquivo separado em `src/lib/campaign/list.ts`. `display.ts` já tem responsabilidade de exibição individual; adicionar listagem lá o hinchiria com duas responsabilidades distintas.

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

  // Batch thumbnail URLs para campanhas ready
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

---

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

**Notas:**
- `expiresIn: 3600` (1h) — mesma política da página individual e do download
- Placeholder visual para thumbnails com falha ou para campanhas `error`
- CSS `object-cover` redimensiona a imagem original — sem `sharp`, sem geração de thumbnail separada
- Se a signed URL expirar, recarregar a página gera novas URLs

---

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

**Campanhas `generating`** são excluídas da lista normal (invariante da milestone). Stale `generating` poderá ser tratado em job de cleanup futuro — fora do escopo desta fase.

---

### D4 — Estado vazio

`CONFIRMADO`

Se `listCampaigns` retornar array vazio:
```
┌────────────────────────────────────────────┐
│                                            │
│     🖼️  Nenhuma campanha encontrada        │
│                                            │
│     Suas campanhas aparecerão aqui          │
│     depois de geradas.                      │
│                                            │
│     [  Criar Primeira Campanha  ]           │
│                                            │
└────────────────────────────────────────────┘
```

CTA "Criar Primeira Campanha" → redireciona para `/` (formulário de geração).

---

### D5 — Navegação: link no `AuthHeader`

`CONFIRMADO`

O `AuthHeader` (server component) atualmente renderiza apenas o `LogoutButton`. Passa a renderizar:

```
┌──────────────────────────────────────────────┐
│  [Minhas Campanhas]                    [Sair] │
└──────────────────────────────────────────────┘
```

**Implementação:** Modificar `src/components/auth/auth-header.tsx` para incluir link `href="/minhas-campanhas"` antes do `LogoutButton`. O link aparece para todo usuário autenticado — `/minhas-campanhas` redireciona para `/store` se não houver loja. Evita `getCurrentStore` no header global. Não criar route group `(protected)` — esta fase usa o caminho mais curto.

**Link na página `/campanha/[id]`:** Adicionar um link "← Minhas Campanhas" no topo da página individual, permitindo navegação de volta à lista.

---

### D6 — Redirecionamento de `/campaign/preview`

`CONFIRMADO`

A rota `/campaign/preview` (legado da era sessionStorage) está "morta" desde a F14 — sessionStorage não é mais escrito como fonte de verdade. Nesta fase:

1. Adicionar verificação no início da página: se usuário autenticado com loja, redirecionar (302) para `/minhas-campanhas`
2. Caso contrário (não autenticado), manter comportamento existente (eventualmente cai no middleware → login)

**Alternativa considerada:** Remover a rota fisicamente. **Descartada** porque pode haver links salvos e porque a rota não causa dano. Redirect é mais seguro.

---

### D7 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **16-01** | Contrato de listagem | `src/lib/campaign/list.ts`: `listCampaigns(storeId)`, `CampaignListItem`, `generateBatchThumbnailUrls` |
| **16-02** | UI `/minhas-campanhas` + navegação | `page.tsx` (Server), `client.tsx` (Client): lista, estado vazio, header, middleware, link em `/campanha/[id]` |
| **16-03** | Testes e cleanup legado | Testes do helper, page states, middleware matcher, redirect `/campaign/preview`, typecheck/lint/build |

```
16-01 ──► 16-02 ──► 16-03
(contrato)  (UI)    (validação)
```

---

## Estrutura de Código

```
src/app/minhas-campanhas/
  page.tsx                    ← NOVO: Server Component (requirePageUser → getCurrentStore → listCampaigns)
  client.tsx                  ← NOVO: Client Component (lista, estados, thumbnails)

src/lib/campaign/
  list.ts                     ← NOVO: listCampaigns, CampaignListItem, generateBatchThumbnailUrls
  display.ts                  ← inalterado
  persistence.ts              ← inalterado
  types.ts                    ← inalterado
  image-processor.ts          ← inalterado

src/components/auth/
  auth-header.tsx             ← MODIFICADO: adicionar link "Minhas Campanhas"

src/app/campanha/[id]/
  client.tsx                  ← MODIFICADO: adicionar link "← Minhas Campanhas" no topo

src/app/campaign/preview/
  page.tsx                    ← MODIFICADO: redirect para /minhas-campanhas se autenticado com loja

src/middleware.ts              ← MODIFICADO: adicionar /minhas-campanhas ao config.matcher
                               ( /campaign/preview já é coberto pelo glob /campaign/:path* da F15 )
```

---

## Testes

### `list.test.ts`

| Teste | O que valida |
|-------|-------------|
| `listCampaigns` retorna campanhas da loja | SELECT RLS filtrando por `store_id` |
| `listCampaigns` retorna apenas `ready` + `error` | Filtro `status IN (...)` |
| `listCampaigns` retorna array vazio para loja sem campanhas | Sem campanhas → `[]` |
| `listCampaigns` retorna array vazio para outro tenant (RLS) | Cross-tenant → `[]` (ou null) |
| `generateBatchThumbnailUrls` gera URLs para campanhas `ready` | Signed URL por item |
| `generateBatchThumbnailUrls` não gera URL para `error` | `thumbnailUrl` = null |
| `generateBatchThumbnailUrls` com falha parcial | `Promise.allSettled` trata erro → placeholder |

### `page.test.tsx`

| Teste | O que valida |
|-------|-------------|
| Lista exibe N campanhas com thumbnail + nome + data + status + "Abrir" | Conteúdo presente para cada item |
| "Baixar" visível apenas em campanhas `ready` | Ausente em `error` |
| Estado vazio exibe mensagem + CTA "Criar Primeira Campanha" | Mensagem + link |
| Lista exibe placeholder para thumbnail com falha | Placeholder renderizado |

### `auth-header.test.tsx`

| Teste | O que valida |
|-------|-------------|
| Header mostra "Minhas Campanhas" quando autenticado | Link presente |
| Header não mostra link quando não autenticado | Apenas conteúdo original |

### `middleware.test.ts`

| Teste | O que valida |
|-------|-------------|
| Matcher contém `/minhas-campanhas` | `config.matcher.includes("/minhas-campanhas")` |
| `/campaign/preview` é coberto pelo glob existente | Validar que o glob `/campaign/:path*` em `config.matcher` cobre a rota (já existe da F15) |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Muitas signed URLs em paralelo na listagem | `Promise.allSettled` + `LIMIT 50`. N máximo de 50 chamadas simultâneas — aceitável para serverless |
| Signed URL expira enquanto usuário navega na lista | 1h de validade. Recarregar a página gera novas URLs |
| Lojista com 0 campanhas vê página vazia sem orientação | Estado vazio com CTA claro "Criar Primeira Campanha" |
| Link "Minhas Campanhas" quebra se loja não tem store | AuthHeader mostra link para todo autenticado. O Server Component da página redireciona para `/store` se `getCurrentStore` for null — sem custo de `getCurrentStore` no header global |
| `/campaign/preview` ainda tem tráfego de bookmarks antigos | Redirect 302 é suave. Usuário chega ao destino correto sem erro |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Paginação visível ("Load More" / páginação) | `LIMIT 50` interno é suficiente. Paginação = feature futura |
| Filtros ou busca na lista | Lista simples ordenada por data — milestone pede lista básica |
| `sharp` ou geração de miniaturas dedicadas | CSS `object-cover` resolve. Sem custo de processamento extra |
| Route group `(protected)` | `AuthHeader` modificado é suficiente. Criar layout protegido é arquitetura, não entrega |
| Campanhas `generating` na lista | Excluídas por decisão da milestone. Job de cleanup de generating stale é futuro |
| Edição de publication copy | Fase 17 condicional |
| Remoção física de `/campaign/preview` | Redirect é mais seguro que remover rota |
| Remoção de `/api/campaign/generate` (legado) | Cleanup posterior |
| Supabase gen types | Pós-v1.3 |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — `listCampaigns` em `src/lib/campaign/list.ts` com `createServerClient` + RLS
- [ ] D2 — Thumbnails: signed URL server-side em batch com `Promise.allSettled`
- [ ] D3 — Lista mostra apenas `ready` + `error`. `generating` excluído
- [ ] D4 — Estado vazio com CTA "Criar Primeira Campanha"
- [ ] D5 — Link "Minhas Campanhas" no `AuthHeader` + link volta na página individual
- [ ] D6 — `/campaign/preview` redireciona para `/minhas-campanhas`
- [ ] D7 — Três planos de execução: 16-01 | 16-02 | 16-03

### Plano 16-01 — Contrato de listagem
- [ ] `src/lib/campaign/list.ts` com `listCampaigns(storeId)` usando `createServerClient` + RLS
- [ ] `CampaignListItem` com campos: id, productName, status, createdAt, thumbnailUrl, storagePath
- [ ] Filtro `status IN ('ready', 'error')`
- [ ] Ordenação `created_at DESC` com `LIMIT 50`
- [ ] `generateBatchThumbnailUrls(items)` via `Promise.allSettled`
- [ ] Placeholder para thumbnail com falha ou campanha `error`

### Plano 16-02 — UI + navegação
- [ ] Server Component `page.tsx`: `requirePageUser()` → `getCurrentStore()` → se null, redirect(`/store`) → `listCampaigns(storeId)`
- [ ] Client Component `client.tsx` com lista de cards: thumbnail, nome, data, status, "Abrir". "Baixar" apenas para `ready`
- [ ] Estado vazio: mensagem + CTA "Criar Primeira Campanha" → `/`
- [ ] `AuthHeader`: link "Minhas Campanhas" entre o conteúdo e "Sair"
- [ ] `/campanha/[id]/client.tsx`: link "← Minhas Campanhas" no topo
- [ ] `/campaign/preview/page.tsx`: redirect para `/minhas-campanhas` se autenticado com loja
- [ ] `middleware.ts`: adicionar `/minhas-campanhas` ao `config.matcher` ( `/campaign/preview` já coberto pelo glob `/campaign/:path*` )

### Plano 16-03 — Testes e validação
- [ ] Testes do helper `listCampaigns` (owner, vazio, cross-tenant, filtro status)
- [ ] Testes do `generateBatchThumbnailUrls` (sucesso, falha parcial, error filter)
- [ ] Testes do Client Component (lista com N itens, empty state)
- [ ] Testes do `AuthHeader` (link presente/ausente)
- [ ] Teste do middleware matcher: `/minhas-campanhas` adicionado; `/campaign/preview` já coberto pelo glob existente
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-10*
*Baseado no alinhamento da milestone v1.3, implementação das Fases 12-15, e discussão de exploração da Fase 16*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 16*
