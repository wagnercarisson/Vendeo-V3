## Why

O Vendeo gera campanhas visuais, mas não persiste o resultado: após a renderização, a imagem é exibida no preview e descartada. Não há registro de campanha gerada, não há histórico, não há como reexibir ou baixar depois. A milestone v1.3 (Persistência e Entrega da Campanha) resolve isso em 6 fases. Esta fase (Fase 12) é a fundação: criar a tabela `campaigns`, o bucket `campaign-images`, e as políticas de RLS/Storage — sem tocar no fluxo de geração existente.

## What Changes

- Criar migration `20260708000001_create_campaigns_table.sql` com DDL da tabela `public.campaigns`, trigger scoped `update_campaigns_updated_at`, RLS com policy `owner_select_campaigns`, índices, e GRANT SELECT TO authenticated
- Criar migration `20260708000002_create_campaign_images_bucket.sql` com bucket privado `campaign-images` (10MB, PNG/JPEG/WEBP) e 3 Storage policies (SELECT owner, INSERT service_role, DELETE service_role — sem UPDATE por imutabilidade)
- Nenhuma modificação em app code (fluxo de geração intacto)
- Script de verificação `scripts/verify-phase12.sql` com blocos `DO $$` smoke test
- Checklist de revisão para UAT técnico (10 verificações de RLS + Storage + integridade)

## Capabilities

### New Capabilities
- `campaigns-table`: DDL da tabela `public.campaigns` com UUID PK, store_id FK, status CHECK (generating/ready/error), snapshots JSONB, trigger updated_at scoped, RLS com owner subquery, índices store_id + created_at DESC
- `campaign-images-storage`: Bucket Supabase Storage privado `campaign-images` com file_size_limit 10MB, allowed MIME types image/png/image/jpeg/image/webp, e 3 políticas (owner SELECT por prefixo store, service_role INSERT, service_role DELETE)
- `db-verify-phase12`: Script SQL de verificação (smoke tests) com blocos `DO $$ RAISE EXCEPTION` que validam existência da tabela, RLS ativa, CHECK constraint, trigger, bucket privado e 3 Storage policies + ausência de UPDATE

### Modified Capabilities
- `multitenant-rls-storage`: Adicionar `public.campaigns` ao conjunto de tabelas protegidas por RLS com pattern de owner subquery (mesmo padrão de `store_brand_assets`, `store_brand_profiles`, `store_visual_signatures`)

## Impact

- **Migrations:** 2 novos arquivos em `supabase/migrations/` (nomes sequenciais ao timestamp 20260708000001 e 20260708000002)
- **Scripts:** `scripts/verify-phase12.sql` adicionado
- **Banco:** Nenhuma tabela existente é alterada. `campaigns` é nova tabela. Bucket `campaign-images` é novo bucket
- **App code:** Nenhum arquivo modificado — fluxo de geração intacto
- **Tipos TypeScript:** Nenhum tipo gerado até que `supabase gen types` seja executado (opcional nesta fase)
- **Testes:** Condicionais ao Supabase local rodando (UAT técnico manual como fallback)
