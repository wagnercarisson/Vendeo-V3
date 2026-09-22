CREATE OR REPLACE FUNCTION public.update_support_credit_request(
  p_actor_id UUID,
  p_request_id UUID,
  p_status TEXT,
  p_reconsider_eligible BOOLEAN,
  p_reason TEXT
) RETURNS public.support_credit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_current public.support_credit_requests;
  v_updated public.support_credit_requests;
BEGIN
  SELECT * INTO v_current FROM public.support_credit_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_request_not_found'; END IF;
  IF NOT ((v_current.status = 'received' AND p_status = 'forwarded')
       OR (v_current.status = 'forwarded' AND p_status IN ('responded','closed'))
       OR (v_current.status = 'responded' AND p_status = 'closed'))
    THEN RAISE EXCEPTION 'invalid_support_transition'; END IF;

  UPDATE public.support_credit_requests
     SET status = p_status,
         acknowledged_at = CASE WHEN p_status = 'forwarded' THEN now() ELSE acknowledged_at END,
         responded_at = CASE WHEN p_status = 'responded' THEN now() ELSE responded_at END,
         closed_at = CASE WHEN p_status = 'closed' THEN now() ELSE closed_at END
   WHERE id = p_request_id
   RETURNING * INTO v_updated;

  INSERT INTO public.admin_audit_log(actor_id, action, target_type, target_id, reason, metadata)
  VALUES (p_actor_id, 'support_credit_request_update', 'support_credit_request', p_request_id,
          p_reason, jsonb_build_object('status', p_status, 'reconsiderEligible', p_reconsider_eligible));
  RETURN v_updated;
END; $$;

REVOKE ALL ON FUNCTION public.update_support_credit_request(UUID, UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_support_credit_request(UUID, UUID, TEXT, BOOLEAN, TEXT) TO service_role;
