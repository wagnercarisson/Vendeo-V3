# Storage Privacy

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D20). Privacidade real dos arquivos: tornar privados os buckets legados de identidade visual e migrar consumidores de `getPublicUrl` para URL assinada. Hardening do Supabase atual — **sem** migração de provider.

## ADDED Requirements

### Requirement: Inventário de buckets

O sistema SHALL inventariar os buckets de storage: `campaign-images` (privado), `lab-artifacts` (privado), `store-brand-assets` (público), `visual-signatures` (público) e `store-logos` (público).

#### Scenario: Inventário registrado

- **WHEN** o hardening é executado
- **THEN** o estado de cada bucket (public/private + policies + consumidores de URL) é documentado

### Requirement: Buckets de ativos do usuário privados

O sistema SHALL tornar **privados** os buckets `store-brand-assets`, `visual-signatures` e `store-logos` (dropar as policies `*_public_read` e definir `public=false`), preservando as policies `service_role` de escrita e adicionando leitura por URL assinada/acesso autenticado do owner.

#### Scenario: Leitura pública removida

- **WHEN** o hardening é aplicado
- **THEN** não há mais `SELECT` público sobre `store-brand-assets`/`visual-signatures`/`store-logos`

#### Scenario: Ativos permanecem acessíveis por assinatura/autenticação

- **WHEN** o owner solicita um ativo
- **THEN** recebe URL assinada (ou acesso autenticado), não URL pública

### Requirement: Migração dos consumidores de getPublicUrl e asset_url

O sistema SHALL migrar os consumidores conhecidos de `getPublicUrl` para `createSignedUrl`/acesso autenticado: `src/lib/store-identity-service.ts` (store-brand-assets) e `src/lib/visual-signature/persistence.ts` (visual-signatures). A **`storage_path` é a referência durável**; a **URL assinada é criada somente no momento da leitura/geração** e **nunca é persistida** como endereço canônico.

#### Scenario: Consumidores migrados

- **WHEN** o hardening é aplicado
- **THEN** nenhum código de produção usa `getPublicUrl` para ativos do usuário
- **AND** os URLs assinados têm TTL adequado

#### Scenario: URL assinada não é persistida

- **WHEN** o código lê/gera um ativo
- **THEN** a URL assinada é derivada no read-time a partir de `storage_path`, **sem** gravar URL temporária em `asset_url`/`logo_url`
- **AND** `storage_path` permanece a referência canônica

### Requirement: asset_url nullable/deprecado (assinaturas visuais)

O sistema SHALL tornar `store_visual_signatures.asset_url` **nullable/deprecated**, usando `storage_path` como canônico, e **inventariar TODOS os consumidores** de `asset_url`/`logo_url` e das URLs públicas montadas manualmente (tipos, rotas, UI, restore, approve, realign — incl. `store-identity-form.tsx`), migrando-os para derivar a URL assinada no read-time. Nenhuma URL assinada é persistida.

#### Scenario: asset_url deprecado, storage_path canônico

- **WHEN** a migration de storage é aplicada
- **THEN** `asset_url` é nullable/deprecated e `storage_path` é a referência canônica
- **AND** todas as URLs públicas montadas manualmente são substituídas por derivação de URL assinada no read-time

#### Scenario: Inventário de asset_url/logo_url e renovação

- **WHEN** o hardening é aplicado
- **THEN** os consumidores de `asset_url`/`logo_url` são inventariados e migrados (types/routes/UI/restore/approve/realign)
- **AND** o TTL cobre a operação de IA/renderização; a renovação após expiração é testada

### Requirement: Sem migração de provider

O sistema SHALL **não** migrar para Cloudflare/R2 nesta fase; o escopo é o hardening do Supabase atual.

#### Scenario: Nenhuma migração de storage

- **WHEN** a F50 executa
- **THEN** nenhum provider de storage é trocado (R2 fica fora do escopo)
