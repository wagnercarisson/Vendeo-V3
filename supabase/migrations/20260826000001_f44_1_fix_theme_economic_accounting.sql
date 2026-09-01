-- F44.1 corrective migration: theme delivery markers and economic accounting.
-- Idempotent: only replaces the six objects listed below; historical migrations stay intact.

-- 1. Reconciliation view ------------------------------------------------------
CREATE OR REPLACE VIEW public.admin_cost_vs_credits AS
WITH call_level AS (
  SELECT ge.operation_run_id, ge.operation_run_type, ge.store_id, ge.user_id,
    ge.campaign_id, ge.visual_signature_id, ge.theme_id, ge.generation_type,
    ge.attempt_number, COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd) AS accounting_cost_usd
  FROM public.generation_events ge
  WHERE ge.operation_run_id IS NOT NULL
    AND ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo','theme_generation')
), stage_costs AS (
  SELECT operation_run_id, generation_type, SUM(accounting_cost_usd) AS stage_cost_usd
  FROM call_level GROUP BY operation_run_id, generation_type
), top_stages AS (
  SELECT operation_run_id, array_agg(generation_type ORDER BY stage_cost_usd DESC) AS etapas_mais_caras
  FROM stage_costs GROUP BY operation_run_id
), campaign_runs AS (
  SELECT operation_run_id, store_id, user_id, campaign_id, SUM(accounting_cost_usd) AS custo_usd_total,
    GREATEST(COALESCE(MAX(attempt_number) FILTER (WHERE generation_type IN ('campaign_image','campaign_image_review')),0)-1,0) AS regeneracoes
  FROM call_level WHERE campaign_id IS NOT NULL GROUP BY operation_run_id, store_id, user_id, campaign_id
), campaign_credits AS (
  SELECT campaign_id, SUM(ABS(amount)) AS creditos_debitados FROM public.credit_transactions
  WHERE type='deduction' AND campaign_id IS NOT NULL AND metadata->>'feature'='campaign_pipeline' GROUP BY campaign_id
), vs_runs AS (
  SELECT operation_run_id, store_id, user_id, visual_signature_id, SUM(accounting_cost_usd) AS custo_usd_total,
    GREATEST(COALESCE(MAX(attempt_number) FILTER (WHERE generation_type IN ('visual_signature_image','visual_signature_validation')),0)-1,0) AS regeneracoes
  FROM call_level WHERE visual_signature_id IS NOT NULL GROUP BY operation_run_id, store_id, user_id, visual_signature_id
), vs_credits AS (
  SELECT svs.id AS visual_signature_id, SUM(ABS(ct.amount)) AS creditos_debitados
  FROM public.store_visual_signatures svs JOIN public.credit_transactions ct ON ct.id::text=svs.metadata->>'credit_tx_id'
  WHERE ct.type='deduction' GROUP BY svs.id
), theme_runs AS (
  SELECT operation_run_id, store_id, user_id, SUM(accounting_cost_usd) AS custo_usd_total,
    GREATEST(COALESCE(MAX(attempt_number),0)-1,0) AS regeneracoes
  FROM call_level WHERE operation_run_type='theme' GROUP BY operation_run_id, store_id, user_id
), theme_credits AS (
  SELECT t.operation_run_id, SUM(ABS(ct.amount)) AS creditos_debitados
  FROM theme_runs t JOIN public.theme_generation_requests r ON r.operation_run_id=t.operation_run_id
  JOIN public.credit_transactions ct ON ct.type='deduction' AND (
    (r.debit_transaction_id IS NOT NULL AND ct.id=r.debit_transaction_id) OR
    (r.debit_transaction_id IS NULL AND ct.idempotency_key='theme_generation:'||r.store_id::text||':'||r.generation_request_id::text))
  GROUP BY t.operation_run_id
)
SELECT cr.operation_run_id,'campaign'::text AS domain,cr.store_id,cr.user_id,cr.campaign_id,NULL::uuid AS visual_signature_id,
  cr.custo_usd_total,COALESCE(cc.creditos_debitados,0) AS creditos_debitados,NULL::numeric AS receita_estimada_usd,NULL::numeric AS margem_estimada,ts.etapas_mais_caras,cr.regeneracoes
FROM campaign_runs cr LEFT JOIN campaign_credits cc USING(campaign_id) LEFT JOIN top_stages ts USING(operation_run_id)
UNION ALL
SELECT vr.operation_run_id,'visual_signature'::text,vr.store_id,vr.user_id,NULL::uuid,vr.visual_signature_id,vr.custo_usd_total,
  COALESCE(vc.creditos_debitados,0) AS creditos_debitados,NULL::numeric AS receita_estimada_usd,NULL::numeric AS margem_estimada,ts.etapas_mais_caras,vr.regeneracoes
FROM vs_runs vr LEFT JOIN vs_credits vc USING(visual_signature_id) LEFT JOIN top_stages ts USING(operation_run_id)
UNION ALL
SELECT tr.operation_run_id,'theme'::text,tr.store_id,tr.user_id,NULL::uuid,NULL::uuid,tr.custo_usd_total,
  COALESCE(tc.creditos_debitados,0) AS creditos_debitados,NULL::numeric AS receita_estimada_usd,NULL::numeric AS margem_estimada,ts.etapas_mais_caras,tr.regeneracoes
FROM theme_runs tr LEFT JOIN theme_credits tc USING(operation_run_id) LEFT JOIN top_stages ts USING(operation_run_id);
REVOKE ALL ON TABLE public.admin_cost_vs_credits FROM anon, authenticated;

-- 2. Operation-run list -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_ai_operation_runs(
 p_period_start timestamptz,p_period_end timestamptz,p_store_id uuid,p_run_type text,p_status text,
 p_provider text,p_model text,p_generation_type text,p_operation_run_id uuid,p_page integer,p_page_size integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_page integer:=GREATEST(COALESCE(p_page,1),1); v_size integer:=LEAST(GREATEST(COALESCE(p_page_size,25),1),100); v jsonb;
BEGIN
 IF p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND p_period_end-p_period_start>interval '365 days' THEN RAISE EXCEPTION 'window_exceeded_365d'; END IF;
 WITH call_level AS (
  SELECT ge.* ,COALESCE(ge.provider_reported_cost_usd,ge.estimated_cost_usd) AS accounting_cost_usd
  FROM public.generation_events ge WHERE ge.operation_run_id IS NOT NULL
   AND ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo','theme_generation')
   AND (p_period_start IS NULL OR ge.created_at>=p_period_start) AND (p_period_end IS NULL OR ge.created_at<=p_period_end)
   AND (p_store_id IS NULL OR ge.store_id=p_store_id) AND (p_run_type IS NULL OR ge.operation_run_type=p_run_type)
   AND (p_provider IS NULL OR ge.provider=p_provider) AND (p_model IS NULL OR ge.model=p_model)
   AND (p_generation_type IS NULL OR ge.generation_type=p_generation_type) AND (p_operation_run_id IS NULL OR ge.operation_run_id=p_operation_run_id)
 ), runs AS (
  SELECT cl.operation_run_id,(array_agg(cl.operation_run_type ORDER BY cl.created_at))[1] AS operation_run_type,
   (array_agg(cl.store_id ORDER BY cl.created_at) FILTER(WHERE cl.store_id IS NOT NULL))[1] AS store_id,
   (array_agg(cl.campaign_id ORDER BY cl.created_at) FILTER(WHERE cl.campaign_id IS NOT NULL))[1] AS campaign_id,
   (array_agg(cl.visual_signature_id ORDER BY cl.created_at) FILTER(WHERE cl.visual_signature_id IS NOT NULL))[1] AS visual_signature_id,
   MIN(cl.created_at) AS created_at,SUM(cl.accounting_cost_usd) AS custo_usd_total,SUM(cl.duration_ms) AS duracao_total_ms,
   COUNT(*) AS chamadas,COUNT(*) FILTER(WHERE cl.status='success') AS chamadas_success,
   array_agg(DISTINCT cl.generation_type) AS generation_types,array_agg(DISTINCT cl.cost_source) FILTER(WHERE cl.cost_source IS NOT NULL) AS cost_sources,
   (array_agg(cl.provider ORDER BY cl.created_at))[1] AS provider,(array_agg(cl.model ORDER BY cl.created_at))[1] AS model,
   (array_agg(cl.cost_source ORDER BY cl.created_at) FILTER(WHERE cl.cost_source IS NOT NULL))[1] AS cost_source,
   BOOL_OR(cl.cost_source IN('pricing_table','fallback_static')) AS has_estimated,
   (SELECT d.status FROM public.generation_events d WHERE d.operation_run_id=cl.operation_run_id AND d.generation_type IN('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo','theme_generation') ORDER BY d.created_at DESC LIMIT 1) AS delivery_status
  FROM call_level cl GROUP BY cl.operation_run_id
 ), filtered AS (
  SELECT r.*,COALESCE(vc.creditos_debitados,0) AS creditos_debitados,COALESCE(re.estornado,0) AS creditos_estornados,
   GREATEST(COALESCE(vc.creditos_debitados,0)-COALESCE(re.estornado,0),0) AS creditos_liquidos
  FROM runs r LEFT JOIN public.admin_cost_vs_credits vc USING(operation_run_id)
  LEFT JOIN (SELECT tr.operation_run_id,SUM(ABS(rf.amount)) AS estornado FROM public.theme_generation_requests tr
    JOIN public.credit_transactions ded ON ded.type='deduction' AND ((tr.debit_transaction_id IS NOT NULL AND ded.id=tr.debit_transaction_id) OR (tr.debit_transaction_id IS NULL AND ded.idempotency_key='theme_generation:'||tr.store_id::text||':'||tr.generation_request_id::text))
    JOIN public.credit_transactions rf ON rf.type='refund' AND rf.reference=ded.id::text GROUP BY tr.operation_run_id) re USING(operation_run_id)
  WHERE p_status IS NULL OR r.delivery_status=p_status
 ), summary AS (SELECT SUM(custo_usd_total) custo,SUM(creditos_debitados) bruto,SUM(creditos_estornados) estorno,SUM(creditos_liquidos) liquido,COUNT(*) total,COUNT(*) FILTER(WHERE delivery_status='success') sucessos,COUNT(*) FILTER(WHERE delivery_status='failed') erros FROM filtered)
 SELECT jsonb_build_object('runs',COALESCE((SELECT jsonb_agg(jsonb_build_object('operation_run_id',x.operation_run_id,'operation_run_type',x.operation_run_type,'store_id',x.store_id,'campaign_id',x.campaign_id,'visual_signature_id',x.visual_signature_id,'created_at',x.created_at,'delivery_status',x.delivery_status,'custo_usd_total',x.custo_usd_total,'creditos_debitados',x.creditos_debitados,'creditos_estornados',x.creditos_estornados,'creditos_liquidos',x.creditos_liquidos,'duracao_total_ms',x.duracao_total_ms,'chamadas',x.chamadas,'chamadas_success',x.chamadas_success,'regeneracoes',0,'provider',x.provider,'model',x.model,'cost_source',x.cost_source,'generation_types',x.generation_types,'cost_sources',x.cost_sources,'has_estimated',COALESCE(x.has_estimated,false)) ORDER BY x.created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT v_size OFFSET(v_page-1)*v_size)x),'[]'::jsonb),'summary',jsonb_build_object('custo_usd_total',(SELECT custo FROM summary),'creditos_debitados',(SELECT bruto FROM summary),'creditos_estornados',(SELECT estorno FROM summary),'creditos_liquidos',(SELECT liquido FROM summary),'total',(SELECT total FROM summary),'sucessos',(SELECT sucessos FROM summary),'erros',(SELECT erros FROM summary)),'page',v_page,'total',(SELECT total FROM summary)) INTO v;
 RETURN v; END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_ai_operation_runs(timestamptz,timestamptz,uuid,text,text,text,text,text,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_operation_runs(timestamptz,timestamptz,uuid,text,text,text,text,text,uuid,integer,integer) TO service_role;

-- 3. Detail, 4. legacy cost RPC ----------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_ai_operation_run_events(p_operation_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;
BEGIN
 WITH events AS (SELECT ge.* ,COALESCE(ge.provider_reported_cost_usd,ge.estimated_cost_usd) accounting_cost_usd FROM public.generation_events ge WHERE ge.operation_run_id=p_operation_run_id AND ge.generation_type NOT IN('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo','theme_generation')),
 agg AS (SELECT COUNT(*) chamadas,COUNT(*) FILTER(WHERE status='success') chamadas_success,SUM(accounting_cost_usd) custo_usd_total,SUM(duration_ms) duracao_total_ms,(SELECT d.status FROM public.generation_events d WHERE d.operation_run_id=p_operation_run_id AND d.generation_type IN('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo','theme_generation') ORDER BY d.created_at DESC LIMIT 1) delivery_status FROM events),
 credits AS (SELECT COALESCE((SELECT creditos_debitados FROM public.admin_cost_vs_credits WHERE operation_run_id=p_operation_run_id),0) bruto,COALESCE((SELECT SUM(ABS(rf.amount)) FROM public.theme_generation_requests tr JOIN public.credit_transactions ded ON ded.type='deduction' AND ((tr.debit_transaction_id IS NOT NULL AND ded.id=tr.debit_transaction_id) OR (tr.debit_transaction_id IS NULL AND ded.idempotency_key='theme_generation:'||tr.store_id::text||':'||tr.generation_request_id::text)) JOIN public.credit_transactions rf ON rf.type='refund' AND rf.reference=ded.id::text WHERE tr.operation_run_id=p_operation_run_id),0) estorno)
 SELECT jsonb_build_object('run',CASE WHEN (SELECT chamadas FROM agg)=0 THEN NULL ELSE jsonb_build_object('operation_run_id',p_operation_run_id,'delivery_status',(SELECT delivery_status FROM agg),'custo_usd_total',(SELECT custo_usd_total FROM agg),'creditos_debitados',(SELECT bruto FROM credits),'creditos_estornados',(SELECT estorno FROM credits),'creditos_liquidos',GREATEST((SELECT bruto FROM credits)-(SELECT estorno FROM credits),0),'duracao_total_ms',(SELECT duracao_total_ms FROM agg),'chamadas',(SELECT chamadas FROM agg),'chamadas_success',(SELECT chamadas_success FROM agg)) END,'events',COALESCE((SELECT jsonb_agg(to_jsonb(e)-'id'-'operation_run_id'-'operation_run_type'-'store_id'-'user_id'-'campaign_id'-'visual_signature_id'-'theme_id'-'accounting_cost_usd' ORDER BY e.created_at) FROM events e),'[]'::jsonb)) INTO v; RETURN v; END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_ai_operation_run_events(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_operation_run_events(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_ai_costs(
  p_operation_run_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_store_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_generation_type TEXT DEFAULT NULL,
  p_hours INTEGER DEFAULT 24,
  p_credit_unit_usd_value NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF p_hours IS NULL OR p_hours < 1 THEN
    RAISE EXCEPTION 'ai_costs_hours_min';
  END IF;

  v_cutoff := NOW() - (p_hours || ' hours')::INTERVAL;

  WITH filtered_ge AS (
    SELECT ge.operation_run_id, ge.operation_run_type, ge.store_id, ge.user_id,
      ge.campaign_id, ge.visual_signature_id, ge.provider, ge.model,
      ge.generation_type, ge.status, ge.duration_ms, ge.attempt_number,
      COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd) AS accounting_cost_usd
    FROM public.generation_events ge
    WHERE ge.created_at >= v_cutoff
      AND (p_operation_run_id IS NULL OR ge.operation_run_id = p_operation_run_id)
      AND (p_campaign_id IS NULL OR ge.campaign_id = p_campaign_id)
      AND (p_store_id IS NULL OR ge.store_id = p_store_id)
      AND (p_user_id IS NULL OR ge.user_id = p_user_id)
      AND (p_provider IS NULL OR ge.provider = p_provider)
      AND (p_model IS NULL OR ge.model = p_model)
      AND (p_generation_type IS NULL OR ge.generation_type = p_generation_type)
      AND ge.generation_type NOT IN (
        'campaign_pipeline', 'visual_signature', 'brand_profile_without_logo',
        -- theme_direction is a billable call; only the zero-cost delivery marker
        -- theme_generation is excluded from call-level accounting.
        'brand_profile_with_logo', 'theme_generation'
      )
  ), by_operation_run AS (
    SELECT ge.operation_run_id, ge.operation_run_type,
      SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas,
      COUNT(*) FILTER (WHERE ge.status = 'success') AS n_success,
      SUM(ge.duration_ms) AS duracao_total_ms,
      GREATEST(COALESCE(MAX(ge.attempt_number) FILTER (WHERE ge.generation_type IN (
        'campaign_image', 'campaign_image_review', 'visual_signature_image',
        'visual_signature_validation'
      )), 0) - 1, 0) AS regeneracoes
    FROM filtered_ge ge
    WHERE ge.operation_run_id IS NOT NULL
    GROUP BY ge.operation_run_id, ge.operation_run_type
  ), by_store AS (
    SELECT ge.store_id, SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas
    FROM filtered_ge ge
    WHERE ge.store_id IS NOT NULL
    GROUP BY ge.store_id
  ), by_provider_model AS (
    SELECT ge.provider, ge.model, SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas, AVG(ge.duration_ms) AS duracao_media_ms
    FROM filtered_ge ge
    GROUP BY ge.provider, ge.model
  ), by_generation_type AS (
    SELECT ge.generation_type, SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas
    FROM filtered_ge ge
    GROUP BY ge.generation_type
  ), reconciliation AS (
    SELECT vc.operation_run_id, vc.domain, vc.store_id, vc.campaign_id,
      vc.custo_usd_total, vc.creditos_debitados,
      CASE WHEN p_credit_unit_usd_value IS NULL THEN NULL
        ELSE COALESCE(vc.creditos_debitados, 0) * p_credit_unit_usd_value END AS receita_estimada_usd,
      CASE WHEN p_credit_unit_usd_value IS NULL THEN NULL
        ELSE COALESCE(vc.creditos_debitados, 0) * p_credit_unit_usd_value - vc.custo_usd_total END AS margem_estimada,
      vc.etapas_mais_caras, vc.regeneracoes
    FROM public.admin_cost_vs_credits vc
    WHERE (p_operation_run_id IS NULL OR vc.operation_run_id = p_operation_run_id)
      AND (p_campaign_id IS NULL OR vc.campaign_id = p_campaign_id)
      AND (p_store_id IS NULL OR vc.store_id = p_store_id)
      AND (p_operation_run_id IS NOT NULL OR vc.operation_run_id IN (
        SELECT DISTINCT ge.operation_run_id FROM filtered_ge ge
        WHERE ge.operation_run_id IS NOT NULL
      ))
  )
  SELECT jsonb_build_object(
    'by_operation_run', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'operation_run_id', bo.operation_run_id, 'operation_run_type', bo.operation_run_type,
      'custo_usd_total', bo.custo_usd_total, 'chamadas', bo.n_chamadas,
      'chamadas_success', bo.n_success, 'duracao_total_ms', bo.duracao_total_ms,
      'regeneracoes', bo.regeneracoes
    )) FROM by_operation_run bo), '[]'::jsonb),
    'by_store', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'store_id', bs.store_id, 'custo_usd_total', bs.custo_usd_total,
      'chamadas', bs.n_chamadas
    )) FROM by_store bs), '[]'::jsonb),
    'by_provider_model', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'provider', bpm.provider, 'model', bpm.model,
      'custo_usd_total', bpm.custo_usd_total, 'chamadas', bpm.n_chamadas,
      'duracao_media_ms', bpm.duracao_media_ms
    )) FROM by_provider_model bpm), '[]'::jsonb),
    'by_generation_type', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'generation_type', bgt.generation_type, 'custo_usd_total', bgt.custo_usd_total,
      'chamadas', bgt.n_chamadas
    )) FROM by_generation_type bgt), '[]'::jsonb),
    'reconciliation', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'operation_run_id', rc.operation_run_id, 'domain', rc.domain,
      'custo_usd_total', rc.custo_usd_total, 'creditos_debitados', rc.creditos_debitados,
      'receita_estimada_usd', rc.receita_estimada_usd, 'margem_estimada', rc.margem_estimada,
      'credit_unit_usd_value', p_credit_unit_usd_value, 'etapas_mais_caras', rc.etapas_mais_caras,
      'regeneracoes', rc.regeneracoes
    )) FROM reconciliation rc), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_ai_costs(uuid,uuid,uuid,uuid,text,text,text,integer,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_costs(uuid,uuid,uuid,uuid,text,text,text,integer,numeric) TO service_role;

-- 5/6. Failure and expiry are CAS + durable debit resolution + idempotent refund.
CREATE OR REPLACE FUNCTION public.fail_theme_generation(p_store_id uuid,p_generation_request_id uuid,p_error_code text,p_http_status int,p_error_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.theme_generation_requests; d uuid; f uuid; BEGIN SELECT * INTO r FROM public.theme_generation_requests WHERE store_id=p_store_id AND generation_request_id=p_generation_request_id AND status='processing' FOR UPDATE; IF NOT FOUND THEN RETURN jsonb_build_object('failed',false,'already_resolved',true); END IF; SELECT COALESCE(r.debit_transaction_id,ct.id) INTO d FROM public.credit_transactions ct WHERE ct.type='deduction' AND ((r.debit_transaction_id IS NOT NULL AND ct.id=r.debit_transaction_id) OR (r.debit_transaction_id IS NULL AND ct.idempotency_key='theme_generation:'||p_store_id::text||':'||p_generation_request_id::text)) LIMIT 1; UPDATE public.theme_generation_requests SET status='failed',operation_run_id=COALESCE(operation_run_id,r.operation_run_id),debit_transaction_id=d,error_code=p_error_code,http_status=p_http_status,error_metadata=p_error_metadata,updated_at=now() WHERE id=r.id; IF d IS NOT NULL THEN f=public.refund_credit(d,'theme_generation_failed','refund:theme_generation:'||p_store_id::text||':'||p_generation_request_id::text,jsonb_build_object('generation_request_id',p_generation_request_id,'error_code',p_error_code)); END IF; RETURN jsonb_build_object('failed',true,'refund_tx_id',f); END; $$;
CREATE OR REPLACE FUNCTION public.reconcile_expired_theme_request(p_store_id uuid,p_generation_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.theme_generation_requests; d uuid; f uuid; BEGIN SELECT * INTO r FROM public.theme_generation_requests WHERE store_id=p_store_id AND generation_request_id=p_generation_request_id AND status='processing' AND processing_expires_at<=now() FOR UPDATE; IF NOT FOUND THEN RETURN jsonb_build_object('reconciled',false,'already_resolved',true); END IF; SELECT COALESCE(r.debit_transaction_id,ct.id) INTO d FROM public.credit_transactions ct WHERE ct.type='deduction' AND ((r.debit_transaction_id IS NOT NULL AND ct.id=r.debit_transaction_id) OR (r.debit_transaction_id IS NULL AND ct.idempotency_key='theme_generation:'||p_store_id::text||':'||p_generation_request_id::text)) LIMIT 1; UPDATE public.theme_generation_requests SET status='failed',operation_run_id=COALESCE(operation_run_id,r.operation_run_id),debit_transaction_id=d,error_code='processing_abandoned',http_status=410,error_metadata=jsonb_build_object('reason','processing_expired'),updated_at=now() WHERE id=r.id; IF d IS NOT NULL THEN f=public.refund_credit(d,'theme_generation_processing_abandoned','refund:theme_generation:'||p_store_id::text||':'||p_generation_request_id::text,jsonb_build_object('generation_request_id',p_generation_request_id)); END IF; RETURN jsonb_build_object('reconciled',true,'refund_tx_id',f); END; $$;
REVOKE EXECUTE ON FUNCTION public.fail_theme_generation(uuid,uuid,text,int,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_expired_theme_request(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fail_theme_generation(uuid,uuid,text,int,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_theme_request(uuid,uuid) TO service_role;

-- REVERT (reverse order; intentionally commented)
-- DROP/restore the six objects from 20260825000001, 20260813000001, 20260812000002 and 20260809000002 in reverse order.
