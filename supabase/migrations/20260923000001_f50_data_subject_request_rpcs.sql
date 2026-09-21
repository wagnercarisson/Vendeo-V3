CREATE OR REPLACE FUNCTION public.admin_register_data_subject_request(
  p_actor_id UUID, p_operation_id UUID, p_type TEXT, p_user_id UUID, p_store_id UUID,
  p_contact TEXT, p_details TEXT, p_deletion_inventory JSONB, p_legal_hold BOOLEAN
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.data_subject_requests%ROWTYPE; v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_row FROM public.data_subject_requests WHERE operation_id = p_operation_id FOR UPDATE;
  IF v_row.id IS NOT NULL THEN RETURN to_jsonb(v_row); END IF;
  INSERT INTO public.data_subject_requests
    (operation_id, protocol, type, user_id, store_id, contact, details, status, requested_at,
     acknowledged_at, closure_requested_at, deletion_due_at, deletion_inventory, legal_hold)
  VALUES
    (p_operation_id, 'DSR-' || to_char(v_now, 'YYYYMMDD') || '-' || upper(substr(replace(p_operation_id::text, '-', ''), 1, 8)),
     p_type, p_user_id, p_store_id, p_contact, p_details, 'received', v_now, v_now,
     CASE WHEN p_type = 'closure' THEN v_now END,
     CASE WHEN p_type = 'closure' THEN v_now + interval '30 days' END,
     coalesce(p_deletion_inventory, '{}'::jsonb), coalesce(p_legal_hold, false))
  RETURNING * INTO v_row;
  INSERT INTO public.admin_audit_log
    (actor_id, action, target_type, target_id, operation_id, reason, metadata)
  VALUES (p_actor_id, 'data_subject_request_received', 'data_subject_request', v_row.id,
    p_operation_id, 'Registro de pedido de titular', to_jsonb(v_row));
  RETURN to_jsonb(v_row);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_transition_data_subject_request(
  p_actor_id UUID, p_request_id UUID, p_operation_id UUID, p_next_status TEXT,
  p_deletion_inventory JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.data_subject_requests%ROWTYPE; v_now TIMESTAMPTZ := now(); v_action TEXT;
BEGIN
  SELECT * INTO v_row FROM public.data_subject_requests WHERE id = p_request_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'data_subject_request_not_found'; END IF;
  IF p_next_status = 'cancelled' AND v_row.status <> 'received' THEN
    INSERT INTO public.admin_audit_log
      (actor_id, action, target_type, target_id, operation_id, reason, metadata)
    VALUES (p_actor_id, 'data_subject_request_cancel_rejected', 'data_subject_request', v_row.id,
      p_operation_id, 'Cancelamento após início da exclusão',
      jsonb_build_object('operation_id', v_row.operation_id, 'protocol', v_row.protocol,
        'type', v_row.type, 'user_id', v_row.user_id, 'store_id', v_row.store_id,
        'contact', v_row.contact, 'details', v_row.details, 'deletion_inventory', v_row.deletion_inventory,
        'legal_hold', v_row.legal_hold, 'attempted_status', p_next_status));
    RETURN jsonb_build_object('rejected', true, 'request', to_jsonb(v_row));
  END IF;
  IF (p_next_status = 'in_progress' AND v_row.status <> 'received')
     OR (p_next_status = 'completed' AND v_row.status <> 'in_progress')
     OR p_next_status NOT IN ('in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_data_subject_request_transition';
  END IF;
  v_row.status := p_next_status;
  IF p_next_status = 'in_progress' AND v_row.type IN ('closure', 'deletion') THEN
    v_row.closure_requested_at := coalesce(v_row.closure_requested_at, v_now);
    v_row.deletion_due_at := coalesce(v_row.deletion_due_at, v_now + interval '30 days');
  ELSIF p_next_status = 'cancelled' THEN v_row.cancelled_at := v_now;
  ELSIF p_next_status = 'completed' THEN
    v_row.completed_at := v_now;
    v_row.deletion_inventory := coalesce(p_deletion_inventory, v_row.deletion_inventory);
  END IF;
  UPDATE public.data_subject_requests SET status = v_row.status, closure_requested_at = v_row.closure_requested_at,
    deletion_due_at = v_row.deletion_due_at, cancelled_at = v_row.cancelled_at,
    completed_at = v_row.completed_at, deletion_inventory = v_row.deletion_inventory WHERE id = v_row.id;
  v_action := 'data_subject_request_' || p_next_status;
  INSERT INTO public.admin_audit_log
    (actor_id, action, target_type, target_id, operation_id, reason, metadata)
  VALUES (p_actor_id, v_action, 'data_subject_request', v_row.id, p_operation_id,
    'Transição de ciclo de vida', to_jsonb(v_row));
  RETURN to_jsonb(v_row);
END; $$;

REVOKE ALL ON FUNCTION public.admin_register_data_subject_request(UUID, UUID, TEXT, UUID, UUID, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_transition_data_subject_request(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_register_data_subject_request(UUID, UUID, TEXT, UUID, UUID, TEXT, TEXT, JSONB, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_transition_data_subject_request(UUID, UUID, UUID, TEXT, JSONB) TO service_role;
