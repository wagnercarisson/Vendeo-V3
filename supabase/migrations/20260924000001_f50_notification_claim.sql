CREATE OR REPLACE FUNCTION public.claim_credit_notification(
  p_now TIMESTAMPTZ,
  p_lease_expires_at TIMESTAMPTZ
)
RETURNS SETOF public.credit_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed public.credit_notifications;
BEGIN
  SELECT n.* INTO claimed
  FROM public.credit_notifications AS n
  WHERE n.email_status IN ('pending', 'processing')
    AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= p_now)
    AND (n.lease_expires_at IS NULL OR n.lease_expires_at <= p_now)
    AND n.attempt_count < 3
  ORDER BY n.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  claimed.email_status := 'processing';
  claimed.lease_expires_at := p_lease_expires_at;
  claimed.attempt_count := claimed.attempt_count + 1;
  UPDATE public.credit_notifications AS n
  SET email_status = claimed.email_status,
      lease_expires_at = claimed.lease_expires_at,
      attempt_count = claimed.attempt_count
  WHERE n.id = claimed.id;

  RETURN NEXT claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_credit_notification(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_credit_notification(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
