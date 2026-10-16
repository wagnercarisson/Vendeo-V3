-- F56.2b2b — B2.2 (Recorte 1 / Plano 08): FENCE de publicação (CR-01/SEC-01).
--
-- LOCAL-ONLY: apenas AUTORADA aqui. NÃO executar `supabase db push` nem mutação
-- remota/reset. Aplicar SOMENTE na instância isolada (`vendeo-f562a-isolated`) via
-- `npx --no-install supabase --workdir <ISO> migration up --local`, e SOMENTE após
-- o checkpoint da Task 6b do Plano 08.
--
-- FORWARD-ONLY: NÃO edita as migrations 20261015*. Adiciona:
--   * `publication_state` (CHECK ∈ none,in_flight,published,failed_before_upload,result_unknown)
--     — SEPARADO do `status` do crédito (`delivered`/`refunded` NÃO entram no CHECK);
--   * `publication_token UUID` — identidade do DONO da publicação (do begin ao deliver);
--   * `state_epoch INTEGER` — frescor (bumped por transição; NÃO é o token).
-- Cria `begin_publication`/`abort_publication`/`mark_result_unknown`/`confirm_existing_art`
-- e RECRIA `mark`/`deliver` (token), `close_failed_operation` e
-- `admin_resolve_product_1_1_pending` com o fence + a EXCEÇÃO ADMINISTRATIVA auditada.

-- =============================================================================
-- 1. Campos + backfill determinístico + CHECK separado do status
-- =============================================================================
ALTER TABLE public.product_1_1_campaign_credit_operations
  ADD COLUMN IF NOT EXISTS publication_state TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS publication_token UUID,
  ADD COLUMN IF NOT EXISTS state_epoch INTEGER NOT NULL DEFAULT 0;

-- Backfill determinístico (histórico pré-fence): arte já confirmada ⇒ published.
UPDATE public.product_1_1_campaign_credit_operations
   SET publication_state = CASE
         WHEN status IN ('art_uploaded','delivered') THEN 'published'
         ELSE 'none'
       END,
       publication_token = NULL,
       state_epoch = 0
 WHERE publication_state = 'none';

ALTER TABLE public.product_1_1_campaign_credit_operations
  DROP CONSTRAINT IF EXISTS chk_p1_1_credit_publication_state;
ALTER TABLE public.product_1_1_campaign_credit_operations
  ADD CONSTRAINT chk_p1_1_credit_publication_state
  CHECK (publication_state IN ('none','in_flight','published','failed_before_upload','result_unknown'));

-- =============================================================================
-- 2. begin_publication — anúncio ANTES do upload (sob C4); dono = publication_token
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_begin_publication(
  p_campaign_id  UUID,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row   public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_token UUID;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT * INTO v_row
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  -- Terminal (crédito) ⇒ nunca inicia publicação.
  IF v_row.status IN ('delivered','refunded') THEN RAISE EXCEPTION 'operation_terminal'; END IF;

  -- Já há dono OU proteção mantida (`result_unknown`) OU arte já publicada ⇒ NÃO
  -- concede uma 2ª publicação; o reenvio ACOMPANHA o estado existente.
  IF v_row.publication_state IN ('in_flight','result_unknown','published') THEN
    RETURN jsonb_build_object(
      'success', true, 'acquired', false,
      'publication_state', v_row.publication_state, 'state_epoch', v_row.state_epoch,
      'status', v_row.status);
  END IF;

  v_token := gen_random_uuid();
  UPDATE public.product_1_1_campaign_credit_operations
     SET publication_state = 'in_flight',
         publication_token = v_token,
         state_epoch = state_epoch + 1,
         updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'success', true, 'acquired', true, 'token', v_token,
    'publication_state', 'in_flight', 'state_epoch', v_row.state_epoch + 1, 'status', v_row.status);
END;
$$;

-- =============================================================================
-- 3. abort_publication — SÓ `before_upload`; outras fases NÃO limpam o fence
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_abort_publication(
  p_campaign_id       UUID,
  p_operation_id      UUID,
  p_publication_token UUID,
  p_phase             TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT * INTO v_row
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  -- Só o DONO e só em publicação ativa.
  IF v_row.publication_state <> 'in_flight' OR v_row.publication_token IS DISTINCT FROM p_publication_token THEN
    RETURN jsonb_build_object('success', false, 'reason', 'stale_publication');
  END IF;
  -- Só falha COMPROVADA antes do envio pode encerrar a publicação.
  IF p_phase IS DISTINCT FROM 'before_upload' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'abort_not_allowed');
  END IF;

  UPDATE public.product_1_1_campaign_credit_operations
     SET publication_state = 'failed_before_upload',
         publication_token = NULL,
         state_epoch = state_epoch + 1,
         updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'publication_state', 'failed_before_upload',
    'state_epoch', v_row.state_epoch + 1);
END;
$$;

-- =============================================================================
-- 4. mark_result_unknown — resultado DESCONHECIDO mantém a proteção
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_mark_result_unknown(
  p_campaign_id       UUID,
  p_operation_id      UUID,
  p_publication_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT * INTO v_row
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  IF v_row.publication_state <> 'in_flight' OR v_row.publication_token IS DISTINCT FROM p_publication_token THEN
    RETURN jsonb_build_object('success', false, 'reason', 'stale_publication');
  END IF;

  UPDATE public.product_1_1_campaign_credit_operations
     SET publication_state = 'result_unknown',
         state_epoch = state_epoch + 1,
         updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'publication_state', 'result_unknown',
    'state_epoch', v_row.state_epoch + 1);
END;
$$;

-- =============================================================================
-- 5. confirm_existing_art — RECUPERA objeto EXISTENTE (sem token, sem novo upload)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_confirm_existing_art(
  p_campaign_id  UUID,
  p_operation_id UUID,
  p_art_kind     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_epoch INTEGER;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  -- Sonda SERVER-SIDE; somente `integral` confirma. NUNCA aceitar declaração do cliente.
  IF p_art_kind IS DISTINCT FROM 'integral' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;

  SELECT * INTO v_row
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  -- NUNCA reabrir terminais.
  IF v_row.status IN ('delivered','refunded') THEN RAISE EXCEPTION 'operation_terminal'; END IF;
  IF v_row.status NOT IN ('reserved','art_uploaded') THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  v_epoch := v_row.state_epoch;
  IF v_row.status = 'reserved' THEN
    v_epoch := v_epoch + 1;
    UPDATE public.product_1_1_campaign_credit_operations
       SET status = 'art_uploaded', publication_state = 'published', state_epoch = v_epoch, updated_at = now()
     WHERE id = v_row.id;
  END IF;

  v_epoch := v_epoch + 1;
  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'delivered', publication_state = 'published', publication_token = NULL,
         state_epoch = v_epoch, updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'delivered',
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
    'publication_state', 'published', 'state_epoch', v_epoch);
END;
$$;

-- =============================================================================
-- 6. RECRIA mark/deliver — exigem o TOKEN do dono; limpam o fence; bump epoch
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_mark_campaign_credit_art_uploaded(
  p_campaign_id       UUID,
  p_operation_id      UUID,
  p_publication_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT * INTO v_row
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  IF v_row.status = 'art_uploaded' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'art_uploaded',
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
      'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
  END IF;
  -- Só o DONO pode confirmar a arte.
  IF v_row.publication_token IS DISTINCT FROM p_publication_token THEN
    RAISE EXCEPTION 'publication_not_owner';
  END IF;
  IF v_row.status <> 'reserved' THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'art_uploaded', publication_state = 'published',
         state_epoch = state_epoch + 1, updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'art_uploaded',
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
    'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.product_1_1_deliver_campaign_credit_operation(
  p_campaign_id       UUID,
  p_operation_id      UUID,
  p_publication_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT * INTO v_row
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  IF v_row.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'delivered',
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
      'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
  END IF;
  IF v_row.publication_token IS DISTINCT FROM p_publication_token THEN
    RAISE EXCEPTION 'publication_not_owner';
  END IF;
  IF v_row.status <> 'art_uploaded' THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'delivered', publication_state = 'published', publication_token = NULL,
         state_epoch = state_epoch + 1, updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'delivered',
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
    'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
END;
$$;

-- =============================================================================
-- 7. RECRIA close_failed_operation (000001) — fence bloqueia o AUTOMÁTICO
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_close_failed_operation(
  p_campaign_id  UUID,
  p_operation_id UUID,
  p_art_kind     TEXT,
  p_reason       TEXT
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

  -- FENCE: publicação ativa (in_flight/result_unknown) NUNCA é encerrada pelo automático.
  IF v_credit.publication_state IN ('in_flight','result_unknown') THEN
    RAISE EXCEPTION 'publication_in_progress';
  END IF;

  IF v_credit.status NOT IN ('reserved','art_uploaded') THEN RAISE EXCEPTION 'operation_terminal'; END IF;
  IF p_art_kind IS DISTINCT FROM 'absent' THEN RAISE EXCEPTION 'absent_not_confirmed'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_attempt_claims
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND status = 'in_progress'
  ) INTO v_in_progress;
  IF v_in_progress THEN RAISE EXCEPTION 'operation_in_progress'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_outcomes
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND outcome = 'failed'
  ) INTO v_failed;
  IF NOT v_failed THEN RAISE EXCEPTION 'finality_not_recorded'; END IF;

  PERFORM public.product_1_1_refund_campaign_credit_operation(
    p_campaign_id, p_operation_id, btrim(p_reason));
  UPDATE public.product_1_1_campaign_credit_operations
     SET state_epoch = state_epoch + 1, updated_at = now()
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'refunded',
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id, 'action', 'close_failed_operation');
END;
$$;

-- =============================================================================
-- 8. RECRIA admin_resolve_product_1_1_pending (000002) — fence + EXCEÇÃO ADMIN.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_product_1_1_pending(
  p_actor_id                 UUID,
  p_campaign_id              UUID,
  p_operation_id             UUID,
  p_action                   TEXT,
  p_reason                   TEXT,
  p_resolution_operation_id  UUID,
  p_evidence                 JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit             public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_existing           JSONB;
  v_existing_action    TEXT;
  v_existing_actor     UUID;
  v_existing_reason    TEXT;
  v_art_kind           TEXT;
  v_execution_ended    BOOLEAN;
  v_in_progress        BOOLEAN;
  v_authorized_abandon BOOLEAN := false;
  v_result             JSONB;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_resolution_operation_id IS NULL THEN RAISE EXCEPTION 'missing_resolution_operation_id'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('deliver_existing_art','refund_once') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' THEN
    RAISE EXCEPTION 'invalid_evidence';
  END IF;
  IF (p_evidence->>'origin') IS DISTINCT FROM 'server-derived' THEN
    RAISE EXCEPTION 'invalid_evidence';
  END IF;
  v_art_kind := p_evidence->>'art_kind';
  IF v_art_kind IS NULL OR v_art_kind NOT IN ('integral','absent','invalid','indeterminate') THEN
    RAISE EXCEPTION 'invalid_evidence';
  END IF;
  IF jsonb_typeof(p_evidence->'execution_ended') <> 'boolean' THEN
    RAISE EXCEPTION 'invalid_evidence';
  END IF;
  v_authorized_abandon := COALESCE((p_evidence->>'authorized_abandon') = 'true', false);

  IF v_art_kind IN ('invalid','indeterminate') THEN
    RAISE EXCEPTION 'insufficient_evidence';
  END IF;

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
  IF v_credit.status IN ('delivered','refunded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_attempt_claims
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND status = 'in_progress'
  ) INTO v_in_progress;
  v_execution_ended := NOT v_in_progress;

  IF v_in_progress AND NOT v_authorized_abandon THEN RAISE EXCEPTION 'operation_in_progress'; END IF;

  -- FENCE (Recorte 1): o encerramento financeiro NÃO pode vencer publicação ativa —
  -- EXCETO pela EXCEÇÃO ADMINISTRATIVA autorizada/auditada (`authorized_abandon`),
  -- que torna a operação TERMINAL (resultado tardio não reabre nem cobra).
  IF p_action = 'refund_once'
     AND v_credit.publication_state IN ('in_flight','result_unknown')
     AND NOT v_authorized_abandon THEN
    RAISE EXCEPTION 'publication_in_progress';
  END IF;

  -- FRESCOR da evidência de ausência: o `state_epoch` capturado ANTES da sonda tem
  -- de bater com o corrente sob a trava (senão a ausência é obsoleta).
  IF p_action = 'refund_once'
     AND NOT v_authorized_abandon
     AND (p_evidence->>'state_epoch') IS DISTINCT FROM v_credit.state_epoch::text THEN
    RAISE EXCEPTION 'evidence_stale';
  END IF;

  IF p_action = 'deliver_existing_art' THEN
    IF v_art_kind <> 'integral' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    IF v_credit.status = 'reserved' THEN
      PERFORM public.product_1_1_mark_campaign_credit_art_uploaded(
        p_campaign_id, p_operation_id, v_credit.publication_token);
    ELSIF v_credit.status <> 'art_uploaded' THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    PERFORM public.product_1_1_deliver_campaign_credit_operation(
      p_campaign_id, p_operation_id, v_credit.publication_token);
  ELSE
    IF v_art_kind <> 'absent' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    IF NOT v_execution_ended AND NOT v_authorized_abandon THEN RAISE EXCEPTION 'execution_not_ended'; END IF;
    IF v_credit.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;
    PERFORM public.product_1_1_refund_campaign_credit_operation(
      p_campaign_id, p_operation_id, btrim(p_reason));
    UPDATE public.product_1_1_campaign_credit_operations
       SET publication_token = NULL, state_epoch = state_epoch + 1, updated_at = now()
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;
  END IF;

  IF v_in_progress THEN
    UPDATE public.product_1_1_generation_attempt_claims
       SET status = 'abandoned', updated_at = now()
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND status = 'in_progress';
  END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false,
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
    'action', p_action, 'status', v_credit.status, 'art_kind', v_art_kind, 'reason', btrim(p_reason));

  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, operation_id, metadata)
    VALUES (p_actor_id, 'product_1_1_pending_resolution', 'campaign', p_campaign_id,
      btrim(p_reason), p_resolution_operation_id, v_result);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'operation_identity_conflict';
  END;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 9. Privilégios RPC-only
-- =============================================================================
REVOKE ALL ON FUNCTION public.product_1_1_begin_publication(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_begin_publication(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.product_1_1_abort_publication(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_abort_publication(UUID, UUID, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.product_1_1_mark_result_unknown(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_mark_result_unknown(UUID, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.product_1_1_confirm_existing_art(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_confirm_existing_art(UUID, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.product_1_1_mark_campaign_credit_art_uploaded(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_mark_campaign_credit_art_uploaded(UUID, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.product_1_1_deliver_campaign_credit_operation(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_deliver_campaign_credit_operation(UUID, UUID, UUID) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- Reexecutar as definições ORIGINAIS de mark/deliver (20261008000002), de
-- close_failed_operation (20261015000001) e de admin_resolve_product_1_1_pending
-- (20261015000002). DROP das RPCs do fence:
-- DROP FUNCTION IF EXISTS public.product_1_1_begin_publication(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.product_1_1_abort_publication(UUID, UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.product_1_1_mark_result_unknown(UUID, UUID, UUID);
-- DROP FUNCTION IF EXISTS public.product_1_1_confirm_existing_art(UUID, UUID, TEXT);
-- ALTER TABLE public.product_1_1_campaign_credit_operations
--   DROP CONSTRAINT IF EXISTS chk_p1_1_credit_publication_state,
--   DROP COLUMN IF EXISTS publication_state,
--   DROP COLUMN IF EXISTS publication_token,
--   DROP COLUMN IF EXISTS state_epoch;
