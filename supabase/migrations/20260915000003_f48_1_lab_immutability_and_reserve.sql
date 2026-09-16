-- Migration F48.1 — Laboratório Mínimo de IA: imutabilidade estrutural + RPCs atômicas
-- (design D3/D5/D8/D13/D14)
--
-- LOCAL-FIRST: aplicar e validar SOMENTE no Supabase local. NÃO aplicar no remoto
-- nesta task — o push remoto deliberado é a última task do 48-1-14, após a UAT.
--
-- Conteúdo:
--   A) 8 triggers de imutabilidade / append-only / congelamento pós-primeiro-run.
--      Como as 8 tabelas recebem SELECT/INSERT/UPDATE/DELETE de service_role, o
--      congelamento NÃO pode depender apenas de UPDATE: variantes e associações
--      de cenário são bloqueadas também em INSERT e DELETE; experimentos com
--      histórico não podem ser excluídos; runs nunca podem ser excluídos; e as
--      avaliações humanas são append-only incondicional (D3/D5/D8/D13).
--   B) RPC lab_reserve_run — reserva atômica ANTES de qualquer chamada paga:
--      lock FOR UPDATE do experimento antes de qualquer checagem, idempotência
--      por operation_id vinculada ao payload, validação das relações, budget,
--      run_sequence derivado no banco e snapshot completo na mesma transação.
--      Reforço: índice único parcial global de run ativo (migration anterior).
--   B2) RPC lab_create_experiment — criação atômica (experimento + 2 variantes +
--      N cenários) numa única transação, sem registro parcial em falha.
--
-- Proibido: tocar qualquer objeto produtivo. Migration estritamente ADITIVA.

-- =============================================================================
-- A. Triggers de imutabilidade estrutural
-- =============================================================================

-- A.1 lab_runs: colunas de configuração/snapshot são imutáveis.
--     Campos de RESULTADO do próprio run permanecem atualizáveis
--     (status, provider, model, protocol, capability, attempts, latency_ms,
--      usage, estimated_cost_usd, cost_detail, error_type, error_message,
--      technical_validation, calls, started_at, finished_at).
CREATE OR REPLACE FUNCTION public.trg_lab_runs_snapshot_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.experiment_id IS DISTINCT FROM OLD.experiment_id
     OR NEW.variant_id IS DISTINCT FROM OLD.variant_id
     OR NEW.scenario_version_id IS DISTINCT FROM OLD.scenario_version_id
     OR NEW.repetition_index IS DISTINCT FROM OLD.repetition_index
     OR NEW.run_sequence IS DISTINCT FROM OLD.run_sequence
     OR NEW.supersedes_run_id IS DISTINCT FROM OLD.supersedes_run_id
     OR NEW.operation_id IS DISTINCT FROM OLD.operation_id
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'lab_runs_snapshot_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lab_runs_snapshot_immutable
BEFORE UPDATE ON public.lab_runs
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_runs_snapshot_immutable_fn();

-- A.2 lab_scenario_versions: conteúdo versionado é imutável.
--     Alterar conteúdo exige NOVA versão (nova linha).
CREATE OR REPLACE FUNCTION public.trg_lab_scenario_versions_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.scenario_id IS DISTINCT FROM OLD.scenario_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.fixture_path IS DISTINCT FROM OLD.fixture_path THEN
    RAISE EXCEPTION 'lab_scenario_version_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lab_scenario_versions_immutable
BEFORE UPDATE ON public.lab_scenario_versions
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_scenario_versions_immutable_fn();

-- A.3 lab_experiment_variants: editável em draft/ready, congelada após o
--     primeiro run. experiment_id é imutável (impede mover uma linha de um
--     experimento editável para um experimento congelado).
CREATE OR REPLACE FUNCTION public.trg_lab_experiment_variants_freeze_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = NEW.experiment_id) THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.experiment_id IS DISTINCT FROM OLD.experiment_id THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
    IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = NEW.experiment_id)
       OR EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = OLD.experiment_id) THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = OLD.experiment_id) THEN
    RAISE EXCEPTION 'lab_experiment_frozen';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_lab_experiment_variants_freeze
BEFORE INSERT OR UPDATE OR DELETE ON public.lab_experiment_variants
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_experiment_variants_freeze_fn();

-- A.4 lab_experiments: configuração congelada após o primeiro run.
--     Transições de status e notes permanecem livres (o RPC de reserva promove
--     ready|evaluated -> running, o que não pode ser bloqueado).
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
     OR NEW.max_runs IS DISTINCT FROM OLD.max_runs THEN
    IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = OLD.id) THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lab_experiments_freeze
BEFORE UPDATE ON public.lab_experiments
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_experiments_freeze_fn();

-- A.5 lab_human_evaluations: append-only incondicional.
--     Reavaliação cria NOVO registro; nunca sobrescreve nem apaga.
CREATE OR REPLACE FUNCTION public.trg_lab_human_evaluations_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'lab_human_evaluations é append-only';
END;
$$;

CREATE TRIGGER trg_lab_human_evaluations_immutable
BEFORE UPDATE OR DELETE ON public.lab_human_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_human_evaluations_immutable_fn();

-- A.6 lab_experiment_scenarios: editável em draft/ready, congelada após o
--     primeiro run. experiment_id é imutável (mesma proteção de A.3).
CREATE OR REPLACE FUNCTION public.trg_lab_experiment_scenarios_freeze_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = NEW.experiment_id) THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.experiment_id IS DISTINCT FROM OLD.experiment_id THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
    IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = NEW.experiment_id)
       OR EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = OLD.experiment_id) THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = OLD.experiment_id) THEN
    RAISE EXCEPTION 'lab_experiment_frozen';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_lab_experiment_scenarios_freeze
BEFORE INSERT OR UPDATE OR DELETE ON public.lab_experiment_scenarios
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_experiment_scenarios_freeze_fn();

-- A.7 lab_experiments: experimento com histórico não pode ser excluído.
--     Encerramento é por status 'archived', nunca por DELETE.
CREATE OR REPLACE FUNCTION public.trg_lab_experiments_no_delete_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = OLD.id) THEN
    RAISE EXCEPTION 'lab_experiment_has_history';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_lab_experiments_no_delete
BEFORE DELETE ON public.lab_experiments
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_experiments_no_delete_fn();

-- A.8 lab_runs: DELETE é SEMPRE proibido — preserva o histórico de reexecução
--     e impede a cascata de artefatos/avaliações.
CREATE OR REPLACE FUNCTION public.trg_lab_runs_no_delete_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'lab_run_delete_forbidden';
END;
$$;

CREATE TRIGGER trg_lab_runs_no_delete
BEFORE DELETE ON public.lab_runs
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_runs_no_delete_fn();

-- =============================================================================
-- B. RPC lab_reserve_run — reserva atômica (design D14)
--    Ordem obrigatória: (1) snapshot/operation_id; (2) LOCK FOR UPDATE do
--    experimento ANTES de qualquer checagem; (3) idempotência após o lock e
--    vinculada ao payload; (4) prontidão; (5) invariantes relacionais;
--    (6) supersedes; (7) budget; (8) run_sequence derivado; (9) INSERT do run
--    'pending' com o snapshot COMPLETO; (10) promoção ready|evaluated->running.
--    Nenhuma chamada paga ocorre antes do retorno bem-sucedido desta RPC.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.lab_reserve_run(
  p_experiment_id UUID,
  p_variant_id UUID,
  p_scenario_version_id UUID,
  p_repetition_index INT,
  p_supersedes_run_id UUID,
  p_snapshot JSONB,
  p_operation_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_experiment public.lab_experiments;
  v_used INT;
  v_run_id UUID;
  v_existing UUID;
  v_existing_experiment UUID;
  v_existing_variant UUID;
  v_existing_scenario UUID;
  v_existing_repetition INT;
  v_sequence INT;
BEGIN
  IF p_snapshot IS NULL OR p_snapshot = '{}'::jsonb THEN
    RAISE EXCEPTION 'missing_snapshot';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'missing_operation_id';
  END IF;

  -- (1) Lock do experimento ANTES de qualquer checagem (serializa as reservas).
  SELECT * INTO v_experiment
  FROM public.lab_experiments
  WHERE id = p_experiment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'experiment_not_found';
  END IF;

  -- (2) Idempotência verificada APÓS o lock e VINCULADA ao payload original.
  SELECT id, experiment_id, variant_id, scenario_version_id, repetition_index
    INTO v_existing, v_existing_experiment, v_existing_variant, v_existing_scenario, v_existing_repetition
  FROM public.lab_runs
  WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_experiment <> p_experiment_id
       OR v_existing_variant <> p_variant_id
       OR v_existing_scenario <> p_scenario_version_id
       OR v_existing_repetition <> p_repetition_index THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'run_id', v_existing);
  END IF;

  -- (3) Prontidão: avaliar NÃO encerra as execuções.
  IF v_experiment.status NOT IN ('ready','running','evaluated') THEN
    RAISE EXCEPTION 'experiment_not_ready';
  END IF;

  -- (4) Invariantes relacionais sob o lock.
  IF NOT EXISTS (
    SELECT 1 FROM public.lab_experiment_variants
    WHERE id = p_variant_id AND experiment_id = p_experiment_id
  ) THEN
    RAISE EXCEPTION 'variant_not_in_experiment';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lab_experiment_scenarios
    WHERE experiment_id = p_experiment_id AND scenario_version_id = p_scenario_version_id
  ) THEN
    RAISE EXCEPTION 'scenario_not_in_experiment';
  END IF;

  IF p_repetition_index IS NULL
     OR p_repetition_index < 1
     OR p_repetition_index > v_experiment.repetitions THEN
    RAISE EXCEPTION 'repetition_out_of_range';
  END IF;

  IF p_supersedes_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lab_runs
    WHERE id = p_supersedes_run_id
      AND experiment_id = p_experiment_id
      AND variant_id = p_variant_id
      AND scenario_version_id = p_scenario_version_id
      AND repetition_index = p_repetition_index
      AND status IN ('succeeded','failed','cancelled','timeout')
  ) THEN
    RAISE EXCEPTION 'invalid_supersedes_run';
  END IF;

  -- (5) Budget contado dentro da transação do lock.
  SELECT count(*) INTO v_used
  FROM public.lab_runs
  WHERE experiment_id = p_experiment_id;
  IF v_used >= v_experiment.max_runs THEN
    RAISE EXCEPTION 'budget_exceeded';
  END IF;

  -- (6) run_sequence DERIVADO no banco (nunca aceito do cliente).
  SELECT COALESCE(max(run_sequence), 0) + 1 INTO v_sequence
  FROM public.lab_runs
  WHERE experiment_id = p_experiment_id
    AND variant_id = p_variant_id
    AND scenario_version_id = p_scenario_version_id
    AND repetition_index = p_repetition_index;

  -- (7) Insere o run 'pending' com o snapshot COMPLETO na mesma transação.
  --     O índice único parcial global reforça a exclusão mútua de runs ativos.
  INSERT INTO public.lab_runs (
    experiment_id, variant_id, scenario_version_id, repetition_index, run_sequence,
    supersedes_run_id, operation_id, status, snapshot, created_by
  ) VALUES (
    p_experiment_id, p_variant_id, p_scenario_version_id, p_repetition_index, v_sequence,
    p_supersedes_run_id, p_operation_id, 'pending', p_snapshot, p_actor_id
  )
  RETURNING id INTO v_run_id;

  -- (8) Promoção do experimento: avaliar NÃO encerra execuções.
  UPDATE public.lab_experiments
  SET status = 'running', updated_at = now()
  WHERE id = p_experiment_id AND status IN ('ready','evaluated');

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'run_id', v_run_id,
    'run_sequence', v_sequence
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Corrida de operação: operation_id já existe -> idempotente se o payload coincide.
    SELECT id, experiment_id, variant_id, scenario_version_id, repetition_index
      INTO v_existing, v_existing_experiment, v_existing_variant, v_existing_scenario, v_existing_repetition
    FROM public.lab_runs
    WHERE operation_id = p_operation_id;
    IF FOUND THEN
      IF v_existing_experiment <> p_experiment_id
         OR v_existing_variant <> p_variant_id
         OR v_existing_scenario <> p_scenario_version_id
         OR v_existing_repetition <> p_repetition_index THEN
        RAISE EXCEPTION 'idempotency_conflict';
      END IF;
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'run_id', v_existing);
    END IF;
    -- Caso contrário, é o índice único parcial GLOBAL de run ativo.
    RAISE EXCEPTION 'run_already_active';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lab_reserve_run(UUID, UUID, UUID, INT, UUID, JSONB, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_reserve_run(UUID, UUID, UUID, INT, UUID, JSONB, UUID, UUID)
  TO service_role;

-- =============================================================================
-- B2. RPC lab_create_experiment — criação atômica (design D5)
--     Experimento + exatamente 2 variantes (baseline/candidate) + N cenários
--     numa ÚNICA transação. Qualquer falha reverte tudo (sem experimento
--     parcial) — inserts PostgREST separados não formariam uma transação.
-- =============================================================================
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

  -- (1) Experimento: dimensão fixa 'prompt' e capacidade fixa 'campaign_image' na F48.1.
  INSERT INTO public.lab_experiments (
    name, objective, hypothesis, changed_dimension, primary_capability,
    model_target, params, status, repetitions, max_runs, notes, created_by
  ) VALUES (
    btrim(p_name), btrim(p_objective), btrim(p_hypothesis), 'prompt', 'campaign_image',
    p_model_target, p_params, 'draft', p_repetitions, p_max_runs, p_notes, p_actor_id
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

REVOKE EXECUTE ON FUNCTION public.lab_create_experiment(TEXT, TEXT, TEXT, JSONB, JSONB, INT, INT, TEXT, JSONB, JSONB, UUID[], UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_create_experiment(TEXT, TEXT, TEXT, JSONB, JSONB, INT, INT, TEXT, JSONB, JSONB, UUID[], UUID)
  TO service_role;

-- =============================================================================
-- REVERT (ordem reversa de criação — executar manualmente se necessário)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.lab_create_experiment(TEXT, TEXT, TEXT, JSONB, JSONB, INT, INT, TEXT, JSONB, JSONB, UUID[], UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.lab_create_experiment(TEXT, TEXT, TEXT, JSONB, JSONB, INT, INT, TEXT, JSONB, JSONB, UUID[], UUID);
-- REVOKE EXECUTE ON FUNCTION public.lab_reserve_run(UUID, UUID, UUID, INT, UUID, JSONB, UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.lab_reserve_run(UUID, UUID, UUID, INT, UUID, JSONB, UUID, UUID);
-- DROP TRIGGER IF EXISTS trg_lab_runs_no_delete ON public.lab_runs;
-- DROP FUNCTION IF EXISTS public.trg_lab_runs_no_delete_fn();
-- DROP TRIGGER IF EXISTS trg_lab_experiments_no_delete ON public.lab_experiments;
-- DROP FUNCTION IF EXISTS public.trg_lab_experiments_no_delete_fn();
-- DROP TRIGGER IF EXISTS trg_lab_experiment_scenarios_freeze ON public.lab_experiment_scenarios;
-- DROP FUNCTION IF EXISTS public.trg_lab_experiment_scenarios_freeze_fn();
-- DROP TRIGGER IF EXISTS trg_lab_human_evaluations_immutable ON public.lab_human_evaluations;
-- DROP FUNCTION IF EXISTS public.trg_lab_human_evaluations_immutable_fn();
-- DROP TRIGGER IF EXISTS trg_lab_experiments_freeze ON public.lab_experiments;
-- DROP FUNCTION IF EXISTS public.trg_lab_experiments_freeze_fn();
-- DROP TRIGGER IF EXISTS trg_lab_experiment_variants_freeze ON public.lab_experiment_variants;
-- DROP FUNCTION IF EXISTS public.trg_lab_experiment_variants_freeze_fn();
-- DROP TRIGGER IF EXISTS trg_lab_scenario_versions_immutable ON public.lab_scenario_versions;
-- DROP FUNCTION IF EXISTS public.trg_lab_scenario_versions_immutable_fn();
-- DROP TRIGGER IF EXISTS trg_lab_runs_snapshot_immutable ON public.lab_runs;
-- DROP FUNCTION IF EXISTS public.trg_lab_runs_snapshot_immutable_fn();
