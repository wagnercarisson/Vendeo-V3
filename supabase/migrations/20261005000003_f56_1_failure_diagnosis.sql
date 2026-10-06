-- F56.1 — Diagnóstico durável de falhas de geração do novo fluxo + referência de atendimento
-- Local-first: aplicar e validar apenas no Supabase local antes de qualquer push remoto.
-- Esta migration é ADITIVA e LOCAL-ONLY: NÃO deve haver `supabase db push` remoto antes
-- de aprovação humana explícita (proposal §Migração; tasks 9.5).
--
-- A validação desta migration (reset/lint + teste de durabilidade do repositório) EXIGE
-- uma instância Supabase DESCARTAVEL e comprovadamente ISOLADA (workdir/projeto/volume/porta
-- dedicados ao F56.1), SEPARADA da stack compartilhada Vendeo_V3. É OBRIGATÓRIO registrar a
-- IDENTIDADE da instância (workdir, porta/URL local, `supabase status`) antes de aplicar.
-- NÃO existe alternativa de dump/backup no repositório: não gere nem versione arquivos de
-- dump/backup local (não comprova restore de Storage e arrisca vazar dados locais).
--
-- Escopo (D-18/D-19/D-26):
--   1. Tabela `image_generation_failure_diagnoses` em colunas dedicadas e tipadas (NUNCA
--      JSONB): a referência de atendimento é a PK (UUID v4 aleatório e opaco) e o diagnóstico
--      interno (categoria interna, par modelo–qualidade, alvo, tentativa, erro normalizado,
--      run/trace) fica correlacionável APENAS pela referência, no admin/suporte.
--   2. RLS service_role only (SELECT/INSERT; SEM UPDATE/DELETE): o diagnóstico é imutável.
--   3. Trigger BEFORE UPDATE OR DELETE lançando `image_generation_failure_diagnosis_immutable`.
--
-- Isolamento do legado (D-07): esta migration NÃO toca `campaigns`, `generation_events`,
-- `ai_model_selection` nem qualquer tabela produtiva/legada; não há chamada de provider.
-- Nenhum dado de produção, campanha ou crédito é tocado.

-- =============================================================================
-- 1. Tabela durável de diagnósticos de falha (D-18/D-19/D-26)
-- =============================================================================
-- Colunas dedicadas e tipadas (nunca JSONB). `reference` é a PK opaca (UUID v4 gerado no
-- componente e reutilizado como chave de correlação). `code` é a única categoria pública de
-- falha de geração desta fatia (`IMG-001`), sem particionar quota/faturamento/auth/rate_limit.
-- O `normalized_error`/`message_public` são gravados JÁ sanitizados pelo repositório (sem
-- chave/URL/texto cru do provider).
CREATE TABLE IF NOT EXISTS public.image_generation_failure_diagnoses (
  reference         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL DEFAULT 'IMG-001',
  internal_category TEXT NOT NULL,
  model             TEXT,
  quality           TEXT,
  target            TEXT CHECK (target IN ('primary', 'fallback')),
  attempt_number    INTEGER,
  normalized_error  TEXT,
  run_id            UUID,
  trace_id          TEXT,
  message_public    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service_role only, com leitura/inserção — sem UPDATE/DELETE (diagnóstico imutável).
ALTER TABLE public.image_generation_failure_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read/insert failure diagnoses"
  ON public.image_generation_failure_diagnoses;
CREATE POLICY "Service role can read/insert failure diagnoses"
  ON public.image_generation_failure_diagnoses FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.image_generation_failure_diagnoses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.image_generation_failure_diagnoses TO service_role;

-- Imutabilidade estrutural: o diagnóstico nunca é reescrito. Qualquer tentativa de UPDATE
-- ou DELETE (inclusive pelo service_role) é recusada pelo trigger (T-56.1-39).
CREATE OR REPLACE FUNCTION public.trg_image_generation_failure_diagnosis_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'image_generation_failure_diagnosis_immutable';
END;
$$;

CREATE TRIGGER trg_image_generation_failure_diagnosis_immutable
BEFORE UPDATE OR DELETE ON public.image_generation_failure_diagnoses
FOR EACH ROW
EXECUTE FUNCTION public.trg_image_generation_failure_diagnosis_immutable_fn();

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente se necessário)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_image_generation_failure_diagnosis_immutable
--   ON public.image_generation_failure_diagnoses;
-- DROP FUNCTION IF EXISTS public.trg_image_generation_failure_diagnosis_immutable_fn();
-- DROP POLICY IF EXISTS "Service role can read/insert failure diagnoses"
--   ON public.image_generation_failure_diagnoses;
-- DROP TABLE IF EXISTS public.image_generation_failure_diagnoses;
