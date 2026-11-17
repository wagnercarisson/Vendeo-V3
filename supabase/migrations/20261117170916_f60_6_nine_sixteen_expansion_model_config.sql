-- F60.6 / Plano 60.6-01 — Configuracao administrativa da expansao 9:16
--
-- LOCAL-ONLY / NAO APLICADA: este arquivo e apenas AUTORADO nesta etapa. NAO
-- executar `supabase db push`, `migration up`, reset ou qualquer mutacao remota
-- sem autorizacao explicita. A aplicacao em ambiente autorizado e um gate
-- separado e NAO foi executada.
--
-- Escopo (D1/D2/D3/D4/D9.5):
--   1. Tabela singleton `nine_sixteen_expansion_model_config` (scope 'expansion').
--   2. RLS service-only, SELECT-only (escrita exclusiva pela RPC) e provisionamento idempotente Sunburst low.
--   3. RPC auditada `admin_set_nine_sixteen_expansion_model_config`: ator
--      revalidado em `admin_users`, motivo, `operationId`, idempotencia estrita
--      por CONTEUDO (mesmo conteudo = replay; conteudo divergente = conflito sem
--      gravacao/versao/auditoria).
--   4. CHECKs de `admin_audit_log` reenumerados a partir da uniao vigente
--      (autoridade: supabase/migrations/20261024141452_f47_2_visual_signature_release_state.sql,
--      L763-788) acrescentando a acao/target da expansao.
--   5. Congelamento da selecao em `product_9_16_two_stage_operations` (colunas,
--      CHECK de contract_version 1|2, CHECK cruzado, trigger de imutabilidade) e
--      RPC `product_9_16_open_operation_v2` com paridade de leitura/trava/criacao
--      de steps da v1 e envelope explicito de doze chaves. A v1 fica intacta.
--   6. Rollback operacional NAO destrutivo (bloco comentado no final).
--
-- Superficie de ESCRITA (auditavel estaticamente): apenas
-- `nine_sixteen_expansion_model_config`, `product_9_16_two_stage_operations`,
-- `product_9_16_two_stage_steps` (somente o INSERT de paridade dos dois steps) e
-- `admin_audit_log`. Leituras/travas de `product_1_1_campaign_credit_operations`
-- (`FOR UPDATE`), de `product_9_16_two_stage_steps` e de `ai_model_catalog`
-- (linha ativa) sao obrigatorias para manter a paridade com a v1.

-- =============================================================================
-- 1. Tabela singleton da configuracao da expansao
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.nine_sixteen_expansion_model_config (
  scope             TEXT PRIMARY KEY DEFAULT 'expansion',
  model             TEXT NOT NULL,
  quality           TEXT NOT NULL,
  config_version_id UUID NOT NULL DEFAULT gen_random_uuid(),
  reason            TEXT,
  updated_by        UUID REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_nsec_scope CHECK (scope = 'expansion'),
  CONSTRAINT chk_nsec_model CHECK (model IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst')),
  CONSTRAINT chk_nsec_quality CHECK (quality IN ('low', 'medium'))
);

COMMENT ON TABLE public.nine_sixteen_expansion_model_config IS
  'F60.6 — selecao unica (modelo + qualidade) da expansao 9:16. Sem par principal/auxiliar, sem gpt-image-2 e sem DELETE (ausencia falha fechado).';

-- =============================================================================
-- 2. RLS service-only, SELECT-only para escrita exclusiva pela RPC
-- =============================================================================
ALTER TABLE public.nine_sixteen_expansion_model_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages nine sixteen expansion config"
  ON public.nine_sixteen_expansion_model_config;
CREATE POLICY "Service role reads nine sixteen expansion config"
  ON public.nine_sixteen_expansion_model_config FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.nine_sixteen_expansion_model_config FROM PUBLIC, anon, authenticated;
-- Escrita exclusivamente pela RPC SECURITY DEFINER; service_role nao recebe
-- INSERT/UPDATE/DELETE direto (inclusive se houver default privilege no ambiente).
REVOKE ALL ON TABLE public.nine_sixteen_expansion_model_config FROM service_role;
GRANT SELECT ON TABLE public.nine_sixteen_expansion_model_config TO service_role;

-- =============================================================================
-- 3. Provisionamento inicial explicito e idempotente (D4)
-- =============================================================================
-- `ON CONFLICT (scope) DO NOTHING` (e nao DO UPDATE) e o que preserva uma
-- escolha humana existente em uma reaplicacao da migration.
INSERT INTO public.nine_sixteen_expansion_model_config (
  scope, model, quality, config_version_id, reason, updated_by
) VALUES (
  'expansion', 'gpt-image-2.5-sunburst', 'low', gen_random_uuid(),
  'provisionamento inicial F60.6', NULL
)
ON CONFLICT (scope) DO NOTHING;

-- =============================================================================
-- 4. RPC administrativa auditada e idempotente por conteudo
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_nine_sixteen_expansion_model_config(
  p_actor_id     UUID,
  p_model        TEXT,
  p_quality      TEXT,
  p_reason       TEXT,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_metadata JSONB;
  v_existing_action   TEXT;
  v_existing_actor    UUID;
  v_existing_reason   TEXT;
  v_config_version_id UUID;
  v_result            JSONB;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;

  -- Ator nunca vem do corpo do navegador: revalidacao na autoridade existente
  -- ANTES de qualquer escrita ou auditoria (delta em relacao a F56.1).
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = p_actor_id
  ) THEN RAISE EXCEPTION 'actor_not_admin'; END IF;

  IF p_model IS NULL OR p_model NOT IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst') THEN
    RAISE EXCEPTION 'invalid_model';
  END IF;
  IF p_quality IS NULL OR p_quality NOT IN ('low', 'medium') THEN
    RAISE EXCEPTION 'invalid_quality';
  END IF;

  -- Serializa a decisao de idempotencia do MESMO operation_id antes de ler a
  -- auditoria. Duas chamadas concorrentes nao podem ambas observar ausencia e
  -- disputar o indice unico: a segunda espera e encontra o replay/conflito.
  PERFORM pg_advisory_xact_lock(
    hashtext('f60.6:nine_sixteen_expansion_model_config:' || p_operation_id::text)
  );

  -- Idempotencia ESTRITA por conteudo: mesmo operation_id + mesmo conteudo e
  -- replay; conteudo divergente e conflito SEM gravacao, SEM nova versao e SEM
  -- auditoria adicional. A consulta e SOMENTE por operation_id (sem filtrar
  -- action): um ID ja usado por outra acao vira conflito explicito, nunca 23505.
  SELECT metadata, action, actor_id, btrim(reason)
    INTO v_existing_metadata, v_existing_action, v_existing_actor, v_existing_reason
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_action IS DISTINCT FROM 'nine_sixteen_expansion_model_config_update'
       OR v_existing_actor IS DISTINCT FROM p_actor_id
       OR v_existing_reason IS DISTINCT FROM btrim(p_reason)
       OR v_existing_metadata ->> 'model' IS DISTINCT FROM btrim(p_model)
       OR v_existing_metadata ->> 'quality' IS DISTINCT FROM p_quality
       OR v_existing_metadata ->> 'reason' IS DISTINCT FROM btrim(p_reason)
    THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN COALESCE(v_existing_metadata, '{}'::jsonb)
      || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- Catalogo ativo da capability de imagem de campanha (mesma autoridade da F56.1).
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_model_catalog
    WHERE capability = 'campaign_product_image'
      AND provider = 'openai'
      AND model = btrim(p_model)
      AND protocol = 'images'
      AND status = 'active'
  ) THEN RAISE EXCEPTION 'model_not_in_catalog'; END IF;

  -- Upsert singleton renovando a versao e o autor da decisao humana.
  INSERT INTO public.nine_sixteen_expansion_model_config (
    scope, model, quality, config_version_id, reason, updated_by, updated_at
  ) VALUES (
    'expansion', btrim(p_model), p_quality, gen_random_uuid(), btrim(p_reason), p_actor_id, now()
  )
  ON CONFLICT (scope) DO UPDATE SET
    model = EXCLUDED.model,
    quality = EXCLUDED.quality,
    config_version_id = gen_random_uuid(),
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at
  RETURNING config_version_id INTO v_config_version_id;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'scope', 'expansion',
    'model', btrim(p_model),
    'quality', p_quality,
    'config_version_id', v_config_version_id,
    'reason', btrim(p_reason)
  );

  -- Auditoria na MESMA transacao.
  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id,
    'nine_sixteen_expansion_model_config_update',
    'nine_sixteen_expansion_model_config',
    v_config_version_id,
    btrim(p_reason),
    p_operation_id,
    v_result
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_nine_sixteen_expansion_model_config(UUID, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_nine_sixteen_expansion_model_config(UUID, TEXT, TEXT, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- 5. Auditoria — uniao vigente (20261024141452) + acao/target da expansao
-- =============================================================================
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
  'visual_signature_model_config_activation',
  'nine_sixteen_expansion_model_config_update'
));

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
  target_type IN (
    'store', 'user', 'campaign', 'access_request', 'feature_flag', 'ai_model_selection',
    'support_credit_request', 'data_subject_request', 'image_model_pair_config',
    'visual_signature_model_config',
    'nine_sixteen_expansion_model_config'
  )
);

-- =============================================================================
-- 6. Congelamento da selecao na linha da operacao (D3)
-- =============================================================================
ALTER TABLE public.product_9_16_two_stage_operations
  ADD COLUMN IF NOT EXISTS expansion_model TEXT,
  ADD COLUMN IF NOT EXISTS expansion_quality TEXT,
  ADD COLUMN IF NOT EXISTS expansion_config_version_id UUID,
  ADD COLUMN IF NOT EXISTS expansion_selection_origin TEXT;

ALTER TABLE public.product_9_16_two_stage_operations
  DROP CONSTRAINT IF EXISTS ck_p916_contract_version;
ALTER TABLE public.product_9_16_two_stage_operations
  ADD CONSTRAINT ck_p916_contract_version CHECK (contract_version IN (1, 2));

ALTER TABLE public.product_9_16_two_stage_operations
  DROP CONSTRAINT IF EXISTS ck_p916_expansion_selection;
ALTER TABLE public.product_9_16_two_stage_operations
  ADD CONSTRAINT ck_p916_expansion_selection CHECK (
    (contract_version = 1
      AND expansion_model IS NULL
      AND expansion_quality IS NULL
      AND expansion_config_version_id IS NULL
      AND expansion_selection_origin IS NULL)
    OR
    (contract_version = 2
      AND expansion_model IS NOT NULL
      AND expansion_model IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst')
      AND expansion_quality IS NOT NULL
      AND expansion_quality IN ('low', 'medium')
      AND expansion_config_version_id IS NOT NULL
      AND expansion_selection_origin IS NOT NULL
      AND expansion_selection_origin = 'configured')
  );

-- service_role permanece SOMENTE leitura na tabela de operacoes (sem caminho de
-- UPDATE/INSERT/DELETE direto): quem grava e a RPC SECURITY DEFINER.
REVOKE ALL ON TABLE public.product_9_16_two_stage_operations FROM service_role;
GRANT SELECT ON TABLE public.product_9_16_two_stage_operations TO service_role;

-- Imutabilidade dos campos congelados: bloqueia qualquer alteracao futura, mas
-- NAO bloqueia o UPDATE legitimo de `credit_operation_ref, updated_at` da abertura.
CREATE OR REPLACE FUNCTION public.trg_p916_expansion_selection_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.expansion_model IS DISTINCT FROM OLD.expansion_model
     OR NEW.expansion_quality IS DISTINCT FROM OLD.expansion_quality
     OR NEW.expansion_config_version_id IS DISTINCT FROM OLD.expansion_config_version_id
     OR NEW.expansion_selection_origin IS DISTINCT FROM OLD.expansion_selection_origin
     OR NEW.contract_version IS DISTINCT FROM OLD.contract_version
  THEN
    RAISE EXCEPTION 'product_9_16_expansion_selection_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p916_expansion_selection_immutable
  ON public.product_9_16_two_stage_operations;
CREATE TRIGGER trg_p916_expansion_selection_immutable
  BEFORE UPDATE ON public.product_9_16_two_stage_operations
  FOR EACH ROW EXECUTE FUNCTION public.trg_p916_expansion_selection_immutable_fn();

-- =============================================================================
-- 7. Abertura atomica de operacao com selecao congelada (v2)
-- =============================================================================
-- Paridade com a v1 (contrato de 60.6-03): trava a linha de credito FOR UPDATE
-- na mesma ordem, le e cria os dois steps base/expansion em 'pending', confere a
-- linha ativa do catalogo e reserva 1 credito na MESMA transacao. A v2 NAO recebe
-- ator (nao consulta admin_users) e NAO recria a v1.
CREATE OR REPLACE FUNCTION public.product_9_16_open_operation_v2(
  p_store_id                     UUID,
  p_campaign_id                  UUID,
  p_operation_id                 UUID,
  p_expansion_model              TEXT,
  p_expansion_quality            TEXT,
  p_expansion_config_version_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit          public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_op              public.product_9_16_two_stage_operations%ROWTYPE;
  v_reserve         JSONB;
  v_inserted_id     UUID;
  v_op_id           UUID;
  v_steps           JSONB;
  v_catalog_active  BOOLEAN;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  -- Selecao ausente/invalida e recusada antes de qualquer escrita.
  IF p_expansion_model IS NULL
     OR p_expansion_model NOT IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst') THEN
    RAISE EXCEPTION 'invalid_expansion_model';
  END IF;
  IF p_expansion_quality IS NULL OR p_expansion_quality NOT IN ('low', 'medium') THEN
    RAISE EXCEPTION 'invalid_expansion_quality';
  END IF;
  IF p_expansion_config_version_id IS NULL THEN
    RAISE EXCEPTION 'missing_expansion_config_version_id';
  END IF;

  -- Catalog: linha ativa da capability de imagem de campanha para o modelo escolhido.
  SELECT EXISTS (
    SELECT 1 FROM public.ai_model_catalog
    WHERE capability = 'campaign_product_image'
      AND provider = 'openai'
      AND model = p_expansion_model
      AND protocol = 'images'
      AND status = 'active'
  ) INTO v_catalog_active;
  IF NOT v_catalog_active THEN RAISE EXCEPTION 'model_not_in_catalog'; END IF;

  -- Mesma ordem de trava da v1: antes de qualquer escrita.
  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF FOUND THEN
    SELECT * INTO v_op
    FROM public.product_9_16_two_stage_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

    IF NOT FOUND THEN
      -- Jamais converter operacao antiga/legada em operacao nova.
      RETURN jsonb_build_object('success', false, 'reason', 'operation_origin_conflict');
    END IF;

    IF v_op.store_id <> p_store_id THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
    END IF;

    IF v_op.contract_version IS DISTINCT FROM 2 THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_origin_conflict');
    END IF;

    IF v_op.expansion_model IS DISTINCT FROM p_expansion_model
       OR v_op.expansion_quality IS DISTINCT FROM p_expansion_quality
       OR v_op.expansion_config_version_id IS DISTINCT FROM p_expansion_config_version_id
    THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_config_conflict');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'stage', s.stage, 'status', s.status, 'attempts_used', s.attempts_used,
             'failure_class', s.failure_class) ORDER BY s.stage), '[]'::jsonb)
    INTO v_steps
    FROM public.product_9_16_two_stage_steps s
    WHERE s.campaign_id = p_campaign_id AND s.operation_id = p_operation_id;

    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'status', v_credit.status,
      'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
      'origin', '9_16_two_stage', 'steps', v_steps,
      'contract_version', 2,
      'expansion_model', v_op.expansion_model,
      'expansion_quality', v_op.expansion_quality,
      'expansion_config_version_id', v_op.expansion_config_version_id,
      'expansion_selection_origin', v_op.expansion_selection_origin);
  END IF;

  -- Sem linha financeira: cria controle (com a selecao congelada) e reserva na
  -- MESMA transacao.
  INSERT INTO public.product_9_16_two_stage_operations (
    campaign_id, operation_id, store_id, credit_operation_ref, origin, contract_version,
    expansion_model, expansion_quality, expansion_config_version_id, expansion_selection_origin
  ) VALUES (
    p_campaign_id, p_operation_id, p_store_id, NULL, '9_16_two_stage', 2,
    p_expansion_model, p_expansion_quality, p_expansion_config_version_id, 'configured'
  )
  ON CONFLICT (campaign_id, operation_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- Corrida com outra abertura da mesma identidade: devolve a vencedora sem
    -- sobrescrever a selecao congelada.
    SELECT * INTO v_op
    FROM public.product_9_16_two_stage_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_in_progress');
    END IF;

    IF v_op.store_id <> p_store_id THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
    END IF;

    IF v_op.contract_version IS DISTINCT FROM 2 THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_origin_conflict');
    END IF;

    IF v_op.expansion_model IS DISTINCT FROM p_expansion_model
       OR v_op.expansion_quality IS DISTINCT FROM p_expansion_quality
       OR v_op.expansion_config_version_id IS DISTINCT FROM p_expansion_config_version_id
    THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_config_conflict');
    END IF;

    SELECT * INTO v_credit
    FROM public.product_1_1_campaign_credit_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'stage', s.stage, 'status', s.status, 'attempts_used', s.attempts_used,
             'failure_class', s.failure_class) ORDER BY s.stage), '[]'::jsonb)
    INTO v_steps
    FROM public.product_9_16_two_stage_steps s
    WHERE s.campaign_id = p_campaign_id AND s.operation_id = p_operation_id;

    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'status', v_credit.status,
      'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
      'origin', '9_16_two_stage', 'steps', v_steps,
      'contract_version', 2,
      'expansion_model', v_op.expansion_model,
      'expansion_quality', v_op.expansion_quality,
      'expansion_config_version_id', v_op.expansion_config_version_id,
      'expansion_selection_origin', v_op.expansion_selection_origin);
  END IF;

  -- Criacao de steps com paridade da v1: exatamente base/expansion em 'pending'.
  INSERT INTO public.product_9_16_two_stage_steps (campaign_id, operation_id, stage, status)
  VALUES
    (p_campaign_id, p_operation_id, 'base', 'pending'),
    (p_campaign_id, p_operation_id, 'expansion', 'pending')
  ON CONFLICT (campaign_id, operation_id, stage) DO NOTHING;

  v_reserve := public.product_1_1_reserve_credit_operation(
    p_store_id, p_campaign_id, p_operation_id, 1, '{}'::jsonb
  );

  IF v_reserve IS NULL OR (v_reserve->>'success') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'credit_reservation_failed';
  END IF;

  -- `idempotent: true` significa que a linha financeira ja existia: adotar seria
  -- converter operacao antiga. Aborta tudo.
  IF (v_reserve->>'idempotent') = 'true' THEN
    RAISE EXCEPTION 'operation_origin_conflict';
  END IF;

  SELECT id INTO v_op_id
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  UPDATE public.product_9_16_two_stage_operations
     SET credit_operation_ref = v_op_id, updated_at = now()
   WHERE id = v_inserted_id;

  -- Envelope lido das COLUNAS da linha vencedora (nunca dos parametros soltos).
  SELECT * INTO v_op
  FROM public.product_9_16_two_stage_operations
  WHERE id = v_inserted_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'stage', s.stage, 'status', s.status, 'attempts_used', s.attempts_used,
           'failure_class', s.failure_class) ORDER BY s.stage), '[]'::jsonb)
  INTO v_steps
  FROM public.product_9_16_two_stage_steps s
  WHERE s.campaign_id = p_campaign_id AND s.operation_id = p_operation_id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'status', COALESCE(v_reserve->>'status', 'reserved'),
    'campaign_id', p_campaign_id, 'operation_id', p_operation_id,
    'origin', '9_16_two_stage', 'steps', v_steps,
    'contract_version', 2,
    'expansion_model', v_op.expansion_model,
    'expansion_quality', v_op.expansion_quality,
    'expansion_config_version_id', v_op.expansion_config_version_id,
    'expansion_selection_origin', v_op.expansion_selection_origin);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.product_9_16_open_operation_v2(UUID, UUID, UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_9_16_open_operation_v2(UUID, UUID, UUID, TEXT, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- 8. ROLLBACK OPERACIONAL (nao destrutivo, nao executado)
-- =============================================================================
-- 1) suspender novas geracoes da expansao pelo mecanismo de flag/ativacao
--    existente, mediante autorizacao;
-- 2) manter a tabela de configuracao, as selecoes congeladas, as operacoes, as
--    reservas e a auditoria (nenhuma remocao estrutural faz parte deste rollback);
-- 3) manter o codigo compativel com operacoes contract_version = 2 ja abertas:
--    ele le a selecao congelada e conclui/estorna conforme a autoridade financeira
--    existente;
-- 4) qualquer remocao de schema e uma decisao separada e destrutiva, fora deste
--    rollback operacional.
