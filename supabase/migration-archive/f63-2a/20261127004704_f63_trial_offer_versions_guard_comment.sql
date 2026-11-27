-- =============================================================================
-- F63 — Base versionada de ofertas (subfatia 2A)
-- Migration D — comentário do guard de versão (forward-only, metadata-only).
--
-- Escopo desta migration (e SOMENTE isto): substituir o COMMENT ON FUNCTION do
-- guard public.trial_offer_versions_guard(), já corrigido pela Migration C.
-- Não altera tabelas, colunas, dados, função, trigger, grants, RLS ou RPCs.
--
-- Alvo exclusivo: homolog local existente (container supabase_db_vendeo-homolog,
-- 127.0.0.1:57782/postgres). Nenhuma aplicação em produção ou banco remoto.
-- Nenhum reset, banco novo, push, link ou backup.
--
-- A linha do ledger (supabase_migrations.schema_migrations) é inserida pelo
-- wrapper transacional do aplicador na MESMA transação desta migration.
-- =============================================================================

COMMENT ON FUNCTION public.trial_offer_versions_guard() IS
  'F63: guard da versão de oferta. Rascunho (published_at NULL) não admite published_by. Primeira publicação: published_by pode permanecer NULL ou transitar NULL -> UUID, com motivo e calendário válidos. Versão publicada: condições, published_at, created_at e identidade ficam congeladas. Autoria (created_by/published_by) depois disso só pode transitar valor -> NULL; o guard permite essa transição também em UPDATE direto e não distingue a origem referencial.';
