-- Add identity_state and related fields to stores and store_brand_profiles
-- Supports text_only identity state for stores without logo or visual signature

-- stores: identity state machine columns
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS identity_state TEXT NOT NULL DEFAULT 'text_only';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS text_only_origin TEXT NOT NULL DEFAULT 'implicit';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS manual_color_override BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS previous_identity_snapshot JSONB;

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_identity_state;
ALTER TABLE public.stores ADD CONSTRAINT chk_stores_identity_state CHECK (identity_state IN ('text_only', 'logo', 'visual_signature'));

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_text_only_origin;
ALTER TABLE public.stores ADD CONSTRAINT chk_stores_text_only_origin CHECK (text_only_origin IN ('implicit', 'explicit'));

-- store_brand_profiles: manual_color_override and updated source check
ALTER TABLE public.store_brand_profiles ADD COLUMN IF NOT EXISTS manual_color_override JSONB NOT NULL DEFAULT '{"enabled": false}';

ALTER TABLE public.store_brand_profiles DROP CONSTRAINT IF EXISTS chk_store_brand_profiles_source;
ALTER TABLE public.store_brand_profiles ADD CONSTRAINT chk_store_brand_profiles_source CHECK (source IN ('logo_analysis', 'without_logo', 'text_only'));

-- REVERT:
-- ALTER TABLE public.store_brand_profiles DROP CONSTRAINT IF EXISTS chk_store_brand_profiles_source;
-- ALTER TABLE public.store_brand_profiles ADD CONSTRAINT chk_store_brand_profiles_source CHECK (source IN ('logo_analysis', 'without_logo'));
-- ALTER TABLE public.store_brand_profiles DROP COLUMN IF EXISTS manual_color_override;
-- ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_text_only_origin;
-- ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_identity_state;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS previous_identity_snapshot;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS manual_color_override;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS text_only_origin;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS identity_state;
