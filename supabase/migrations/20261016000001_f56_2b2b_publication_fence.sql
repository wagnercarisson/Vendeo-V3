-- F56.2b2b — B2.2 (Recorte 1 / Plano 08): FENCE de publicação (CR-01/SEC-01).
--
-- LOCAL-ONLY: apenas AUTORADA. NÃO `db push`/remoto/reset. Aplicar SOMENTE na
-- instância isolada via `migration up --local`, e SOMENTE após o checkpoint da
-- Task 6b (revisão). FORWARD-ONLY: NÃO edita as migrations 20261015*.
--
-- Campos: `publication_state` (CHECK ∈ none,in_flight,published,failed_before_upload,
-- result_unknown — SEPARADO do `status` do crédito), `publication_token` (dono) e
-- `state_epoch` (frescor). O token PERMANECE até o fim (published/delivered) e é
-- limpo em abort/recuperação.

-- =============================================================================
-- 1. Campos + backfill + CHECK (separado do status)
-- =============================================================================
ALTER TABLE public.product_1_1_campaign_credit_operations
  ADD COLUMN IF NOT EXISTS publication_state TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS publication_token UUID,
  ADD COLUMN IF NOT EXISTS state_epoch INTEGER NOT NULL DEFAULT 0;

UPDATE public.product_1_1_campaign_credit_operations
   SET publication_state = CASE WHEN status IN ('art_uploaded','delivered') THEN 'published' ELSE 'none' END,
       publication_token = NULL,
       state_epoch = 0
 WHERE publication_state = 'none';

ALTER TABLE public.product_1_1_campaign_credit_operations
  DROP CONSTRAINT IF EXISTS chk_p1_1_credit_publication_state;
ALTER TABLE public.product_1_1_campaign_credit_operations
  ADD CONSTRAINT chk_p1_1_credit_publication_state
  CHECK (publication_state IN ('none','in_flight','published','failed_before_upload','result_unknown'));

-- =============================================================================
-- 2. FECHAR os caminhos ANTIGOS (2 args) — sem eles não há bypass do fence
-- =============================================================================
DROP FUNCTION IF EXISTS public.product_1_1_mark_campaign_credit_art_uploaded(UUID, UUID);
DROP FUNCTION IF EXISTS public.product_1_1_deliver_campaign_credit_operation(UUID, UUID);
DROP FUNCTION IF EXISTS public.product_1_1_close_failed_operation(UUID, UUID, TEXT, TEXT);

-- =============================================================================
-- 3. begin_publication (dono; ANTES do upload) / abort (só before_upload)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_begin_publication(
  p_campaign_id UUID, p_operation_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.product_1_1_campaign_credit_operations%ROWTYPE; v_token UUID;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  SELECT * INTO v_row FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  IF v_row.status IN ('delivered','refunded') THEN RAISE EXCEPTION 'operation_terminal'; END IF;
  IF v_row.publication_state IN ('in_flight','result_unknown','published') THEN
    RETURN jsonb_build_object('success', true, 'acquired', false, 'publication_state', v_row.publication_state,
      'state_epoch', v_row.state_epoch, 'status', v_row.status);
  END IF;
  v_token := gen_random_uuid();
  UPDATE public.product_1_1_campaign_credit_operations
     SET publication_state = 'in_flight', publication_token = v_token,
         state_epoch = state_epoch + 1, updated_at = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'acquired', true, 'token', v_token,
    'publication_state', 'in_flight', 'state_epoch', v_row.state_epoch + 1, 'status', v_row.status);
END; $$;

CREATE OR REPLACE FUNCTION public.product_1_1_abort_publication(
  p_campaign_id UUID, p_operation_id UUID, p_publication_token UUID, p_phase TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  SELECT * INTO v_row FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  -- REPLAY idempotente: já abortada (falha comprovada antes do envio).
  IF v_row.publication_state = 'failed_before_upload' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'publication_state', 'failed_before_upload');
  END IF;
  IF v_row.publication_state <> 'in_flight' OR v_row.publication_token IS DISTINCT FROM p_publication_token THEN
    RETURN jsonb_build_object('success', false, 'reason', 'stale_publication');
  END IF;
  IF p_phase IS DISTINCT FROM 'before_upload' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'abort_not_allowed');
  END IF;
  UPDATE public.product_1_1_campaign_credit_operations
     SET publication_state = 'failed_before_upload', publication_token = NULL,
         state_epoch = state_epoch + 1, updated_at = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'publication_state', 'failed_before_upload',
    'state_epoch', v_row.state_epoch + 1);
END; $$;

CREATE OR REPLACE FUNCTION public.product_1_1_mark_result_unknown(
  p_campaign_id UUID, p_operation_id UUID, p_publication_token UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  SELECT * INTO v_row FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  IF v_row.publication_state = 'result_unknown' AND v_row.publication_token IS NOT DISTINCT FROM p_publication_token THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'publication_state', 'result_unknown');
  END IF;
  IF v_row.publication_state <> 'in_flight' OR v_row.publication_token IS DISTINCT FROM p_publication_token THEN
    RETURN jsonb_build_object('success', false, 'reason', 'stale_publication');
  END IF;
  UPDATE public.product_1_1_campaign_credit_operations
     SET publication_state = 'result_unknown', state_epoch = state_epoch + 1, updated_at = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'publication_state', 'result_unknown',
    'state_epoch', v_row.state_epoch + 1);
END; $$;

-- =============================================================================
-- 4. confirm_existing_art (recuperação; SEM token; SEM novo upload)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_confirm_existing_art(
  p_campaign_id UUID, p_operation_id UUID, p_art_kind TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.product_1_1_campaign_credit_operations%ROWTYPE; v_epoch INTEGER;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_art_kind IS DISTINCT FROM 'integral' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
  SELECT * INTO v_row FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
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
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id, 'publication_state', 'published', 'state_epoch', v_epoch);
END; $$;

-- =============================================================================
-- 5. mark/deliver — TOKEN NÃO NULO e do DONO; replay VALIDA o token; token persiste
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_mark_campaign_credit_art_uploaded(
  p_campaign_id UUID, p_operation_id UUID, p_publication_token UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  SELECT * INTO v_row FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  -- TOKEN OBRIGATÓRIO e do DONO (histórico sem token ⇒ use a recuperação específica).
  IF p_publication_token IS NULL OR v_row.publication_token IS NULL
     OR v_row.publication_token IS DISTINCT FROM p_publication_token THEN
    RAISE EXCEPTION 'publication_not_owner';
  END IF;
  IF v_row.status = 'art_uploaded' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'art_uploaded',
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
      'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
  END IF;
  IF v_row.status <> 'reserved' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'art_uploaded', publication_state = 'published', state_epoch = state_epoch + 1, updated_at = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'art_uploaded',
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
    'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
END; $$;

CREATE OR REPLACE FUNCTION public.product_1_1_deliver_campaign_credit_operation(
  p_campaign_id UUID, p_operation_id UUID, p_publication_token UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  SELECT * INTO v_row FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  -- Valida o token ANTES de qualquer sucesso (inclusive no replay idempotente).
  IF p_publication_token IS NULL OR v_row.publication_token IS NULL
     OR v_row.publication_token IS DISTINCT FROM p_publication_token THEN
    RAISE EXCEPTION 'publication_not_owner';
  END IF;
  IF v_row.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'delivered',
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
      'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
  END IF;
  IF v_row.status <> 'art_uploaded' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'delivered', publication_state = 'published', state_epoch = state_epoch + 1, updated_at = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'delivered',
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
    'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
END; $$;

-- =============================================================================
-- 6. refund — RECRIADA com guarda de fence (fecha o bypass do estorno)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_refund_campaign_credit_operation(
  p_campaign_id UUID, p_operation_id UUID, p_reason TEXT DEFAULT 'refund'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.product_1_1_campaign_credit_operations%ROWTYPE; v_refund_id UUID;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  SELECT * INTO v_row FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  IF v_row.status = 'refunded' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'refunded',
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
      'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
  END IF;
  IF v_row.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;
  -- FENCE: publicação ATIVA **ou já publicada** (`published` = arte confirmada) NUNCA
  -- é estornada por caminho direto.
  IF v_row.publication_state IN ('in_flight','result_unknown','published') THEN RAISE EXCEPTION 'publication_in_progress'; END IF;
  IF v_row.status NOT IN ('reserved','art_uploaded') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  IF v_row.credit_tx_id IS NULL THEN RAISE EXCEPTION 'credit_reservation_missing_tx'; END IF;
  v_refund_id := public.refund_credit(v_row.credit_tx_id,
    COALESCE(NULLIF(btrim(p_reason), ''), 'refund'),
    'p1_1_refund_' || p_campaign_id::text || '_' || p_operation_id::text, '{}'::jsonb);
  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'refunded', refund_tx_id = v_refund_id, state_epoch = state_epoch + 1, updated_at = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'refunded',
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
    'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_refund_id);
END; $$;

-- =============================================================================
-- 7. close_failed_operation — predicado PF COMPLETO (fence + FRESCOR do epoch)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_close_failed_operation(
  p_campaign_id UUID, p_operation_id UUID, p_art_kind TEXT, p_observed_epoch INTEGER, p_reason TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_credit public.product_1_1_campaign_credit_operations%ROWTYPE; v_in_progress BOOLEAN; v_failed BOOLEAN;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  SELECT * INTO v_credit FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  IF v_credit.status = 'refunded' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'refunded',
      'campaign_id', v_credit.campaign_id, 'operation_id', v_credit.operation_id, 'action', 'close_failed_operation');
  END IF;
  IF v_credit.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;
  -- FENCE: automático bloqueado em QUALQUER publicação ativa OU já publicada (arte vence).
  IF v_credit.publication_state IN ('in_flight','result_unknown','published') THEN
    RAISE EXCEPTION 'publication_in_progress';
  END IF;
  -- FRESCOR: o epoch observado ANTES da sonda tem de bater sob a trava.
  IF p_observed_epoch IS DISTINCT FROM v_credit.state_epoch THEN RAISE EXCEPTION 'evidence_stale'; END IF;
  IF v_credit.status NOT IN ('reserved','art_uploaded') THEN RAISE EXCEPTION 'operation_terminal'; END IF;
  IF p_art_kind IS DISTINCT FROM 'absent' THEN RAISE EXCEPTION 'absent_not_confirmed'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.product_1_1_generation_attempt_claims
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND status = 'in_progress') INTO v_in_progress;
  IF v_in_progress THEN RAISE EXCEPTION 'operation_in_progress'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.product_1_1_generation_outcomes
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND outcome = 'failed') INTO v_failed;
  IF NOT v_failed THEN RAISE EXCEPTION 'finality_not_recorded'; END IF;
  PERFORM public.product_1_1_refund_campaign_credit_operation(p_campaign_id, p_operation_id, btrim(p_reason));
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'refunded',
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id, 'action', 'close_failed_operation');
END; $$;

-- =============================================================================
-- 8. Leitura do epoch (frescor capturado ANTES da sonda pelo orquestrador)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_get_publication_epoch(
  p_campaign_id UUID, p_operation_id UUID
)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT state_epoch FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;
$$;

-- =============================================================================
-- 9. admin_resolve — exceção RESTRITA ao inconclusivo autorizado/auditado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_product_1_1_pending(
  p_actor_id UUID, p_campaign_id UUID, p_operation_id UUID, p_action TEXT,
  p_reason TEXT, p_resolution_operation_id UUID, p_evidence JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_credit public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_existing JSONB; v_existing_action TEXT; v_existing_actor UUID; v_existing_reason TEXT;
  v_art_kind TEXT; v_execution_ended BOOLEAN; v_in_progress BOOLEAN;
  v_authorized_abandon BOOLEAN := false; v_authorized_closure BOOLEAN := false; v_result JSONB; v_refund_id UUID;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_resolution_operation_id IS NULL THEN RAISE EXCEPTION 'missing_resolution_operation_id'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('deliver_existing_art','refund_once') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
  IF (p_evidence->>'origin') IS DISTINCT FROM 'server-derived' THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
  v_art_kind := p_evidence->>'art_kind';
  IF v_art_kind IS NULL OR v_art_kind NOT IN ('integral','absent','invalid','indeterminate') THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
  IF jsonb_typeof(p_evidence->'execution_ended') <> 'boolean' THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
  v_authorized_abandon := COALESCE((p_evidence->>'authorized_abandon') = 'true', false);
  v_authorized_closure := COALESCE((p_evidence->>'authorized_publication_closure') = 'true', false);
  IF v_art_kind IN ('invalid','indeterminate') THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('p1_1_pending_resolution:' || p_resolution_operation_id::text));
  SELECT * INTO v_credit FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  SELECT metadata, action, actor_id, btrim(reason) INTO v_existing, v_existing_action, v_existing_actor, v_existing_reason
    FROM public.admin_audit_log WHERE operation_id = p_resolution_operation_id;
  IF FOUND THEN
    IF v_existing_action = 'product_1_1_pending_resolution'
       AND (v_existing->>'campaign_id') = p_campaign_id::text AND (v_existing->>'operation_id') = p_operation_id::text
       AND (v_existing->>'action') = p_action AND (v_existing->>'art_kind') = v_art_kind
       AND v_existing_actor = p_actor_id AND v_existing_reason = btrim(p_reason) THEN
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
  IF v_credit.status IN ('delivered','refunded') THEN RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal'); END IF;

  SELECT EXISTS (SELECT 1 FROM public.product_1_1_generation_attempt_claims
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND status = 'in_progress') INTO v_in_progress;
  v_execution_ended := NOT v_in_progress;
  IF v_in_progress AND NOT v_authorized_abandon THEN RAISE EXCEPTION 'operation_in_progress'; END IF;

  -- FENCE RESTRITO (refund_once): `published` NUNCA estorna (arte confirmada vence).
  IF p_action = 'refund_once' THEN
    IF v_credit.publication_state = 'published' THEN RAISE EXCEPTION 'publication_active_art'; END IF;
    IF v_credit.publication_state IN ('in_flight','result_unknown') THEN
      -- Exceção SOMENTE para o inconclusivo autorizado/auditado (marca própria).
      IF NOT v_authorized_closure THEN RAISE EXCEPTION 'publication_in_progress'; END IF;
    ELSE
      -- Estado sem publicação ativa: exige FRESCOR (ausência não pode ser obsoleta).
      IF (p_evidence->>'state_epoch') IS DISTINCT FROM v_credit.state_epoch::text THEN RAISE EXCEPTION 'evidence_stale'; END IF;
    END IF;
  END IF;

  IF p_action = 'deliver_existing_art' THEN
    IF v_art_kind <> 'integral' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    -- Recuperação de arte EXISTENTE (SEM token): funciona também em operações
    -- HISTÓRICAS (token nulo). Mantém autorização (admin) e auditoria.
    PERFORM public.product_1_1_confirm_existing_art(p_campaign_id, p_operation_id, 'integral');
  ELSE
    IF v_art_kind <> 'absent' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    IF NOT v_execution_ended AND NOT v_authorized_abandon THEN RAISE EXCEPTION 'execution_not_ended'; END IF;
    IF v_credit.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;
    -- EXCEÇÃO AUTORIZADA (inconclusivo `in_flight`/`result_unknown`): estorno
    -- INLINE na MESMA transação — a RPC direta recusaria a publicação ativa, mas
    -- o caminho autorizado/auditado PRECISA concluir. Ainda sob a trava C4.
    IF v_credit.publication_state IN ('in_flight','result_unknown') THEN
      IF v_credit.credit_tx_id IS NULL THEN RAISE EXCEPTION 'credit_reservation_missing_tx'; END IF;
      v_refund_id := public.refund_credit(v_credit.credit_tx_id, btrim(p_reason),
        'p1_1_refund_' || p_campaign_id::text || '_' || p_operation_id::text, '{}'::jsonb);
      UPDATE public.product_1_1_campaign_credit_operations
         SET status = 'refunded', refund_tx_id = v_refund_id, state_epoch = state_epoch + 1, updated_at = now()
       WHERE id = v_credit.id;
    ELSE
      PERFORM public.product_1_1_refund_campaign_credit_operation(p_campaign_id, p_operation_id, btrim(p_reason));
    END IF;
  END IF;

  IF v_in_progress THEN
    UPDATE public.product_1_1_generation_attempt_claims SET status = 'abandoned', updated_at = now()
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id AND status = 'in_progress';
  END IF;

  SELECT * INTO v_credit FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;
  v_result := jsonb_build_object('success', true, 'idempotent', false, 'campaign_id', p_campaign_id,
    'operation_id', p_operation_id, 'action', p_action, 'status', v_credit.status, 'art_kind', v_art_kind, 'reason', btrim(p_reason));
  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, operation_id, metadata)
    VALUES (p_actor_id, 'product_1_1_pending_resolution', 'campaign', p_campaign_id, btrim(p_reason), p_resolution_operation_id, v_result);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'operation_identity_conflict';
  END;
  RETURN v_result;
END; $$;

-- =============================================================================
-- 10. Privilégios RPC-only
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
REVOKE ALL ON FUNCTION public.product_1_1_close_failed_operation(UUID, UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_close_failed_operation(UUID, UUID, TEXT, INTEGER, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.product_1_1_get_publication_epoch(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_get_publication_epoch(UUID, UUID) TO service_role;

-- =============================================================================
-- REVERT (manual; apenas na instância isolada)
-- =============================================================================
-- Reexecutar as definições ORIGINAIS (b1a mark/deliver/refund 2 args; close_failed
-- 000001; admin_resolve 00015000002). DROP das novas:
-- DROP FUNCTION IF EXISTS public.product_1_1_begin_publication(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.product_1_1_abort_publication(UUID, UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.product_1_1_mark_result_unknown(UUID, UUID, UUID);
-- DROP FUNCTION IF EXISTS public.product_1_1_confirm_existing_art(UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.product_1_1_get_publication_epoch(UUID, UUID);
-- ALTER TABLE public.product_1_1_campaign_credit_operations
--   DROP CONSTRAINT IF EXISTS chk_p1_1_credit_publication_state,
--   DROP COLUMN IF EXISTS publication_state, DROP COLUMN IF EXISTS publication_token, DROP COLUMN IF EXISTS state_epoch;
