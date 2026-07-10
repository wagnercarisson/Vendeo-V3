## Why

O publication copy (caption, hashtags, cta_post) é gerado pela IA e armazenado como snapshot imutável em `publication_copy_snapshot`. O lojista não pode ajustar o texto sem regerar a campanha inteira. Se a IA sugeriu um caption que não reflete a oferta real, ou se o lojista quer adicionar hashtags sazonais, ele precisa editar apenas o texto — sem alterar a imagem, sem nova geração. Esta fase cobre o gap entre o snapshot imutável da IA e a necessidade do lojista de ter controle editorial sobre o texto final.

## What Changes

- **Migration**: Adicionar coluna `publication_copy_current` (JSONB, nullable) em `campaigns` com `ADD COLUMN IF NOT EXISTS` para armazenar a versão editada. `publication_copy_snapshot` permanece imutável.
- **Novo `src/lib/campaign/publication-copy.ts`**: `validatePublicationCopy(body)` com regras de caption (1–2200 chars), hashtags (0–30 itens, formato `#` sem espaços), cta_post (0–200 chars), e suporte a `restore: true`. Interface `PublicationCopyUpdate`.
- **Modificar `types.ts`**: Adicionar `publication_copy_current: Record<string, unknown> | null` opcional em `CampaignRecord`.
- **Modificar `display.ts`**: `getEffectivePublicationCopy(campaign)` com fallback `current > snapshot > vazio`. `mapCampaignToProps` usar a nova função e expor `campaignId` e `isPublicationCopyEdited` ao Client Component.
- **Nova rota `PATCH /api/campaign/[id]/publication-copy`**: apiHandler com CSRF (`requireSameOrigin`), `requireApiUser`, busca campaign por id, `requireOwnership`, validação via `validatePublicationCopy`, persistência do `publication_copy_current` ou `restore: true` (limpa o campo), retorno 200 com dados atualizados.
- **Modificar `src/app/campanha/[id]/client.tsx`**: Adicionar modo edição inline com botões "Editar", "Salvar" (PATCH para `/api/campaign/${campaignId}/publication-copy`), "Restaurar original" (PATCH restore), "Cancelar" (descarte local). Badge "Editado" condicionado a `isPublicationCopyEdited`. Loading/error states no salvamento.

## Capabilities

### New Capabilities
- `publication-copy-migration`: Migration SQL `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS publication_copy_current JSONB` com COMMENT
- `publication-copy-validation`: Função `validatePublicationCopy(body)` e interface `PublicationCopyUpdate` em `src/lib/campaign/publication-copy.ts`
- `publication-copy-route`: Rota `PATCH /api/campaign/[id]/publication-copy` com apiHandler, CSRF, ownership, validação e persistência (edição + restore)
- `publication-copy-tests`: Testes de validação (8 cenários), rota PATCH (8 cenários), e UI de edição (9 cenários)

### Modified Capabilities
- `campaign-types`: Adicionar `publication_copy_current: Record<string, unknown> | null` opcional na interface `CampaignRecord`
- `campaign-display-contract`: Adicionar `getEffectivePublicationCopy(campaign)` com fallback `current > snapshot > vazio`; expor `campaignId` e `isPublicationCopyEdited`; substituir mapeamento direto do snapshot pela nova função
- `campaign-page-ui`: Adicionar modo edição inline no Client Component (`/campanha/[id]/client.tsx`) com botões Editar/Salvar/Restaurar/Cancelar, badge "Editado" via `isPublicationCopyEdited`, PATCH URL montada com `campaignId`, loading/error states

## Impact

- **Migration nova**: `supabase/migrations/_<timestamp>_add_publication_copy_current.sql`
- **Arquivos novos**: `src/lib/campaign/publication-copy.ts`, `src/app/api/campaign/[id]/publication-copy/route.ts`, `src/__tests__/lib/campaign/publication-copy.test.ts`, `src/__tests__/api/publication-copy-route.test.ts`, `src/__tests__/app/campanha/[id]/client.test.tsx`
- **Arquivos modificados**: `src/lib/campaign/types.ts`, `src/lib/campaign/display.ts`, `src/app/campanha/[id]/client.tsx`, `src/app/campanha/[id]/page.tsx` (passar `effectiveCopy`, `campaignId`, `isPublicationCopyEdited` ao Client Component)
- **Nenhuma alteração em**: `persistence.ts`, `image-processor.ts`, `list.ts`, rota de download, middleware
