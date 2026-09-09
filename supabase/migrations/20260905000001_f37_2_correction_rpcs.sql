-- Migration F37.2: RPCs de correção visual com referência (D7/D8)
-- Substituição transacional da candidata durante a regen (fatia 37.2):
--   1. begin_campaign_correction — reclama a candidata ativa 'pending' para
--      regeneração (lock campanha → cap → lock candidata → marca
--      correction_in_progress=true). Estado derivado passa a 'regenerating'.
--   2. cancel_campaign_correction — libera o marcador na falha técnica (sem
--      linha nova, sem consumo); no-op se nada marcado.
--   3. complete_campaign_regeneration — finalização ATÔMICA em um único bloco
--      plpgsql: INSERT da nova versão (v2/v3 pending/active) + anterior →
--      rejected/discarded + rejection_count++ (rollback automático em qualquer
--      falha — nada é descartado antes de a nova persistir, D8).
--
-- Sem colunas/CHECKs novos (schema 37.1 cobre tudo); sem backfill; sem
-- alteração de generation_events / chk_generation_events_type.
--
-- Segurança:
--   * SECURITY DEFINER + SET search_path = '' + identificadores schema-qualified
--     (padrão F37.1 approve_campaign_art_version).
--   * REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role.

-- =============================================================================
-- 1. Função begin_campaign_correction — reclama a candidata para regeneração
-- =============================================================================
-- 1. Lock da campanha (FOR UPDATE — serializa regen/approve concorrentes):
--    erro 'campaign_not_found' / 'campaign_not_ready' (status <> 'ready').
-- 2. Cap: rejection_count >= 2 → 'cap_reached' (painel D6 — nova campanha/suporte).
-- 3. Lock da candidata ativa 'pending' (única por campanha — 37.1):
--    'no_active_candidate' se ausente; 'correction_in_progress' se já reclamada
--    (concorrência/duplo clique → 409); 'cap_reached' se version_number >= 3.
-- 4. Marca correction_in_progress=true → estado derivado 'regenerating' (decisão 5).
-- 5. Retorna { version_id, version_number, storage_path, rejection_count }.
CREATE OR REPLACE FUNCTION public.begin_campaign_correction(
  p_campaign_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_rejection_count smallint;
  v_version_id uuid;
  v_version_number smallint;
  v_correction_in_progress boolean;
  v_storage_path text;
BEGIN
  -- 1. Lock da campanha (guarded — serializa com approve/complete)
  SELECT status, rejection_count
    INTO v_status, v_rejection_count
    FROM public.campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  IF v_status <> 'ready' THEN
    RAISE EXCEPTION 'campaign_not_ready';
  END IF;

  -- 2. Cap de correções (rejection_count 0..2 — 37.1)
  IF v_rejection_count >= 2 THEN
    RAISE EXCEPTION 'cap_reached';
  END IF;

  -- 3. Lock da candidata ativa pendente
  SELECT id, version_number, correction_in_progress, storage_path
    INTO v_version_id, v_version_number, v_correction_in_progress, v_storage_path
    FROM public.campaign_art_versions
   WHERE campaign_id = p_campaign_id
     AND status = 'pending'
     AND asset_status = 'active'
   ORDER BY version_number
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_candidate';
  END IF;

  IF v_correction_in_progress THEN
    RAISE EXCEPTION 'correction_in_progress';
  END IF;

  IF v_version_number >= 3 THEN
    RAISE EXCEPTION 'cap_reached';
  END IF;

  -- 4. Marca correção em andamento (guarded update — anti duplo clique)
  UPDATE public.campaign_art_versions
     SET correction_in_progress = true
   WHERE id = v_version_id;

  -- 5. Retorno para o caller (rota /regenerate)
  RETURN jsonb_build_object(
    'version_id', v_version_id,
    'version_number', v_version_number,
    'storage_path', v_storage_path,
    'rejection_count', v_rejection_count
  );
END;
$$;

-- =============================================================================
-- 2. Função cancel_campaign_correction — libera a candidata (falha técnica)
-- =============================================================================
-- Usada na falha técnica da regen (D37.2-6): libera o marcador da candidata
-- ativa 'pending' quando marcada, SEM alterar status/asset e SEM criar linha
-- nova — a anterior permanece aprovável e rejection_count fica inalterado.
-- 'no_active_candidate' se não houver candidata; no-op se não marcada.
CREATE OR REPLACE FUNCTION public.cancel_campaign_correction(
  p_campaign_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version_id uuid;
  v_correction_in_progress boolean;
BEGIN
  -- Lock da candidata ativa pendente (serializa com begin/complete)
  SELECT id, correction_in_progress
    INTO v_version_id, v_correction_in_progress
    FROM public.campaign_art_versions
   WHERE campaign_id = p_campaign_id
     AND status = 'pending'
     AND asset_status = 'active'
   ORDER BY version_number
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_candidate';
  END IF;

  -- No-op se nada marcado; libera caso contrário
  IF v_correction_in_progress THEN
    UPDATE public.campaign_art_versions
       SET correction_in_progress = false
     WHERE id = v_version_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =============================================================================
-- 3. Função complete_campaign_regeneration — finalização atômica (D8)
-- =============================================================================
-- UM bloco plpgsql (rollback automático em qualquer falha): a anterior só é
-- descartada depois de a nova versão ser persistida com sucesso — nada se
-- perde em substituição parcial (anti perda da candidata).
--   1. Lock campanha + candidata ativa 'pending' (mesmos guards do begin);
--      exige correction_in_progress=true ('correction_not_in_progress').
--   2. Valida p_version_number = candidata.version_number + 1 BETWEEN 2 AND 3
--      ('unexpected_version_number').
--   3. INSERT da nova linha (status='pending', asset_status='active',
--      storage_path/snapshots/metadata da regen).
--   4. Anterior → status='rejected', rejection_reason=p_rejection_reason,
--      asset_status='discarded', storage_path=NULL, asset_deleted_at=now(),
--      correction_in_progress=false (histórico textual preservado — D8).
--   5. campaigns.rejection_count + 1 (defensivo: já >= 2 → 'cap_reached').
CREATE OR REPLACE FUNCTION public.complete_campaign_regeneration(
  p_campaign_id uuid,
  p_version_number smallint,
  p_storage_path text,
  p_brief_snapshot jsonb,
  p_render_snapshot jsonb,
  p_generation_metadata jsonb,
  p_rejection_reason jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_rejection_count smallint;
  v_version_id uuid;
  v_version_number smallint;
  v_correction_in_progress boolean;
  v_new_version_id uuid;
BEGIN
  -- 1a. Lock da campanha (guarded — serializa com begin/approve)
  SELECT status, rejection_count
    INTO v_status, v_rejection_count
    FROM public.campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  IF v_status <> 'ready' THEN
    RAISE EXCEPTION 'campaign_not_ready';
  END IF;

  -- 1b. Lock da candidata ativa pendente + exige reclamação prévia
  SELECT id, version_number, correction_in_progress
    INTO v_version_id, v_version_number, v_correction_in_progress
    FROM public.campaign_art_versions
   WHERE campaign_id = p_campaign_id
     AND status = 'pending'
     AND asset_status = 'active'
   ORDER BY version_number
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_candidate';
  END IF;

  IF NOT v_correction_in_progress THEN
    RAISE EXCEPTION 'correction_not_in_progress';
  END IF;

  -- 2. Versão deve ser a próxima da sequência (atual + 1, entre 2 e 3)
  IF p_version_number <> v_version_number + 1
     OR p_version_number NOT BETWEEN 2 AND 3 THEN
    RAISE EXCEPTION 'unexpected_version_number';
  END IF;

  -- 3. Persiste a nova versão PRIMEIRO (nada é descartado antes disso — D8)
  INSERT INTO public.campaign_art_versions (
    campaign_id,
    version_number,
    status,
    asset_status,
    storage_path,
    brief_snapshot,
    render_snapshot,
    generation_metadata
  )
  VALUES (
    p_campaign_id,
    p_version_number,
    'pending',
    'active',
    p_storage_path,
    p_brief_snapshot,
    p_render_snapshot,
    p_generation_metadata
  )
  RETURNING id INTO v_new_version_id;

  -- 4. Anterior → rejected + asset descartado (linha preservada p/ histórico)
  UPDATE public.campaign_art_versions
     SET status = 'rejected',
         rejection_reason = p_rejection_reason,
         asset_status = 'discarded',
         storage_path = NULL,
         asset_deleted_at = now(),
         correction_in_progress = false
   WHERE id = v_version_id;

  -- 5. rejection_count++ (defensivo — já no cap → rollback de tudo)
  IF v_rejection_count >= 2 THEN
    RAISE EXCEPTION 'cap_reached';
  END IF;

  UPDATE public.campaigns
     SET rejection_count = v_rejection_count + 1
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object(
    'success', true,
    'version_id', v_new_version_id,
    'version_number', p_version_number
  );
END;
$$;

-- =============================================================================
-- 4. REVOKE/GRANT — execução apenas via service_role (padrão F37.1)
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.begin_campaign_correction(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_campaign_correction(uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_campaign_correction(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_campaign_correction(uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_campaign_regeneration(uuid, smallint, text, jsonb, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_campaign_regeneration(uuid, smallint, text, jsonb, jsonb, jsonb, jsonb)
  TO service_role;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.complete_campaign_regeneration(uuid, smallint, text, jsonb, jsonb, jsonb, jsonb) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.cancel_campaign_correction(uuid) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.begin_campaign_correction(uuid) FROM service_role;
-- DROP FUNCTION IF EXISTS public.complete_campaign_regeneration(uuid, smallint, text, jsonb, jsonb, jsonb, jsonb);
-- DROP FUNCTION IF EXISTS public.cancel_campaign_correction(uuid);
-- DROP FUNCTION IF EXISTS public.begin_campaign_correction(uuid);
