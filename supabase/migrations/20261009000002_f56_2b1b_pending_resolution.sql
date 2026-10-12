-- F56.2b1b — Resolução administrativa auditada de pendências do Produto 1:1
-- (Plano 07, B1B-D5 / REQ-56.2.2-08).
--
-- LOCAL-ONLY: esta migration é apenas AUTORADA aqui. NÃO executar `supabase db
-- push` (nem qualquer mutação remota / reset / `migration up` remoto). Aplicar
-- exclusivamente na instância isolada e descartável (`vendeo-f562a-isolated`)
-- via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e SOMENTE no Plano 09 (O2).
--
-- Escopo:
--   1. Estende o CHECK de `admin_audit_log.action` com a ação auditada
--      `product_1_1_pending_resolution` (preservando TODOS os valores anteriores).
--   2. RPC `public.admin_resolve_product_1_1_pending` (SECURITY DEFINER,
--      `search_path=''`): resolve uma pendência por EVIDÊNCIA — entregar a arte
--      existente OU estornar uma vez — com motivo obrigatório e auditoria na
--      MESMA transação. NUNCA re-enfileira, gera novamente ou chama o provider.
--
-- F5 — evidência derivada SERVER-SIDE (Storage/DB), nunca booleanos do cliente:
--   `p_evidence` é um objeto TIPADO com marca de verificação (`origin =
--   'server-derived'`) e `art_kind` ∈ {`integral`,`absent`,`invalid`,
--   `indeterminate`}. `invalid` e `indeterminate` BLOQUEIAM qualquer ação;
--   `refund_once` exige `absent` CONFIRMADO. Erro de leitura NUNCA colapsa em
--   ausência.
--
-- C4 — TRAVA comum por operação: o RPC toma a MESMA linha
--   (`SELECT ... FOR UPDATE` em `product_1_1_campaign_credit_operations`) que a
--   aquisição de tentativa (Plano 03) trava, ANTES de qualquer verificação/
--   transição. Iniciar tentativa e resolver financeiramente serializam nesta
--   linha; contar claims isoladamente NÃO fecharia a corrida.
--
-- E1 — claim `in_progress` residual (fail-closed I2 do Plano 04) e evidência de
--   ENCERRAMENTO: enquanto houver claim `in_progress` e NÃO houver evidência
--   server-side de ENCERRAMENTO da execução, a resolução é RECUSADA
--   (`operation_in_progress`), fail-closed, SEM transição parcial. A idade/
--   timeout NÃO é evidência de encerramento. Quando e somente quando a evidência
--   estabelecer o encerramento, o RPC, NA MESMA transação sob a trava C4,
--   finaliza o claim residual com o status TERMINAL dedicado `abandoned` —
--   status JÁ DEFINIDO na migration do Plano 03 (`20261009000001`,
--   `CHECK ck_p1_1_attempt_claim_status`: `in_progress | done | failed |
--   abandoned`) e CONSUMIDO aqui (esta migration NÃO cria o status e, se
--   tocasse a CHECK, o ALTER seria idempotente/EQUIVALENTE — nunca um conjunto
--   divergente) — aplica entregar/estornar e grava a auditoria, num ÚNICO
--   `COMMIT` sem intervalo que permita nova tentativa. Como a operação transita
--   para TERMINAL (`delivered`/`refunded`) na MESMA transação, o `acquire`
--   (Plano 03) recusa `operation_terminal`: nenhuma nova tentativa é reaberta.
--
-- D13 — LIMITAÇÃO ACEITA (b1b inativa) + GATE OBRIGATÓRIO DA b2: NÃO existe, no
--   escopo aprovado, fonte operacional comprovada de encerramento. O caso NORMAL
--   (`unknown` PERSISTIDO com sucesso ⇒ claim finalizado como `abandoned`) NÃO
--   elimina o bloqueio de um claim `in_progress` RESIDUAL (a persistência do
--   `unknown` FALHOU): ele permanece BLOQUEADO — sem estorno, sem nova geração,
--   sem retomada — até haver evidência server-side de ENCERRAMENTO. Esta
--   limitação é um risco explicitamente aceito APENAS para a entrega INATIVA da
--   b1b: a b1b NÃO declara recuperabilidade completa; evidência simulada
--   (harness/fake) NÃO é prova operacional. O GATE obrigatório (bloqueante) da
--   b2 (estratégia operacional segura de resolução de claims residuais; plano/
--   limites pode sustentar, mas isoladamente NÃO satisfaz; Vercel Hobby /
--   Supabase Free informados, limites NÃO verificados) precede o piloto/
--   habilitação da b2.

-- =============================================================================
-- 1. Auditoria: estende o CHECK de `action` (preserva TODOS os valores anteriores)
-- =============================================================================
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
  'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
  'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
  'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update',
  'data_subject_request_received', 'data_subject_request_in_progress',
  'data_subject_request_completed', 'data_subject_request_cancelled',
  'data_subject_request_cancel_rejected',
  'image_model_pair_config_update',
  'product_1_1_pending_resolution'
));

-- =============================================================================
-- 2. RPC auditada de resolução de pendência (evidência server-side, C4, E1)
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
  v_credit          public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_existing        JSONB;
  v_art_kind        TEXT;
  v_execution_ended BOOLEAN;
  v_in_progress     BOOLEAN;
  v_result          JSONB;
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
  IF jsonb_typeof(p_evidence->'execution_ended') <> 'boolean' THEN
    RAISE EXCEPTION 'invalid_evidence';
  END IF;
  v_execution_ended := (p_evidence->>'execution_ended')::boolean;

  -- F5/C2 — INDETERMINADO/INVÁLIDO BLOQUEIA qualquer ação (sem refund/deliver):
  -- ausência e erro NUNCA colapsam; a RPC nunca infere arte de falha de leitura.
  IF v_art_kind IN ('invalid','indeterminate') THEN
    RAISE EXCEPTION 'insufficient_evidence';
  END IF;

  -- F5 — idempotência/conflito por `resolution_operation_id` (mesma ação):
  -- replay EQUIVALENTE ⇒ reuso idempotente (exatamente um efeito e uma
  -- auditoria); MESMO id com conteúdo DIVERGENTE ⇒ CONFLITO (nunca sucesso
  -- enganoso).
  SELECT metadata INTO v_existing
  FROM public.admin_audit_log
  WHERE operation_id = p_resolution_operation_id
    AND action = 'product_1_1_pending_resolution';
  IF FOUND THEN
    IF (v_existing->>'campaign_id') = p_campaign_id::text
       AND (v_existing->>'operation_id') = p_operation_id::text
       AND (v_existing->>'action') = p_action
       AND (v_existing->>'art_kind') = v_art_kind THEN
      RETURN COALESCE(v_existing, '{}'::jsonb) || jsonb_build_object('idempotent', true);
    END IF;
    RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
  END IF;

  -- C4 — TRAVA comum por operação: a MESMA linha de operação de crédito que a
  -- aquisição de tentativa (Plano 03) trava, ANTES de qualquer verificação.
  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  -- F5 — REVALIDAÇÃO do estado da operação imediatamente antes da transição.
  -- Terminal equivalente ⇒ idempotente; terminal divergente ⇒ recusa.
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

  -- E1 — guarda de execução ativa × evidência de ENCERRAMENTO: um claim
  -- `in_progress` recusa a resolução ENQUANTO não houver evidência server-side de
  -- ENCERRAMENTO. A idade/timeout NÃO conta como evidência (fail-closed).
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_attempt_claims
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND status = 'in_progress'
  ) INTO v_in_progress;

  IF v_in_progress AND NOT v_execution_ended THEN
    RAISE EXCEPTION 'operation_in_progress';
  END IF;

  IF p_action = 'deliver_existing_art' THEN
    -- Arte íntegra (server-side) e estado que permita entrega.
    IF v_art_kind <> 'integral' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    IF v_credit.status = 'reserved' THEN
      -- Arte existente com operação ainda `reserved` ⇒ registra `art_uploaded` E
      -- entrega na MESMA transação (sem nova geração).
      PERFORM public.product_1_1_mark_campaign_credit_art_uploaded(p_campaign_id, p_operation_id);
    ELSIF v_credit.status <> 'art_uploaded' THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    PERFORM public.product_1_1_deliver_campaign_credit_operation(p_campaign_id, p_operation_id);
  ELSE
    -- `refund_once`: exige `absent` CONFIRMADO + execução encerrada.
    IF v_art_kind <> 'absent' THEN RAISE EXCEPTION 'insufficient_evidence'; END IF;
    IF NOT v_execution_ended THEN RAISE EXCEPTION 'execution_not_ended'; END IF;
    IF v_credit.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;
    PERFORM public.product_1_1_refund_campaign_credit_operation(
      p_campaign_id, p_operation_id, btrim(p_reason));
  END IF;

  -- E1 — finaliza o claim `in_progress` RESIDUAL como TERMINAL dedicado
  -- `abandoned` NA MESMA transação (sem `COMMIT` intermediário; sem intervalo
  -- que permita nova tentativa). O status terminal da operação (`delivered`/
  -- `refunded`) faz o `acquire` (Plano 03) recusar `operation_terminal`.
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

  -- Auditoria na MESMA transação (evidências + transição atômicas).
  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'product_1_1_pending_resolution', 'campaign', p_campaign_id,
    btrim(p_reason), p_resolution_operation_id, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- REVOKE ALL ON FUNCTION public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_resolve_product_1_1_pending(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB);
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
--   'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
--   'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
--   'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
--   'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update',
--   'data_subject_request_received', 'data_subject_request_in_progress',
--   'data_subject_request_completed', 'data_subject_request_cancelled',
--   'data_subject_request_cancel_rejected',
--   'image_model_pair_config_update'
-- ));
