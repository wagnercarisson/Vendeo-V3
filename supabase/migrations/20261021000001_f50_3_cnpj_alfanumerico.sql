-- F50.3 — Compatibilidade da constraint de CNPJ com o formato alfanumérico canônico
--
-- Escopo estrito desta migration:
--   1. Preflight fail-closed (aborta ANTES de qualquer DDL)
--   2. Recriação de public.stores.chk_stores_cnpj_atomic
--      com ^[A-Z0-9]{12}[0-9]{2}$ (mesma estrutura lógica anterior)
--   3. Comentários de coluna cujo contrato mudou
--
-- Regras:
--   - Forward-only. Sem transação embutida (aplicar com psql --single-transaction).
--   - Nenhum comando de escrita em dados (stores.cnpj_normalized,
--     stores.cnpj_root_hash, cnpj_lookup_cache).
--   - Nenhuma alteração de índices, RPCs, RLS, grants, ownership,
--     stores.user_id, freemium_entitlements ou oferta F50.2.
--   - Recriar a constraint via NOT VALID + VALIDATE CONSTRAINT.
--
-- Alvo de aplicação autorizado: container supabase_db_vendeo-f562a-isolated
-- (PostgreSQL 17.6, 127.0.0.1:56322). Nunca remoto/produção.

-- =============================================================================
-- 1. Preflight — aborta antes de alterar a constraint
-- =============================================================================

DO $$
DECLARE
  v_bad_format BIGINT;
  v_no_root_hash BIGINT;
  v_fiscal_without_cnpj BIGINT;
  v_alphanumeric_existing BIGINT;
BEGIN
  -- 1.1 CNPJ não nulo fora do padrão canônico (12 [A-Z0-9] + 2 [0-9])
  SELECT count(*) INTO v_bad_format
  FROM public.stores
  WHERE cnpj_normalized IS NOT NULL
    AND cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$';

  IF v_bad_format > 0 THEN
    RAISE EXCEPTION
      'F50_3_PRECHECK_BAD_FORMAT: % loja(s) com cnpj_normalized fora do padrão canônico. Nenhuma linha foi alterada.',
      v_bad_format;
  END IF;

  -- 1.2 CNPJ não nulo sem root hash
  SELECT count(*) INTO v_no_root_hash
  FROM public.stores
  WHERE cnpj_normalized IS NOT NULL
    AND (cnpj_root_hash IS NULL OR cnpj_root_hash = '');

  IF v_no_root_hash > 0 THEN
    RAISE EXCEPTION
      'F50_3_PRECHECK_NO_ROOT_HASH: % loja(s) com cnpj_normalized preenchido e cnpj_root_hash vazio. Execute backfill app-side antes de aplicar. Nenhuma linha foi alterada.',
      v_no_root_hash;
  END IF;

  -- 1.3 Dados fiscais sem CNPJ
  SELECT count(*) INTO v_fiscal_without_cnpj
  FROM public.stores
  WHERE cnpj_normalized IS NULL
    AND (razao_social IS NOT NULL OR nome_fantasia IS NOT NULL);

  IF v_fiscal_without_cnpj > 0 THEN
    RAISE EXCEPTION
      'F50_3_PRECHECK_FISCAL_WITHOUT_CNPJ: % loja(s) com razão social/nome fantasia sem cnpj_normalized. Nenhuma linha foi alterada.',
      v_fiscal_without_cnpj;
  END IF;

  -- 1.4 Informativo: CNPJs alfanuméricos já existentes (não bloqueia)
  SELECT count(*) INTO v_alphanumeric_existing
  FROM public.stores
  WHERE cnpj_normalized ~ '[A-Z]';

  RAISE NOTICE 'F50_3_ALPHANUMERIC_EXISTING: %', v_alphanumeric_existing;
END;
$$;

-- =============================================================================
-- 2. Constraint atômica — formato canônico numérico OU alfanumérico
-- =============================================================================
--
-- Permite (idêntico ao contrato anterior, trocando apenas a regex):
--   - (cnpj_normalized IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL AND cnpj_root_hash = '')
--   - (cnpj_normalized IS NOT NULL AND cnpj_normalized ~ '^[A-Z0-9]{12}[0-9]{2}$' AND cnpj_root_hash <> '')
--
-- Não permite:
--   - razao_social ou nome_fantasia sem cnpj_normalized
--   - cnpj_normalized fora do padrão canônico
--   - cnpj_normalized válido sem cnpj_root_hash

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_cnpj_atomic;

ALTER TABLE public.stores ADD CONSTRAINT chk_stores_cnpj_atomic
  CHECK (
    (cnpj_normalized IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL AND cnpj_root_hash = '')
    OR
    (cnpj_normalized IS NOT NULL AND cnpj_normalized ~ '^[A-Z0-9]{12}[0-9]{2}$' AND cnpj_root_hash <> '')
  ) NOT VALID;

ALTER TABLE public.stores VALIDATE CONSTRAINT chk_stores_cnpj_atomic;

-- =============================================================================
-- 3. Comentários de coluna — apenas onde o contrato mudou
-- =============================================================================

COMMENT ON COLUMN public.stores.cnpj_normalized IS
  'CNPJ normalizado canônico: 14 caracteres (12 alfanuméricos [A-Z0-9] + 2 dígitos verificadores [0-9]). Unicidade global via idx_stores_cnpj_normalized.';

COMMENT ON COLUMN public.stores.cnpj_root_hash IS
  'HMAC-SHA256 dos 8 primeiros caracteres canônicos (raiz do CNPJ) com pepper server-side. Calculado na aplicação (Next.js), não no banco.';

COMMENT ON COLUMN public.cnpj_lookup_cache.cnpj_normalized IS
  'CNPJ normalizado canônico: 14 caracteres (12 alfanuméricos [A-Z0-9] + 2 dígitos verificadores [0-9]) — chave primária do cache.';

-- =============================================================================
-- REVERT
-- =============================================================================
-- Permitido SOMENTE enquanto `SELECT count(*) FROM stores WHERE cnpj_normalized ~ '[A-Z]'` = 0.
-- Procedimento completo em .planning/phases/50.3-.../50.3-ROLLBACK.md.
--
-- ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_cnpj_atomic;
-- ALTER TABLE public.stores ADD CONSTRAINT chk_stores_cnpj_atomic
--   CHECK (
--     (cnpj_normalized IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL AND cnpj_root_hash = '')
--     OR
--     (cnpj_normalized IS NOT NULL AND cnpj_normalized ~ '^\d{14}$' AND cnpj_root_hash <> '')
--   );
-- NOTA: a restauração da constraint numérica NÃO reescreve dados e NÃO deve ser
-- executada depois do primeiro CNPJ alfanumérico persistido.
