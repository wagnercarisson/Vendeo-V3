-- Create the campaigns table for campaign persistence
-- Supports generating/ready/error status flow
-- Uses specific trigger function (NOT generic)
-- Campaign is the core artifact of the v1.3 milestone

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'generating',
  product_name TEXT NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  identity_snapshot JSONB,
  generation_metadata JSONB,
  render_snapshot JSONB,
  publication_copy_snapshot JSONB,
  storage_path TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforce valid status values
  CONSTRAINT chk_campaigns_status CHECK (status IN ('generating', 'ready', 'error')),

  -- Enforce error_message is present when status = 'error'
  CONSTRAINT chk_campaigns_error_message CHECK (status <> 'error' OR nullif(trim(error_message), '') IS NOT NULL)
);

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on row change
CREATE TRIGGER trg_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_campaigns_updated_at();

-- Enable Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Owner SELECT policy: owner can see only their own store's campaigns
CREATE POLICY "owner_select_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

-- GRANT SELECT necessary for RLS to work with authenticated role
GRANT SELECT ON TABLE public.campaigns TO authenticated;

-- Index for store-based lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_store_id ON public.campaigns (store_id);

-- Index for chronological queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns (created_at DESC);

-- REVERT:
-- DROP INDEX IF EXISTS idx_campaigns_created_at;
-- DROP INDEX IF EXISTS idx_campaigns_store_id;
-- REVOKE SELECT ON TABLE public.campaigns FROM authenticated;
-- DROP POLICY IF EXISTS "owner_select_campaigns" ON public.campaigns;
-- ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
-- DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
-- DROP FUNCTION IF EXISTS public.update_campaigns_updated_at();
-- DROP TABLE IF EXISTS public.campaigns;
