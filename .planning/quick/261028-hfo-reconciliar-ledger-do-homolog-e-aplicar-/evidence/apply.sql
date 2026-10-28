\set ON_ERROR_STOP on

-- =============================================================================
-- Quick 261028-hfo -- homolog only
-- 1) Reconcile ledger F47.1 version (no SQL re-execution)
-- 2) beta_access_invite (file as-is)
-- 3) Compensating restore of admin_audit_log_action_check (27 values)
-- 4) f50_3_cnpj_alfanumerico (file as-is)
-- 5) Ledger inserts
-- 6) Structural assertions (any divergence -> exception -> rollback)
-- =============================================================================

-- 1. Reconciliacao LOCAL da F47.1 (sem reexecutar SQL)
UPDATE supabase_migrations.schema_migrations
   SET version = '20261024141422'
 WHERE version = '20261021000001'
   AND name = 'f47_1_visual_signature_model_config';

DO $recon$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                  WHERE version = '20261024141422'
                    AND name = 'f47_1_visual_signature_model_config') THEN
    RAISE EXCEPTION 'reconciliation_failed';
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261021000001') THEN
    RAISE EXCEPTION 'reconciliation_left_old_version';
  END IF;
END;
$recon$;

-- 2. beta_access_invite (arquivo integral, sem edicao)
\i /tmp/20261020000005.sql

-- 3. Compensacao: restaura a lista de 27 actions vigente antes desta quick
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
  'product_1_1_pending_resolution',
  'access_request_invite',
  'visual_signature_model_config_update',
  'visual_signature_model_config_reset',
  'visual_signature_model_config_publish',
  'visual_signature_model_config_activation'
));

-- 4. f50_3 (arquivo integral, sem edicao)
\i /tmp/20261021000001.sql

-- 5. Registro no ledger
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20261020000005', 'beta_access_invite'),
  ('20261021000001', 'f50_3_cnpj_alfanumerico');

-- 6. Assercoes estruturais DENTRO da transacao (antes do commit)
DO $final$
DECLARE
  v_total INT;
  v_distinct INT;
  v_cols INT;
  v_audit_def TEXT;
  v_audit_expected TEXT := $expected$CHECK ((action = ANY (ARRAY['credit_grant'::text, 'credit_adjustment'::text, 'store_create_invite'::text, 'manual_refund'::text, 'approve_verification'::text, 'reject_verification'::text, 'create_test_store'::text, 'admin_exception'::text, 'reveal_cnpj'::text, 'access_request_approve'::text, 'access_request_reject'::text, 'feature_flag_update'::text, 'ai_model_selection_update'::text, 'ai_model_selection_reset'::text, 'support_credit_request_update'::text, 'data_subject_request_received'::text, 'data_subject_request_in_progress'::text, 'data_subject_request_completed'::text, 'data_subject_request_cancelled'::text, 'data_subject_request_cancel_rejected'::text, 'image_model_pair_config_update'::text, 'product_1_1_pending_resolution'::text, 'access_request_invite'::text, 'visual_signature_model_config_update'::text, 'visual_signature_model_config_reset'::text, 'visual_signature_model_config_publish'::text, 'visual_signature_model_config_activation'::text])))$expected$;
  v_cnpj_def TEXT;
  v_cnpj_validated BOOLEAN;
BEGIN
  -- 6.1 Ledger: 149 versoes, todas distintas
  SELECT count(*), count(DISTINCT version) INTO v_total, v_distinct
    FROM supabase_migrations.schema_migrations;
  IF v_total <> 149 OR v_distinct <> 149 THEN
    RAISE EXCEPTION 'ledger_final_invalid total=% distinct=%', v_total, v_distinct;
  END IF;

  -- 6.2 Versoes esperadas
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                  WHERE version='20261024141422' AND name='f47_1_visual_signature_model_config') THEN
    RAISE EXCEPTION 'f47_1_version_missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                  WHERE version='20261020000005' AND name='beta_access_invite') THEN
    RAISE EXCEPTION 'beta_access_invite_ledger_missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                  WHERE version='20261021000001' AND name='f50_3_cnpj_alfanumerico') THEN
    RAISE EXCEPTION 'f50_3_ledger_missing';
  END IF;

  -- 6.3 F57.2 deve continuar ausente e nao registrada
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261028145738') THEN
    RAISE EXCEPTION 'f57_2_must_not_be_registered';
  END IF;
  IF to_regclass('public.user_preferences') IS NOT NULL
     OR to_regclass('public.store_market_settings') IS NOT NULL THEN
    RAISE EXCEPTION 'f57_2_tables_must_not_exist';
  END IF;

  -- 6.4 Dez colunas de convite presentes
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='access_requests'
     AND column_name IN ('invite_status','invite_sent_at','invite_last_attempt_at','invite_attempts',
                         'invite_error','invite_provider_message_id','invite_locked_until',
                         'invite_attempt_token','invited_user_id','password_set_at');
  IF v_cols <> 10 THEN
    RAISE EXCEPTION 'invite_columns_missing found=%', v_cols;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.access_requests'::regclass
                    AND conname='chk_access_requests_invite_status'
                    AND convalidated) THEN
    RAISE EXCEPTION 'invite_status_constraint_invalid';
  END IF;

  -- 6.5 Constraint de auditoria IDENTICA a capturada no preflight (27 acoes)
  SELECT pg_get_constraintdef(oid) INTO v_audit_def
    FROM pg_constraint
   WHERE conrelid='public.admin_audit_log'::regclass
     AND conname='admin_audit_log_action_check';
  IF v_audit_def IS DISTINCT FROM v_audit_expected THEN
    RAISE EXCEPTION 'audit_action_check_diverged: %', v_audit_def;
  END IF;

  -- 6.6 CNPJ alfanumerico aceito e constraint validada
  SELECT pg_get_constraintdef(oid), convalidated INTO v_cnpj_def, v_cnpj_validated
    FROM pg_constraint
   WHERE conrelid='public.stores'::regclass
     AND conname='chk_stores_cnpj_atomic';
  IF v_cnpj_def IS NULL OR v_cnpj_def NOT LIKE '%[A-Z0-9]{12}[0-9]{2}%' THEN
    RAISE EXCEPTION 'cnpj_constraint_not_alphanumeric: %', v_cnpj_def;
  END IF;
  IF v_cnpj_validated IS NOT TRUE THEN
    RAISE EXCEPTION 'cnpj_constraint_not_validated';
  END IF;
  IF 'ABC12345678901' !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN
    RAISE EXCEPTION 'cnpj_alphanumeric_regex_rejected';
  END IF;
END;
$final$;
