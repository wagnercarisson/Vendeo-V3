## Context

As Fases 12-14 criaram a infraestrutura de persistência de campanhas: tabela `campaigns`, bucket `campaign-images`, helpers de escrita/leitura em `persistence.ts`, rota de download via signed URL, e pipeline de geração que persiste automaticamente durante `POST /api/campaign/generate-image`. O consumer em `use-campaign-form.ts` já navega para `/campanha/[campaignId]`.

O que falta é a página que recebe esse redirecionamento. Hoje a rota não existe (404). O lojista que gerou uma campanha não tem onde vê-la — precisa confiar que o backend persistiu e que o download via `/api/campaign/[id]/download` funciona. Sem a página, o critério de conclusão da milestone ("gerou, saiu, voltou, encontrou e baixou") não é atingido.

Esta fase constrói a Server Component da campanha persistida, usando RLS para ownership, signed URL para exibição da imagem, e tratamento visual para todos os estados da campanha (`ready`, `generating`, `error`, stale).

## Goals / Non-Goals

**Goals:**
- Criar `src/lib/campaign/display.ts` com `getCampaignForDisplay(id)` usando `createServerClient` + RLS e `generateSignedPreviewUrl(storagePath)` — o caller (`page.tsx`) condiciona a chamada a `status === "ready"`
- Criar Server Component `/campanha/[id]` com `requirePageUser()` → `getCurrentStore()` (redirect `/store` se null) → `getCampaignForDisplay(id)` → `notFound()` se null — pré-computa `displayStatus` e `downloadUrl` server-side
- Criar Client Component com 4 estados visuais guiados por `displayStatus` pré-computado: ready (imagem + copy + download), generating (spinner + polling via `router.refresh()`), error (mensagem + CTA), stale generating (geração interrompida)
- Adicionar `/campanha/:path*` ao matcher do middleware
- Stale timeout importado de `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` + 30s margem — computado server-side em `page.tsx`
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

**Non-Goals:**
- `/minhas-campanhas` — Fase 16
- `listCampaigns(storeId)` — Fase 16
- Header/nav com "Minhas Campanhas" — Fase 16
- Thumbnail strategy — Fase 16
- Expandir `render_snapshot` para diretivas visuais — pós-v1.3
- Cleanup de `/api/campaign/generate` (legado) — futuro
- Reescrever `/campaign/preview` — fora do escopo
- Job de cleanup de `generating` stale no banco — futuro

## Decisions

### D1 — `getCampaignForDisplay` com RLS, não `supabaseAdmin`

`CONFIRMADO`

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

`CONFIRMADO`

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

`CONFIRMADO`

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

O Client Component recebe `displayStatus` já calculado — não importa `config.ts` nem calcula stale. Server-side apenas, regra de UI.

### D4 — Polling sem API nova

`CONFIRMADO`

Enquanto `generating`, o Client Component chama `router.refresh()` a cada 5 segundos, forçando o Server Component a reexecutar `getCampaignForDisplay(id)`. Quando o backend transiciona o status para `ready` ou `error`, a nova renderização reflete o estado atual.

- Não cria `/api/campaign/[id]/status`
- Não duplica lógica de auth ou RLS
- `router.refresh()` reexecuta o Server Component, que aplica o mesmo pipeline (RLS → signed URL condicionada)

### D5 — Kit de publicação exibido como snapshot imutável

`CONFIRMADO`

O `publication_copy_snapshot` (caption, hashtags, cta_post) é gerado e persistido na F14. A F15 apenas exibe os campos mapeados com fallback (null → string vazia / array vazio). Snapshot imutável na v1.3 — edição futura usaria `publication_copy_current` (F17 condicional).

### D6 — Client Component props contract

`CONFIRMADO`

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

`CONFIRMADO`

| Plano | Foco | Arquivos |
|-------|------|----------|
| **15-01** | Data/display contract | `display.ts` com `getCampaignForDisplay`, `generateSignedPreviewUrl`, `computeDisplayStatus`, mapeamento snapshots |
| **15-02** | UI `/campanha/[id]` | `page.tsx` (Server) + `client.tsx` (Client): 4 estados guiados por `displayStatus` + 404 |
| **15-03** | Testes e middleware | `display.test.ts`, testes de página (4 estados + 404), middleware matcher |

```
15-01 ──► 15-02 ──► 15-03
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Signed URL expira durante navegação | 1h de validade. Recarregar a página gera nova URL |
| `generating` preso (nunca transiciona) | Regra de stale: timeout + margem → exibe como erro. Usuário gera nova |
| Polling excessivo | Intervalo de 5s. Componente desmonta ao sair da página |
| `createServerClient` sem sessão (cookie expirado) | Middleware renova sessão (após adicionar `/campanha/:path*` ao matcher) |
| `getCurrentStore()` retorna null | Segue padrão da home: `redirect("/store")` |
