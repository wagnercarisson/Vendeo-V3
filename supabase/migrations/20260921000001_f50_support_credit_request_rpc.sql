CREATE OR REPLACE FUNCTION public.create_support_credit_request(
  p_operation_id UUID, p_store_id UUID, p_user_id UUID, p_requested_email TEXT,
  p_snapshot JSONB, p_support_email TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_existing RECORD; v_id UUID; v_protocol TEXT; v_received TIMESTAMPTZ := now();
BEGIN
  SELECT id, protocol, received_at INTO v_existing FROM public.support_credit_requests WHERE operation_id = p_operation_id;
  IF v_existing.id IS NOT NULL THEN RETURN jsonb_build_object('protocol', v_existing.protocol, 'received_at', v_existing.received_at); END IF;
  v_id := gen_random_uuid(); v_protocol := 'SUP-' || upper(substr(replace(v_id::text, '-', ''), 1, 10));
  INSERT INTO public.support_credit_requests (id, operation_id, protocol, store_id, user_id, requested_email, snapshot, received_at)
    VALUES (v_id, p_operation_id, v_protocol, p_store_id, p_user_id, p_requested_email, coalesce(p_snapshot, '{}'::jsonb), v_received);
  INSERT INTO public.credit_notifications (store_id, user_id, kind, dedup_key, payload)
    VALUES (p_store_id, p_user_id, 'support_ack', p_operation_id::text, jsonb_build_object('recipient_email', p_requested_email, 'protocol', v_protocol, 'subject', 'Solicitação recebida', 'text', 'Recebemos sua solicitação. Protocolo: ' || v_protocol));
  INSERT INTO public.credit_notifications (store_id, user_id, kind, dedup_key, payload)
    VALUES (p_store_id, p_user_id, 'support_notice', p_operation_id::text, coalesce(p_snapshot, '{}'::jsonb) || jsonb_build_object('recipient_email', p_support_email, 'protocol', v_protocol, 'subject', 'Nova solicitação de créditos', 'text', 'Nova solicitação de créditos. Protocolo: ' || v_protocol));
  RETURN jsonb_build_object('protocol', v_protocol, 'received_at', v_received);
END; $$;
REVOKE ALL ON FUNCTION public.create_support_credit_request(UUID, UUID, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_credit_request(UUID, UUID, UUID, TEXT, JSONB, TEXT) TO service_role;

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
  'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
  'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
  'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update'
));
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
  target_type IN ('store', 'user', 'campaign', 'access_request', 'feature_flag', 'ai_model_selection', 'support_credit_request')
);
