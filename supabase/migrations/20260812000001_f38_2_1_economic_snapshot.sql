-- F38.2.1 — Snapshot Econômico: taxas congeladas na geração + backfill aproximado
-- =============================================================================
-- Corrige o recálculo retroativo (D1/D4 do design): hoje
-- EconomicParameterService.getParameter lê o valor corrente a cada consulta e
-- aplica a todo o histórico. Com colunas congeladas em generation_events, o
-- histórico em BRL torna-se imutável por construção.
--
-- Regras:
--   - 4 colunas novas em generation_events: usd_brl_rate_at_generation
--     (snapshot CONTÁBIL), credit_value_brl_at_generation (snapshot
--     ESTIMATIVO/fallback) + as ORIGENS *_source_at_generation (procedência
--     explícita — nunca valor sem procedência)
--   - CHECKs leves nas colunas de origem (NULL permitido — delivery markers
--     podem ficar NULL; D1/D2 do spec): 'captured_at_generation' /
--     'backfilled_from_audit' / 'backfilled_seed'; economic_parameter_fallback
--     é EXCLUSIVAMENTE derivado em leitura (service layer) — o CHECK rejeita
--     qualquer tentativa de persistir 'economic_parameter_fallback'
--   - CHECKs de paridade valor/origem: valor não-nulo ⇔ origem não-nula
--   - Backfill aproximado por chave (D4) SEM loop plpgsql — subqueries LATERAL
--     determinísticas: new_value da alteração mais recente do audit com
--     created_at <= generation_events.created_at; sem alteração anterior →
--     SEED POR CHAVE com origem backfilled_seed
--   - OVERRIDE DO PHASE OWNER (2026-08-11): a seed do backfill da chave
--     'usd_brl_rate' é 5.18 (o plano original dizia 1.00 — o dono da fase
--     determinou que eventos sem audit anterior devem refletir o câmbio real
--     do período legado); 'credit_value_brl' permanece 1.00. A origem continua
--     'backfilled_seed' nas duas chaves. Documentado como deviation no SUMMARY
--     .planning/phases/38.2.1-economic-snapshot/38-2-1-01-SUMMARY.md.
--   - Backfill idempotente POR COLUNA (WHERE <coluna_valor> IS NULL — re-rodar
--     não altera linhas preenchidas nem sobrescreve snapshot com dados novos
--     do audit); backfill NUNCA grava 'captured_at_generation' (só o tracker)
--   - Nenhuma outra tabela em UPDATE/ALTER além de public.generation_events;
--     nenhum índice novo
--
-- Limitação documentada (D4): backfill é aproximado POR CONSTRUÇÃO — o valor
-- real da geração nunca foi persistido antes desta fase. A origem backfilled_*
-- comunica que o valor foi reconstruído, não capturado.
--
-- Blocos:
--   1. Colunas de snapshot (4) — IF NOT EXISTS (retrocompatível)
--   2. CHECKs leves nas colunas de origem
--   3. CHECKs de paridade valor/origem
--   4. Backfill aproximado por chave (LATERAL + seed por chave)
--   5. REVERT (comentado, ordem reversa)
-- =============================================================================

-- =============================================================================
-- 1. Colunas de snapshot em generation_events (D1 — sem CHECK de valor,
-- sem NOT NULL: delivery markers podem ficar NULL; D1/D2 do spec)
-- =============================================================================
ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS usd_brl_rate_at_generation NUMERIC;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS credit_value_brl_at_generation NUMERIC;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS usd_brl_rate_source_at_generation TEXT;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS credit_value_brl_source_at_generation TEXT;

-- =============================================================================
-- 2. CHECKs leves nas colunas de origem (NULL permitido — D1/D2 do spec;
-- economic_parameter_fallback NUNCA é persistido — o CHECK rejeita)
-- =============================================================================
ALTER TABLE public.generation_events
ADD CONSTRAINT chk_gen_events_usd_rate_source
CHECK (
  usd_brl_rate_source_at_generation IS NULL
  OR usd_brl_rate_source_at_generation IN ('captured_at_generation','backfilled_from_audit','backfilled_seed')
);

ALTER TABLE public.generation_events
ADD CONSTRAINT chk_gen_events_credit_value_source
CHECK (
  credit_value_brl_source_at_generation IS NULL
  OR credit_value_brl_source_at_generation IN ('captured_at_generation','backfilled_from_audit','backfilled_seed')
);

-- =============================================================================
-- 3. CHECKs de paridade valor/origem (nenhum valor persistido sem origem)
-- =============================================================================
ALTER TABLE public.generation_events
ADD CONSTRAINT chk_gen_events_usd_rate_parity
CHECK ((usd_brl_rate_at_generation IS NULL) = (usd_brl_rate_source_at_generation IS NULL));

ALTER TABLE public.generation_events
ADD CONSTRAINT chk_gen_events_credit_value_parity
CHECK ((credit_value_brl_at_generation IS NULL) = (credit_value_brl_source_at_generation IS NULL));

-- =============================================================================
-- 4. Backfill aproximado por chave (D4) — SEM loop plpgsql, LATERAL
-- determinística, idempotência POR COLUNA.
--    usd_brl_rate      → seed 5.18 (OVERRIDE phase owner 2026-08-11)
--    credit_value_brl  → seed 1.00
-- Origem: 'backfilled_from_audit' (janela do audit) | 'backfilled_seed' (seed)
-- =============================================================================
UPDATE public.generation_events ge
SET
  usd_brl_rate_at_generation = COALESCE(sub.new_value, 5.18),
  usd_brl_rate_source_at_generation = CASE
    WHEN sub.new_value IS NULL THEN 'backfilled_seed'
    ELSE 'backfilled_from_audit'
  END
FROM (
  SELECT
    ge2.id,
    av.new_value
  FROM public.generation_events ge2
  LEFT JOIN LATERAL (
    SELECT a.new_value
    FROM public.economic_parameter_audit a
    WHERE a.key = 'usd_brl_rate'
      AND a.created_at <= ge2.created_at
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
  ) av ON TRUE
  WHERE ge2.usd_brl_rate_at_generation IS NULL
    AND ge2.created_at IS NOT NULL
) sub
WHERE ge.id = sub.id;

UPDATE public.generation_events ge
SET
  credit_value_brl_at_generation = COALESCE(sub.new_value, 1.00),
  credit_value_brl_source_at_generation = CASE
    WHEN sub.new_value IS NULL THEN 'backfilled_seed'
    ELSE 'backfilled_from_audit'
  END
FROM (
  SELECT
    ge2.id,
    av.new_value
  FROM public.generation_events ge2
  LEFT JOIN LATERAL (
    SELECT a.new_value
    FROM public.economic_parameter_audit a
    WHERE a.key = 'credit_value_brl'
      AND a.created_at <= ge2.created_at
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
  ) av ON TRUE
  WHERE ge2.credit_value_brl_at_generation IS NULL
    AND ge2.created_at IS NOT NULL
) sub
WHERE ge.id = sub.id;

-- =============================================================================
-- REVERT (ordem reversa de criação)
-- =============================================================================
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_gen_events_credit_value_parity;
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_gen_events_usd_rate_parity;
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_gen_events_credit_value_source;
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_gen_events_usd_rate_source;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS credit_value_brl_source_at_generation;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS usd_brl_rate_source_at_generation;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS credit_value_brl_at_generation;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS usd_brl_rate_at_generation;
