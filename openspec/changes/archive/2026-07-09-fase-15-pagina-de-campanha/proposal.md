## Why

As Fases 12-14 estabeleceram a fundação de persistência de campanhas (tabela, bucket, helpers de escrita, pipeline de geração com INSERT `generating` → IA → transcode → upload → updateReady). O consumer já navega para `/campanha/[campaignId]` após a geração bem-sucedida, mas essa rota não existe — resulta em 404. Sem esta fase, o lojista não tem uma página persistida para visualizar, revisar e baixar a campanha que acabou de gerar, quebrando o critério de conclusão da milestone v1.3: "gerou, saiu, voltou, encontrou e baixou".

## What Changes

- **Novo `src/lib/campaign/display.ts`**: helper `getCampaignForDisplay(id)` com `createServerClient` + RLS (não `supabaseAdmin`), `generateSignedPreviewUrl(storagePath)` com `supabaseAdmin.storage.createSignedUrl` (caller condiciona a `status === "ready"`), e `computeDisplayStatus` server-side
- **Nova página `src/app/campanha/[id]/page.tsx`**: Server Component com `requirePageUser()` → `getCurrentStore()` (redirect `/store` se null) → `getCampaignForDisplay(id)` → `notFound()` se não encontrada. Pré-computa `displayStatus` (ready/generating/stale/error), `downloadUrl` e signed URL (só se ready) antes de passar ao client
- **Novo `src/app/campanha/[id]/client.tsx`**: Client Component que consome `displayStatus` pré-computado — `ready` (imagem + kit de publicação + download), `generating` (spinner + polling via `router.refresh()` a cada 5s), `error` (mensagem + CTA nova campanha), `stale` (mensagem de geração interrompida)
- **`src/middleware.ts`**: adicionar `/campanha/:path*` ao `config.matcher` para renovação de sessão
- **Stale timeout**: importar `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` de `config.ts` + margem de 30s — computado server-side em `page.tsx`, Client Component recebe `displayStatus` já resolvido

## Capabilities

### New Capabilities
- `campaign-display-contract`: Helper de leitura de campanha via RLS (`getCampaignForDisplay`) e geração de signed URL para preview (`generateSignedPreviewUrl`), com validação de UUID e mapeamento de snapshots com fallback
- `campaign-page-ui`: Server Component (`/campanha/[id]`) com autenticação, ownership via RLS, e Client Component com 4 estados visuais: ready, generating, error, stale generating
- `campaign-page-tests`: Testes do helper display (owner, não owner, inexistente, UUID inválido), signed URL (válido, vazio), e 4 estados da página

### Modified Capabilities
<!-- Nenhuma capability existente tem requisitos alterados. A página consome
     CampaignRecord e PublicationCopySnapshot já definidos em F13/F14. -->

## Impact

- **Novos arquivos:** `src/lib/campaign/display.ts`, `src/app/campanha/[id]/page.tsx`, `src/app/campanha/[id]/client.tsx`, `src/__tests__/lib/campaign/display.test.ts`, `src/__tests__/api/campaign-page.test.tsx`
- **Arquivos modificados:** `src/middleware.ts` (matcher)
- **Nenhuma alteração em:** `persistence.ts`, `types.ts`, `image-processor.ts`, rota de download, `generate-image/route.ts`, `use-campaign-form.ts`
