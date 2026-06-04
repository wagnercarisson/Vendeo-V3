-- Create generation_events table for tracking AI generation metrics (Phase 4.4.2)
-- Records structured events for visual signatures and brand profile generations
-- Best-effort insert — never blocks the generation pipeline

CREATE TABLE IF NOT EXISTS public.generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  generation_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  duration_ms INTEGER,
  estimated_cost_usd REAL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  error_type TEXT,
  prompt_version TEXT,
  approved BOOLEAN,
  rejected BOOLEAN,
  asset_generated BOOLEAN,
  asset_id UUID,
  has_logo BOOLEAN,
  has_generated_signature BOOLEAN,
  has_brand_profile BOOLEAN,
  input_data_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_generation_events_type
    CHECK (generation_type IN ('visual_signature', 'brand_profile_without_logo', 'brand_profile_with_logo')),
  CONSTRAINT chk_generation_events_status
    CHECK (status IN ('success', 'failed', 'rejected', 'timeout'))
);

CREATE INDEX IF NOT EXISTS idx_generation_events_store_id
  ON public.generation_events (store_id);

CREATE INDEX IF NOT EXISTS idx_generation_events_type
  ON public.generation_events (generation_type);

CREATE INDEX IF NOT EXISTS idx_generation_events_created_at
  ON public.generation_events (created_at);

-- REVERT:
-- DROP TABLE IF EXISTS public.generation_events;
