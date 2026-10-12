-- F56.2b1b — Estado da copy do Produto 1:1 (Plano 08, F8 / REQ-56.2.2-11)
-- Esta migration é LOCAL-ONLY e é apenas AUTORADA aqui. NÃO executar
-- `supabase db push` (nem qualquer mutação remota / reset / migration up remoto).
-- Aplicar exclusivamente na instância isolada e descartável via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e somente no Plano 09 (O2). Aplicá-la em qualquer outro lugar está fora de
-- escopo. Autorar aqui ≠ aplicar.
--
-- F8 — o estado da copy (não bloqueante) é persistido em armazenamento ESCOLHIDO
-- e EXPLÍCITO, com uma linha por operação do novo fluxo (identidade
-- `campaign_id` + `operation_id`):
--
--   1. `public.product_1_1_copy_state` — estado CORRENTE da copy
--      (`pending`/`completed`/`failed`) com `updated_at`, MAIS o TEXTO/PAYLOAD
--      ENTREGUES (`copy_text`/`copy_payload`) para que a campanha possa lê-los
--      (correção de integração — gap 1).
--   2. `public.product_1_1_copy_cancellations` — CANCELAMENTO registrado
--      SEPARADAMENTE do estado da copy (append-only/IMUTÁVEL): um cancelamento
--      pelo orçamento de espera NUNCA é confundido com falha de geração nem com
--      o estado `failed` da copy.
--
-- P2 (transição/ordem NO BANCO — reconciliado, ZERO colunas novas): a garantia de
-- ORDEM/TRANSIÇÃO deixa de ser uma fila EM MEMÓRIA (frágil) e passa a ser imposta
-- AQUI, por RPCs CONDICIONAIS:
--
--   * `public.product_1_1_apply_copy_state` — transição CONDICIONAL com terminal
--     PROTEGIDO e replay vinculado a CONTEÚDO (equivalente ⇒ idempotente;
--     divergente ⇒ conflito); a corrida de PRIMEIRA escrita é resolvida por
--     RE-LEITURA sob trava (`FOR UPDATE`) da linha VENCEDORA (C1).
--   * `public.product_1_1_cancel_copy` — CANCELAMENTO ATÔMICO: aplica o terminal
--     `failed` E registra o motivo numa ÚNICA transação; RECUSA cancelar sobre um
--     `completed` PERSISTIDO. (`failed` continua podendo existir SEM cancelamento
--     — uma falha COMUM da copy; a atomicidade é da AÇÃO de cancelar.)
--
-- RPC-ONLY WRITES (A2): `service_role` recebe SELECT ONLY nestas tabelas; TODAS
-- as mutações passam pelas RPCs `SECURITY DEFINER`. Um `INSERT`/`UPDATE`/`DELETE`
-- DIRETO é NEGADO — não há como BURLAR as transições condicionais.
--
-- "NÃO CONFIRMADO" é incerteza LOCAL do CHAMADOR (A1), resolvida por RE-LEITURA
-- (`readCopyDelivery`) — NÃO por uma coluna persistida nem por um segundo write.
-- O `state` PERSISTIDO é AUTORITATIVO.
--
-- Esta migration NÃO promete retomada automática do processamento da copy e NÃO
-- cria endpoint/ação de retry (pertence à b2). Fronteira de reuso: NÃO altera
-- `campaigns` nem qualquer tabela/coluna legada; apenas REFERENCIA `campaigns`.

-- =============================================================================
-- 1. Estado CORRENTE da copy (mutável APENAS pelas RPCs; uma linha por operação)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_1_1_copy_state (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id UUID NOT NULL,
  state        TEXT NOT NULL CHECK (state IN ('pending', 'completed', 'failed')),
  -- Gap 1 (correção de integração): o TEXTO entregue pela copy é persistido (não
  -- só o estado), para que a campanha possa lê-lo. `copy_text` = texto principal
  -- entregue (`caption`); `copy_payload` = payload estruturado (título, legenda,
  -- hashtags, CTA). Ambos NULL enquanto não houver entrega (`pending`/`failed`).
  copy_text    TEXT,
  copy_payload JSONB,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_p1_1_copy_state_op UNIQUE (campaign_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_p1_1_copy_state_campaign_operation
  ON public.product_1_1_copy_state (campaign_id, operation_id);

ALTER TABLE public.product_1_1_copy_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read/write product 1:1 copy state"
  ON public.product_1_1_copy_state;
-- P2 (A2): leitura SOMENTE. As escritas passam por `product_1_1_apply_copy_state`.
CREATE POLICY "Service role reads product 1:1 copy state"
  ON public.product_1_1_copy_state FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.product_1_1_copy_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_copy_state FROM service_role;
-- P2 (A2) — RPC-only writes: `service_role` fica com SELECT ONLY. As mutações
-- (INSERT/UPDATE aplicadas sob transição condicional) vivem nas RPCs definidas
-- na seção 3. O REVOKE explícito é idempotente e protege contra grants prévios.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_state FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_copy_state TO service_role;

-- =============================================================================
-- 2. Cancelamento (SEPARADO do estado; append-only/imutável)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_1_1_copy_cancellations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id UUID NOT NULL,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_p1_1_copy_cancellation_op UNIQUE (campaign_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_p1_1_copy_cancellations_campaign_operation
  ON public.product_1_1_copy_cancellations (campaign_id, operation_id);

-- Imutabilidade: um cancelamento registrado nunca é reescrito/removido.
CREATE OR REPLACE FUNCTION public.trg_product_1_1_copy_cancellations_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'product_1_1_copy_cancellations_immutable';
END;
$$;

CREATE TRIGGER trg_product_1_1_copy_cancellations_immutable
BEFORE UPDATE OR DELETE ON public.product_1_1_copy_cancellations
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_1_1_copy_cancellations_immutable_fn();

ALTER TABLE public.product_1_1_copy_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read/insert product 1:1 copy cancellations"
  ON public.product_1_1_copy_cancellations;
-- P2 (A2): leitura SOMENTE. O cancelamento é inserido por `product_1_1_cancel_copy`.
CREATE POLICY "Service role reads product 1:1 copy cancellations"
  ON public.product_1_1_copy_cancellations FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.product_1_1_copy_cancellations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_copy_cancellations FROM service_role;
-- P2 (A2) — RPC-only writes: `service_role` fica com SELECT ONLY.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_cancellations FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_copy_cancellations TO service_role;

-- =============================================================================
-- 3. RPCs condicionais (A ORDEM/TRANSIÇÃO mora AQUI, nunca na fila em memória)
-- =============================================================================

-- 3.1 — Transição CONDICIONAL + terminal PROTEGIDO + replay por CONTEÚDO.
-- Retorna um objeto explícito `{ applied, outcome, state }` (nenhuma coluna
-- `applied` existe; `terminal` é DERIVADO de `state`).
--   outcome ∈ { applied, idempotent, conflict, rejected, invalid_content }
--   * applied          — transição/criação efetivada
--   * idempotent       — replay EQUIVALENTE (nenhuma escrita)
--   * conflict         — MESMO terminal, conteúdo DIVERGENTE (persistido inalterado)
--   * rejected         — terminal protegido / escrita não-terminal tardia
--   * invalid_content  — `completed` sem texto/payload entregável (C2)
CREATE OR REPLACE FUNCTION public.product_1_1_apply_copy_state(
  p_campaign_id  UUID,
  p_operation_id UUID,
  p_state        TEXT,
  p_copy_text    TEXT  DEFAULT NULL,
  p_copy_payload JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row        public.product_1_1_copy_state%ROWTYPE;
  v_terminal   BOOLEAN;
  v_equivalent BOOLEAN;
  v_inserted   UUID;
BEGIN
  IF p_campaign_id  IS NULL THEN RAISE EXCEPTION 'missing_campaign_id';  END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_state IS NULL OR p_state NOT IN ('pending','completed','failed') THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;

  -- C2 — `completed` EXIGE conteúdo ENTREGÁVEL. Um `completed` sem texto não é
  -- persistido como terminal: devolve `invalid_content` (nunca sucesso enganoso).
  IF p_state = 'completed'
     AND (p_copy_text IS NULL OR btrim(p_copy_text) = '') THEN
    RETURN jsonb_build_object('applied', false, 'outcome', 'invalid_content', 'state', NULL);
  END IF;

  -- TRAVA por operação: serializa as transições DESTA operação.
  SELECT * INTO v_row
  FROM public.product_1_1_copy_state
  WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
  FOR UPDATE;

  -- 1) PRIMEIRA escrita: cria a linha. `ON CONFLICT DO NOTHING` resolve a corrida
  --    de dois criadores concorrentes sem erro incidental de unicidade.
  IF NOT FOUND THEN
    INSERT INTO public.product_1_1_copy_state
      (campaign_id, operation_id, state, copy_text, copy_payload, updated_at)
    VALUES
      (p_campaign_id, p_operation_id, p_state, p_copy_text, p_copy_payload, now())
    ON CONFLICT (campaign_id, operation_id) DO NOTHING
    RETURNING id INTO v_inserted;

    IF v_inserted IS NOT NULL THEN
      RETURN jsonb_build_object('applied', true, 'outcome', 'applied', 'state', p_state);
    END IF;

    -- C1 — PERDEU a corrida: a linha VENCEDORA existe (o `ON CONFLICT` esperou o
    -- commit do concorrente). RE-LÊ sob trava e aplica a MESMA regra contra o
    -- estado PERSISTIDO — NUNCA devolve `rejected` com `state: null`.
    SELECT * INTO v_row
    FROM public.product_1_1_copy_state
    WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Defensivo: só ocorreria se o vencedor revertesse APÓS o `ON CONFLICT`,
      -- o que não acontece (o `DO NOTHING` espera o desfecho do concorrente).
      RAISE EXCEPTION 'copy_state_race_unresolved';
    END IF;
  END IF;

  -- `terminal` é DERIVADO do `state` (nenhuma coluna dedicada).
  v_terminal := v_row.state IN ('completed','failed');

  -- 2) TERMINAL PROTEGIDO: um estado final é FINAL. Só um replay EQUIVALENTE é aceito.
  IF v_terminal THEN
    IF v_row.state = p_state THEN
      -- Replay do MESMO estado terminal: exige CONTEÚDO EQUIVALENTE (NULL-safe).
      v_equivalent := (v_row.copy_text    IS NOT DISTINCT FROM p_copy_text)
                  AND (v_row.copy_payload IS NOT DISTINCT FROM p_copy_payload);
      IF v_equivalent THEN
        -- Idempotente: NADA é gravado (o persistido já é a verdade).
        RETURN jsonb_build_object('applied', false, 'outcome', 'idempotent', 'state', v_row.state);
      END IF;
      -- MESMO estado, CONTEÚDO DIVERGENTE ⇒ CONFLITO (nunca sucesso enganoso).
      RETURN jsonb_build_object('applied', false, 'outcome', 'conflict', 'state', v_row.state);
    END IF;
    -- Estado terminal DIFERENTE (completed↔failed) ou escrita não-terminal tardia
    -- ⇒ REJEITADO (o persistido permanece INALTERADO).
    RETURN jsonb_build_object('applied', false, 'outcome', 'rejected', 'state', v_row.state);
  END IF;

  -- 3) NÃO-terminal (`pending`): replay de `pending` é no-op idempotente.
  IF v_row.state = p_state THEN
    RETURN jsonb_build_object('applied', false, 'outcome', 'idempotent', 'state', v_row.state);
  END IF;

  -- Transição permitida (`pending` → `completed`/`failed`).
  UPDATE public.product_1_1_copy_state
     SET state        = p_state,
         copy_text    = p_copy_text,
         copy_payload = p_copy_payload,
         updated_at   = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('applied', true, 'outcome', 'applied', 'state', p_state);
END;
$$;

-- 3.2 — Cancelamento ATÔMICO: aplica o terminal `failed` E registra o motivo numa
-- ÚNICA transação. RECUSA cancelar sobre um `completed` PERSISTIDO.
-- Retorna `{ applied, state, canceled }`.
CREATE OR REPLACE FUNCTION public.product_1_1_cancel_copy(
  p_campaign_id  UUID,
  p_operation_id UUID,
  p_reason       TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apply   JSONB;
  v_state   TEXT;
  v_applied BOOLEAN;
BEGIN
  IF p_campaign_id  IS NULL THEN RAISE EXCEPTION 'missing_campaign_id';  END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;

  -- (1) Aplica o terminal `failed` sob a MESMA transação (mesmo escopo atômico).
  --     `completed` já persistido ⇒ a RPC condicional devolve `rejected` e o
  --     cancelamento NÃO é registrado abaixo.
  v_apply   := public.product_1_1_apply_copy_state(
    p_campaign_id, p_operation_id, 'failed', NULL, NULL);
  v_state   := v_apply->>'state';
  v_applied := COALESCE((v_apply->>'applied')::boolean, false);

  -- (2) O cancelamento só é registrado quando o estado terminal OBSERVADO é
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
-- 4. Privilégios RPC-only (A2)
-- =============================================================================
-- As funções são `SECURITY DEFINER` (rodam como o owner) — o gate real de acesso
-- é o EXECUTE abaixo. `anon`/`authenticated` permanecem SEM acesso.
REVOKE ALL ON FUNCTION public.product_1_1_apply_copy_state(UUID, UUID, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_apply_copy_state(UUID, UUID, TEXT, TEXT, JSONB)
  TO service_role;

REVOKE ALL ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT)
  TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.product_1_1_cancel_copy(UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.product_1_1_apply_copy_state(UUID, UUID, TEXT, TEXT, JSONB);
-- -- restaura os grants ORIGINAIS (escrita direta) se necessário para rollback:
-- REVOKE SELECT ON TABLE public.product_1_1_copy_state FROM service_role;
-- GRANT SELECT, INSERT, UPDATE ON TABLE public.product_1_1_copy_state TO service_role;
-- DROP POLICY IF EXISTS "Service role reads product 1:1 copy state"
--   ON public.product_1_1_copy_state;
-- CREATE POLICY "Service role can read/write product 1:1 copy state"
--   ON public.product_1_1_copy_state FOR ALL TO service_role
--   USING (true) WITH CHECK (true);
-- REVOKE SELECT ON TABLE public.product_1_1_copy_cancellations FROM service_role;
-- GRANT SELECT, INSERT ON TABLE public.product_1_1_copy_cancellations TO service_role;
-- DROP POLICY IF EXISTS "Service role reads product 1:1 copy cancellations"
--   ON public.product_1_1_copy_cancellations;
-- CREATE POLICY "Service role can read/insert product 1:1 copy cancellations"
--   ON public.product_1_1_copy_cancellations FOR ALL TO service_role
--   USING (true) WITH CHECK (true);
-- DROP TRIGGER IF EXISTS trg_product_1_1_copy_cancellations_immutable
--   ON public.product_1_1_copy_cancellations;
-- DROP FUNCTION IF EXISTS public.trg_product_1_1_copy_cancellations_immutable_fn();
-- DROP INDEX IF EXISTS public.idx_p1_1_copy_cancellations_campaign_operation;
-- DROP TABLE IF EXISTS public.product_1_1_copy_cancellations;
-- DROP INDEX IF EXISTS public.idx_p1_1_copy_state_campaign_operation;
-- DROP TABLE IF EXISTS public.product_1_1_copy_state;
