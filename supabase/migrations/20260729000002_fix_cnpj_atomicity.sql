-- Fix CNPJ Atomicity (RAG-260729)
-- Corrige dados existentes e adiciona CHECK constraint para garantir atomicidade
-- dos dados fiscais: CNPJ, razão social e nome fantasia sempre persistidos atomicamente.
--
-- Nunca deve existir razao_social/nome_fantasia sem cnpj_normalized válido.
--
-- Blocos:
--   1. UPDATE cleanup — converte cnpj_normalized vazio para NULL
--   2. CHECK constraint — impede estado incoerente
--   3. REVERT

-- =============================================================================
-- 1. UPDATE cleanup
-- =============================================================================

-- Converte cnpj_normalized = '' para NULL (tratado como "sem CNPJ")
UPDATE public.stores
SET cnpj_normalized = NULL
WHERE cnpj_normalized = '';

-- Remove root_hash onde cnpj_normalized é NULL
-- (sem CNPJ não faz sentido ter hash persistido)
UPDATE public.stores
SET cnpj_root_hash = ''
WHERE cnpj_normalized IS NULL
  AND cnpj_root_hash != '';

-- Habilita pgcrypto se ainda não estiver ativo (comum em Supabase, mas seguro garantir)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Gera root_hash para lojas que têm CNPJ mas estão sem root_hash
-- (dados legados de F32/F33 que pre-datam a coluna cnpj_root_hash).
-- Usa pgcrypto (disponível por padrão no Supabase) para SHA-256 do root CNPJ.
-- NOTA: o hash gerado aqui é do root CNPJ puro (sem pepper HMAC), diferente do
-- hash HMAC-SHA256 que o servidor gera em update-cnpj. O servidor substituirá
-- este placeholder pelo hash correto na próxima atualização.
UPDATE public.stores
SET cnpj_root_hash = encode(digest(substring(cnpj_normalized, 1, 8), 'sha256'), 'hex')
WHERE cnpj_normalized IS NOT NULL
  AND cnpj_root_hash = '';

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
