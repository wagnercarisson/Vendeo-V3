## Why

As Fases 12-15 implementaram a fundação completa de persistência de campanhas: tabela, bucket, helpers de escrita/leitura, pipeline de geração com persistência automática e a página individual `/campanha/[id]`. O lojista consegue gerar, ver e baixar uma campanha — mas apenas se guardou o link ou acabou de gerar. Não há um ponto de entrada para **encontrar** campanhas passadas. Sem esta fase, o critério de conclusão da milestone v1.3 ("gerou, saiu, voltou, encontrou e baixou") permanece incompleto: o lojista não consegue reencontrar campanhas sem o link direto.

## What Changes

- **Novo `src/lib/campaign/list.ts`**: helper `listCampaigns(storeId)` com `createServerClient` + RLS filtrando `status IN ('ready', 'error')`, ordenando por `created_at DESC` com `LIMIT 50`, e geração de signed URLs em batch para thumbnails via `Promise.allSettled`
- **Nova página `src/app/minhas-campanhas/page.tsx`**: Server Component com `requirePageUser()` → `getCurrentStore()` (redirect `/store` se null) → `listCampaigns(storeId)`, passando dados serializáveis ao Client Component
- **Novo `src/app/minhas-campanhas/client.tsx`**: Client Component com lista de cards (thumbnail, nome do produto, data formatada, status visual, "Abrir" e "Baixar" apenas para `ready`) + estado vazio com CTA "Criar Primeira Campanha"
- **`src/components/auth/auth-header.tsx`**: adicionar link "Minhas Campanhas" antes do `LogoutButton` para usuários autenticados
- **`src/app/campanha/[id]/client.tsx`**: adicionar link "← Minhas Campanhas" no topo da página individual
- **`src/app/campaign/preview/page.tsx`**: adicionar redirect (302) para `/minhas-campanhas` se usuário autenticado com loja
- **`src/middleware.ts`**: adicionar `/minhas-campanhas` ao `config.matcher`

## Capabilities

### New Capabilities
- `list-contract`: Helper de listagem de campanhas via RLS (`listCampaigns(storeId)`) com filtro de status, ordenação, `LIMIT 50` interno e geração batch de signed URLs para thumbnails via `Promise.allSettled`
- `campaign-list-ui`: Server Component (`/minhas-campanhas`) com autenticação, ownership via RLS, e Client Component com lista de cards (thumbnail, nome, data, status, ações) + estado vazio com CTA
- `campaign-list-tests`: Testes do helper `listCampaigns` (owner, vazio, cross-tenant, filtro status), `generateBatchThumbnailUrls` (sucesso, falha parcial, error filter), página (lista, empty state), `AuthHeader` (link presente/ausente), middleware matcher, e build verification

### Modified Capabilities
- `campaign-preview-page`: Requisito de server wrapper modificado — usuário autenticado com loja é redirecionado para `/minhas-campanhas` em vez de renderizar `CampaignPreviewClient`
- `store-ownership-pages`: Requisito de `/campaign/preview` modificado — usuário autenticado com loja é redirecionado para `/minhas-campanhas` em vez de renderizar `CampaignPreviewClient`

## Impact

- **Novos arquivos:** `src/lib/campaign/list.ts`, `src/app/minhas-campanhas/page.tsx`, `src/app/minhas-campanhas/client.tsx`, `src/__tests__/lib/campaign/list.test.ts`, `src/__tests__/app/minhas-campanhas.test.tsx`
- **Arquivos modificados:** `src/components/auth/auth-header.tsx` (link "Minhas Campanhas"), `src/app/campanha/[id]/client.tsx` (link "← Minhas Campanhas"), `src/app/campaign/preview/page.tsx` (redirect), `src/middleware.ts` (matcher)
- **Nenhuma alteração em:** `persistence.ts`, `types.ts`, `image-processor.ts`, `display.ts`, rota de download
