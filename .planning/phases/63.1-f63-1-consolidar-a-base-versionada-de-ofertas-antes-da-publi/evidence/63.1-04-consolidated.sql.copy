-- =============================================================================
-- F63.1 — Instalação consolidada da base versionada de ofertas (F63/2A)
--
-- Arquivo único que instala o estado final corrigido, partindo da base anterior
-- à F63, sem depender de A/B/C/D e sem reproduzir estados defeituosos.
--
-- Escopo:
--   1. Precondições fail-closed para impedir dupla aplicação ou estado parcial.
--   2. public.trial_offer_versions, comentários, checks, unicidades e FKs.
--   3. Helper de validação do calendário.
--   4. Guard final de publicação/imutabilidade, com o comentário final da D.
--   5. Guard de exclusão e triggers da versão.
--   6. current_version_id, FK composta e trigger de vigência.
--   7. Contratos de leitura: conditions, public_offer e release_schedule.
--   8. Seed da v1 publicada/vigente, calendário fail-closed e NOT NULL.
--   9. RLS e grants restritos a service_role.
--  10. REVERT comentado, sem execução automática.
--
-- Alvo de autoria: homolog local exclusivo (supabase_db_vendeo-homolog,
-- 127.0.0.1:57782/postgres). NENHUMA aplicação em produção ou banco remoto.
--
-- Esta migration NÃO altera:
--   - trial_offer_enrollments, credit_balances, credit_transactions ou
--     freemium_entitlements;
--   - RPCs existentes, consumidores, Admin, flags, copy ou regras comerciais;
--   - o ledger diretamente (o wrapper transacional do aplicador insere a linha).
--
-- Ordem de aplicação: uma transação, com a linha do ledger inserida pelo
-- aplicador na MESMA transação. Em falha, rollback integral.
-- =============================================================================

-- =============================================================================
-- 1. Precondições fail-closed
-- =============================================================================
DO $$
DECLARE
  v_settings_count integer;
BEGIN
  IF to_regclass('public.trial_offer_versions') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: public.trial_offer_versions já existe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trial_offer_settings'
      AND column_name = 'current_version_id'
  ) THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: trial_offer_settings.current_version_id já existe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_trial_offer_settings_current_version'
      AND conrelid = 'public.trial_offer_settings'::regclass
  ) THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: fk_trial_offer_settings_current_version já existe';
  END IF;

  IF to_regprocedure('public.trial_offer_calendar_reaches_total(text,integer,integer,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: helper já existe';
  END IF;
  IF to_regprocedure('public.trial_offer_versions_guard()') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: versions_guard já existe';
  END IF;
  IF to_regprocedure('public.trial_offer_versions_guard_delete()') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: versions_guard_delete já existe';
  END IF;
  IF to_regprocedure('public.trial_offer_settings_guard_current_version()') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: settings_guard_current_version já existe';
  END IF;
  IF to_regprocedure('public.trial_offer_conditions(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: conditions já existe';
  END IF;
  IF to_regprocedure('public.trial_offer_public_offer()') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: public_offer já existe';
  END IF;
  IF to_regprocedure('public.trial_offer_release_schedule(uuid,timestamp with time zone)') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: release_schedule já existe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN (
        'trg_trial_offer_versions_guard',
        'trg_trial_offer_versions_guard_delete',
        'trg_trial_offer_settings_guard_current_version'
      )
  ) THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: trigger da F63 já existe';
  END IF;

  SELECT count(*) INTO v_settings_count
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1';

  IF v_settings_count <> 1 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PRECONDITION_FAILED: singleton trial_28d_v1 inválido (%)', v_settings_count;
  END IF;
END;
$$;

-- =============================================================================
-- 2. Tabela do catálogo versionado
-- =============================================================================
CREATE TABLE public.trial_offer_versions (
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
  'F63: autoria da publicação. ON DELETE SET NULL. NULL em rascunho; a primeira publicação aceita NULL ou UUID; depois de publicada, a autoria só pode transitar UUID -> NULL, inclusive por UPDATE direto ou ação referencial.';
COMMENT ON COLUMN public.trial_offer_versions.publication_reason IS
  'F63: motivo obrigatório (não vazio) para publicar; congelado após a publicação.';
COMMENT ON COLUMN public.trial_offer_versions.created_by IS
  'F63: autoria da criação. ON DELETE SET NULL; o trigger aceita apenas a transição para NULL.';
COMMENT ON COLUMN public.trial_offer_versions.created_at IS
  'F63: instante de criação; congelado após a publicação.';

ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT chk_tov_duration_days CHECK (duration_days > 0);
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT chk_tov_max_total_credits CHECK (max_total_credits > 0);
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT chk_tov_release_frequency
  CHECK (release_frequency IN ('once', 'daily', 'weekly', 'monthly'));
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
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT chk_tov_version_label_not_blank CHECK (btrim(version_label) <> '');
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT chk_tov_public_name_not_blank CHECK (btrim(public_name) <> '');
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT uq_tov_offer_key_version_label UNIQUE (offer_key, version_label);
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT uq_tov_id_offer_key UNIQUE (id, offer_key);
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT fk_tov_offer_key
  FOREIGN KEY (offer_key) REFERENCES public.trial_offer_settings (offer_key)
  ON DELETE RESTRICT;
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT fk_tov_created_by
  FOREIGN KEY (created_by) REFERENCES auth.users (id)
  ON DELETE SET NULL;
ALTER TABLE public.trial_offer_versions
  ADD CONSTRAINT fk_tov_published_by
  FOREIGN KEY (published_by) REFERENCES auth.users (id)
  ON DELETE SET NULL;

-- =============================================================================
-- 3. Helper de validação do calendário
-- =============================================================================
CREATE FUNCTION public.trial_offer_calendar_reaches_total(
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
-- 4. Guard final de publicação e imutabilidade (correção da Migration C)
--    O comentário é o texto final da Migration D.
-- =============================================================================
CREATE FUNCTION public.trial_offer_versions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NULL THEN
      IF NEW.published_by IS NOT NULL THEN
        RAISE EXCEPTION 'trial_offer_publisher_requires_publication';
      END IF;
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

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'trial_offer_version_id_immutable';
  END IF;

  IF NEW.offer_key IS DISTINCT FROM OLD.offer_key
     OR NEW.version_label IS DISTINCT FROM OLD.version_label THEN
    RAISE EXCEPTION 'trial_offer_version_identity_immutable';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND NOT (OLD.created_by IS NOT NULL AND NEW.created_by IS NULL) THEN
    RAISE EXCEPTION 'trial_offer_version_author_immutable';
  END IF;

  IF OLD.published_at IS NOT NULL THEN
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

    IF NEW.published_by IS DISTINCT FROM OLD.published_by
       AND NOT (OLD.published_by IS NOT NULL AND NEW.published_by IS NULL) THEN
      RAISE EXCEPTION 'trial_offer_version_author_immutable';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.published_at IS NULL THEN
    IF NEW.published_by IS NOT NULL
       OR NEW.published_by IS DISTINCT FROM OLD.published_by THEN
      RAISE EXCEPTION 'trial_offer_publisher_requires_publication';
    END IF;
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
END;
$$;

COMMENT ON FUNCTION public.trial_offer_versions_guard() IS
  'F63: guard da versão de oferta. Rascunho (published_at NULL) não admite published_by. Primeira publicação: published_by pode permanecer NULL ou transitar NULL -> UUID, com motivo e calendário válidos. Versão publicada: condições, published_at, created_at e identidade ficam congeladas. Autoria (created_by/published_by) depois disso só pode transitar valor -> NULL; o guard permite essa transição também em UPDATE direto e não distingue a origem referencial.';

-- =============================================================================
-- 5. Guard de exclusão e triggers da versão
-- =============================================================================
CREATE FUNCTION public.trial_offer_versions_guard_delete()
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

CREATE TRIGGER trg_trial_offer_versions_guard
  BEFORE INSERT OR UPDATE ON public.trial_offer_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_versions_guard();

CREATE TRIGGER trg_trial_offer_versions_guard_delete
  BEFORE DELETE ON public.trial_offer_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_versions_guard_delete();

-- =============================================================================
-- 6. Vigência: coluna, comentário, FK composta e trigger
-- =============================================================================
ALTER TABLE public.trial_offer_settings
  ADD COLUMN current_version_id UUID;

COMMENT ON COLUMN public.trial_offer_settings.current_version_id IS
  'F63: referência à versão vigente publicada do mesmo programa. Nullable apenas durante a instalação; o seed atribui a v1 e aplica NOT NULL.';

CREATE FUNCTION public.trial_offer_settings_guard_current_version()
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

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trial_offer_settings_guard_current_version() IS
  'F63: garante que current_version_id aponte para versão existente e publicada. O mesmo programa é garantido pela FK composta.';

ALTER TABLE public.trial_offer_settings
  ADD CONSTRAINT fk_trial_offer_settings_current_version
  FOREIGN KEY (current_version_id, offer_key)
  REFERENCES public.trial_offer_versions (id, offer_key)
  ON DELETE RESTRICT;

CREATE TRIGGER trg_trial_offer_settings_guard_current_version
  BEFORE INSERT OR UPDATE ON public.trial_offer_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_settings_guard_current_version();

-- =============================================================================
-- 7. Contratos de leitura
-- =============================================================================
CREATE FUNCTION public.trial_offer_conditions(
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

CREATE FUNCTION public.trial_offer_public_offer()
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

CREATE FUNCTION public.trial_offer_release_schedule(
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
-- 8. Seed da v1, calendário, vigência, validações e NOT NULL
--    As três funções de leitura já existem neste ponto.
-- =============================================================================
DO $$
DECLARE
  v_settings_before RECORD;
  v_settings_after RECORD;
  v_updated integer;
  v_nulls integer;
  v_id uuid;
  v_row public.trial_offer_versions%ROWTYPE;
  v_sched jsonb;
  v_releases jsonb;
  v_started_at timestamptz := timestamptz '2026-01-05 12:00:00+00';
  v_expected_expires timestamptz;
  v_rel jsonb;
  v_sum integer := 0;
  v_i integer;
  v_cond jsonb;
  v_pub jsonb;
  v_keys text[];
  v_forbidden text[] := ARRAY[
    'id', 'offer_key', 'version_id', 'published_by', 'created_by',
    'publication_reason', 'release_count', 'releases'
  ];
BEGIN
  SELECT id, offer_key, enabled, launch_at, individual_launch_at,
         updated_by, updated_at, created_at
    INTO v_settings_before
    FROM public.trial_offer_settings
   WHERE offer_key = 'trial_28d_v1'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_SEED_MISSING_SETTINGS';
  END IF;

  SELECT *
    INTO v_row
    FROM public.trial_offer_versions
   WHERE offer_key = 'trial_28d_v1'
     AND version_label = 'v1';

  IF FOUND THEN
    IF v_row.public_name IS DISTINCT FROM 'Teste gratuito de 28 dias'
       OR v_row.duration_days IS DISTINCT FROM 28
       OR v_row.max_total_credits IS DISTINCT FROM 20
       OR v_row.release_frequency IS DISTINCT FROM 'weekly'
       OR v_row.credits_per_release IS DISTINCT FROM 5
       OR v_row.published_at IS NULL THEN
      RAISE EXCEPTION 'F63_CONSOLIDATED_SEED_CONFLICT';
    END IF;
    v_id := v_row.id;
  ELSE
    INSERT INTO public.trial_offer_versions (
      offer_key, version_label, public_name, duration_days, max_total_credits,
      release_frequency, credits_per_release, published_at, publication_reason
    ) VALUES (
      'trial_28d_v1', 'v1', 'Teste gratuito de 28 dias', 28, 20,
      'weekly', 5, now(), 'publicação inicial da oferta vigente'
    )
    RETURNING id INTO v_id;
  END IF;

  v_sched := public.trial_offer_release_schedule(v_id, v_started_at);
  v_releases := v_sched -> 'releases';
  v_expected_expires := v_started_at + make_interval(days => 28);

  IF (v_sched ->> 'total')::integer IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CALENDAR_TOTAL';
  END IF;
  IF jsonb_array_length(v_releases) IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CALENDAR_COUNT';
  END IF;
  IF (v_sched ->> 'expires_at')::timestamptz IS DISTINCT FROM v_expected_expires THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CALENDAR_EXPIRES';
  END IF;

  FOR v_i IN 0..3 LOOP
    v_rel := v_releases -> v_i;
    IF (v_rel ->> 'seq')::integer IS DISTINCT FROM v_i THEN
      RAISE EXCEPTION 'F63_CONSOLIDATED_CALENDAR_SEQ';
    END IF;
    IF (v_rel ->> 'amount')::integer IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'F63_CONSOLIDATED_CALENDAR_AMOUNT';
    END IF;
    IF (v_rel ->> 'due_at')::timestamptz IS DISTINCT FROM (v_started_at + make_interval(days => 7 * v_i)) THEN
      RAISE EXCEPTION 'F63_CONSOLIDATED_CALENDAR_DUE';
    END IF;
    IF (v_rel ->> 'due_at')::timestamptz >= v_expected_expires THEN
      RAISE EXCEPTION 'F63_CONSOLIDATED_CALENDAR_WINDOW';
    END IF;
    v_sum := v_sum + (v_rel ->> 'amount')::integer;
  END LOOP;

  IF v_sum IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CALENDAR_SUM';
  END IF;

  UPDATE public.trial_offer_settings
     SET current_version_id = v_id
   WHERE offer_key = 'trial_28d_v1';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_SETTINGS_UPDATE_FAILED';
  END IF;

  SELECT id, offer_key, enabled, launch_at, individual_launch_at,
         updated_by, updated_at, created_at
    INTO v_settings_after
    FROM public.trial_offer_settings
   WHERE offer_key = 'trial_28d_v1';

  IF v_settings_after.id IS DISTINCT FROM v_settings_before.id
     OR v_settings_after.offer_key IS DISTINCT FROM v_settings_before.offer_key
     OR v_settings_after.enabled IS DISTINCT FROM v_settings_before.enabled
     OR v_settings_after.launch_at IS DISTINCT FROM v_settings_before.launch_at
     OR v_settings_after.individual_launch_at IS DISTINCT FROM v_settings_before.individual_launch_at
     OR v_settings_after.updated_by IS DISTINCT FROM v_settings_before.updated_by
     OR v_settings_after.updated_at IS DISTINCT FROM v_settings_before.updated_at
     OR v_settings_after.created_at IS DISTINCT FROM v_settings_before.created_at THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_SETTINGS_GUARD_CHANGED';
  END IF;

  v_cond := public.trial_offer_conditions(NULL);
  IF jsonb_typeof(v_cond) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(v_cond)) <> 9 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CONDITIONS_SHAPE';
  END IF;
  IF v_cond ->> 'offer_key' IS DISTINCT FROM 'trial_28d_v1'
     OR (v_cond ->> 'version_id')::uuid IS DISTINCT FROM v_id
     OR v_cond ->> 'version_label' IS DISTINCT FROM 'v1'
     OR v_cond ->> 'public_name' IS DISTINCT FROM 'Teste gratuito de 28 dias'
     OR (v_cond ->> 'duration_days')::integer IS DISTINCT FROM 28
     OR (v_cond ->> 'max_total_credits')::integer IS DISTINCT FROM 20
     OR v_cond ->> 'release_frequency' IS DISTINCT FROM 'weekly'
     OR (v_cond ->> 'credits_per_release')::integer IS DISTINCT FROM 5
     OR (v_cond ->> 'published_at') IS NULL THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CONDITIONS_VALUES';
  END IF;

  -- trial_offer_conditions(v1) — leitura da versão semeada.
  v_cond := public.trial_offer_conditions(v_id);
  IF jsonb_typeof(v_cond) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(v_cond)) <> 9 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CONDITIONS_SHAPE_VERSION';
  END IF;
  IF (v_cond ->> 'version_id')::uuid IS DISTINCT FROM v_id
     OR v_cond ->> 'version_label' IS DISTINCT FROM 'v1'
     OR (v_cond ->> 'max_total_credits')::integer IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CONDITIONS_VALUES_VERSION';
  END IF;

  v_pub := public.trial_offer_public_offer();
  IF jsonb_typeof(v_pub) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(v_pub)) <> 6 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PUBLIC_OFFER_SHAPE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(v_pub) AS k WHERE k = ANY (v_forbidden)
  ) THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PUBLIC_OFFER_FORBIDDEN_KEY';
  END IF;
  v_keys := ARRAY(SELECT jsonb_object_keys(v_pub) ORDER BY 1);
  IF v_keys IS DISTINCT FROM ARRAY[
    'credits_per_release', 'duration_days', 'max_total_credits',
    'public_name', 'release_frequency', 'version_label'
  ] THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_PUBLIC_OFFER_KEYS';
  END IF;

  SELECT count(*) INTO v_nulls
    FROM public.trial_offer_settings
   WHERE current_version_id IS NULL;
  IF v_nulls <> 0 THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CURRENT_VERSION_NULL_ROWS: %', v_nulls;
  END IF;
END;
$$;

ALTER TABLE public.trial_offer_settings
  ALTER COLUMN current_version_id SET NOT NULL;

DO $$
DECLARE
  v_not_null boolean;
BEGIN
  SELECT attnotnull INTO v_not_null
    FROM pg_attribute
   WHERE attrelid = 'public.trial_offer_settings'::regclass
     AND attname = 'current_version_id'
     AND NOT attisdropped;

  IF v_not_null IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'F63_CONSOLIDATED_CURRENT_VERSION_NOT_NULL_FAILED';
  END IF;
END;
$$;

-- =============================================================================
-- 9. RLS e grants restritos a service_role
-- =============================================================================
ALTER TABLE public.trial_offer_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trial_offer_versions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trial_offer_versions
  TO service_role;

CREATE POLICY trial_offer_versions_service_role_all
  ON public.trial_offer_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON FUNCTION public.trial_offer_calendar_reaches_total(TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_calendar_reaches_total(TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_versions_guard()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_versions_guard()
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_versions_guard_delete()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_versions_guard_delete()
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_settings_guard_current_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_settings_guard_current_version()
  TO service_role;

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
-- 10. REVERT (comentado) — NÃO executar automaticamente.
--     Ordem segura; só é seguro antes de dados futuros referenciarem a versão.
--     Depois disso, a correção é publicar nova versão e repontar a vigência.
-- =============================================================================
-- REVERT
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
