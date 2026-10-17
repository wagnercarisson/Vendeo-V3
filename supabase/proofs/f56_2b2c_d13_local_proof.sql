-- F56.2b2c (B2.3) — Prova LOCAL de D13 na vendeo-homolog. LOCAL-ONLY.
-- Três cenários: (1) ausência + PF ⇒ refunded; (2) arte íntegra recuperável ⇒ delivered;
-- (3) inconclusivo (claim in_progress) ⇒ resolucao AUTORIZADA/auditada.
-- Ator legítimo (actor_id), provider SIMULADO (nenhuma chamada), ROLLBACK no fim (preservacao).
BEGIN;

DO $$
DECLARE
  v_store UUID := '48b212f8-2b0f-4679-b553-122a601bacac';
  v_c1 UUID := gen_random_uuid(); v_o1 UUID := gen_random_uuid();
  v_c2 UUID := gen_random_uuid(); v_o2 UUID := gen_random_uuid();
  v_c3 UUID := gen_random_uuid(); v_o3 UUID := gen_random_uuid();
  v_actor UUID := '1273d07b-c2d1-48c9-88ca-9acfe6c0ac14'; -- ator LEGITIMO existente (auth.users)
  v_status TEXT; v_res JSONB; v_epoch INTEGER;
BEGIN
  INSERT INTO public.campaigns(id, store_id, status, product_name, storage_path) VALUES
    (v_c1, v_store, 'ready', 'd13-proof-1', 'proof/d13-c1'),
    (v_c2, v_store, 'ready', 'd13-proof-2', 'proof/d13-c2'),
    (v_c3, v_store, 'ready', 'd13-proof-3', 'proof/d13-c3');

  -- CENARIO 1: arte AUSENTE confirmada + PF (outcome failed + sem in_progress) ⇒ refunded
  PERFORM public.product_1_1_reserve_credit_operation(v_store, v_c1, v_o1, 1, '{}'::jsonb);
  PERFORM public.product_1_1_record_generation_outcome(v_c1, v_o1, 'failed');
  v_res := public.product_1_1_close_failed_operation(v_c1, v_o1, 'absent', 0, 'd13-proof-absent-pf');
  SELECT status INTO v_status FROM public.product_1_1_campaign_credit_operations WHERE campaign_id=v_c1 AND operation_id=v_o1;
  IF v_status <> 'refunded' THEN RAISE EXCEPTION 'S1_FAIL status=%', v_status; END IF;
  RAISE NOTICE 'S1_PASS: ausencia+PF => refunded';

  -- CENARIO 2: arte INTEGRA recuperavel ⇒ entrega SEM regenerar
  PERFORM public.product_1_1_reserve_credit_operation(v_store, v_c2, v_o2, 1, '{}'::jsonb);
  INSERT INTO public.product_1_1_campaign_artifacts(campaign_id, operation_id, storage_path, width, height, mime_type)
    VALUES (v_c2, v_o2, 'proof/d13-art2.png', 1024, 1024, 'image/png');
  v_res := public.product_1_1_confirm_existing_art(v_c2, v_o2, 'integral');
  SELECT status INTO v_status FROM public.product_1_1_campaign_credit_operations WHERE campaign_id=v_c2 AND operation_id=v_o2;
  IF v_status <> 'delivered' THEN RAISE EXCEPTION 'S2_FAIL status=%', v_status; END IF;
  RAISE NOTICE 'S2_PASS: arte integra => delivered (sem regenerar)';

  -- CENARIO 3: INCONCLUSIVO (claim in_progress) ⇒ resolucao AUTORIZADA/auditada
  PERFORM public.product_1_1_reserve_credit_operation(v_store, v_c3, v_o3, 1, '{}'::jsonb);
  PERFORM public.product_1_1_acquire_attempt_start(v_c3, v_o3, 'primary', 1);
  -- 3a: caminho AUTOMATICO deve RECUSAR (fail-closed)
  BEGIN
    PERFORM public.product_1_1_close_failed_operation(v_c3, v_o3, 'absent', 0, 'd13-proof-x');
    RAISE EXCEPTION 'S3_FAIL: automatico NAO recusou inconclusivo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'operation_in_progress' THEN RAISE; END IF;
  END;
  -- 3b: caminho AUTORIZADO/auditado (marca explicita authorized_abandon)
  SELECT state_epoch INTO v_epoch FROM public.product_1_1_campaign_credit_operations WHERE campaign_id=v_c3 AND operation_id=v_o3;
  v_res := public.admin_resolve_product_1_1_pending(
    v_actor, v_c3, v_o3, 'refund_once', 'd13-proof-inconclusivo', gen_random_uuid(),
    jsonb_build_object('origin','server-derived','art_kind','absent','execution_ended',false,
                       'authorized_abandon','true','state_epoch',v_epoch::text));
  SELECT status INTO v_status FROM public.product_1_1_campaign_credit_operations WHERE campaign_id=v_c3 AND operation_id=v_o3;
  IF v_status <> 'refunded' THEN RAISE EXCEPTION 'S3_FAIL status=%', v_status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_audit_log WHERE target_id=v_c3 AND action='product_1_1_pending_resolution') THEN
    RAISE EXCEPTION 'S3_FAIL: sem auditoria';
  END IF;
  RAISE NOTICE 'S3_PASS: inconclusivo => refunded + auditoria';

  RAISE NOTICE 'D13_LOCAL_PROOF: PASS';
END $$;

ROLLBACK;
