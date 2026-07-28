# Alinhamento Fase 15 — Página de Campanha `/campanha/[id]` (v1.3)

## Contexto

```
v1.3 — Persistência e Entrega da Campanha  (milestone)
  ├── Phase 12 — Fundação DB/Storage                                     ✅ completa
  ├── Phase 13 — Serviço de Persistência e Download                      ✅ completa
  ├── Phase 14 — Integração no Fluxo de Geração                          ✅ completa
  ├── Phase 15 — /campanha/[id]                                          ← esta fase
  ├── Phase 16 — /minhas-campanhas                                       (pendente)
  └── Phase 17 (cond) — Edição Publication Copy                          (condicional)
```

Esta fase constrói a página persistida do artefato gerado. Hoje o fluxo gera uma campanha e navega para `/campanha/[campaignId]` — rota que ainda não existe, resultando em 404. Após esta fase, o lojista acessa a campanha por URL persistida: vê a imagem final, o kit de publicação, estados de processamento e baixa o original.

**Dependências:** F12 (tabela `campaigns`, RLS SELECT), F13 (`CampaignRecord`, rota de download, storage conventions), F14 (registro `generating` + persistência automática, consumer já navega para `/campanha/[id]`).

---

## Propósito

1. Criar a página Server Component em `/campanha/[id]` com autenticação e ownership via RLS
2. Renderizar a imagem final (signed URL gerada server-side após autorização RLS)
3. Exibir o kit de publicação: caption, hashtags, cta_post
4. Tratar todos os estados da campanha: `ready`, `generating`, `error`, stale `generating`, 404
5. Reutilizar a rota `GET /api/campaign/[id]/download` para download do original

**Entrega verificável:**
- O usuário gera uma campanha, é redirecionado para `/campanha/[id]` e vê a imagem + metadados
- O usuário pode baixar o original via botão na página
- Campanha de outro tenant retorna 404 (RLS cuida — consulta vazia → `notFound()`)
- Estados `generating`, `ready`, `error` e stale geração têm tratamento visual distinto
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F14)

```
                                     ANTES (F14)                        DEPOIS (F15)
═══════════════════════════════════════════════════════════════════════════════════════
/campanha/[id]                       ✗ 404 (rota não existe)             ✓ página completa
/minhas-campanhas                    ✗ não existe                        ✗ (F16)

getCampaignForDisplay(id)            ✗ não existe                        ✓ createServerClient + RLS
generateSignedPreviewUrl(path)       ✗ não existe                        ✓ supabaseAdmin.createSignedUrl

Página de campanha:
  ready: imagem + copy + download    ✗                                   ✓
  generating: estado de espera       ✗                                   ✓ com polling
  error: mensagem + CTA nova         ✗                                   ✓
  stale generating: > timeout        ✗                                   ✓ exibido como erro técnico
  404 multitenant                    ✗                                   ✓ (RLS → notFound)

Middleware matcher:
  /campanha/:path*                   ✗                                   ✓ adicionado

/campaign/preview                    rota morta (session_                fora do escopo da F15
                                     storage não escrito)
```

---

## Decisões de Arquitetura

### D1 — `getCampaignForDisplay` com RLS, não `supabaseAdmin`

`CONFIRMADO`

O helper `getCampaign` em `persistence.ts` usa `supabaseAdmin` (service role), o que está correto para operações de backend (download, geração). Para a página, a consulta deve usar `createServerClient` com a sessão do usuário autenticado, respeitando a RLS SELECT policy (`owner_select_campaigns`).

```
CLIENTE DE SESSÃO + RLS:
  createServerClient(cookies)
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  Se o usuário não for dono da loja → RLS filtra → data = null → notFound()
  Se a campanha não existir → maybeSingle → data = null → notFound()
  Se for dono → retorna o registro completo
```

**Motivos:**
- RLS já filtra por `store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())`
- 404 automático para outro tenant (invariante #4 da milestone)
- Elimina necessidade de `requireOwnership` manual na página
- Padrão consistente com outras Server Components (ex.: `page.tsx` da home usa `getCurrentStore` via RLS)

**Helper único:** `getCampaignForDisplay(id)` — apenas para leitura em Server Components. Não substitui `getCampaign` do `persistence.ts`.

---

### D2 — Signed URL server-side para exibição da imagem

`CONFIRMADO`

A imagem final está no bucket privado `campaign-images`. Para exibi-la na página, o Server Component gera uma signed URL **após** a campanha ter sido autorizada via RLS.

```
getCampaignForDisplay(id) → RLS autoriza → data retorna
  → se status === "ready":
      supabaseAdmin.storage.from("campaign-images").createSignedUrl(storagePath, 3600)
      signedUrl vai para o Client Component como prop
  → se generating, error ou stale: signedUrl = null
  → <img src={signedUrl} /> renderiza a imagem (apenas em ready)
```

**Notas:**
- `expiresIn: 3600` (1 hora) — mesma política da rota de download
- Signed URL só é gerada quando `status === "ready"` — estados `generating`, `error` e `stale` não precisam de URL de storage
- Se expirar, o usuário recarrega a página e ganha nova URL
- A rota de download (`GET /api/campaign/[id]/download`) é reutilizada para o botão "Baixar", não para exibição inline

---

### D3 — Tratamento de estados da campanha na UI

`CONFIRMADO`

| Estado | Trigger | Comportamento |
|--------|---------|---------------|
| `ready` | `status = "ready"` | Imagem + caption + hashtags + cta_post + botão baixar |
| `generating` | `status = "generating"` e `updated_at` recente | Spinner + mensagem "Sua campanha está sendo gerada..." + auto-poll a cada 5s |
| `stale generating` | `status = "generating"` e `updated_at` > timeout configurado | Exibir como erro técnico: "Geração interrompida. Tente novamente." + CTA para nova geração |
| `error` | `status = "error"` | Mensagem amigável + CTA "Criar Nova Campanha" |
| 404 | Campanha não encontrada (não existe ou outro tenant) | `notFound()` → página 404 padrão |

**Regra de stale timeout:**
```ts
const GENERATION_GLOBAL_TIMEOUT_MS = 300_000; // 5 min (IMAGE_GENERATION_GLOBAL_TIMEOUT_MS em config.ts)
const STALE_MARGIN_MS = 30_000; // margem de segurança
const isStale = (updatedAt: string) =>
  Date.now() - new Date(updatedAt).getTime() > GENERATION_GLOBAL_TIMEOUT_MS + STALE_MARGIN_MS;
```

Regra exclusivamente de UI. Não há job de cleanup de banco — isso é futuro.

**Nota de implementação:** o valor de `GENERATION_GLOBAL_TIMEOUT_MS` deve ser importado de `@/lib/image-generation/config` — não duplicar o número magicamente em `display.ts`.

---

### D4 — Polling para estado `generating`

`CONFIRMADO`

Se a campanha estiver `generating` com `updated_at` recente (< timeout), a página deve fazer polling para detectar a transição para `ready` ou `error`.

```
┌─────────────────────────────────────────────────┐
│  /campanha/[id] — estado generating              │
│                                                  │
│  "Sua campanha está sendo gerada..."             │
│  [████████░░░░░░░░░░]                            │
│                                                  │
│  Poll a cada 5s:                                 │
│    router.refresh() → Server Component           │
│      reexecuta getCampaignForDisplay(id)         │
│    Se status = ready → img + copy aparecem       │
│    Se status = error → mensagem de erro          │
│    Se stale → exibe erro técnico                 │
└─────────────────────────────────────────────────┘
```

**Decisão:** Não criar API nova (`/api/campaign/[id]/status`) na F15. O Client Component chama `router.refresh()` a cada 5s enquanto `generating`, forçando o Server Component a reexecutar `getCampaignForDisplay(id)`. Menos superfície de código, sem auth/rota nova, sem estado duplicado.

---

### D5 — `publication_copy_snapshot` exibido na página

`CONFIRMADO`

O snapshot já é gerado e persistido na F14. A F15 apenas exibe:

```
📱 Kit de Publicação
─────────────────────
Caption:  "Tênis Runner Pro — Conforto e estilo para seu dia a dia"
Hashtags: #calcados #oferta #tenisrunnerpro
CTA:      "Compre agora pelo WhatsApp"
```

O snapshot é imutável na v1.3 (coluna `publication_copy_snapshot`). Edição futura usaria `publication_copy_current` (F17 condicional).

---

### D6 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **15-01** | Data/display contract | `getCampaignForDisplay(id)` com RLS, `generateSignedPreviewUrl(path)`, validação UUID, mapeamento de snapshots com fallback |
| **15-02** | UI `/campanha/[id]` | Server Component + Client Component: imagem, kit de publicação, download, 4 estados (ready/generating/error/stale), 404 |
| **15-03** | Testes e middleware | Testes do helper (RLS, signed URL, UUID), testes da página (4 estados + 404), middleware matcher, typecheck/lint/build |

```
15-01 ──► 15-02 ──► 15-03
(contrato)   (UI)    (validação)
```

---

## Estrutura de Código

```
src/app/campanha/[id]/
  page.tsx                    ← NOVO: Server Component (requirePageUser → getCurrentStore → getCampaignForDisplay)
  client.tsx                  ← NOVO: Client Component (imagem, copy, download, estados)

src/lib/campaign/
  display.ts                  ← NOVO: getCampaignForDisplay, generateSignedPreviewUrl
  persistence.ts              ← inalterado (7 helpers da F13)
  types.ts                    ← inalterado
  image-processor.ts          ← inalterado

src/app/api/campaign/
  [id]/
    download/
      route.ts                ← inalterado (F13)

src/middleware.ts              ← MODIFICADO: adicionar /campanha/:path* ao matcher
```

---

## Testes

### `display.test.ts`

| Teste | O que valida |
|-------|-------------|
| `getCampaignForDisplay` retorna campanha para owner | RLS permite SELECT |
| `getCampaignForDisplay` retorna null para não owner | Mock de createServerClient retorna null → 404 (comportamento esperado do RLS, validado em F12) |
| `getCampaignForDisplay` retorna null para ID inexistente | maybeSingle → null |
| `getCampaignForDisplay` rejeita UUID inválido | Erro ou null |
| `generateSignedPreviewUrl` retorna URL para path válido | String começando com https:// |
| `generateSignedPreviewUrl` rejeita path vazio | Erro |
| Mapeamento de snapshots com fallback | Campos nulos → string vazia / array vazio |

### `page.test.tsx` (se viável com renderização Server Component)

| Teste | O que valida |
|-------|-------------|
| `ready` exibe imagem + caption + hashtags + cta_post + botão baixar | Conteúdo presente |
| `generating` exibe spinner + mensagem | Polling não testado em unit |
| `error` exibe mensagem + CTA nova campanha | Conteúdo presente |
| `stale generating` exibe como erro técnico | Mensagem de geração interrompida |
| 404 para campanha inexistente | notFound() chamado |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Signed URL para exibição expira durante navegação | 1h de validade. Se expirar, recarregar a página gera nova URL |
| Usuário cai em `/campanha/[id]` com `generating` e o registro está preso (nunca vai transicionar) | Regra de stale: se `updated_at` > timeout + margem, exibe como erro. Usuário pode gerar nova |
| Polling excessivo em `generating` | Intervalo de 5s. Componente desmonta se usuário sai da página |
| RLS policy não encontrada (migração não executada em algum ambiente) | Já verificada na F12-UAT. Teste de smoke SQL incluso |
| `createServerClient` não encontra sessão (cookie expirado) | Middleware renova sessão antes de chegar na página (após adicionar `/campanha/[id]` ao matcher) |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| `/minhas-campanhas` | Fase 16 |
| `listCampaigns(storeId)` | Fase 16 |
| Header/nav com "Minhas Campanhas" | Fase 16 (ou link discreto após lista existir) |
| Thumbnail strategy | Fase 16 |
| Expandir `render_snapshot` para diretivas visuais | Pós-v1.3. Shape atual não bloqueia exibição |
| Remover `/api/campaign/generate` (legado) | Cleanup posterior |
| Reescrever `/campaign/preview` | Rota está morta (sessionStorage não é mais escrito). Fora do escopo da F15. Pode virar redirect em cleanup futuro |
| Job de cleanup de `generating` stale no banco | Futuro. A regra de stale é apenas de UI nesta fase |
| Edição de publication copy | Fase 17 condicional (pós-v1.3) |
| Supabase gen types | Pós-v1.3 |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — `getCampaignForDisplay` com `createServerClient` + RLS (não supabaseAdmin)
- [ ] D2 — Signed URL server-side para exibição da imagem, após autorização RLS
- [ ] D3 — 4 estados na UI: ready, generating, stale generating (> timeout), error
- [ ] D4 — Polling a cada 5s para estado generating (recarrega ao transicionar)
- [ ] D5 — `publication_copy_snapshot` exibido como caption + hashtags + cta_post
- [ ] D6 — Três planos de execução: 15-01 | 15-02 | 15-03

### Plano 15-01 — Data/display contract
- [ ] `src/lib/campaign/display.ts` com `getCampaignForDisplay(id)` usando `createServerClient` + RLS
- [ ] `generateSignedPreviewUrl(storagePath)` com `supabaseAdmin.storage.createSignedUrl`
- [ ] Validação de UUID v4 no ID da rota (params)
- [ ] Mapeamento de snapshots com fallback seguro (null → string vazia / array vazio)
- [ ] Constante de stale timeout: `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000` (5 min + margem)

### Plano 15-02 — UI `/campanha/[id]`
- [ ] Server Component `page.tsx`: `requirePageUser()` → `getCurrentStore()` → se null, redirect(`/store`) → `getCampaignForDisplay(id)`
- [ ] Se campanha não encontrada → `notFound()`
- [ ] Client Component `client.tsx` com props: imageUrl, caption, hashtags, ctaPost, status, createdAt, updatedAt
- [ ] Estado `ready`: imagem + caption + hashtags + cta_post + botão baixar (link para `/api/campaign/[id]/download`)
- [ ] Estado `generating`: spinner + mensagem + polling automático a cada 5s
- [ ] Estado `stale generating`: mensagem "Geração interrompida" + CTA para nova campanha
- [ ] Estado `error`: mensagem amigável + CTA "Criar Nova Campanha"
- [ ] 404: Next.js `notFound()`
- [ ] Botão de download reusa `GET /api/campaign/[id]/download`

### Plano 15-03 — Testes e middleware
- [ ] Testes do helper `getCampaignForDisplay` (owner, não owner, inexistente, UUID inválido)
- [ ] Testes do `generateSignedPreviewUrl` (path válido, path vazio)
- [ ] Testes de exibição dos 4 estados na página
- [ ] `middleware.ts`: adicionar `/campanha/:path*` ao `config.matcher`
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-09*
*Baseado no alinhamento da milestone v1.3, implementação das Fases 12-14, e revisão técnica do alinhamento F15*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 15*
