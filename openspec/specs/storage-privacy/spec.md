# Storage Privacy

## Purpose

Aplicar privacidade real aos ativos do usuário no Supabase, removendo leitura pública e usando URLs assinadas sem migrar de provider.

## Requirements

### Requirement: Inventário de buckets

O sistema SHALL inventariar `campaign-images` privado, `lab-artifacts` privado, `store-brand-assets` público, `visual-signatures` público e `store-logos` público antes do hardening, documentando estado, policies e consumidores.

### Requirement: Buckets de ativos privados

`store-brand-assets`, `visual-signatures` e `store-logos` SHALL ser privados, sem leitura pública, preservando escrita service role e permitindo URL assinada/acesso autenticado do owner.

#### Scenario: Leitura pública removida

- **WHEN** hardening é aplicado
- **THEN** não há SELECT público nos três buckets

#### Scenario: Ativo permanece acessível

- **WHEN** owner solicita ativo
- **THEN** recebe URL assinada ou acesso autenticado, nunca URL pública

### Requirement: Consumidores usam URL assinada

Consumidores conhecidos SHALL trocar `getPublicUrl` por `createSignedUrl`/acesso autenticado, incluindo `src/lib/store-identity-service.ts` para `store-brand-assets` e `src/lib/visual-signature/persistence.ts` para `visual-signatures`. `storage_path` é referência durável; URL assinada só é criada no read-time e nunca persistida.

#### Scenario: Consumidores migrados

- **WHEN** hardening é aplicado
- **THEN** produção não usa `getPublicUrl` para ativos do usuário e URLs assinadas têm TTL adequado

#### Scenario: URL assinada não é persistida

- **WHEN** ativo é lido ou gerado
- **THEN** URL é derivada de `storage_path` sem gravar endereço temporário

### Requirement: asset_url deprecado

`store_visual_signatures.asset_url` SHALL ser nullable/deprecado; todos os consumidores de `asset_url`/`logo_url` e URLs públicas manuais devem derivar URL assinada no read-time, com TTL que cubra IA/renderização e renovação testada.

#### Scenario: Referência canônica

- **WHEN** migration é aplicada
- **THEN** `asset_url` é nullable/deprecado e `storage_path` é canônico

#### Scenario: Inventário e renovação

- **WHEN** hardening é aplicado
- **THEN** consumidores de asset/logo URLs, incluindo UI, restore, approve e realign, são migrados e renovação após expiração é testada

### Requirement: Sem migração de provider

O sistema SHALL permanecer no Supabase; Cloudflare/R2 fica fora do escopo.
