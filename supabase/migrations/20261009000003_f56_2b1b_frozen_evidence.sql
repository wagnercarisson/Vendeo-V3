-- F56.2b1b — Evidência congelada do snapshot do Produto 1:1 (Plano 02)
-- This migration is LOCAL-ONLY and is only AUTHORED here. Do NOT run
-- `supabase db push` (nor any remote mutation). Apply exclusively to the
-- isolated, disposable instance via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- and only in Plan 09 (O2). Applying it elsewhere is out of scope.
--
-- Relation `public.product_1_1_snapshot_frozen_evidence` freezes — per snapshot
-- (one row per original snapshot) — the briefing, the references/selections
-- (intent, background direction, images) and the composition versions
-- (base/composer/policies), plus the persisted operation association
-- (`campaign_id` + `operation_id`, contract C3 / F6). It is immutable by trigger
-- (UPDATE/DELETE rejected) and readable/writable only by `service_role`.
--
-- Reuse boundary: does NOT alter `campaigns`, `image_generation_config_snapshots`
-- or any legacy table/column; it only REFERENCES the existing snapshot relation.

CREATE TABLE IF NOT EXISTS public.product_1_1_snapshot_frozen_evidence (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_original_id  UUID NOT NULL UNIQUE REFERENCES public.image_generation_config_snapshots(id),
  campaign_id           UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id          UUID NOT NULL,
  campaign_intent       TEXT NOT NULL,
  background_direction  TEXT NOT NULL CHECK (background_direction IN ('studio','ambient','original')),
  briefing              TEXT NOT NULL,
  reference_selections  JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_version          TEXT NOT NULL,
  composer_version      TEXT NOT NULL,
  policy_versions       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_p1_1_frozen_evidence_identity UNIQUE (campaign_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_p1_1_frozen_evidence_campaign_operation
  ON public.product_1_1_snapshot_frozen_evidence (campaign_id, operation_id);

-- Immutability: frozen evidence can never be rewritten after it is recorded.
CREATE OR REPLACE FUNCTION public.trg_product_1_1_frozen_evidence_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'product_1_1_snapshot_frozen_evidence_immutable';
END;
$$;

CREATE TRIGGER trg_product_1_1_frozen_evidence_immutable
BEFORE UPDATE OR DELETE ON public.product_1_1_snapshot_frozen_evidence
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_1_1_frozen_evidence_immutable_fn();

ALTER TABLE public.product_1_1_snapshot_frozen_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read/insert product 1:1 frozen evidence"
  ON public.product_1_1_snapshot_frozen_evidence;
CREATE POLICY "Service role can read/insert product 1:1 frozen evidence"
  ON public.product_1_1_snapshot_frozen_evidence FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.product_1_1_snapshot_frozen_evidence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_snapshot_frozen_evidence FROM service_role;
GRANT SELECT, INSERT ON TABLE public.product_1_1_snapshot_frozen_evidence TO service_role;

-- =============================================================================
-- REVERT (reverse order; run manually only on the isolated local instance)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_product_1_1_frozen_evidence_immutable
--   ON public.product_1_1_snapshot_frozen_evidence;
-- DROP FUNCTION IF EXISTS public.trg_product_1_1_frozen_evidence_immutable_fn();
-- DROP POLICY IF EXISTS "Service role can read/insert product 1:1 frozen evidence"
--   ON public.product_1_1_snapshot_frozen_evidence;
-- DROP INDEX IF EXISTS public.idx_p1_1_frozen_evidence_campaign_operation;
-- DROP TABLE IF EXISTS public.product_1_1_snapshot_frozen_evidence;
