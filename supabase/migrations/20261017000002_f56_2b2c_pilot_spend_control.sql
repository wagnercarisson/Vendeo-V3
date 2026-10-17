-- F56.2b2c (B2.3) — Controle de gasto MÍNIMO do piloto: por chamada, acumulado e
-- com distinção `in_flight` (legítimo) × `unknown` (resultado desconhecido).
-- LOCAL-ONLY: apenas AUTORADA aqui. NÃO executar `supabase db push` (nem qualquer
-- mutação remota / reset). Aplicar exclusivamente na homologação permanente
-- `vendeo-homolog` (workdir `G:\Vendeo-Homolog`) via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- Autorar aqui != aplicar.
--
-- Escopo (B2C-D9): LIMITAR chamadas (imagem ≤3; copy ≤6) por ACUMULADO conservador
-- entre operações/lojas, com `in_flight` persistido (FOR UPDATE não cobre a execução
-- do provider). Resultado desconhecido ⇒ `unknown` mantém a estimativa e bloqueia
-- TODAS as novas chamadas (inclusive da MESMA campanha) até reconciliação EXPLÍCITA.
-- NÃO há liberação por tempo. NÃO é subsistema genérico de orçamento.
--
-- NOTA: `in_flight` (legítimo) ≠ `unknown` (requer reconciliação). Os claims/acquire
-- existentes deduplicam POR OPERAÇÃO (`campaign_id + operation_id`) e NÃO limitam o
-- gasto global — por isso o acumulado próprio é necessário.

-- =============================================================================
-- 1. Estado singleton configurável (cap definido por decisão humana)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_1_1_pilot_spend_state (
  id               BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  cap_usd          NUMERIC,             -- NASCE NULL (não configurado); sem default mágico
  spent_usd        NUMERIC NOT NULL DEFAULT 0 CHECK (spent_usd >= 0),
  cap_set_by       UUID,
  cap_reason       TEXT,
  cap_operation_id UUID,
  cap_set_at       TIMESTAMPTZ,
  blocked_reason   TEXT,
  blocked_at       TIMESTAMPTZ,
  blocked_call_id  UUID,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.product_1_1_pilot_spend_state (id, cap_usd, spent_usd)
VALUES (TRUE, NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- Auditoria APPEND-ONLY das operações de configuração do teto (idempotência por
-- `operation_id` independente do valor vigente).
CREATE TABLE IF NOT EXISTS public.product_1_1_pilot_cap_audit (
  operation_id UUID PRIMARY KEY,
  actor_id     UUID NOT NULL,
  cap_usd      NUMERIC NOT NULL CHECK (cap_usd >= 0),
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. Ledger de chamadas pagas (contabilidade POR CHAMADA)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_1_1_pilot_paid_calls (
  call_id           UUID PRIMARY KEY,
  campaign_id       UUID NOT NULL,
  operation_id      UUID NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN (
                      'image_primary','image_retry','image_fallback',
                      'copy_initial','copy_auto','copy_manual')),
  attempt_seq       INTEGER NOT NULL CHECK (attempt_seq >= 0),
  estimated_usd     NUMERIC NOT NULL CHECK (estimated_usd >= 0),
  state             TEXT NOT NULL DEFAULT 'in_flight'
                      CHECK (state IN ('in_flight','unknown','released','stale')),
  owner_token       UUID NOT NULL,
  resolved_by       UUID,
  resolution_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_p1_1_pilot_calls_in_flight_campaign
  ON public.product_1_1_pilot_paid_calls (campaign_id) WHERE state = 'in_flight';
CREATE INDEX IF NOT EXISTS idx_p1_1_pilot_calls_unknown
  ON public.product_1_1_pilot_paid_calls (call_id) WHERE state = 'unknown';

-- RLS: leitura por service_role; escrita SOMENTE por RPC SECURITY DEFINER.
ALTER TABLE public.product_1_1_pilot_spend_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_1_1_pilot_paid_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_1_1_pilot_cap_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_1_1_pilot_spend_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_pilot_paid_calls FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_pilot_cap_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_pilot_spend_state FROM service_role;
REVOKE ALL ON TABLE public.product_1_1_pilot_paid_calls FROM service_role;
REVOKE ALL ON TABLE public.product_1_1_pilot_cap_audit FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_pilot_spend_state TO service_role;
GRANT SELECT ON TABLE public.product_1_1_pilot_paid_calls TO service_role;
GRANT SELECT ON TABLE public.product_1_1_pilot_cap_audit TO service_role;

-- =============================================================================
-- 3. RPC: definir o teto (auditável; idempotente por operation_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_pilot_set_cap(
  p_actor_id     UUID,
  p_cap_usd      NUMERIC,
  p_reason       TEXT,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_audit public.product_1_1_pilot_cap_audit%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_cap_usd IS NULL THEN RAISE EXCEPTION 'invalid_cap_usd'; END IF;
  IF p_cap_usd < 0 THEN RAISE EXCEPTION 'invalid_cap_usd'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('product_1_1_pilot_spend'));

  -- Idempotência por `operation_id` via auditoria append-only: replay EQUIVALENTE
  -- devolve o MESMO resultado e NÃO reaplica o teto (mesmo após outra operação);
  -- conteúdo DIVERGENTE com o mesmo `operation_id` é CONFLITO.
  SELECT * INTO v_audit FROM public.product_1_1_pilot_cap_audit WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_audit.cap_usd = p_cap_usd
       AND v_audit.actor_id = p_actor_id
       AND v_audit.reason = btrim(p_reason) THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'cap_usd', v_audit.cap_usd);
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'conflict', true, 'reason', 'operation_id_conflict', 'operation_id', p_operation_id
    );
  END IF;

  INSERT INTO public.product_1_1_pilot_cap_audit (operation_id, actor_id, cap_usd, reason)
  VALUES (p_operation_id, p_actor_id, p_cap_usd, btrim(p_reason));

  UPDATE public.product_1_1_pilot_spend_state
     SET cap_usd = p_cap_usd,
         cap_set_by = p_actor_id,
         cap_reason = btrim(p_reason),
         cap_operation_id = p_operation_id,
         cap_set_at = now(),
         updated_at = now()
   WHERE id = TRUE;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'cap_usd', p_cap_usd);
END;
$$;

-- =============================================================================
-- 4. RPC: iniciar uma chamada paga (tri-state; só `acquired` autoriza provider)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_pilot_begin_paid_call(
  p_campaign_id   UUID,
  p_operation_id  UUID,
  p_call_id       UUID,
  p_kind          TEXT,
  p_attempt_seq   INTEGER,
  p_estimated_usd NUMERIC,
  p_owner_token   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state    public.product_1_1_pilot_spend_state%ROWTYPE;
  v_row      public.product_1_1_pilot_paid_calls%ROWTYPE;
  v_found    BOOLEAN;
  v_unknown  BOOLEAN;
  v_same_stream BOOLEAN;
  v_other    BOOLEAN;
BEGIN
  IF p_call_id IS NULL THEN RAISE EXCEPTION 'missing_call_id'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN (
       'image_primary','image_retry','image_fallback','copy_initial','copy_auto','copy_manual')
  THEN RAISE EXCEPTION 'invalid_call_kind'; END IF;
  IF p_estimated_usd IS NULL OR p_estimated_usd < 0 THEN RAISE EXCEPTION 'invalid_estimated_usd'; END IF;

  -- Trava comum do piloto (serializa aquisição com a instalação do bloqueio global).
  PERFORM pg_advisory_xact_lock(hashtext('product_1_1_pilot_spend'));

  SELECT * INTO v_state FROM public.product_1_1_pilot_spend_state WHERE id = TRUE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pilot_state_missing'; END IF;

  -- Replay/idempotência por `call_id`: NÃO soma de novo e NÃO autoriza provider.
  SELECT * INTO v_row FROM public.product_1_1_pilot_paid_calls WHERE call_id = p_call_id;
  v_found := FOUND;
  IF v_found THEN
    IF v_row.kind <> p_kind OR v_row.operation_id <> p_operation_id OR v_row.campaign_id <> p_campaign_id THEN
      RETURN jsonb_build_object(
        'success', false, 'conflict', true, 'reason', 'operation_identity_conflict',
        'call_id', p_call_id
      );
    END IF;
    IF v_row.state = 'in_flight' THEN
      RETURN jsonb_build_object('success', true, 'outcome', 'existing_in_flight',
        'call_id', p_call_id, 'kind', p_kind, 'campaign_id', p_campaign_id,
        'operation_id', p_operation_id, 'attempt_seq', v_row.attempt_seq,
        'spent_usd', v_state.spent_usd, 'cap_usd', v_state.cap_usd);
    END IF;
    RETURN jsonb_build_object('success', true, 'outcome', 'closed',
      'call_id', p_call_id, 'kind', p_kind, 'campaign_id', p_campaign_id,
      'operation_id', p_operation_id, 'attempt_seq', v_row.attempt_seq,
      'spent_usd', v_state.spent_usd, 'cap_usd', v_state.cap_usd);
  END IF;

  -- Configuração inicial fail-closed.
  IF v_state.cap_usd IS NULL THEN RAISE EXCEPTION 'pilot_cap_not_configured'; END IF;

  -- Bloqueio GLOBAL do piloto (instalado quando `mark_unknown` não pôde persistir):
  -- recusa QUALQUER nova chamada até reconciliação explícita.
  IF v_state.blocked_reason IS NOT NULL THEN RAISE EXCEPTION 'pilot_globally_blocked'; END IF;

  -- Resultado desconhecido em QUALQUER campanha bloqueia TODAS as novas chamadas.
  SELECT EXISTS (SELECT 1 FROM public.product_1_1_pilot_paid_calls WHERE state = 'unknown')
    INTO v_unknown;
  IF v_unknown THEN RAISE EXCEPTION 'pilot_requires_reconciliation'; END IF;

  -- Mesma campanha / MESMO FLUXO: uma NOVA chamada do mesmo fluxo (imagem↔imagem,
  -- copy↔copy) com um registro `in_flight` ainda não resolvido é RECUSADA — fecha a
  -- janela de uma chamada travada (ex.: falha ao marcar `unknown`). Preserva a
  -- concorrência por DESIGN imagem×copy (fluxos distintos).
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_pilot_paid_calls
    WHERE state = 'in_flight' AND campaign_id = p_campaign_id
      AND ((p_kind LIKE 'image%' AND kind LIKE 'image%')
        OR (p_kind LIKE 'copy%' AND kind LIKE 'copy%'))
  ) INTO v_same_stream;
  IF v_same_stream THEN RAISE EXCEPTION 'pilot_stream_busy'; END IF;

  -- Concorrência LEGÍTIMA: `in_flight` de OUTRA campanha bloqueia nova campanha;
  -- a MESMA campanha (imagem×copy) é permitida.
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_pilot_paid_calls
    WHERE state = 'in_flight' AND campaign_id <> p_campaign_id
  ) INTO v_other;
  IF v_other THEN RAISE EXCEPTION 'pilot_busy'; END IF;

  -- Acumulado conservador (entre requisições e lojas).
  IF v_state.spent_usd + p_estimated_usd > v_state.cap_usd THEN
    RAISE EXCEPTION 'pilot_cap_reached';
  END IF;

  INSERT INTO public.product_1_1_pilot_paid_calls (
    call_id, campaign_id, operation_id, kind, attempt_seq, estimated_usd, state, owner_token
  ) VALUES (
    p_call_id, p_campaign_id, p_operation_id, p_kind, p_attempt_seq, p_estimated_usd, 'in_flight', p_owner_token
  );
  UPDATE public.product_1_1_pilot_spend_state
     SET spent_usd = spent_usd + p_estimated_usd, updated_at = now()
   WHERE id = TRUE
   RETURNING * INTO v_state;

  RETURN jsonb_build_object('success', true, 'outcome', 'acquired',
    'call_id', p_call_id, 'kind', p_kind, 'campaign_id', p_campaign_id,
    'operation_id', p_operation_id, 'attempt_seq', p_attempt_seq,
    'spent_usd', v_state.spent_usd, 'cap_usd', v_state.cap_usd);
END;
$$;

-- =============================================================================
-- 5. RPC: encerrar com desfecho CONHECIDO (idempotente)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_pilot_end_paid_call(
  p_call_id             UUID,
  p_owner_token         UUID,
  p_actual_estimated_usd NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_pilot_paid_calls%ROWTYPE;
  v_diff NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('product_1_1_pilot_spend'));
  SELECT * INTO v_row FROM public.product_1_1_pilot_paid_calls WHERE call_id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'call_not_found'; END IF;
  IF v_row.owner_token IS DISTINCT FROM p_owner_token THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF v_row.state = 'released' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'state', 'released', 'call_id', p_call_id);
  END IF;
  -- Resultado TARDIO de chamada RECONCILIADA: preserva a disposição auditada e a
  -- estimativa; NÃO recalcula o acumulado nem reabre a chamada.
  IF v_row.state = 'stale' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'state', 'stale', 'call_id', p_call_id);
  END IF;
  IF v_row.state = 'unknown' THEN RAISE EXCEPTION 'call_is_unknown'; END IF;
  IF p_actual_estimated_usd IS NOT NULL AND p_actual_estimated_usd < 0 THEN
    RAISE EXCEPTION 'invalid_estimated_usd';
  END IF;

  -- Estimativa real: NULL ⇒ MANTÉM a estimativa anterior (nunca zera a contabilidade).
  IF p_actual_estimated_usd IS NULL THEN
    UPDATE public.product_1_1_pilot_paid_calls
       SET state = 'released', updated_at = now()
     WHERE call_id = p_call_id;
  ELSE
    v_diff := p_actual_estimated_usd - v_row.estimated_usd;
    UPDATE public.product_1_1_pilot_paid_calls
       SET state = 'released', estimated_usd = p_actual_estimated_usd, updated_at = now()
     WHERE call_id = p_call_id;
    IF v_diff <> 0 THEN
      UPDATE public.product_1_1_pilot_spend_state
         SET spent_usd = GREATEST(spent_usd + v_diff, 0), updated_at = now()
       WHERE id = TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'state', 'released', 'call_id', p_call_id);
END;
$$;

-- =============================================================================
-- 6. RPC: marcar resultado DESCONHECIDO (mantém a estimativa; bloqueia tudo)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_pilot_mark_unknown(
  p_call_id     UUID,
  p_owner_token UUID,
  p_reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_pilot_paid_calls%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('product_1_1_pilot_spend'));
  SELECT * INTO v_row FROM public.product_1_1_pilot_paid_calls WHERE call_id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'call_not_found'; END IF;
  IF v_row.owner_token IS DISTINCT FROM p_owner_token THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF v_row.state = 'unknown' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'state', 'unknown', 'call_id', p_call_id);
  END IF;
  IF v_row.state <> 'in_flight' THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  UPDATE public.product_1_1_pilot_paid_calls
     SET state = 'unknown', resolution_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''), updated_at = now()
   WHERE call_id = p_call_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'state', 'unknown', 'call_id', p_call_id);
END;
$$;

-- =============================================================================
-- 7. RPC: reconciliação EXPLÍCITA (humana/auditada; única via de liberação)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_pilot_reconcile_unknown(
  p_actor_id     UUID,
  p_call_id      UUID,
  p_decision     TEXT,
  p_reason       TEXT,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row      public.product_1_1_pilot_paid_calls%ROWTYPE;
  v_bound    UUID;
  v_is_bound BOOLEAN;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('keep_accounted_release') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('product_1_1_pilot_spend'));

  SELECT * INTO v_row FROM public.product_1_1_pilot_paid_calls WHERE call_id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'call_not_found'; END IF;

  -- A liberação do BLOQUEIO GLOBAL só ocorre ao reconciliar a chamada VINCULADA.
  SELECT blocked_call_id INTO v_bound FROM public.product_1_1_pilot_spend_state WHERE id = TRUE;
  v_is_bound := (v_bound IS NOT NULL AND v_bound = p_call_id);

  IF v_row.state = 'stale' THEN
    IF v_is_bound THEN
      UPDATE public.product_1_1_pilot_spend_state
         SET blocked_reason = NULL, blocked_at = NULL, blocked_call_id = NULL, updated_at = now()
       WHERE id = TRUE;
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'state', 'stale', 'call_id', p_call_id);
  END IF;

  -- Reconciliável: `unknown` (fluxo normal) OU `in_flight` vinculada ao bloqueio
  -- global (o caso em que `mark_unknown` falhou e a chamada ficou travada).
  IF v_row.state <> 'unknown' AND NOT (v_row.state = 'in_flight' AND v_is_bound) THEN
    RAISE EXCEPTION 'call_not_unknown';
  END IF;

  -- Mantém a estimativa CONTABILIZADA; marca `stale` (não bloqueia mais) e
  -- registra a auditoria (ator/motivo) no próprio registro da chamada.
  UPDATE public.product_1_1_pilot_paid_calls
     SET state = 'stale', resolved_by = p_actor_id, resolution_reason = btrim(p_reason), updated_at = now()
   WHERE call_id = p_call_id;

  -- Limpa o bloqueio global SOMENTE quando reconcilia a chamada VINCULADA
  -- (reconciliar outra chamada NÃO limpa indiscriminadamente o bloqueio pendente).
  IF v_is_bound THEN
    UPDATE public.product_1_1_pilot_spend_state
       SET blocked_reason = NULL, blocked_at = NULL, blocked_call_id = NULL, updated_at = now()
     WHERE id = TRUE;
  END IF;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'state', 'stale', 'call_id', p_call_id);
END;
$$;

-- =============================================================================
-- 8. RPC: bloqueio GLOBAL do piloto (rede de segurança quando `mark_unknown` falha)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_pilot_block_global(
  p_call_id UUID,
  p_reason  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('product_1_1_pilot_spend'));
  -- Vincula o bloqueio à CHAMADA que o originou (para reconciliação humana posterior).
  UPDATE public.product_1_1_pilot_spend_state
     SET blocked_reason = COALESCE(blocked_reason, btrim(p_reason)),
         blocked_at = COALESCE(blocked_at, now()),
         blocked_call_id = COALESCE(blocked_call_id, p_call_id),
         updated_at = now()
   WHERE id = TRUE;
  RETURN jsonb_build_object('success', true, 'blocked', true, 'call_id', p_call_id);
END;
$$;

-- Privilégios RPC-only (A2).
REVOKE ALL ON FUNCTION public.product_1_1_pilot_set_cap(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_1_1_pilot_begin_paid_call(UUID, UUID, UUID, TEXT, INTEGER, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_1_1_pilot_end_paid_call(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_1_1_pilot_mark_unknown(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_1_1_pilot_reconcile_unknown(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_1_1_pilot_block_global(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_pilot_set_cap(UUID, NUMERIC, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_1_1_pilot_begin_paid_call(UUID, UUID, UUID, TEXT, INTEGER, NUMERIC, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_1_1_pilot_end_paid_call(UUID, UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_1_1_pilot_mark_unknown(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_1_1_pilot_reconcile_unknown(UUID, UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_1_1_pilot_block_global(UUID, TEXT) TO service_role;

-- =============================================================================
-- REVERT (executar manualmente apenas na instância local, se autorizado)
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.product_1_1_pilot_block_global(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.product_1_1_pilot_reconcile_unknown(UUID, UUID, TEXT, TEXT, UUID);
-- DROP FUNCTION IF EXISTS public.product_1_1_pilot_mark_unknown(UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.product_1_1_pilot_end_paid_call(UUID, UUID, NUMERIC);
-- DROP FUNCTION IF EXISTS public.product_1_1_pilot_begin_paid_call(UUID, UUID, UUID, TEXT, INTEGER, NUMERIC, UUID);
-- DROP FUNCTION IF EXISTS public.product_1_1_pilot_set_cap(UUID, NUMERIC, TEXT, UUID);
-- DROP TABLE IF EXISTS public.product_1_1_pilot_cap_audit;
-- DROP TABLE IF EXISTS public.product_1_1_pilot_paid_calls;
-- DROP TABLE IF EXISTS public.product_1_1_pilot_spend_state;
