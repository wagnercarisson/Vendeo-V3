-- F56.2b2c (B2.3) — M1: estimativa de gasto ESTRITAMENTE POSITIVA (forward-only).
-- LOCAL-ONLY: apenas AUTORADA aqui. NÃO aplicar nesta rodada. NÃO executar `db push`.
-- Esta migration NÃO edita as migrations aplicadas (`20261017000001/000002`) nem seus hashes;
-- reforça o invariante no NÍVEL DA TABELA (vale para INSERT/UPDATE feitos pelas RPCs).
--
-- M1: `estimated_usd > 0`. `begin_paid_call` (INSERT) e o encerramento com valor informado
-- (UPDATE de `estimated_usd`) passam a ser recusados quando zero/negativo. `NULL` no
-- encerramento continua MANTENDO a estimativa (não é afetado).
--
-- Tabela vazia ao aplicar (fixtures das provas foram removidas) ⇒ o CHECK é seguro.

ALTER TABLE public.product_1_1_pilot_paid_calls
  ADD CONSTRAINT chk_p1_1_pilot_estimated_positive CHECK (estimated_usd > 0);

-- =============================================================================
-- REVERT (executar manualmente apenas na instância local, se autorizado)
-- =============================================================================
-- ALTER TABLE public.product_1_1_pilot_paid_calls
--   DROP CONSTRAINT IF EXISTS chk_p1_1_pilot_estimated_positive;
