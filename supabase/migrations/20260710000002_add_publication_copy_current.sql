-- Add publication_copy_current column to campaigns table
-- Stores the user-edited version of publication copy
-- Falls back to publication_copy_snapshot when null

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS publication_copy_current JSONB;

COMMENT ON COLUMN public.campaigns.publication_copy_current IS
  'Versão editada pelo usuário do publication copy. Se null, usar publication_copy_snapshot como fallback.';

-- REVERT:
-- ALTER TABLE public.campaigns DROP COLUMN IF EXISTS publication_copy_current;
