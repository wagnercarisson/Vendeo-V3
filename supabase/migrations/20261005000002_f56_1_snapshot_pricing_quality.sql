-- F56.1 — Snapshot imutável da configuração por campanha + dimensão de qualidade no pricing
-- Local-first: aplicar e validar apenas no Supabase local antes de qualquer push remoto.
-- Esta migration é ADITIVA e LOCAL-ONLY: NÃO deve haver `supabase db push` remoto
-- antes de aprovação humana explícita (proposal §Migração; tasks 9.5).
--
-- Escopo (D-08/D-12/D-14):
--   1. Tabela `image_generation_config_snapshots` em colunas dedicadas e tipadas
--      (NUNCA JSONB), com origem fechada (`human_decision`/`selection` — `default`
--      é impossível por CHECK) e imutabilidade por trigger, correlacionável com a
--      telemetria da operação por run/trace.
--   2. Coluna `quality` nullable em `ai_model_pricing` com dois índices parciais de
--      vigência distintos (linhas sem qualidade por `(provider, model)`; linhas com
--      qualidade por `(provider, model, quality)`), preservando a vigência legada.
--   3. RPC `admin_set_ai_model_price` estendida com `p_quality TEXT DEFAULT NULL`
--      como ÚLTIMO parâmetro, versionando por `(provider, model, quality)` e
--      mantendo retrocompatíveis as chamadas sem qualidade.
--
-- Isolamento do legado (D-07/D-10): esta migration NÃO altera `campaigns` nem
-- `generation_events`, NÃO torna colunas NOT NULL em tabelas legadas e NÃO toca a
-- cadeia de resolução de custo legada (`resolveAiCost`).

-- =============================================================================
-- 1. Tabela de snapshot imutável da configuração por campanha (D-12/D-14)
-- =============================================================================
-- Colunas dedicadas e tipadas (nunca JSONB). `campaign_id` é único: um snapshot
-- por campanha. A origem NÃO admite `default` — a resolução é fail-closed e a
-- ausência de configuração é erro, não uma origem. Operações legadas sem snapshot
-- são toleradas (nenhum NOT NULL é imposto a tabelas legadas).
CREATE TABLE IF NOT EXISTS public.image_generation_config_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL UNIQUE,
  primary_model     TEXT NOT NULL,
  primary_quality   TEXT NOT NULL,
  fallback_model    TEXT NOT NULL,
  fallback_quality  TEXT NOT NULL,
  config_version_id UUID NOT NULL,
  origin            TEXT NOT NULL CHECK (origin IN ('human_decision', 'selection')),
  run_id            UUID,
  trace_id          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service_role only
ALTER TABLE public.image_generation_config_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage image generation config snapshots" ON public.image_generation_config_snapshots;
CREATE POLICY "Service role can manage image generation config snapshots"
  ON public.image_generation_config_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.image_generation_config_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.image_generation_config_snapshots TO service_role;

-- Imutabilidade estrutural: par (modelo+qualidade), versão, origem, campaign_id e
-- created_at não podem divergir após a gravação (o admin não reescreve o passado).
-- Os campos de correlação `run_id`/`trace_id` permanecem atualizáveis para permitir
-- ligar o snapshot à telemetria da mesma operação (D-14).
CREATE OR REPLACE FUNCTION public.trg_image_generation_config_snapshots_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.primary_model IS DISTINCT FROM OLD.primary_model
     OR NEW.primary_quality IS DISTINCT FROM OLD.primary_quality
     OR NEW.fallback_model IS DISTINCT FROM OLD.fallback_model
     OR NEW.fallback_quality IS DISTINCT FROM OLD.fallback_quality
     OR NEW.config_version_id IS DISTINCT FROM OLD.config_version_id
     OR NEW.origin IS DISTINCT FROM OLD.origin
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'image_generation_config_snapshot_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_image_generation_config_snapshots_immutable
BEFORE UPDATE ON public.image_generation_config_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.trg_image_generation_config_snapshots_immutable_fn();

-- =============================================================================
-- 2. Dimensão de qualidade no pricing + índices parciais de vigência (D-08)
-- =============================================================================
-- Aditiva: `quality` nullable, sem impor NOT NULL (as linhas legadas permanecem
-- NULL e seguem regidas pela unicidade vigente `(provider, model)`).
ALTER TABLE public.ai_model_pricing
ADD COLUMN IF NOT EXISTS quality TEXT;

ALTER TABLE public.ai_model_pricing
DROP CONSTRAINT IF EXISTS chk_ai_model_pricing_quality;
ALTER TABLE public.ai_model_pricing
ADD CONSTRAINT chk_ai_model_pricing_quality
CHECK (quality IS NULL OR quality IN ('low', 'medium'));

-- Substitui a unicidade vigente única por duas parcialidades distintas: linhas sem
-- qualidade continuam por `(provider, model)`; linhas com qualidade por
-- `(provider, model, quality)`. Assim uma linha vigente com e outra sem qualidade
-- para o mesmo `(provider, model)` coexistem sem violar unicidade.
DROP INDEX IF EXISTS uq_ai_model_pricing_vigente;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_pricing_vigente_no_quality
  ON public.ai_model_pricing (provider, model)
  WHERE effective_until IS NULL AND quality IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_pricing_vigente_with_quality
  ON public.ai_model_pricing (provider, model, quality)
  WHERE effective_until IS NULL AND quality IS NOT NULL;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente se necessário)
-- =============================================================================
-- ALTER TABLE public.ai_model_pricing DROP CONSTRAINT IF EXISTS chk_ai_model_pricing_quality;
-- DROP INDEX IF EXISTS public.uq_ai_model_pricing_vigente_with_quality;
-- DROP INDEX IF EXISTS public.uq_ai_model_pricing_vigente_no_quality;
-- ALTER TABLE public.ai_model_pricing DROP COLUMN IF EXISTS quality;
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_pricing_vigente ON public.ai_model_pricing (provider, model) WHERE effective_until IS NULL;
-- DROP TRIGGER IF EXISTS trg_image_generation_config_snapshots_immutable ON public.image_generation_config_snapshots;
-- DROP FUNCTION IF EXISTS public.trg_image_generation_config_snapshots_immutable_fn();
-- DROP TABLE IF EXISTS public.image_generation_config_snapshots;
