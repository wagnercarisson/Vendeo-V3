-- F56.2b2a — Identidade/lease POR TENTATIVA da copy do Produto 1:1 (B2.1 /
-- Plano 01, REQ-56.2.3-07 e alicerce de REQ-56.2.3-01/-03).
-- Esta migration é LOCAL-ONLY e é apenas AUTORADA aqui. NÃO executar
-- `supabase db push` (nem qualquer mutação remota / reset / migration up remoto).
-- Aplicar exclusivamente na instância isolada e descartável via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e somente na janela de migração autorizada (Plano 05). Aplicá-la em qualquer
-- outro lugar está fora de escopo. Autorar aqui ≠ aplicar.
--
-- B2.1 (B2A-D4) — transforma `public.product_1_1_copy_state` em UMA linha POR
-- TENTATIVA (identidade composta `campaign_id` + `operation_id` + `attempt_seq`)
-- com:
--
--   * `attempt_seq` (1..6) + `attempt_token` (dono da tentativa): o estado
--     CORRENTE é a tentativa de MAIOR `attempt_seq`. As tentativas históricas
--     são PRESERVADAS (nenhuma sobrescrita/apagamento) — o histórico é
--     reconstruível.
--   * `lease_at` + `attempt_token` (POSSE/LEASE): `pending` COM lease vigente é
--     ATIVA; `pending` SEM lease vigente (posse expirada/TTL) é INTERROMPIDA —
--     `pending` NÃO comprova execução ativa sozinha (nunca spinner preso).
--   * `request_token` (nullable) + UNIQUE `(campaign_id, operation_id,
--     request_token)`: a CONDIÇÃO de dedupe do MESMO acionamento (o cliente
--     NUNCA escolhe o vencedor — a identidade do acionamento é condição
--     validada, nunca autoridade). É escrito SOMENTE pela RPC de aquisição
--     (Plano 06); `apply`/`cancel` NÃO o exigem nem o gravam.
--
-- As RPCs condicionais passam a EXIGIR `attempt_seq` + `attempt_token`; uma
-- tentativa SUPERADA que tenta concluir depois do início de outra é REJEITADA
-- com desfecho `stale_attempt` e o estado PERSISTIDO da tentativa corrente NÃO
-- muda (proteção contra conclusão atrasada). O terminal PROTEGIDO é preservado
-- POR TENTATIVA e ENTRE TENTATIVAS: um `completed` em QUALQUER tentativa é
-- terminal para a entrega e nunca é sobrescrito; uma escrita não-terminal ou de
-- tentativa MAIOR é RECUSADA enquanto um `completed` persiste.
--
-- RPC-ONLY WRITES (A2) — (re)afirmados: `service_role` recebe SELECT ONLY nestas
-- tabelas; TODAS as mutações passam pelas RPCs `SECURITY DEFINER` com `SET
-- search_path = ''`. Um `INSERT`/`UPDATE`/`DELETE` DIRETO é NEGADO.
--
-- NULLABLE / BACKFILL — as colunas `attempt_seq`/`attempt_token`/`lease_at`/
-- `request_token` são criadas NULLABLE AQUI. O BACKFILL e o `SET NOT NULL` de
-- `attempt_seq`/`attempt_token` são responsabilidade da migration de dados do
-- Plano 06 (`20261013000003`); `request_token` PERMANECE NULLABLE (o histórico
-- b1b não tem token de acionamento).
--
-- Fronteira de reuso: NÃO altera `campaigns` nem qualquer tabela/coluna legada;
-- apenas REFERENCIA `campaigns`. Não cria tabela append-only separada (alternativa
-- rejeitada em B2A-D4). Fora de escopo deste arquivo: a RPC de aquisição
-- (`20261013000002`, Plano 06) e o backfill (`20261013000003`, Plano 06).

-- =============================================================================
-- 1. Identidade/histórico de tentativas + posse/lease na linha da copy
-- =============================================================================
ALTER TABLE public.product_1_1_copy_state
  ADD COLUMN IF NOT EXISTS attempt_seq   INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_token UUID,
  ADD COLUMN IF NOT EXISTS lease_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_token UUID;

-- Teto de 6 tentativas (B2A-D2/D4: 3 automáticas + 3 manuais). NULLABLE até o
-- backfill do Plano 06; quando preenchida, DEVE estar em 1..6.
ALTER TABLE public.product_1_1_copy_state
  DROP CONSTRAINT IF EXISTS ck_p1_1_copy_state_attempt_seq;
ALTER TABLE public.product_1_1_copy_state
  ADD CONSTRAINT ck_p1_1_copy_state_attempt_seq
  CHECK (attempt_seq IS NULL OR attempt_seq BETWEEN 1 AND 6);

-- UMA linha POR TENTATIVA: substitui a UNIQUE `(campaign_id, operation_id)`
-- (b1b) pela identidade composta `(campaign_id, operation_id, attempt_seq)`.
ALTER TABLE public.product_1_1_copy_state
  DROP CONSTRAINT IF EXISTS uq_p1_1_copy_state_op;
ALTER TABLE public.product_1_1_copy_state
  DROP CONSTRAINT IF EXISTS uq_p1_1_copy_state_op_attempt;
ALTER TABLE public.product_1_1_copy_state
  ADD CONSTRAINT uq_p1_1_copy_state_op_attempt
  UNIQUE (campaign_id, operation_id, attempt_seq);

-- CONDIÇÃO de dedupe do MESMO acionamento (reenvio atrasado do mesmo
-- `request_token` NÃO adquire nova tentativa). NULLs são distintos (histórico
-- b1b sem token). Escritado SOMENTE pela RPC de aquisição (Plano 06).
ALTER TABLE public.product_1_1_copy_state
  DROP CONSTRAINT IF EXISTS uq_p1_1_copy_state_op_request;
ALTER TABLE public.product_1_1_copy_state
  ADD CONSTRAINT uq_p1_1_copy_state_op_request
  UNIQUE (campaign_id, operation_id, request_token);

-- Índice por MAIOR `attempt_seq` (leitura do estado corrente, index-serving).
DROP INDEX IF EXISTS public.idx_p1_1_copy_state_campaign_operation;
CREATE INDEX IF NOT EXISTS idx_p1_1_copy_state_campaign_operation
  ON public.product_1_1_copy_state (campaign_id, operation_id, attempt_seq DESC);

-- =============================================================================
-- 2. RPC-only (A2) — (re)afirmado na tabela de estado (service_role SELECT only)
-- =============================================================================
ALTER TABLE public.product_1_1_copy_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role reads product 1:1 copy state"
  ON public.product_1_1_copy_state;
CREATE POLICY "Service role reads product 1:1 copy state"
  ON public.product_1_1_copy_state FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.product_1_1_copy_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_copy_state FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_state FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_copy_state TO service_role;

-- (Re)afirma a A2 na tabela de cancelamentos (UNIQUE/colunas migradas no Plano 06).
ALTER TABLE public.product_1_1_copy_cancellations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role reads product 1:1 copy cancellations"
  ON public.product_1_1_copy_cancellations;
CREATE POLICY "Service role reads product 1:1 copy cancellations"
  ON public.product_1_1_copy_cancellations FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.product_1_1_copy_cancellations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_copy_cancellations FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_cancellations FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_copy_cancellations TO service_role;

-- =============================================================================
-- 3. RPCs condicionais POR TENTATIVA (identidade + `stale_attempt` + terminal)
-- =============================================================================

-- 3.1 — Transição CONDICIONAL por tentativa + terminal PROTEGIDO + replay por
-- CONTEÚDO NULL-safe + `stale_attempt` para tentativa SUPERADA. Retorna
-- `{ applied, outcome, state }` com:
--   outcome ∈ { applied, idempotent, conflict, rejected, invalid_content, stale_attempt }
--   * applied          — transição/criação efetivada (da tentativa `p_attempt_seq`)
--   * idempotent       — replay EQUIVALENTE da MESMA tentativa (nenhuma escrita)
--   * conflict         — MESMA tentativa, token ou conteúdo DIVERGENTE (inalterado)
--   * rejected         — terminal protegido / escrita não-terminal ou maior-seq sobre `completed`
--   * invalid_content  — `completed` sem texto/payload entregável (C2)
--   * stale_attempt    — `p_attempt_seq` MENOR que a corrente (conclusão atrasada;
--                        o PERSISTIDO da tentativa corrente NÃO muda)
-- A assinatura AMPLIADA (7 args) obriga DROP da antiga (5 args) antes do replace.
DROP FUNCTION IF EXISTS public.product_1_1_apply_copy_state(UUID, UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.product_1_1_apply_copy_state(
  p_campaign_id   UUID,
  p_operation_id  UUID,
  p_state         TEXT,
  p_attempt_seq   INTEGER,
  p_attempt_token UUID,
  p_copy_text     TEXT    DEFAULT NULL,
  p_copy_payload  JSONB   DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row         public.product_1_1_copy_state%ROWTYPE;
  v_max_seq     INTEGER;
  v_max_state   TEXT;
  v_completed   BOOLEAN;
  v_terminal    BOOLEAN;
  v_equivalent  BOOLEAN;
  v_inserted    UUID;
BEGIN
  IF p_campaign_id  IS NULL THEN RAISE EXCEPTION 'missing_campaign_id';  END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_attempt_seq IS NULL OR p_attempt_token IS NULL THEN
    RAISE EXCEPTION 'missing_attempt_identity';
  END IF;
  IF p_attempt_seq NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'invalid_attempt_seq';
  END IF;
  IF p_state IS NULL OR p_state NOT IN ('pending','completed','failed') THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;

  -- C2 — `completed` EXIGE conteúdo ENTREGÁVEL. Um `completed` sem texto não é
  -- persistido como terminal: devolve `invalid_content` (nunca sucesso enganoso).
  IF p_state = 'completed'
     AND (p_copy_text IS NULL OR btrim(p_copy_text) = '') THEN
    RETURN jsonb_build_object('applied', false, 'outcome', 'invalid_content', 'state', NULL);
  END IF;

  -- TRAVA por operação: serializa as transições DESTA operação (todas as
  -- tentativas concorrentes sob a MESMA trava).
  PERFORM 1 FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
    FOR UPDATE;

  SELECT COALESCE(MAX(attempt_seq), 0) INTO v_max_seq
    FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id;

  SELECT state INTO v_max_state
    FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
      AND attempt_seq = v_max_seq;

  -- 1) STALE — tentativa SUPERADA (seq MENOR que a corrente): conclusão atrasada.
  --    NÃO toca o estado PERSISTIDO; devolve o estado da tentativa corrente.
  --    Verificado ANTES da lógica de token/terminal.
  IF p_attempt_seq < v_max_seq THEN
    RETURN jsonb_build_object('applied', false, 'outcome', 'stale_attempt', 'state', v_max_state);
  END IF;

  -- 2) `completed` em QUALQUER tentativa é TERMINAL para a entrega: nunca
  --    sobrescrito. Recusa escrita não-terminal ou de tentativa MAIOR sobre uma
  --    entrega já `completed`. O replay/terminal da PRÓPRIA linha `completed`
  --    (mesma seq) segue para o bloco de terminal protegido abaixo (idempotent/
  --    conflict).
  SELECT EXISTS (
    SELECT 1 FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
      AND state = 'completed'
  ) INTO v_completed;

  IF v_completed AND NOT (v_max_state = 'completed' AND p_attempt_seq = v_max_seq) THEN
    RETURN jsonb_build_object('applied', false, 'outcome', 'rejected', 'state', 'completed');
  END IF;

  -- 3) ALVO = linha da TENTATIVA `p_attempt_seq` (existe ou não).
  SELECT * INTO v_row
    FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
      AND attempt_seq = p_attempt_seq;

  IF NOT FOUND THEN
    -- PRIMEIRA escrita da tentativa. POSSE/LEASE carimbada só ao NASCER `pending`
    -- (a tentativa adquire a posse ao nascer). `ON CONFLICT DO NOTHING` resolve a
    -- corrida de dois criadores concorrentes da MESMA tentativa sem erro incidental.
    INSERT INTO public.product_1_1_copy_state
      (campaign_id, operation_id, attempt_seq, attempt_token, state,
       copy_text, copy_payload, lease_at, updated_at)
    VALUES
      (p_campaign_id, p_operation_id, p_attempt_seq, p_attempt_token, p_state,
       p_copy_text, p_copy_payload,
       CASE WHEN p_state = 'pending' THEN now() ELSE NULL END, now())
    ON CONFLICT (campaign_id, operation_id, attempt_seq) DO NOTHING
    RETURNING id INTO v_inserted;

    IF v_inserted IS NOT NULL THEN
      RETURN jsonb_build_object('applied', true, 'outcome', 'applied', 'state', p_state);
    END IF;

    -- C1 — PERDEU a corrida: a linha VENCEDORA existe (o `ON CONFLICT` esperou o
    -- commit do concorrente). RE-LÊ sob trava e aplica a MESMA regra contra o
    -- estado PERSISTIDO da tentativa — NUNCA devolve `rejected` com `state: null`.
    SELECT * INTO v_row
      FROM public.product_1_1_copy_state
      WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
        AND attempt_seq = p_attempt_seq;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'copy_state_race_unresolved';
    END IF;
  END IF;

  -- 4) IDENTIDADE da tentativa: mesma seq, token DIVERGENTE ⇒ CONFLITO (nunca
  --    sobrescrita de uma tentativa de outro dono).
  IF v_row.attempt_token IS DISTINCT FROM p_attempt_token THEN
    RETURN jsonb_build_object('applied', false, 'outcome', 'conflict', 'state', v_row.state);
  END IF;

  -- `terminal` é DERIVADO do `state` (nenhuma coluna dedicada).
  v_terminal := v_row.state IN ('completed','failed');

  -- 5) TERMINAL PROTEGIDO POR TENTATIVA: um estado final é FINAL. Só um replay
  --    EQUIVALENTE (NULL-safe) da MESMA tentativa é aceito.
  IF v_terminal THEN
    IF v_row.state = p_state THEN
      v_equivalent := (v_row.copy_text    IS NOT DISTINCT FROM p_copy_text)
                 AND (v_row.copy_payload IS NOT DISTINCT FROM p_copy_payload);
      IF v_equivalent THEN
        RETURN jsonb_build_object('applied', false, 'outcome', 'idempotent', 'state', v_row.state);
      END IF;
      RETURN jsonb_build_object('applied', false, 'outcome', 'conflict', 'state', v_row.state);
    END IF;
    RETURN jsonb_build_object('applied', false, 'outcome', 'rejected', 'state', v_row.state);
  END IF;

  -- 6) NÃO-terminal (`pending`): replay de `pending` é no-op idempotente.
  IF v_row.state = p_state THEN
    RETURN jsonb_build_object('applied', false, 'outcome', 'idempotent', 'state', v_row.state);
  END IF;

  -- Transição permitida (`pending` → `completed`/`failed`) na MESMA tentativa.
  UPDATE public.product_1_1_copy_state
     SET state        = p_state,
         copy_text    = p_copy_text,
         copy_payload = p_copy_payload,
         updated_at   = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('applied', true, 'outcome', 'applied', 'state', p_state);
END;
$$;

-- 3.2 — Cancelamento ATÔMICO POR TENTATIVA: aplica o terminal `failed` (carregando
-- o payload de recuperação) E registra o motivo numa ÚNICA transação. EXIGE
-- identidade; RECUSA tentativa SUPERADA (`stale_attempt`) e `completed` persistido
-- (`canceled:false`). A assinatura AMPLIADA (6 args) obriga DROP da antiga (3 args).
DROP FUNCTION IF EXISTS public.product_1_1_cancel_copy(UUID, UUID, TEXT);

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

  -- (1) Aplica o terminal `failed` sob a MESMA transação, reusando a proteção
  --     terminal/stale/completed da RPC condicional. O payload de recuperação é
  --     repassado (quando ausente, o `failed` preserva o comportamento b1b).
  v_apply   := public.product_1_1_apply_copy_state(
    p_campaign_id, p_operation_id, 'failed', p_attempt_seq, p_attempt_token,
    NULL, p_copy_payload);
  v_state   := v_apply->>'state';
  v_applied := COALESCE((v_apply->>'applied')::boolean, false);
  v_outcome := v_apply->>'outcome';

  -- (2) Tentativa SUPERADA ⇒ cancelamento NÃO se aplica (recusa), devolve
  --     `stale_attempt` com `canceled:false`. O persistido da corrente NÃO muda.
  IF v_outcome = 'stale_attempt' THEN
    RETURN jsonb_build_object('applied', false, 'state', v_state, 'canceled', false, 'outcome', 'stale_attempt');
  END IF;

  -- (3) O cancelamento só é registrado quando o estado terminal OBSERVADO é
  --     `failed` (nunca sobre um `completed` persistido). Idempotente pelo UNIQUE.
  IF v_state = 'failed' THEN
    INSERT INTO public.product_1_1_copy_cancellations (campaign_id, operation_id, reason)
    VALUES (p_campaign_id, p_operation_id, p_reason)
    ON CONFLICT (campaign_id, operation_id) DO NOTHING;
    RETURN jsonb_build_object('applied', v_applied, 'state', 'failed', 'canceled', true);
  END IF;

  -- Já `completed` persistido (ou estado indisponível) ⇒ NÃO cancela.
  RETURN jsonb_build_object('applied', v_applied, 'state', v_state, 'canceled', false);
END;
$$;

-- =============================================================================
-- 4. Privilégios RPC-only (A2) — novas assinaturas (service_role EXECUTE only)
-- =============================================================================
REVOKE ALL ON FUNCTION public.product_1_1_apply_copy_state(UUID, UUID, TEXT, INTEGER, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_apply_copy_state(UUID, UUID, TEXT, INTEGER, UUID, TEXT, JSONB)
  TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT, INTEGER, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT, INTEGER, UUID, JSONB)
  TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada).
-- O revert NÃO apaga histórico de tentativas já persistido (mantém as linhas);
-- apenas devolve a projeção de identidade/lease ao estado pré-B2.1.
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.product_1_1_cancel_copy(UUID, UUID, TEXT, INTEGER, UUID, JSONB);
-- DROP FUNCTION IF EXISTS public.product_1_1_apply_copy_state(UUID, UUID, TEXT, INTEGER, UUID, TEXT, JSONB);
-- -- restaura os grants ORIGINAIS (escrita direta) se necessário para rollback:
-- REVOKE SELECT ON TABLE public.product_1_1_copy_state FROM service_role;
-- GRANT SELECT, INSERT, UPDATE ON TABLE public.product_1_1_copy_state TO service_role;
-- DROP POLICY IF EXISTS "Service role reads product 1:1 copy state"
--   ON public.product_1_1_copy_state;
-- CREATE POLICY "Service role can read/write product 1:1 copy state"
--   ON public.product_1_1_copy_state FOR ALL TO service_role
--   USING (true) WITH CHECK (true);
-- DROP INDEX IF EXISTS public.idx_p1_1_copy_state_campaign_operation;
-- CREATE INDEX IF NOT EXISTS idx_p1_1_copy_state_campaign_operation
--   ON public.product_1_1_copy_state (campaign_id, operation_id);
-- ALTER TABLE public.product_1_1_copy_state
--   DROP CONSTRAINT IF EXISTS uq_p1_1_copy_state_op_request;
-- ALTER TABLE public.product_1_1_copy_state
--   DROP CONSTRAINT IF EXISTS uq_p1_1_copy_state_op_attempt;
-- ALTER TABLE public.product_1_1_copy_state
--   DROP CONSTRAINT IF EXISTS ck_p1_1_copy_state_attempt_seq;
-- ALTER TABLE public.product_1_1_copy_state
--   ADD CONSTRAINT uq_p1_1_copy_state_op UNIQUE (campaign_id, operation_id);
-- ALTER TABLE public.product_1_1_copy_state
--   DROP COLUMN IF EXISTS request_token,
--   DROP COLUMN IF EXISTS lease_at,
--   DROP COLUMN IF EXISTS attempt_token,
--   DROP COLUMN IF EXISTS attempt_seq;
