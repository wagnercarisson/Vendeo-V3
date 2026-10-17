-- F56.2b2c (B2.3) — Prova da migration 20261017000003 (estimativa > 0). LOCAL-ONLY.
-- Executar na vendeo-homolog via psql; ROLLBACK no fim (sem resíduo).
BEGIN;

SELECT public.product_1_1_pilot_set_cap(gen_random_uuid(), 10, 'prova-m1', gen_random_uuid());

DO $$
DECLARE
  v_camp  UUID := gen_random_uuid();
  v_op    UUID := gen_random_uuid();
  v_call  UUID := gen_random_uuid();
  v_owner UUID := gen_random_uuid();
  v_res   JSONB;
  v_spent_before NUMERIC;
  v_spent_after  NUMERIC;
  v_ok    BOOLEAN;
BEGIN
  -- (1) aquisição com ZERO ⇒ recusada (CHECK)
  v_ok := false;
  BEGIN
    PERFORM public.product_1_1_pilot_begin_paid_call(v_camp, v_op, gen_random_uuid(), 'image_primary', 1, 0, v_owner);
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'PROOF_FAIL: zero aceito na aquisicao'; END IF;

  -- (2) aquisição NEGATIVA ⇒ recusada
  v_ok := false;
  BEGIN
    PERFORM public.product_1_1_pilot_begin_paid_call(v_camp, v_op, gen_random_uuid(), 'image_primary', 1, -1, v_owner);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'PROOF_FAIL: negativo aceito'; END IF;

  -- (3) POSITIVA ⇒ aceita
  v_res := public.product_1_1_pilot_begin_paid_call(v_camp, v_op, v_call, 'image_primary', 1, 0.3, v_owner);
  IF v_res->>'outcome' <> 'acquired' THEN RAISE EXCEPTION 'PROOF_FAIL: positivo recusado'; END IF;

  -- (4) encerramento com ZERO informado ⇒ recusado (UPDATE ⇒ CHECK)
  v_ok := false;
  BEGIN
    PERFORM public.product_1_1_pilot_end_paid_call(v_call, v_owner, 0);
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'PROOF_FAIL: end zero aceito'; END IF;

  -- (5) encerramento com NULL ⇒ PRESERVA a estimativa (não zera)
  SELECT spent_usd INTO v_spent_before FROM public.product_1_1_pilot_spend_state WHERE id = TRUE;
  PERFORM public.product_1_1_pilot_end_paid_call(v_call, v_owner, NULL);
  SELECT spent_usd INTO v_spent_after FROM public.product_1_1_pilot_spend_state WHERE id = TRUE;
  IF v_spent_after <> v_spent_before THEN RAISE EXCEPTION 'PROOF_FAIL: end(NULL) alterou o acumulado'; END IF;

  RAISE NOTICE 'M1_PROOF: PASS';
END $$;

ROLLBACK;
