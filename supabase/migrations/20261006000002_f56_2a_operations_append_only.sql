-- F56.2a — Histórico append-only de operações/tentativas do Produto 1:1
-- Esta migration é aditiva e LOCAL-ONLY. Validar somente na instância Supabase
-- descartável isolada registrada em 56-2-ISOLATED-INSTANCE.md.
-- NÃO executar `supabase db push` remoto sem aprovação humana explícita.
--
-- A relação preserva cada tentativa e sua correlação com a campanha e o snapshot
-- original, sem atualizar `campaigns`, `generation_events` ou snapshots existentes.
-- A persistência operacional em campanha real pertence à F56.2b1.

CREATE TABLE IF NOT EXISTS public.image_generation_operations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES public.campaigns(id),
  snapshot_original_id UUID NOT NULL REFERENCES public.image_generation_config_snapshots(id),
  operation_id        UUID NOT NULL,
  attempt_number      INTEGER NOT NULL,
  target              TEXT NOT NULL CHECK (target IN ('primary', 'fallback')),
  model               TEXT NOT NULL,
  quality             TEXT NOT NULL CHECK (quality IN ('low', 'medium')),
  run_id              UUID,
  trace_id            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_generation_operations_campaign_operation
  ON public.image_generation_operations (campaign_id, operation_id);

ALTER TABLE public.image_generation_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read/insert image generation operations"
  ON public.image_generation_operations;
CREATE POLICY "Service role can read/insert image generation operations"
  ON public.image_generation_operations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.image_generation_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.image_generation_operations TO service_role;

CREATE OR REPLACE FUNCTION public.trg_image_generation_operations_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'image_generation_operations_immutable';
END;
$$;

CREATE TRIGGER trg_image_generation_operations_immutable
BEFORE UPDATE OR DELETE ON public.image_generation_operations
FOR EACH ROW
EXECUTE FUNCTION public.trg_image_generation_operations_immutable_fn();

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_image_generation_operations_immutable
--   ON public.image_generation_operations;
-- DROP FUNCTION IF EXISTS public.trg_image_generation_operations_immutable_fn();
-- DROP POLICY IF EXISTS "Service role can read/insert image generation operations"
--   ON public.image_generation_operations;
-- DROP TABLE IF EXISTS public.image_generation_operations;
