ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
  'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
  'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
  'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update',
  'data_subject_request_received', 'data_subject_request_in_progress',
  'data_subject_request_completed', 'data_subject_request_cancelled',
  'data_subject_request_cancel_rejected'
));
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
  target_type IN ('store', 'user', 'campaign', 'access_request', 'feature_flag', 'ai_model_selection', 'support_credit_request', 'data_subject_request')
);
