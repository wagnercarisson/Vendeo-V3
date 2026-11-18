-- F60.7 / Plano 60.7-02 — Subfatia A: fundação da entrega conjunta 1:1 + 9:16.
--
-- LOCAL-ONLY / AUTORADA E NAO APLICADA.
-- Forward-only. Proibido executar `supabase db push`, `supabase migration up`,
-- psql, Docker, reset ou qualquer mutação remota a partir desta autoria.
-- A aplicação real pertence ao Gate de banco futuro, com autorização separada,
-- posterior à Subfatia B.
--
-- Escopo:
--   1. Tabela de vínculo `public.product_two_format_deliveries`
--      (entrega de formato ↔ identidade financeira própria).
--   2. RLS habilitada e `service_role` apenas com SELECT; escrita exclusiva
--      pelas RPCs SECURITY DEFINER abaixo.
--   3. Quatro RPCs conjuntas: abertura atômica com as duas reservas de 1
--      crédito, entrega por formato com confirmação + projeção na mesma
--      transação, estorno por formato com evidência de ausência e reparo
--      idempotente de projeção.
--   4. Bloco comentado de rollback operacional não destrutivo (não executado).
--
-- Preservação obrigatória:
--   - `amount = 1` permanece intacto; cada formato usa uma linha financeira de
--     1 crédito (duas linhas por entrega completa), nunca uma linha de valor 2.
--   - Nenhuma RPC existente é redefinida; as autoridades financeiras e de
--     controle são apenas chamadas.
--   - Nenhuma tabela de artefatos, flag, pricing ou migration aplicada é
--     alterada. Sem backfill e sem conversão de dados.
--   - A única tabela existente escrita por estas RPCs é `public.campaigns`,
--     exclusivamente na projeção (`status`, `error_message`, `storage_path`).

-- =============================================================================
-- 1. Tabela de vínculo entrega ↔ formato ↔ operação financeira
-- =============================================================================

CREATE TABLE public.product_two_format_deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL,
  operation_id          UUID NOT NULL,
  store_id              UUID NOT NULL,
  format                TEXT NOT NULL,
  delivery_operation_id UUID NOT NULL,
  artifact_role         TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_p2f_format CHECK (format IN ('1:1', '9:16')),
  CONSTRAINT ck_p2f_role CHECK (artifact_role IN ('square_original', 'vertical')),
  CONSTRAINT ck_p2f_format_role CHECK (
    (format = '1:1' AND artifact_role = 'square_original')
    OR (format = '9:16' AND artifact_role = 'vertical')
  ),
  CONSTRAINT ck_p2f_identity CHECK (
    (format = '9:16' AND delivery_operation_id = operation_id)
    OR (format = '1:1' AND delivery_operation_id <> operation_id)
  ),
  CONSTRAINT uq_p2f_campaign_operation_format UNIQUE (campaign_id, operation_id, format),
  CONSTRAINT uq_p2f_delivery_operation UNIQUE (delivery_operation_id),
  CONSTRAINT fk_p2f_control_operation
    FOREIGN KEY (campaign_id, operation_id)
    REFERENCES public.product_9_16_two_stage_operations (campaign_id, operation_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_p2f_credit_operation
    FOREIGN KEY (campaign_id, delivery_operation_id)
    REFERENCES public.product_1_1_campaign_credit_operations (campaign_id, operation_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_p2f_campaign_id
  ON public.product_two_format_deliveries (campaign_id);

-- Ordem obrigatória na abertura: como `fk_p2f_credit_operation` exige a linha
-- financeira do quadrado, a RPC reserva o crédito do quadrado ANTES de inserir
-- o vínculo `1:1`. A transação única desfaz a reserva se qualquer passo
-- posterior falhar.

-- =============================================================================
-- 2. RLS e grants (service_role apenas SELECT; escrita só por RPC)
-- =============================================================================

ALTER TABLE public.product_two_format_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role reads two format deliveries"
  ON public.product_two_format_deliveries;
CREATE POLICY "Service role reads two format deliveries"
  ON public.product_two_format_deliveries FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.product_two_format_deliveries FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_two_format_deliveries FROM service_role;
GRANT SELECT ON TABLE public.product_two_format_deliveries TO service_role;

-- =============================================================================
-- 3. Projeção idempotente da campanha
-- =============================================================================
-- Ordem de locks: `campaigns ... FOR UPDATE` ANTES de ler vínculo, crédito ou
-- artefato. Entrega, estorno e reparo direto usam a mesma ordem, e um único
-- lock da campanha serializa projeções concorrentes.
CREATE OR REPLACE FUNCTION public.product_two_format_project_campaign(
  p_campaign_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id              UUID;
  v_status                TEXT;
  v_storage_path          TEXT;
  v_error_message         TEXT;
  v_operation_id          UUID;
  v_square_delivery_id    UUID;
  v_vertical_delivery_id  UUID;
  v_square_credit_status  TEXT;
  v_vertical_credit_status TEXT;
  v_square_path           TEXT;
  v_vertical_path         TEXT;
  v_square_ok             BOOLEAN := false;
  v_vertical_ok           BOOLEAN := false;
  v_desired_status        TEXT;
  v_desired_path          TEXT;
  v_desired_error         TEXT;
  v_preferred_format      TEXT;
  v_projected             BOOLEAN := false;
  v_already_projected     BOOLEAN := false;
BEGIN
  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'missing_campaign_id';
  END IF;

  -- Lock comum da campanha: primeira operação, antes de qualquer leitura de
  -- vínculo/crédito/artefato.
  SELECT store_id, status, storage_path, error_message
    INTO v_store_id, v_status, v_storage_path, v_error_message
    FROM public.campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'campaign_not_found');
  END IF;

  SELECT operation_id
    INTO v_operation_id
    FROM public.product_two_format_deliveries
   WHERE campaign_id = p_campaign_id
   ORDER BY format
   LIMIT 1;

  SELECT delivery_operation_id
    INTO v_square_delivery_id
    FROM public.product_two_format_deliveries
   WHERE campaign_id = p_campaign_id AND format = '1:1';

  SELECT delivery_operation_id
    INTO v_vertical_delivery_id
    FROM public.product_two_format_deliveries
   WHERE campaign_id = p_campaign_id AND format = '9:16';

  IF v_square_delivery_id IS NOT NULL THEN
    SELECT status
      INTO v_square_credit_status
      FROM public.product_1_1_campaign_credit_operations
     WHERE campaign_id = p_campaign_id AND operation_id = v_square_delivery_id;
  END IF;

  IF v_vertical_delivery_id IS NOT NULL THEN
    SELECT status
      INTO v_vertical_credit_status
      FROM public.product_1_1_campaign_credit_operations
     WHERE campaign_id = p_campaign_id AND operation_id = v_vertical_delivery_id;
  END IF;

  -- Quadrado tem preferência. Só conta como entregue quando crédito `delivered`
  -- E artefato canônico compatível (papel/formato/dimensão/MIME/path).
  IF v_square_delivery_id IS NOT NULL
     AND v_square_credit_status IS NOT DISTINCT FROM 'delivered' THEN
    v_square_path := lower(v_store_id::text) || '/' || lower(p_campaign_id::text)
      || '/' || lower(v_operation_id::text) || '/square_original.jpg';
    SELECT EXISTS (
      SELECT 1
        FROM public.campaign_composition_artifacts a
       WHERE a.campaign_id = p_campaign_id
         AND a.operation_id = v_operation_id
         AND a.role = 'square_original'
         AND a.format = '1:1'
         AND a.mime_type = 'image/jpeg'
         AND a.width = 1024
         AND a.height = 1024
         AND a.storage_path = v_square_path
    ) INTO v_square_ok;
  END IF;

  -- Fallback vertical, mesma regra de compatibilidade.
  IF v_vertical_delivery_id IS NOT NULL
     AND v_vertical_credit_status IS NOT DISTINCT FROM 'delivered' THEN
    v_vertical_path := lower(v_store_id::text) || '/' || lower(p_campaign_id::text)
      || '/' || lower(v_operation_id::text) || '/vertical.jpg';
    SELECT EXISTS (
      SELECT 1
        FROM public.campaign_composition_artifacts a
       WHERE a.campaign_id = p_campaign_id
         AND a.operation_id = v_operation_id
         AND a.role = 'vertical'
         AND a.format = '9:16'
         AND a.mime_type = 'image/jpeg'
         AND a.width = 1080
         AND a.height = 1920
         AND a.storage_path = v_vertical_path
    ) INTO v_vertical_ok;
  END IF;

  IF v_square_ok THEN
    v_desired_status := 'ready';
    v_desired_path := v_square_path;
    v_desired_error := NULL;
    v_preferred_format := '1:1';
  ELSIF v_vertical_ok THEN
    v_desired_status := 'ready';
    v_desired_path := v_vertical_path;
    v_desired_error := NULL;
    v_preferred_format := '9:16';
  ELSIF v_square_delivery_id IS NOT NULL
        AND v_vertical_delivery_id IS NOT NULL
        AND v_square_credit_status = 'refunded'
        AND v_vertical_credit_status = 'refunded'
        AND v_status IS DISTINCT FROM 'ready' THEN
    v_desired_status := 'error';
    v_desired_path := v_storage_path;
    v_desired_error := 'two_format_delivery_failed';
    v_preferred_format := NULL;
  ELSE
    -- Nenhum entregue, mas ainda há reserva/processamento (ou estado não
    -- terminal): mantém a campanha como está, sem rebaixar `ready`.
    v_desired_status := NULL;
  END IF;

  IF v_desired_status IS NULL THEN
    v_already_projected := true;
    v_projected := false;
  ELSIF v_status IS NOT DISTINCT FROM v_desired_status
        AND v_storage_path IS NOT DISTINCT FROM v_desired_path
        AND v_error_message IS NOT DISTINCT FROM v_desired_error THEN
    v_already_projected := true;
    v_projected := false;
  ELSE
    UPDATE public.campaigns
       SET status = v_desired_status,
           error_message = v_desired_error,
           storage_path = v_desired_path,
           updated_at = now()
     WHERE id = p_campaign_id;
    v_projected := true;
    v_already_projected := false;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', p_campaign_id,
    'projected', v_projected,
    'already_projected', v_already_projected,
    'campaign_status', COALESCE(v_desired_status, v_status),
    'storage_path', COALESCE(v_desired_path, v_storage_path),
    'preferred_format', v_preferred_format
  );
END;
$$;

-- =============================================================================
-- 4. Abertura conjunta idempotente (duas reservas de 1 crédito)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_two_format_open_delivery(
  p_store_id                     UUID,
  p_campaign_id                  UUID,
  p_operation_id                 UUID,
  p_square_delivery_id           UUID,
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
  v_input_snapshot         JSONB;
  v_link_11                UUID;
  v_link_916               UUID;
  v_contract_version       INTEGER;
  v_op_model               TEXT;
  v_op_quality             TEXT;
  v_op_config_version      UUID;
  v_op_origin              TEXT;
  v_square_status          TEXT;
  v_vertical_status        TEXT;
  v_steps                  JSONB;
  v_v2                     JSONB;
  v_reserve                JSONB;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_square_delivery_id IS NULL THEN RAISE EXCEPTION 'missing_square_delivery_id'; END IF;
  IF p_expansion_model IS NULL THEN RAISE EXCEPTION 'missing_expansion_model'; END IF;
  IF p_expansion_quality IS NULL THEN RAISE EXCEPTION 'missing_expansion_quality'; END IF;
  IF p_expansion_config_version_id IS NULL THEN
    RAISE EXCEPTION 'missing_expansion_config_version_id';
  END IF;
  IF p_square_delivery_id = p_operation_id THEN
    RAISE EXCEPTION 'delivery_identity_conflict';
  END IF;

  -- Ordem de locks: campanha primeiro; ausência ou loja divergente aborta
  -- antes de qualquer escrita.
  SELECT input_snapshot
    INTO v_input_snapshot
    FROM public.campaigns
   WHERE id = p_campaign_id AND store_id = p_store_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_store_mismatch';
  END IF;

  IF v_input_snapshot ->> 'campaignFormat' IS DISTINCT FROM '1:1+9:16'
     OR v_input_snapshot ->> 'formatContractVersion' IS DISTINCT FROM 'f60.7-two-format-v1'
     OR v_input_snapshot ->> 'generationOrigin' IS DISTINCT FROM 'two_format_two_stage'
     OR v_input_snapshot ->> 'generationContractVersion' IS DISTINCT FROM 'f60.7-two-format-v1' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'joint_contract_required');
  END IF;

  -- Serializa aberturas concorrentes da mesma identidade. Ordem:
  -- campanha → advisory da operação → locks específicos das autoridades.
  PERFORM pg_advisory_xact_lock(
    hashtext('p2f_open:' || p_campaign_id::text || ':' || p_operation_id::text)
  );

  SELECT delivery_operation_id
    INTO v_link_11
    FROM public.product_two_format_deliveries
   WHERE campaign_id = p_campaign_id
     AND operation_id = p_operation_id
     AND format = '1:1';

  SELECT delivery_operation_id
    INTO v_link_916
    FROM public.product_two_format_deliveries
   WHERE campaign_id = p_campaign_id
     AND operation_id = p_operation_id
     AND format = '9:16';

  -- Replay com os dois vínculos: compara a seleção recebida com a seleção
  -- CONGELADA da operação. Nunca lê catálogo/configuração vigente.
  IF v_link_11 IS NOT NULL AND v_link_916 IS NOT NULL THEN
    IF v_link_11 IS DISTINCT FROM p_square_delivery_id
       OR v_link_916 IS DISTINCT FROM p_operation_id THEN
      RAISE EXCEPTION 'delivery_identity_conflict';
    END IF;

    SELECT contract_version, expansion_model, expansion_quality,
           expansion_config_version_id, expansion_selection_origin
      INTO v_contract_version, v_op_model, v_op_quality,
           v_op_config_version, v_op_origin
      FROM public.product_9_16_two_stage_operations
     WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

    IF NOT FOUND
       OR v_contract_version IS DISTINCT FROM 2
       OR v_op_model IS DISTINCT FROM p_expansion_model
       OR v_op_quality IS DISTINCT FROM p_expansion_quality
       OR v_op_config_version IS DISTINCT FROM p_expansion_config_version_id
       OR v_op_origin IS DISTINCT FROM 'configured' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_config_conflict');
    END IF;

    SELECT status
      INTO v_square_status
      FROM public.product_1_1_campaign_credit_operations
     WHERE campaign_id = p_campaign_id AND operation_id = v_link_11;

    SELECT status
      INTO v_vertical_status
      FROM public.product_1_1_campaign_credit_operations
     WHERE campaign_id = p_campaign_id AND operation_id = v_link_916;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'stage', s.stage, 'status', s.status, 'attempts_used', s.attempts_used,
             'failure_class', s.failure_class) ORDER BY s.stage), '[]'::jsonb)
      INTO v_steps
      FROM public.product_9_16_two_stage_steps s
     WHERE s.campaign_id = p_campaign_id AND s.operation_id = p_operation_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'campaign_id', p_campaign_id,
      'operation_id', p_operation_id,
      'square_delivery_id', v_link_11,
      'vertical_delivery_operation_id', v_link_916,
      'contract_version', 'f60.7-two-format-v1',
      'expansion_model', v_op_model,
      'expansion_quality', v_op_quality,
      'expansion_config_version_id', v_op_config_version,
      'expansion_selection_origin', v_op_origin,
      'status', v_vertical_status,
      'square_status', v_square_status,
      'steps', v_steps
    );
  END IF;

  -- Vínculo parcial nunca é reparado silenciosamente.
  IF v_link_11 IS NOT NULL OR v_link_916 IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'delivery_link_incomplete');
  END IF;

  -- Caminho novo. A v2 cria controle + steps e reserva o vertical na MESMA
  -- transação; ela só devolve `success: false` antes de escrever.
  v_v2 := public.product_9_16_open_operation_v2(
    p_store_id,
    p_campaign_id,
    p_operation_id,
    p_expansion_model,
    p_expansion_quality,
    p_expansion_config_version_id
  );

  IF v_v2 IS NULL OR (v_v2 ->> 'success') IS DISTINCT FROM 'true' THEN
    RETURN COALESCE(v_v2, jsonb_build_object('success', false, 'reason', 'joint_open_failed'));
  END IF;

  -- `idempotent: true` sem os dois vínculos significa operação pré-existente
  -- de outra origem: NUNCA adotar. Aborta a transação inteira.
  IF (v_v2 ->> 'idempotent') = 'true' THEN
    RAISE EXCEPTION 'operation_origin_conflict';
  END IF;

  -- Reserva do quadrado: a FK composta exige a linha financeira antes do
  -- vínculo `1:1`. Qualquer falha posterior desfaz esta reserva junto.
  v_reserve := public.product_1_1_reserve_credit_operation(
    p_store_id,
    p_campaign_id,
    p_square_delivery_id,
    1,
    '{}'::jsonb
  );

  IF v_reserve IS NULL OR (v_reserve ->> 'success') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'square_credit_reservation_failed';
  END IF;

  IF (v_reserve ->> 'idempotent') = 'true' THEN
    RAISE EXCEPTION 'delivery_identity_conflict';
  END IF;

  INSERT INTO public.product_two_format_deliveries (
    campaign_id, operation_id, store_id, format, delivery_operation_id, artifact_role
  ) VALUES (
    p_campaign_id, p_operation_id, p_store_id, '9:16', p_operation_id, 'vertical'
  );

  INSERT INTO public.product_two_format_deliveries (
    campaign_id, operation_id, store_id, format, delivery_operation_id, artifact_role
  ) VALUES (
    p_campaign_id, p_operation_id, p_store_id, '1:1', p_square_delivery_id, 'square_original'
  );

  -- Envelope lido das colunas congeladas, nunca dos parâmetros soltos.
  SELECT expansion_model, expansion_quality, expansion_config_version_id,
         expansion_selection_origin
    INTO v_op_model, v_op_quality, v_op_config_version, v_op_origin
    FROM public.product_9_16_two_stage_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  SELECT status
    INTO v_square_status
    FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_square_delivery_id;

  SELECT status
    INTO v_vertical_status
    FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'campaign_id', p_campaign_id,
    'operation_id', p_operation_id,
    'square_delivery_id', p_square_delivery_id,
    'vertical_delivery_operation_id', p_operation_id,
    'contract_version', 'f60.7-two-format-v1',
    'expansion_model', v_op_model,
    'expansion_quality', v_op_quality,
    'expansion_config_version_id', v_op_config_version,
    'expansion_selection_origin', v_op_origin,
    'status', v_vertical_status,
    'square_status', v_square_status,
    'steps', COALESCE(v_v2 -> 'steps', '[]'::jsonb)
  );
END;
$$;

-- =============================================================================
-- 5. Entrega por formato: confirmação + projeção na MESMA transação
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_two_format_deliver_format(
  p_store_id         UUID,
  p_campaign_id      UUID,
  p_operation_id     UUID,
  p_format           TEXT,
  p_publication_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id             UUID;
  v_delivery_operation_id UUID;
  v_artifact_role        TEXT;
  v_credit_status        TEXT;
  v_artifact_ok          BOOLEAN := false;
  v_artifact_path        TEXT;
  v_projection           JSONB;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  IF p_format IS NULL OR p_format NOT IN ('1:1', '9:16') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unsupported_format');
  END IF;

  -- Ordem de locks: campanha primeiro, depois vínculo e crédito.
  SELECT store_id
    INTO v_store_id
    FROM public.campaigns
   WHERE id = p_campaign_id AND store_id = p_store_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_store_mismatch';
  END IF;

  IF p_publication_token IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_publication_token');
  END IF;

  SELECT delivery_operation_id, artifact_role
    INTO v_delivery_operation_id, v_artifact_role
    FROM public.product_two_format_deliveries
   WHERE campaign_id = p_campaign_id
     AND operation_id = p_operation_id
     AND format = p_format
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'delivery_link_missing');
  END IF;

  v_artifact_path := lower(v_store_id::text) || '/' || lower(p_campaign_id::text)
    || '/' || lower(p_operation_id::text) || '/' || v_artifact_role || '.jpg';

  -- A entrega só é confirmada com arte canônica persistida e compatível.
  SELECT EXISTS (
    SELECT 1
      FROM public.campaign_composition_artifacts a
     WHERE a.campaign_id = p_campaign_id
       AND a.operation_id = p_operation_id
       AND a.role = v_artifact_role
       AND a.format = p_format
       AND a.mime_type = 'image/jpeg'
       AND (
         (v_artifact_role = 'square_original' AND a.width = 1024 AND a.height = 1024)
         OR (v_artifact_role = 'vertical' AND a.width = 1080 AND a.height = 1920)
       )
       AND a.storage_path = v_artifact_path
  ) INTO v_artifact_ok;

  IF NOT v_artifact_ok THEN
    RETURN jsonb_build_object('success', false, 'reason', 'artifact_incompatible');
  END IF;

  SELECT status
    INTO v_credit_status
    FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = v_delivery_operation_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'credit_operation_missing');
  END IF;

  IF v_credit_status = 'delivered' THEN
    v_projection := public.product_two_format_project_campaign(p_campaign_id);
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'campaign_id', p_campaign_id,
      'operation_id', p_operation_id,
      'format', p_format,
      'delivery_operation_id', v_delivery_operation_id,
      'artifact_role', v_artifact_role,
      'credit_status', 'delivered',
      'campaign_status', v_projection ->> 'campaign_status',
      'storage_path', v_projection ->> 'storage_path',
      'preferred_format', v_projection ->> 'preferred_format',
      'projected', (v_projection ->> 'projected')::boolean,
      'already_projected', (v_projection ->> 'already_projected')::boolean
    );
  END IF;

  IF v_credit_status NOT IN ('reserved', 'art_uploaded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_transition');
  END IF;

  -- As autoridades existentes validam token/fence e levantam exceção em
  -- divergência, abortando a transação inteira (inclusive a projeção).
  PERFORM public.product_1_1_mark_campaign_credit_art_uploaded(
    p_campaign_id, v_delivery_operation_id, p_publication_token
  );
  PERFORM public.product_1_1_deliver_campaign_credit_operation(
    p_campaign_id, v_delivery_operation_id, p_publication_token
  );

  v_projection := public.product_two_format_project_campaign(p_campaign_id);

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'campaign_id', p_campaign_id,
    'operation_id', p_operation_id,
    'format', p_format,
    'delivery_operation_id', v_delivery_operation_id,
    'artifact_role', v_artifact_role,
    'credit_status', 'delivered',
    'campaign_status', v_projection ->> 'campaign_status',
    'storage_path', v_projection ->> 'storage_path',
    'preferred_format', v_projection ->> 'preferred_format',
    'projected', (v_projection ->> 'projected')::boolean,
    'already_projected', (v_projection ->> 'already_projected')::boolean
  );
END;
$$;

-- =============================================================================
-- 6. Estorno por formato com evidência comprovada de ausência
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_two_format_refund_format(
  p_store_id       UUID,
  p_campaign_id    UUID,
  p_operation_id   UUID,
  p_format         TEXT,
  p_art_kind       TEXT,
  p_observed_epoch INTEGER,
  p_reason         TEXT DEFAULT 'two_format_refund'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id              UUID;
  v_delivery_operation_id UUID;
  v_artifact_role         TEXT;
  v_credit_status         TEXT;
  v_artifact_exists       BOOLEAN := false;
  v_projection            JSONB;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  IF p_format IS NULL OR p_format NOT IN ('1:1', '9:16') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unsupported_format');
  END IF;

  -- Indeterminação nunca é convertida em ausência: só `absent` é aceito.
  IF p_art_kind IS DISTINCT FROM 'absent' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_evidence');
  END IF;

  IF p_observed_epoch IS NULL OR p_observed_epoch < 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_evidence');
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'missing_reason';
  END IF;

  -- Ordem de locks: campanha primeiro, depois vínculo e crédito.
  SELECT store_id
    INTO v_store_id
    FROM public.campaigns
   WHERE id = p_campaign_id AND store_id = p_store_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_store_mismatch';
  END IF;

  SELECT delivery_operation_id, artifact_role
    INTO v_delivery_operation_id, v_artifact_role
    FROM public.product_two_format_deliveries
   WHERE campaign_id = p_campaign_id
     AND operation_id = p_operation_id
     AND format = p_format
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'delivery_link_missing');
  END IF;

  SELECT status
    INTO v_credit_status
    FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = v_delivery_operation_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'credit_operation_missing');
  END IF;

  IF v_credit_status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'delivered_not_refundable');
  END IF;

  -- Replay idempotente: já estornado apenas reprojeta.
  IF v_credit_status = 'refunded' THEN
    v_projection := public.product_two_format_project_campaign(p_campaign_id);
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'campaign_id', p_campaign_id,
      'operation_id', p_operation_id,
      'format', p_format,
      'delivery_operation_id', v_delivery_operation_id,
      'artifact_role', v_artifact_role,
      'credit_status', 'refunded',
      'campaign_status', v_projection ->> 'campaign_status',
      'storage_path', v_projection ->> 'storage_path',
      'preferred_format', v_projection ->> 'preferred_format',
      'projected', (v_projection ->> 'projected')::boolean,
      'already_projected', (v_projection ->> 'already_projected')::boolean
    );
  END IF;

  IF v_credit_status NOT IN ('reserved', 'art_uploaded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_transition');
  END IF;

  -- Evidência de ausência no banco: nenhuma linha de arte para o papel.
  SELECT EXISTS (
    SELECT 1
      FROM public.campaign_composition_artifacts a
     WHERE a.campaign_id = p_campaign_id
       AND a.operation_id = p_operation_id
       AND a.role = v_artifact_role
  ) INTO v_artifact_exists;

  IF v_artifact_exists THEN
    RETURN jsonb_build_object('success', false, 'reason', 'artifact_present');
  END IF;

  -- Autoridade de encerramento por falha: exige ausência, frescor do epoch,
  -- ausência de claim ativo e finalidade `failed` já registrada. Recusas
  -- propagam como exceção e nunca viram estorno parcial. Atalho de estorno
  -- direto é proibido neste caminho.
  PERFORM public.product_1_1_close_failed_operation(
    p_campaign_id,
    v_delivery_operation_id,
    'absent',
    p_observed_epoch,
    p_reason
  );

  v_projection := public.product_two_format_project_campaign(p_campaign_id);

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'campaign_id', p_campaign_id,
    'operation_id', p_operation_id,
    'format', p_format,
    'delivery_operation_id', v_delivery_operation_id,
    'artifact_role', v_artifact_role,
    'credit_status', 'refunded',
    'campaign_status', v_projection ->> 'campaign_status',
    'storage_path', v_projection ->> 'storage_path',
    'preferred_format', v_projection ->> 'preferred_format',
    'projected', (v_projection ->> 'projected')::boolean,
    'already_projected', (v_projection ->> 'already_projected')::boolean
  );
END;
$$;

-- =============================================================================
-- 7. Privilégios RPC-only
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.product_two_format_project_campaign(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_two_format_project_campaign(UUID)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.product_two_format_open_delivery(UUID, UUID, UUID, UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_two_format_open_delivery(UUID, UUID, UUID, UUID, TEXT, TEXT, UUID)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.product_two_format_deliver_format(UUID, UUID, UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_two_format_deliver_format(UUID, UUID, UUID, TEXT, UUID)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.product_two_format_refund_format(UUID, UUID, UUID, TEXT, TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_two_format_refund_format(UUID, UUID, UUID, TEXT, TEXT, INTEGER, TEXT)
  TO service_role;

-- =============================================================================
-- 8. ROLLBACK OPERACIONAL (não destrutivo, não executado)
-- =============================================================================
-- 1) desligar a exposição da opção conjunta no código/flag aplicável, sem
--    alterar flags existentes;
-- 2) preservar a tabela de vínculo, os vínculos já criados, as reservas, as
--    entregas e os artefatos;
-- 3) manter intactos os fluxos 1:1 individual, 9:16 individual e histórico;
-- 4) a remoção de schema é uma decisão separada e destrutiva, fora deste
--    rollback operacional e fora desta autoria.
