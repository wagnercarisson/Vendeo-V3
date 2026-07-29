-- Fix CNPJ Atomicity (RAG-260729)
-- Corrige dados existentes e adiciona CHECK constraint para garantir atomicidade
-- dos dados fiscais: CNPJ, razão social e nome fantasia sempre persistidos atomicamente.
--
-- Nunca deve existir razao_social/nome_fantasia sem cnpj_normalized válido.
--
-- Blocos:
--   1. Cleanup — limpa conjunto fiscal de lojas sem CNPJ, aborta se houver
--      loja com CNPJ sem root_hash (precisa de backfill app-side)
--   2. CHECK constraint — impede estado incoerente
--   3. REVERT

-- =============================================================================
-- 1. Cleanup + defensive abort
-- =============================================================================

-- Converte cnpj_normalized = '' para NULL (tratado como "sem CNPJ").
-- Quando cnpj_normalized é NULL, limpa TODO o conjunto fiscal — nunca
-- razão/nome sem CNPJ.
UPDATE public.stores
SET
  cnpj_normalized = NULL,
  cnpj_root_hash = '',
  razao_social = NULL,
  nome_fantasia = NULL
WHERE cnpj_normalized = '';

-- Remove root_hash onde cnpj_normalized é NULL
-- (sem CNPJ não faz sentido ter hash persistido)
UPDATE public.stores
SET cnpj_root_hash = ''
WHERE cnpj_normalized IS NULL
  AND cnpj_root_hash != '';

-- Remove razao_social/nome_fantasia onde cnpj_normalized é NULL
-- (corrige estado incoerente pós-F34: CNPJ ausente mas razão/nome preenchidos)
UPDATE public.stores
SET
  razao_social = NULL,
  nome_fantasia = NULL
WHERE cnpj_normalized IS NULL
  AND (razao_social IS NOT NULL OR nome_fantasia IS NOT NULL);

-- Defensive check: se alguma loja tem CNPJ mas root_hash vazio, aborta.
-- Isso é um indicador de dados legados de F32/F33 que precisam de
-- backfill app-side usando hashCnpjRoot() com CNPJ_PEPPER.
--
-- Para resolver, executar script de backfill em src/lib/cnpj/hash.ts
-- ou fazer essas lojas passarem novamente pelo fluxo update-cnpj.
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.stores
  WHERE cnpj_normalized IS NOT NULL
    AND (cnpj_root_hash IS NULL OR cnpj_root_hash = '');

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'STORES_WITH_CNPJ_NO_ROOT_HASH: % loja(s) possui(em) cnpj_normalized preenchido mas cnpj_root_hash vazio. '
      'Execute backfill app-side com hashCnpjRoot() antes de aplicar esta migration.',
      v_count;
  END IF;
END;
$$;

-- =============================================================================
-- 2. CHECK constraint — atomicidade fiscal
-- =============================================================================
--
-- Garante que NUNCA exista razao_social/nome_fantasia sem cnpj_normalized válido.
--
-- Permite:
--   - (cnpj_normalized IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL AND cnpj_root_hash = '')
--     → Loja nova sem CNPJ ainda, tudo vazio
--   - (cnpj_normalized ~ '^\d{14}$' AND cnpj_root_hash != '')
--     → CNPJ válido com root hash; razao_social/nome_fantasia podem ou não estar preenchidos
--       (podem ser preenchidos depois via PATCH, já que store tem CNPJ)
--
-- NÃO permite:
--   - razao_social ou nome_fantasia sem cnpj_normalized
--   - cnpj_normalized inválido (não NULL e não 14 dígitos)
--   - cnpj_normalized válido sem cnpj_root_hash

DO $$
BEGIN
  ALTER TABLE public.stores
    ADD CONSTRAINT chk_stores_cnpj_atomic
    CHECK (
      (cnpj_normalized IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL AND cnpj_root_hash = '')
      OR
      (cnpj_normalized IS NOT NULL AND cnpj_normalized ~ '^\d{14}$' AND cnpj_root_hash != '')
    );
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;

-- =============================================================================
-- 3. REVERT
-- =============================================================================
-- ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_cnpj_atomic;
-- NOTA: UPDATE cleanup não é revertido por design — dados incorretos não devem ser
-- restaurados. A correção de dados é destino único (idempotente).
