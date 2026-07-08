# Phase 12: Fundação DB/Storage — Context

**Gathered:** 2026-07-08
**Status:** Ready for planning
**Source:** OpenSpec change (`openspec/changes/fase-12-fundacao-db-storage/`)

<domain>
## Phase Boundary

Criar a infraestrutura fundacional de banco e Storage para campanhas: tabela `public.campaigns`, bucket privado `campaign-images`, RLS e políticas de acesso. Fase puramente de banco + Storage — não cria services, não modifica app code, não altera fluxo de geração.

Depende das Fases 7–11: `stores` com `user_id`, RLS em tabelas filhas, `requireOwnership`, `requireApiUser`, padrão de auth consolidado.
</domain>

<decisions>
## Implementation Decisions

### D1 — Trigger `updated_at` scoped (padrão do repositório)
- Função `public.update_campaigns_updated_at()` + trigger `trg_campaigns_updated_at` (BEFORE UPDATE, FOR EACH ROW)
- Mesmo padrão de `store_visual_signatures`, `store_brand_assets`, `store_brand_profiles`
- Invariante da milestone: detecção de stale `generating` depende de `updated_at`

### D2 — `error_message` CHECK constraint
- `CONSTRAINT chk_campaigns_error_message CHECK (status <> 'error' OR nullif(trim(error_message), '') IS NOT NULL)`
- Proteção de integridade: se UPDATE `status='error'` sem `error_message`, a UI não teria o que exibir

### D3 — Storage policies: sem UPDATE (imutabilidade)
- Bucket `campaign-images` privado com 3 políticas (SELECT owner, INSERT service_role, DELETE service_role)
- NENHUMA UPDATE policy — imagem final é soberana e imutável (invariante #1 da milestone)
- Trade-off: retry em falha parcial requer DELETE + re-upload (não upsert)

### D4 — RLS: SELECT do owner sem escrita
- `ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY`
- Policy `owner_select_campaigns` FOR SELECT TO authenticated com subquery `store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())`
- INSERT/UPDATE/DELETE exclusivos do `supabaseAdmin` (service_role), precedidos por `requireOwnership`
- `GRANT SELECT ON TABLE public.campaigns TO authenticated`

### D5 — Imagens via `storage_path` + signed URL, não via listagem
- Fluxo: `campaigns.storage_path` → `supabaseAdmin.storage.createSignedUrl(path, 3600)` → URL temporária
- Policy FOR SELECT TO authenticated existe para diagnóstico, não como fonte de dados da UI
- Vale para `/campanha/[id]`, `/minhas-campanhas`, `/api/campaign/[id]/download`

### D6 — Migrations sequenciais com revert commands
- `20260708000001_create_campaigns_table.sql` e `20260708000002_create_campaign_images_bucket.sql`
- Ambas incluem revert commands comentados ao final
- Migration 2 usa `ON CONFLICT (id) DO NOTHING` para idempotência do bucket
- Storage policies NÃO são idempotentes (sem `DROP POLICY IF EXISTS` antes de `CREATE POLICY`)

### the agent's Discretion
- Ordem exata das verificações no smoke SQL
- Nomes de variáveis PL/pgSQL nos blocos `DO $$`
- Estrutura de comentários e formatação SQL

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### RLS patterns (Phases 9-10)
- `.planning/phases/09-cutover-ownership/*.md` — `requireOwnership` pattern, `getCurrentStore`
- `.planning/phases/10-perimetro-multitenant/*.md` — RLS policies em tabelas filhas

### Existing migrations
- `supabase/migrations/` — padrão de nomenclatura, estrutura de migrations existentes

### Existing trigger patterns
- Revisar migrations existentes em `supabase/migrations/` para o padrão de trigger scoped `updated_at`

</canonical_refs>

<specifics>
## Specific Ideas

- DDL completa da tabela com UUID PK, store_id FK, status CHECK, snapshots JSONB, storage_path, trigger, RLS, índices
- Bucket privado 10MB com MIME types PNG/JPEG/WEBP
- Path pattern: `{storeId}/{campaignId}.png` sempre com `/` para `storage.foldername()` funcionar
- Smoke SQL usa blocos `DO $$` com `RAISE EXCEPTION` em falha e `RAISE NOTICE 'PASS: ...'` em sucesso
- UAT checklist de 10 verificações manuais

</specifics>

<deferred>
## Deferred Ideas

- Serviço `persistence.ts` e helpers de escrita — Fase 13
- Rota `GET /api/campaign/[id]/download` — Fase 13
- Modificação do fluxo `generate-image` — Fase 14
- Página `/campanha/[id]` — Fase 15
- Página `/minhas-campanhas` + limpeza — Fase 16
- Edição `publication_copy` — Fase 6 condicional
- Shape exato de `publication_copy_snapshot` e `render_snapshot` — design diferido
- `store-logos` cleanup — pós-v1.3
- Tipos TypeScript gerados por `supabase gen types` — opcional nesta fase
- Testes automatizados com Jest — não obrigatórios nesta fase

</deferred>

---

*Phase: 12-fundacao-db-storage*
*Context gathered: 2026-07-08 via OpenSpec change (fase-12-fundacao-db-storage)*