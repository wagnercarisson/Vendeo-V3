-- F56.2b1b — Registro imutável do artefato do Produto 1:1 (Plano 05)
-- Esta migration é LOCAL-ONLY e é apenas AUTORADA aqui. NÃO executar
-- `supabase db push` (nem qualquer mutação remota). Aplicar exclusivamente na
-- instância isolada e descartável via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- e somente no Plano 09 (O2). Aplicá-la em qualquer outro lugar está fora de escopo.
--
-- A relação `public.product_1_1_campaign_artifacts` persiste, por operação do
-- novo fluxo (identidade `campaign_id` + `operation_id`), o caminho IMUTÁVEL do
-- objeto no bucket privado `campaign-images`, as dimensões REAIS (decodificadas
-- dos bytes pelo serviço — B1B-D6 / F7) e o `mime_type`. É imutável por trigger
-- (UPDATE/DELETE recusados) e legível/escrevível apenas por `service_role`
-- (SELECT/INSERT). O download só é liberado quando a operação está `delivered`
-- (portão do Plano 06) — o upload por si só NÃO libera entrega.
--
-- Fronteira de reuso: NÃO altera `campaigns`, `campaign_art_versions` nem
-- qualquer tabela/coluna legada; apenas REFERENCIA `campaigns`.

CREATE TABLE IF NOT EXISTS public.product_1_1_campaign_artifacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id),
  operation_id  UUID NOT NULL,
  storage_path  TEXT NOT NULL UNIQUE,
  width         INTEGER NOT NULL CHECK (width BETWEEN 1 AND 8192),
  height        INTEGER NOT NULL CHECK (height BETWEEN 1 AND 8192),
  mime_type     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_p1_1_artifact_op UNIQUE (campaign_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_p1_1_campaign_artifacts_campaign_operation
  ON public.product_1_1_campaign_artifacts (campaign_id, operation_id);

-- Imutabilidade: o registro do artefato nunca pode ser reescrito/removido.
CREATE OR REPLACE FUNCTION public.trg_product_1_1_campaign_artifacts_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'product_1_1_campaign_artifacts_immutable';
END;
$$;

CREATE TRIGGER trg_product_1_1_campaign_artifacts_immutable
BEFORE UPDATE OR DELETE ON public.product_1_1_campaign_artifacts
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_1_1_campaign_artifacts_immutable_fn();

ALTER TABLE public.product_1_1_campaign_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read/insert product 1:1 campaign artifacts"
  ON public.product_1_1_campaign_artifacts;
CREATE POLICY "Service role can read/insert product 1:1 campaign artifacts"
  ON public.product_1_1_campaign_artifacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.product_1_1_campaign_artifacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_1_1_campaign_artifacts FROM service_role;
GRANT SELECT, INSERT ON TABLE public.product_1_1_campaign_artifacts TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_product_1_1_campaign_artifacts_immutable
--   ON public.product_1_1_campaign_artifacts;
-- DROP FUNCTION IF EXISTS public.trg_product_1_1_campaign_artifacts_immutable_fn();
-- DROP POLICY IF EXISTS "Service role can read/insert product 1:1 campaign artifacts"
--   ON public.product_1_1_campaign_artifacts;
-- DROP INDEX IF EXISTS public.idx_p1_1_campaign_artifacts_campaign_operation;
-- DROP TABLE IF EXISTS public.product_1_1_campaign_artifacts;
