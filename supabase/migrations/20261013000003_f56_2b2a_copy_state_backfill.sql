-- F56.2b2a — Migração TRANSACIONAL dos registros b1b para o modelo por tentativa
-- (B2.1 / Plano 06, REQ-56.2.3-07/-06/-03).
-- Esta migration é LOCAL-ONLY e é apenas AUTORADA aqui. NÃO executar
-- `supabase db push` (nem qualquer mutação remota / reset / migration up remoto).
-- Aplicar exclusivamente na instância isolada e descartável via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e somente na janela de migração autorizada (Plano 05), REGISTRANDO a versão em
-- `supabase_migrations.schema_migrations`. Aplicá-la em qualquer outro lugar
-- está fora de escopo. Autorar aqui ≠ aplicar.
--
-- B2A-D4 (migração de dados): os registros EXISTENTES da b1b (estado e
-- cancelamento, uma linha por operação) são migrados TRANSACIONALMENTE para o
-- modelo por tentativa:
--
--   1. `product_1_1_copy_state`: `attempt_seq = 1` e `attempt_token` ÚNICO POR
--      `(campaign_id, operation_id)` (o MESMO token para todas as linhas do par —
--      a MESMA tentativa). As linhas HISTÓRICAS recebem ADITIVAMENTE o marcador
--      `copy_payload.recovery = { kind: 'auto' }` (a tentativa histórica conta no
--      contador AUTOMÁTICO; título/legenda/hashtags/cta PRESERVADOS). Em seguida
--      `SET NOT NULL` em `attempt_seq`/`attempt_token` (`request_token` PERMANECE
--      NULLABLE — o histórico não tem token de acionamento).
--   2. `product_1_1_copy_cancellations`: ganha `attempt_seq`/`attempt_token`; o
--      token é o MESMO da linha de estado da MESMA `(campaign_id, operation_id)`
--      (VÍNCULO DA MESMA TENTATIVA). A UNIQUE passa a
--      `(campaign_id, operation_id, attempt_seq)`. O trigger de IMUTABILIDADE é
--      DESABILITADO durante o UPDATE e RESTAURADO ao final, DENTRO da MESMA
--      transação (após a migração, um `UPDATE`/`DELETE` é NEGADO).
--   3. `product_1_1_cancel_copy`: é RECRIADA (DROP da versão da `000001`) com a
--      MESMA assinatura de 6 args e o INSERT/`ON CONFLICT` por
--      `(campaign_id, operation_id, attempt_seq)` — a versão da `000001` ainda
--      inseriria por `(campaign_id, operation_id)` e QUEBRARIA com as novas
--      colunas `NOT NULL`/UNIQUE. O gate por desfecho (`applied`/`idempotent`) e
--      o repasse de `p_copy_payload` ao `apply` são PRESERVADOS.
--
-- Toda a migração de dados vive num ÚNICO `BEGIN; ... COMMIT;` explícito.
--
-- NÃO há `DELETE` em massa; nenhum histórico é apagado. Fronteira de reuso: NÃO
-- altera `campaigns` nem qualquer tabela/coluna legada; apenas REFERENCIA.

begin;

-- =============================================================================
-- 1. Backfill de `product_1_1_copy_state` (vinculo por par + contador automático)
-- =============================================================================

-- 1.1 — `attempt_seq = 1` + marcador ADITIVO de recuperação (kind='auto') nas
--       linhas HISTÓRICAS (`attempt_seq IS NULL`). `||` no topo PRESERVA o resto
--       do payload (título/legenda/hashtags/cta); o histórico não tinha `recovery`.
UPDATE public.product_1_1_copy_state
   SET attempt_seq = 1,
       copy_payload = COALESCE(copy_payload, '{}'::jsonb)
                       || jsonb_build_object('recovery', jsonb_build_object('kind', 'auto'))
 WHERE attempt_seq IS NULL;

-- 1.2 — `attempt_token` ÚNICO POR PAR: UM `gen_random_uuid()` por
--       `(campaign_id, operation_id)`, aplicado a TODAS as linhas do par (o MESMO
--       token para a MESMA tentativa).
WITH pairs AS (
  SELECT DISTINCT campaign_id, operation_id, gen_random_uuid() AS token
  FROM public.product_1_1_copy_state
  WHERE attempt_token IS NULL
)
UPDATE public.product_1_1_copy_state cs
   SET attempt_token = p.token
  FROM pairs p
 WHERE cs.campaign_id = p.campaign_id
   AND cs.operation_id = p.operation_id
   AND cs.attempt_token IS NULL;

-- 1.3 — `SET NOT NULL` na identidade da tentativa (`request_token` PERMANECE
--       NULLABLE — o histórico b1b não tem token de acionamento).
ALTER TABLE public.product_1_1_copy_state
  ALTER COLUMN attempt_seq   SET NOT NULL;
ALTER TABLE public.product_1_1_copy_state
  ALTER COLUMN attempt_token SET NOT NULL;

-- 1.4 — Garante a UNIQUE por tentativa (idempotente: o Plano 01 já a criou).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_p1_1_copy_state_op_attempt'
      AND conrelid = 'public.product_1_1_copy_state'::regclass
  ) THEN
    ALTER TABLE public.product_1_1_copy_state
      ADD CONSTRAINT uq_p1_1_copy_state_op_attempt
      UNIQUE (campaign_id, operation_id, attempt_seq);
  END IF;
END $$;

-- =============================================================================
-- 2. Migração de `product_1_1_copy_cancellations` (vinculo da MESMA tentativa)
-- =============================================================================

ALTER TABLE public.product_1_1_copy_cancellations
  ADD COLUMN IF NOT EXISTS attempt_seq   INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_token UUID;

-- Imutabilidade: o UPDATE de backfill seria NEGADO pelo trigger. DESABILITA
-- durante a migração e RESTAURA ao final, DENTRO da MESMA transação.
ALTER TABLE public.product_1_1_copy_cancellations
  DISABLE TRIGGER trg_product_1_1_copy_cancellations_immutable;

-- 2.1 — `attempt_seq = 1`.
UPDATE public.product_1_1_copy_cancellations
   SET attempt_seq = 1
 WHERE attempt_seq IS NULL;

-- 2.2 — `attempt_token` = O MESMO token da linha de estado da MESMA
--       `(campaign_id, operation_id)` (VÍNCULO DA MESMA TENTATIVA). Sem linha de
--       estado correspondente: deriva um token PRÓPRIO do par.
UPDATE public.product_1_1_copy_cancellations cc
   SET attempt_token = COALESCE(
         (SELECT cs.attempt_token
            FROM public.product_1_1_copy_state cs
           WHERE cs.campaign_id = cc.campaign_id
             AND cs.operation_id = cc.operation_id
           ORDER BY cs.attempt_seq DESC
           LIMIT 1),
         gen_random_uuid()
       )
 WHERE cc.attempt_token IS NULL;

-- 2.3 — Troca a UNIQUE por-OPERAÇÃO pela por-TENTATIVA.
ALTER TABLE public.product_1_1_copy_cancellations
  DROP CONSTRAINT IF EXISTS uq_p1_1_copy_cancellation_op;
ALTER TABLE public.product_1_1_copy_cancellations
  DROP CONSTRAINT IF EXISTS uq_p1_1_copy_cancellation_op_attempt;
ALTER TABLE public.product_1_1_copy_cancellations
  ADD CONSTRAINT uq_p1_1_copy_cancellation_op_attempt
  UNIQUE (campaign_id, operation_id, attempt_seq);

-- 2.4 — `SET NOT NULL` na identidade do cancelamento.
ALTER TABLE public.product_1_1_copy_cancellations
  ALTER COLUMN attempt_seq   SET NOT NULL;
ALTER TABLE public.product_1_1_copy_cancellations
  ALTER COLUMN attempt_token SET NOT NULL;

-- =============================================================================
-- 3. RECRIAÇÃO de `product_1_1_cancel_copy` (INSERT/ON CONFLICT por tentativa)
-- =============================================================================
-- Correção da revisão 2026-10-14: a versão da `000001` insere
-- `(campaign_id, operation_id, reason)` com `ON CONFLICT (campaign_id,
-- operation_id)` — que QUEBRA após o passo 2 (novas colunas NOT NULL + UNIQUE
-- por tentativa). Recriada com a MESMA assinatura de 6 args, MESMO gate por
-- desfecho (registra e declara `canceled:true` SOMENTE em `applied`/`idempotent`)
-- e MESMO repasse de `p_copy_payload` ao `apply` interno.
DROP FUNCTION IF EXISTS public.product_1_1_cancel_copy(UUID, UUID, TEXT, INTEGER, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.product_1_1_cancel_copy(
  p_campaign_id   UUID,
  p_operation_id  UUID,
  p_reason        TEXT,
  p_attempt_seq   INTEGER,
  p_attempt_token UUID,
  p_copy_payload  JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apply   JSONB;
  v_state   TEXT;
  v_applied BOOLEAN;
  v_outcome TEXT;
BEGIN
  IF p_campaign_id  IS NULL THEN RAISE EXCEPTION 'missing_campaign_id';  END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_attempt_seq IS NULL OR p_attempt_token IS NULL THEN
    RAISE EXCEPTION 'missing_attempt_identity';
  END IF;

  -- (1) Aplica o terminal `failed` sob a MESMA transação (mesma trava estável
  --     compartilhada herdada do `apply`).
  v_apply   := public.product_1_1_apply_copy_state(
    p_campaign_id, p_operation_id, 'failed', p_attempt_seq, p_attempt_token,
    NULL, p_copy_payload);
  v_state   := v_apply->>'state';
  v_applied := COALESCE((v_apply->>'applied')::boolean, false);
  v_outcome := v_apply->>'outcome';

  -- (2) Tentativa SUPERADA ⇒ recusa sem registro.
  IF v_outcome = 'stale_attempt' THEN
    RETURN jsonb_build_object('applied', false, 'state', v_state, 'canceled', false, 'outcome', 'stale_attempt');
  END IF;

  -- (3) Gate por DESFECHO: registra e declara `canceled:true` SOMENTE quando o
  --     `apply` interno aplicou (`applied`) ou replayou equivalente (`idempotent`).
  IF v_outcome IN ('applied','idempotent') THEN
    INSERT INTO public.product_1_1_copy_cancellations
      (campaign_id, operation_id, attempt_seq, attempt_token, reason)
    VALUES
      (p_campaign_id, p_operation_id, p_attempt_seq, p_attempt_token, p_reason)
    ON CONFLICT (campaign_id, operation_id, attempt_seq) DO NOTHING;
    RETURN jsonb_build_object('applied', v_applied, 'state', 'failed', 'canceled', true, 'outcome', v_outcome);
  END IF;

  -- RECUSA (`conflict`/`rejected`/`invalid_content`) ⇒ NÃO registra, NÃO declara.
  RETURN jsonb_build_object('applied', false, 'state', v_state, 'canceled', false, 'outcome', v_outcome);
END;
$$;

REVOKE ALL ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT, INTEGER, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT, INTEGER, UUID, JSONB)
  TO service_role;

-- =============================================================================
-- 4. RESTAURA a imutabilidade do cancelamento (DENTRO da mesma transação)
-- =============================================================================
-- A partir daqui, um `UPDATE`/`DELETE` no cancelamento é NEGADO pelo trigger.
ALTER TABLE public.product_1_1_copy_cancellations
  ENABLE TRIGGER trg_product_1_1_copy_cancellations_immutable;

-- =============================================================================
-- 5. (Re)afirma RPC-only A2 nas duas tabelas (idempotente)
-- =============================================================================
REVOKE ALL ON TABLE public.product_1_1_copy_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_copy_state FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_state FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_copy_state TO service_role;

REVOKE ALL ON TABLE public.product_1_1_copy_cancellations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_copy_cancellations FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_cancellations FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_copy_cancellations TO service_role;

commit;

-- =============================================================================
-- REVERT (executar manualmente apenas na instância local isolada). Restaura a
-- projeção pré-B2.1 (uma linha por operação); NÃO recupera tokens derivados.
-- =============================================================================
-- begin;
-- ALTER TABLE public.product_1_1_copy_cancellations DISABLE TRIGGER trg_product_1_1_copy_cancellations_immutable;
-- ALTER TABLE public.product_1_1_copy_cancellations DROP CONSTRAINT IF EXISTS uq_p1_1_copy_cancellation_op_attempt;
-- ALTER TABLE public.product_1_1_copy_cancellations ADD CONSTRAINT uq_p1_1_copy_cancellation_op UNIQUE (campaign_id, operation_id);
-- ALTER TABLE public.product_1_1_copy_cancellations DROP COLUMN IF EXISTS attempt_token, DROP COLUMN IF EXISTS attempt_seq;
-- ALTER TABLE public.product_1_1_copy_cancellations ENABLE TRIGGER trg_product_1_1_copy_cancellations_immutable;
-- ALTER TABLE public.product_1_1_copy_state DROP CONSTRAINT IF EXISTS uq_p1_1_copy_state_op_attempt;
-- ALTER TABLE public.product_1_1_copy_state ALTER COLUMN attempt_token DROP NOT NULL;
-- ALTER TABLE public.product_1_1_copy_state ALTER COLUMN attempt_seq DROP NOT NULL;
-- DROP FUNCTION IF EXISTS public.product_1_1_cancel_copy(UUID, UUID, TEXT, INTEGER, UUID, JSONB);
-- commit;
