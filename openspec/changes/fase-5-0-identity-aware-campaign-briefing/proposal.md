## Why

A identidade da loja (text_only, logo, visual_signature) não é exposta ao pipeline de geração de campanhas. O prompt do diretor de imagens instrui sempre "a loja possui um logotipo real", independentemente do estado real — causando alucinação de logotipo em lojas text_only e ignorando a assinatura visual em lojas com VS. A resolução da identidade ocorre 3 vezes no mesmo fluxo (endpoint, server action, bloco visual) com dados fragmentados entre `logoUrl`, `visualSignatureUrl` e `brandProfile.logoVariantUrl`. A assinatura visual nunca chega como referência visual para a OpenAI.

## What Changes

- Centraliza a resolução da identidade no backend: cliente envia apenas `storeId` + dados do produto
- `StoreIdentitySnapshot` ganha `identityState` e `signature` unificado (substitui `logoUrl`, `visualSignatureUrl`, `visualSignatureType`)
- `resolveStoreIdentity()` reescrita como pipeline declarativo (loja → profile → asset), sem directive
- `validateIdentityReference()` nova: valida URL do asset com fetch antes do briefing; retorna cópia com `signature.url = null` quando irrecuperável
- `buildCampaignBrief()` nova: deriva `directive` a partir de `identityState` + `signature.url` (5 cenários: com/sem asset para cada estado + text_only)
- `GenerateImageRequestSchema` reformulado: adiciona `storeId`, preserva todos os campos atuais de campanha/produto e `inputValidationOverride`, e remove apenas `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl` e `brandProfile`.
- `GET /api/store/:id` passa a retornar Store + StoreIdentitySnapshot em uma passada, eliminando a resolução duplicada no cliente
- `CampaignBrief` (tipo interno, sem Zod): contrato padronizado com product, store, brandProfile, identity
- `campaign-image-director.md`: instrução fixa de logotipo substituída por `{{identityDirective}}` injetada
- `ImageProviderInput` e `OpenAIImageProvider`: `identityImageUrl` substitui `logoImageUrl`; fallback `images.edit` enviado com `[productFile, identityFile]`
- `BrandProfileSnapshot` sem `logoVariantUrl` (VS passa pelo `signature` unificado)
- `CampaignRenderer`, `StoreIdentityBlock`, `StoreVisualSignatureSection`: consomem `signature` unificado
- `CampaignPageClient`, `StoreIdentityBlock`: deixam de chamar `resolveStoreIdentity` separadamente
- `CampaignInputForm`: props `storeId` em vez de `storeIdentity`
- `preview/page.tsx`: normalização de snapshot legado (sem `identityState`)
- **BREAKING**: `generate-image` request body muda — `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl` e `brandProfile` não são mais aceitos como entrada do cliente

> **Preservação comportamental:** Esta fase não altera o comportamento criativo do diretor de campanhas. Nenhum campo opcional passa a ser gerado, preenchido, reinterpretado ou tornado obrigatório. A única mudança no prompt é a instrução de identidade visual, que passa a ser compatível com o estado e o ativo disponível.

## Capabilities

### New Capabilities

- `identity-aware-campaign-briefing`: Camada centralizada de briefing entre identidade da loja e geração de campanhas. Resolve identidade no backend, valida referência visual, deriva directive condicional ao estado, e monta `CampaignBrief` padronizado.

### Modified Capabilities

- `store-identity-foundation`: `StoreIdentitySnapshot` ganha `identityState` explícito e `signature` unificado em vez de `logoUrl`/`visualSignatureUrl` separados. `resolveStoreIdentity` reescrita como pipeline declarativo.
- `ai-image-generation`: Geração de imagem passa a receber `storeId` em vez de dados pré-resolvidos. Schema de entrada muda. Provider recebe `identityImageUrl` em vez de `logoImageUrl`. Prompt injeta `identityDirective` condicional ao estado.
- `store-brand-profile`: `BrandProfileSnapshot` perde `logoVariantUrl` — asset de identidade passa a ser definido exclusivamente por `signature.url` no snapshot da loja.
- `campaign-visual-renderer`: Consome `signature.url` + `signature.type` em vez de `logoUrl`/`visualSignatureUrl` separados.
- `campaign-input-ui`: Formulário de campanha recebe `storeId` em vez de `StoreIdentitySnapshot` completo. Dados de identidade resolvidos no backend.
- `campaign-preview-page`: Normalização de payload legado (snapshot sem `identityState`) para o novo formato.
- `creative-direction-context`: `CreativeBrief` existente trata VS apenas como ativo de renderização; precisa refletir que o briefing condicional ao estado de identidade é resolvido antes da geração.
- `generation-retry-fallback`: Fallback `images.edit` deve preservar identidade visual enviando `[productFile, identityFile]`. Se a referência validada deixar de carregar, falha de forma controlada (erro ao cliente), não degradação silenciosa.

## Impact

- **Arquivos alterados**: ~16 (tipos, server actions, componentes, schemas, provider, prompt, páginas)
- **Nenhuma migration**, alteração de storage, ou design system tokens
- **Prompt alterado**: `campaign-image-director.md` — instrução fixa → variável injetada
- **API change (breaking)**: `POST /api/campaign/generate-image` — body muda de formato (remove dados derivados da loja)
- **API change**: `GET /api/store/:id` — resposta enriquecida com `StoreIdentitySnapshot`
