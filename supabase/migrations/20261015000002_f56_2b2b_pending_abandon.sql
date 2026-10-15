-- F56.2b2b — Encerramento AUTORIZADO e auditado: abandono do claim `in_progress`
-- residual do Produto 1:1 (Plano 04, B2B-D4 / REQ-56.2.4-05, REQ-56.2.4-08).
--
-- LOCAL-ONLY: esta migration é apenas AUTORADA aqui. NÃO executar `supabase db
-- push` (nem qualquer mutação remota / reset / `migration up` remoto). Aplicar
-- exclusivamente na instância isolada e descartável (`vendeo-f562a-isolated`)
-- via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e SOMENTE no Plano 06. Autorar aqui ≠ aplicar.
--
-- Escopo: `CREATE OR REPLACE` de `public.admin_resolve_product_1_1_pending`
-- (mesma assinatura) de forma ADITIVA/CONDICIONAL. Hoje a RPC RECUSA
-- `operation_in_progress` SEMPRE; B2.2 permite — SOMENTE quando a evidência
-- autorizada contiver a MARCA EXPLÍCITA `authorized_abandon = 'true'` (produzida
-- por `resolve-pending-operation.ts` no caminho autorizado/auditado) — finalizar
-- o claim `in_progress` residual como `abandoned` NA MESMA transação sob a trava
-- C4, preservando o UPDATE de finalização. AMBOS os bloqueios ficam condicionados
-- à marca: `operation_in_progress` (~240) E `execution_not_ended` (~257).
--
-- `p_evidence->>'authorized_abandon'` é o ÚNICO gatilho do abandono;
-- `p_evidence->>'execution_ended'` permanece apenas FORMA-validado e NUNCA é
-- confiado para a decisão de claim ativo — o valor autoritativo continua DERIVADO
-- sob a trava (`v_execution_ended := NOT v_in_progress`). `invalid`/`indeterminate`
-- CONTINUAM bloqueando. NÃO se exige comprovação de encerramento EXTERNO do
-- provider. Preserva: trava advisory namespaced, consulta action-independente por
-- `operation_id` (único global), action `product_1_1_pending_resolution`,
-- append-only/idempotência e grants RPC-only.
--
-- C4 — TRAVA comum por operação: a MESMA linha
-- (`SELECT ... FOR UPDATE` em `product_1_1_campaign_credit_operations`) que a
-- aquisição de tentativa trava, ANTES de qualquer verificação/transição.
--
-- F2 — PROTEÇÃO GLOBAL da identidade de resolução: `resolution_operation_id` é
-- ÚNICO em TODO o `admin_audit_log` (índice único parcial sobre `operation_id`),
-- protegido por trava advisory namespaced ANTES da trava C4. Reuso equivalente ⇒
-- idempotente; qualquer outro conteúdo/ação ⇒ `operation_identity_conflict`, SEM
-- efeito financeiro parcial.

-- =============================================================================
-- 1. RPC auditada de resolução de pendência (evidência server-side, C4, E1)
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

  -- F5 — evidência TIPADA derivada SERVER-SIDE (nunca booleanos do cliente):
  -- recusa qualquer objeto sem forma válida ou sem marca de verificação.
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
  -- F1 — `execution_ended` vindo da evidência tem apenas a FORMA validada; o
  -- valor NUNCA é confiado para a decisão de claim ativo. O valor AUTORITATIVO é
  -- DERIVADO sob a trava (`v_execution_ended := NOT v_in_progress`).
  IF jsonb_typeof(p_evidence->'execution_ended') <> 'boolean' THEN
    RAISE EXCEPTION 'invalid_evidence';
  END IF;
  -- B2.2 — a MARCA EXPLÍCITA de abandono autorizado é o ÚNICO gatilho do
  -- abandono do residual `in_progress`. Ausente ⇒ comportamento de hoje (bloqueio).
  v_authorized_abandon := COALESCE((p_evidence->>'authorized_abandon') = 'true', false);

  -- F5/C2 — INDETERMINADO/INVÁLIDO BLOQUEIA qualquer ação (sem refund/deliver):
  -- ausência e erro NUNCA colapsam; a RPC nunca infere arte de falha de leitura.
  IF v_art_kind IN ('invalid','indeterminate') THEN
    RAISE EXCEPTION 'insufficient_evidence';
  END IF;

  -- F2 — PROTEÇÃO GLOBAL da identidade de resolução ANTES de qualquer efeito
  -- financeiro (trava ADVISORY de transação namespaced e determinística).
  PERFORM pg_advisory_xact_lock(hashtext('p1_1_pending_resolution:' || p_resolution_operation_id::text));

  -- C4 — TRAVA comum por operação, ANTES de qualquer verificação.
  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  -- F5/F2(c) — idempotência/conflito por `resolution_operation_id` AVALIADA SOB
  -- AS TRAVAS. Replay EQUIVALENTE ⇒ reuso idempotente; divergente ⇒ CONFLITO.
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

  -- F5 — REVALIDAÇÃO do estado da operação imediatamente antes da transição.
  IF v_credit.status = 'delivered' AND p_action = 'deliver_existing_art' THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'campaign_id', v_credit.campaign_id,
      'operation_id', v_credit.operation_id, 'action', p_action, 'status', 'delivered',
      'art_kind', v_art_kind);
  END IF;
  IF v_credit.status = 'refunded' AND p_action = 'refund_once' THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'campaign_id', v_credit.campaign_id,
      'operation_id', v_credit.operation_id, 'action', p_action, 'status', 'refunded',
      'art_kind', v_art_kind);
  END IF;
  IF v_credit.status IN ('delivered','refunded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal');
  END IF;

  -- E1/F1 — guarda de execução ativa REVALIDADA SOB A TRAVA. O valor
  -- AUTORITATIVO é DERIVADO do estado TRAVADO (`v_execution_ended := NOT
  -- v_in_progress`). Um claim `in_progress` sob a trava ⇒ RECUSA fail-closed —
  -- EXCETO no caminho AUTORIZADO (marca `authorized_abandon`), que pode finalizar
  -- o residual `abandoned` na MESMA transação. A idade/timeout NÃO conta.
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_attempt_claims
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND status = 'in_progress'
  ) INTO v_in_progress;

  v_execution_ended := NOT v_in_progress;

  IF v_in_progress AND NOT v_authorized_abandon THEN
    RAISE EXCEPTION 'operation_in_progress';
  END IF;

  IF p_action = 'deliver_existing_art' THEN
    -- Arte íntegra (server-side) e estado que permita entrega.
    IF v_art_kind <> 'integral' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    IF v_credit.status = 'reserved' THEN
      PERFORM public.product_1_1_mark_campaign_credit_art_uploaded(p_campaign_id, p_operation_id);
    ELSIF v_credit.status <> 'art_uploaded' THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    PERFORM public.product_1_1_deliver_campaign_credit_operation(p_campaign_id, p_operation_id);
  ELSE
    -- `refund_once`: exige `absent` CONFIRMADO + execução encerrada. No caminho
    -- AUTORIZADO (marca), o encerramento da execução não é exigido — o residual é
    -- abandonado sob a trava na mesma transação.
    IF v_art_kind <> 'absent' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    IF NOT v_execution_ended AND NOT v_authorized_abandon THEN
      RAISE EXCEPTION 'execution_not_ended';
    END IF;
    IF v_credit.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;
    PERFORM public.product_1_1_refund_campaign_credit_operation(
      p_campaign_id, p_operation_id, btrim(p_reason));
  END IF;

  -- E1 — finaliza o claim `in_progress` RESIDUAL como TERMINAL dedicado
  -- `abandoned` NA MESMA transação (sem `COMMIT` intermediário). No escopo b1b
  -- este bloco só era alcançável quando NÃO havia `in_progress`; a B2.2 o torna
  -- REACHABLE SOMENTE no caminho autorizado (marca `authorized_abandon`).
  IF v_in_progress THEN
    UPDATE public.product_1_1_generation_attempt_claims
       SET status = 'abandoned', updated_at = now()
     WHERE campaign_id = p_campaign_id
       AND operation_id = p_operation_id
       AND status = 'in_progress';
  END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false,
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
    'action', p_action, 'status', v_credit.status, 'art_kind', v_art_kind,
    'reason', btrim(p_reason)
  );

  -- Auditoria na MESMA transação (evidências + transição atômicas). DEFESA EM
  -- PROFUNDIDADE (F2): conflito de identidade detectado ANTES; se o índice único
  -- parcial ainda disparar, o CONFLITO é devolvido e a transação é ABORTADA
  -- (nenhum efeito financeiro parcial permanece).
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

REVOKE ALL ON FUNCTION public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- Reexecutar a definição ORIGINAL de `admin_resolve_product_1_1_pending`
-- (migration 20261009000002) para DESFAZER o abandono autorizado (bloqueio
-- `operation_in_progress` sempre). A definição original está preservada na 000002.
-- -- REVOKE ALL ON FUNCTION public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB) FROM service_role;
-- -- (reexecutar 20261009000002)
