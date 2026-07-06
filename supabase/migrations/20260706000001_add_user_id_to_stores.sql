-- Migration: Add user_id to stores table with RLS
-- Destructive: Deletes all child table data + stores before adding column.

-- 1. Delete child table data (order matters: FK-dependent first)
DELETE FROM public.generation_events;
DELETE FROM public.store_brand_profiles;
DELETE FROM public.store_brand_assets;
DELETE FROM public.store_visual_signatures;

-- 2. Delete existing stores
DELETE FROM public.stores;

-- 3. Add user_id column
ALTER TABLE public.stores ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id);

-- 4. Enable Row Level Security
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policy for authenticated users
CREATE POLICY "users_select_own_store"
  ON public.stores
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 6. Grant SELECT to authenticated role (required for RLS to work with createServerClient)
GRANT SELECT ON TABLE public.stores TO authenticated;

-- REVERT:
-- REVOKE SELECT ON TABLE public.stores FROM authenticated;
-- DROP POLICY IF EXISTS "users_select_own_store" ON public.stores;
-- ALTER TABLE public.stores DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.stores DROP COLUMN user_id;
