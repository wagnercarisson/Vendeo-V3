-- Migration F48.1 — Laboratório Mínimo de IA: tabelas, bucket e RLS/grants (design D3/D4/D5/D8/D10/D13/D14/D16)
--
-- LOCAL-FIRST: esta migration é criada e validada SOMENTE no Supabase local
-- (`npx supabase db reset` + `npx supabase db lint`). NÃO aplicar no remoto nesta
-- task. O push remoto deliberado é a última task do 48-1-14, após a UAT local,
-- para não deixar migration pendente que um `supabase db push` de outra fase
-- arrastaria. O schema remoto fica inerte (VENDEO_LAB_ENABLED=false).
--
-- Escopo: bounded context do laboratório, 100% isolado da produção.
--   * 8 tabelas próprias `lab_*` (server-only/service_role), RLS habilitada,
--     sem grants a `anon`/`authenticated`.
--   * Bucket privado `lab-artifacts` (public=false) com policy apenas para
--     `service_role` — nenhuma policy para `authenticated`/`anon` (nem SELECT).
--   * Índice único parcial GLOBAL de run ativo em `lab_runs`
--     (MAX_CONCURRENT_LAB_RUNS = 1 em todo o laboratório).
--
-- Proibido: tocar qualquer objeto produtivo (campanhas, arte, telemetria,
-- seleção/catálogo de modelos, auditoria administrativa) ou os paths do bucket
-- de imagens de campanha. Nenhum INSERT de dado de negócio.
--
-- Migration estritamente ADITIVA: nenhum DROP/ALTER de objeto pré-existente.

-- =============================================================================
-- 1. public.lab_scenarios — catálogo de cenários controlados (design D3/D4)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  current_version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. public.lab_scenario_versions — conteúdo versionado e imutável (design D3/D4)
--    Alterar conteúdo exige nova versão (nova linha); a imutabilidade é
--    reforçada por trigger na migration 20260915000003.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_scenario_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.lab_scenarios(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  fixture_path TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, version)
);

-- =============================================================================
-- 3. public.lab_experiments — experimento prompt-only com alvo fixo (design D3/D5)
--    `changed_dimension` é fixo em 'prompt' na F48.1 (model/configuration → F48.2);
--    `model_target` e `params` vivem no EXPERIMENTO (idênticos para as 2 variantes).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  changed_dimension TEXT NOT NULL DEFAULT 'prompt' CHECK (changed_dimension IN ('prompt')),
  primary_capability TEXT NOT NULL DEFAULT 'campaign_image',
  model_target JSONB NOT NULL,
  params JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','running','evaluated','archived')),
  repetitions INT NOT NULL DEFAULT 1 CHECK (repetitions BETWEEN 1 AND 3),
  max_runs INT NOT NULL DEFAULT 6 CHECK (max_runs BETWEEN 1 AND 12),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. public.lab_experiment_variants — baseline × candidata (design D3/D5)
--    Exatamente 2 por experimento (UNIQUE(experiment_id, role)); `experiment_id`
--    é imutável e o congelamento pós-primeiro-run é reforçado por trigger.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('baseline','candidate')),
  label TEXT NOT NULL,
  prompt_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, role)
);

-- =============================================================================
-- 5. public.lab_experiment_scenarios — junção ordenada experimento × cenário (D3)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_experiment_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL REFERENCES public.lab_scenario_versions(id),
  position INT NOT NULL,
  UNIQUE (experiment_id, scenario_version_id)
);

-- =============================================================================
-- 6. public.lab_runs — execução com snapshot imutável (design D3/D8/D14)
--    `snapshot` nunca vazio (gravado na transação da reserva) e `operation_id`
--    único (idempotência vinculada ao payload). `run_sequence` é derivado no
--    banco pela RPC lab_reserve_run — nunca aceito do cliente.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.lab_experiment_variants(id),
  scenario_version_id UUID NOT NULL REFERENCES public.lab_scenario_versions(id),
  repetition_index INT NOT NULL CHECK (repetition_index >= 1),
  run_sequence INT NOT NULL DEFAULT 1 CHECK (run_sequence >= 1),
  supersedes_run_id UUID REFERENCES public.lab_runs(id),
  operation_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','cancelled','timeout')),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object' AND snapshot <> '{}'::jsonb),
  provider TEXT,
  model TEXT,
  protocol TEXT,
  capability TEXT,
  attempts INT NOT NULL DEFAULT 0,
  latency_ms INT,
  usage JSONB,
  estimated_cost_usd NUMERIC(12,6),
  cost_detail JSONB,
  error_type TEXT,
  error_message TEXT,
  technical_validation JSONB,
  calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, variant_id, scenario_version_id, repetition_index, run_sequence)
);

-- =============================================================================
-- 7. Índice único parcial GLOBAL de run ativo (design D14)
--    Garante no máximo UM run ativo em TODA a tabela lab_runs — inclusive entre
--    experimentos diferentes — reforçando MAX_CONCURRENT_LAB_RUNS = 1. É o
--    reforço de banco da reserva atômica: o perdedor da corrida recebe
--    unique_violation e a RPC lab_reserve_run o traduz em 'run_already_active'.
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_runs_one_active_global
  ON public.lab_runs ((true))
  WHERE status IN ('pending','running');

-- =============================================================================
-- 8. public.lab_artifacts — metadados dos artefatos do bucket privado (D3/D10)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.lab_runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('output','input','diagnostic')),
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
-- 9. public.lab_human_evaluations — voto humano append-only (design D3/D13)
--    UPDATE/DELETE são bloqueados por trigger incondicional na migration
--    20260915000003 (reavaliação cria novo registro).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_human_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL REFERENCES public.lab_scenario_versions(id),
  baseline_run_id UUID NOT NULL REFERENCES public.lab_runs(id),
  candidate_run_id UUID NOT NULL REFERENCES public.lab_runs(id),
  blind_order TEXT CHECK (blind_order IN ('baseline_left','candidate_left')),
  verdict TEXT NOT NULL CHECK (verdict IN ('baseline','candidate','tie','none')),
  observation TEXT,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 10. RLS + policies + grants (server-only) — as 8 tabelas lab_*
--     Padrão vigente do repositório: RLS habilitada, policy FOR ALL para
--     service_role, REVOKE de anon/authenticated/service_role seguido de GRANT
--     explícito apenas a service_role. Nenhum grant a anon/authenticated.
-- =============================================================================

ALTER TABLE public.lab_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_scenario_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_experiment_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_human_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage lab_scenarios"
  ON public.lab_scenarios FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage lab_scenario_versions"
  ON public.lab_scenario_versions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage lab_experiments"
  ON public.lab_experiments FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage lab_experiment_variants"
  ON public.lab_experiment_variants FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage lab_experiment_scenarios"
  ON public.lab_experiment_scenarios FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage lab_runs"
  ON public.lab_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage lab_artifacts"
  ON public.lab_artifacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage lab_human_evaluations"
  ON public.lab_human_evaluations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.lab_scenarios FROM anon;
REVOKE ALL ON TABLE public.lab_scenarios FROM authenticated;
REVOKE ALL ON TABLE public.lab_scenarios FROM service_role;
REVOKE ALL ON TABLE public.lab_scenario_versions FROM anon;
REVOKE ALL ON TABLE public.lab_scenario_versions FROM authenticated;
REVOKE ALL ON TABLE public.lab_scenario_versions FROM service_role;
REVOKE ALL ON TABLE public.lab_experiments FROM anon;
REVOKE ALL ON TABLE public.lab_experiments FROM authenticated;
REVOKE ALL ON TABLE public.lab_experiments FROM service_role;
REVOKE ALL ON TABLE public.lab_experiment_variants FROM anon;
REVOKE ALL ON TABLE public.lab_experiment_variants FROM authenticated;
REVOKE ALL ON TABLE public.lab_experiment_variants FROM service_role;
REVOKE ALL ON TABLE public.lab_experiment_scenarios FROM anon;
REVOKE ALL ON TABLE public.lab_experiment_scenarios FROM authenticated;
REVOKE ALL ON TABLE public.lab_experiment_scenarios FROM service_role;
REVOKE ALL ON TABLE public.lab_runs FROM anon;
REVOKE ALL ON TABLE public.lab_runs FROM authenticated;
REVOKE ALL ON TABLE public.lab_runs FROM service_role;
REVOKE ALL ON TABLE public.lab_artifacts FROM anon;
REVOKE ALL ON TABLE public.lab_artifacts FROM authenticated;
REVOKE ALL ON TABLE public.lab_artifacts FROM service_role;
REVOKE ALL ON TABLE public.lab_human_evaluations FROM anon;
REVOKE ALL ON TABLE public.lab_human_evaluations FROM authenticated;
REVOKE ALL ON TABLE public.lab_human_evaluations FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_scenarios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_scenario_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_experiments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_experiment_variants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_experiment_scenarios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_artifacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_human_evaluations TO service_role;

-- =============================================================================
-- 11. Bucket privado lab-artifacts (design D10)
--     public=false, tamanho limitado, MIME restrito. Única policy é FOR ALL para
--     service_role — nenhuma policy para authenticated/anon (nem SELECT) e
--     nenhuma policy FOR UPDATE isolada (artefato não é sobrescrito).
--     Paths: experiments/{experimentId}/runs/{runId}/... — nunca os paths do
--     bucket de imagens de campanha.
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-artifacts',
  'lab-artifacts',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role can manage lab-artifacts objects" ON storage.objects;
CREATE POLICY "Service role can manage lab-artifacts objects"
ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'lab-artifacts')
WITH CHECK (bucket_id = 'lab-artifacts');

-- =============================================================================
-- REVERT (ordem reversa de criação — executar manualmente se necessário)
-- =============================================================================
-- DROP POLICY IF EXISTS "Service role can manage lab-artifacts objects" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'lab-artifacts';
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_human_evaluations FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_artifacts FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_runs FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_experiment_scenarios FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_experiment_variants FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_experiments FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_scenario_versions FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_scenarios FROM service_role;
-- DROP POLICY IF EXISTS "Service role can manage lab_human_evaluations" ON public.lab_human_evaluations;
-- DROP POLICY IF EXISTS "Service role can manage lab_artifacts" ON public.lab_artifacts;
-- DROP POLICY IF EXISTS "Service role can manage lab_runs" ON public.lab_runs;
-- DROP POLICY IF EXISTS "Service role can manage lab_experiment_scenarios" ON public.lab_experiment_scenarios;
-- DROP POLICY IF EXISTS "Service role can manage lab_experiment_variants" ON public.lab_experiment_variants;
-- DROP POLICY IF EXISTS "Service role can manage lab_experiments" ON public.lab_experiments;
-- DROP POLICY IF EXISTS "Service role can manage lab_scenario_versions" ON public.lab_scenario_versions;
-- DROP POLICY IF EXISTS "Service role can manage lab_scenarios" ON public.lab_scenarios;
-- ALTER TABLE public.lab_human_evaluations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_artifacts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_runs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_experiment_scenarios DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_experiment_variants DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_experiments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_scenario_versions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_scenarios DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS public.lab_human_evaluations CASCADE;
-- DROP TABLE IF EXISTS public.lab_artifacts CASCADE;
-- DROP TABLE IF EXISTS public.lab_runs CASCADE;
-- DROP TABLE IF EXISTS public.lab_experiment_scenarios CASCADE;
-- DROP TABLE IF EXISTS public.lab_experiment_variants CASCADE;
-- DROP TABLE IF EXISTS public.lab_experiments CASCADE;
-- DROP TABLE IF EXISTS public.lab_scenario_versions CASCADE;
-- DROP TABLE IF EXISTS public.lab_scenarios CASCADE;
-- DROP INDEX IF EXISTS public.uq_lab_runs_one_active_global;
