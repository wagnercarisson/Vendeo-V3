-- F60.1 — Artefatos de composição: schema aditivo e bucket interno privado.
--
-- MIGRATION LOCAL-ONLY / AUTORADA, NÃO APLICADA.
-- Proibido executar `supabase db push`, `supabase db push --linked`,
-- `supabase migration up` contra projeto linkado ou qualquer mutação remota.
-- Aplicação somente em instância descartável/homolog explicitamente autorizada
-- pelo plano 60.1-04.
--
-- Fronteira de reuso: NÃO altera `product_1_1_campaign_artifacts`,
-- `campaign-images`, `campaign_art_versions`, RPCs de crédito ou de duas etapas.
-- Apenas referencia `campaigns` e `stores`.
--
-- `uq_campaigns_id_store_id` é um índice ADITIVO em `campaigns` (tabela
-- compartilhada), exigido pela FK composta (campaign_id, store_id), sem alterar
-- colunas nem dados. Sua aplicação em produção é gate separado.
--
-- Bucket `campaign-internal-artifacts`: privado, somente `service_role`, sem
-- policy para `anon`/`authenticated`. `service_role` ignora RLS; a não
-- sobrescrita do objeto é comportamento do módulo (`upsert:false`, sem delete).

-- =============================================================================
-- 1. Índice aditivo para a FK composta loja↔campanha
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaigns_id_store_id
  ON public.campaigns (id, store_id);

-- =============================================================================
-- 2. Tabela de artefatos de composição
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_composition_artifacts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                UUID NOT NULL REFERENCES public.stores(id),
  campaign_id             UUID NOT NULL,
  operation_id            UUID NOT NULL,
  role                    TEXT NOT NULL,
  format                  TEXT NOT NULL,
  origin                  TEXT NOT NULL,
  derived_from_artifact_id UUID NULL REFERENCES public.campaign_composition_artifacts(id),
  source_campaign_id      UUID NULL,
  storage_bucket          TEXT NOT NULL,
  storage_path            TEXT NOT NULL UNIQUE,
  width                   INTEGER NOT NULL,
  height                  INTEGER NOT NULL,
  mime_type               TEXT NOT NULL,
  byte_size               BIGINT NOT NULL,
  checksum_sha256         CHAR(64) NOT NULL,
  provenance              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_cca_identity UNIQUE (store_id, campaign_id, operation_id, role),
  CONSTRAINT fk_cca_campaign_store
    FOREIGN KEY (campaign_id, store_id)
    REFERENCES public.campaigns (id, store_id),
  CONSTRAINT fk_cca_source_campaign_store
    FOREIGN KEY (source_campaign_id, store_id)
    REFERENCES public.campaigns (id, store_id),
  CONSTRAINT ck_cca_role CHECK (role IN ('square_original','square_prepared','vertical')),
  CONSTRAINT ck_cca_format CHECK (format IN ('1:1','9:16')),
  CONSTRAINT ck_cca_role_format CHECK (
    (role = 'vertical' AND format = '9:16')
    OR (role IN ('square_original','square_prepared') AND format = '1:1')
  ),
  CONSTRAINT ck_cca_origin CHECK (
    origin IN ('provider_generation','deterministic_preparation','ai_expansion')
  ),
  CONSTRAINT ck_cca_storage_bucket CHECK (storage_bucket = 'campaign-internal-artifacts'),
  CONSTRAINT ck_cca_width CHECK (width BETWEEN 1 AND 8192),
  CONSTRAINT ck_cca_height CHECK (height BETWEEN 1 AND 8192),
  CONSTRAINT ck_cca_mime CHECK (mime_type = 'image/jpeg'),
  CONSTRAINT ck_cca_byte_size CHECK (byte_size > 0 AND byte_size <= 10485760),
  CONSTRAINT ck_cca_checksum CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_cca_provenance_object CHECK (jsonb_typeof(provenance) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_cca_campaign_operation
  ON public.campaign_composition_artifacts (campaign_id, operation_id);

CREATE INDEX IF NOT EXISTS idx_cca_store_campaign
  ON public.campaign_composition_artifacts (store_id, campaign_id);

-- =============================================================================
-- 3. Imutabilidade da linha
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trg_campaign_composition_artifacts_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'campaign_composition_artifacts_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_composition_artifacts_immutable
  ON public.campaign_composition_artifacts;
CREATE TRIGGER trg_campaign_composition_artifacts_immutable
BEFORE UPDATE OR DELETE ON public.campaign_composition_artifacts
FOR EACH ROW
EXECUTE FUNCTION public.trg_campaign_composition_artifacts_immutable_fn();

-- =============================================================================
-- 4. RLS, grants e policies da tabela (service_role somente)
-- =============================================================================
ALTER TABLE public.campaign_composition_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read campaign composition artifacts"
  ON public.campaign_composition_artifacts;
CREATE POLICY "Service role can read campaign composition artifacts"
  ON public.campaign_composition_artifacts FOR SELECT TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role can insert campaign composition artifacts"
  ON public.campaign_composition_artifacts;
CREATE POLICY "Service role can insert campaign composition artifacts"
  ON public.campaign_composition_artifacts FOR INSERT TO service_role
  WITH CHECK (true);

REVOKE ALL ON TABLE public.campaign_composition_artifacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.campaign_composition_artifacts FROM service_role;
GRANT SELECT, INSERT ON TABLE public.campaign_composition_artifacts TO service_role;

-- =============================================================================
-- 5. Bucket privado e policies de Storage (service_role somente)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-internal-artifacts',
  'campaign-internal-artifacts',
  false,
  10485760,
  ARRAY['image/jpeg']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role can read campaign-internal-artifacts objects"
  ON storage.objects;
CREATE POLICY "Service role can read campaign-internal-artifacts objects"
  ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'campaign-internal-artifacts');

DROP POLICY IF EXISTS "Service role can insert campaign-internal-artifacts objects"
  ON storage.objects;
CREATE POLICY "Service role can insert campaign-internal-artifacts objects"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'campaign-internal-artifacts');

-- =============================================================================
-- REVERT (comentado; executar manualmente somente em ambiente descartável)
-- =============================================================================
-- DROP POLICY IF EXISTS "Service role can insert campaign-internal-artifacts objects"
--   ON storage.objects;
-- DROP POLICY IF EXISTS "Service role can read campaign-internal-artifacts objects"
--   ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'campaign-internal-artifacts';
-- DROP POLICY IF EXISTS "Service role can insert campaign composition artifacts"
--   ON public.campaign_composition_artifacts;
-- DROP POLICY IF EXISTS "Service role can read campaign composition artifacts"
--   ON public.campaign_composition_artifacts;
-- DROP TRIGGER IF EXISTS trg_campaign_composition_artifacts_immutable
--   ON public.campaign_composition_artifacts;
-- DROP FUNCTION IF EXISTS public.trg_campaign_composition_artifacts_immutable_fn();
-- DROP INDEX IF EXISTS public.idx_cca_store_campaign;
-- DROP INDEX IF EXISTS public.idx_cca_campaign_operation;
-- DROP TABLE IF EXISTS public.campaign_composition_artifacts;
-- DROP INDEX IF EXISTS public.uq_campaigns_id_store_id;
--
-- Rollback em ambiente compartilhado é decisão separada e não automática.
