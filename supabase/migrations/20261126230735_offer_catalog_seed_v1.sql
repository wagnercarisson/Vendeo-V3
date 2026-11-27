-- =============================================================================
-- F63 — Base versionada de ofertas (subfatia 2A)
-- Migration B — seed da versão inicial v1, vigência e NOT NULL.
--
-- Escopo desta migration (e SOMENTE isto):
--   1. Snapshot temporário das quatro tabelas preservadas e da projeção dos oito
--      campos de trial_offer_settings, na mesma transação.
--   2. Seed verificar-ou-falhar da versão publicada v1 (trial_28d_v1 / v1).
--   3. Validação fail-closed do calendário derivado pela função real.
--   4. Atribuição de trial_offer_settings.current_version_id = v1.
--   5. ALTER TABLE ... SET NOT NULL em current_version_id.
--   6. Verificação dos contratos de leitura (conditions, public_offer).
--   7. Comparação de preservação na mesma transação (aborta em divergência).
--   8. Bloco REVERT comentado, sem auto-execução.
--
-- Alvo exclusivo: homolog local existente (container supabase_db_vendeo-homolog,
-- banco postgres, 127.0.0.1:57782). NENHUMA aplicação em produção ou banco
-- remoto. Nenhum reset de banco, criação de banco, push, link ou backup.
--
-- Esta migration NÃO altera:
--   - trial_offer_enrollments (sem offer_version_id, sem backfill);
--   - credit_balances / credit_transactions / freemium_entitlements;
--   - RPCs existentes, constantes, status, completion, copy, Admin ou flags;
--   - enabled, launch_at, individual_launch_at, updated_by ou updated_at da
--     linha singleton de trial_offer_settings.
--
-- Rollback: a migration roda dentro de UMA transação (wrapper do aplicador) e
-- insere a linha do ledger na MESMA transação. Em falha, o rollback é integral.
-- O rollback estrutural (bloco REVERT) só é seguro antes de existirem
-- referências futuras de concessões à versão publicada; depois disso, a
-- correção é publicar uma nova versão e repontar a vigência.
--
-- Nota de fingerprint: esta migration é a SEGUNDA linha nova no ledger do F63.
-- O F57.2 filtra nomes `f57_2_`; com +2 linhas nesta etapa (e +3 depois da
-- Migration C), o fingerprint armazenado do F57.2 passa a divergir. O F57.2
-- NÃO é reexecutado após o F63; o re-baseline está explicitamente FORA de
-- escopo.
-- =============================================================================

SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle TO 'ISO, YMD';

-- =============================================================================
-- 1. Snapshot de preservação (mesma transação)
--    Checksum calculado EXATAMENTE como no baseline do 63-01:
--    count(*)::bigint + md5(string_agg(t::text, E'\n' order by <chave>)).
-- =============================================================================
DROP TABLE IF EXISTS pg_temp.f63_preserved_baseline;
CREATE TEMP TABLE f63_preserved_baseline AS
SELECT 'trial_offer_enrollments'::text AS table_name,
       count(*)::bigint AS row_count,
       md5(coalesce(string_agg(t::text, E'\n' order by t.id), '')) AS row_checksum_md5
FROM public.trial_offer_enrollments t
UNION ALL
SELECT 'credit_balances'::text,
       count(*)::bigint,
       md5(coalesce(string_agg(t::text, E'\n' order by t.store_id), ''))
FROM public.credit_balances t
UNION ALL
SELECT 'credit_transactions'::text,
       count(*)::bigint,
       md5(coalesce(string_agg(t::text, E'\n' order by t.id), ''))
FROM public.credit_transactions t
UNION ALL
SELECT 'freemium_entitlements'::text,
       count(*)::bigint,
       md5(coalesce(string_agg(t::text, E'\n' order by t.id), ''))
FROM public.freemium_entitlements t;

-- Projeção dos OITO campos pré-existentes de trial_offer_settings.
-- current_version_id NÃO entra nesta guarda: é o campo esperado da migration.
DROP TABLE IF EXISTS pg_temp.f63_settings_guard_baseline;
CREATE TEMP TABLE f63_settings_guard_baseline AS
SELECT id,
       offer_key,
       enabled,
       launch_at,
       individual_launch_at,
       updated_by,
       updated_at,
       created_at
FROM public.trial_offer_settings
WHERE offer_key = 'trial_28d_v1';

DO $$
DECLARE
  v_rows integer;
BEGIN
  SELECT count(*) INTO v_rows FROM f63_settings_guard_baseline;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'F63_SETTINGS_SINGLETON_MISSING: % linhas', v_rows;
  END IF;
END
$$;

-- =============================================================================
-- 2. Seed verificar-ou-falhar da versão v1 (sem ON CONFLICT DO UPDATE).
-- =============================================================================
DO $$
DECLARE
  v_row public.trial_offer_versions%ROWTYPE;
BEGIN
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
      RAISE EXCEPTION 'F63_SEED_CONFLICT';
    END IF;
  ELSE
    INSERT INTO public.trial_offer_versions (
      offer_key,
      version_label,
      public_name,
      duration_days,
      max_total_credits,
      release_frequency,
      credits_per_release,
      published_at,
      publication_reason
    ) VALUES (
      'trial_28d_v1',
      'v1',
      'Teste gratuito de 28 dias',
      28,
      20,
      'weekly',
      5,
      now(),
      'publicação inicial da oferta vigente'
    );
  END IF;
END
$$;

-- =============================================================================
-- 3. Calendário fail-closed pela função real.
--    28 dias / 20 créditos / semanal / 5 por liberação => 4 liberações de 5
--    nos dias 0, 7, 14 e 21, total 20, vencimento em started_at + 28 dias.
-- =============================================================================
DO $$
DECLARE
  v_id uuid;
  v_sched jsonb;
  v_releases jsonb;
  v_started_at timestamptz := timestamptz '2026-01-05 12:00:00+00';
  v_expected_expires timestamptz;
  v_rel jsonb;
  v_sum integer := 0;
  v_i integer;
BEGIN
  SELECT id
  INTO v_id
  FROM public.trial_offer_versions
  WHERE offer_key = 'trial_28d_v1'
    AND version_label = 'v1';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'F63_SEED_MISSING';
  END IF;

  v_sched := public.trial_offer_release_schedule(v_id, v_started_at);
  v_releases := v_sched -> 'releases';
  v_expected_expires := v_started_at + make_interval(days => 28);

  IF (v_sched ->> 'total')::integer IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'F63_SEED_CALENDAR_MISMATCH: total=%', v_sched ->> 'total';
  END IF;

  IF jsonb_array_length(v_releases) IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'F63_SEED_CALENDAR_MISMATCH: release_count=%', jsonb_array_length(v_releases);
  END IF;

  IF (v_sched ->> 'expires_at')::timestamptz IS DISTINCT FROM v_expected_expires THEN
    RAISE EXCEPTION 'F63_SEED_CALENDAR_MISMATCH: expires_at=%', v_sched ->> 'expires_at';
  END IF;

  FOR v_i IN 0..3 LOOP
    v_rel := v_releases -> v_i;

    IF (v_rel ->> 'seq')::integer IS DISTINCT FROM v_i THEN
      RAISE EXCEPTION 'F63_SEED_CALENDAR_MISMATCH: seq=%', v_i;
    END IF;

    IF (v_rel ->> 'amount')::integer IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'F63_SEED_CALENDAR_MISMATCH: seq=% amount=%', v_i, v_rel ->> 'amount';
    END IF;

    IF (v_rel ->> 'due_at')::timestamptz IS DISTINCT FROM (v_started_at + make_interval(days => 7 * v_i)) THEN
      RAISE EXCEPTION 'F63_SEED_CALENDAR_MISMATCH: seq=% due_at=%', v_i, v_rel ->> 'due_at';
    END IF;

    IF (v_rel ->> 'due_at')::timestamptz >= v_expected_expires THEN
      RAISE EXCEPTION 'F63_SEED_CALENDAR_MISMATCH: seq=% at_or_after_expires', v_i;
    END IF;

    v_sum := v_sum + (v_rel ->> 'amount')::integer;
  END LOOP;

  IF v_sum IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'F63_SEED_CALENDAR_MISMATCH: sum=%', v_sum;
  END IF;
END
$$;

-- =============================================================================
-- 4. Vigência: current_version_id = v1, com guarda dos oito campos restantes.
-- =============================================================================
DO $$
DECLARE
  v_id uuid;
  v_updated integer;
  v_before RECORD;
  v_after RECORD;
BEGIN
  SELECT id
  INTO v_id
  FROM public.trial_offer_versions
  WHERE offer_key = 'trial_28d_v1'
    AND version_label = 'v1';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'F63_SEED_MISSING';
  END IF;

  UPDATE public.trial_offer_settings
  SET current_version_id = v_id
  WHERE offer_key = 'trial_28d_v1';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'F63_SETTINGS_UPDATE_FAILED: row_count=%', v_updated;
  END IF;

  SELECT id,
         offer_key,
         enabled,
         launch_at,
         individual_launch_at,
         updated_by,
         updated_at,
         created_at
  INTO v_before
  FROM f63_settings_guard_baseline;

  SELECT id,
         offer_key,
         enabled,
         launch_at,
         individual_launch_at,
         updated_by,
         updated_at,
         created_at
  INTO v_after
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1';

  IF v_after.id IS DISTINCT FROM v_before.id
     OR v_after.offer_key IS DISTINCT FROM v_before.offer_key
     OR v_after.enabled IS DISTINCT FROM v_before.enabled
     OR v_after.launch_at IS DISTINCT FROM v_before.launch_at
     OR v_after.individual_launch_at IS DISTINCT FROM v_before.individual_launch_at
     OR v_after.updated_by IS DISTINCT FROM v_before.updated_by
     OR v_after.updated_at IS DISTINCT FROM v_before.updated_at
     OR v_after.created_at IS DISTINCT FROM v_before.created_at THEN
    RAISE EXCEPTION 'F63_SETTINGS_GUARD_CHANGED';
  END IF;
END
$$;

-- =============================================================================
-- 5. NOT NULL em current_version_id, somente depois de garantir zero nulos.
-- =============================================================================
DO $$
DECLARE
  v_nulls integer;
BEGIN
  SELECT count(*)
  INTO v_nulls
  FROM public.trial_offer_settings
  WHERE current_version_id IS NULL;

  IF v_nulls <> 0 THEN
    RAISE EXCEPTION 'F63_CURRENT_VERSION_NULL_ROWS: % linhas sem vigência', v_nulls;
  END IF;
END
$$;

ALTER TABLE public.trial_offer_settings
  ALTER COLUMN current_version_id SET NOT NULL;

DO $$
DECLARE
  v_not_null boolean;
BEGIN
  SELECT attnotnull
  INTO v_not_null
  FROM pg_attribute
  WHERE attrelid = 'public.trial_offer_settings'::regclass
    AND attname = 'current_version_id'
    AND NOT attisdropped;

  IF v_not_null IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'F63_CURRENT_VERSION_NOT_NULL_FAILED';
  END IF;
END
$$;

-- =============================================================================
-- 6. Contratos de leitura: conditions (NULL e v1) e public_offer.
-- =============================================================================
DO $$
DECLARE
  v_id uuid;
  v_cond jsonb;
  v_pub jsonb;
  v_keys text[];
  v_forbidden text[] := ARRAY[
    'id',
    'offer_key',
    'version_id',
    'published_by',
    'created_by',
    'publication_reason',
    'release_count',
    'releases'
  ];
BEGIN
  SELECT id
  INTO v_id
  FROM public.trial_offer_versions
  WHERE offer_key = 'trial_28d_v1'
    AND version_label = 'v1';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'F63_SEED_MISSING';
  END IF;

  v_cond := public.trial_offer_conditions(NULL);

  IF jsonb_typeof(v_cond) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(v_cond)) <> 9 THEN
    RAISE EXCEPTION 'F63_CONDITIONS_SHAPE';
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
    RAISE EXCEPTION 'F63_CONDITIONS_VALUES';
  END IF;

  v_cond := public.trial_offer_conditions(v_id);

  IF jsonb_typeof(v_cond) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(v_cond)) <> 9 THEN
    RAISE EXCEPTION 'F63_CONDITIONS_SHAPE_VERSION';
  END IF;

  IF (v_cond ->> 'version_id')::uuid IS DISTINCT FROM v_id
     OR v_cond ->> 'version_label' IS DISTINCT FROM 'v1'
     OR (v_cond ->> 'max_total_credits')::integer IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'F63_CONDITIONS_VALUES_VERSION';
  END IF;

  v_pub := public.trial_offer_public_offer();

  IF jsonb_typeof(v_pub) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(v_pub)) <> 6 THEN
    RAISE EXCEPTION 'F63_PUBLIC_OFFER_SHAPE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(v_pub) AS k
    WHERE k = ANY (v_forbidden)
  ) THEN
    RAISE EXCEPTION 'F63_PUBLIC_OFFER_FORBIDDEN_KEY';
  END IF;

  v_keys := ARRAY(SELECT jsonb_object_keys(v_pub) ORDER BY 1);

  IF v_keys IS DISTINCT FROM ARRAY[
    'credits_per_release',
    'duration_days',
    'max_total_credits',
    'public_name',
    'release_frequency',
    'version_label'
  ] THEN
    RAISE EXCEPTION 'F63_PUBLIC_OFFER_KEYS: %', array_to_string(v_keys, ',');
  END IF;
END
$$;

-- =============================================================================
-- 7. Preservação na mesma transação.
--    trial_offer_settings NÃO é tabela preservada nesta fase: a única mudança
--    permitida nela é a coluna/referência nova (current_version_id), já
--    protegida pela guarda dos oito campos no bloco 4.
-- =============================================================================
DROP TABLE IF EXISTS pg_temp.f63_preserved_after;
CREATE TEMP TABLE f63_preserved_after AS
SELECT 'trial_offer_enrollments'::text AS table_name,
       count(*)::bigint AS row_count,
       md5(coalesce(string_agg(t::text, E'\n' order by t.id), '')) AS row_checksum_md5
FROM public.trial_offer_enrollments t
UNION ALL
SELECT 'credit_balances'::text,
       count(*)::bigint,
       md5(coalesce(string_agg(t::text, E'\n' order by t.store_id), ''))
FROM public.credit_balances t
UNION ALL
SELECT 'credit_transactions'::text,
       count(*)::bigint,
       md5(coalesce(string_agg(t::text, E'\n' order by t.id), ''))
FROM public.credit_transactions t
UNION ALL
SELECT 'freemium_entitlements'::text,
       count(*)::bigint,
       md5(coalesce(string_agg(t::text, E'\n' order by t.id), ''))
FROM public.freemium_entitlements t;

DO $$
DECLARE
  v_baseline_rows integer;
  r RECORD;
BEGIN
  SELECT count(*) INTO v_baseline_rows FROM f63_preserved_baseline;
  IF v_baseline_rows <> 4 THEN
    RAISE EXCEPTION 'F63_PRESERVED_SNAPSHOT_INCOMPLETE: % linhas', v_baseline_rows;
  END IF;

  IF (SELECT count(*) FROM f63_preserved_after) <> 4 THEN
    RAISE EXCEPTION 'F63_PRESERVED_AFTER_INCOMPLETE';
  END IF;

  FOR r IN
    SELECT b.table_name
    FROM f63_preserved_baseline b
    WHERE NOT EXISTS (
      SELECT 1
      FROM f63_preserved_after a
      WHERE a.table_name = b.table_name
        AND a.row_count = b.row_count
        AND a.row_checksum_md5 = b.row_checksum_md5
    )
    ORDER BY b.table_name
  LOOP
    RAISE EXCEPTION 'F63_PRESERVED_TABLE_CHANGED: %', r.table_name;
  END LOOP;
END
$$;

-- =============================================================================
-- 8. REVERT (comentado) — NÃO executar automaticamente.
--    Ordem segura: remover a referência e o NOT NULL ANTES de apagar a v1.
--    A exclusão da v1 publicada é proibida pelo trigger
--    (trial_offer_version_published_delete_forbidden). Depois de existirem
--    referências futuras de concessões à versão, o rollback estrutural deixa de
--    ser seguro: a correção é publicar uma nova versão e repontar a vigência.
-- =============================================================================
-- ALTER TABLE public.trial_offer_settings
--   ALTER COLUMN current_version_id DROP NOT NULL;
-- UPDATE public.trial_offer_settings
--   SET current_version_id = NULL
--   WHERE offer_key = 'trial_28d_v1';
-- DELETE FROM public.trial_offer_versions
--   WHERE offer_key = 'trial_28d_v1'
--     AND version_label = 'v1';
-- =============================================================================
