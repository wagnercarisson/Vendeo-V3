-- =============================================================================
-- F44.1.1 — Referência Visual do Tema (gap closure contido)
--
-- A PRIMEIRA campanha que atinge status 'ready' de um Tema vira a referência
-- visual canônica desse Tema (`theme_visual_reference_campaign_id`); todas as
-- campanhas seguintes do MESMO Tema enviam essa imagem apenas ao Diretor de
-- Arte (persistência visual sem cópia rígida de layout).
--
-- Blocos:
--   1. Coluna `theme_visual_reference_campaign_id` (uuid NULL) + FK
--      ON DELETE SET NULL (idempotente via information_schema) + índice.
--   2. RPC transacional `claim_theme_visual_reference` (SECURITY DEFINER,
--      search_path='') — claim ATÔMICO: apenas a primeira campanha ready
--      ocupa o campo enquanto NULL; uma referência existente NUNCA é
--      substituída (sem chaining / sem troca automática).
--
-- Regras:
--   - Sem backfill; sem UI de troca/remoção; tema ativo congelado permanece
--     imutável (essentials/direction nunca são alterados por esta feature).
--   - Validações de ownership/status são server-side (rota) E revalidadas na
--     RPC (fail-closed): tema deve existir, ser da loja e `active`; campanha
--     deve existir, ser da loja e `ready`.
--   - O campo é nullável; campanhas/temas legados permanecem compatíveis.
-- =============================================================================

-- =============================================================================
-- 1. Coluna + FK + índice (idempotentes)
-- =============================================================================
ALTER TABLE public.store_campaign_themes
  ADD COLUMN IF NOT EXISTS theme_visual_reference_campaign_id UUID NULL;

-- FK adicionada somente se ainda não existir (guarda information_schema para
-- idempotência — padrão de migrações reversíveis do repositório).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'store_campaign_themes'
      AND constraint_name = 'fk_store_campaign_themes_theme_visual_reference'
  ) THEN
    ALTER TABLE public.store_campaign_themes
      ADD CONSTRAINT fk_store_campaign_themes_theme_visual_reference
      FOREIGN KEY (theme_visual_reference_campaign_id)
      REFERENCES public.campaigns(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_store_campaign_themes_visual_reference
  ON public.store_campaign_themes (theme_visual_reference_campaign_id)
  WHERE theme_visual_reference_campaign_id IS NOT NULL;

-- =============================================================================
-- 2. RPC transacional claim_theme_visual_reference
-- =============================================================================
CREATE OR REPLACE FUNCTION public.claim_theme_visual_reference(
  p_theme_id UUID,
  p_campaign_id UUID,
  p_store_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reference_id UUID;
BEGIN
  -- Validações de ownership/status (fail-closed): tema da loja e `active`.
  IF NOT EXISTS (
    SELECT 1 FROM public.store_campaign_themes
    WHERE id = p_theme_id AND store_id = p_store_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'theme_invalid');
  END IF;

  -- Campanha da loja e `ready` (a referência precisa de imagem persistida).
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = p_campaign_id AND store_id = p_store_id AND status = 'ready'
  ) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'campaign_invalid');
  END IF;

  -- PERTENCIMENTO AO MESMO Tema (fail-closed): a campanha só pode ser
  -- referência visual do Tema no qual foi gerada (`input_snapshot` →
  -- `creativeContext.themeId`). Campanha da mesma loja de OUTRO Tema é
  -- rejeitada — impede referência cruzada entre temas. Comparação TEXTUAL
  -- (sem cast para UUID): snapshot legado/malformado com texto não UUID não
  -- lança exceção SQL — vira `campaign_theme_mismatch` (fail-closed).
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = p_campaign_id
      AND input_snapshot -> 'creativeContext' ->> 'themeId' = p_theme_id::text
  ) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'campaign_theme_mismatch');
  END IF;

  -- Claim ATÔMICO: só ocupa o campo enquanto NULL. Uma referência existente
  -- nunca é substituída (sem chaining; sempre a mesma referência canônica).
  UPDATE public.store_campaign_themes
  SET theme_visual_reference_campaign_id = p_campaign_id
  WHERE id = p_theme_id
    AND theme_visual_reference_campaign_id IS NULL
  RETURNING theme_visual_reference_campaign_id INTO v_reference_id;

  IF v_reference_id IS NULL THEN
    -- Já existe referência (ou corrida perdida): devolve a referência vigente.
    SELECT theme_visual_reference_campaign_id INTO v_reference_id
    FROM public.store_campaign_themes
    WHERE id = p_theme_id;
    RETURN jsonb_build_object(
      'claimed', false,
      'already_claimed', true,
      'reference_campaign_id', v_reference_id
    );
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'reference_campaign_id', v_reference_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_theme_visual_reference(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_theme_visual_reference(UUID, UUID, UUID) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.claim_theme_visual_reference(UUID, UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.claim_theme_visual_reference(UUID, UUID, UUID);
-- DROP INDEX IF EXISTS idx_store_campaign_themes_visual_reference;
-- ALTER TABLE public.store_campaign_themes
--   DROP CONSTRAINT IF EXISTS fk_store_campaign_themes_theme_visual_reference;
-- ALTER TABLE public.store_campaign_themes
--   DROP COLUMN IF EXISTS theme_visual_reference_campaign_id;
