-- F56.2b1b — Início de tentativa atômico do Produto 1:1 (Plano 03, B1B-D12 / REQ-56.2.2-05)
-- This migration is LOCAL-ONLY and is only AUTHORED here. Do NOT run
-- `supabase db push` (nor any remote mutation / reset / migration up on a remote
-- instance). Apply exclusively to the isolated, disposable instance
-- (`vendeo-f562a-isolated`) via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- and only in Plan 09 (O2). Applying it anywhere else is OUT OF SCOPE.
--
-- One attempt start at a time, purely in Postgres (NO queue/cron/worker):
--   1. `public.product_1_1_generation_attempt_claims` — the attempt claim, with
--      identity `(campaign_id, operation_id, attempt_number)` and a UNIQUE
--      partial index enforcing a single `in_progress` claim per operation.
--   1b. C1 — `public.product_1_1_generation_outcomes` — the PERSISTED, durable
--      representation of the UNKNOWN result (`outcome IN ('unknown','failed')`,
--      one row per operation, immutable by trigger).
--   2. RPCs (`SECURITY DEFINER SET search_path = ''`):
--      - `product_1_1_acquire_attempt_start` — takes the SHARED `FOR UPDATE`
--        lock on the credit-operation line (C4, the SAME row the Plan 07
--        financial resolution locks), then enforces the PERMITTED SEQUENCE and
--        PREVIOUS STATE before deriving PER-TARGET counters from the persisted
--        claims (`primary` <= 2, `fallback` <= 1, total <= 3): `attempt_number`
--        MUST be `claims_count + 1` (`out_of_sequence`), the FIRST attempt MUST
--        be `primary` (`fallback_before_primary`), no `primary` after a
--        `fallback` (`primary_after_fallback`), and a new attempt is refused
--        after a `done` claim (`attempt_already_completed`) or once the credit
--        operation is `art_uploaded` (`operation_art_uploaded`). A `fallback`
--        may start on the 2nd call on explicit unavailability, NEVER by a fixed
--        `attempt_seq = 3` position.
--      - `product_1_1_finish_attempt` — CAS `in_progress -> done|failed|abandoned`
--        (`abandoned` = status terminal dedicado do resultado desconhecido
--        persistido, correção de integração do Plano 04 — NÃO implica falha/
--        estorno e o marcador `unknown` mantém novas tentativas recusadas).
--      - `product_1_1_get_campaign_operation_by_campaign` — reads the credit
--        operation AND the persisted unknown outcome (I2 terminal precedence).
--      - `product_1_1_record_generation_outcome` — writes the persisted unknown
--        result under the SAME `FOR UPDATE` lock; an equivalent replay is
--        idempotent, a DIVERGENT replay (persisted outcome <> requested) is
--        refused with `operation_identity_conflict` (never a misleading success).
--
-- Reuse boundary: does NOT alter `credit_transactions`, `credit_balances` or
-- `product_1_1_campaign_credit_operations`; it only reads the credit-operation
-- line as the shared lock. `service_role` receives SELECT only (writes happen
-- solely through the RPCs).

-- =============================================================================
-- 1. Claim de tentativa (identidade única composta + um único `in_progress`)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_1_1_generation_attempt_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id   UUID NOT NULL,
  attempt_number INTEGER NOT NULL,
  target         TEXT NOT NULL CHECK (target IN ('primary','fallback')),
  status         TEXT NOT NULL DEFAULT 'in_progress'
                 CONSTRAINT ck_p1_1_attempt_claim_status
                 CHECK (status IN ('in_progress','done','failed','abandoned')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_p1_1_attempt_claim_seq UNIQUE (campaign_id, operation_id, attempt_number)
);

-- No máximo UM início de tentativa por vez por operação.
CREATE UNIQUE INDEX IF NOT EXISTS uq_p1_1_attempt_claim_in_progress
  ON public.product_1_1_generation_attempt_claims (campaign_id, operation_id)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_p1_1_attempt_claim_operation
  ON public.product_1_1_generation_attempt_claims (campaign_id, operation_id, target);

-- =============================================================================
-- 1b. C1 — resultado DESCONHECIDO persistido (uma linha por operação, imutável)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_1_1_generation_outcomes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id      UUID NOT NULL,
  outcome           TEXT NOT NULL CHECK (outcome IN ('unknown','failed')),
  support_reference TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_p1_1_generation_outcome_op UNIQUE (campaign_id, operation_id)
);

ALTER TABLE public.product_1_1_generation_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role reads product 1.1 generation outcomes"
  ON public.product_1_1_generation_outcomes;
CREATE POLICY "Service role reads product 1.1 generation outcomes"
  ON public.product_1_1_generation_outcomes FOR SELECT TO service_role
  USING (true);

-- Imutabilidade: UPDATE/DELETE recusados (a transição `(ausente) -> 'unknown'`
-- ocorre uma única vez e é terminal para novas tentativas).
CREATE OR REPLACE FUNCTION public.trg_p1_1_generation_outcome_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'product_1_1_generation_outcome_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_p1_1_generation_outcome_immutable
  ON public.product_1_1_generation_outcomes;
CREATE TRIGGER trg_p1_1_generation_outcome_immutable
  BEFORE UPDATE OR DELETE ON public.product_1_1_generation_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.trg_p1_1_generation_outcome_immutable_fn();

-- =============================================================================
-- 2. Privilégios mínimos (service_role apenas SELECT nas tabelas novas)
-- =============================================================================
ALTER TABLE public.product_1_1_generation_attempt_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role reads product 1.1 attempt claims"
  ON public.product_1_1_generation_attempt_claims;
CREATE POLICY "Service role reads product 1.1 attempt claims"
  ON public.product_1_1_generation_attempt_claims FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.product_1_1_generation_attempt_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_generation_attempt_claims FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_generation_attempt_claims TO service_role;

REVOKE ALL ON TABLE public.product_1_1_generation_outcomes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_generation_outcomes FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_generation_outcomes TO service_role;

-- =============================================================================
-- 3. RPC de aquisição de início de tentativa (trava comum C4 + F1)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_acquire_attempt_start(
  p_campaign_id    UUID,
  p_operation_id   UUID,
  p_target         TEXT,
  p_attempt_number INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit          public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_primary_count   INTEGER;
  v_fallback_count  INTEGER;
  v_total_count     INTEGER;
  v_expected_number INTEGER;
  v_unknown_exists  BOOLEAN;
  v_done_exists     BOOLEAN;
  v_inserted_id     UUID;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_target IS NULL OR p_target NOT IN ('primary','fallback') THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;
  IF p_attempt_number IS NULL OR p_attempt_number < 1 THEN
    RAISE EXCEPTION 'invalid_attempt_number';
  END IF;

  -- C4 — TRAVA comum por operação: a MESMA linha que a resolução financeira
  -- (Plano 07) trava. Iniciar tentativa e resolver financeiramente serializam
  -- NESTA linha; contar claims + checar `in_progress` NÃO fecharia a corrida.
  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Sem linha de crédito: operação ausente/terminal — não iniciável.
    RETURN jsonb_build_object('acquired', false, 'reason', 'operation_terminal');
  END IF;

  -- I2 — PRECEDÊNCIA TERMINAL: `delivered`/`refunded` PREVALECE sobre o marcador
  -- histórico `unknown` (a relação é imutável, mas o estado terminal manda).
  IF v_credit.status IN ('delivered','refunded') THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'operation_terminal');
  END IF;

  -- C1 — resultado DESCONHECIDO persistido: recusa nova tentativa (LÊ a
  -- representação persistida; NUNCA deduz por tempo).
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_outcomes
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND outcome = 'unknown'
  ) INTO v_unknown_exists;
  IF v_unknown_exists THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'operation_unknown');
  END IF;

  -- F1 — GUARDA DE ESTADO PRÉVIO: a arte já subiu (`art_uploaded`) ⇒ a operação
  -- aguarda entrega; NÃO faz sentido iniciar nova tentativa.
  IF v_credit.status = 'art_uploaded' THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'operation_art_uploaded');
  END IF;

  -- F1 — GUARDA DE ESTADO PRÉVIO: uma tentativa JÁ CONCLUÍDA (`done`) ⇒ não
  -- reiniciar (a conclusão é terminal para novas tentativas).
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_attempt_claims
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND status = 'done'
  ) INTO v_done_exists;
  IF v_done_exists THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_already_completed');
  END IF;

  -- F1 — contadores POR ALVO derivados dos claims persistidos.
  SELECT
    COUNT(*) FILTER (WHERE target = 'primary'),
    COUNT(*) FILTER (WHERE target = 'fallback'),
    COUNT(*)
  INTO v_primary_count, v_fallback_count, v_total_count
  FROM public.product_1_1_generation_attempt_claims
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  -- F1 — NUMERAÇÃO SEQUENCIAL: `attempt_number` DEVE ser o nº de claims + 1.
  -- (Impede reordenar/pular posições; `attempt_seq` fixo de posição não existe.)
  v_expected_number := v_total_count + 1;
  IF p_attempt_number <> v_expected_number THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'out_of_sequence');
  END IF;

  IF v_total_count >= 3 THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_limit_reached');
  END IF;

  -- F1 — TRANSIÇÕES permitidas por alvo (nunca por posição fixa `attempt_seq=3`):
  --   (0 claims) -> primary  com attempt_number = 1
  --   primary    -> primary  enquanto `primary` < 2 E nenhum `fallback`
  --   primary    -> fallback enquanto `primary` >= 1 E `fallback` = 0 (aceito JÁ na 2ª chamada)
  --   fallback   -> nada (o fallback é o último alvo; nenhum `primary` depois dele)
  IF p_target = 'primary' THEN
    -- Nenhum `primary` depois de um `fallback`.
    IF v_fallback_count > 0 THEN
      RETURN jsonb_build_object('acquired', false, 'reason', 'primary_after_fallback');
    END IF;
    IF v_primary_count >= 2 THEN
      RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_limit_reached');
    END IF;
  ELSIF p_target = 'fallback' THEN
    -- O `fallback` exige pelo menos um `primary` anterior.
    IF v_primary_count < 1 THEN
      RETURN jsonb_build_object('acquired', false, 'reason', 'fallback_before_primary');
    END IF;
    IF v_fallback_count >= 1 THEN
      RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_limit_reached');
    END IF;
  END IF;

  -- Aquisição atômica pela identidade única (sem erro incidental de unicidade).
  INSERT INTO public.product_1_1_generation_attempt_claims (
    campaign_id, operation_id, attempt_number, target, status
  ) VALUES (
    p_campaign_id, p_operation_id, p_attempt_number, p_target, 'in_progress'
  )
  ON CONFLICT (campaign_id, operation_id, attempt_number) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'already_started');
  END IF;

  RETURN jsonb_build_object(
    'acquired', true, 'reason', NULL,
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
    'attempt_number', p_attempt_number, 'target', p_target
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Índice único parcial `in_progress`: outra tentativa já está em andamento.
    RETURN jsonb_build_object('acquired', false, 'reason', 'in_progress');
END;
$$;

-- =============================================================================
-- 4. RPC de finalização do claim (CAS in_progress -> done|failed)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_finish_attempt(
  p_campaign_id    UUID,
  p_operation_id   UUID,
  p_attempt_number INTEGER,
  p_status         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_generation_attempt_claims%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_attempt_number IS NULL THEN RAISE EXCEPTION 'missing_attempt_number'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('done','failed','abandoned') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_row
  FROM public.product_1_1_generation_attempt_claims
  WHERE campaign_id = p_campaign_id
    AND operation_id = p_operation_id
    AND attempt_number = p_attempt_number
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_claim_not_found'; END IF;

  IF v_row.status = p_status THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'status', v_row.status,
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id,
      'attempt_number', v_row.attempt_number, 'target', v_row.target
    );
  END IF;

  IF v_row.status <> 'in_progress' THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  UPDATE public.product_1_1_generation_attempt_claims
     SET status = p_status, updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'status', p_status,
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id,
    'attempt_number', v_row.attempt_number, 'target', v_row.target
  );
END;
$$;

-- =============================================================================
-- 5. RPC de leitura por campanha (+ resultado desconhecido PERSISTIDO, I2)
-- =============================================================================
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
  v_credit  public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_outcome public.product_1_1_generation_outcomes%ROWTYPE;
  v_unknown BOOLEAN := false;
  v_terminal BOOLEAN := false;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;  -- legado: sem operação nova

  v_terminal := v_credit.status IN ('delivered','refunded');

  SELECT * INTO v_outcome
  FROM public.product_1_1_generation_outcomes
  WHERE campaign_id = p_campaign_id AND operation_id = v_credit.operation_id
  LIMIT 1;

  IF FOUND AND v_outcome.outcome = 'unknown' THEN
    v_unknown := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'status', v_credit.status,
    'campaign_id', v_credit.campaign_id, 'operation_id', v_credit.operation_id,
    'amount', v_credit.amount, 'credit_tx_id', v_credit.credit_tx_id,
    'refund_tx_id', v_credit.refund_tx_id,
    'consumed_definitive', (v_credit.status = 'delivered'),
    -- I2 — PRECEDÊNCIA TERMINAL: o estado terminal PREVALECE; `unknown` só
    -- governa operação NÃO terminal (a linha histórica é imutável, não governa).
    'terminal', v_terminal,
    'unknown', (v_unknown AND NOT v_terminal),
    'outcome', CASE WHEN v_unknown AND NOT v_terminal THEN 'unknown' ELSE NULL END,
    'support_reference',
      CASE WHEN v_unknown AND NOT v_terminal THEN v_outcome.support_reference ELSE NULL END
  );
END;
$$;

-- =============================================================================
-- 6. RPC de registro do resultado desconhecido (trava comum C4 + idempotente)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_record_generation_outcome(
  p_campaign_id       UUID,
  p_operation_id      UUID,
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
  v_inserted_id UUID;
  v_row         public.product_1_1_generation_outcomes%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('unknown','failed') THEN
    RAISE EXCEPTION 'invalid_outcome';
  END IF;

  -- C4 — MESMA trava comum na linha de crédito (a MESMA que acquire/Plano 07).
  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  IF v_credit.status IN ('delivered','refunded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal');
  END IF;

  INSERT INTO public.product_1_1_generation_outcomes (
    campaign_id, operation_id, outcome, support_reference
  ) VALUES (
    p_campaign_id, p_operation_id, p_outcome, p_support_reference
  )
  ON CONFLICT (campaign_id, operation_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  SELECT * INTO v_row
  FROM public.product_1_1_generation_outcomes
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  -- F2 — replay DIVERGENTE NUNCA é sucesso enganoso: se o insert conflitou
  -- (`v_inserted_id IS NULL`), COMPARA o `outcome` PERSISTIDO ao solicitado.
  --   equivalente ⇒ reuso idempotente (`{success:true, idempotent:true}`)
  --   divergente  ⇒ `{success:false, reason:'operation_identity_conflict'}`
  IF v_inserted_id IS NULL THEN
    IF v_row.outcome = p_outcome THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true,
        'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id,
        'outcome', v_row.outcome, 'support_reference', v_row.support_reference
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id,
    'outcome', v_row.outcome, 'support_reference', v_row.support_reference
  );
END;
$$;

-- =============================================================================
-- 7. Privilégios das funções (execução apenas por service_role)
-- =============================================================================
REVOKE ALL ON FUNCTION public.product_1_1_acquire_attempt_start(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_acquire_attempt_start(UUID, UUID, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_finish_attempt(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_finish_attempt(UUID, UUID, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_record_generation_outcome(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_record_generation_outcome(UUID, UUID, TEXT, TEXT) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- REVOKE ALL ON FUNCTION public.product_1_1_record_generation_outcome(UUID, UUID, TEXT, TEXT) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_record_generation_outcome(UUID, UUID, TEXT, TEXT);
-- REVOKE ALL ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_get_campaign_operation_by_campaign(UUID);
-- REVOKE ALL ON FUNCTION public.product_1_1_finish_attempt(UUID, UUID, INTEGER, TEXT) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_finish_attempt(UUID, UUID, INTEGER, TEXT);
-- REVOKE ALL ON FUNCTION public.product_1_1_acquire_attempt_start(UUID, UUID, TEXT, INTEGER) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_acquire_attempt_start(UUID, UUID, TEXT, INTEGER);
-- REVOKE ALL ON TABLE public.product_1_1_generation_outcomes FROM service_role;
-- DROP POLICY IF EXISTS "Service role reads product 1.1 generation outcomes" ON public.product_1_1_generation_outcomes;
-- DROP TRIGGER IF EXISTS trg_p1_1_generation_outcome_immutable ON public.product_1_1_generation_outcomes;
-- DROP FUNCTION IF EXISTS public.trg_p1_1_generation_outcome_immutable_fn();
-- DROP TABLE IF EXISTS public.product_1_1_generation_outcomes;
-- REVOKE ALL ON TABLE public.product_1_1_generation_attempt_claims FROM service_role;
-- DROP POLICY IF EXISTS "Service role reads product 1.1 attempt claims" ON public.product_1_1_generation_attempt_claims;
-- DROP TABLE IF EXISTS public.product_1_1_generation_attempt_claims;
