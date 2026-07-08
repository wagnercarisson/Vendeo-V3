## 1. Migration 1 — Create campaigns table

- [x] 1.1 Criar `supabase/migrations/20260708000001_create_campaigns_table.sql` com DDL completa: todos os campos, defaults, NOT NULLs, FK `store_id → stores(id) ON DELETE CASCADE`, CHECK `status IN ('generating','ready','error')`, CHECK `chk_campaigns_error_message`
- [x] 1.2 Adicionar trigger scoped: função `update_campaigns_updated_at()` + trigger `trg_campaigns_updated_at` (BEFORE UPDATE, FOR EACH ROW)
- [x] 1.3 Habilitar RLS em `public.campaigns` e criar policy `owner_select_campaigns` com subquery `stores.user_id = auth.uid()`
- [x] 1.4 Adicionar `GRANT SELECT ON TABLE public.campaigns TO authenticated`
- [x] 1.5 Adicionar índices `idx_campaigns_store_id` (store_id) e `idx_campaigns_created_at` (created_at DESC)
- [x] 1.6 Documentar revert commands ao final do arquivo

## 2. Migration 2 — Create campaign-images bucket

- [x] 2.1 Criar `supabase/migrations/20260708000002_create_campaign_images_bucket.sql` com INSERT em `storage.buckets` (id='campaign-images', public=false, file_size_limit=10485760, allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp']) com `ON CONFLICT (id) DO NOTHING`
- [x] 2.2 Criar policy `owner_select_campaign_images` em `storage.objects` FOR SELECT TO authenticated com path prefix verification via `(storage.foldername(name))[1]`
- [x] 2.3 Criar policy `service_insert_campaign_images` em `storage.objects` FOR INSERT TO service_role
- [x] 2.4 Criar policy `service_delete_campaign_images` em `storage.objects` FOR DELETE TO service_role
- [x] 2.5 Verificar que NENHUMA policy `service_update_campaign_*` foi criada (UPDATE intencionalmente ausente)
- [x] 2.6 Documentar revert commands ao final do arquivo

## 3. Verify script

- [x] 3.1 Criar `scripts/verify-phase12.sql` com 9 blocos de verificação: existência da tabela, RLS ativa, CHECK constraint, trigger, bucket privado, 3 Storage policies, ausência de UPDATE policy
- [ ] 3.2 ~~Cada bloco deve usar `RAISE EXCEPTION` em falha e `RAISE NOTICE 'PASS: ...'` em sucesso~~ → **Alterado**: usa temp table `_verify12_results` + INSERT + SELECT final, porque Supabase Studio não exibe RAISE NOTICE. `RAISE EXCEPTION` mantido para falhas. Desvio documentado no SUMMARY 12-03.

## 4. Smoke test & verification

- [x] 4.1 Executar ambas as migrations no Supabase local (ou remoto de desenvolvimento) — via `supabase migration up`
- [x] 4.2 Executar `scripts/verify-phase12.sql` — 9/9 PASS
- [x] 4.3 UAT técnico: owner SELECT via RLS (✅), tenant isolation (✅), client-side INSERT rejeitado (✅), updated_at trigger (✅), error_message CHECK (✅), bucket privado (✅ smoke test)
  - Signed URL vs public URL: 🔶 **Deferido** para Fase 13 (requer persistence.ts)
  - Upload client-side vs service_role: 🔶 **Deferido** para Fase 13 (requer fluxo service_role)

## 5. Type check & build

- [x] 5.1 Rodar `npx tsc --noEmit` — zero erros
- [x] 5.2 Rodar `npm run lint` — zero erros
- [x] 5.3 Rodar `npx next build` — build bem-sucedido
- [x] 5.4 Verificar que nenhum arquivo de app code foi modificado (fluxo de geração intacto)
