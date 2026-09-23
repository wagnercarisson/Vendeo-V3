-- F50: atomically enforce the closed-beta limit during admin approval.
-- The lock serializes only approval decisions, not rejections.

CREATE OR REPLACE FUNCTION public.admin_review_access_request(
  p_request_id UUID,
  p_action TEXT,
  p_actor_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
  v_email TEXT;
  v_new_status TEXT;
  v_audit_action TEXT;
  v_reason TEXT;
  v_approved_email_count INTEGER;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT status, email INTO v_status, v_email
  FROM public.access_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  IF p_action = 'approve' THEN
    -- Serialize the check with every other approval in this transaction.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('vendeo.access_requests.approval_limit', 0)
    );

    -- Re-read after the lock so two approvals of the same request cannot both
    -- pass the pre-lock pending check.
    SELECT status, email INTO v_status, v_email
    FROM public.access_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'request_not_found';
    END IF;

    IF v_status <> 'pending' THEN
      RAISE EXCEPTION 'already_reviewed';
    END IF;

    SELECT COUNT(DISTINCT pg_catalog.lower(email))::INTEGER
      INTO v_approved_email_count
    FROM public.access_requests
    WHERE status = 'approved';

    IF v_approved_email_count >= 50 THEN
      RAISE EXCEPTION 'access_limit_reached';
    END IF;

    v_new_status := 'approved';
    v_audit_action := 'access_request_approve';
    v_reason := COALESCE(p_notes, 'Aprovado via admin');
  ELSE
    v_new_status := 'rejected';
    v_audit_action := 'access_request_reject';
    v_reason := COALESCE(p_notes, 'Recusado via admin');
  END IF;

  UPDATE public.access_requests
  SET status = v_new_status,
      reviewed_at = now(),
      reviewed_by = p_actor_id,
      notes = COALESCE(p_notes, notes)
  WHERE id = p_request_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, metadata)
  VALUES (
    p_actor_id,
    v_audit_action,
    'access_request',
    p_request_id,
    v_reason,
    jsonb_build_object('email', v_email, 'action', p_action)
  );

  RETURN jsonb_build_object('success', true, 'status', v_new_status, 'email', v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_access_request(UUID, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_access_request(UUID, TEXT, UUID, TEXT)
  TO service_role;
