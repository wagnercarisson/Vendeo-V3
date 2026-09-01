-- Migration F37.1: campaign_art_versions + colunas de aprovação em campaigns
-- Approval Gate + Candidata Única (D3/D7) — 1 candidata por vez; estado de aprovação
-- derivado de campaign_art_versions (single source). Sem backfill: campanhas ready
-- pré-flag seguem entregues (legacy, D2). Sem alteração de chk_generation_events_type
-- (telemetria via metadata/campaign_art_versions, D8).
--
-- Segurança:
--   * Escrita/leitura apenas via API server-side (supabaseAdmin, service_role) —
--     RLS habilitada com policy somente para service_role (padrão feature_flags F43).
--   * CHECK campaigns_approved_requires_version via bloco idempotente DO $$ (ADD
--     CONSTRAINT IF NOT EXISTS não é portável no PostgreSQL/Supabase).
--   * Índice único parcial garante 1 approved por campaign_id (anti-concorrência com
--     o RPC approve_campaign_art_version, migration 20260901000002).

-- =============================================================================
-- 1. Tabela campaign_art_versions (1 candidata por vez)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_art_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  version_number smallint NOT NULL CHECK (version_number BETWEEN 1 AND 3),
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
  correction_in_progress boolean NOT NULL DEFAULT false,
  storage_path text,
  asset_status text NOT NULL DEFAULT 'active' CHECK (asset_status IN ('active','discarded')),
  asset_deleted_at timestamptz,
  brief_snapshot jsonb NOT NULL,
  render_snapshot jsonb,
  generation_metadata jsonb,
  rejection_reason jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, version_number)
);

ALTER TABLE public.campaign_art_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage campaign art versions"
  ON public.campaign_art_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.campaign_art_versions FROM anon;
REVOKE ALL ON TABLE public.campaign_art_versions FROM authenticated;
REVOKE ALL ON TABLE public.campaign_art_versions FROM service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.campaign_art_versions
TO service_role;

-- =============================================================================
-- 2. Colunas de aprovação em campaigns (aditivas, preservando valores existentes)
-- =============================================================================
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_approval'
    CHECK (approval_status IN ('pending_approval','approved')),
  ADD COLUMN IF NOT EXISTS rejection_count smallint NOT NULL DEFAULT 0
    CHECK (rejection_count BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS approved_version_id uuid
    REFERENCES public.campaign_art_versions(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- =============================================================================
-- 3. CHECK condicional idempotente: aprovação sempre referencia a versão
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_approved_requires_version'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_approved_requires_version
      CHECK (approval_status <> 'approved' OR approved_version_id IS NOT NULL);
  END IF;
END $$;

-- =============================================================================
-- 4. Índice único parcial — 1 approved por campaign_id
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS campaign_art_versions_one_approved_per_campaign
  ON public.campaign_art_versions (campaign_id) WHERE status = 'approved';

-- =============================================================================
-- 5. Seed da flag campaign_approval_enabled (enabled=false, padrão fail-closed)
--    Idempotente — ON CONFLICT (key) DO NOTHING.
-- =============================================================================
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'campaign_approval_enabled',
  false,
  'Quando ligada, campanhas novas entram no fluxo de revisao/aprovacao da arte antes da entrega (download + Kit de Publicacao). Campanhas antigas (sem versoes de arte) continuam entregues como hoje.'
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- DELETE FROM public.feature_flags WHERE key = 'campaign_approval_enabled';
-- DROP INDEX IF EXISTS public.campaign_art_versions_one_approved_per_campaign;
-- ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_approved_requires_version;
-- ALTER TABLE public.campaigns DROP COLUMN IF EXISTS approved_at;
-- ALTER TABLE public.campaigns DROP COLUMN IF EXISTS approved_version_id;
-- ALTER TABLE public.campaigns DROP COLUMN IF EXISTS rejection_count;
-- ALTER TABLE public.campaigns DROP COLUMN IF EXISTS approval_status;
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.campaign_art_versions FROM service_role;
-- DROP POLICY IF EXISTS "Service role can manage campaign art versions" ON public.campaign_art_versions;
-- ALTER TABLE public.campaign_art_versions DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS public.campaign_art_versions CASCADE;
