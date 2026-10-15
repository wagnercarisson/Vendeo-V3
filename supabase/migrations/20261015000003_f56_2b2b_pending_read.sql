-- F56.2b2b — Leitura persistida de pendência (`failed` NÃO terminal) do Produto 1:1
-- (Plano 03 — correção complementar pós-revisão; B2B-D3/D6 / REQ-56.2.4-05, -07, -10, -11).
--
-- LOCAL-ONLY: esta migration é apenas AUTORADA aqui. NÃO executar `supabase db
-- push` (nem qualquer mutação remota / reset / `migration up` remoto). Aplicar
-- exclusivamente na instância isolada e descartável (`vendeo-f562a-isolated`)
-- via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e SOMENTE no Plano 06. Autorar aqui ≠ aplicar.
--
-- Escopo: `CREATE OR REPLACE` de
--   `public.product_1_1_get_campaign_operation_by_campaign(UUID)` (assinatura
--   preservada) para expor, para operação NÃO terminal, o `outcome` PERSISTIDO
--   (`'unknown'` OU `'failed'`) e o `support_reference` correspondente — usando os
--   registros EXISTENTES de `product_1_1_generation_outcomes`.
--   - O booleano `unknown` MANTÉM o significado atual (só `'unknown'`);
--   - A PRECEDÊNCIA TERMINAL é preservada (`delivered`/`refunded` ⇒ `terminal`,
--     `outcome`/`support_reference` nulos);
--   - read-only; NENHUMA sobrescrita de marcador; sem novas tabelas/colunas.
-- Não alterar as migrations anteriores.

-- =============================================================================
-- 1. Leitura por campanha (+ `outcome`/`support_reference` persistidos, I2)
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
  v_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_outcome     public.product_1_1_generation_outcomes%ROWTYPE;
  v_has_outcome BOOLEAN := false;
  v_unknown     BOOLEAN := false;
  v_terminal    BOOLEAN := false;
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
  v_has_outcome := FOUND;

  IF v_has_outcome AND v_outcome.outcome = 'unknown' THEN
    v_unknown := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'status', v_credit.status,
    'campaign_id', v_credit.campaign_id, 'operation_id', v_credit.operation_id,
    'amount', v_credit.amount, 'credit_tx_id', v_credit.credit_tx_id,
    'refund_tx_id', v_credit.refund_tx_id,
    'consumed_definitive', (v_credit.status = 'delivered'),
    -- I2 — PRECEDÊNCIA TERMINAL: o estado terminal PREVALECE; o marcador só
    -- governa operação NÃO terminal (a linha histórica é imutável).
    'terminal', v_terminal,
    -- `unknown` mantém o significado ATUAL (só `outcome='unknown'`).
    'unknown', (v_unknown AND NOT v_terminal),
    -- C2 — expõe o `outcome` PERSISTIDO (`'unknown'`/`'failed'`) enquanto NÃO
    -- terminal, para que consulta/reload reconheçam a pendência (`failed` NUNCA é
    -- geração ativa). Terminal ⇒ nulo (precedência).
    'outcome',
      CASE WHEN v_has_outcome AND NOT v_terminal THEN v_outcome.outcome ELSE NULL END,
    'support_reference',
      CASE WHEN v_has_outcome AND NOT v_terminal THEN v_outcome.support_reference ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- DESFAZER: reexecutar a definição ORIGINAL (migration 20261009000001 —
-- `product_1_1_get_campaign_operation_by_campaign`), que só expunha `unknown`
-- (`outcome` não nulo apenas para `'unknown'`), sem `outcome`/`support_reference`
-- de `failed`. Não é possível "dropar" sem perder a RPC de leitura — apenas
-- restaurar a versão anterior.
