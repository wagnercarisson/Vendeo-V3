-- Migration F48.2.1 — Otimização dos Prompts do Diretor (design D2/D4/D5/D11)
--
-- LOCAL-FIRST: esta migration é criada e validada SOMENTE no Supabase local
-- (`npx supabase db reset` + `npx supabase db lint`). NÃO há `db push` remoto
-- nesta fase — o push remoto deliberado pertence à F48.2.3. O schema remoto
-- permanece inerte (VENDEO_LAB_ENABLED=false).
--
-- Migration estritamente ADITIVA: nenhum DROP/ALTER de objeto produtivo. A única
-- exceção de DROP permitida é a das assinaturas F48.1 do PRÓPRIO laboratório
-- (`lab_reserve_run` de 8 args e `lab_create_experiment` de 12 args), substituídas
-- de forma aditiva para não deixar overload callable que contorne
-- programa/orçamento/intent.
--
-- Escopo:
--   * nova tabela `lab_prompt_programs` (programa, checkpoints e orçamento);
--   * `lab_experiments.campaign_intent` (backfill 'offer' + NOT NULL + CHECK) e
--     `lab_experiments.program_id` (FK para o programa);
--   * `lab_human_evaluations.rubric` (rubrica estruturada);
--   * `lab_runs.reserved_cost_usd`/`lab_runs.budget_settled_at` (settle do run);
--   * congelamento pós-run estendido para `campaign_intent`/`program_id`;
--   * `lab_create_experiment` recriada com `campaign_intent`/`program_id`.
--
-- Proibido: tocar qualquer objeto produtivo (campanhas, arte, telemetria,
-- seleção/catálogo de modelos, auditoria administrativa), o bucket de imagens de
-- campanha ou `prompts/`.

-- =============================================================================
-- 1. public.lab_prompt_programs — programa, checkpoints e orçamento (D2)
--    `matrix_version` é o rótulo textual da versão aprovada da matriz; a
--    associação aos nove cenários é feita pelas versões de cenário já existentes
--    (`lab_scenario_versions`) — sem duplicar conteúdo nem criar tabela nova.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_prompt_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','authorized','closed')),
  budget_usd NUMERIC(12,6),
  budget_reserved_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  budget_consumed_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  budget_authorized_by UUID REFERENCES auth.users(id),
  budget_authorized_at TIMESTAMPTZ,
  final_report_ref TEXT,
  final_report_hash TEXT,
  recommendation JSONB,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_prompt_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage lab_prompt_programs"
  ON public.lab_prompt_programs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE public.lab_prompt_programs FROM anon;
REVOKE ALL ON TABLE public.lab_prompt_programs FROM authenticated;
REVOKE ALL ON TABLE public.lab_prompt_programs FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_prompt_programs TO service_role;

-- =============================================================================
-- 2. lab_experiments.campaign_intent — tipo de campanha (D2/D4)
--    Ordem obrigatória: ADD COLUMN nullable -> backfill 'offer' -> NOT NULL ->
--    CHECK. Os registros da F48.1 eram todos de oferta.
-- =============================================================================
ALTER TABLE public.lab_experiments ADD COLUMN IF NOT EXISTS campaign_intent TEXT;

UPDATE public.lab_experiments SET campaign_intent = 'offer' WHERE campaign_intent IS NULL;

ALTER TABLE public.lab_experiments ALTER COLUMN campaign_intent SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lab_experiments_campaign_intent_check'
      AND conrelid = 'public.lab_experiments'::regclass
  ) THEN
    ALTER TABLE public.lab_experiments
      ADD CONSTRAINT lab_experiments_campaign_intent_check
      CHECK (campaign_intent IN ('offer','spotlight','exclusive'));
  END IF;
END $$;

-- =============================================================================
-- 3. lab_experiments.program_id — vínculo ao programa (D2)
--    Nullable no banco para preservar as linhas históricas da F48.1; a
--    obrigatoriedade para novos experimentos é do domínio/API (e da RPC
--    lab_create_experiment), não do NOT NULL do banco.
-- =============================================================================
ALTER TABLE public.lab_experiments
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.lab_prompt_programs(id);

-- =============================================================================
-- 4. lab_runs — colunas de resultado do settle de orçamento (D2)
--    Necessárias ao settle/release idempotente: o valor reservado no run e o
--    instante em que a reserva foi liquidada.
-- =============================================================================
ALTER TABLE public.lab_runs ADD COLUMN IF NOT EXISTS reserved_cost_usd NUMERIC(12,6);
ALTER TABLE public.lab_runs ADD COLUMN IF NOT EXISTS budget_settled_at TIMESTAMPTZ;

-- =============================================================================
-- 5. lab_human_evaluations.rubric — rubrica estruturada (D7)
-- =============================================================================
ALTER TABLE public.lab_human_evaluations ADD COLUMN IF NOT EXISTS rubric JSONB;

-- =============================================================================
-- 6. Congelamento pós-run estendido — campaign_intent/program_id (D2/DV-2)
--    A função é substituída; o trigger `trg_lab_experiments_freeze` existente
--    continua válido.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trg_lab_experiments_freeze_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.model_target IS DISTINCT FROM OLD.model_target
     OR NEW.params IS DISTINCT FROM OLD.params
     OR NEW.changed_dimension IS DISTINCT FROM OLD.changed_dimension
     OR NEW.primary_capability IS DISTINCT FROM OLD.primary_capability
     OR NEW.repetitions IS DISTINCT FROM OLD.repetitions
     OR NEW.max_runs IS DISTINCT FROM OLD.max_runs
     OR NEW.campaign_intent IS DISTINCT FROM OLD.campaign_intent
     OR NEW.program_id IS DISTINCT FROM OLD.program_id THEN
    IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = OLD.id) THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 7. lab_create_experiment — assinatura nova de 14 args (DV-1/DV-6)
--    A assinatura F48.1 de 12 args é removida À FRENTE (não apenas no REVERT):
--    um CREATE OR REPLACE com lista nova criaria um overload callable que
--    permitiria criar experimento sem intent/programa.
-- =============================================================================
DROP FUNCTION IF EXISTS public.lab_create_experiment(TEXT, TEXT, TEXT, JSONB, JSONB, INT, INT, TEXT, JSONB, JSONB, UUID[], UUID);

CREATE OR REPLACE FUNCTION public.lab_create_experiment(
  p_name TEXT,
  p_objective TEXT,
  p_hypothesis TEXT,
  p_model_target JSONB,
  p_params JSONB,
  p_repetitions INT,
  p_max_runs INT,
  p_notes TEXT,
  p_baseline_prompt JSONB,
  p_candidate_prompt JSONB,
  p_scenario_version_ids UUID[],
  p_campaign_intent TEXT,
  p_program_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_experiment_id UUID;
  v_scenario_count INT;
BEGIN
  v_scenario_count := COALESCE(cardinality(p_scenario_version_ids), 0);

  IF p_repetitions IS NULL OR p_repetitions < 1 OR p_repetitions > 3
     OR p_max_runs IS NULL OR p_max_runs < 1 OR p_max_runs > 12
     OR v_scenario_count < 1 OR v_scenario_count > 3
     OR p_name IS NULL OR btrim(p_name) = ''
     OR p_objective IS NULL OR btrim(p_objective) = ''
     OR p_hypothesis IS NULL OR btrim(p_hypothesis) = ''
     OR p_model_target IS NULL OR p_params IS NULL
     OR p_baseline_prompt IS NULL OR p_candidate_prompt IS NULL
     OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'invalid_experiment_input';
  END IF;

  IF p_campaign_intent IS NULL
     OR p_campaign_intent NOT IN ('offer','spotlight','exclusive') THEN
    RAISE EXCEPTION 'unsupported_campaign_intent';
  END IF;

  IF p_program_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.lab_prompt_programs WHERE id = p_program_id) THEN
    RAISE EXCEPTION 'program_not_authorized';
  END IF;

  -- (1) Experimento: dimensão fixa 'prompt' e capacidade fixa 'campaign_image'.
  INSERT INTO public.lab_experiments (
    name, objective, hypothesis, changed_dimension, primary_capability,
    model_target, params, status, repetitions, max_runs, notes,
    campaign_intent, program_id, created_by
  ) VALUES (
    btrim(p_name), btrim(p_objective), btrim(p_hypothesis), 'prompt', 'campaign_image',
    p_model_target, p_params, 'draft', p_repetitions, p_max_runs, p_notes,
    p_campaign_intent, p_program_id, p_actor_id
  )
  RETURNING id INTO v_experiment_id;

  -- (2) Exatamente 2 variantes: baseline (prompt oficial) e candidate (override).
  INSERT INTO public.lab_experiment_variants (experiment_id, role, label, prompt_snapshot)
  VALUES
    (v_experiment_id, 'baseline', 'Baseline', p_baseline_prompt),
    (v_experiment_id, 'candidate', 'Candidata', p_candidate_prompt);

  -- (3) Cenários do experimento, em ordem (position = índice, 1-based).
  FOR v_position IN 1..v_scenario_count LOOP
    INSERT INTO public.lab_experiment_scenarios (experiment_id, scenario_version_id, position)
    VALUES (v_experiment_id, p_scenario_version_ids[v_position], v_position);
  END LOOP;

  RETURN jsonb_build_object('experiment_id', v_experiment_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lab_create_experiment(TEXT, TEXT, TEXT, JSONB, JSONB, INT, INT, TEXT, JSONB, JSONB, UUID[], TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_create_experiment(TEXT, TEXT, TEXT, JSONB, JSONB, INT, INT, TEXT, JSONB, JSONB, UUID[], TEXT, UUID, UUID) TO service_role;
