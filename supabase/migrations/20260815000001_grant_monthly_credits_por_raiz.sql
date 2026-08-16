-- Grant Mensal por Raiz de CNPJ (alinhamento quick 260815-i9a)
-- -----------------------------------------------------------------------------
-- Reescreve public.grant_monthly_credits para semântica POR RAIZ de CNPJ:
--   - No máximo 1 grant por raiz por ciclo mensal, independente do nº de lojas.
--   - Recipiente determinístico escolhido ENTRE TODAS as lojas não-teste da raiz
--     (matriz preferida; sem matriz, a loja não-teste mais antiga).
--   - Histórico freemium validado NO NÍVEL DA RAIZ, nunca no nível do recipiente.
--   - Limiar de elegibilidade (NÃO teto): bonus_balance < p_bonus_cap → grant
--     integral de p_amount; bonus_balance >= p_bonus_cap → NENHUM grant no ciclo.
--   - Ciclo por aniversário em fuso explícito America/Sao_Paulo, com clamp de
--     dia 29/30/31 para o último dia do mês curto (nunca dia 1 do mês seguinte).
--   - Idempotência por raiz+cycle via try_grant_monthly_entitlement (ON CONFLICT
--     DO NOTHING no índice único (root_hash, benefit_type, COALESCE(cycle,...))).
--   - RPC restrita a service_role (REVOKE PUBLIC/anon/authenticated).
--   - Shape canônico {eligible, granted, skipped, errors, details} alinhado com
--     botão admin e testes; eligible = granted + skipped_already_granted +
--     skipped_bonus_threshold; skipped_not_due NÃO entra em eligible.
--
-- Nenhuma mudança de schema: apenas CREATE OR REPLACE FUNCTION + REVOKE/GRANT.
-- last_monthly_grant_at (F29.3) permanece legado/deprecado — NÃO é dropado nem
-- usado como fonte de verdade.
--
-- Assinatura: callers (cron + admin) passam apenas {p_amount, p_bonus_cap,
-- p_min_store_age_days} via named params e continuam funcionando porque o 4º
-- parâmetro p_reference_date tem DEFAULT NULL. O DROP da assinatura de 3 params
-- é necessário porque adicionar um parâmetro muda a assinatura da função: um
-- CREATE OR REPLACE isolado deixaria AMBAS as assinaturas (3 e 4 params),
-- gerando ambiguidade/erro de cache no PostgREST (mesmo padrão de
-- create_store_with_initial_grant_v2).

-- Elimina ambiguidade de assinatura/cache PostgREST: garante que apenas a
-- assinatura nova (com p_reference_date) exista.
DROP FUNCTION IF EXISTS public.grant_monthly_credits(INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.grant_monthly_credits(
  p_amount INTEGER,
  p_bonus_cap INTEGER,
  p_min_store_age_days INTEGER,
  p_reference_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ref_date DATE;
  v_cycle TEXT;
  v_root_hash TEXT;
  v_recipient RECORD;
  v_recipient_bonus INTEGER;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_anniv_day INTEGER;
  v_last_day INTEGER;
  v_grant_day INTEGER;
  v_roots_considered INTEGER := 0;
  v_eligible INTEGER := 0;
  v_granted INTEGER := 0;
  v_skipped_no_cnpj INTEGER := 0;
  v_skipped_already_granted INTEGER := 0;
  v_skipped_not_due INTEGER := 0;
  v_skipped_bonus_threshold INTEGER := 0;
BEGIN
  -- Data de referência: p_reference_date para testabilidade SQL (dia 29/30/31 e
  -- fevereiro); NULL → dia civil Brasil atual. TODOS os cálculos de ciclo,
  -- aniversário e idade usam America/Sao_Paulo explícito (r1-4).
  v_ref_date := COALESCE(p_reference_date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_cycle := TO_CHAR(v_ref_date, 'YYYY-MM');

  -- Pré-contagem: lojas não-teste sem cnpj_root_hash (fora do cursor).
  SELECT COUNT(*) INTO v_skipped_no_cnpj
  FROM public.stores s
  WHERE s.is_test_store = FALSE
    AND (s.cnpj_root_hash IS NULL OR s.cnpj_root_hash = '');

  -- Iteração POR RAIZ (substitui o loop por loja). O cursor é o conjunto de
  -- raízes de CNPJ das lojas não-teste; o lock de concorrência é no recipiente
  -- (credit_balances), não na store.
  FOR v_root_hash IN
    SELECT DISTINCT s.cnpj_root_hash
    FROM public.stores s
    WHERE s.cnpj_root_hash IS NOT NULL
      AND s.cnpj_root_hash != ''
      AND s.is_test_store = FALSE
  LOOP
    v_roots_considered := v_roots_considered + 1;

    -- Recipiente determinístico: matriz (substring(cnpj_normalized, 9, 4)='0001')
    -- preferida; sem matriz, a loja não-teste mais antiga (created_at ASC, id ASC).
    -- NENHUM filtro EXISTS de transação bônus no recipiente (r1-1): a filial
    -- cadastrada primeiro pode ter recebido onboarding enquanto a matriz
    -- (cadastrada depois) nunca teve transação própria — o histórico freemium
    -- é validado no NÍVEL DA RAIZ abaixo.
    SELECT s.id, s.created_at
    INTO v_recipient
    FROM public.stores s
    WHERE s.cnpj_root_hash = v_root_hash
      AND s.is_test_store = FALSE
    ORDER BY CASE WHEN substring(s.cnpj_normalized, 9, 4) = '0001' THEN 0 ELSE 1 END,
             s.created_at ASC, s.id ASC
    LIMIT 1;

    -- Edge case: raiz sem nenhuma loja não-teste → sem recipiente válido.
    IF v_recipient.id IS NULL THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    -- Histórico freemium validado NO NÍVEL DA RAIZ (r1-1): raiz é elegível se já
    -- existe freemium_entitlements com benefit_type='onboarding' para o root_hash
    -- OU qualquer loja da raiz possui transação bonus_onboarding/bonus_monthly.
    IF NOT EXISTS (
      SELECT 1 FROM public.freemium_entitlements fe
      WHERE fe.root_hash = v_root_hash AND fe.benefit_type = 'onboarding'
    ) AND NOT EXISTS (
      SELECT 1 FROM public.credit_transactions ct
      JOIN public.stores s ON s.id = ct.store_id
      WHERE s.cnpj_root_hash = v_root_hash
        AND ct.type IN ('bonus_onboarding', 'bonus_monthly')
    ) THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    -- Idade mínima (r2-2): comparação por DIA CIVIL BR
    -- (created_at AT TIME ZONE 'America/Sao_Paulo')::date, sem efeito de
    -- hora/minuto — regra "idade da loja em dias, no fuso do lojista".
    IF (v_recipient.created_at AT TIME ZONE 'America/Sao_Paulo')::date > (v_ref_date - p_min_store_age_days) THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    -- Ciclo por aniversário com clamp de dia 29/30/31 (nunca dia 1, r1-4).
    v_anniv_day := EXTRACT(DAY FROM (v_recipient.created_at AT TIME ZONE 'America/Sao_Paulo'));
    v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_ref_date) + INTERVAL '1 month - 1 day'));
    v_grant_day := LEAST(v_anniv_day, v_last_day);

    -- Concede a raiz APENAS no dia-do-mês do aniversário do recipiente.
    IF EXTRACT(DAY FROM v_ref_date) <> v_grant_day THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    -- Row garantida em credit_balances ANTES do lock (r1-2): matriz cadastrada
    -- depois pode nunca ter recebido crédito e não ter row. PK em store_id.
    INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
    VALUES (v_recipient.id, 0, 0, 0)
    ON CONFLICT (store_id) DO NOTHING;

    -- Lock de concorrência no recipiente (bloqueia dupla execução do cron no
    -- mesmo recipiente; sem SKIP LOCKED para evitar grant perdido).
    SELECT cb.bonus_balance INTO v_recipient_bonus
    FROM public.credit_balances cb
    WHERE cb.store_id = v_recipient.id
    FOR UPDATE;

    -- (5) Existência do entitlement mensal ANTES do limiar (r2-1): na 2ª
    -- execução do mesmo dia, a raiz que já recebeu grant (ex.: 9→14) deve cair
    -- em skipped_already_granted (causa real do skip), NÃO em
    -- skipped_bonus_threshold. SELECT somente leitura.
    IF EXISTS (
      SELECT 1 FROM public.freemium_entitlements
      WHERE root_hash = v_root_hash
        AND benefit_type = 'monthly'
        AND COALESCE(cycle, '_nostring_') = v_cycle
    ) THEN
      v_skipped_already_granted := v_skipped_already_granted + 1;
      CONTINUE;
    END IF;

    -- (6) Limiar de elegibilidade (NÃO teto) — DEPOIS do check de existência
    -- (r2-1): concede apenas se v_recipient_bonus < p_bonus_cap. Em ou acima do
    -- limiar → NENHUM grant no ciclo (sem entitlement criado). Sem partial grant.
    IF v_recipient_bonus >= p_bonus_cap THEN
      v_skipped_bonus_threshold := v_skipped_bonus_threshold + 1;
      CONTINUE;
    END IF;

    -- (7) INSERT de entitlement + grant (r2-1): o ON CONFLICT DO NOTHING do
    -- try_grant_monthly_entitlement é a salvaguarda FINAL contra execuções
    -- concorrentes do cron (o check do item 5 é leitura pura; a corrida real
    -- se resolve aqui).
    v_entitlement_id := public.try_grant_monthly_entitlement(v_recipient.id, v_root_hash, v_cycle);

    IF v_entitlement_id IS NULL THEN
      v_skipped_already_granted := v_skipped_already_granted + 1;
      CONTINUE;
    END IF;

    -- Grant INTEGRAL de p_amount (sem LEAST/partial). Idempotency key por
    -- raiz+cycle: 'mensal_<cycle>_<root_hash>'.
    v_grant_tx_id := public.grant_credits(
      v_recipient.id, p_amount, 'credito_mensal',
      'mensal_' || v_cycle || '_' || v_root_hash,
      jsonb_build_object('cycle', v_cycle, 'source', 'monthly_cron'),
      'bonus_monthly'
    );

    UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
    WHERE id = v_entitlement_id;

    v_granted := v_granted + 1;
  END LOOP;

  -- Shape canônico (r1-3): eligible = raízes que passaram todos os gates de
  -- elegibilidade exceto idempotência/limiar. skipped_not_due NÃO entra em
  -- eligible (raízes fora do dia de aniversário / idade < mínima / sem histórico
  -- freemium / sem recipiente) — ficam só em details.roots_considered.
  v_eligible := v_granted + v_skipped_already_granted + v_skipped_bonus_threshold;

  RETURN jsonb_build_object(
    'eligible', v_eligible,
    'granted', v_granted,
    'skipped', v_eligible - v_granted,
    'errors', 0,
    'details', jsonb_build_object(
      'roots_considered', v_roots_considered,
      'skipped_no_cnpj', v_skipped_no_cnpj,
      'skipped_already_granted', v_skipped_already_granted,
      'skipped_not_due', v_skipped_not_due,
      'skipped_bonus_threshold', v_skipped_bonus_threshold
    )
  );
END;
$$;

COMMENT ON FUNCTION public.grant_monthly_credits IS
'Concede créditos bônus mensais por RAIZ de CNPJ (máx. 1 grant por raiz por ciclo mensal). Limiar (NÃO teto): bonus_balance < p_bonus_cap → grant integral de p_amount; >= p_bonus_cap → nenhum grant no ciclo. Ciclo por aniversário em America/Sao_Paulo com clamp de dia 29/30/31 (nunca dia 1). Recipiente determinístico: matriz (substring(cnpj_normalized,9,4)=''0001'') preferida; sem matriz, loja não-teste mais antiga. Ordem dos checks: existência do entitlement mensal → limiar → INSERT via try_grant_monthly_entitlement (ON CONFLICT = salvaguarda contra corrida concorrente). Idempotência por (root_hash, ''monthly'', cycle YYYY-MM). p_reference_date (DEFAULT NULL) permite testabilidade SQL; callers cron/admin passam apenas os 3 primeiros params. Acesso restrito a service_role.';

-- =============================================================================
-- Segurança (T-Q01-01/T-Q01-04): fecha o gap de privilégio — a RPC é SECURITY
-- DEFINER e hoje (20260731000003) não possui REVOKE/GRANT, sendo executável por
-- PUBLIC via PostgREST. Callers cron/admin usam supabaseAdmin (service_role):
--   src/app/api/cron/monthly-credits/route.ts:26
--   src/app/api/admin/monthly-credits/grant/route.ts:19
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.grant_monthly_credits(INTEGER, INTEGER, INTEGER, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits(INTEGER, INTEGER, INTEGER, DATE) TO service_role;

-- =============================================================================
-- REVERT
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.grant_monthly_credits CASCADE;
-- Re-criar a função a partir do migration 20260731000003
-- (fix_admin_get_metrics_uuid_text.sql, bloco 2 — grant_monthly_credits por loja).