-- F56.2b2a — Aquisição ATÔMICA da tentativa de copy do Produto 1:1 (B2.1 /
-- Plano 06, REQ-56.2.3-06/-04/-03/-07).
-- Esta migration é LOCAL-ONLY e é apenas AUTORADA aqui. NÃO executar
-- `supabase db push` (nem qualquer mutação remota / reset / migration up remoto).
-- Aplicar exclusivamente na instância isolada e descartável via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e somente na janela de migração autorizada (Plano 05). Aplicá-la em qualquer
-- outro lugar está fora de escopo. Autorar aqui ≠ aplicar.
--
-- B2A-D4 (aquisição atômica por RPC): o BANCO decide, ANTES de qualquer chamada
-- ao provider (inclusive fallback), SOB A TRAVA ESTÁVEL COMPARTILHADA com as
-- transições (`product_1_1_apply_copy_state`/`product_1_1_cancel_copy`):
--
--   * tentativa ATIVA (corrente `pending` com lease VIGENTE) ⇒ `attempt_in_progress`
--     (NUNCA supersede tentativa ativa; o requerente apenas ACOMPANHA);
--   * próxima `attempt_seq` = `COALESCE(MAX(attempt_seq),0)+1` (teto 6);
--   * LIMITES SEPARADOS por `copy_payload.recovery.kind` (3 automáticas + 3
--     manuais = teto 6) — a tentativa HISTÓRICA da b1b (backfill do Plano 06,
--     `kind='auto'`) já entra no contador automático;
--   * entrega já `completed` em QUALQUER tentativa ⇒ `attempt_already_completed`
--     (ÚNICO terminal que encerra a recuperação — B2A-D1);
--   * dedupe do MESMO acionamento (`p_request_token` não-nulo já conhecido) ⇒
--     `already_acquired`, SEM nova tentativa e SEM consumir slot;
--   * TENTATIVA EXPIRADA (corrente `pending` com lease VENCIDO — TTL 45s) é
--     ENCERRADA ATOMICAMENTE (`failed` + `copy_payload.recovery.staleAttempt =
--     true`, NUNCA no nível raiz) e a PRÓXIMA é adquirida na MESMA transação
--     (`expired_closed: true`); a conclusão ATRASADA da expirada é rejeitada
--     pelo `apply` como `stale_attempt` (a linha é terminal `failed`);
--   * TRANSIÇÃO de `mode` validada server-side (`auto` após falha DEFINITIVA ou
--     após início MANUAL ⇒ `automatic_closed`; `mode` no corpo NÃO reabre);
--   * ESPERA verificada server-side (`updated_at` + `recovery.nextWaitMs`) ⇒
--     `wait_not_elapsed` com a espera restante.
--
-- TERMINAIS SEPARADOS (financeiro × copy): o terminal FINANCEIRO (`delivered`/
-- `refunded`) NÃO encerra nem bloqueia a recuperação de TEXTOS; esta RPC NUNCA
-- devolve `operation_terminal`. A imagem `delivered` permanece baixável.
--
-- O VENCEDOR gera o `attempt_token` SERVER-SIDE (`gen_random_uuid()`) e insere a
-- tentativa `pending` já com POSSE (`lease_at = now()`). O cliente NUNCA dita a
-- identidade do vencedor.
--
-- A TRAVA ESTÁVEL COMPARTILHADA segue a ORDEM FIXA e IDÊNTICA em
-- aquisição/apply/cancel (correção da revisão 2026-10-14):
--   (1) advisory por operação (`pg_advisory_xact_lock`) SEMPRE e PRIMEIRO
--       (transacional: vale até o COMMIT; serializa COM ou SEM linha de crédito);
--   (2) linha C4 de crédito `product_1_1_campaign_credit_operations` (`FOR UPDATE`,
--       QUANDO existe — a ausência é legítima);
--   (3) linhas de `product_1_1_copy_state` (`FOR UPDATE`).
-- A ORDEM IDÊNTICA proíbe deadlock e serializa a conclusão ATRASADA de uma
-- tentativa (`apply` antigo) × a expiração de lease/criação da próxima
-- (`acquire`) sob a MESMA trava.
--
-- RPC-ONLY (A2): a função é `SECURITY DEFINER` + `SET search_path = ''`;
-- EXECUTE apenas para `service_role` (o gate real de acesso é o REVOKE/GRANT).
--
-- Fronteira de reuso: NÃO altera `campaigns`, a linha de crédito de imagem, a
-- arte nem qualquer tabela/coluna legada; apenas REFERENCIA a linha de crédito
-- como trava compartilhada (a MESMA do apply/cancel). Fora de escopo deste
-- arquivo: a transição por tentativa (`20261013000001`, Plano 01) e o backfill
-- (`20261013000003`, Plano 06).

-- =============================================================================
-- 1. RPC de aquisição atômica da tentativa de copy (trava compartilhada + F1)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_acquire_copy_attempt(
  p_campaign_id   UUID,
  p_operation_id  UUID,
  p_mode          TEXT,
  p_request_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current        public.product_1_1_copy_state%ROWTYPE;
  v_current_seq    INTEGER;
  v_auto_count     INTEGER;
  v_manual_count   INTEGER;
  v_next_seq       INTEGER;
  v_token          UUID;
  v_inserted_id    UUID;
  v_expired_closed BOOLEAN := false;
  v_definitive     BOOLEAN;
  v_manual_started BOOLEAN;
  v_completed      BOOLEAN;
  v_dedupe         public.product_1_1_copy_state%ROWTYPE;
  v_wait_ms        INTEGER;
  v_wait_until     TIMESTAMPTZ;
BEGIN
  -- (1) VALIDAÇÕES DE ENTRADA. `p_request_token` é NULLABLE: é apenas CONDIÇÃO
  --     de dedupe/identidade do acionamento — o cliente NUNCA escolhe o vencedor.
  IF p_campaign_id  IS NULL THEN RAISE EXCEPTION 'missing_campaign_id';  END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('auto','manual') THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;

  -- (2) TRAVA ESTÁVEL COMPARTILHADA POR OPERAÇÃO — ORDEM FIXA (idêntica a
  --     apply/cancel): (1) advisory SEMPRE primeiro; (2) linha C4 de crédito
  --     quando existe; (3) copy_state por último.
  --
  --     (1) advisory por operação — a MESMA chave do `apply`/`cancel` do Plano 01.
  --     Transacional: vive até o COMMIT desta transação; serializa COM ou SEM a
  --     linha de crédito (a ausência da linha é um caso legítimo).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_campaign_id::text || ':' || p_operation_id::text, 0));

  --     (2) Linha C4 de crédito QUANDO existe (a MESMA linha da aquisição da
  --     imagem e da resolução financeira). Sem linha: segue — a serialização já
  --     está garantida pela advisory do passo (1).
  PERFORM 1 FROM public.product_1_1_campaign_credit_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
    FOR UPDATE;

  --     (3) Linhas de `product_1_1_copy_state` desta operação (`FOR UPDATE`):
  --     serializa TODAS as tentativas concorrentes sob a MESMA trava.
  PERFORM 1 FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
    FOR UPDATE;

  -- (3) DEDUPE DO MESMO ACIONAMENTO (idempotência ao longo do tempo). Reenvio
  --     ATRASADO com o mesmo `request_token` NÃO adquire nova tentativa nem
  --     consome slot: devolve a identidade EXISTENTE.
  IF p_request_token IS NOT NULL THEN
    SELECT * INTO v_dedupe
      FROM public.product_1_1_copy_state
      WHERE campaign_id = p_campaign_id
        AND operation_id = p_operation_id
        AND request_token = p_request_token
      LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'acquired', false, 'reason', 'already_acquired',
        'attempt_seq', v_dedupe.attempt_seq, 'attempt_token', v_dedupe.attempt_token
      );
    END IF;
  END IF;

  -- (4) TERMINAL DA COPY (o ÚNICO que encerra). Um `completed` em QUALQUER
  --     tentativa é terminal para a entrega (B2A-D1): a imagem `delivered`/
  --     `refunded` (terminal FINANCEIRO) NÃO encerra nem bloqueia os textos.
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND state = 'completed'
  ) INTO v_completed;
  IF v_completed THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_already_completed');
  END IF;

  -- Leitura da tentativa CORRENTE = MAIOR `attempt_seq`.
  SELECT * INTO v_current
    FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
    ORDER BY attempt_seq DESC
    LIMIT 1;

  -- (5) TENTATIVA EXPIRADA — ENCERRAMENTO ATÔMICO. Uma corrente `pending` com
  --     lease VENCIDO (TTL 45s) é encerrada como terminal `failed` com o marcador
  --     `copy_payload.recovery.staleAttempt = true` (NUNCA no nível raiz) e a
  --     PRÓXIMA é adquirida na MESMA transação.
  IF FOUND AND v_current.state = 'pending'
     AND (v_current.lease_at IS NULL OR v_current.lease_at <= now() - interval '45 seconds') THEN
    -- `jsonb_set(..., '{recovery,staleAttempt}', ..., true)` PRESERVA o
    -- `recovery.*` existente (kind/failureClass/nextWaitMs gravados pelo Plano 02)
    -- — proibido merge `||` raso (substituiria o objeto `recovery` inteiro).
    UPDATE public.product_1_1_copy_state
       SET state        = 'failed',
           copy_payload = jsonb_set(
             COALESCE(copy_payload, '{}'::jsonb),
             '{recovery,staleAttempt}', 'true'::jsonb, true
           ),
           updated_at   = now()
     WHERE id = v_current.id;
    v_expired_closed := true;
    -- RE-LÊ a corrente (agora terminal) e segue para adquirir a PRÓXIMA.
    SELECT * INTO v_current
      FROM public.product_1_1_copy_state
      WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
      ORDER BY attempt_seq DESC
      LIMIT 1;
  END IF;

  -- (6) TENTATIVA ATIVA (SEM SUPERSEDE). Corrente `pending` com lease VIGENTE ⇒
  --     o requerente APENAS ACOMPANHA (`attempt_in_progress`). A próxima tentativa
  --     só é admitida com a corrente TERMINAL.
  IF FOUND AND v_current.state = 'pending' THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_in_progress');
  END IF;

  -- (7) TRANSIÇÃO DE `mode` VALIDADA SERVER-SIDE. Derivada do persistido:
  --     v_definitive = alguma tentativa com `recovery.failureClass = 'definitive'`;
  --     v_manual_started = alguma tentativa com `recovery.kind = 'manual'`.
  --     `auto` após definitiva/manual ⇒ `automatic_closed` (mode no corpo NÃO
  --     reabre o ciclo; apenas o acionamento `manual`, dentro do limite, permanece).
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND copy_payload->'recovery'->>'failureClass' = 'definitive'
  ) INTO v_definitive;
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND copy_payload->'recovery'->>'kind' = 'manual'
  ) INTO v_manual_started;
  IF p_mode = 'auto' AND (v_definitive OR v_manual_started) THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'automatic_closed');
  END IF;

  -- (8) ESPERA SERVER-SIDE. Corrente `failed` com `recovery.nextWaitMs` no futuro
  --     (updated_at + nextWaitMs > now) ⇒ RECUSA antes de a espera vencer.
  IF FOUND AND v_current.state = 'failed'
     AND v_current.copy_payload->'recovery'->>'nextWaitMs' IS NOT NULL THEN
    v_wait_ms := (v_current.copy_payload->'recovery'->>'nextWaitMs')::INTEGER;
    v_wait_until := v_current.updated_at + (v_wait_ms * interval '1 millisecond');
    IF v_wait_until > now() THEN
      RETURN jsonb_build_object(
        'acquired', false, 'reason', 'wait_not_elapsed',
        'wait_remaining_ms', CEIL(EXTRACT(EPOCH FROM (v_wait_until - now())) * 1000)::INTEGER
      );
    END IF;
  END IF;

  -- (9) CONTADORES SEPARADOS por `copy_payload.recovery.kind` — o automático
  --     INCLUI a tentativa histórica da b1b (`kind='auto'`), atribuída pelo
  --     backfill do Plano 06 Task 2.
  SELECT
    COUNT(*) FILTER (WHERE copy_payload->'recovery'->>'kind' = 'auto'),
    COUNT(*) FILTER (WHERE copy_payload->'recovery'->>'kind' = 'manual')
  INTO v_auto_count, v_manual_count
  FROM public.product_1_1_copy_state
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  IF p_mode = 'auto'  AND v_auto_count   >= 3 THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_limit_reached');
  END IF;
  IF p_mode = 'manual' AND v_manual_count >= 3 THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_limit_reached');
  END IF;
  -- Teto TOTAL 6 (nunca excede por nenhuma via).
  IF (v_auto_count + v_manual_count) >= 6 THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_limit_reached');
  END IF;

  -- (10) PRÓXIMO `attempt_seq` = COALESCE(MAX(attempt_seq),0)+1 (cap 6).
  SELECT COALESCE(MAX(attempt_seq), 0) INTO v_current_seq
    FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;
  v_next_seq := v_current_seq + 1;
  IF v_next_seq > 6 THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_limit_reached');
  END IF;

  -- (11) VENCEDOR: token SERVER-SIDE + INSERT `pending` já com POSSE
  --      (`lease_at = now()`). `ON CONFLICT DO NOTHING` resolve a corrida sem
  --      erro incidental de unicidade.
  v_token := gen_random_uuid();
  INSERT INTO public.product_1_1_copy_state (
    campaign_id, operation_id, state, attempt_seq, attempt_token,
    lease_at, request_token, copy_payload, updated_at, created_at
  ) VALUES (
    p_campaign_id, p_operation_id, 'pending', v_next_seq, v_token,
    now(), p_request_token,
    jsonb_build_object(
      'recovery',
      jsonb_build_object('kind', p_mode, 'failureClass', NULL, 'nextWaitMs', NULL)
    ),
    now(), now()
  )
  ON CONFLICT (campaign_id, operation_id, attempt_seq) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- PERDEU a corrida: outra transação criou a MESMA `attempt_seq`.
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_in_progress');
  END IF;

  RETURN jsonb_build_object(
    'acquired', true, 'reason', NULL,
    'attempt_seq', v_next_seq, 'attempt_token', v_token,
    'mode', p_mode, 'expired_closed', v_expired_closed
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Corrida no `uq_p1_1_copy_state_op_request` (reenvio concorrente do mesmo
    -- acionamento) ou no `uq_p1_1_copy_state_op_attempt` (perdeu a corrida).
    IF p_request_token IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.product_1_1_copy_state
      WHERE campaign_id = p_campaign_id
        AND operation_id = p_operation_id
        AND request_token = p_request_token
    ) THEN
      RETURN jsonb_build_object('acquired', false, 'reason', 'already_acquired');
    END IF;
    RETURN jsonb_build_object('acquired', false, 'reason', 'attempt_in_progress');
END;
$$;

-- =============================================================================
-- 2. Privilégios RPC-only (A2) — EXECUTE apenas para service_role
-- =============================================================================
REVOKE ALL ON FUNCTION public.product_1_1_acquire_copy_attempt(UUID, UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_acquire_copy_attempt(UUID, UUID, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- REVERT (executar manualmente apenas na instância local isolada).
-- A aquisição não persiste nada por si só (apenas a tentativa do vencedor), então
-- o revert apenas remove a RPC.
-- =============================================================================
-- REVOKE ALL ON FUNCTION public.product_1_1_acquire_copy_attempt(UUID, UUID, TEXT, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_acquire_copy_attempt(UUID, UUID, TEXT, UUID);
