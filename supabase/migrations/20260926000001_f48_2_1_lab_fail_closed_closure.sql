-- Migration F48.2.1 — Segurança financeira e revogação fail-closed (design D9/C1–C3)
--
-- LOCAL-FIRST: esta migration é criada e validada SOMENTE no Supabase local
-- (`npx supabase migration up` + `npx supabase db lint`). NÃO há `db push`
-- remoto nesta fase — o push remoto deliberado pertence à F48.2.3. O schema
-- remoto permanece inerte (VENDEO_LAB_ENABLED=false).
--
-- Migration estritamente ADITIVA: `CREATE OR REPLACE` da função `lab_reserve_run`
-- (mesma assinatura de 9 args da migration 20260925000001), nova função de
-- trigger de terminalidade e seu trigger. Nenhum DROP/ALTER de objeto produtivo;
-- nenhuma tabela é alterada.
--
-- Escopo (C1/C2/C3):
--   * `lab_reserve_run` passa a exigir `v_program.status = 'authorized'` sob o
--     lock do programa, ANTES de qualquer débito de orçamento ou inserção de run
--     (fail-closed: qualquer status != 'authorized' recusa antes da chamada paga);
--   * `closed` torna-se TERMINAL no banco: um trigger BEFORE UPDATE recusa
--     `closed -> qualquer outro status` (inclusive `authorized`), preservando o
--     histórico financeiro (a migration não toca em budget_*).
--
-- Proibido: tocar qualquer objeto produtivo (campanhas, arte, telemetria,
-- seleção/catálogo de modelos, auditoria administrativa), o bucket de imagens de
-- campanha ou `prompts/`.

-- =============================================================================
-- 1. lab_reserve_run — guarda fail-closed de status do programa (C1/C2)
--    Corpo idêntico ao da migration 20260925000001, com a ÚNICA adição da
--    recusa determinística `v_program.status <> 'authorized'` logo após o lock do
--    programa e ANTES das checagens de `budget_authorized_at`/`budget_usd` e do
--    débito em `budget_reserved_usd`.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.lab_reserve_run(
  p_experiment_id UUID,
  p_variant_id UUID,
  p_scenario_version_id UUID,
  p_repetition_index INT,
  p_supersedes_run_id UUID,
  p_snapshot JSONB,
  p_operation_id UUID,
  p_actor_id UUID,
  p_estimated_cost_usd NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_experiment public.lab_experiments;
  v_program public.lab_prompt_programs;
  v_remaining NUMERIC;
  v_used INT;
  v_run_id UUID;
  v_existing UUID;
  v_existing_experiment UUID;
  v_existing_variant UUID;
  v_existing_scenario UUID;
  v_existing_repetition INT;
  v_sequence INT;
BEGIN
  IF p_snapshot IS NULL
     OR jsonb_typeof(p_snapshot) <> 'object'
     OR p_snapshot = '{}'::jsonb THEN
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

  -- (5) Budget do experimento contado dentro da transação do lock.
  SELECT count(*) INTO v_used
  FROM public.lab_runs
  WHERE experiment_id = p_experiment_id;
  IF v_used >= v_experiment.max_runs THEN
    RAISE EXCEPTION 'budget_exceeded';
  END IF;

  -- (6) Orçamento do programa (D2/D5): lock do programa e recusas determinísticas
  --     ANTES de qualquer chamada paga. A reserva ocorre na MESMA transação.
  IF v_experiment.program_id IS NULL THEN
    RAISE EXCEPTION 'program_not_authorized';
  END IF;

  SELECT * INTO v_program
  FROM public.lab_prompt_programs
  WHERE id = v_experiment.program_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'program_not_authorized';
  END IF;

  -- (6.1) [NOVO — C1/C2] Fail-closed: SOMENTE `authorized` reserva. Qualquer
  --       outro status (`draft`/`closed`) recusa antes de qualquer débito ou
  --       inserção de run — nenhuma chamada paga é iniciada.
  IF v_program.status <> 'authorized' THEN
    RAISE EXCEPTION 'program_not_authorized';
  END IF;

  IF v_program.budget_authorized_at IS NULL OR v_program.budget_usd IS NULL THEN
    RAISE EXCEPTION 'program_not_authorized';
  END IF;

  v_remaining := v_program.budget_usd - v_program.budget_consumed_usd - v_program.budget_reserved_usd;
  IF p_estimated_cost_usd IS NOT NULL AND v_remaining < p_estimated_cost_usd THEN
    RAISE EXCEPTION 'budget_exceeded';
  END IF;

  UPDATE public.lab_prompt_programs
  SET budget_reserved_usd = budget_reserved_usd + COALESCE(p_estimated_cost_usd, 0),
      updated_at = now()
  WHERE id = v_program.id;

  -- (7) run_sequence DERIVADO no banco (nunca aceito do cliente).
  SELECT COALESCE(max(run_sequence), 0) + 1 INTO v_sequence
  FROM public.lab_runs
  WHERE experiment_id = p_experiment_id
    AND variant_id = p_variant_id
    AND scenario_version_id = p_scenario_version_id
    AND repetition_index = p_repetition_index;

  -- (8) Insere o run 'pending' com o snapshot COMPLETO na mesma transação e a
  --     reserva de orçamento do run (nullable).
  INSERT INTO public.lab_runs (
    experiment_id, variant_id, scenario_version_id, repetition_index, run_sequence,
    supersedes_run_id, operation_id, status, snapshot, reserved_cost_usd, created_by
  ) VALUES (
    p_experiment_id, p_variant_id, p_scenario_version_id, p_repetition_index, v_sequence,
    p_supersedes_run_id, p_operation_id, 'pending', p_snapshot, p_estimated_cost_usd, p_actor_id
  )
  RETURNING id INTO v_run_id;

  -- (9) Promoção do experimento: avaliar NÃO encerra execuções.
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

REVOKE EXECUTE ON FUNCTION public.lab_reserve_run(UUID, UUID, UUID, INT, UUID, JSONB, UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_reserve_run(UUID, UUID, UUID, INT, UUID, JSONB, UUID, UUID, NUMERIC) TO service_role;

-- =============================================================================
-- 2. Terminalidade de `lab_prompt_programs` no banco (C3)
--    `closed` é terminal: um trigger BEFORE UPDATE recusa a saída de `closed`
--    para qualquer outro status (inclusive `authorized`). O encerramento em si
--    (`-> closed`) e as atualizações que preservam `closed` (relatório,
--    recomendação, orçamento histórico) continuam permitidas.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trg_lab_prompt_programs_terminal_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'closed' AND NEW.status IS DISTINCT FROM 'closed' THEN
    RAISE EXCEPTION 'program_closed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lab_prompt_programs_terminal ON public.lab_prompt_programs;
CREATE TRIGGER trg_lab_prompt_programs_terminal
  BEFORE UPDATE ON public.lab_prompt_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_lab_prompt_programs_terminal_fn();

-- =============================================================================
-- REVERT (ordem reversa de criação — executar manualmente se necessário)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_lab_prompt_programs_terminal ON public.lab_prompt_programs;
-- DROP FUNCTION IF EXISTS public.trg_lab_prompt_programs_terminal_fn();
-- -- Restaurar `lab_reserve_run` SEM a guarda de status (definição da migration
-- -- 20260925000001, seção 8): remover o bloco abaixo do lock do programa:
-- --   IF v_program.status <> 'authorized' THEN RAISE EXCEPTION 'program_not_authorized'; END IF;
-- CREATE OR REPLACE FUNCTION public.lab_reserve_run(UUID, UUID, UUID, INT, UUID, JSONB, UUID, UUID, NUMERIC)
--   RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ ... $$; -- (ver 20260925000001)
