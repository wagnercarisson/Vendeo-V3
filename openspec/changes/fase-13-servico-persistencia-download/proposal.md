## Why

A Fase 12 criou a fundação (tabela `campaigns`, bucket `campaign-images`, RLS), mas não há camada de persistência isolada. Após a renderização, a imagem é exibida no preview e descartada — não há helpers de escrita/leitura, não há como baixar a campanha depois, não há registro de histórico. A milestone v1.3 exige persistência e entrega; esta fase (Fase 13) constrói o serviço de persistência desacoplado e a rota de download, mantendo o fluxo de geração intacto para integração futura na Fase 14.

## What Changes

- Criar `src/lib/campaign/types.ts` com interfaces manuais (`CampaignStatus`, `CampaignRecord`, `CreateCampaignInput`, `CampaignReadyData`) e shapes mínimos v1 dos snapshots JSONB
- Criar `src/lib/campaign/persistence.ts` com 7 helpers exportados: `createCampaign`, `dataUrlToCampaignImage`, `uploadCampaignImage`, `updateCampaignReady`, `updateCampaignError`, `getCampaign`, `deleteCampaignImage` (helper secundário)
- Criar rota `GET /api/campaign/[id]/download` com signed URL + redirect 302, protegida por `requireApiUser` + `requireOwnership`
- Criar testes unitários: `src/__tests__/lib/campaign/persistence.test.ts` e `src/__tests__/api/campaign-download.test.ts`
- Nenhuma modificação no fluxo de geração existente (Fase 13 não toca `generate-image`)

## Capabilities

### New Capabilities
- `campaign-persistence-service`: Helpers de escrita/leitura sobre a tabela `campaigns` e bucket `campaign-images` — `createCampaign`, `dataUrlToCampaignImage`, `uploadCampaignImage`, `updateCampaignReady`, `updateCampaignError`, `getCampaign`, `deleteCampaignImage`
- `campaign-download-route`: Rota `GET /api/campaign/[id]/download` com validação UUID, `requireOwnership`, signed URL de 1h e redirect 302
- `campaign-types`: Interfaces manuais `CampaignStatus`, `CampaignRecord`, `CreateCampaignInput`, `CampaignReadyData` e shapes mínimos v1 dos snapshots (`input_snapshot`, `identity_snapshot`, `render_snapshot`, `publication_copy_snapshot`, `generation_metadata`)

### Modified Capabilities
- `multitenant-campaign-guards`: Adicionar `GET /api/campaign/[id]/download` ao conjunto de rotas protegidas por multitenancy, seguindo o padrão existente de `requireApiUser` + `requireOwnership` + 404 para tenant mismatch
- `campaigns-table`: Adicionar operações de INSERT/UPDATE (service_role via `supabaseAdmin`) e SELECT (via `supabaseAdmin` para leitura de qualquer tenant com verificação de ownership no backend)
- `campaign-images-storage`: Adicionar operações de upload (INSERT via service_role, sem UPDATE por imutabilidade) e signed URL generation para download

## Impact

- **Novos arquivos:** `src/lib/campaign/types.ts`, `src/lib/campaign/persistence.ts`, `src/app/api/campaign/[id]/download/route.ts`, `src/__tests__/lib/campaign/persistence.test.ts`, `src/__tests__/api/campaign-download.test.ts`
- **App code:** Nenhum arquivo existente modificado — fluxo de geração intacto
- **Banco/Storage:** Nenhuma migration nova — dependências da Fase 12 (tabela `campaigns`, bucket `campaign-images`, RLS/Storage policies)
- **Dependências:** `supabaseAdmin` client (já existente), `requireApiUser` e `requireOwnership` (já existentes), `createSignedUrl` (já existente no Storage client)
- **Build:** `npm run typecheck`, `npm run lint`, `npm run build` — zero erros
