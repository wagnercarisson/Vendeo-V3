## Why

O Vendeo já gera campanhas visualmente fortes, mas campanhas diferentes da mesma loja não compartilham nenhuma identidade visual além do nome e (quando existe) logotipo. Sem uma assinatura visual consolidada, cada campanha parece vir de uma loja diferente — especialmente quando o lojista não tem logotipo próprio. Antes de persistir campanhas, precisamos garantir que toda campanha futura carregue uma identidade visual reconhecível da loja, mesmo que o lojista nunca tenha criado uma marca visual formal.

## What Changes

- **Detecção de ausência de logotipo no cadastro da loja**: após salvar a loja, o sistema verifica se `logo_url` está vazio.
- **Geração de assinatura visual via IA/diretor de arte**: quando não há logotipo, o sistema gera a imagem final da assinatura visual diretamente via IA geradora de imagens (Abordagem B), usando dados da loja (nome, segmento, cor principal, tom de voz). O resultado é uma imagem PNG pronta para uso como marca.
- **Persistência da assinatura visual em tabela própria**: criação de `store_visual_signatures` para armazenar múltiplas variações com metadados (storage_path, asset_url, type, status, generation_mode, prompt, metadata).
- **Assinatura visual ativa**: cada loja tem exatamente uma assinatura visual ativa, usada por todas as campanhas. Variações geradas para escolha começam como `draft`; a escolhida vira `active`; a anterior vai para `archived`. Fallback automático nasce como `active`.
- **Fluxo pós-salvamento da loja**: modal perguntando se o lojista quer escolher uma assinatura ou deixar o Vendeo criar automaticamente.
- **Upload de logotipo**: lojista pode enviar seu próprio logo via upload de arquivo no formulário da loja. O logo tem prioridade máxima na zona de identidade visual.
- **Fallback técnico em 2 níveis**: (1) IA gera imagem diretamente → (2) retry com prompt simplificado → (3) fallback tipográfico sem IA (iniciais + nome). Cada nível só é tentado se o anterior falhar.
- **Injeção da assinatura na renderização da campanha**: `CampaignRenderParams` passa a incluir `visualSignatureUrl` e `visualSignatureType` como ativo fixo de renderização. A assinatura NÃO é injetada no prompt de geração de imagem do diretor de arte — é um asset de render-time.
- **Troca controlada da assinatura ativa**: o lojista pode voltar ao cadastro, gerar novas variações e trocar a assinatura ativa com confirmação explícita.
- **Validação visual entre campanhas da mesma loja**: testes manuais comparando campanhas diferentes para verificar consistência.

## Capabilities

### New Capabilities
- `store-visual-signature`: criação, armazenamento e gerenciamento de assinaturas visuais leves para lojas sem logotipo, incluindo geração via IA, fallback tipográfico persistido, status ativo/draft/archived, e troca segura.

### Modified Capabilities
- `store-identity-foundation`: estender resolver para considerar assinatura visual como fallback quando não há logotipo (não substituir logo existente).
- `creative-direction-context`: o `CreativeBrief` deve receber e repassar a assinatura visual ativa como ativo fixo da loja, sem recriá-la por campanha.
- `store-identity-ui`: adicionar etapa de seleção/confirmação de assinatura visual pós-salvamento, e seção de gerenciamento de assinatura no cadastro da loja.
- `campaign-visual-renderer`: o `CampaignRenderParams` deve aceitar `visualSignatureUrl` e `visualSignatureType` para renderizar a assinatura na zona de identidade da loja.

## Impact

- **Nova migration**: `supabase/migrations/*_create_store_visual_signatures.sql` com tabela `store_visual_signatures` (store_id, storage_path, asset_url, type, status, generation_mode, prompt, metadata, created_at, updated_at), com partial unique index `WHERE status = 'active'` para garantir no máximo uma assinatura ativa por loja.
- **Nova tabela Supabase**: `store_visual_signatures` com store_id FK → stores(id), colunas storage_path (estável) e asset_url (resolvida). URL pública pode mudar (bucket, signed URL), storage_path é o identificador permanente.
- **`src/lib/store.ts`**: estender `resolveStoreIdentity` para considerar assinatura visual ativa como fallback quando não há logotipo.
- **`src/lib/image-generation/services/image-generation-service.ts`**: carregar `visualSignatureUrl` no fluxo pós-geração para aplicar na renderização, sem injetar no prompt do diretor de arte.
- **`src/lib/image-generation/types.ts`**: estender `CreativeBrief` e `CampaignRenderParams`.
- **Novo serviço**: `src/lib/visual-signature/ai-image-generator.ts` para geração de imagem de assinatura visual via IA (Responses API image_generation).
- **Novo prompt**: `prompts/visual-signature-generator.md` para gerar imagens de assinaturas visuais.
- **Upload de logotipo**: `src/app/api/stores/[storeId]/logo/route.ts` para upload via formulário, validação e persistência em `stores.logo_url`.
- **`src/components/flow/store-identity-form.tsx`**: adicionar fluxo pós-salvamento (modal de escolha de assinatura).
- **`src/components/flow/visual-signature-picker.tsx`**: novo componente para exibir variações e permitir escolha.
- **`src/components/campaign/`**: possivelmente atualizar preview para mostrar assinatura visual.
- **Preocupações centrais**: custo (geração rápida e barata, reutilização sem recriar), velocidade (não bloquear criação de campanha), reutilização (ativo fixo, não recriado por campanha).
- **Sem impacto**: dashboard, histórico de campanhas, planos/monetização, editor avançado, GeminiImageProvider.
