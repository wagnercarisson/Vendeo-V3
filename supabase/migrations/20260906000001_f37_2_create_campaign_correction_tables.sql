-- Migration F37.2 M1: campaign_correction_reports + campaign_correction_submissions
-- Correção Única por Não Conformidade (D3/D6) — caso de correção (pai, 1 por campanha)
-- + tentativas (filha, 1 linha por tentativa). A filha NÃO guarda campaign_id (alcança
-- a campanha via report_id); a decisão corrente é a tentativa de maior attempt_number
-- (UNIQUE(report_id, attempt_number) — ordem determinística). Aprovação final NÃO é
-- espelhada no relato (derivada de campaigns/campaign_art_versions).
--
-- Inclui a evolução idempotente do CHECK de campaign_art_versions.asset_status
-- (acrescenta 'superseded', preservando 'active'|'discarded').
--
-- Segurança:
--   * Escrita/leitura apenas server-side via supabaseAdmin (service_role) — RLS
--     habilitada com policy somente para service_role (padrão F37.1/feature_flags F43).
--   * CHECKs semânticos da filha via blocos DO $$ idempotentes (ADD CONSTRAINT IF
--     NOT EXISTS não é portável no PostgreSQL/Supabase).
--   * Sem backfill. Migração idempotente e não destrutiva.
--   * NÃO toca nas RPCs dormentes de 20260905000001_f37_2_correction_rpcs.sql.

-- =============================================================================
-- 1. Tabela pai campaign_correction_reports (1 caso por campanha)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_correction_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  reported_version_id uuid NOT NULL REFERENCES public.campaign_art_versions(id),
  generated_version_id uuid REFERENCES public.campaign_art_versions(id),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','generation_started','v2_generated','failed_no_v2')),
  generation_started_at timestamptz,
  operation_run_id uuid,
  reviewed_by_support_at timestamptz,
  reviewed_by_support_user uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id)
);

ALTER TABLE public.campaign_correction_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage campaign correction reports"
  ON public.campaign_correction_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.campaign_correction_reports FROM anon;
REVOKE ALL ON TABLE public.campaign_correction_reports FROM authenticated;
REVOKE ALL ON TABLE public.campaign_correction_reports FROM service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.campaign_correction_reports
TO service_role;

-- =============================================================================
-- 2. Tabela filha campaign_correction_submissions (1 linha por tentativa)
--    Sem campaign_id — a campanha é alcançada via report_id.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_correction_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.campaign_correction_reports(id) ON DELETE CASCADE,
  attempt_number smallint NOT NULL,
  text text NOT NULL,
  analysis_state text NOT NULL DEFAULT 'analyzing'
    CHECK (analysis_state IN ('analyzing','eligible','blocked','unclear','analysis_failed')),
  category text,
  normalized_instruction text,
  analysis_expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (report_id, attempt_number)
);

ALTER TABLE public.campaign_correction_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage campaign correction submissions"
  ON public.campaign_correction_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.campaign_correction_submissions FROM anon;
REVOKE ALL ON TABLE public.campaign_correction_submissions FROM authenticated;
REVOKE ALL ON TABLE public.campaign_correction_submissions FROM service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.campaign_correction_submissions
TO service_role;

-- =============================================================================
-- 3. CHECKs semânticos da filha (defesa em profundidade — idempotentes)
-- =============================================================================
-- (a) completed_at só quando a tentativa saiu de 'analyzing'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_correction_submissions_completed_at_final'
      AND conrelid = 'public.campaign_correction_submissions'::regclass
  ) THEN
    ALTER TABLE public.campaign_correction_submissions
      ADD CONSTRAINT chk_correction_submissions_completed_at_final
      CHECK (completed_at IS NULL OR analysis_state <> 'analyzing');
  END IF;
END $$;

-- (b) eligible exige categoria + instrução normalizada não vazia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_correction_submissions_eligible_fields'
      AND conrelid = 'public.campaign_correction_submissions'::regclass
  ) THEN
    ALTER TABLE public.campaign_correction_submissions
      ADD CONSTRAINT chk_correction_submissions_eligible_fields
      CHECK (
        analysis_state <> 'eligible'
        OR (category IS NOT NULL
            AND normalized_instruction IS NOT NULL
            AND btrim(normalized_instruction) <> '')
      );
  END IF;
END $$;

-- (c) não-elegíveis não carregam campos de geração
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_correction_submissions_non_eligible_fields'
      AND conrelid = 'public.campaign_correction_submissions'::regclass
  ) THEN
    ALTER TABLE public.campaign_correction_submissions
      ADD CONSTRAINT chk_correction_submissions_non_eligible_fields
      CHECK (
        analysis_state NOT IN ('blocked','unclear','analysis_failed')
        OR (category IS NULL AND normalized_instruction IS NULL)
      );
  END IF;
END $$;

-- =============================================================================
-- 4. Índices (rate limit por created_at; leitura por report_id; pai por campaign_id)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_correction_reports_campaign_id
  ON public.campaign_correction_reports (campaign_id);

CREATE INDEX IF NOT EXISTS idx_correction_submissions_report_id
  ON public.campaign_correction_submissions (report_id);

CREATE INDEX IF NOT EXISTS idx_correction_submissions_created_at
  ON public.campaign_correction_submissions (created_at);

-- =============================================================================
-- 5. Evolução idempotente do CHECK de campaign_art_versions.asset_status
--    Acrescenta 'superseded' preservando 'active'|'discarded'. Nenhum dado alterado.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_art_versions_asset_status_check'
      AND conrelid = 'public.campaign_art_versions'::regclass
  ) THEN
    ALTER TABLE public.campaign_art_versions
      DROP CONSTRAINT campaign_art_versions_asset_status_check;
  END IF;

  ALTER TABLE public.campaign_art_versions
    ADD CONSTRAINT campaign_art_versions_asset_status_check
    CHECK (asset_status IN ('active','discarded','superseded'));
END $$;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- -- Retorna o CHECK de asset_status ao estado F37.1 (2 valores):
-- DO $$
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'campaign_art_versions_asset_status_check'
--       AND conrelid = 'public.campaign_art_versions'::regclass
--   ) THEN
--     ALTER TABLE public.campaign_art_versions
--       DROP CONSTRAINT campaign_art_versions_asset_status_check;
--   END IF;
--   ALTER TABLE public.campaign_art_versions
--     ADD CONSTRAINT campaign_art_versions_asset_status_check
--     CHECK (asset_status IN ('active','discarded'));
-- END $$;
-- DROP INDEX IF EXISTS public.idx_correction_submissions_created_at;
-- DROP INDEX IF EXISTS public.idx_correction_submissions_report_id;
-- DROP INDEX IF EXISTS public.idx_correction_reports_campaign_id;
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.campaign_correction_submissions FROM service_role;
-- DROP POLICY IF EXISTS "Service role can manage campaign correction submissions" ON public.campaign_correction_submissions;
-- ALTER TABLE public.campaign_correction_submissions DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS public.campaign_correction_submissions CASCADE;
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.campaign_correction_reports FROM service_role;
-- DROP POLICY IF EXISTS "Service role can manage campaign correction reports" ON public.campaign_correction_reports;
-- ALTER TABLE public.campaign_correction_reports DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS public.campaign_correction_reports CASCADE;
