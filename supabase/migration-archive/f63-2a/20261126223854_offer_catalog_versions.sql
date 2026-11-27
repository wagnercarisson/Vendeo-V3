-- =============================================================================
-- F63 — Base versionada de ofertas (subfatia 2A)
-- Migration A — estrutura do catálogo versionado, guardas, vigência, funções,
-- RLS/grants e bloco REVERT comentado.
--
-- Escopo:
--   1. public.trial_offer_versions (condições versionadas imutáveis).
--   2. Checks de domínio nomeados (duração, total, frequência, créditos).
--   3. Unicidades e FKs (programa, identidade composta, autoria SET NULL).
--   4. Helper public.trial_offer_calendar_reaches_total (IMMUTABLE INVOKER).
--   5. Trigger de publicação/imutabilidade da versão.
--   6. Trigger de proteção de exclusão de versão publicada.
--   7. public.trial_offer_settings.current_version_id (nullable nesta migration,
--      FK composta e trigger de versão publicada).
--   8. Contratos de leitura: conditions, public_offer e release_schedule.
--   9. RLS e grants restritos a service_role.
--  10. REVERT comentado na ordem segura.
--
-- Alvo exclusivo: homolog local existente (container supabase_db_vendeo-homolog,
-- banco postgres). NENHUMA aplicação em produção ou banco remoto.
--
-- Esta migration NÃO altera:
--   - trial_offer_enrollments (sem offer_version_id, sem backfill);
--   - credit_balances / credit_transactions / freemium_entitlements;
--   - RPCs existentes, constantes, status, completion, copy, Admin ou flags.
--
-- Ordem de aplicação: em UMA transação, com a linha do ledger
-- (supabase_migrations.schema_migrations) inserida na MESMA transação. Em falha,
-- rollback integral: nenhum DDL parcial permanece. Não há reset de banco,
-- criação de banco, backup obrigatório nem qualquer comando remoto.
--
-- Efeito esperado no ambiente: +1 linha no ledger e a coluna
-- trial_offer_settings.current_version_id (nullable, sem valor atribuído).
-- Nenhuma linha de trial_offer_versions é criada (seed pertence à Migration B).
--
-- Nota de fingerprint: o F57.2 filtra nomes `f57_2_`; com +1 linha neste ledger
-- o fingerprint armazenado do F57.2 passa a divergir. O F57.2 NÃO é reexecutado
-- após o F63; o re-baseline do F57.2 está explicitamente FORA de escopo.
--
-- REVERT: ver bloco comentado no fim do arquivo. Só é seguro antes de existirem
-- referências futuras a versões publicadas; depois disso, a correção é publicar
-- uma nova versão e repontar a vigência.
-- =============================================================================

-- =============================================================================
-- 1. Tabela do catálogo versionado
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.trial_offer_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_key TEXT NOT NULL,
  version_label TEXT NOT NULL,
  public_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  max_total_credits INTEGER NOT NULL,
  release_frequency TEXT NOT NULL,
  credits_per_release INTEGER,
  published_at TIMESTAMPTZ,
  published_by UUID,
  publication_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trial_offer_versions IS
  'F63: catálogo versionado das condições de oferta. published_at IS NOT NULL é o único marcador de publicação; versões publicadas são imutáveis e não podem ser excluídas.';
COMMENT ON COLUMN public.trial_offer_versions.offer_key IS
  'F63: identidade estável do programa, referenciando public.trial_offer_settings(offer_key).';
COMMENT ON COLUMN public.trial_offer_versions.version_label IS
  'F63: rótulo da versão dentro do programa. Único por offer_key e imutável após a criação.';
COMMENT ON COLUMN public.trial_offer_versions.public_name IS
  'F63: nome público exibido ao lojista; congelado após a publicação.';
COMMENT ON COLUMN public.trial_offer_versions.duration_days IS
  'F63: janela da oferta em dias (> 0). A última liberação deve ocorrer estritamente antes do vencimento.';
COMMENT ON COLUMN public.trial_offer_versions.max_total_credits IS
  'F63: total de créditos que toda versão publicada entrega dentro da janela (> 0), sem truncamento.';
COMMENT ON COLUMN public.trial_offer_versions.release_frequency IS
  'F63: once|daily|weekly|monthly. Representa a cadência do calendário derivado.';
COMMENT ON COLUMN public.trial_offer_versions.credits_per_release IS
  'F63: créditos por liberação. NULL em once; obrigatório, positivo e <= max_total_credits nas recorrentes.';
COMMENT ON COLUMN public.trial_offer_versions.published_at IS
  'F63: instante de publicação. Único marcador de versão publicada; NULL indica rascunho editável.';
COMMENT ON COLUMN public.trial_offer_versions.published_by IS
  'F63: autoria da publicação. ON DELETE SET NULL; o trigger aceita apenas a transição para NULL.';
COMMENT ON COLUMN public.trial_offer_versions.publication_reason IS
  'F63: motivo obrigatório (não vazio) para publicar; congelado após a publicação.';
COMMENT ON COLUMN public.trial_offer_versions.created_by IS
  'F63: autoria da criação. ON DELETE SET NULL; o trigger aceita apenas a transição para NULL.';
COMMENT ON COLUMN public.trial_offer_versions.created_at IS
  'F63: instante de criação; congelado após a publicação.';

-- =============================================================================
-- 2. Constraints de domínio nomeadas
-- =============================================================================

-- 2.1 Duração positiva.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tov_duration_days'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT chk_tov_duration_days CHECK (duration_days > 0);
  END IF;
END;
$$;

-- 2.2 Total de créditos positivo (total entregue, não teto tolerante).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tov_max_total_credits'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT chk_tov_max_total_credits CHECK (max_total_credits > 0);
  END IF;
END;
$$;

-- 2.3 Frequência restrita ao domínio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tov_release_frequency'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT chk_tov_release_frequency
      CHECK (release_frequency IN ('once', 'daily', 'weekly', 'monthly'));
  END IF;
END;
$$;

-- 2.4 Consistência frequência x créditos por liberação.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tov_credits_per_release'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT chk_tov_credits_per_release
      CHECK (
        (release_frequency = 'once' AND credits_per_release IS NULL)
        OR (
          release_frequency <> 'once'
          AND credits_per_release IS NOT NULL
          AND credits_per_release > 0
          AND credits_per_release <= max_total_credits
        )
      );
  END IF;
END;
$$;

-- 2.5 Rótulo da versão não pode ser vazio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tov_version_label_not_blank'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT chk_tov_version_label_not_blank
      CHECK (btrim(version_label) <> '');
  END IF;
END;
$$;

-- 2.6 Nome público não pode ser vazio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tov_public_name_not_blank'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT chk_tov_public_name_not_blank
      CHECK (btrim(public_name) <> '');
  END IF;
END;
$$;

-- =============================================================================
-- 3. Unicidades e chaves estrangeiras
-- =============================================================================

-- 3.1 Uma versão por (programa, rótulo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_tov_offer_key_version_label'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT uq_tov_offer_key_version_label UNIQUE (offer_key, version_label);
  END IF;
END;
$$;

-- 3.2 Alvo da FK composta de vigência (id, offer_key).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_tov_id_offer_key'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT uq_tov_id_offer_key UNIQUE (id, offer_key);
  END IF;
END;
$$;

-- 3.3 Programa existente em trial_offer_settings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_tov_offer_key'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT fk_tov_offer_key
      FOREIGN KEY (offer_key)
      REFERENCES public.trial_offer_settings (offer_key)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

-- 3.4 Autoria de criação: exclusão do usuário apenas anula o campo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_tov_created_by'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT fk_tov_created_by
      FOREIGN KEY (created_by)
      REFERENCES auth.users (id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- 3.5 Autoria de publicação: exclusão do usuário apenas anula o campo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_tov_published_by'
      AND conrelid = 'public.trial_offer_versions'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_versions
      ADD CONSTRAINT fk_tov_published_by
      FOREIGN KEY (published_by)
      REFERENCES auth.users (id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- =============================================================================
-- 4. Helper de validação do calendário
--    LANGUAGE sql IMMUTABLE SECURITY INVOKER com search_path vazio.
--    NÃO usar SECURITY DEFINER: o helper é puro e não lê tabelas.
--    Semântica: valida se o calendário alcança max_total_credits dentro de
--    duration_days para QUALQUER data de início. Para monthly, usa o intervalo
--    conservador de 31 dias entre liberações (limite superior real), nunca 30
--    dias fixos. Retorna false para argumentos nulos/fora do domínio,
--    duração <= 0 ou total <= 0.
--    O trigger de versão é SECURITY INVOKER e chama este helper; por isso o
--    EXECUTE é concedido apenas a service_role (ver seção 9).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trial_offer_calendar_reaches_total(
  p_release_frequency TEXT,
  p_credits_per_release INTEGER,
  p_max_total_credits INTEGER,
  p_duration_days INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_release_frequency IS NULL
      OR p_release_frequency NOT IN ('once', 'daily', 'weekly', 'monthly')
      OR p_max_total_credits IS NULL
      OR p_max_total_credits <= 0
      OR p_duration_days IS NULL
      OR p_duration_days <= 0
      THEN false
    WHEN p_release_frequency = 'once' THEN true
    WHEN p_credits_per_release IS NULL OR p_credits_per_release <= 0 THEN false
    ELSE (
      (
        (ceil(p_max_total_credits::numeric / p_credits_per_release)::integer - 1)
        * CASE p_release_frequency
            WHEN 'daily' THEN 1
            WHEN 'weekly' THEN 7
            ELSE 31
          END
      ) < p_duration_days
    )
  END;
$$;

COMMENT ON FUNCTION public.trial_offer_calendar_reaches_total(TEXT, INTEGER, INTEGER, INTEGER) IS
  'F63: valida se o calendário alcança max_total_credits dentro de duration_days para qualquer início. monthly usa 31 dias conservadores. IMMUTABLE SECURITY INVOKER com search_path vazio; EXECUTE apenas service_role.';

-- =============================================================================
-- 5. Trigger de publicação e imutabilidade da versão
--    - INSERT já publicado: exige motivo e calendário válido.
--    - INSERT rascunho: apenas retorna NEW.
--    - UPDATE: id/offer_key/version_label imutáveis inclusive em rascunho;
--      versão publicada congela condições, published_at e created_at;
--      autoria (created_by/published_by) só pode transitar para NULL;
--      rascunho -> publicado aplica as mesmas validações da inserção;
--      rascunho -> rascunho permite editar condições.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.publication_reason IS NULL OR btrim(NEW.publication_reason) = '' THEN
      RAISE EXCEPTION 'trial_offer_publication_reason_required';
    END IF;

    IF NOT public.trial_offer_calendar_reaches_total(
      NEW.release_frequency,
      NEW.credits_per_release,
      NEW.max_total_credits,
      NEW.duration_days
    ) THEN
      RAISE EXCEPTION 'trial_offer_publication_calendar_insufficient';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'trial_offer_version_id_immutable';
  END IF;

  IF NEW.offer_key IS DISTINCT FROM OLD.offer_key
     OR NEW.version_label IS DISTINCT FROM OLD.version_label THEN
    RAISE EXCEPTION 'trial_offer_version_identity_immutable';
  END IF;

  -- Autoria: apenas a ação referencial (valor -> NULL) é aceita.
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND NOT (OLD.created_by IS NOT NULL AND NEW.created_by IS NULL) THEN
    RAISE EXCEPTION 'trial_offer_version_author_immutable';
  END IF;

  IF NEW.published_by IS DISTINCT FROM OLD.published_by
     AND NOT (OLD.published_by IS NOT NULL AND NEW.published_by IS NULL) THEN
    RAISE EXCEPTION 'trial_offer_version_author_immutable';
  END IF;

  IF OLD.published_at IS NOT NULL THEN
    -- Versão publicada: nada de condições, publicação ou created_at muda.
    IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'trial_offer_version_published_immutable';
    END IF;

    IF NEW.public_name IS DISTINCT FROM OLD.public_name
       OR NEW.duration_days IS DISTINCT FROM OLD.duration_days
       OR NEW.max_total_credits IS DISTINCT FROM OLD.max_total_credits
       OR NEW.release_frequency IS DISTINCT FROM OLD.release_frequency
       OR NEW.credits_per_release IS DISTINCT FROM OLD.credits_per_release
       OR NEW.publication_reason IS DISTINCT FROM OLD.publication_reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'trial_offer_version_conditions_immutable';
    END IF;

    RETURN NEW;
  END IF;

  -- Rascunho: edição de condições permitida.
  IF NEW.published_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rascunho -> publicado: mesmas validações da inserção publicada.
  IF NEW.publication_reason IS NULL OR btrim(NEW.publication_reason) = '' THEN
    RAISE EXCEPTION 'trial_offer_publication_reason_required';
  END IF;

  IF NOT public.trial_offer_calendar_reaches_total(
    NEW.release_frequency,
    NEW.credits_per_release,
    NEW.max_total_credits,
    NEW.duration_days
  ) THEN
    RAISE EXCEPTION 'trial_offer_publication_calendar_insufficient';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trial_offer_versions_guard() IS
  'F63: valida publicação (motivo + calendário) e congela versões publicadas. Autoria só pode ir para NULL por ação referencial.';

-- =============================================================================
-- 6. Trigger de proteção contra exclusão de versão publicada
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'trial_offer_version_published_delete_forbidden';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.trial_offer_versions_guard_delete() IS
  'F63: rejeita DELETE de versão publicada; rascunho permanece excluível.';

DROP TRIGGER IF EXISTS trg_trial_offer_versions_guard
  ON public.trial_offer_versions;

CREATE TRIGGER trg_trial_offer_versions_guard
  BEFORE INSERT OR UPDATE ON public.trial_offer_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_versions_guard();

DROP TRIGGER IF EXISTS trg_trial_offer_versions_guard_delete
  ON public.trial_offer_versions;

CREATE TRIGGER trg_trial_offer_versions_guard_delete
  BEFORE DELETE ON public.trial_offer_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_versions_guard_delete();

-- =============================================================================
-- 7. Vigência: current_version_id (nullable APENAS nesta migration), FK
--    composta (mesmo programa) e trigger (versão publicada).
--    Não tocar enabled, launch_at, individual_launch_at, updated_by/updated_at.
-- =============================================================================
ALTER TABLE public.trial_offer_settings
  ADD COLUMN IF NOT EXISTS current_version_id UUID;

COMMENT ON COLUMN public.trial_offer_settings.current_version_id IS
  'F63: referência à versão vigente publicada do mesmo programa. Nullable apenas durante a Migration A; a Migration B atribui a v1 e torna a coluna NOT NULL.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_trial_offer_settings_current_version'
      AND conrelid = 'public.trial_offer_settings'::regclass
  ) THEN
    ALTER TABLE public.trial_offer_settings
      ADD CONSTRAINT fk_trial_offer_settings_current_version
      FOREIGN KEY (current_version_id, offer_key)
      REFERENCES public.trial_offer_versions (id, offer_key)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trial_offer_settings_guard_current_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_published_at TIMESTAMPTZ;
BEGIN
  IF NEW.current_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.published_at
  INTO v_published_at
  FROM public.trial_offer_versions v
  WHERE v.id = NEW.current_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trial_offer_current_version_not_found';
  END IF;

  IF v_published_at IS NULL THEN
    RAISE EXCEPTION 'trial_offer_current_version_not_published';
  END IF;

  -- offer_key NÃO é comparado aqui: a FK composta (current_version_id, offer_key)
  -- é quem garante o mesmo programa e produz 23503 quando divergir.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trial_offer_settings_guard_current_version() IS
  'F63: garante que current_version_id aponte para versão existente e publicada. O mesmo programa é garantido pela FK composta.';

DROP TRIGGER IF EXISTS trg_trial_offer_settings_guard_current_version
  ON public.trial_offer_settings;

CREATE TRIGGER trg_trial_offer_settings_guard_current_version
  BEFORE INSERT OR UPDATE ON public.trial_offer_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_settings_guard_current_version();

-- =============================================================================
-- 8. Contratos de leitura (STABLE SECURITY DEFINER, search_path vazio)
-- =============================================================================

-- 8.1 Condições: sem id resolve a vigente; com id lê uma versão publicada.
--     Falha fechada quando não há vigente/versão publicada.
CREATE OR REPLACE FUNCTION public.trial_offer_conditions(
  p_version_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF p_version_id IS NULL THEN
    SELECT v.*
    INTO v_row
    FROM public.trial_offer_settings s
    JOIN public.trial_offer_versions v
      ON v.id = s.current_version_id
     AND v.offer_key = s.offer_key
    WHERE s.offer_key = 'trial_28d_v1';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'trial_offer_current_version_missing';
    END IF;

    IF v_row.published_at IS NULL THEN
      RAISE EXCEPTION 'trial_offer_current_version_not_published';
    END IF;
  ELSE
    SELECT v.*
    INTO v_row
    FROM public.trial_offer_versions v
    WHERE v.id = p_version_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'trial_offer_version_not_found';
    END IF;

    IF v_row.published_at IS NULL THEN
      RAISE EXCEPTION 'trial_offer_version_not_published';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'offer_key', v_row.offer_key,
    'version_id', v_row.id,
    'version_label', v_row.version_label,
    'public_name', v_row.public_name,
    'duration_days', v_row.duration_days,
    'max_total_credits', v_row.max_total_credits,
    'release_frequency', v_row.release_frequency,
    'credits_per_release', v_row.credits_per_release,
    'published_at', v_row.published_at
  );
END;
$$;

COMMENT ON FUNCTION public.trial_offer_conditions(UUID) IS
  'F63: condições da versão vigente (p_version_id NULL) ou de uma versão publicada específica. Falha fechada.';

-- 8.2 Projeção pública da vigente: seis campos, sem id/offer_key/auditoria/
--     dados de concessão nem contagem de liberações. Independe de enabled.
CREATE OR REPLACE FUNCTION public.trial_offer_public_offer()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT v.version_label,
         v.public_name,
         v.duration_days,
         v.max_total_credits,
         v.release_frequency,
         v.credits_per_release,
         v.published_at
  INTO v_row
  FROM public.trial_offer_settings s
  JOIN public.trial_offer_versions v
    ON v.id = s.current_version_id
   AND v.offer_key = s.offer_key
  WHERE s.offer_key = 'trial_28d_v1';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trial_offer_current_version_missing';
  END IF;

  IF v_row.published_at IS NULL THEN
    RAISE EXCEPTION 'trial_offer_current_version_not_published';
  END IF;

  RETURN jsonb_build_object(
    'version_label', v_row.version_label,
    'public_name', v_row.public_name,
    'duration_days', v_row.duration_days,
    'max_total_credits', v_row.max_total_credits,
    'release_frequency', v_row.release_frequency,
    'credits_per_release', v_row.credits_per_release
  );
END;
$$;

COMMENT ON FUNCTION public.trial_offer_public_offer() IS
  'F63: projeção pública da versão vigente publicada. Sem UUIDs, offer_key, auditoria, dados pessoais ou contagem efetiva de liberações.';

-- 8.3 Calendário derivado (leitura pura). TimeZone fixado na própria função.
--     A primeira liberação ocorre em started_at; as seguintes seguem
--     dia/semana/mês de calendário; o total é sempre max_total_credits.
--     A spec diz que uma liberação no instante de vencimento "não é incluída".
--     Como toda versão publicada é validada para nunca alcançar esse instante,
--     o ramo trial_offer_schedule_exceeds_window é fail-closed DEFENSIVO e
--     inalcançável para dados válidos; nunca truncar o calendário.
CREATE OR REPLACE FUNCTION public.trial_offer_release_schedule(
  p_version_id UUID,
  p_started_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET TimeZone = 'UTC'
AS $$
DECLARE
  v_version RECORD;
  v_expires_at TIMESTAMPTZ;
  v_releases JSONB := '[]'::jsonb;
  v_total INTEGER := 0;
  v_seq INTEGER := 0;
  v_due_at TIMESTAMPTZ;
  v_amount INTEGER;
  v_remaining INTEGER;
BEGIN
  IF p_version_id IS NULL THEN
    RAISE EXCEPTION 'trial_offer_schedule_missing_version';
  END IF;

  IF p_started_at IS NULL THEN
    RAISE EXCEPTION 'trial_offer_schedule_missing_started_at';
  END IF;

  SELECT *
  INTO v_version
  FROM public.trial_offer_versions
  WHERE id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trial_offer_version_not_found';
  END IF;

  IF v_version.published_at IS NULL THEN
    RAISE EXCEPTION 'trial_offer_version_not_published';
  END IF;

  v_expires_at := p_started_at + make_interval(days => v_version.duration_days);

  IF v_version.release_frequency = 'once' THEN
    RETURN jsonb_build_object(
      'expires_at', v_expires_at,
      'releases', jsonb_build_array(
        jsonb_build_object(
          'seq', 0,
          'due_at', p_started_at,
          'amount', v_version.max_total_credits
        )
      ),
      'total', v_version.max_total_credits
    );
  END IF;

  v_remaining := v_version.max_total_credits;

  WHILE v_remaining > 0 LOOP
    v_amount := LEAST(v_version.credits_per_release, v_remaining);

    CASE v_version.release_frequency
      WHEN 'daily' THEN
        v_due_at := p_started_at + make_interval(days => v_seq);
      WHEN 'weekly' THEN
        v_due_at := p_started_at + make_interval(days => 7 * v_seq);
      WHEN 'monthly' THEN
        v_due_at := p_started_at + make_interval(months => v_seq);
      ELSE
        RAISE EXCEPTION 'trial_offer_schedule_invalid_frequency';
    END CASE;

    IF v_due_at >= v_expires_at THEN
      RAISE EXCEPTION 'trial_offer_schedule_exceeds_window';
    END IF;

    v_releases := v_releases || jsonb_build_array(
      jsonb_build_object(
        'seq', v_seq,
        'due_at', v_due_at,
        'amount', v_amount
      )
    );

    v_total := v_total + v_amount;
    v_remaining := v_remaining - v_amount;
    v_seq := v_seq + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'expires_at', v_expires_at,
    'releases', v_releases,
    'total', v_total
  );
END;
$$;

COMMENT ON FUNCTION public.trial_offer_release_schedule(UUID, TIMESTAMPTZ) IS
  'F63: calendário derivado de uma versão publicada. Leitura pura, sem reserva/escrita. TimeZone=UTC fixo na definição.';

-- =============================================================================
-- 9. RLS e grants: acesso restrito a service_role; sem leitura pública direta.
-- =============================================================================
ALTER TABLE public.trial_offer_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trial_offer_versions
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trial_offer_versions
  TO service_role;

DROP POLICY IF EXISTS trial_offer_versions_service_role_all
  ON public.trial_offer_versions;

CREATE POLICY trial_offer_versions_service_role_all
  ON public.trial_offer_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper (SECURITY INVOKER): EXECUTE apenas service_role.
REVOKE ALL ON FUNCTION public.trial_offer_calendar_reaches_total(TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_calendar_reaches_total(TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;

-- Trigger de versão.
REVOKE ALL ON FUNCTION public.trial_offer_versions_guard()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_versions_guard()
  TO service_role;

-- Trigger de exclusão.
REVOKE ALL ON FUNCTION public.trial_offer_versions_guard_delete()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_versions_guard_delete()
  TO service_role;

-- Trigger de vigência.
REVOKE ALL ON FUNCTION public.trial_offer_settings_guard_current_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_settings_guard_current_version()
  TO service_role;

-- Três leituras (SECURITY DEFINER): EXECUTE apenas service_role.
REVOKE ALL ON FUNCTION public.trial_offer_conditions(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_conditions(UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_public_offer()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_public_offer()
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_release_schedule(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_release_schedule(UUID, TIMESTAMPTZ)
  TO service_role;

-- =============================================================================
-- 10. REVERT (comentado) — ordem segura, NÃO executar automaticamente.
--     Só é seguro antes de dados futuros referenciarem versões publicadas.
--     Depois disso, a correção é publicar nova versão e repontar a vigência.
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_trial_offer_settings_guard_current_version
--   ON public.trial_offer_settings;
-- DROP TRIGGER IF EXISTS trg_trial_offer_versions_guard
--   ON public.trial_offer_versions;
-- DROP TRIGGER IF EXISTS trg_trial_offer_versions_guard_delete
--   ON public.trial_offer_versions;
-- REVOKE EXECUTE ON FUNCTION public.trial_offer_release_schedule(UUID, TIMESTAMPTZ) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.trial_offer_public_offer() FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.trial_offer_conditions(UUID) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.trial_offer_settings_guard_current_version() FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.trial_offer_versions_guard_delete() FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.trial_offer_versions_guard() FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.trial_offer_calendar_reaches_total(TEXT, INTEGER, INTEGER, INTEGER) FROM service_role;
-- DROP FUNCTION IF EXISTS public.trial_offer_release_schedule(UUID, TIMESTAMPTZ);
-- DROP FUNCTION IF EXISTS public.trial_offer_public_offer();
-- DROP FUNCTION IF EXISTS public.trial_offer_conditions(UUID);
-- DROP FUNCTION IF EXISTS public.trial_offer_settings_guard_current_version();
-- DROP FUNCTION IF EXISTS public.trial_offer_versions_guard_delete();
-- DROP FUNCTION IF EXISTS public.trial_offer_versions_guard();
-- ALTER TABLE public.trial_offer_settings
--   DROP CONSTRAINT IF EXISTS fk_trial_offer_settings_current_version;
-- ALTER TABLE public.trial_offer_settings
--   DROP COLUMN IF EXISTS current_version_id;
-- DROP POLICY IF EXISTS trial_offer_versions_service_role_all
--   ON public.trial_offer_versions;
-- DROP TABLE IF EXISTS public.trial_offer_versions;
-- DROP FUNCTION IF EXISTS public.trial_offer_calendar_reaches_total(TEXT, INTEGER, INTEGER, INTEGER);
-- =============================================================================
