-- F62 / Plano 62-02 — Persistência durável da adição de formato 9:16.
--
-- LOCAL-ONLY / NÃO APLICADA: este arquivo é apenas AUTORADO nesta etapa. NÃO
-- executar `supabase db push`, `migration up`, reset, `psql` ou qualquer
-- mutação local/remota/homolog/produção sem autorização explícita do Gate de
-- banco do plano 62-08.
--
-- Escopo:
--   1. Tabela de vínculo durável `campaign_format_additions` (identidade,
--      origem, ponte, request_id, seleção e economia congeladas).
--   2. Guarda de imutabilidade da identidade e dos terminais.
--   3. RLS SELECT-only para service_role; escrita apenas pelas RPCs
--      SECURITY DEFINER.
--   4. Ampliação do CHECK de origem de `campaign_composition_artifacts`
--      (`delivered_campaign_reuse` restrita a `square_original`).
--   5. RPCs de abertura/replay, entrega e estorno restritas à adição.
--   6. Redefinição de `product_1_1_get_campaign_operation_by_campaign` para
--      excluir a adição da leitura da operação primária.
--   7. Seed fail-closed da flag dedicada `campaign_format_addition_enabled`.
--
-- Limitações explícitas: nenhum teste estático deste plano prova atomicidade,
-- isolamento, locks, deadlocks ou concorrência real. Isso pertence ao Gate de
-- banco do 62-08, com autorização separada. Nenhuma linha é aplicada aqui.
--
-- Timestamp UTC real: 2026-11-23T13:02:52Z.
-- Unicidade conferida em 2026-11-23 na worktree, `main`, `origin/main`,
-- `feature/fase-44-temas-de-campanha-v2` e
-- `origin/feature/fase-44-temas-de-campanha-v2`: nenhum prefixo
-- `20261123130252` existente.
--
-- REVERT: ver bloco comentado ao final. Reverter exige autorização específica;
-- restaurar primeiro as definições compartilhadas anteriores.

-- =============================================================================
-- 1. Tabela de vínculo durável da adição
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.campaign_format_additions (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                       UUID NOT NULL REFERENCES public.stores(id),
  campaign_id                    UUID NOT NULL,
  operation_id                   UUID NOT NULL,
  source_origin                  TEXT NOT NULL,
  source_operation_id            UUID NULL,
  source_registration_operation_id UUID NOT NULL,
  source_artifact_id             UUID NOT NULL,
  source_checksum_sha256         TEXT NOT NULL,
  source_format                  TEXT NOT NULL DEFAULT '1:1',
  target_format                  TEXT NOT NULL DEFAULT '9:16',
  status                         TEXT NOT NULL DEFAULT 'open',
  request_id                     UUID NOT NULL,
  selection                      JSONB NOT NULL,
  frozen_economics               JSONB NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_cfa_identity UNIQUE (campaign_id, operation_id),
  CONSTRAINT uq_cfa_request UNIQUE (campaign_id, request_id),

  CONSTRAINT fk_cfa_campaign_store
    FOREIGN KEY (campaign_id, store_id)
    REFERENCES public.campaigns (id, store_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_cfa_control_operation
    FOREIGN KEY (campaign_id, operation_id)
    REFERENCES public.product_9_16_two_stage_operations (campaign_id, operation_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_cfa_credit_operation
    FOREIGN KEY (campaign_id, operation_id)
    REFERENCES public.product_1_1_campaign_credit_operations (campaign_id, operation_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_cfa_source_operation
    FOREIGN KEY (campaign_id, source_operation_id)
    REFERENCES public.product_1_1_campaign_credit_operations (campaign_id, operation_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_cfa_source_artifact
    FOREIGN KEY (source_artifact_id)
    REFERENCES public.campaign_composition_artifacts (id)
    ON DELETE RESTRICT,

  CONSTRAINT ck_cfa_source_origin
    CHECK (source_origin IN ('new_flow_1_1', 'legacy_campaign')),
  CONSTRAINT ck_cfa_source_operation_origin
    CHECK (
      (source_origin = 'new_flow_1_1' AND source_operation_id IS NOT NULL)
      OR (source_origin = 'legacy_campaign' AND source_operation_id IS NULL)
    ),
  CONSTRAINT ck_cfa_source_format CHECK (source_format = '1:1'),
  CONSTRAINT ck_cfa_target_format CHECK (target_format = '9:16'),
  CONSTRAINT ck_cfa_status CHECK (status IN ('open', 'delivered', 'refunded')),
  CONSTRAINT ck_cfa_checksum CHECK (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_cfa_selection_object CHECK (jsonb_typeof(selection) = 'object'),
  CONSTRAINT ck_cfa_frozen_economics_object
    CHECK (jsonb_typeof(frozen_economics) = 'object'),
  CONSTRAINT ck_cfa_identity_distinct
    CHECK (
      operation_id <> source_registration_operation_id
      AND (source_operation_id IS NULL OR operation_id <> source_operation_id)
    )
);

-- No máximo uma adição ativa (open/delivered) por campanha e formato alvo.
-- Tentativas estornadas permanecem como histórico.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cfa_active_per_campaign_target
  ON public.campaign_format_additions (campaign_id, target_format)
  WHERE status IN ('open', 'delivered');

CREATE INDEX IF NOT EXISTS idx_cfa_operation
  ON public.campaign_format_additions (campaign_id, operation_id);

CREATE INDEX IF NOT EXISTS idx_cfa_status_created
  ON public.campaign_format_additions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cfa_source_registration
  ON public.campaign_format_additions (campaign_id, source_registration_operation_id);

-- =============================================================================
-- 2. Guarda de identidade e de transição terminal
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_cfa_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.operation_id IS DISTINCT FROM OLD.operation_id
     OR NEW.source_origin IS DISTINCT FROM OLD.source_origin
     OR NEW.source_operation_id IS DISTINCT FROM OLD.source_operation_id
     OR NEW.source_registration_operation_id IS DISTINCT FROM OLD.source_registration_operation_id
     OR NEW.source_artifact_id IS DISTINCT FROM OLD.source_artifact_id
     OR NEW.source_checksum_sha256 IS DISTINCT FROM OLD.source_checksum_sha256
     OR NEW.source_format IS DISTINCT FROM OLD.source_format
     OR NEW.target_format IS DISTINCT FROM OLD.target_format
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.selection IS DISTINCT FROM OLD.selection
     OR NEW.frozen_economics IS DISTINCT FROM OLD.frozen_economics
  THEN
    RAISE EXCEPTION 'campaign_format_addition_identity_immutable';
  END IF;

  IF OLD.status <> 'open' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'campaign_format_addition_terminal';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cfa_guard ON public.campaign_format_additions;
CREATE TRIGGER trg_cfa_guard
  BEFORE UPDATE ON public.campaign_format_additions
  FOR EACH ROW EXECUTE FUNCTION public.trg_cfa_guard_fn();

-- =============================================================================
-- 3. RLS e grants: service_role apenas SELECT; escrita só pelas RPCs
-- =============================================================================

ALTER TABLE public.campaign_format_additions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role reads campaign format additions"
  ON public.campaign_format_additions;
CREATE POLICY "Service role reads campaign format additions"
  ON public.campaign_format_additions FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.campaign_format_additions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.campaign_format_additions FROM service_role;
GRANT SELECT ON TABLE public.campaign_format_additions TO service_role;

-- =============================================================================
-- 4. Origem `delivered_campaign_reuse` na ponte de proveniência
-- =============================================================================

ALTER TABLE public.campaign_composition_artifacts
  DROP CONSTRAINT IF EXISTS ck_cca_origin;
ALTER TABLE public.campaign_composition_artifacts
  ADD CONSTRAINT ck_cca_origin CHECK (
    origin IN (
      'provider_generation',
      'deterministic_preparation',
      'ai_expansion',
      'delivered_campaign_reuse'
    )
  );

ALTER TABLE public.campaign_composition_artifacts
  DROP CONSTRAINT IF EXISTS ck_cca_reuse_role;
ALTER TABLE public.campaign_composition_artifacts
  ADD CONSTRAINT ck_cca_reuse_role CHECK (
    origin <> 'delivered_campaign_reuse' OR role = 'square_original'
  );

-- =============================================================================
-- 5. RPC de abertura/replay — uma reserva de 1 crédito e base reutilizada
-- =============================================================================

CREATE OR REPLACE FUNCTION public.campaign_format_add_open(
  p_store_id                         UUID,
  p_campaign_id                      UUID,
  p_operation_id                     UUID,
  p_request_id                       UUID,
  p_source_origin                    TEXT,
  p_source_operation_id              UUID,
  p_source_registration_operation_id UUID,
  p_source_artifact_id               UUID,
  p_source_checksum_sha256           TEXT,
  p_selection                        JSONB,
  p_frozen_economics                 JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign_id        UUID;
  v_campaign_snapshot  JSONB;
  v_campaign_status    TEXT;
  v_campaign_storage_path TEXT;
  v_path_match         TEXT[];
  v_uuid_pattern       TEXT := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  v_artifact           public.campaign_composition_artifacts%ROWTYPE;
  v_source_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_link               public.campaign_format_additions%ROWTYPE;
  v_active             public.campaign_format_additions%ROWTYPE;
  v_open_result        JSONB;
  v_model              TEXT;
  v_quality            TEXT;
  v_config_version     UUID;
  v_rows               INTEGER;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'missing_request_id'; END IF;
  IF p_source_registration_operation_id IS NULL THEN
    RAISE EXCEPTION 'missing_source_registration_operation_id';
  END IF;
  IF p_source_artifact_id IS NULL THEN RAISE EXCEPTION 'missing_source_artifact_id'; END IF;

  IF p_source_origin IS NULL
     OR p_source_origin NOT IN ('new_flow_1_1', 'legacy_campaign') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'source_origin_invalid');
  END IF;

  IF p_source_origin = 'new_flow_1_1' AND p_source_operation_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'source_operation_required');
  END IF;
  IF p_source_origin = 'legacy_campaign' AND p_source_operation_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'legacy_source_operation_forbidden');
  END IF;

  IF p_source_checksum_sha256 IS NULL
     OR p_source_checksum_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'source_checksum_invalid');
  END IF;

  -- Seleção congelada: contrato fechado e compatível com o motor (v2/configured).
  IF p_selection IS NULL OR jsonb_typeof(p_selection) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_selection');
  END IF;
  IF (p_selection->>'selectionOrigin') IS DISTINCT FROM 'configured' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_selection_origin');
  END IF;
  v_model := p_selection->>'model';
  IF v_model IS NULL
     OR v_model NOT IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_selection_model');
  END IF;
  v_quality := p_selection->>'quality';
  IF v_quality IS NULL OR v_quality NOT IN ('low', 'medium') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_selection_quality');
  END IF;
  IF (p_selection->>'configVersionId') IS NULL
     OR (p_selection->>'configVersionId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_selection_config_version');
  END IF;
  v_config_version := (p_selection->>'configVersionId')::UUID;

  -- Economia congelada: estrutura fechada; valores ausentes de câmbio/credito
  -- podem ser null explícitos, nunca inventados depois.
  IF p_frozen_economics IS NULL OR jsonb_typeof(p_frozen_economics) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_frozen_economics');
  END IF;
  IF NOT (p_frozen_economics ? 'pricing')
     OR jsonb_typeof(p_frozen_economics->'pricing') IS DISTINCT FROM 'object'
     OR (p_frozen_economics->'pricing') = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_frozen_pricing');
  END IF;
  IF NOT (p_frozen_economics ? 'pricingVersionId')
     OR jsonb_typeof(p_frozen_economics->'pricingVersionId') IS DISTINCT FROM 'string'
     OR (p_frozen_economics->>'pricingVersionId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_frozen_pricing_version');
  END IF;
  IF NOT (p_frozen_economics ? 'usdBrlRateAtGeneration')
     OR jsonb_typeof(p_frozen_economics->'usdBrlRateAtGeneration') NOT IN ('number', 'null')
     OR NOT (p_frozen_economics ? 'creditValueBrlAtGeneration')
     OR jsonb_typeof(p_frozen_economics->'creditValueBrlAtGeneration') NOT IN ('number', 'null')
  THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_frozen_economic_values');
  END IF;
  IF NOT (p_frozen_economics ? 'capturedAt')
     OR jsonb_typeof(p_frozen_economics->'capturedAt') IS DISTINCT FROM 'string'
     OR (p_frozen_economics->>'capturedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_frozen_captured_at');
  END IF;

  -- Serializa a abertura por campanha/alvo antes de qualquer leitura de replay.
  PERFORM pg_advisory_xact_lock(
    hashtext('cfa_open:' || p_campaign_id::text || ':9:16')
  );

  SELECT c.id, c.status, c.input_snapshot, c.storage_path
    INTO v_campaign_id, v_campaign_status, v_campaign_snapshot, v_campaign_storage_path
  FROM public.campaigns c
  WHERE c.id = p_campaign_id AND c.store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'campaign_not_found');
  END IF;
  IF v_campaign_status <> 'ready' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'campaign_not_ready');
  END IF;
  IF v_campaign_snapshot IS NULL
     OR jsonb_typeof(v_campaign_snapshot) IS DISTINCT FROM 'object'
     OR (v_campaign_snapshot ? 'campaignFormat')
     OR (v_campaign_snapshot ? 'formatContractVersion') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'format_not_square');
  END IF;

  -- Replay do MESMO request_id: devolve o estado daquela adição, sem cobrar.
  SELECT * INTO v_link
  FROM public.campaign_format_additions
  WHERE campaign_id = p_campaign_id AND request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_link.store_id <> p_store_id
       OR v_link.operation_id <> p_operation_id
       OR v_link.source_origin <> p_source_origin
       OR v_link.source_operation_id IS DISTINCT FROM p_source_operation_id
       OR v_link.source_registration_operation_id <> p_source_registration_operation_id
       OR v_link.source_artifact_id <> p_source_artifact_id
       OR v_link.source_checksum_sha256 <> p_source_checksum_sha256
    THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
    END IF;

    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'state', v_link.status,
      'operationId', v_link.operation_id, 'sourceOrigin', v_link.source_origin,
      'sourceRegistrationOperationId', v_link.source_registration_operation_id,
      'squareArtifactId', v_link.source_artifact_id,
      'requestId', v_link.request_id, 'credits', 1,
      'selection', v_link.selection
    );
  END IF;

  -- Já existe adição ativa? Retorna o estado durável (open/delivered).
  SELECT * INTO v_active
  FROM public.campaign_format_additions
  WHERE campaign_id = p_campaign_id
    AND target_format = '9:16'
    AND status IN ('open', 'delivered')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'state', v_active.status,
      'operationId', v_active.operation_id, 'sourceOrigin', v_active.source_origin,
      'sourceRegistrationOperationId', v_active.source_registration_operation_id,
      'squareArtifactId', v_active.source_artifact_id,
      'requestId', v_active.request_id, 'credits', 1,
      'selection', v_active.selection
    );
  END IF;

  -- Identidade da operação não pode coincidir com a fonte nem com a ponte.
  IF p_operation_id = p_source_registration_operation_id
     OR (p_source_operation_id IS NOT NULL AND p_operation_id = p_source_operation_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'source_identity_conflict');
  END IF;

  -- Ponte `square_original` byte-validada e estável.
  SELECT * INTO v_artifact
  FROM public.campaign_composition_artifacts
  WHERE id = p_source_artifact_id
    AND store_id = p_store_id
    AND campaign_id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'source_artifact_missing');
  END IF;
  IF v_artifact.role <> 'square_original'
     OR v_artifact.format <> '1:1'
     OR v_artifact.origin <> 'delivered_campaign_reuse'
     OR v_artifact.operation_id <> p_source_registration_operation_id
     OR v_artifact.source_campaign_id IS DISTINCT FROM p_campaign_id
     OR v_artifact.width <> 1024
     OR v_artifact.height <> 1024
     OR v_artifact.mime_type <> 'image/jpeg'
     OR v_artifact.checksum_sha256::text <> p_source_checksum_sha256
  THEN
    RETURN jsonb_build_object('success', false, 'reason', 'source_artifact_invalid');
  END IF;

  -- A ponte precisa corresponder à fonte CORRENTE apresentada pela campanha.
  -- Replay/adição ativa já retornaram acima; esta checagem só vale para abertura.
  IF v_campaign_storage_path IS NULL OR v_campaign_storage_path = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'source_path_missing');
  END IF;

  IF p_source_origin = 'new_flow_1_1' THEN
    v_path_match := regexp_match(
      v_campaign_storage_path,
      '^(' || v_uuid_pattern || ')/(' || v_uuid_pattern || ')/product-1-1/(' || v_uuid_pattern || ')/art-1024\.jpe?g$',
      'i'
    );

    IF v_path_match IS NULL
       OR lower(v_path_match[1]) <> lower(p_store_id::text)
       OR lower(v_path_match[2]) <> lower(p_campaign_id::text)
       OR lower(v_path_match[3]) <> lower(p_source_operation_id::text) THEN
      RETURN jsonb_build_object(
        'success', false, 'reason', 'source_operation_artifact_mismatch'
      );
    END IF;
  ELSE
    v_path_match := regexp_match(
      v_campaign_storage_path,
      '^(' || v_uuid_pattern || ')/(' || v_uuid_pattern || ')(/v(2|3))?\.jpe?g$',
      'i'
    );

    IF v_path_match IS NULL
       OR lower(v_path_match[1]) <> lower(p_store_id::text)
       OR lower(v_path_match[2]) <> lower(p_campaign_id::text) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'source_path_mismatch');
    END IF;
  END IF;

  -- Proveniência gravada na ponte deve apontar para o MESMO path/checksum/origem
  -- e para a dimensão/MIME validados. Ponte antiga da mesma campanha falha aqui.
  IF v_artifact.provenance->>'sourceOrigin' IS DISTINCT FROM p_source_origin
     OR v_artifact.provenance->>'sourceStoragePath' IS DISTINCT FROM v_campaign_storage_path
     OR v_artifact.provenance->>'sourceChecksumSha256' IS DISTINCT FROM p_source_checksum_sha256
     OR v_artifact.provenance->>'sourceWidth' IS DISTINCT FROM '1024'
     OR v_artifact.provenance->>'sourceHeight' IS DISTINCT FROM '1024'
     OR v_artifact.provenance->>'sourceMimeType' IS DISTINCT FROM 'image/jpeg'
  THEN
    RETURN jsonb_build_object('success', false, 'reason', 'source_provenance_mismatch');
  END IF;

  IF p_source_origin = 'new_flow_1_1' THEN
    IF p_source_registration_operation_id <> p_source_operation_id THEN
      RETURN jsonb_build_object('success', false, 'reason', 'source_identity_conflict');
    END IF;

    SELECT * INTO v_source_credit
    FROM public.product_1_1_campaign_credit_operations
    WHERE campaign_id = p_campaign_id AND operation_id = p_source_operation_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'reason', 'primary_operation_missing');
    END IF;
    IF v_source_credit.store_id <> p_store_id THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
    END IF;
    IF v_source_credit.status <> 'delivered' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'primary_operation_not_delivered');
    END IF;

    -- A fonte não pode ser outra adição.
    IF EXISTS (
      SELECT 1 FROM public.campaign_format_additions a
      WHERE a.campaign_id = p_campaign_id AND a.operation_id = p_source_operation_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'source_identity_conflict');
    END IF;
  ELSE
    -- Legado: identidade sintética não pode ser uma operação financeira real.
    IF EXISTS (
      SELECT 1 FROM public.product_1_1_campaign_credit_operations c
      WHERE c.campaign_id = p_campaign_id
        AND c.operation_id = p_source_registration_operation_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'source_identity_conflict');
    END IF;
  END IF;

  -- Abertura do controle + reserva de 1 crédito (motor existente, contrato v2).
  v_open_result := public.product_9_16_open_operation_v2(
    p_store_id, p_campaign_id, p_operation_id, v_model, v_quality, v_config_version
  );

  IF v_open_result IS NULL OR (v_open_result->>'success') IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', COALESCE(v_open_result->>'reason', 'operation_open_failed')
    );
  END IF;

  -- `idempotent:true` aqui significa crédito pré-existente sem vínculo: jamais
  -- adotar uma operação antiga. O v2 não escreveu; devolve conflito fechado.
  IF (v_open_result->>'idempotent') = 'true' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_origin_conflict');
  END IF;

  -- Base reutilizada da fonte validada: não gera imagem nem consome tentativa.
  UPDATE public.product_9_16_two_stage_steps
     SET status = 'done',
         artifact_evidence_ref = p_source_artifact_id::text,
         updated_at = now()
   WHERE campaign_id = p_campaign_id
     AND operation_id = p_operation_id
     AND stage = 'base'
     AND status = 'pending';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'format_addition_base_step_conflict';
  END IF;

  INSERT INTO public.campaign_format_additions (
    store_id, campaign_id, operation_id, source_origin, source_operation_id,
    source_registration_operation_id, source_artifact_id, source_checksum_sha256,
    source_format, target_format, status, request_id, selection, frozen_economics
  ) VALUES (
    p_store_id, p_campaign_id, p_operation_id, p_source_origin, p_source_operation_id,
    p_source_registration_operation_id, p_source_artifact_id, p_source_checksum_sha256,
    '1:1', '9:16', 'open', p_request_id, p_selection, p_frozen_economics
  );

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'state', 'open',
    'operationId', p_operation_id, 'sourceOrigin', p_source_origin,
    'sourceRegistrationOperationId', p_source_registration_operation_id,
    'squareArtifactId', p_source_artifact_id,
    'requestId', p_request_id, 'credits', 1, 'selection', p_selection
  );
END;
$$;

-- =============================================================================
-- 6. RPC de entrega — confirma só a adição; nunca projeta a campanha
-- =============================================================================

CREATE OR REPLACE FUNCTION public.campaign_format_add_deliver(
  p_store_id           UUID,
  p_campaign_id        UUID,
  p_operation_id       UUID,
  p_publication_token  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign_id UUID;
  v_link        public.campaign_format_additions%ROWTYPE;
  v_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_artifact    public.campaign_composition_artifacts%ROWTYPE;
  v_prepared    public.campaign_composition_artifacts%ROWTYPE;
  v_expected_vertical_path TEXT;
  v_expected_prepared_path TEXT;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_publication_token IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_publication_token');
  END IF;

  SELECT c.id INTO v_campaign_id
  FROM public.campaigns c
  WHERE c.id = p_campaign_id AND c.store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'campaign_not_found');
  END IF;

  SELECT * INTO v_link
  FROM public.campaign_format_additions
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'format_addition_not_found');
  END IF;
  IF v_link.store_id <> p_store_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
  END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'credit_operation_missing');
  END IF;
  IF v_credit.store_id <> p_store_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
  END IF;

  -- Crédito já entregue: reconcilia o vínculo, sem novo efeito.
  IF v_credit.status = 'delivered' THEN
    IF v_link.status = 'delivered' THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true, 'state', 'delivered',
        'operationId', p_operation_id
      );
    END IF;
    IF v_link.status = 'refunded' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal');
    END IF;

    UPDATE public.campaign_format_additions
       SET status = 'delivered', updated_at = now()
     WHERE id = v_link.id;

    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'state', 'delivered',
      'operationId', p_operation_id
    );
  END IF;

  -- Vínculo entregue com crédito não entregue é inconsistência.
  IF v_link.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'delivery_identity_conflict');
  END IF;

  IF v_link.status = 'refunded' OR v_credit.status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_terminal');
  END IF;

  IF v_credit.status NOT IN ('reserved', 'art_uploaded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_transition');
  END IF;

  -- Vertical canônico 1080×1920 JPEG da PRÓPRIA operação da adição.
  SELECT * INTO v_artifact
  FROM public.campaign_composition_artifacts
  WHERE store_id = p_store_id
    AND campaign_id = p_campaign_id
    AND operation_id = p_operation_id
    AND role = 'vertical';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'vertical_artifact_missing');
  END IF;

  v_expected_vertical_path :=
    lower(p_store_id::text) || '/' || lower(p_campaign_id::text) || '/'
    || lower(p_operation_id::text) || '/vertical.jpg';

  IF v_artifact.format <> '9:16'
     OR v_artifact.width <> 1080
     OR v_artifact.height <> 1920
     OR v_artifact.mime_type <> 'image/jpeg'
     OR v_artifact.origin <> 'ai_expansion'
     OR v_artifact.storage_bucket <> 'campaign-internal-artifacts'
     OR v_artifact.storage_path <> v_expected_vertical_path THEN
    RETURN jsonb_build_object('success', false, 'reason', 'vertical_artifact_invalid');
  END IF;

  -- O vertical precisa ser comprovadamente a expansão do prepared DESTA operação,
  -- com path/bucket e proveniência allowlisted, antes de qualquer efeito novo.
  SELECT * INTO v_prepared
  FROM public.campaign_composition_artifacts
  WHERE store_id = p_store_id
    AND campaign_id = p_campaign_id
    AND operation_id = p_operation_id
    AND role = 'square_prepared';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'vertical_provenance_invalid');
  END IF;

  v_expected_prepared_path :=
    lower(p_store_id::text) || '/' || lower(p_campaign_id::text) || '/'
    || lower(p_operation_id::text) || '/square_prepared.jpg';

  IF v_prepared.format <> '1:1'
     OR v_prepared.width <> 1152
     OR v_prepared.height <> 1152
     OR v_prepared.mime_type <> 'image/jpeg'
     OR v_prepared.origin <> 'deterministic_preparation'
     OR v_prepared.storage_bucket <> 'campaign-internal-artifacts'
     OR v_prepared.storage_path <> v_expected_prepared_path
     OR v_artifact.derived_from_artifact_id IS DISTINCT FROM v_prepared.id
     OR v_artifact.provenance->>'sourceOrigin' IS DISTINCT FROM 'composition_artifact'
     OR v_artifact.provenance->>'derivedFromArtifactId' IS DISTINCT FROM v_prepared.id::text
     OR v_artifact.provenance->>'sourceStoragePath' IS DISTINCT FROM v_prepared.storage_path
     OR v_artifact.provenance->>'sourceChecksumSha256' IS DISTINCT FROM v_prepared.checksum_sha256::text
  THEN
    RETURN jsonb_build_object('success', false, 'reason', 'vertical_provenance_invalid');
  END IF;

  -- Token de publicação = dono atual do fence (nunca inventado aqui).
  -- `reserved` exige fence em `in_flight`; `art_uploaded` já pode estar
  -- `published` pelo mark anterior, mas o token continua sendo validado.
  IF v_credit.publication_token IS NULL
     OR v_credit.publication_token IS DISTINCT FROM p_publication_token
     OR (
       v_credit.status = 'reserved'
       AND v_credit.publication_state <> 'in_flight'
     ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'stale_publication');
  END IF;

  IF v_credit.status = 'reserved' THEN
    PERFORM public.product_1_1_mark_campaign_credit_art_uploaded(
      p_campaign_id, p_operation_id, p_publication_token
    );
  END IF;

  PERFORM public.product_1_1_deliver_campaign_credit_operation(
    p_campaign_id, p_operation_id, p_publication_token
  );

  UPDATE public.campaign_format_additions
     SET status = 'delivered', updated_at = now()
   WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'state', 'delivered',
    'operationId', p_operation_id
  );
END;
$$;

-- =============================================================================
-- 7. RPC de estorno — somente a adição, com evidência de falha/ausência
-- =============================================================================

CREATE OR REPLACE FUNCTION public.campaign_format_add_refund(
  p_store_id        UUID,
  p_campaign_id     UUID,
  p_operation_id    UUID,
  p_observed_epoch  INTEGER,
  p_reason          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign_id UUID;
  v_link        public.campaign_format_additions%ROWTYPE;
  v_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'missing_store_id'; END IF;
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_observed_epoch IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_observed_epoch');
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_reason');
  END IF;

  SELECT c.id INTO v_campaign_id
  FROM public.campaigns c
  WHERE c.id = p_campaign_id AND c.store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'campaign_not_found');
  END IF;

  SELECT * INTO v_link
  FROM public.campaign_format_additions
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'format_addition_not_found');
  END IF;
  IF v_link.store_id <> p_store_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
  END IF;

  IF v_link.status = 'refunded' THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'state', 'refunded',
      'operationId', p_operation_id
    );
  END IF;

  SELECT * INTO v_credit
  FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'credit_operation_missing');
  END IF;
  IF v_credit.store_id <> p_store_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_identity_conflict');
  END IF;

  IF v_link.status = 'delivered' OR v_credit.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'delivered_not_refundable');
  END IF;

  -- Crédito já estornado: reconcilia o vínculo sem novo efeito.
  IF v_credit.status = 'refunded' THEN
    UPDATE public.campaign_format_additions
       SET status = 'refunded', updated_at = now()
     WHERE id = v_link.id;
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'state', 'refunded',
      'operationId', p_operation_id
    );
  END IF;

  IF v_credit.status NOT IN ('reserved', 'art_uploaded') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_transition');
  END IF;

  IF p_observed_epoch IS DISTINCT FROM v_credit.state_epoch THEN
    RETURN jsonb_build_object('success', false, 'reason', 'evidence_stale');
  END IF;

  -- Arte vertical presente nunca é estornada.
  IF EXISTS (
    SELECT 1 FROM public.campaign_composition_artifacts a
    WHERE a.store_id = p_store_id
      AND a.campaign_id = p_campaign_id
      AND a.operation_id = p_operation_id
      AND a.role = 'vertical'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'vertical_artifact_present');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_generation_operation_outcomes_v o
    WHERE o.campaign_id = p_campaign_id
      AND o.operation_id = p_operation_id
      AND o.outcome = 'unknown'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_unknown');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_generation_operation_outcomes_v o
    WHERE o.campaign_id = p_campaign_id
      AND o.operation_id = p_operation_id
      AND o.outcome = 'failed'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'finality_not_recorded');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_generation_active_claims_v c
    WHERE c.campaign_id = p_campaign_id
      AND c.operation_id = p_operation_id
      AND c.status = 'in_progress'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'operation_in_progress');
  END IF;

  BEGIN
    PERFORM public.product_1_1_close_failed_operation(
      p_campaign_id, p_operation_id, 'absent', p_observed_epoch, btrim(p_reason)
    );
  EXCEPTION WHEN raise_exception THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', CASE
        WHEN SQLERRM LIKE '%publication_in_progress%' THEN 'publication_in_progress'
        WHEN SQLERRM LIKE '%delivered_not_refundable%' THEN 'delivered_not_refundable'
        WHEN SQLERRM LIKE '%finality_not_recorded%' THEN 'finality_not_recorded'
        WHEN SQLERRM LIKE '%operation_in_progress%' THEN 'operation_in_progress'
        WHEN SQLERRM LIKE '%evidence_stale%' THEN 'evidence_stale'
        ELSE 'refund_failed'
      END
    );
  END;

  UPDATE public.campaign_format_additions
     SET status = 'refunded', updated_at = now()
   WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'state', 'refunded',
    'operationId', p_operation_id
  );
END;
$$;

-- =============================================================================
-- 8. A adição não é a operação primária da campanha
-- =============================================================================

CREATE OR REPLACE FUNCTION public.product_1_1_get_campaign_operation_by_campaign(
  p_campaign_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit      public.product_1_1_campaign_credit_operations%ROWTYPE;
  v_has_outcome BOOLEAN := false;
  v_unknown     BOOLEAN := false;
  v_terminal    BOOLEAN := false;
  v_outcome     TEXT;
  v_support     TEXT;
BEGIN
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION 'missing_campaign_id'; END IF;

  SELECT c.* INTO v_credit
  FROM public.product_1_1_campaign_credit_operations c
  WHERE c.campaign_id = p_campaign_id
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_format_additions a
      WHERE a.campaign_id = c.campaign_id
        AND a.operation_id = c.operation_id
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  v_terminal := v_credit.status IN ('delivered', 'refunded');

  SELECT outcome, support_reference INTO v_outcome, v_support
  FROM public.product_generation_operation_outcomes_v
  WHERE campaign_id = p_campaign_id AND operation_id = v_credit.operation_id
  LIMIT 1;
  v_has_outcome := FOUND;

  IF v_has_outcome AND v_outcome = 'unknown' THEN v_unknown := true; END IF;

  RETURN jsonb_build_object(
    'success', true, 'status', v_credit.status,
    'campaign_id', v_credit.campaign_id, 'operation_id', v_credit.operation_id,
    'amount', v_credit.amount, 'credit_tx_id', v_credit.credit_tx_id,
    'refund_tx_id', v_credit.refund_tx_id,
    'consumed_definitive', (v_credit.status = 'delivered'),
    'terminal', v_terminal,
    'unknown', (v_unknown AND NOT v_terminal),
    'outcome', CASE WHEN v_has_outcome AND NOT v_terminal THEN v_outcome ELSE NULL END,
    'support_reference', CASE WHEN v_has_outcome AND NOT v_terminal THEN v_support ELSE NULL END
  );
END;
$$;

-- =============================================================================
-- 9. Flag dedicada fail-closed
-- =============================================================================

INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'campaign_format_addition_enabled',
  false,
  'Quando ligada, permite abrir a adicao do formato vertical 9:16 em uma campanha 1:1 ja entregue. Desligada, bloqueia somente novas adicoes; operacoes abertas continuam consultaveis, retomaveis e finalizaveis, e os fluxos individual, conjunto e 1:1 permanecem ativos.'
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 10. Grants das RPCs novas e da redefinição
-- =============================================================================

REVOKE ALL ON FUNCTION public.campaign_format_add_open(UUID, UUID, UUID, UUID, TEXT, UUID, UUID, UUID, TEXT, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_format_add_open(UUID, UUID, UUID, UUID, TEXT, UUID, UUID, UUID, TEXT, JSONB, JSONB)
  TO service_role;

REVOKE ALL ON FUNCTION public.campaign_format_add_deliver(UUID, UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_format_add_deliver(UUID, UUID, UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.campaign_format_add_refund(UUID, UUID, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_format_add_refund(UUID, UUID, UUID, INTEGER, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID)
  TO service_role;

-- =============================================================================
-- REVERT / ROLLBACK
-- =============================================================================
-- ROLLBACK OPERACIONAL (preferencial e NÃO destrutivo):
--   UPDATE public.feature_flags SET enabled = false, updated_at = now()
--    WHERE key = 'campaign_format_addition_enabled';
--   (ou manter o seed `false`). Isso bloqueia SOMENTE novas adições.
--
--   NÃO apagar vínculos, créditos, operações, artefatos, auditoria ou histórico.
--   Operações já abertas continuam consultáveis, retomáveis e finalizáveis;
--   o vertical individual, o conjunto, o 1:1 e o download não são desligados.
--
-- REVERSÃO ESTRUTURAL (procedimento SEPARADO, com autorização própria;
-- NÃO incluída nesta migration e NÃO executável por este REVERT):
--   Pré-condições obrigatórias, todas comprovadas:
--     (a) `campaign_format_additions` sem linhas (histórico exportado/arquivado);
--     (b) nenhum artefato `delivered_campaign_reuse` nem vertical de adição em uso;
--     (c) nenhuma operação, claim ou outcome aberto;
--     (d) backup + `restore-list` válidos e autorização explícita.
--   Somente então, em migration própria, restaurar a definição anterior de
--   `product_1_1_get_campaign_operation_by_campaign`, revogar/remover as RPCs e
--   a guarda, remover a tabela vazia, restaurar o CHECK antigo apenas quando não
--   existir `delivered_campaign_reuse` e remover a flag.
--
--   NUNCA remover a tabela com histórico e NUNCA restaurar o CHECK antigo
--   enquanto houver linhas com a nova origem.
-- `credit_transactions`, `credit_balances` e `campaign_composition_artifacts`
-- não são apagados: linhas antigas e novas permanecem válidas.
