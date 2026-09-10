-- Migration F37.2 M2/M3: RPCs do fluxo corretivo (Correção Única por Não Conformidade)
--   begin_campaign_correction_submission      (lifecycle da tentativa)
--   complete_campaign_correction_analysis     (conclusão da análise: estado/lease/vigência)
--   consume_campaign_correction_opportunity   (consumo atômico da oportunidade única)
--   complete_campaign_correction_v2           (conclusão atômica da v2 + superseded)
--   fail_campaign_correction_v2               (falha pós-provider atômica)
--   recover_campaign_correction_generation    (recuperação preguiçosa pós-consumo)
--   approve_campaign_candidate                (aprovação protegida; chama a RPC F37.1 intacta)
--
-- Locks uniformes candidata -> campanha -> relato (anti-deadlock; aprovação nunca toca o relato).
-- NÃO reutilizar/alterar as RPCs dormentes de 20260905000001_f37_2_correction_rpcs.sql
-- nem a RPC F37.1 approve_campaign_art_version (sem CREATE OR REPLACE sobre ela).
--
-- Nota (decisão do usuário 2026-09-10): complete_campaign_correction_v2 NÃO recebe p_mime_type —
-- a arte final é sempre JPEG (path fixo {storeId}/{campaignId}/v2.jpg) e o mimeType vive em
-- render_snapshot; não há coluna mime_type em campaign_art_versions.
--
-- Segurança: SECURITY DEFINER + SET search_path = '' + identificadores schema-qualified;
-- REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role.

-- =============================================================================
-- 1. begin_campaign_correction_submission — cria/localiza relato + nova tentativa
-- =============================================================================
CREATE OR REPLACE FUNCTION public.begin_campaign_correction_submission(
  p_campaign_id uuid,
  p_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate_id uuid;
  v_store_id uuid;
  v_status text;
  v_approval_status text;
  v_approved_version_id uuid;
  v_rejection_count smallint;
  v_operation_run_id uuid;
  v_report_id uuid;
  v_report_status text;
  v_report_version_id uuid;
  v_window_count int;
  v_attempt_number smallint;
  v_submission_id uuid;
  v_expires timestamptz;
BEGIN
  IF p_campaign_id IS NULL OR p_text IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  -- 1. Lock da candidata v1 (pending/active)
  SELECT id
    INTO v_candidate_id
    FROM public.campaign_art_versions
   WHERE campaign_id = p_campaign_id
     AND version_number = 1
     AND status = 'pending'
     AND asset_status = 'active'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_candidate';
  END IF;

  -- 2. Lock da campanha
  SELECT store_id, status, approval_status, approved_version_id, rejection_count, operation_run_id
    INTO v_store_id, v_status, v_approval_status, v_approved_version_id, v_rejection_count, v_operation_run_id
    FROM public.campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  -- 3. Valida pendência (fecha a corrida com a aprovação)
  IF v_status <> 'ready'
     OR v_approval_status <> 'pending_approval'
     OR v_approved_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'campaign_not_pending';
  END IF;

  IF v_rejection_count <> 0
     OR EXISTS (
       SELECT 1 FROM public.campaign_art_versions
        WHERE campaign_id = p_campaign_id
          AND version_number = 2
     ) THEN
    RAISE EXCEPTION 'already_consumed';
  END IF;

  -- 4. Cria (ou localiza) o relato pai
  INSERT INTO public.campaign_correction_reports (
    campaign_id, store_id, reported_version_id, status, operation_run_id
  ) VALUES (
    p_campaign_id, v_store_id, v_candidate_id, 'open', v_operation_run_id
  )
  ON CONFLICT (campaign_id) DO NOTHING
  RETURNING id INTO v_report_id;

  IF v_report_id IS NULL THEN
    SELECT id
      INTO v_report_id
      FROM public.campaign_correction_reports
     WHERE campaign_id = p_campaign_id;
  END IF;

  -- 5. Trava o relato e finaliza tentativas analyzing expiradas
  SELECT status, reported_version_id
    INTO v_report_status, v_report_version_id
    FROM public.campaign_correction_reports
   WHERE id = v_report_id
   FOR UPDATE;

  UPDATE public.campaign_correction_submissions
     SET analysis_state = 'analysis_failed',
         completed_at = now()
   WHERE report_id = v_report_id
     AND analysis_state = 'analyzing'
     AND analysis_expires_at < now();

  -- 6. Recusa análise simultânea ainda válida
  IF EXISTS (
    SELECT 1 FROM public.campaign_correction_submissions
     WHERE report_id = v_report_id
       AND analysis_state = 'analyzing'
  ) THEN
    RAISE EXCEPTION 'analysis_in_progress';
  END IF;

  -- 7. Caso já consumido (independe da janela)
  IF v_report_status IN ('generation_started','v2_generated','failed_no_v2') THEN
    RAISE EXCEPTION 'already_consumed';
  END IF;

  -- 8. Rate limit: no máximo 3 tentativas em 30 min (teto absoluto)
  SELECT count(*)
    INTO v_window_count
    FROM public.campaign_correction_submissions
   WHERE report_id = v_report_id
     AND created_at >= now() - interval '30 minutes';

  IF v_window_count >= 3 THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;

  -- 9. Atribui attempt_number sob o lock do relato
  SELECT COALESCE(MAX(attempt_number), 0) + 1
    INTO v_attempt_number
    FROM public.campaign_correction_submissions
   WHERE report_id = v_report_id;

  -- 10. Insere a tentativa analyzing
  INSERT INTO public.campaign_correction_submissions (
    report_id, attempt_number, text, analysis_state, analysis_expires_at
  ) VALUES (
    v_report_id, v_attempt_number, p_text, 'analyzing', now() + interval '2 minutes'
  )
  RETURNING id, analysis_expires_at INTO v_submission_id, v_expires;

  RETURN jsonb_build_object(
    'report_id', v_report_id,
    'submission_id', v_submission_id,
    'attempt_number', v_attempt_number,
    'analysis_expires_at', v_expires
  );
END;
$$;

-- =============================================================================
-- 2. complete_campaign_correction_analysis — conclusão com estado/lease/vigência
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_campaign_correction_analysis(
  p_report_id uuid,
  p_submission_id uuid,
  p_attempt_number smallint,
  p_analysis_state text,
  p_category text,
  p_normalized_instruction text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state text;
  v_expires timestamptz;
  v_attempt smallint;
  v_max_attempt smallint;
  v_eligible_categories text[] := ARRAY[
    'truncated_element',
    'illegible_text',
    'data_mismatch',
    'invented_information',
    'duplicated_element',
    'deformed_product',
    'blocking_composition'
  ];
BEGIN
  IF p_report_id IS NULL OR p_submission_id IS NULL OR p_attempt_number IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  -- Validação semântica do estado final (nunca analyzing)
  IF p_analysis_state NOT IN ('eligible','blocked','unclear','analysis_failed') THEN
    RAISE EXCEPTION 'invalid_analysis_state';
  END IF;

  IF p_analysis_state = 'eligible' THEN
    IF p_category IS NULL
       OR NOT (p_category = ANY (v_eligible_categories))
       OR p_normalized_instruction IS NULL
       OR btrim(p_normalized_instruction) = '' THEN
      RAISE EXCEPTION 'eligible_requires_category_and_instruction';
    END IF;
  ELSE
    IF p_category IS NOT NULL OR p_normalized_instruction IS NOT NULL THEN
      RAISE EXCEPTION 'non_eligible_must_not_have_generation_fields';
    END IF;
  END IF;

  -- Trava a tentativa e valida estado/lease
  SELECT analysis_state, analysis_expires_at, attempt_number
    INTO v_state, v_expires, v_attempt
    FROM public.campaign_correction_submissions
   WHERE id = p_submission_id
     AND report_id = p_report_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_analyzing';
  END IF;

  IF v_attempt <> p_attempt_number THEN
    RAISE EXCEPTION 'submission_stale';
  END IF;

  IF v_state <> 'analyzing' THEN
    RAISE EXCEPTION 'submission_not_analyzing';
  END IF;

  IF v_expires < now() THEN
    RAISE EXCEPTION 'analysis_lease_expired';
  END IF;

  SELECT MAX(attempt_number)
    INTO v_max_attempt
    FROM public.campaign_correction_submissions
   WHERE report_id = p_report_id;

  IF v_attempt <> v_max_attempt THEN
    RAISE EXCEPTION 'submission_stale';
  END IF;

  -- Guarded update (estado + lease + vigência)
  UPDATE public.campaign_correction_submissions
     SET analysis_state = p_analysis_state,
         category = CASE WHEN p_analysis_state = 'eligible' THEN p_category ELSE NULL END,
         normalized_instruction = CASE WHEN p_analysis_state = 'eligible' THEN p_normalized_instruction ELSE NULL END,
         completed_at = now()
   WHERE id = p_submission_id
     AND report_id = p_report_id
     AND attempt_number = p_attempt_number
     AND analysis_state = 'analyzing'
     AND analysis_expires_at >= now()
     AND attempt_number = (
       SELECT MAX(attempt_number)
         FROM public.campaign_correction_submissions
        WHERE report_id = p_report_id
     );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_stale';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'attempt_number', p_attempt_number,
    'analysis_state', p_analysis_state
  );
END;
$$;

-- =============================================================================
-- 3. consume_campaign_correction_opportunity — consumo atômico
-- =============================================================================
CREATE OR REPLACE FUNCTION public.consume_campaign_correction_opportunity(
  p_campaign_id uuid,
  p_report_id uuid,
  p_submission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate_id uuid;
  v_status text;
  v_approval_status text;
  v_approved_version_id uuid;
  v_rejection_count smallint;
  v_report_campaign_id uuid;
  v_report_status text;
  v_report_version_id uuid;
  v_sub_state text;
  v_sub_attempt smallint;
  v_max_attempt smallint;
BEGIN
  IF p_campaign_id IS NULL OR p_report_id IS NULL OR p_submission_id IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  -- 1. Lock da candidata
  SELECT id
    INTO v_candidate_id
    FROM public.campaign_art_versions
   WHERE campaign_id = p_campaign_id
     AND status = 'pending'
     AND asset_status = 'active'
   ORDER BY version_number
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_candidate';
  END IF;

  -- 2. Lock da campanha
  SELECT status, approval_status, approved_version_id, rejection_count
    INTO v_status, v_approval_status, v_approved_version_id, v_rejection_count
    FROM public.campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  -- 3. Lock do relato
  SELECT campaign_id, status, reported_version_id
    INTO v_report_campaign_id, v_report_status, v_report_version_id
    FROM public.campaign_correction_reports
   WHERE id = p_report_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report_campaign_mismatch';
  END IF;

  IF v_report_campaign_id <> p_campaign_id THEN
    RAISE EXCEPTION 'report_campaign_mismatch';
  END IF;

  -- 4. Valida pendência
  IF v_status <> 'ready'
     OR v_approval_status <> 'pending_approval'
     OR v_approved_version_id IS NOT NULL
     OR v_rejection_count <> 0 THEN
    RAISE EXCEPTION 'campaign_not_pending';
  END IF;

  IF v_report_status <> 'open' THEN
    RAISE EXCEPTION 'report_not_open';
  END IF;

  IF v_report_version_id <> v_candidate_id THEN
    RAISE EXCEPTION 'version_mismatch';
  END IF;

  -- 5. Submissão vigente eligible e mais recente
  SELECT analysis_state, attempt_number
    INTO v_sub_state, v_sub_attempt
    FROM public.campaign_correction_submissions
   WHERE id = p_submission_id
     AND report_id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_eligible';
  END IF;

  IF v_sub_state <> 'eligible' THEN
    RAISE EXCEPTION 'submission_not_eligible';
  END IF;

  SELECT MAX(attempt_number)
    INTO v_max_attempt
    FROM public.campaign_correction_submissions
   WHERE report_id = p_report_id;

  IF v_sub_attempt <> v_max_attempt THEN
    RAISE EXCEPTION 'submission_stale';
  END IF;

  -- 6. Grava o consumo atomicamente
  UPDATE public.campaigns
     SET rejection_count = 1
   WHERE id = p_campaign_id;

  UPDATE public.campaign_art_versions
     SET correction_in_progress = true
   WHERE id = v_candidate_id;

  UPDATE public.campaign_correction_reports
     SET status = 'generation_started',
         generation_started_at = now(),
         updated_at = now()
   WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', p_campaign_id,
    'report_id', p_report_id,
    'submission_id', p_submission_id
  );
END;
$$;

-- =============================================================================
-- 4. complete_campaign_correction_v2 — conclusão atômica (contrato fechado)
--    Sem p_mime_type: JPEG v2.jpg implícito (mime em render_snapshot).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_campaign_correction_v2(
  p_campaign_id uuid,
  p_report_id uuid,
  p_submission_id uuid,
  p_storage_path text,
  p_generation_metadata jsonb,
  p_render_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_v1_id uuid;
  v_v1_cip boolean;
  v_v1_storage text;
  v_v1_brief jsonb;
  v_rejection_count smallint;
  v_report_campaign_id uuid;
  v_report_status text;
  v_sub_attempt smallint;
  v_max_attempt smallint;
  v_v2_id uuid;
BEGIN
  IF p_campaign_id IS NULL OR p_report_id IS NULL OR p_submission_id IS NULL OR p_storage_path IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  -- 1. Lock da candidata (v1)
  SELECT id, correction_in_progress, storage_path, brief_snapshot
    INTO v_v1_id, v_v1_cip, v_v1_storage, v_v1_brief
    FROM public.campaign_art_versions
   WHERE campaign_id = p_campaign_id
     AND status = 'pending'
     AND asset_status = 'active'
   ORDER BY version_number
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_candidate';
  END IF;

  -- 2. Lock da campanha
  SELECT rejection_count
    INTO v_rejection_count
    FROM public.campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  -- 3. Lock do relato
  SELECT campaign_id, status
    INTO v_report_campaign_id, v_report_status
    FROM public.campaign_correction_reports
   WHERE id = p_report_id
   FOR UPDATE;

  IF NOT FOUND OR v_report_campaign_id <> p_campaign_id THEN
    RAISE EXCEPTION 'report_campaign_mismatch';
  END IF;

  IF v_report_status <> 'generation_started' OR NOT v_v1_cip THEN
    RAISE EXCEPTION 'report_not_generation_started';
  END IF;

  IF v_rejection_count <> 1 THEN
    RAISE EXCEPTION 'already_consumed';
  END IF;

  -- Submissão mais recente por attempt_number
  SELECT attempt_number
    INTO v_sub_attempt
    FROM public.campaign_correction_submissions
   WHERE id = p_submission_id
     AND report_id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_stale';
  END IF;

  SELECT MAX(attempt_number)
    INTO v_max_attempt
    FROM public.campaign_correction_submissions
   WHERE report_id = p_report_id;

  IF v_sub_attempt <> v_max_attempt THEN
    RAISE EXCEPTION 'submission_stale';
  END IF;

  -- Ausência de v2 (sem dupla conclusão)
  IF EXISTS (
    SELECT 1 FROM public.campaign_art_versions
     WHERE campaign_id = p_campaign_id
       AND version_number = 2
  ) THEN
    RAISE EXCEPTION 'already_consumed';
  END IF;

  -- Path distinto da v1
  IF v_v1_storage IS NOT NULL AND p_storage_path = v_v1_storage THEN
    RAISE EXCEPTION 'version_mismatch';
  END IF;

  -- 4. Insere a v2 (brief_snapshot copiado da v1 travada — nunca do cliente)
  INSERT INTO public.campaign_art_versions (
    campaign_id, version_number, status, asset_status, storage_path,
    brief_snapshot, render_snapshot, generation_metadata, correction_in_progress
  ) VALUES (
    p_campaign_id, 2, 'pending', 'active', p_storage_path,
    v_v1_brief, p_render_snapshot, p_generation_metadata, false
  )
  RETURNING id INTO v_v2_id;

  -- 5. Demove a v1 para superseded (path preservado)
  UPDATE public.campaign_art_versions
     SET asset_status = 'superseded',
         correction_in_progress = false
   WHERE id = v_v1_id;

  -- 6. Relato → v2_generated (sem incrementar rejection_count)
  UPDATE public.campaign_correction_reports
     SET status = 'v2_generated',
         generated_version_id = v_v2_id,
         updated_at = now()
   WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', p_campaign_id,
    'report_id', p_report_id,
    'version_id', v_v2_id,
    'version_number', 2
  );
END;
$$;

-- =============================================================================
-- 5. fail_campaign_correction_v2 — falha pós-provider atômica
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fail_campaign_correction_v2(
  p_campaign_id uuid,
  p_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate_id uuid;
  v_cip boolean;
  v_report_campaign_id uuid;
  v_report_status text;
BEGIN
  IF p_campaign_id IS NULL OR p_report_id IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  SELECT id, correction_in_progress
    INTO v_candidate_id, v_cip
    FROM public.campaign_art_versions
   WHERE campaign_id = p_campaign_id
     AND status = 'pending'
     AND asset_status = 'active'
   ORDER BY version_number
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_candidate';
  END IF;

  PERFORM 1
    FROM public.campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  SELECT campaign_id, status
    INTO v_report_campaign_id, v_report_status
    FROM public.campaign_correction_reports
   WHERE id = p_report_id
   FOR UPDATE;

  IF NOT FOUND OR v_report_campaign_id <> p_campaign_id THEN
    RAISE EXCEPTION 'report_campaign_mismatch';
  END IF;

  IF v_report_status <> 'generation_started' OR NOT v_cip THEN
    RAISE EXCEPTION 'report_not_generation_started';
  END IF;

  -- Mantém rejection_count = 1 (oportunidade já consumida)
  UPDATE public.campaign_art_versions
     SET correction_in_progress = false
   WHERE id = v_candidate_id;

  UPDATE public.campaign_correction_reports
     SET status = 'failed_no_v2',
         updated_at = now()
   WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'status', 'failed_no_v2');
END;
$$;

-- =============================================================================
-- 6. recover_campaign_correction_generation — recuperação preguiçosa (sem env)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recover_campaign_correction_generation(
  p_campaign_id uuid,
  p_stale_before timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate_id uuid;
  v_cip boolean;
  v_report_id uuid;
  v_report_status text;
  v_generation_started_at timestamptz;
  v_threshold timestamptz;
BEGIN
  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  SELECT id, correction_in_progress
    INTO v_candidate_id, v_cip
    FROM public.campaign_art_versions
   WHERE campaign_id = p_campaign_id
     AND status = 'pending'
     AND asset_status = 'active'
   ORDER BY version_number
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('recovered', false);
  END IF;

  PERFORM 1
    FROM public.campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('recovered', false);
  END IF;

  SELECT id, status, generation_started_at
    INTO v_report_id, v_report_status, v_generation_started_at
    FROM public.campaign_correction_reports
   WHERE campaign_id = p_campaign_id
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('recovered', false);
  END IF;

  IF v_report_status <> 'generation_started' OR NOT v_cip THEN
    RETURN jsonb_build_object('recovered', false);
  END IF;

  -- Teto: parâmetro do backend OU default normativo fixo (SQL não lê env)
  v_threshold := COALESCE(p_stale_before, now() - interval '330 seconds');

  IF v_generation_started_at IS NULL OR v_generation_started_at >= v_threshold THEN
    RETURN jsonb_build_object('recovered', false);
  END IF;

  -- Reverte o consumo (mantém rejection_count = 1)
  UPDATE public.campaign_art_versions
     SET correction_in_progress = false
   WHERE id = v_candidate_id;

  UPDATE public.campaign_correction_reports
     SET status = 'failed_no_v2',
         updated_at = now()
   WHERE id = v_report_id;

  RETURN jsonb_build_object('recovered', true, 'report_id', v_report_id);
END;
$$;

-- =============================================================================
-- 7. approve_campaign_candidate — aprovação protegida (chama a RPC F37.1 intacta)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_campaign_candidate(
  p_campaign_id uuid,
  p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_asset_status text;
  v_campaign_id uuid;
  v_cip boolean;
BEGIN
  IF p_campaign_id IS NULL OR p_version_id IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  -- Trava a candidata primeiro
  SELECT status, asset_status, campaign_id, correction_in_progress
    INTO v_status, v_asset_status, v_campaign_id, v_cip
    FROM public.campaign_art_versions
   WHERE id = p_version_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'version_not_found';
  END IF;

  IF v_campaign_id <> p_campaign_id THEN
    RAISE EXCEPTION 'version_campaign_mismatch';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'version_not_pending';
  END IF;

  IF v_asset_status <> 'active' THEN
    RAISE EXCEPTION 'version_not_active';
  END IF;

  IF v_cip THEN
    RAISE EXCEPTION 'correction_in_progress';
  END IF;

  -- RPC F37.1 intacta na MESMA transação (sem CREATE OR REPLACE sobre ela)
  RETURN public.approve_campaign_art_version(p_campaign_id, p_version_id);
END;
$$;

-- =============================================================================
-- REVOKE / GRANT — execução apenas via service_role
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.begin_campaign_correction_submission(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_campaign_correction_submission(uuid, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_campaign_correction_analysis(uuid, uuid, smallint, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_campaign_correction_analysis(uuid, uuid, smallint, text, text, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.consume_campaign_correction_opportunity(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_campaign_correction_opportunity(uuid, uuid, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_campaign_correction_v2(uuid, uuid, uuid, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_campaign_correction_v2(uuid, uuid, uuid, text, jsonb, jsonb)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.fail_campaign_correction_v2(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_campaign_correction_v2(uuid, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.recover_campaign_correction_generation(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_campaign_correction_generation(uuid, timestamptz)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.approve_campaign_candidate(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_campaign_candidate(uuid, uuid)
  TO service_role;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.approve_campaign_candidate(uuid, uuid) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.recover_campaign_correction_generation(uuid, timestamptz) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.fail_campaign_correction_v2(uuid, uuid) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.complete_campaign_correction_v2(uuid, uuid, uuid, text, jsonb, jsonb) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.consume_campaign_correction_opportunity(uuid, uuid, uuid) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.complete_campaign_correction_analysis(uuid, uuid, smallint, text, text, text) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.begin_campaign_correction_submission(uuid, text) FROM service_role;
-- DROP FUNCTION IF EXISTS public.approve_campaign_candidate(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.recover_campaign_correction_generation(uuid, timestamptz);
-- DROP FUNCTION IF EXISTS public.fail_campaign_correction_v2(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.complete_campaign_correction_v2(uuid, uuid, uuid, text, jsonb, jsonb);
-- DROP FUNCTION IF EXISTS public.consume_campaign_correction_opportunity(uuid, uuid, uuid);
-- DROP FUNCTION IF EXISTS public.complete_campaign_correction_analysis(uuid, uuid, smallint, text, text, text);
-- DROP FUNCTION IF EXISTS public.begin_campaign_correction_submission(uuid, text);
