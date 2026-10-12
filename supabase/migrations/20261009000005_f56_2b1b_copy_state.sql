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
--      (correção de integração — gap 1). É MUTÁVEL (UPSERT do estado corrente),
--      logo `service_role` recebe SELECT/INSERT/UPDATE.
--   2. `public.product_1_1_copy_cancellations` — CANCELAMENTO registrado
--      SEPARADAMENTE do estado da copy (append-only/IMUTÁVEL): um cancelamento
--      pelo orçamento de espera NUNCA é confundido com falha de geração nem com
--      o estado `failed` da copy. `service_role` recebe SELECT/INSERT apenas.
--
-- Esta migration NÃO promete retomada automática do processamento da copy e NÃO
-- cria endpoint/ação de retry (pertence à b2). Fronteira de reuso: NÃO altera
-- `campaigns` nem qualquer tabela/coluna legada; apenas REFERENCIA `campaigns`.

-- =============================================================================
-- 1. Estado CORRENTE da copy (mutável; uma linha por operação)
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
CREATE POLICY "Service role can read/write product 1:1 copy state"
  ON public.product_1_1_copy_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.product_1_1_copy_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_copy_state FROM service_role;
-- Estado CORRENTE é mutável: UPSERT do estado corrente.
GRANT SELECT, INSERT, UPDATE ON TABLE public.product_1_1_copy_state TO service_role;

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
CREATE POLICY "Service role can read/insert product 1:1 copy cancellations"
  ON public.product_1_1_copy_cancellations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.product_1_1_copy_cancellations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_copy_cancellations FROM service_role;
GRANT SELECT, INSERT ON TABLE public.product_1_1_copy_cancellations TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_product_1_1_copy_cancellations_immutable
--   ON public.product_1_1_copy_cancellations;
-- DROP FUNCTION IF EXISTS public.trg_product_1_1_copy_cancellations_immutable_fn();
-- DROP POLICY IF EXISTS "Service role can read/insert product 1:1 copy cancellations"
--   ON public.product_1_1_copy_cancellations;
-- DROP INDEX IF EXISTS public.idx_p1_1_copy_cancellations_campaign_operation;
-- DROP TABLE IF EXISTS public.product_1_1_copy_cancellations;
-- DROP POLICY IF EXISTS "Service role can read/write product 1:1 copy state"
--   ON public.product_1_1_copy_state;
-- DROP INDEX IF EXISTS public.idx_p1_1_copy_state_campaign_operation;
-- DROP TABLE IF EXISTS public.product_1_1_copy_state;
