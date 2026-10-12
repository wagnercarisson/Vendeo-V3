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
-- (UPDATE/DELETE rejected) and readable/writable only by `service_role`. A
-- `BEFORE INSERT` trigger enforces that the evidence's `campaign_id` matches the
-- campaign of the referenced snapshot (F3).
--
-- It also adds the b1b-owned `public.product_1_1_snapshot_content_binding` — the
-- PERSISTED comparison source (content fingerprint) required for controlled
-- pre-reservation recovery — plus the RPC `product_1_1_persist_snapshot_with_binding`,
-- which writes the snapshot row and the binding row ATOMICALLY (single transaction),
-- so no "snapshot without binding" state can exist (only "snapshot+binding without
-- evidence" is possible).
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

-- Campaign<->snapshot link (F3): both references are independently protected by
-- foreign keys, but the evidence must belong to the SAME campaign as the snapshot
-- it freezes. Mirrors `trg_image_generation_operations_snapshot_campaign`
-- (migration 20261006000002). Keep this validation local to the new relation; do
-- not alter the snapshot row/schema.
CREATE OR REPLACE FUNCTION public.trg_product_1_1_frozen_evidence_snapshot_campaign_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Leave missing IDs to their respective FK constraints so each FK keeps its
  -- own deterministic failure. Reject only when both referenced rows exist but
  -- the snapshot belongs to a different campaign than the evidence.
  IF EXISTS (
       SELECT 1
       FROM public.campaigns AS campaign_row
       WHERE campaign_row.id = NEW.campaign_id
     )
     AND EXISTS (
       SELECT 1
       FROM public.image_generation_config_snapshots AS snapshot_row
       WHERE snapshot_row.id = NEW.snapshot_original_id
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.image_generation_config_snapshots AS snapshot_row
       WHERE snapshot_row.id = NEW.snapshot_original_id
         AND snapshot_row.campaign_id = NEW.campaign_id
     ) THEN
    RAISE EXCEPTION 'product_1_1_snapshot_frozen_evidence_snapshot_campaign_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_1_1_frozen_evidence_snapshot_campaign
BEFORE INSERT ON public.product_1_1_snapshot_frozen_evidence
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_1_1_frozen_evidence_snapshot_campaign_fn();

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
-- B1B-owned content binding (F2) — persisted comparison source for the controlled
-- pre-reservation recovery. One row per original snapshot; it proves that the
-- content received on a later (repair) call is EQUIVALENT to the content frozen at
-- the first write. Immutable by trigger; RLS service_role (SELECT/INSERT only); the
-- campaign<->snapshot link (F3) is enforced by a trigger mirroring the frozen
-- evidence trigger above.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_1_1_snapshot_content_binding (
  snapshot_original_id  UUID PRIMARY KEY REFERENCES public.image_generation_config_snapshots(id),
  campaign_id           UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id          UUID NOT NULL,
  content_fingerprint   TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_p1_1_snapshot_content_binding_identity UNIQUE (campaign_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_p1_1_snapshot_content_binding_campaign
  ON public.product_1_1_snapshot_content_binding (campaign_id);

-- Immutability: the binding can never be rewritten after it is recorded.
CREATE OR REPLACE FUNCTION public.trg_product_1_1_snapshot_content_binding_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'product_1_1_snapshot_content_binding_immutable';
END;
$$;

CREATE TRIGGER trg_product_1_1_snapshot_content_binding_immutable
BEFORE UPDATE OR DELETE ON public.product_1_1_snapshot_content_binding
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_1_1_snapshot_content_binding_immutable_fn();

-- Campaign<->snapshot link (F3): the binding must belong to the SAME campaign as
-- the snapshot it binds. Mirrors `trg_product_1_1_frozen_evidence_snapshot_campaign`.
CREATE OR REPLACE FUNCTION public.trg_product_1_1_snapshot_content_binding_snapshot_campaign_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
       SELECT 1
       FROM public.campaigns AS campaign_row
       WHERE campaign_row.id = NEW.campaign_id
     )
     AND EXISTS (
       SELECT 1
       FROM public.image_generation_config_snapshots AS snapshot_row
       WHERE snapshot_row.id = NEW.snapshot_original_id
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.image_generation_config_snapshots AS snapshot_row
       WHERE snapshot_row.id = NEW.snapshot_original_id
         AND snapshot_row.campaign_id = NEW.campaign_id
     ) THEN
    RAISE EXCEPTION 'product_1_1_snapshot_content_binding_snapshot_campaign_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_1_1_snapshot_content_binding_snapshot_campaign
BEFORE INSERT ON public.product_1_1_snapshot_content_binding
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_1_1_snapshot_content_binding_snapshot_campaign_fn();

ALTER TABLE public.product_1_1_snapshot_content_binding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read/insert product 1:1 snapshot content binding"
  ON public.product_1_1_snapshot_content_binding;
CREATE POLICY "Service role can read/insert product 1:1 snapshot content binding"
  ON public.product_1_1_snapshot_content_binding FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.product_1_1_snapshot_content_binding FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_snapshot_content_binding FROM service_role;
GRANT SELECT, INSERT ON TABLE public.product_1_1_snapshot_content_binding TO service_role;

-- =============================================================================
-- Atomic snapshot + binding write (F2). SECURITY DEFINER, search_path=''. In a
-- SINGLE transaction it ensures the snapshot row (idempotent by `campaign_id`) and
-- the binding row, so no "snapshot without binding" state can ever exist (only
-- "snapshot+binding without evidence" is possible). Idempotent and race-safe:
-- reuses an existing snapshot/binding ONLY when equivalent; a divergent
-- `content_fingerprint` for the same (campaign_id, operation_id), or a snapshot
-- belonging to a different pair/config, raises `operation_identity_conflict`.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.product_1_1_persist_snapshot_with_binding(
  p_campaign_id         UUID,
  p_primary_model       TEXT,
  p_primary_quality     TEXT,
  p_fallback_model      TEXT,
  p_fallback_quality    TEXT,
  p_config_version_id   UUID,
  p_origin              TEXT,
  p_operation_id        UUID,
  p_content_fingerprint TEXT,
  p_run_id              UUID DEFAULT NULL,
  p_trace_id            TEXT DEFAULT NULL
)
RETURNS TABLE (
  snapshot_original_id UUID,
  reused               BOOLEAN,
  content_fingerprint  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot_id     UUID;
  v_binding_rows    INTEGER;
BEGIN
  IF p_content_fingerprint IS NULL OR p_content_fingerprint = '' THEN
    RAISE EXCEPTION 'content_fingerprint_required';
  END IF;

  -- 1. Ensure the snapshot row (idempotent by UNIQUE campaign_id). ON CONFLICT
  --    DO NOTHING also resolves concurrent inserters safely.
  INSERT INTO public.image_generation_config_snapshots (
    campaign_id, primary_model, primary_quality, fallback_model, fallback_quality,
    config_version_id, origin, run_id, trace_id
  ) VALUES (
    p_campaign_id, p_primary_model, p_primary_quality, p_fallback_model, p_fallback_quality,
    p_config_version_id, p_origin, p_run_id, p_trace_id
  )
  ON CONFLICT DO NOTHING;

  SELECT s.id INTO v_snapshot_id
    FROM public.image_generation_config_snapshots AS s
    WHERE s.campaign_id = p_campaign_id;

  IF v_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'snapshot_persist_failed';
  END IF;

  -- 2. Reuse the frozen snapshot ONLY when the pair/config/origin is equivalent.
  IF NOT EXISTS (
    SELECT 1
    FROM public.image_generation_config_snapshots AS s
    WHERE s.id = v_snapshot_id
      AND s.primary_model = p_primary_model
      AND s.primary_quality = p_primary_quality
      AND s.fallback_model = p_fallback_model
      AND s.fallback_quality = p_fallback_quality
      AND s.config_version_id = p_config_version_id
      AND s.origin = p_origin
  ) THEN
    RAISE EXCEPTION 'operation_identity_conflict';
  END IF;

  -- 3. Ensure the binding row (atomic with the snapshot; same transaction).
  INSERT INTO public.product_1_1_snapshot_content_binding (
    snapshot_original_id, campaign_id, operation_id, content_fingerprint
  ) VALUES (
    v_snapshot_id, p_campaign_id, p_operation_id, p_content_fingerprint
  )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_binding_rows = ROW_COUNT;

  -- 4. Race-safe equivalence check: the persisted binding MUST match the request
  --    (same snapshot, same operation, same content fingerprint).
  IF NOT EXISTS (
    SELECT 1
    FROM public.product_1_1_snapshot_content_binding AS b
    WHERE b.snapshot_original_id = v_snapshot_id
      AND b.campaign_id = p_campaign_id
      AND b.operation_id = p_operation_id
      AND b.content_fingerprint = p_content_fingerprint
  ) THEN
    RAISE EXCEPTION 'operation_identity_conflict';
  END IF;

  RETURN QUERY
    SELECT v_snapshot_id, (v_binding_rows = 0), p_content_fingerprint;
END;
$$;

REVOKE ALL ON FUNCTION public.product_1_1_persist_snapshot_with_binding(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_persist_snapshot_with_binding(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, UUID, TEXT
) TO service_role;

-- =============================================================================
-- REVERT (reverse order; run manually only on the isolated local instance)
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.product_1_1_persist_snapshot_with_binding(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, UUID, TEXT);
-- DROP TRIGGER IF EXISTS trg_product_1_1_snapshot_content_binding_snapshot_campaign
--   ON public.product_1_1_snapshot_content_binding;
-- DROP FUNCTION IF EXISTS public.trg_product_1_1_snapshot_content_binding_snapshot_campaign_fn();
-- DROP TRIGGER IF EXISTS trg_product_1_1_snapshot_content_binding_immutable
--   ON public.product_1_1_snapshot_content_binding;
-- DROP FUNCTION IF EXISTS public.trg_product_1_1_snapshot_content_binding_immutable_fn();
-- DROP POLICY IF EXISTS "Service role can read/insert product 1:1 snapshot content binding"
--   ON public.product_1_1_snapshot_content_binding;
-- DROP INDEX IF EXISTS public.idx_p1_1_snapshot_content_binding_campaign;
-- DROP TABLE IF EXISTS public.product_1_1_snapshot_content_binding;
-- =============================================================================
-- REVERT (reverse order; run manually only on the isolated local instance) — frozen evidence
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_product_1_1_frozen_evidence_snapshot_campaign
--   ON public.product_1_1_snapshot_frozen_evidence;
-- DROP FUNCTION IF EXISTS public.trg_product_1_1_frozen_evidence_snapshot_campaign_fn();
-- DROP TRIGGER IF EXISTS trg_product_1_1_frozen_evidence_immutable
--   ON public.product_1_1_snapshot_frozen_evidence;
-- DROP FUNCTION IF EXISTS public.trg_product_1_1_frozen_evidence_immutable_fn();
-- DROP POLICY IF EXISTS "Service role can read/insert product 1:1 frozen evidence"
--   ON public.product_1_1_snapshot_frozen_evidence;
-- DROP INDEX IF EXISTS public.idx_p1_1_frozen_evidence_campaign_operation;
-- DROP TABLE IF EXISTS public.product_1_1_snapshot_frozen_evidence;
