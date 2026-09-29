-- =============================================================================
-- F48.2.2 — DDL LOCAL da bancada de geração (fora da cadeia de migrations, D17)
-- =============================================================================
--
-- Este arquivo NÃO vive em `supabase/migrations/` de propósito: um
-- `supabase db push` geral NUNCA carrega as tabelas da bancada ao remoto. Ele é
-- aplicado apenas pelo bootstrap local `scripts/lab/48-2-2-bench-bootstrap.mjs`.
--
-- Escopo (bounded context da bancada, isolado da produção):
--   * public.lab_bench_runs      — unidade de auditoria própria por geração (D9)
--   * public.lab_bench_artifacts — metadados das entradas/saída (D9)
--   * public.lab_bench_store_imports — auditoria local da importação de identidade
--     das lojas de teste (F48.2.3, D11) + colunas de evidência do preflight do
--     prompt em lab_bench_runs (F48.2.3, D20) — ambos ADITIVOS, com REVERT.
--   * Índice único parcial GLOBAL de geração ativa — SOMENTE `pending`/`running`
--     (o estado `draft` não ocupa o slot; vários drafts coexistem) (D10)
--   * RLS + policy service_role + REVOKE/GRANT (mesmo padrão da F48.1)
--   * Trigger de imutabilidade de snapshot/config/prompt a partir de `running`
--     (permite a população `draft → pending`) e trigger de proibição de DELETE
--   * Bucket `lab-artifacts` reaproveitado da F48.1 (NÃO recriado aqui)
--
-- Proibido: qualquer objeto produtivo, as tabelas operacionais de campanha, a
-- telemetria de geração, a seleção/catálogo de modelos, a auditoria administrativa
-- e o bucket de imagens de campanha. Nenhum INSERT de dado de negócio.
--
-- Estritamente ADITIVO e idempotente: pode ser reaplicado sem erro nem duplicação.
-- =============================================================================

-- =============================================================================
-- 1. public.lab_bench_runs — geração da bancada com snapshot imutável (D9/D10)
--    `operation_id` único (idempotência), `status` nasce em `draft` (preparação/
--    upload, fora do slot global). `campaign_snapshot`/`branding_snapshot`/
--    `config`/`prompt_sent` são NULLABLE: o run em `draft` recebe a configuração
--    via setBenchRunInput antes da confirmação `draft → pending`. Sem CHECK por
--    valor nas dimensões — a autoridade é o registry em código (D6).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_bench_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','running','succeeded','failed','cancelled','timeout')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  campaign_snapshot JSONB,
  branding_snapshot JSONB,
  config JSONB,
  prompt_sent TEXT,
  "references" JSONB,
  provider TEXT,
  protocol TEXT,
  model TEXT,
  size TEXT,
  quality TEXT,
  intent TEXT,
  content_type TEXT,
  structure TEXT,
  theme TEXT,
  latency_ms INT,
  usage JSONB,
  estimated_cost_usd NUMERIC(12,6),
  cost_detail JSONB,
  cost_source TEXT,
  cost_rule_version TEXT,
  error_type TEXT,
  error_message TEXT,
  technical_validation JSONB
);

-- =============================================================================
-- 1b. Evidência mínima do preflight do prompt (F48.2.3, D20)
--     Colunas ADITIVAS e NULLABLE em `lab_bench_runs` (reusa `prompt_sent` e
--     `campaign_snapshot`). Persistidas em `draft` via setBenchRunInput; o
--     trigger de imutabilidade a partir de `running` NÃO é alterado. Aplicadas
--     com `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para idempotência sobre uma
--     base já existente (o `CREATE TABLE IF NOT EXISTS` acima é um no-op nesse caso).
-- =============================================================================
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS prompt_base TEXT;
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS prompt_compiled TEXT;
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS prompt_approved TEXT;
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS prompt_blocks JSONB;
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS composer_version TEXT;

-- =============================================================================
-- 2. public.lab_bench_artifacts — metadados das entradas/saída (D9)
--    `kind` restrito a `input`/`output`; o objeto vive no bucket privado
--    `lab-artifacts` sob `bench/{runId}/...`. `removed_at` marca a remoção física.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_bench_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.lab_bench_runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('input','output')),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  width INT,
  height INT,
  bytes BIGINT,
  checksum TEXT,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, kind, storage_path)
);

-- =============================================================================
-- 3. Índice único parcial GLOBAL de geração ativa (D10)
--    Garante no máximo UMA geração ativa em TODA a bancada. Cobre SOMENTE
--    `pending`/`running`: o estado `draft` NUNCA ocupa o slot global (vários
--    drafts podem coexistir). É o reforço de banco da transição compare-and-set
--    `draft → pending` (confirmBenchRun) — o perdedor da corrida recebe
--    `unique_violation`, mapeada para `bench_run_already_active`.
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_bench_runs_one_active_global
  ON public.lab_bench_runs ((true))
  WHERE status IN ('pending','running');

-- =============================================================================
-- 4. RLS + policies + grants (service-role only) — mesmo padrão da F48.1
-- =============================================================================
ALTER TABLE public.lab_bench_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_bench_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage lab_bench_runs" ON public.lab_bench_runs;
CREATE POLICY "Service role can manage lab_bench_runs"
  ON public.lab_bench_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage lab_bench_artifacts" ON public.lab_bench_artifacts;
CREATE POLICY "Service role can manage lab_bench_artifacts"
  ON public.lab_bench_artifacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.lab_bench_runs FROM anon;
REVOKE ALL ON TABLE public.lab_bench_runs FROM authenticated;
REVOKE ALL ON TABLE public.lab_bench_runs FROM service_role;
REVOKE ALL ON TABLE public.lab_bench_artifacts FROM anon;
REVOKE ALL ON TABLE public.lab_bench_artifacts FROM authenticated;
REVOKE ALL ON TABLE public.lab_bench_artifacts FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_bench_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_bench_artifacts TO service_role;

-- =============================================================================
-- 5. Trigger de imutabilidade (D9/D10)
--    `operation_id`/`created_by`/`created_at` são imutáveis SEMPRE.
--    `campaign_snapshot`/`branding_snapshot`/`config`/`prompt_sent` são imutáveis
--    a partir de `running` — na prática, o trigger só bloqueia alterações dessas
--    colunas quando `OLD.status NOT IN ('draft','pending')`, permitindo a
--    população em `draft` e a transição `draft → pending`. As colunas de resultado
--    permanecem atualizáveis.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trg_lab_bench_runs_snapshot_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.operation_id IS DISTINCT FROM OLD.operation_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'lab_bench_run_snapshot_immutable';
  END IF;

  IF OLD.status NOT IN ('draft','pending') THEN
    IF NEW.campaign_snapshot IS DISTINCT FROM OLD.campaign_snapshot
       OR NEW.branding_snapshot IS DISTINCT FROM OLD.branding_snapshot
       OR NEW.config IS DISTINCT FROM OLD.config
       OR NEW.prompt_sent IS DISTINCT FROM OLD.prompt_sent THEN
      RAISE EXCEPTION 'lab_bench_run_snapshot_immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lab_bench_runs_snapshot_immutable ON public.lab_bench_runs;
CREATE TRIGGER trg_lab_bench_runs_snapshot_immutable
BEFORE UPDATE ON public.lab_bench_runs
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_bench_runs_snapshot_immutable_fn();

-- =============================================================================
-- 6. Trigger de proibição de DELETE (D9) — o histórico de geração é preservado.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trg_lab_bench_runs_no_delete_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'lab_bench_run_delete_forbidden';
END;
$$;

DROP TRIGGER IF EXISTS trg_lab_bench_runs_no_delete ON public.lab_bench_runs;
CREATE TRIGGER trg_lab_bench_runs_no_delete
BEFORE DELETE ON public.lab_bench_runs
FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_bench_runs_no_delete_fn();

-- =============================================================================
-- 7. Bucket: `lab-artifacts` é REAPROVEITADO da F48.1 (NÃO recriado aqui) e a
--    policy existente de service_role já cobre os paths `bench/{runId}/...`.
-- =============================================================================

-- =============================================================================
-- 8. public.lab_bench_store_imports — auditoria local da importação (F48.2.3, D11)
--    Registra a materialização local da identidade de uma loja de teste pelo
--    comando explícito de importação. `source_host` é canonicalizado sem
--    credenciais; `detail` é jsonb saneado (sem chave/token/URL assinada).
--    É o ÚNICO destino de escrita aditivo da auditoria local. Vive fora de
--    `supabase/migrations/` — nunca é promovido ao remoto.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_bench_store_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  source_host TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by TEXT,
  source_updated_at TIMESTAMPTZ,
  asset_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.lab_bench_store_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage lab_bench_store_imports" ON public.lab_bench_store_imports;
CREATE POLICY "Service role can manage lab_bench_store_imports"
  ON public.lab_bench_store_imports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.lab_bench_store_imports FROM anon;
REVOKE ALL ON TABLE public.lab_bench_store_imports FROM authenticated;
REVOKE ALL ON TABLE public.lab_bench_store_imports FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_bench_store_imports TO service_role;

-- =============================================================================
-- REVERT (ordem reversa de criação — executar com `--revert` ou manualmente)
-- =============================================================================
-- ALTER TABLE public.lab_bench_runs DROP COLUMN IF EXISTS composer_version;
-- ALTER TABLE public.lab_bench_runs DROP COLUMN IF EXISTS prompt_blocks;
-- ALTER TABLE public.lab_bench_runs DROP COLUMN IF EXISTS prompt_approved;
-- ALTER TABLE public.lab_bench_runs DROP COLUMN IF EXISTS prompt_compiled;
-- ALTER TABLE public.lab_bench_runs DROP COLUMN IF EXISTS prompt_base;
-- DROP POLICY IF EXISTS "Service role can manage lab_bench_store_imports" ON public.lab_bench_store_imports;
-- ALTER TABLE public.lab_bench_store_imports DISABLE ROW LEVEL SECURITY;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_bench_store_imports FROM service_role;
-- DROP TABLE IF EXISTS public.lab_bench_store_imports CASCADE;
-- DROP TRIGGER IF EXISTS trg_lab_bench_runs_no_delete ON public.lab_bench_runs;
-- DROP FUNCTION IF EXISTS public.trg_lab_bench_runs_no_delete_fn();
-- DROP TRIGGER IF EXISTS trg_lab_bench_runs_snapshot_immutable ON public.lab_bench_runs;
-- DROP FUNCTION IF EXISTS public.trg_lab_bench_runs_snapshot_immutable_fn();
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_bench_artifacts FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_bench_runs FROM service_role;
-- DROP POLICY IF EXISTS "Service role can manage lab_bench_artifacts" ON public.lab_bench_artifacts;
-- DROP POLICY IF EXISTS "Service role can manage lab_bench_runs" ON public.lab_bench_runs;
-- ALTER TABLE public.lab_bench_artifacts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_bench_runs DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS public.uq_lab_bench_runs_one_active_global;
-- DROP TABLE IF EXISTS public.lab_bench_artifacts CASCADE;
-- DROP TABLE IF EXISTS public.lab_bench_runs CASCADE;
