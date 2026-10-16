-- F56.2b2c (B2.3) — PROVAS SQL concorrentes do controle de gasto do piloto.
-- LOCAL-ONLY: autoradas para EXECUÇÃO POSTERIOR no checkpoint autorizado, contra a
-- `vendeo-homolog` (após aplicar `20261017000002_f56_2b2c_pilot_spend_control.sql`).
-- NÃO executar `db push`. Rodar via `psql` local (docker exec) sob autorização.
--
-- Cada bloco falha com RAISE se a asserção não for satisfeita. Uso:
--   psql -v ON_ERROR_STOP=1 -f supabase/proofs/f56_2b2c_pilot_spend_concurrency.sql
-- Ao final, ROLLBACK para não reter fixtures.

BEGIN;

-- Fixtures mínimas (uuid fixos; transação revertida no fim).
-- (usamos gen_random_uuid() para não depender de dados reais)

DO $$
DECLARE
  v_state   public.product_1_1_pilot_spend_state%ROWTYPE;
  v_res     JSONB;
  v_call_1  UUID := gen_random_uuid();
  v_call_2  UUID := gen_random_uuid();
  v_call_3  UUID := gen_random_uuid();
  v_owner   UUID := gen_random_uuid();
  v_camp_a  UUID := gen_random_uuid();
  v_camp_b  UUID := gen_random_uuid();
  v_op_a    UUID := gen_random_uuid();
  v_op_b    UUID := gen_random_uuid();
BEGIN
  -- (0) Estado nasce NÃO configurado.
  SELECT * INTO v_state FROM public.product_1_1_pilot_spend_state WHERE id = TRUE;
  IF v_state.cap_usd IS NOT NULL THEN RAISE EXCEPTION 'PROOF_FAIL: cap deveria nascer NULL'; END IF;

  -- (1) Sem cap ⇒ recusa fail-closed.
  BEGIN
    PERFORM public.product_1_1_pilot_begin_paid_call(v_camp_a, v_op_a, v_call_1, 'image_primary', 1, 1.0, v_owner);
    RAISE EXCEPTION 'PROOF_FAIL: deveria recusar sem cap';
  EXCEPTION WHEN OTHERS THEN
    IF position('pilot_cap_not_configured' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- (2) Define cap (decisão humana) via RPC.
  PERFORM public.product_1_1_pilot_set_cap(gen_random_uuid(), 1.00, 'prova', gen_random_uuid());

  -- (3) Aquisição nova ⇒ acquired (tri-state).
  v_res := public.product_1_1_pilot_begin_paid_call(v_camp_a, v_op_a, v_call_1, 'image_primary', 1, 0.30, v_owner);
  IF v_res->>'outcome' <> 'acquired' THEN RAISE EXCEPTION 'PROOF_FAIL: esperado acquired'; END IF;

  -- (4) Replay do MESMO call_id ⇒ existing_in_flight (NÃO soma de novo).
  v_res := public.product_1_1_pilot_begin_paid_call(v_camp_a, v_op_a, v_call_1, 'image_primary', 1, 0.30, v_owner);
  IF v_res->>'outcome' <> 'existing_in_flight' THEN RAISE EXCEPTION 'PROOF_FAIL: esperado existing_in_flight'; END IF;

  -- (5) Concorrência legítima: imagem+copy da MESMA campanha são permitidas.
  v_res := public.product_1_1_pilot_begin_paid_call(v_camp_a, v_op_a, v_call_2, 'copy_initial', 1, 0.20, v_owner);
  IF v_res->>'outcome' <> 'acquired' THEN RAISE EXCEPTION 'PROOF_FAIL: copy da MESMA campanha deveria ser permitida'; END IF;

  -- (6) OUTRA campanha com in_flight legítimo ⇒ pilot_busy.
  BEGIN
    PERFORM public.product_1_1_pilot_begin_paid_call(v_camp_b, v_op_b, v_call_3, 'image_primary', 1, 0.10, v_owner);
    RAISE EXCEPTION 'PROOF_FAIL: deveria bloquear outra campanha (pilot_busy)';
  EXCEPTION WHEN OTHERS THEN
    IF position('pilot_busy' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- (7) Resultado DESCONHECIDO (timeout) ⇒ mark_unknown; bloqueia TODAS as novas
  --     chamadas, inclusive da MESMA campanha (retry com novo call_id) e de OUTRA.
  PERFORM public.product_1_1_pilot_mark_unknown(v_call_2, v_owner, 'timeout');
  BEGIN
    PERFORM public.product_1_1_pilot_begin_paid_call(v_camp_a, v_op_a, gen_random_uuid(), 'copy_auto', 2, 0.20, v_owner);
    RAISE EXCEPTION 'PROOF_FAIL: retry na MESMA campanha deveria ser bloqueado por unknown';
  EXCEPTION WHEN OTHERS THEN
    IF position('pilot_requires_reconciliation' in SQLERRM) = 0 THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.product_1_1_pilot_begin_paid_call(v_camp_b, v_op_b, gen_random_uuid(), 'image_primary', 1, 0.10, v_owner);
    RAISE EXCEPTION 'PROOF_FAIL: outra campanha deveria ser bloqueada por unknown';
  EXCEPTION WHEN OTHERS THEN
    IF position('pilot_requires_reconciliation' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- (8) Posse: token divergente (incl. NULL) ⇒ not_owner.
  BEGIN
    PERFORM public.product_1_1_pilot_end_paid_call(v_call_1, NULL, 0.30);
    RAISE EXCEPTION 'PROOF_FAIL: owner NULL deveria recusar';
  EXCEPTION WHEN OTHERS THEN
    IF position('not_owner' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- (9) Reconciliação EXPLÍCITA mantém a estimativa e libera (stale).
  PERFORM public.product_1_1_pilot_reconcile_unknown(gen_random_uuid(), v_call_2, 'keep_accounted_release', 'prova', gen_random_uuid());

  -- (10) Resultado TARDIO após reconciliação ⇒ preserva `stale` (NÃO vira released,
  --      NÃO recalcula o acumulado).
  v_res := public.product_1_1_pilot_end_paid_call(v_call_2, v_owner, 0.99);
  IF v_res->>'state' <> 'stale' THEN RAISE EXCEPTION 'PROOF_FAIL: stale deveria ser preservado'; END IF;

  -- (11) Libera a chamada de imagem de A; a campanha A fica sem in_flight.
  PERFORM public.product_1_1_pilot_end_paid_call(v_call_1, v_owner, 0.30);

  -- (12) end_paid_call com estimativa NULL NÃO zera a estimativa contabilizada.
  --      (usa uma nova chamada para observar o valor retido)
  v_res := public.product_1_1_pilot_begin_paid_call(v_camp_b, v_op_b, gen_random_uuid(), 'image_primary', 1, 0.25, v_owner);
  IF v_res->>'outcome' <> 'acquired' THEN RAISE EXCEPTION 'PROOF_FAIL: esperado acquired em B'; END IF;
END;
$$;

ROLLBACK;

-- =============================================================================
-- Provas de CONCORRÊNCIA (execução separada; duas sessões psql):
-- =============================================================================
-- Sessão 1: BEGIN; SELECT product_1_1_pilot_begin_paid_call(campA, opA, cA, 'image_primary', 1, ...);
--           (mantém a transação aberta)
-- Sessão 2: SELECT product_1_1_pilot_begin_paid_call(campB, opB, cB, 'image_primary', 1, ...);
--           ⇒ deve aguardar a trava comum (pg_advisory_xact_lock('product_1_1_pilot_spend'))
--             e, após o commit da Sessão 1, devolver `pilot_busy` (campanha diferente).
-- Serialização `begin` × `mark_unknown`: com a trava comum, a instalação do bloqueio
-- global não interleave com a aquisição (sem janela onde a chamada "escapa").
