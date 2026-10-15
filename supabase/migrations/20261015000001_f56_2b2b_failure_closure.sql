-- F56.2b2b — Encerramento local por falha FINAL (predicado PF) e estorno
-- idempotente do Produto 1:1 (Plano 01, B2B-D3/D6 / REQ-56.2.4-05, REQ-56.2.4-06).
--
-- LOCAL-ONLY: esta migration é apenas AUTORADA aqui. NÃO executar `supabase db
-- push` (nem qualquer mutação remota / reset / `migration up` remoto). Aplicar
-- exclusivamente na instância isolada e descartável (`vendeo-f562a-isolated`)
-- via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e SOMENTE no Plano 06 (Camada 2). Autorar aqui ≠ aplicar.
--
-- Escopo:
--   RPC `public.product_1_1_close_failed_operation` (SECURITY DEFINER,
--   `search_path=''`): sob a MESMA trava C4 da linha de crédito, avalia o
--   predicado PF (falha FINAL) e realiza o estorno idempotente (CAS) UMA única
--   vez, devolvendo um envelope ÚNICO COM IDENTIDADE. NUNCA grava o marcador de
--   outcome (responsabilidade do ponto de decisão terminal — Plano 03) e NUNCA
--   abandona claim `in_progress` (o abandono pertence EXCLUSIVAMENTE ao caminho
--   autorizado — Plano 04).
--
-- B2B-D3 — predicado PF (regra única 4a), TODOS exigidos, avaliados sob a trava:
--   (1) operação NÃO terminal (`reserved`/`art_uploaded`);
--   (2) `p_art_kind = 'absent'` CONFIRMADO (nunca `invalid`/`indeterminate`/erro);
--   (3) NENHUM claim `in_progress`;
--   (4) marcador `outcome='failed'` JÁ gravado em
--       `product_1_1_generation_outcomes`.
--   A alternativa (4b) — exaustão estrutural por recusas — NÃO existe aqui:
--   recusas isoladas (`primary_after_fallback`/`attempt_already_completed`/
--   `attempt_limit_reached`/`attempt_number` máximo) NÃO são gatilho.
--
-- B2B-D6 — terminais e corrida: `delivered` NUNCA é estornado
--   (`delivered_not_refundable`); `refunded` é terminal e idempotente (CAS sob a
--   trava, ANTES do predicado PF), sem reabertura e sem segundo efeito de ledger.
--
-- C3 — envelope ÚNICO com IDENTIDADE (`success`/`idempotent`/`status`/
--   `campaign_id`/`operation_id`/`action`) em AMBOS os caminhos, espelhando o
--   CAS de estorno (`20261008000002`) e a resolução auditada.
--
-- A2 — privilégios RPC-only: `REVOKE ALL ... FROM PUBLIC, anon, authenticated`;
--   `GRANT EXECUTE ... TO service_role`; nenhuma escrita direta de estado
--   financeiro.

-- =============================================================================
-- 1. RPC de encerramento por falha FINAL (PF sob C4) + estorno idempotente (CAS)
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

  -- C4 — MESMA trava comum por operação (a MESMA linha que `acquire`/Plano 03 e
  -- a resolução travam), ANTES de QUALQUER verificação/transição.
  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;

  -- CAS de estorno idempotente PRIMEIRO (C3/D6), sob a trava e ANTES do
  -- predicado PF — de modo que as ramificações de terminal permaneçam
  -- REACHABLE: `refunded` ⇒ reuso idempotente (nenhum segundo efeito de ledger,
  -- sem reabertura); `delivered` ⇒ terminal, NUNCA estornado.
  IF v_credit.status = 'refunded' THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'status', 'refunded',
      'campaign_id', v_credit.campaign_id, 'operation_id', v_credit.operation_id,
      'action', 'close_failed_operation');
  END IF;
  IF v_credit.status = 'delivered' THEN
    RAISE EXCEPTION 'delivered_not_refundable';
  END IF;

  -- PF (regra única 4a) — TODOS os itens exigidos, sob a trava e SOMENTE para a
  -- operação ainda não terminal (o item (1) governa o fechamento AUTOMÁTICO).
  --
  -- (1) operação NÃO terminal — defensivo para estado não-terminal inválido/
  --     desconhecido (`refunded`/`delivered` já foram tratados no CAS acima).
  IF v_credit.status NOT IN ('reserved','art_uploaded') THEN
    RAISE EXCEPTION 'operation_terminal';
  END IF;

  -- (2) arte `absent` CONFIRMADA — nunca colapsar `invalid`/`indeterminate`/erro
  --     de sonda com ausência.
  IF p_art_kind IS DISTINCT FROM 'absent' THEN
    RAISE EXCEPTION 'absent_not_confirmed';
  END IF;

  -- (3) NENHUM claim `in_progress` — o caminho AUTOMÁTICO NUNCA abandona claim.
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_attempt_claims
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND status = 'in_progress'
  ) INTO v_in_progress;
  IF v_in_progress THEN
    RAISE EXCEPTION 'operation_in_progress';
  END IF;

  -- (4) finalidade PERSISTIDA (4a): marcador `outcome='failed'` JÁ gravado. A RPC
  --     NÃO grava nem sobrescreve o marcador (gravação é do ponto de decisão
  --     terminal; o marcador é imutável e único por operação).
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_generation_outcomes
    WHERE campaign_id = p_campaign_id
      AND operation_id = p_operation_id
      AND outcome = 'failed'
  ) INTO v_failed;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'finality_not_recorded';
  END IF;

  -- PF COMPLETO — aplica a devolução UMA única vez e transita para `refunded`, na
  -- MESMA transação sob a trava. `p_reason` é persistido no estorno (padrão de
  -- resolução; nenhum subsistema novo é criado).
  PERFORM public.product_1_1_refund_campaign_credit_operation(
    p_campaign_id, p_operation_id, btrim(p_reason));

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'status', 'refunded',
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
    'action', 'close_failed_operation');
END;
$$;

-- =============================================================================
-- 2. Privilégios RPC-only (A2)
-- =============================================================================
REVOKE ALL ON FUNCTION public.product_1_1_close_failed_operation(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_close_failed_operation(UUID, UUID, TEXT, TEXT) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- REVOKE ALL ON FUNCTION public.product_1_1_close_failed_operation(UUID, UUID, TEXT, TEXT) FROM service_role;
-- DROP FUNCTION IF EXISTS public.product_1_1_close_failed_operation(UUID, UUID, TEXT, TEXT);
