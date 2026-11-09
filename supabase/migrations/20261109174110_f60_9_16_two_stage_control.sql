-- F60 / Plano 60-01 — Controle da operação 9:16 em duas etapas (schema mínimo da prova).
--
-- LOCAL-ONLY / NÃO APLICADA: este arquivo é apenas AUTORADO nesta etapa. NÃO executar
-- `supabase db push`, `migration up`, reset ou qualquer mutação remota sem as autorizações
-- explícitas do checkpoint de 60-01 (A: aplicar; B: escrever dados; C: provar; D: limpar).
--
-- Escopo:
--   1. Quatro tabelas de controle (operações, etapas, claims de tentativa, desfechos).
--   2. Views de união com origem canônica (claims ativos, histórico e desfechos).
--   3. Helper interno de abandono de residual (sem EXECUTE para service_role).
--   4. RPCs de controle (abertura atômica, aquisição, finalização, desfecho, retomada).
--   5. Três `CREATE OR REPLACE` compartilhados, com assinatura/comportamento legados preservados.
--
-- A autoridade financeira continua sendo `public.product_1_1_campaign_credit_operations`.
-- Nenhuma coluna/estado terminal financeiro é duplicado aqui. `credit_transactions` não é tocada.
--
-- REVERT: ver bloco comentado ao final. Reverter exige autorização específica.

-- =============================================================================
-- 1. Tabelas de controle
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.product_9_16_two_stage_operations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id         UUID NOT NULL,
  store_id             UUID NOT NULL REFERENCES public.stores(id),
  credit_operation_ref UUID REFERENCES public.product_1_1_campaign_credit_operations(id),
  origin               TEXT NOT NULL DEFAULT '9_16_two_stage',
  contract_version     INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_p916_origin CHECK (origin = '9_16_two_stage'),
  CONSTRAINT ck_p916_contract_version CHECK (contract_version = 1),
  CONSTRAINT uq_p916_operation_identity UNIQUE (campaign_id, operation_id)
);

CREATE TABLE IF NOT EXISTS public.product_9_16_two_stage_steps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL,
  operation_id          UUID NOT NULL,
  stage                 TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  attempts_used         INTEGER NOT NULL DEFAULT 0,
  failure_class         TEXT,
  artifact_evidence_ref TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_p916_step_operation FOREIGN KEY (campaign_id, operation_id)
    REFERENCES public.product_9_16_two_stage_operations (campaign_id, operation_id),
  CONSTRAINT ck_p916_step_stage CHECK (stage IN ('base', 'expansion')),
  CONSTRAINT ck_p916_step_status CHECK (status IN ('pending', 'in_progress', 'done', 'failed', 'abandoned')),
  CONSTRAINT ck_p916_step_attempts CHECK (attempts_used >= 0),
  CONSTRAINT ck_p916_step_failure_class CHECK (failure_class IS NULL OR failure_class IN ('transient', 'definitive', 'unknown')),
  CONSTRAINT uq_p916_step_identity UNIQUE (campaign_id, operation_id, stage)
);

CREATE TABLE IF NOT EXISTS public.product_9_16_two_stage_attempt_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL,
  operation_id   UUID NOT NULL,
  stage          TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  target         TEXT NOT NULL,
  request_id     UUID NOT NULL,
  status         TEXT NOT NULL DEFAULT 'in_progress',
  attempt_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  failure_class  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_p916_claim_operation FOREIGN KEY (campaign_id, operation_id)
    REFERENCES public.product_9_16_two_stage_operations (campaign_id, operation_id),
  CONSTRAINT ck_p916_claim_stage CHECK (stage IN ('base', 'expansion')),
  CONSTRAINT ck_p916_claim_number CHECK (attempt_number >= 1),
  CONSTRAINT ck_p916_claim_target CHECK (target IN ('primary', 'fallback', 'initial', 'retry')),
  CONSTRAINT ck_p916_claim_status CHECK (status IN ('in_progress', 'completed', 'failed', 'abandoned')),
  CONSTRAINT ck_p916_claim_failure_class CHECK (failure_class IS NULL OR failure_class IN ('transient', 'definitive', 'unknown')),
  CONSTRAINT uq_p916_claim_request UNIQUE (campaign_id, operation_id, request_id),
  CONSTRAINT uq_p916_claim_sequence UNIQUE (campaign_id, operation_id, stage, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.product_9_16_two_stage_outcomes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL,
  operation_id      UUID NOT NULL,
  outcome           TEXT NOT NULL,
  stage             TEXT NOT NULL,
  support_reference TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_p916_outcome_operation FOREIGN KEY (campaign_id, operation_id)
    REFERENCES public.product_9_16_two_stage_operations (campaign_id, operation_id),
  CONSTRAINT ck_p916_outcome_kind CHECK (outcome IN ('unknown', 'failed')),
  CONSTRAINT ck_p916_outcome_stage CHECK (stage IN ('base', 'expansion')),
  CONSTRAINT uq_p916_outcome_operation UNIQUE (campaign_id, operation_id)
);

-- =============================================================================
-- 2. Índices
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_p916_attempt_in_progress
  ON public.product_9_16_two_stage_attempt_claims (campaign_id, operation_id)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_p916_claim_operation
  ON public.product_9_16_two_stage_attempt_claims (campaign_id, operation_id, stage);

CREATE INDEX IF NOT EXISTS idx_p916_claim_status
  ON public.product_9_16_two_stage_attempt_claims (status);

CREATE INDEX IF NOT EXISTS idx_p916_step_operation
  ON public.product_9_16_two_stage_steps (campaign_id, operation_id);

-- =============================================================================
-- 3. RLS e grants (RPC-only; service_role apenas SELECT nas tabelas)
-- =============================================================================

ALTER TABLE public.product_9_16_two_stage_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_9_16_two_stage_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_9_16_two_stage_attempt_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_9_16_two_stage_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role reads p916 operations" ON public.product_9_16_two_stage_operations;
CREATE POLICY "Service role reads p916 operations"
  ON public.product_9_16_two_stage_operations FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Service role reads p916 steps" ON public.product_9_16_two_stage_steps;
CREATE POLICY "Service role reads p916 steps"
  ON public.product_9_16_two_stage_steps FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Service role reads p916 claims" ON public.product_9_16_two_stage_attempt_claims;
CREATE POLICY "Service role reads p916 claims"
  ON public.product_9_16_two_stage_attempt_claims FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Service role reads p916 outcomes" ON public.product_9_16_two_stage_outcomes;
CREATE POLICY "Service role reads p916 outcomes"
  ON public.product_9_16_two_stage_outcomes FOR SELECT TO service_role USING (true);

REVOKE ALL ON TABLE public.product_9_16_two_stage_operations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_9_16_two_stage_steps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_9_16_two_stage_attempt_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_9_16_two_stage_outcomes FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.product_9_16_two_stage_operations FROM service_role;
REVOKE ALL ON TABLE public.product_9_16_two_stage_steps FROM service_role;
REVOKE ALL ON TABLE public.product_9_16_two_stage_attempt_claims FROM service_role;
REVOKE ALL ON TABLE public.product_9_16_two_stage_outcomes FROM service_role;

GRANT SELECT ON TABLE public.product_9_16_two_stage_operations TO service_role;
GRANT SELECT ON TABLE public.product_9_16_two_stage_steps TO service_role;
GRANT SELECT ON TABLE public.product_9_16_two_stage_attempt_claims TO service_role;
GRANT SELECT ON TABLE public.product_9_16_two_stage_outcomes TO service_role;

-- Imutabilidade do desfecho persistido.
CREATE OR REPLACE FUNCTION public.trg_p916_outcome_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'product_9_16_outcome_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_p916_outcome_immutable ON public.product_9_16_two_stage_outcomes;
CREATE TRIGGER trg_p916_outcome_immutable
  BEFORE UPDATE OR DELETE ON public.product_9_16_two_stage_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.trg_p916_outcome_immutable_fn();

-- =============================================================================
-- 4. Views de união com origem canônica
-- =============================================================================

CREATE OR REPLACE VIEW public.product_generation_active_claims_v AS
SELECT
  c.campaign_id,
  c.operation_id,
  'legacy'::TEXT AS source,
  NULL::TEXT AS stage,
  c.attempt_number,
  c.status,
  c.updated_at
FROM public.product_1_1_generation_attempt_claims c
WHERE c.status = 'in_progress'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_operations o
    WHERE o.campaign_id = c.campaign_id AND o.operation_id = c.operation_id
  )
UNION ALL
SELECT
  c.campaign_id,
  c.operation_id,
  '9_16_two_stage'::TEXT AS source,
  c.stage,
  c.attempt_number,
  c.status,
  c.updated_at
FROM public.product_9_16_two_stage_attempt_claims c
WHERE c.status = 'in_progress'
  AND EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_operations o
    WHERE o.campaign_id = c.campaign_id AND o.operation_id = c.operation_id
  );

CREATE OR REPLACE VIEW public.product_generation_claim_history_v AS
SELECT
  c.campaign_id,
  c.operation_id,
  'legacy'::TEXT AS source,
  NULL::TEXT AS stage,
  c.attempt_number,
  c.status,
  c.updated_at
FROM public.product_1_1_generation_attempt_claims c
WHERE NOT EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_operations o
    WHERE o.campaign_id = c.campaign_id AND o.operation_id = c.operation_id
  )
UNION ALL
SELECT
  c.campaign_id,
  c.operation_id,
  '9_16_two_stage'::TEXT AS source,
  c.stage,
  c.attempt_number,
  c.status,
  c.updated_at
FROM public.product_9_16_two_stage_attempt_claims c
WHERE EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_operations o
    WHERE o.campaign_id = c.campaign_id AND o.operation_id = c.operation_id
  );

CREATE OR REPLACE VIEW public.product_generation_operation_outcomes_v AS
SELECT
  x.campaign_id,
  x.operation_id,
  'legacy'::TEXT AS source,
  x.outcome,
  NULL::TEXT AS stage,
  x.support_reference,
  x.created_at
FROM public.product_1_1_generation_outcomes x
WHERE NOT EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_operations o
    WHERE o.campaign_id = x.campaign_id AND o.operation_id = x.operation_id
  )
UNION ALL
SELECT
  x.campaign_id,
  x.operation_id,
  '9_16_two_stage'::TEXT AS source,
  x.outcome,
  x.stage,
  x.support_reference,
  x.created_at
FROM public.product_9_16_two_stage_outcomes x
WHERE EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_operations o
    WHERE o.campaign_id = x.campaign_id AND o.operation_id = x.operation_id
  );

REVOKE ALL ON TABLE public.product_generation_active_claims_v FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_generation_claim_history_v FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_generation_operation_outcomes_v FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.product_generation_active_claims_v TO service_role;
GRANT SELECT ON TABLE public.product_generation_claim_history_v TO service_role;
GRANT SELECT ON TABLE public.product_generation_operation_outcomes_v TO service_role;

-- =============================================================================
-- 5. Helper interno de abandono (sem EXECUTE para service_role)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.product_abandon_residual_attempts(
  p_campaign_id  UUID,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  -- O chamador autorizado já detém a trava C4; este helper NÃO re-trava.
  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  IF v_credit.status IN ('delivered', 'refunded') THEN RAISE EXCEPTION 'operation_terminal'; END IF;

  UPDATE public.product_1_1_generation_attempt_claims
     SET status = 'abandoned', updated_at = now()
   WHERE campaign_id = p_campaign_id
     AND operation_id = p_operation_id
     AND status = 'in_progress';

  UPDATE public.product_9_16_two_stage_attempt_claims
     SET status = 'abandoned', updated_at = now()
   WHERE campaign_id = p_campaign_id
     AND operation_id = p_operation_id
     AND status = 'in_progress';

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.product_abandon_residual_attempts(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- 6. RPCs de controle
-- =============================================================================

CREATE OR REPLACE FUNCTION public.product_9_16_open_operation(
  p_store_id     UUID,
  p_campaign_id  UUID,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_op          public.product_9_16_two_stage_operations%ROWTYPE;
  v_reserve     JSONB;
  v_inserted_id UUID;
  v_op_id       UUID;
  v_steps       JSONB;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF FOUND THEN
    SELECT * INTO v_op
    FROM public.product_9_16_two_stage_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

    IF NOT FOUND THEN
      -- Jamais converter operação antiga/legada em operação nova.
      RETURN jsonb_build_object('success', false, 'reason', 'operation_origin_conflict');
    END IF;

    IF v_op.store_id <> p_store_id THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'stage', s.stage, 'status', s.status, 'attempts_used', s.attempts_used,
             'failure_class', s.failure_class) ORDER BY s.stage), '[]'::jsonb)
    INTO v_steps
    FROM public.product_9_16_two_stage_steps s
    WHERE s.campaign_id = p_campaign_id AND s.operation_id = p_operation_id;

    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'status', v_credit.status,
      'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
      'origin', '9_16_two_stage', 'steps', v_steps);
  END IF;

  -- Sem linha financeira: cria controle e reserva na MESMA transação.
  INSERT INTO public.product_9_16_two_stage_operations (
    campaign_id, operation_id, store_id, credit_operation_ref, origin, contract_version
  ) VALUES (
    p_campaign_id, p_operation_id, p_store_id, NULL, '9_16_two_stage', 1
  )
  ON CONFLICT (campaign_id, operation_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- Corrida com outra abertura da mesma identidade: devolve a operação vencedora.
    SELECT * INTO v_op
    FROM public.product_9_16_two_stage_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'operation_in_progress'); END IF;
    IF v_op.store_id <> p_store_id THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
    END IF;

    SELECT * INTO v_credit
    FROM public.product_1_1_campaign_credit_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'stage', s.stage, 'status', s.status, 'attempts_used', s.attempts_used,
             'failure_class', s.failure_class) ORDER BY s.stage), '[]'::jsonb)
    INTO v_steps
    FROM public.product_9_16_two_stage_steps s
    WHERE s.campaign_id = p_campaign_id AND s.operation_id = p_operation_id;

    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'status', v_credit.status,
      'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
      'origin', '9_16_two_stage', 'steps', v_steps);
  END IF;

  INSERT INTO public.product_9_16_two_stage_steps (campaign_id, operation_id, stage, status)
  VALUES
    (p_campaign_id, p_operation_id, 'base', 'pending'),
    (p_campaign_id, p_operation_id, 'expansion', 'pending')
  ON CONFLICT (campaign_id, operation_id, stage) DO NOTHING;

  v_reserve := public.product_1_1_reserve_credit_operation(
    p_store_id, p_campaign_id, p_operation_id, 1, '{}'::jsonb
  );

  IF v_reserve IS NULL OR (v_reserve->>'success') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'credit_reservation_failed';
  END IF;

  -- `idempotent: true` aqui significa que a linha financeira já existia e não foi
  -- criada por esta transação: adotar seria converter operação antiga. Aborta tudo.
  IF (v_reserve->>'idempotent') = 'true' THEN
    RAISE EXCEPTION 'operation_origin_conflict';
  END IF;

  SELECT id INTO v_op_id
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  UPDATE public.product_9_16_two_stage_operations
     SET credit_operation_ref = v_op_id, updated_at = now()
   WHERE id = v_inserted_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'stage', s.stage, 'status', s.status, 'attempts_used', s.attempts_used,
           'failure_class', s.failure_class) ORDER BY s.stage), '[]'::jsonb)
  INTO v_steps
  FROM public.product_9_16_two_stage_steps s
  WHERE s.campaign_id = p_campaign_id AND s.operation_id = p_operation_id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'status', COALESCE(v_reserve->>'status', 'reserved'),
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
    'origin', '9_16_two_stage', 'steps', v_steps);
END;
$$;

CREATE OR REPLACE FUNCTION public.product_9_16_acquire_step(
  p_campaign_id  UUID,
  p_operation_id UUID,
  p_stage        TEXT,
  p_request_id   UUID,
  p_target       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit          public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_op              public.product_9_16_two_stage_operations%ROWTYPE;
  v_existing        public.product_9_16_two_stage_attempt_claims%ROWTYPE;
  v_step            public.product_9_16_two_stage_steps%ROWTYPE;
  v_primary_count   INTEGER;
  v_fallback_count  INTEGER;
  v_stage_count     INTEGER;
  v_expected_number INTEGER;
  v_prev            public.product_9_16_two_stage_attempt_claims%ROWTYPE;
  v_token           UUID;
  v_attempt_number  INTEGER;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_stage IS NULL OR p_stage NOT IN ('base', 'expansion') THEN
    RAISE EXCEPTION 'invalid_stage';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'missing_request_id'; END IF;
  IF p_target IS NULL THEN RAISE EXCEPTION 'invalid_target'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('p916_request:' || p_request_id::text));

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_not_reserved');
  END IF;

  IF v_credit.status IN ('delivered', 'refunded') THEN
    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_terminal');
  END IF;

  SELECT * INTO v_op
  FROM public.product_9_16_two_stage_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_not_reserved');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_outcomes
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND outcome = 'unknown'
  ) THEN
    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_unknown');
  END IF;

  -- Desfecho definitivo persistido encerra a possibilidade de nova execução.
  IF EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_outcomes
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND outcome = 'failed'
  ) THEN
    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_terminal');
  END IF;

  -- Reenvio idempotente da MESMA requisição: devolve estado, nunca autorização.
  SELECT * INTO v_existing
  FROM public.product_9_16_two_stage_attempt_claims
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
    AND request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.stage <> p_stage OR v_existing.target <> p_target THEN
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_identity_conflict');
    END IF;
    RETURN jsonb_build_object(
      'acquired', false, 'authorization', 'query_only', 'reason', NULL,
      'attempt_token', v_existing.attempt_token, 'attempt_number', v_existing.attempt_number,
      'stage', v_existing.stage, 'target', v_existing.target);
  END IF;

  -- Uma única execução ativa por operação.
  IF EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_attempt_claims
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
      AND status = 'in_progress'
  ) THEN
    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_in_progress');
  END IF;

  SELECT * INTO v_step
  FROM public.product_9_16_two_stage_steps
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = p_stage
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_transition');
  END IF;

  IF v_step.status = 'done' THEN
    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_transition');
  END IF;

  -- Última tentativa da etapa: falha definitiva/desconhecida não reabre execução,
  -- mesmo antes de o desfecho ser persistido (fecha a janela finish → record_outcome).
  SELECT * INTO v_prev
  FROM public.product_9_16_two_stage_attempt_claims
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = p_stage
  ORDER BY attempt_number DESC
  LIMIT 1;

  IF FOUND AND v_prev.status IN ('failed', 'abandoned') THEN
    IF v_prev.failure_class = 'unknown' THEN
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_unknown');
    ELSIF v_prev.status = 'failed' AND v_prev.failure_class = 'transient' THEN
      -- retry/fallback permitido pela política; segue para os limites
      NULL;
    ELSE
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_transition');
    END IF;
  END IF;

  IF p_stage = 'expansion' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.product_9_16_two_stage_steps
      WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
        AND stage = 'base' AND status = 'done'
    ) THEN
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_transition');
    END IF;
    IF p_target NOT IN ('initial', 'retry') THEN
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_target');
    END IF;

    SELECT COUNT(*) INTO v_stage_count
    FROM public.product_9_16_two_stage_attempt_claims
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = 'expansion';

    IF v_stage_count >= 2 THEN
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'attempt_limit_reached');
    END IF;

    IF p_target = 'retry' THEN
      IF v_stage_count <> 1 THEN
        RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_transition');
      END IF;
      SELECT * INTO v_prev
      FROM public.product_9_16_two_stage_attempt_claims
      WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
        AND stage = 'expansion'
      ORDER BY attempt_number DESC
      LIMIT 1;

      IF v_prev.status <> 'failed' OR v_prev.failure_class IS DISTINCT FROM 'transient' THEN
        RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_transition');
      END IF;
    ELSIF v_stage_count <> 0 THEN
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_transition');
    END IF;

    v_attempt_number := v_stage_count + 1;
  ELSE
    IF p_target NOT IN ('primary', 'fallback') THEN
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'invalid_target');
    END IF;

    SELECT
      COUNT(*) FILTER (WHERE target = 'primary'),
      COUNT(*) FILTER (WHERE target = 'fallback'),
      COUNT(*)
    INTO v_primary_count, v_fallback_count, v_stage_count
    FROM public.product_9_16_two_stage_attempt_claims
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = 'base';

    IF v_stage_count >= 3 THEN
      RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'attempt_limit_reached');
    END IF;

    v_expected_number := v_stage_count + 1;

    IF p_target = 'primary' THEN
      IF v_fallback_count > 0 OR v_primary_count >= 2 THEN
        RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'attempt_limit_reached');
      END IF;
    ELSE
      IF v_primary_count < 1 OR v_fallback_count >= 1 THEN
        RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'attempt_limit_reached');
      END IF;
    END IF;

    v_attempt_number := v_expected_number;
  END IF;

  BEGIN
    INSERT INTO public.product_9_16_two_stage_attempt_claims (
      campaign_id, operation_id, stage, attempt_number, target, request_id, status
    ) VALUES (
      p_campaign_id, p_operation_id, p_stage, v_attempt_number, p_target, p_request_id, 'in_progress'
    )
    RETURNING attempt_token INTO v_token;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.product_9_16_two_stage_attempt_claims
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
      AND request_id = p_request_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'acquired', false, 'authorization', 'query_only', 'reason', NULL,
        'attempt_token', v_existing.attempt_token, 'attempt_number', v_existing.attempt_number,
        'stage', v_existing.stage, 'target', v_existing.target);
    END IF;

    RETURN jsonb_build_object('acquired', false, 'authorization', 'query_only', 'reason', 'operation_in_progress');
  END;

  UPDATE public.product_9_16_two_stage_steps
     SET status = 'in_progress',
         attempts_used = GREATEST(attempts_used, v_attempt_number),
         updated_at = now()
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = p_stage;

  RETURN jsonb_build_object(
    'acquired', true, 'authorization', 'execute', 'reason', NULL,
    'attempt_token', v_token, 'attempt_number', v_attempt_number,
    'stage', p_stage, 'target', p_target);
END;
$$;

CREATE OR REPLACE FUNCTION public.product_9_16_finish_step(
  p_campaign_id   UUID,
  p_operation_id  UUID,
  p_attempt_token UUID,
  p_expected_status TEXT,
  p_status        TEXT,
  p_failure_class TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit  public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_claim   public.product_9_16_two_stage_attempt_claims%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_attempt_token IS NULL THEN RAISE EXCEPTION 'missing_attempt_token'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('completed', 'failed', 'abandoned') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF p_expected_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'invalid_expected_status';
  END IF;
  IF p_failure_class IS NOT NULL AND p_failure_class NOT IN ('transient', 'definitive', 'unknown') THEN
    RAISE EXCEPTION 'invalid_failure_class';
  END IF;
  IF p_status = 'abandoned' AND p_failure_class IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_failure_class';
  END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_reserved'; END IF;
  IF v_credit.status IN ('delivered', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_outcomes
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND outcome = 'unknown'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_unknown');
  END IF;

  SELECT * INTO v_claim
  FROM public.product_9_16_two_stage_attempt_claims
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
    AND attempt_token = p_attempt_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_transition');
  END IF;

  IF v_claim.status = p_status THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'status', v_claim.status,
      'stage', v_claim.stage, 'attempt_number', v_claim.attempt_number);
  END IF;

  IF v_claim.status <> 'in_progress' OR v_claim.status <> p_expected_status THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_transition');
  END IF;

  UPDATE public.product_9_16_two_stage_attempt_claims
     SET status = p_status, failure_class = p_failure_class, updated_at = now()
   WHERE id = v_claim.id;

  IF p_status = 'completed' THEN
    UPDATE public.product_9_16_two_stage_steps
       SET status = 'done', failure_class = NULL, updated_at = now()
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = v_claim.stage;
  ELSIF p_status = 'failed' THEN
    UPDATE public.product_9_16_two_stage_steps
       SET status = 'failed', failure_class = p_failure_class, updated_at = now()
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = v_claim.stage;
  ELSE
    UPDATE public.product_9_16_two_stage_steps
       SET status = 'abandoned', updated_at = now()
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = v_claim.stage;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'status', p_status,
    'stage', v_claim.stage, 'attempt_number', v_claim.attempt_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.product_9_16_record_outcome(
  p_campaign_id       UUID,
  p_operation_id      UUID,
  p_stage             TEXT,
  p_outcome           TEXT,
  p_support_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_row         public.product_9_16_two_stage_outcomes%ROWTYPE;
  v_inserted_id UUID;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_stage IS NULL OR p_stage NOT IN ('base', 'expansion') THEN RAISE EXCEPTION 'invalid_stage'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('unknown', 'failed') THEN RAISE EXCEPTION 'invalid_outcome'; END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_reserved'; END IF;
  IF v_credit.status IN ('delivered', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal');
  END IF;

  INSERT INTO public.product_9_16_two_stage_outcomes (
    campaign_id, operation_id, outcome, stage, support_reference
  ) VALUES (
    p_campaign_id, p_operation_id, p_outcome, p_stage, p_support_reference
  )
  ON CONFLICT (campaign_id, operation_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  SELECT * INTO v_row
  FROM public.product_9_16_two_stage_outcomes
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  IF v_inserted_id IS NULL THEN
    IF v_row.outcome = p_outcome AND v_row.stage = p_stage THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true,
        'outcome', v_row.outcome, 'stage', v_row.stage,
        'support_reference', v_row.support_reference);
    END IF;
    RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'outcome', v_row.outcome, 'stage', v_row.stage,
    'support_reference', v_row.support_reference);
END;
$$;

CREATE OR REPLACE FUNCTION public.product_9_16_resume_operation(
  p_campaign_id  UUID,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit        public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_base          public.product_9_16_two_stage_steps%ROWTYPE;
  v_expansion     public.product_9_16_two_stage_steps%ROWTYPE;
  v_unknown       BOOLEAN;
  v_failed_outcome BOOLEAN;
  v_action        TEXT;
  v_next_target   TEXT;
  v_primary_count INTEGER;
  v_fallback_count INTEGER;
  v_base_count    INTEGER;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_not_found');
  END IF;

  SELECT * INTO v_base
  FROM public.product_9_16_two_stage_steps
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = 'base';

  SELECT * INTO v_expansion
  FROM public.product_9_16_two_stage_steps
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = 'expansion';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_outcomes
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND outcome = 'unknown'
  ) INTO v_unknown;

  SELECT EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_outcomes
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND outcome = 'failed'
  ) INTO v_failed_outcome;

  IF v_credit.status IN ('delivered', 'refunded') THEN
    v_action := 'blocked';
  ELSIF v_unknown OR v_failed_outcome THEN
    v_action := 'blocked';
  ELSIF v_base.status IN ('pending', 'in_progress') THEN
    IF v_base.status = 'in_progress' THEN
      v_action := 'wait';
    ELSE
      v_action := 'acquire_base';
      v_next_target := 'primary';
    END IF;
  ELSIF v_base.status = 'done' THEN
    IF v_expansion.status IN ('pending', 'in_progress') THEN
      IF v_expansion.status = 'in_progress' THEN
        v_action := 'wait';
      ELSE
        v_action := 'acquire_expansion';
        v_next_target := 'initial';
      END IF;
    ELSIF v_expansion.status = 'failed'
          AND v_expansion.attempts_used = 1
          AND v_expansion.failure_class = 'transient' THEN
      v_action := 'retry_expansion';
      v_next_target := 'retry';
    ELSIF v_expansion.status = 'done' THEN
      v_action := 'deliver';
    ELSE
      v_action := 'blocked';
    END IF;
  ELSIF v_base.status = 'failed' THEN
    IF v_base.failure_class IS NULL OR v_base.failure_class IN ('definitive', 'unknown') THEN
      v_action := 'blocked';
    ELSE
      SELECT
        COUNT(*) FILTER (WHERE target = 'primary'),
        COUNT(*) FILTER (WHERE target = 'fallback'),
        COUNT(*)
      INTO v_primary_count, v_fallback_count, v_base_count
      FROM public.product_9_16_two_stage_attempt_claims
      WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND stage = 'base';

      IF v_base_count >= 3 OR v_fallback_count >= 1 THEN
        v_action := 'blocked';
      ELSIF v_primary_count < 2 THEN
        v_action := 'retry_base';
        v_next_target := 'primary';
      ELSE
        v_action := 'retry_base';
        v_next_target := 'fallback';
      END IF;
    END IF;
  ELSE
    v_action := 'blocked';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'action', v_action, 'next_target', v_next_target,
    'origin', '9_16_two_stage',
    'credit_status', v_credit.status,
    'base_status', v_base.status, 'base_attempts', v_base.attempts_used,
    'expansion_status', v_expansion.status, 'expansion_attempts', v_expansion.attempts_used,
    'unknown', v_unknown, 'failed_outcome', v_failed_outcome);
END;
$$;

-- Grants das RPCs de controle.
REVOKE ALL ON FUNCTION public.product_9_16_open_operation(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_9_16_open_operation(UUID, UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.product_9_16_acquire_step(UUID, UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_9_16_acquire_step(UUID, UUID, TEXT, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.product_9_16_finish_step(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_9_16_finish_step(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.product_9_16_record_outcome(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_9_16_record_outcome(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.product_9_16_resume_operation(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_9_16_resume_operation(UUID, UUID) TO service_role;

-- =============================================================================
-- 7. Adaptações compartilhadas localizadas (assinaturas preservadas)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.product_1_1_close_failed_operation(
  p_campaign_id UUID, p_operation_id UUID, p_art_kind TEXT, p_observed_epoch INTEGER, p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_in_progress BOOLEAN;
  v_failed      BOOLEAN;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  IF v_credit.status = 'refunded' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'refunded',
      'campaign_id', v_credit.campaign_id, 'operation_id', v_credit.operation_id,
      'action', 'close_failed_operation');
  END IF;
  IF v_credit.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;
  IF v_credit.publication_state IN ('in_flight', 'result_unknown', 'published') THEN
    RAISE EXCEPTION 'publication_in_progress';
  END IF;
  IF p_observed_epoch IS DISTINCT FROM v_credit.state_epoch THEN RAISE EXCEPTION 'evidence_stale'; END IF;
  IF v_credit.status NOT IN ('reserved', 'art_uploaded') THEN RAISE EXCEPTION 'operation_terminal'; END IF;
  IF p_art_kind IS DISTINCT FROM 'absent' THEN RAISE EXCEPTION 'absent_not_confirmed'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_generation_active_claims_v
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND status = 'in_progress'
  ) INTO v_in_progress;
  IF v_in_progress THEN RAISE EXCEPTION 'operation_in_progress'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_generation_operation_outcomes_v
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND outcome = 'failed'
  ) INTO v_failed;
  IF NOT v_failed THEN RAISE EXCEPTION 'finality_not_recorded'; END IF;

  PERFORM public.product_1_1_refund_campaign_credit_operation(p_campaign_id, p_operation_id, btrim(p_reason));

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'refunded',
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id, 'action', 'close_failed_operation');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_product_1_1_pending(
  p_actor_id UUID, p_campaign_id UUID, p_operation_id UUID, p_action TEXT,
  p_reason TEXT, p_resolution_operation_id UUID, p_evidence JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit        public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_existing      JSONB;
  v_existing_action TEXT;
  v_existing_actor UUID;
  v_existing_reason TEXT;
  v_art_kind      TEXT;
  v_execution_ended BOOLEAN;
  v_in_progress   BOOLEAN;
  v_authorized_abandon BOOLEAN := false;
  v_authorized_closure BOOLEAN := false;
  v_is_two_stage BOOLEAN := false;
  v_stage         TEXT;
  v_result        JSONB;
  v_refund_id     UUID;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_resolution_operation_id IS NULL THEN RAISE EXCEPTION 'missing_resolution_operation_id'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('deliver_existing_art', 'refund_once') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
  IF (p_evidence->>'origin') IS DISTINCT FROM 'server-derived' THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
  v_art_kind := p_evidence->>'art_kind';
  IF v_art_kind IS NULL OR v_art_kind NOT IN ('integral', 'absent', 'invalid', 'indeterminate') THEN
    RAISE EXCEPTION 'invalid_evidence';
  END IF;
  IF jsonb_typeof(p_evidence->'execution_ended') <> 'boolean' THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
  v_authorized_abandon := COALESCE((p_evidence->>'authorized_abandon') = 'true', false);
  v_authorized_closure := COALESCE((p_evidence->>'authorized_publication_closure') = 'true', false);
  IF v_art_kind IN ('invalid', 'indeterminate') THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('p1_1_pending_resolution:' || p_resolution_operation_id::text));

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  SELECT metadata, action, actor_id, btrim(reason)
    INTO v_existing, v_existing_action, v_existing_actor, v_existing_reason
  FROM public.admin_audit_log
  WHERE operation_id = p_resolution_operation_id;

  IF FOUND THEN
    IF v_existing_action = 'product_1_1_pending_resolution'
       AND (v_existing->>'campaign_id') = p_campaign_id::text
       AND (v_existing->>'operation_id') = p_operation_id::text
       AND (v_existing->>'action') = p_action
       AND (v_existing->>'art_kind') = v_art_kind
       AND v_existing_actor = p_actor_id
       AND v_existing_reason = btrim(p_reason) THEN
      RETURN COALESCE(v_existing, '{}'::jsonb) || jsonb_build_object('idempotent', true);
    END IF;
    RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
  END IF;

  IF v_credit.status = 'delivered' AND p_action = 'deliver_existing_art' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'campaign_id', v_credit.campaign_id,
      'operation_id', v_credit.operation_id, 'action', p_action, 'status', 'delivered', 'art_kind', v_art_kind);
  END IF;
  IF v_credit.status = 'refunded' AND p_action = 'refund_once' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'campaign_id', v_credit.campaign_id,
      'operation_id', v_credit.operation_id, 'action', p_action, 'status', 'refunded', 'art_kind', v_art_kind);
  END IF;
  IF v_credit.status IN ('delivered', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_generation_active_claims_v
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND status = 'in_progress'
  ) INTO v_in_progress;

  v_execution_ended := NOT v_in_progress;

  IF v_in_progress AND NOT v_authorized_abandon THEN RAISE EXCEPTION 'operation_in_progress'; END IF;

  IF p_action = 'refund_once' THEN
    IF v_credit.publication_state = 'published' THEN RAISE EXCEPTION 'publication_active_art'; END IF;
    IF v_credit.publication_state IN ('in_flight', 'result_unknown') THEN
      IF NOT v_authorized_closure THEN RAISE EXCEPTION 'publication_in_progress'; END IF;
    ELSE
      IF (p_evidence->>'state_epoch') IS DISTINCT FROM v_credit.state_epoch::text THEN
        RAISE EXCEPTION 'evidence_stale';
      END IF;
    END IF;
  END IF;

  -- Abandona o residual ANTES da transição financeira: o helper interno exige
  -- linha não terminal. A transição e o abandono continuam na MESMA transação.
  IF v_in_progress THEN
    PERFORM public.product_abandon_residual_attempts(p_campaign_id, p_operation_id);
  END IF;

  IF p_action = 'deliver_existing_art' THEN
    IF v_art_kind <> 'integral' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    PERFORM public.product_1_1_confirm_existing_art(p_campaign_id, p_operation_id, 'integral');
  ELSE
    IF v_art_kind <> 'absent' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    IF NOT v_execution_ended AND NOT v_authorized_abandon THEN RAISE EXCEPTION 'execution_not_ended'; END IF;
    IF v_credit.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;

    IF v_credit.publication_state IN ('in_flight', 'result_unknown') THEN
      IF v_credit.credit_tx_id IS NULL THEN RAISE EXCEPTION 'credit_reservation_missing_tx'; END IF;
      v_refund_id := public.refund_credit(v_credit.credit_tx_id, btrim(p_reason),
        'p1_1_refund_' || p_campaign_id::text || '_' || p_operation_id::text, '{}'::jsonb);
      UPDATE public.product_1_1_campaign_credit_operations
         SET status = 'refunded', refund_tx_id = v_refund_id,
             state_epoch = state_epoch + 1, updated_at = now()
       WHERE id = v_credit.id;
    ELSE
      PERFORM public.product_1_1_refund_campaign_credit_operation(p_campaign_id, p_operation_id, btrim(p_reason));
    END IF;
  END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  SELECT EXISTS (
    SELECT 1 FROM public.product_9_16_two_stage_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  ) INTO v_is_two_stage;

  IF v_is_two_stage THEN
    SELECT stage INTO v_stage
    FROM public.product_9_16_two_stage_steps
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
      AND status = 'in_progress'
    LIMIT 1;
  END IF;

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false,
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
    'action', p_action, 'status', v_credit.status, 'art_kind', v_art_kind,
    'reason', btrim(p_reason),
    'flow', CASE WHEN v_is_two_stage THEN '9_16_two_stage' ELSE 'legacy' END,
    'stage', v_stage);

  BEGIN
    INSERT INTO public.admin_audit_log (
      actor_id, action, target_type, target_id, reason, operation_id, metadata
    ) VALUES (
      p_actor_id, 'product_1_1_pending_resolution', 'campaign', p_campaign_id,
      btrim(p_reason), p_resolution_operation_id, v_result
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'operation_identity_conflict';
  END;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.product_1_1_get_campaign_operation_by_campaign(
  p_campaign_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_has_outcome BOOLEAN := false;
  v_unknown     BOOLEAN := false;
  v_terminal    BOOLEAN := false;
  v_outcome     TEXT;
  v_support     TEXT;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  v_terminal := v_credit.status IN ('delivered', 'refunded');

  SELECT outcome, support_reference INTO v_outcome, v_support
  FROM public.product_generation_operation_outcomes_v
  WHERE campaign_id = p_campaign_id AND operation_id = v_credit.operation_id
  LIMIT 1;
  v_has_outcome := FOUND;

  IF v_has_outcome AND v_outcome = 'unknown' THEN v_unknown := true; END IF;

  RETURN jsonb_build_object(
    'success', true, 'status', v_credit.status,
    'campaign_id', v_credit.campaign_id, 'operation_id', v_credit.operation_id,
    'amount', v_credit.amount, 'credit_tx_id', v_credit.credit_tx_id,
    'refund_tx_id', v_credit.refund_tx_id,
    'consumed_definitive', (v_credit.status = 'delivered'),
    'terminal', v_terminal,
    'unknown', (v_unknown AND NOT v_terminal),
    'outcome', CASE WHEN v_has_outcome AND NOT v_terminal THEN v_outcome ELSE NULL END,
    'support_reference', CASE WHEN v_has_outcome AND NOT v_terminal THEN v_support ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.product_1_1_close_failed_operation(UUID, UUID, TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_close_failed_operation(UUID, UUID, TEXT, INTEGER, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB)
  TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID)
  TO service_role;

-- =============================================================================
-- REVERT (manual, somente com autorização; executar na ordem abaixo)
-- =============================================================================
-- Restaurar ANTES as definições compartilhadas anteriores:
--   - product_1_1_close_failed_operation: reexecutar a definição de
--     20261016000001_f56_2b2b_publication_fence.sql.
--   - admin_resolve_product_1_1_pending: reexecutar a definição de
--     20261016000001_f56_2b2b_publication_fence.sql.
--   - product_1_1_get_campaign_operation_by_campaign: reexecutar a definição de
--     20261015000003_f56_2b2b_pending_read.sql.
-- Depois:
-- REVOKE ALL ON FUNCTION public.product_9_16_open_operation(UUID, UUID, UUID) FROM service_role;
-- REVOKE ALL ON FUNCTION public.product_9_16_acquire_step(UUID, UUID, TEXT, UUID, TEXT) FROM service_role;
-- REVOKE ALL ON FUNCTION public.product_9_16_finish_step(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM service_role;
-- REVOKE ALL ON FUNCTION public.product_9_16_record_outcome(UUID, UUID, TEXT, TEXT, TEXT) FROM service_role;
-- REVOKE ALL ON FUNCTION public.product_9_16_resume_operation(UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_9_16_resume_operation(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.product_9_16_record_outcome(UUID, UUID, TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.product_9_16_finish_step(UUID, UUID, UUID, TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.product_9_16_acquire_step(UUID, UUID, TEXT, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.product_9_16_open_operation(UUID, UUID, UUID);
-- REVOKE ALL ON FUNCTION public.product_abandon_residual_attempts(UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_abandon_residual_attempts(UUID, UUID);
-- REVOKE ALL ON TABLE public.product_generation_operation_outcomes_v FROM service_role;
-- REVOKE ALL ON TABLE public.product_generation_claim_history_v FROM service_role;
-- REVOKE ALL ON TABLE public.product_generation_active_claims_v FROM service_role;
-- DROP VIEW IF EXISTS public.product_generation_operation_outcomes_v;
-- DROP VIEW IF EXISTS public.product_generation_claim_history_v;
-- DROP VIEW IF EXISTS public.product_generation_active_claims_v;
-- DROP TRIGGER IF EXISTS trg_p916_outcome_immutable ON public.product_9_16_two_stage_outcomes;
-- DROP FUNCTION IF EXISTS public.trg_p916_outcome_immutable_fn();
-- DROP TABLE IF EXISTS public.product_9_16_two_stage_outcomes;
-- DROP TABLE IF EXISTS public.product_9_16_two_stage_attempt_claims;
-- DROP TABLE IF EXISTS public.product_9_16_two_stage_steps;
-- DROP TABLE IF EXISTS public.product_9_16_two_stage_operations;
-- `credit_transactions` NÃO é tocada pelo REVERT.
