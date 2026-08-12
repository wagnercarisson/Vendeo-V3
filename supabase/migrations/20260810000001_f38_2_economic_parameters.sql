-- F38.2 — Parâmetros Econômicos configuráveis por admin (Configurações Econômicas)
-- =============================================================================
-- Cria a fonte única dos parâmetros econômicos de exibição/derivação operacional
-- (D2 — padrão F38 credit_operation_costs):
--   - economic_parameters: key PK, value NUMERIC NOT NULL com CHECK value positivo, updated_by
--   - economic_parameter_audit: append-only old/new + reason obrigatório +
--     idempotência por operation_id (UNIQUE parcial) + trigger imutável
--   - Seeds de sistema: usd_brl_rate=1.00 e credit_value_brl=1.00 (D1, conservador)
--   - RPC admin_set_economic_parameter (definer, transacional, idempotente)
--
-- Regras:
--   - NENHUM parâmetro altera ledger de créditos nem transações históricas (D1)
--   - Sem GRANT para authenticated (parâmetro é dado interno de operação — D2)
--   - Chaves versionadas no TS (enum) — sem CHECK enum no banco (padrão F38 D7)
--   - RLS service_role-only nas duas tabelas
--
-- Blocos:
--   1. Tabela economic_parameters
--   2. Tabela economic_parameter_audit + índice idempotência + trigger imutável
--   3. Seeds de sistema (ON CONFLICT DO NOTHING)
--   4. RPC admin_set_economic_parameter + REVOKE/GRANT
--   5. RLS + REVOKE (service_role only)
--   6. REVERT (comentado)

-- =============================================================================
-- 1. Tabela economic_parameters
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.economic_parameters (
  key         TEXT PRIMARY KEY,
  value       NUMERIC NOT NULL CHECK (value > 0),
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. Tabela economic_parameter_audit (append-only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.economic_parameter_audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL,
  old_value     NUMERIC,
  new_value     NUMERIC,
  actor_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  operation_id  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index for idempotency: operation_id where not null
-- (padrão F38 idx_credit_operation_cost_audit_idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_economic_parameter_audit_idempotency
  ON public.economic_parameter_audit (operation_id)
  WHERE operation_id IS NOT NULL;

-- Immutable trigger: blocks UPDATE and DELETE on audit (even service_role)
CREATE OR REPLACE FUNCTION public.block_economic_parameter_audit_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'economic_parameter_audit é append-only. Nenhum UPDATE ou DELETE é permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_economic_parameter_audit_immutable
BEFORE UPDATE OR DELETE ON public.economic_parameter_audit
FOR EACH ROW
EXECUTE FUNCTION public.block_economic_parameter_audit_update_delete();

-- =============================================================================
-- 3. Seeds de sistema (updated_by NULL — D2, defaults conservadores D1)
-- Dois INSERTs separados: cada seed é idempotente individualmente (ON CONFLICT)
-- =============================================================================
INSERT INTO public.economic_parameters (key, value, updated_by)
VALUES ('usd_brl_rate', 1.00, NULL)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.economic_parameters (key, value, updated_by)
VALUES ('credit_value_brl', 1.00, NULL)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 4. RPC admin_set_economic_parameter
-- Transacional: captura old → UPDATE → INSERT audit na mesma transação.
-- Idempotente: mesmo operation_id retorna a audit da 1ª operação sem duplicar.
-- reason obrigatório; value > 0; p_operation_id DEFAULT NULL (sem idempotência
-- quando ausente — spec). O id da audit é SEMPRE gen_random_uuid() da linha.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_economic_parameter(
  p_actor_id UUID,
  p_key TEXT,
  p_value NUMERIC,
  p_reason TEXT,
  p_operation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old NUMERIC;
  v_existing_audit_id UUID;
  v_audit_id UUID;
  v_result JSONB;
BEGIN
  -- Step 0: key obrigatória
  IF p_key IS NULL OR p_key = '' THEN
    RAISE EXCEPTION 'economic_parameter_key_required';
  END IF;

  -- Step 1: value obrigatório e > 0 (espelha CHECK da tabela)
  IF p_value IS NULL OR p_value <= 0 THEN
    RAISE EXCEPTION 'economic_parameter_value_positive';
  END IF;

  -- Step 2: reason obrigatório (rastreabilidade — auditoria)
  IF p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'economic_parameter_reason_required';
  END IF;

  -- Step 3: Idempotência — mesmo operation_id retorna a audit da 1ª operação
  IF p_operation_id IS NOT NULL THEN
    SELECT id INTO v_existing_audit_id
    FROM public.economic_parameter_audit
    WHERE operation_id = p_operation_id;

    IF FOUND THEN
      SELECT jsonb_build_object(
        'key', p_key,
        'value', p_value,
        'audit_id', v_existing_audit_id,
        'updated_at', now(),
        'idempotent', true
      ) INTO v_result;
      RETURN v_result;
    END IF;
  END IF;

  -- Step 4: captura old value (NULL se a linha ainda não existir)
  SELECT value INTO v_old
  FROM public.economic_parameters
  WHERE key = p_key;

  -- Step 5: UPDATE (ou INSERT se inexistente) na mesma transação
  IF FOUND THEN
    UPDATE public.economic_parameters
    SET value = p_value,
        updated_by = p_actor_id,
        updated_at = now()
    WHERE key = p_key;
  ELSE
    INSERT INTO public.economic_parameters (key, value, updated_by, updated_at)
    VALUES (p_key, p_value, p_actor_id, now());
  END IF;

  -- Step 6: INSERT audit (id = gen_random_uuid() SEMPRE; operation_id = p_operation_id tal qual)
  INSERT INTO public.economic_parameter_audit (
    id, key, old_value, new_value, actor_id, reason, operation_id
  ) VALUES (
    gen_random_uuid(), p_key, v_old, p_value, p_actor_id, p_reason, p_operation_id
  )
  RETURNING id INTO v_audit_id;

  -- Step 7: resultado
  SELECT jsonb_build_object(
    'key', p_key,
    'value', p_value,
    'audit_id', v_audit_id,
    'updated_at', now(),
    'idempotent', false
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_set_economic_parameter IS
'RPC definer — atualiza parâmetro econômico com auditoria obrigatória (reason) e idempotência por operation_id. Acesso exclusivo service_role.';

REVOKE EXECUTE ON FUNCTION public.admin_set_economic_parameter(UUID, TEXT, NUMERIC, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_economic_parameter(UUID, TEXT, NUMERIC, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- 5. RLS + grants (service_role only — sem GRANT para authenticated)
-- =============================================================================
ALTER TABLE public.economic_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_parameter_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.economic_parameters FROM anon, authenticated;
REVOKE ALL ON TABLE public.economic_parameter_audit FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.economic_parameters TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.economic_parameter_audit TO service_role;

-- =============================================================================
-- REVERT (ordem reversa de criação)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.admin_set_economic_parameter(UUID, TEXT, NUMERIC, TEXT, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_set_economic_parameter(UUID, TEXT, NUMERIC, TEXT, UUID);
-- REVOKE ALL ON TABLE public.economic_parameter_audit FROM service_role;
-- REVOKE ALL ON TABLE public.economic_parameters FROM service_role;
-- DROP TRIGGER IF EXISTS trg_economic_parameter_audit_immutable ON public.economic_parameter_audit;
-- DROP FUNCTION IF EXISTS public.block_economic_parameter_audit_update_delete();
-- DROP TABLE IF EXISTS public.economic_parameter_audit;  -- remove também o índice parcial de idempotência (cascata)
-- DROP TABLE IF EXISTS public.economic_parameters;
