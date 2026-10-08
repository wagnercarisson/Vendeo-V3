-- F56.2b1a — Operação atômica de crédito/estado do Produto 1:1 (local-only)
-- Local-first: aplicar e validar apenas na instância Supabase descartável isolada
-- (`vendeo-f562a-isolated`, API 127.0.0.1:56321, DB 56322).
-- ADITIVA e LOCAL-ONLY: NÃO executar `supabase db push` remoto sem aprovação humana.
--
-- Escopo (design A4 / tasks 4.1-4.4):
--   1. Tabela dedicada de operação de crédito com identidade única
--      `campaign_id + operation_id` e estados `reserved → art_uploaded → delivered | refunded`.
--   2. Funções SQL/RPC transacionais que concentram a garantia de atomicidade
--      (a correção financeira NÃO depende de CAS no serviço TypeScript):
--        - reserve: executa `reserve_credit` E insere `reserved` na MESMA transação;
--        - art_uploaded: CAS reserved → art_uploaded;
--        - deliver: CAS art_uploaded → delivered (terminal; não estorna);
--        - refund: CAS reserved|art_uploaded → refunded (uma única vez; recusa delivered);
--        - reconcile: estorno excepcional restrito a estados incompletos.
--   3. Leitura separa `reserved` (temporário) de `delivered` (consumo definitivo).
--
-- Isolamento: esta migration NÃO altera `credit_transactions`/`credit_balances`
-- diretamente; usa as funções existentes `reserve_credit`/`refund_credit`.

-- =============================================================================
-- 1. Tabela de operação de crédito (identidade única composta)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_1_1_campaign_credit_operations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id  UUID NOT NULL,
  store_id      UUID NOT NULL REFERENCES public.stores(id),
  amount        INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('reserved', 'art_uploaded', 'delivered', 'refunded')),
  credit_tx_id  UUID,
  refund_tx_id  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Um único crédito por entrega.
  CONSTRAINT chk_p1_1_campaign_credit_operations_amount CHECK (amount = 1),
  CONSTRAINT uq_p1_1_campaign_credit_operations_identity UNIQUE (campaign_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_p1_1_campaign_credit_operations_status_updated
  ON public.product_1_1_campaign_credit_operations (status, updated_at);

ALTER TABLE public.product_1_1_campaign_credit_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages product 1.1 campaign credit operations"
  ON public.product_1_1_campaign_credit_operations;
CREATE POLICY "Service role manages product 1.1 campaign credit operations"
  ON public.product_1_1_campaign_credit_operations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Escrita SOMENTE pelas RPCs SECURITY DEFINER: service_role recebe apenas SELECT
-- (nenhuma escrita direta — não contorna atomicidade/CAS).
REVOKE ALL ON TABLE public.product_1_1_campaign_credit_operations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_campaign_credit_operations FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_campaign_credit_operations TO service_role;

-- =============================================================================
-- 2. Reserva atômica: reserve_credit + estado `reserved` na MESMA transação
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_reserve_credit_operation(
  p_store_id     UUID,
  p_campaign_id  UUID,
  p_operation_id UUID,
  p_amount       INTEGER,
  p_metadata     JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing    public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_tx_id       UUID;
  v_inserted_id UUID;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  -- Um único crédito por entrega.
  IF p_amount IS NULL OR p_amount <> 1 THEN RAISE EXCEPTION 'invalid_credit_amount'; END IF;

  -- A campanha precisa pertencer à loja informada (identidade confiável).
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = p_campaign_id AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'campaign_store_mismatch';
  END IF;

  SELECT * INTO v_existing
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing.store_id = p_store_id AND v_existing.amount = p_amount THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true, 'status', v_existing.status,
        'campaign_id', v_existing.campaign_id, 'operation_id', v_existing.operation_id,
        'amount', v_existing.amount, 'credit_tx_id', v_existing.credit_tx_id,
        'refund_tx_id', v_existing.refund_tx_id
      );
    END IF;
    RAISE EXCEPTION 'operation_identity_conflict';
  END IF;

  -- Concorrência: insere a operação PRIMEIRO pela identidade única. Só o
  -- VENCEDOR da corrida reserva no ledger; o PERDEDOR aguarda o commit e devolve
  -- a MESMA operação — sem cobrança duplicada nem erro incidental de unicidade.
  INSERT INTO public.product_1_1_campaign_credit_operations (
    campaign_id, operation_id, store_id, amount, status, credit_tx_id
  ) VALUES (
    p_campaign_id, p_operation_id, p_store_id, p_amount, 'reserved', NULL
  )
  ON CONFLICT (campaign_id, operation_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- Perdemos a corrida: outra reserva equivalente venceu. Devolve a MESMA
    -- operação (idempotente), validando a identidade.
    SELECT * INTO v_existing
    FROM public.product_1_1_campaign_credit_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
    IF v_existing.store_id <> p_store_id OR v_existing.amount <> p_amount THEN
      RAISE EXCEPTION 'operation_identity_conflict';
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'status', v_existing.status,
      'campaign_id', v_existing.campaign_id, 'operation_id', v_existing.operation_id,
      'amount', v_existing.amount, 'credit_tx_id', v_existing.credit_tx_id,
      'refund_tx_id', v_existing.refund_tx_id
    );
  END IF;

  -- Vencedor: reserva TEMPORÁRIA no ledger (mesma transação). Qualquer exceção
  -- aqui aborta TUDO (a linha de operação some e o saldo não muda).
  -- Idempotência do ledger vinculada à identidade COMPOSTA (campanha + operação).
  v_tx_id := public.reserve_credit(
    p_store_id,
    p_amount,
    p_campaign_id,
    'p1_1_reserve_' || p_campaign_id::text || '_' || p_operation_id::text,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  -- Sem transação de reserva válida NÃO há estado: falha atômica (rollback total).
  IF v_tx_id IS NULL THEN RAISE EXCEPTION 'credit_reservation_missing_tx'; END IF;

  UPDATE public.product_1_1_campaign_credit_operations
     SET credit_tx_id = v_tx_id, updated_at = now()
   WHERE id = v_inserted_id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'status', 'reserved',
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id, 'amount', p_amount,
    'credit_tx_id', v_tx_id, 'refund_tx_id', NULL
  );
END;
$$;

-- =============================================================================
-- 3. CAS: reserved → art_uploaded
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_mark_campaign_credit_art_uploaded(
  p_campaign_id  UUID,
  p_operation_id UUID
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

  IF v_row.status <> 'reserved' THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'art_uploaded', updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'art_uploaded',
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
    'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
END;
$$;

-- =============================================================================
-- 4. CAS final: art_uploaded → delivered (terminal, não estorna)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_deliver_campaign_credit_operation(
  p_campaign_id  UUID,
  p_operation_id UUID
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

  -- Idempotência: delivered é terminal e não gera novo efeito.
  IF v_row.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'delivered',
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
      'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
  END IF;

  IF v_row.status <> 'art_uploaded' THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'delivered', updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'delivered',
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
    'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
END;
$$;

-- =============================================================================
-- 5. CAS de estorno: reserved|art_uploaded → refunded (uma única vez)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_refund_campaign_credit_operation(
  p_campaign_id  UUID,
  p_operation_id UUID,
  p_reason       TEXT DEFAULT 'refund'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_refund_id UUID;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT * INTO v_row
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  -- Idempotência: refunded restaura a reserva uma única vez.
  IF v_row.status = 'refunded' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'refunded',
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
      'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id);
  END IF;

  -- delivered é terminal: NUNCA pode ser estornado.
  IF v_row.status = 'delivered' THEN RAISE EXCEPTION 'delivered_not_refundable'; END IF;

  IF v_row.status NOT IN ('reserved', 'art_uploaded') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  -- Evidência de reserva ausente é ambígua: NÃO estorna.
  IF v_row.credit_tx_id IS NULL THEN RAISE EXCEPTION 'credit_reservation_missing_tx'; END IF;

  -- Restaura a reserva no ledger existente (mesma transação).
  -- Idempotência do ledger vinculada à identidade COMPOSTA (campanha + operação).
  v_refund_id := public.refund_credit(
    v_row.credit_tx_id,
    COALESCE(NULLIF(btrim(p_reason), ''), 'refund'),
    'p1_1_refund_' || p_campaign_id::text || '_' || p_operation_id::text,
    '{}'::jsonb
  );

  UPDATE public.product_1_1_campaign_credit_operations
     SET status = 'refunded', refund_tx_id = v_refund_id, updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'refunded',
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id, 'amount', v_row.amount,
    'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_refund_id);
END;
$$;

-- =============================================================================
-- 6. Leitura da operação (separa reserved temporário de delivered definitivo)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_get_campaign_credit_operation(
  p_campaign_id  UUID,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'success', true, 'status', v_row.status,
    'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id,
    'amount', v_row.amount, 'credit_tx_id', v_row.credit_tx_id, 'refund_tx_id', v_row.refund_tx_id,
    -- `consumed_definitive` só é true em `delivered`; `reserved` é temporário.
    'consumed_definitive', (v_row.status = 'delivered')
  );
END;
$$;

-- =============================================================================
-- 7. Reconciliação que ADIA a resolução (sem evidência suficiente)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_reconcile_campaign_credit_operations(
  p_timeout_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_deferred JSONB := '[]'::jsonb;
  v_count    INTEGER := 0;
BEGIN
  IF p_timeout_minutes IS NULL OR p_timeout_minutes <= 0 THEN RAISE EXCEPTION 'invalid_timeout'; END IF;

  -- ADIA a resolução. `reserved` NÃO prova ausência de arte: o upload pode ter
  -- ocorrido antes da falha em registrar `art_uploaded`. Sem evidência
  -- suficiente, a reconciliação NÃO estorna operações incompletas — apenas as
  -- expõe como candidatas para decisão EXPLÍCITA (refund manual). Nunca chama
  -- `refund_credit` automaticamente por timeout.
  FOR v_row IN
    SELECT * FROM public.product_1_1_campaign_credit_operations
    WHERE status IN ('reserved', 'art_uploaded')
      AND updated_at < now() - make_interval(mins => p_timeout_minutes)
    FOR UPDATE
  LOOP
    v_deferred := v_deferred || jsonb_build_object(
      'campaign_id', v_row.campaign_id, 'operation_id', v_row.operation_id,
      'status', v_row.status, 'amount', v_row.amount,
      'has_credit_tx', (v_row.credit_tx_id IS NOT NULL)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 'resolved', 0, 'deferred_count', v_count, 'deferred', v_deferred
  );
END;
$$;

-- =============================================================================
-- 8. Privilégios mínimos (service_role apenas)
-- =============================================================================
REVOKE ALL ON FUNCTION public.product_1_1_reserve_credit_operation(UUID, UUID, UUID, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_reserve_credit_operation(UUID, UUID, UUID, INTEGER, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_mark_campaign_credit_art_uploaded(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_mark_campaign_credit_art_uploaded(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_deliver_campaign_credit_operation(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_deliver_campaign_credit_operation(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_refund_campaign_credit_operation(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_refund_campaign_credit_operation(UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_get_campaign_credit_operation(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_get_campaign_credit_operation(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_reconcile_campaign_credit_operations(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_reconcile_campaign_credit_operations(INTEGER) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- REVOKE ALL ON FUNCTION public.product_1_1_reconcile_campaign_credit_operations(INTEGER) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_reconcile_campaign_credit_operations(INTEGER);
-- REVOKE ALL ON FUNCTION public.product_1_1_get_campaign_credit_operation(UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_get_campaign_credit_operation(UUID, UUID);
-- REVOKE ALL ON FUNCTION public.product_1_1_refund_campaign_credit_operation(UUID, UUID, TEXT) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_refund_campaign_credit_operation(UUID, UUID, TEXT);
-- REVOKE ALL ON FUNCTION public.product_1_1_deliver_campaign_credit_operation(UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_deliver_campaign_credit_operation(UUID, UUID);
-- REVOKE ALL ON FUNCTION public.product_1_1_mark_campaign_credit_art_uploaded(UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_mark_campaign_credit_art_uploaded(UUID, UUID);
-- REVOKE ALL ON FUNCTION public.product_1_1_reserve_credit_operation(UUID, UUID, UUID, INTEGER, JSONB) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_reserve_credit_operation(UUID, UUID, UUID, INTEGER, JSONB);
-- DROP POLICY IF EXISTS "Service role manages product 1.1 campaign credit operations" ON public.product_1_1_campaign_credit_operations;
-- DROP TABLE IF EXISTS public.product_1_1_campaign_credit_operations;
