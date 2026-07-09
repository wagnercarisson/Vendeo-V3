## 1. Plano 15-01 — Data/Display Contract

- [x] 1.1 Criar `src/lib/campaign/display.ts` com `import "server-only"` e `getCampaignForDisplay(id)` — valida UUID v4, usa `createServerClient` com cookies para consultar `campaigns` via RLS, retorna `CampaignRecord | null` com `.maybeSingle()`
- [x] 1.2 Implementar `generateSignedPreviewUrl(storagePath)` — chama `supabaseAdmin.storage.from("campaign-images").createSignedUrl(storagePath, 3600)`, retorna URL ou null se path vazio. A função NÃO valida status — o caller (`page.tsx`) condiciona a chamada a `status === "ready"`
- [x] 1.3 Implementar `computeDisplayStatus(campaign)` — deriva `"ready"` | `"generating"` | `"stale"` | `"error"` a partir de `status` e `updated_at`, usando `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000` (server-only, importado de `config.ts`)
- [x] 1.4 Mapear snapshots com fallback: `publication_copy_snapshot`, `product_name`, `created_at`, `updated_at` → objeto serializável para o Client Component (null → string vazia / array vazio), incluindo `displayStatus` e `downloadUrl` pré-computados

## 2. Plano 15-02 — UI `/campanha/[id]`

- [x] 2.1 Criar `src/app/campanha/[id]/page.tsx` — Server Component: `requirePageUser()`, `getCurrentStore()` (redirect `/store` se null), `getCampaignForDisplay(id)` (notFound se null), calcular `displayStatus` ("ready" | "generating" | "stale" | "error") server-side usando `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000`, condicionar signed URL a `status === "ready"`, pré-computar `downloadUrl = "/api/campaign/${id}/download"`
- [x] 2.2 Criar `src/app/campanha/[id]/client.tsx` — Client Component com props: `imageUrl`, `caption`, `hashtags`, `ctaPost`, `displayStatus`, `createdAt`, `updatedAt`, `productName`, `downloadUrl`
- [x] 2.3 Implementar estado `ready` (displayStatus === "ready"): imagem + caption + hashtags + cta_post + botão "Baixar Original" (link para `downloadUrl`)
- [x] 2.4 Implementar estado `generating` (displayStatus === "generating"): spinner + "Sua campanha está sendo gerada..." + polling via `router.refresh()` a cada 5s com cleanup no useEffect
- [x] 2.5 Implementar stale generating (displayStatus === "stale"): exibir "Geração interrompida" + CTA para nova campanha. O cálculo de stale é feito server-side em `page.tsx` — o Client Component apenas consome o valor pré-computado
- [x] 2.6 Implementar estado `error` (displayStatus === "error"): mensagem amigável + CTA "Criar Nova Campanha" navegando para `/`
- [x] 2.7 Adicionar `/campanha/:path*` ao `config.matcher` em `src/middleware.ts`

## 3. Plano 15-03 — Tests & Verification

- [x] 3.1 Criar `src/__tests__/lib/campaign/display.test.ts` com testes: `getCampaignForDisplay` (owner, não owner mockado como null, inexistente, UUID inválido), `generateSignedPreviewUrl` (path válido, path vazio), `computeDisplayStatus` (ready, generating, stale, error)
- [x] 3.2 Criar testes de exibição dos 4 estados na página: ready (imagem + copy + download), generating (spinner), stale generating (erro técnico + CTA), error (mensagem + CTA), 404 (notFound)
- [x] 3.3 Rodar `npm run typecheck` — zero erros
- [x] 3.4 Rodar `npm run lint` — zero erros
- [x] 3.5 Rodar `npx vitest run` — todos os testes passando
- [x] 3.6 Rodar `npm run build` — build bem-sucedido
