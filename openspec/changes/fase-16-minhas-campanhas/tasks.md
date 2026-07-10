## 1. Plano 16-01 — Contrato de Listagem

- [ ] 1.1 Criar `src/lib/campaign/list.ts` com `import "server-only"` e `listCampaigns(storeId)` — usa `createServerClient` com cookies para consultar `campaigns` via RLS, seleciona `id, product_name, status, created_at, storage_path`, filtra `store_id = storeId`, filtra `status IN ('ready', 'error')`, ordena `created_at DESC`, aplica `LIMIT 50`, retorna `CampaignListItem[]`
- [ ] 1.2 Definir `CampaignListItem` com campos: `id`, `productName`, `status`, `createdAt`, `thumbnailUrl` (`string | null`), `storagePath`
- [ ] 1.3 Implementar `generateBatchThumbnailUrls(items: CampaignListItem[])` — chama `supabaseAdmin.storage.from("campaign-images").createSignedUrl(path, 3600)` em paralelo via `Promise.allSettled` apenas para itens `ready` com `storagePath` não vazio, retorna `Record<id, string | null>` com fallback a `null` para falhas
- [ ] 1.4 Mapear `CampaignListItem` com `thumbnailUrl` populado no retorno de `listCampaigns`: itens `ready` recebem URL do batch, itens `error` ou com falha recebem `null`

## 2. Plano 16-02 — UI `/minhas-campanhas` + Navegação

- [ ] 2.1 Criar `src/app/minhas-campanhas/page.tsx` — Server Component: `requirePageUser()`, `getCurrentStore()` (redirect `/store` se null), `listCampaigns(storeId)`, passar `campaigns` serializável ao Client Component
- [ ] 2.2 Criar `src/app/minhas-campanhas/client.tsx` — Client Component que recebe `campaigns: CampaignListItem[]` e renderiza:
  - Lista de cards com thumbnail (signed URL ou placeholder), nome do produto, data formatada "dd/mm/aaaa", status visual (`ready`/`error`), link "Abrir" (`/campanha/[id]`), link "Baixar" (`/api/campaign/[id]/download`) apenas para `ready`
  - Estado vazio quando array vazio: "Nenhuma campanha encontrada" + "Suas campanhas aparecerão aqui depois de geradas." + CTA "Criar Primeira Campanha" → `/`
- [ ] 2.3 Modificar `src/components/auth/auth-header.tsx` — adicionar link "Minhas Campanhas" (`href="/minhas-campanhas"`) antes do `LogoutButton`, visível para usuários autenticados
- [ ] 2.4 Modificar `src/app/campanha/[id]/client.tsx` — adicionar link "← Minhas Campanhas" no topo da página
- [ ] 2.5 Modificar `src/app/campaign/preview/page.tsx` — adicionar verificação: se usuário autenticado com loja, redirect (302) para `/minhas-campanhas`; senão, manter comportamento existente
- [ ] 2.6 Adicionar `/minhas-campanhas` ao `config.matcher` em `src/middleware.ts`

## 3. Plano 16-03 — Testes e Validação

- [ ] 3.1 Criar `src/__tests__/lib/campaign/list.test.ts` com testes: `listCampaigns` (owner com campanhas, retorna apenas ready+error excluindo generating, loja sem campanhas → `[]`, cross-tenant RLS → `[]`), `generateBatchThumbnailUrls` (ready gera URLs, error não gera URL, falha parcial tratada com placeholder)
- [ ] 3.2 Criar testes do Server Component `/minhas-campanhas`: verificar que `requirePageUser()` é chamado, `getCurrentStore(userId)` é chamado, redirect para `/store` se `getCurrentStore` retorna null, `listCampaigns(storeId)` é chamado com storeId correto, dados são passados ao Client Component
- [ ] 3.3 Criar testes de exibição da página: lista com N campanhas (thumbnail + nome + data + status + "Abrir"), "Baixar" visível apenas em ready, estado vazio (mensagem + CTA), placeholder para thumbnail com falha
- [ ] 3.4 Criar testes do `AuthHeader`: link "Minhas Campanhas" presente quando autenticado, ausente quando não autenticado
- [ ] 3.5 Criar testes de redirect de `/campaign/preview`: autenticado com loja → redirect `/minhas-campanhas`; autenticado sem loja → redirect `/store`; não autenticado → redirect `/login`
- [ ] 3.6 Verificar middleware matcher: `/minhas-campanhas` presente em `config.matcher`
- [ ] 3.7 Rodar `npm run typecheck` — zero erros
- [ ] 3.8 Rodar `npm run lint` — zero erros
- [ ] 3.9 Rodar `npx vitest run` — todos os testes passando
- [ ] 3.10 Rodar `npm run build` — build bem-sucedido
