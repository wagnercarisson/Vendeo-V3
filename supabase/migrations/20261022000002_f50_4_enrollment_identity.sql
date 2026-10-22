-- =============================================================================
-- F50.4 — Oferta de onboarding individualizada por CNPJ completo
-- Migration M2/3: identidade do CNPJ beneficiário, coorte persistida,
-- backfill fail-closed, unicidades, trigger de imutabilidade e RPCs de política.
--
-- Escopo:
--   1. Precheck fail-closed ANTES de qualquer DDL (nenhuma linha alterada).
--   2. Colunas beneficiary_cnpj_normalized e policy_cohort.
--   3. Backfill exclusivo por store_id -> stores.cnpj_normalized.
--   4. Constraints, unicidade global do beneficiário, índice parcial de raiz
--      legada e trigger de imutabilidade da identidade.
--   5. Helpers de coorte/benefício e RPCs centrais de política.
--
-- Regras:
--   - Nenhuma migration é aplicada por este arquivo em produção.
--   - Nenhum saldo, transação, entitlement, data ou parcela é reescrito.
--   - Backfill só com evidência segura; qualquer ambiguidade aborta.
--   - Conflito de inscrição é resolvido SOMENTE por store_id.
--   - Respostas de RPC nunca expõem CNPJ completo, root_hash ou dados de
--     outra filial.
-- =============================================================================

-- =============================================================================
-- 1. Precheck fail-closed — aborta ANTES de qualquer DDL
-- =============================================================================

DO $$
DECLARE
  v_missing_store BIGINT;
  v_bad_cnpj BIGINT;
  v_root_mismatch BIGINT;
BEGIN
  -- 1.1 Enrollment sem loja existente
  SELECT count(*) INTO v_missing_store
  FROM public.trial_offer_enrollments e
  LEFT JOIN public.stores s ON s.id = e.store_id
  WHERE s.id IS NULL;

  IF v_missing_store > 0 THEN
    RAISE EXCEPTION
      'F50_4_PRECHECK_MISSING_STORE: % enrollment(s) sem loja. Nenhuma linha foi alterada.',
      v_missing_store;
  END IF;

  -- 1.2 CNPJ canônico ausente/ inválido na loja beneficiária
  SELECT count(*) INTO v_bad_cnpj
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.cnpj_normalized IS NULL
     OR s.cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$';

  IF v_bad_cnpj > 0 THEN
    RAISE EXCEPTION
      'F50_4_PRECHECK_BAD_CNPJ: % enrollment(s) sem CNPJ canônico. Nenhuma linha foi alterada.',
      v_bad_cnpj;
  END IF;

  -- 1.3 Evidência de raiz incompatível entre enrollment e loja
  SELECT count(*) INTO v_root_mismatch
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.cnpj_root_hash IS DISTINCT FROM e.root_hash
     OR s.cnpj_root_hash IS NULL
     OR s.cnpj_root_hash = '';

  IF v_root_mismatch > 0 THEN
    RAISE EXCEPTION
      'F50_4_PRECHECK_ROOT_HASH_MISMATCH: % enrollment(s) com root_hash incompatível. Nenhuma linha foi alterada.',
      v_root_mismatch;
  END IF;
END;
$$;

-- =============================================================================
-- 2. Colunas de identidade e coorte
-- =============================================================================

ALTER TABLE public.trial_offer_enrollments
  ADD COLUMN IF NOT EXISTS beneficiary_cnpj_normalized TEXT;

ALTER TABLE public.trial_offer_enrollments
  ADD COLUMN IF NOT EXISTS policy_cohort TEXT NOT NULL DEFAULT 'root_legacy';

COMMENT ON COLUMN public.trial_offer_enrollments.beneficiary_cnpj_normalized IS
  'F50.4: snapshot canônico do CNPJ completo do beneficiário (14 caracteres, ^[A-Z0-9]{12}[0-9]{2}$). Imutável após o insert.';
COMMENT ON COLUMN public.trial_offer_enrollments.policy_cohort IS
  'F50.4: coorte da inscrição. root_legacy preserva a unicidade por raiz; per_cnpj_f50_4 usa a unicidade por CNPJ completo.';

-- =============================================================================
-- 3. Backfill exclusivo por evidência segura (store_id -> stores)
-- =============================================================================

UPDATE public.trial_offer_enrollments e
SET beneficiary_cnpj_normalized = s.cnpj_normalized
FROM public.stores s
WHERE s.id = e.store_id
  AND e.beneficiary_cnpj_normalized IS NULL;

ALTER TABLE public.trial_offer_enrollments
  ALTER COLUMN beneficiary_cnpj_normalized SET NOT NULL;

-- =============================================================================
-- 4. Constraints de identidade e coorte
-- =============================================================================

ALTER TABLE public.trial_offer_enrollments
  ADD CONSTRAINT chk_trial_offer_enrollments_beneficiary_cnpj
  CHECK (beneficiary_cnpj_normalized ~ '^[A-Z0-9]{12}[0-9]{2}$')
  NOT VALID;

ALTER TABLE public.trial_offer_enrollments
  VALIDATE CONSTRAINT chk_trial_offer_enrollments_beneficiary_cnpj;

ALTER TABLE public.trial_offer_enrollments
  ADD CONSTRAINT chk_trial_offer_enrollments_policy_cohort
  CHECK (policy_cohort IN ('root_legacy','per_cnpj_f50_4'));

-- =============================================================================
-- 5. Unicidades: beneficiário global, raiz apenas para o legado, loja mantida
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_offer_enrollments_beneficiary
  ON public.trial_offer_enrollments (beneficiary_cnpj_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_offer_enrollments_root_legacy
  ON public.trial_offer_enrollments (root_hash)
  WHERE policy_cohort = 'root_legacy';

ALTER TABLE public.trial_offer_enrollments
  DROP CONSTRAINT IF EXISTS uq_trial_offer_enrollments_root;

-- =============================================================================
-- 6. Trigger de imutabilidade da identidade
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_enrollments_immutable_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.beneficiary_cnpj_normalized IS DISTINCT FROM OLD.beneficiary_cnpj_normalized
     OR NEW.policy_cohort IS DISTINCT FROM OLD.policy_cohort
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.root_hash IS DISTINCT FROM OLD.root_hash
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'trial_offer_enrollment_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trial_offer_enrollments_immutable_identity
  ON public.trial_offer_enrollments;

CREATE TRIGGER trg_trial_offer_enrollments_immutable_identity
  BEFORE UPDATE ON public.trial_offer_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_enrollments_immutable_identity();

-- =============================================================================
-- 7. RLS e grants da tabela (reafirmados; anon/authenticated sem acesso)
-- =============================================================================

ALTER TABLE public.trial_offer_enrollments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trial_offer_enrollments FROM anon;
REVOKE ALL ON TABLE public.trial_offer_enrollments FROM authenticated;
REVOKE ALL ON TABLE public.trial_offer_enrollments FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.trial_offer_enrollments TO service_role;

-- =============================================================================
-- 8. Helper único de coorte (fonte da verdade no banco)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_policy_cohort(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN s.individual_launch_at IS NULL THEN 'root_legacy'
      WHEN au.created_at IS NULL THEN 'root_legacy'
      WHEN au.created_at >= s.individual_launch_at THEN 'per_cnpj_f50_4'
      ELSE 'root_legacy'
    END
    FROM public.trial_offer_settings s
    JOIN auth.users au ON au.id = p_user_id
    WHERE s.offer_key = 'trial_28d_v1'
  ), 'root_legacy');
$$;

COMMENT ON FUNCTION public.trial_offer_policy_cohort(UUID) IS
  'F50.4: coorte única por auth.users.created_at versus individual_launch_at. Fallback root_legacy quando settings/usuário ausente.';

-- =============================================================================
-- 9. Leitura de benefício anterior por CNPJ completo
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_beneficiary_prior_benefit(
  p_cnpj_normalized TEXT,
  p_root_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prior BOOLEAN := false;
  v_ambiguous BOOLEAN := false;
BEGIN
  IF p_cnpj_normalized IS NULL
     OR btrim(p_cnpj_normalized) = ''
     OR p_cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN
    -- Sem CNPJ canônico não há evidência de benefício por beneficiário.
    -- A decisão de elegibilidade falha fechada no chamador.
    RETURN jsonb_build_object('prior_benefit', false, 'ambiguous', false);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.freemium_entitlements fe
    JOIN public.stores s ON s.id = fe.store_id
    WHERE s.cnpj_normalized = p_cnpj_normalized
      AND fe.benefit_type IN ('onboarding','demo','admin_exception')
  ) OR EXISTS (
    SELECT 1
    FROM public.credit_transactions ct
    JOIN public.stores s ON s.id = ct.store_id
    WHERE s.cnpj_normalized = p_cnpj_normalized
      AND (
        ct.type = 'bonus_onboarding'
        OR (
          ct.type = 'demo'
          -- Parcelas do teste F50.2 usam type='demo' com
          -- metadata.credit_program='trial_28d'; o enrollment do mesmo CNPJ
          -- já cobre esse caso.
          AND COALESCE(ct.metadata->>'credit_program', '') <> 'trial_28d'
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.trial_offer_enrollments e
    WHERE e.beneficiary_cnpj_normalized = p_cnpj_normalized
  ) THEN
    v_prior := true;
  END IF;

  IF p_root_hash IS NOT NULL AND btrim(p_root_hash) <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM public.freemium_entitlements fe
      WHERE fe.store_id IS NULL
        AND fe.root_hash = p_root_hash
        AND fe.benefit_type IN ('onboarding','demo','admin_exception')
    ) THEN
      v_ambiguous := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'prior_benefit', v_prior,
    'ambiguous', v_ambiguous
  );
END;
$$;

COMMENT ON FUNCTION public.trial_offer_beneficiary_prior_benefit(TEXT, TEXT) IS
  'F50.4: benefício anterior por CNPJ completo (entitlement/transação/enrollment). Ignora admin_grant, bonus_monthly, compra, estorno e expiração. Nunca retorna ids, CNPJ ou root_hash.';

-- =============================================================================
-- 10. Preservação da política legada por raiz (exclusiva de root_legacy)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_legacy_root_prior_benefit(p_root_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_root_hash IS NOT NULL AND btrim(p_root_hash) <> '' AND (
    EXISTS (
      SELECT 1
      FROM public.freemium_entitlements fe
      WHERE fe.root_hash = p_root_hash
        AND fe.benefit_type IN ('onboarding','demo','admin_exception')
    )
    OR EXISTS (
      SELECT 1
      FROM public.credit_transactions ct
      JOIN public.stores s ON s.id = ct.store_id
      WHERE s.cnpj_root_hash = p_root_hash
        AND (
          ct.type = 'bonus_onboarding'
          OR (
            ct.type = 'demo'
            AND COALESCE(ct.metadata->>'credit_program', '') <> 'trial_28d'
          )
        )
    )
  );
$$;

COMMENT ON FUNCTION public.trial_offer_legacy_root_prior_benefit(TEXT) IS
  'F50.4: política legada por raiz (entitlement/transação de benefício inicial). Usada SOMENTE na coorte root_legacy; nunca em per_cnpj_f50_4.';

-- =============================================================================
-- 11. Contexto de política para a avaliação cadastral
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_policy_context(
  p_user_id UUID,
  p_cnpj_normalized TEXT,
  p_root_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cohort TEXT;
  v_prior JSONB;
  v_beneficiary_eligible BOOLEAN;
  v_beneficiary_ambiguous BOOLEAN;
  v_root_eligible BOOLEAN;
BEGIN
  v_cohort := public.trial_offer_policy_cohort(p_user_id);

  v_prior := public.trial_offer_beneficiary_prior_benefit(p_cnpj_normalized, p_root_hash);
  v_beneficiary_ambiguous := COALESCE((v_prior ->> 'ambiguous')::boolean, false);

  IF p_cnpj_normalized IS NULL
     OR btrim(p_cnpj_normalized) = ''
     OR p_cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN
    v_beneficiary_eligible := false;
  ELSIF v_cohort = 'per_cnpj_f50_4' THEN
    v_beneficiary_eligible := NOT COALESCE((v_prior ->> 'prior_benefit')::boolean, false)
      AND NOT v_beneficiary_ambiguous;
  ELSE
    v_beneficiary_eligible := NOT public.trial_offer_legacy_root_prior_benefit(p_root_hash)
      AND NOT v_beneficiary_ambiguous;
  END IF;

  IF v_cohort = 'per_cnpj_f50_4' THEN
    v_root_eligible := true;
  ELSE
    IF p_root_hash IS NULL OR btrim(p_root_hash) = '' THEN
      v_beneficiary_eligible := false;
      v_root_eligible := false;
    ELSE
      v_root_eligible := v_beneficiary_eligible;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'policy_cohort', v_cohort,
    'beneficiary_eligible', v_beneficiary_eligible,
    'beneficiary_ambiguous', v_beneficiary_ambiguous,
    'root_eligible', v_root_eligible
  );
END;
$$;

COMMENT ON FUNCTION public.trial_offer_policy_context(UUID, TEXT, TEXT) IS
  'F50.4: contexto de política (coorte + elegibilidade por beneficiário/raiz) para avaliação cadastral. Retorna apenas enum/booleanos; nunca CNPJ, root_hash ou ids.';

-- =============================================================================
-- 12. Elegibilidade por coorte (fonte única de decisão da oferta)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_eligibility(
  p_store_id UUID,
  p_now TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store RECORD;
  v_settings RECORD;
  v_account_created_at TIMESTAMPTZ;
  v_existing UUID;
  v_cohort TEXT;
  v_prior JSONB;
BEGIN
  SELECT s.id,
         s.user_id,
         s.cnpj_root_hash AS cnpj_root_hash,
         s.cnpj_normalized AS cnpj_normalized,
         s.is_test_store,
         s.onboarding_completed_at
  INTO v_store
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'store_not_found');
  END IF;

  IF v_store.onboarding_completed_at IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_completed');
  END IF;

  IF p_now >= v_store.onboarding_completed_at + interval '28 days' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'expired_window');
  END IF;

  SELECT enabled, launch_at INTO v_settings
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1';

  IF NOT FOUND OR v_settings.enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'offer_disabled');
  END IF;

  IF v_settings.launch_at IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'launch_not_set');
  END IF;

  SELECT au.created_at INTO v_account_created_at
  FROM auth.users au
  WHERE au.id = v_store.user_id;

  IF v_account_created_at IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'account_not_found');
  END IF;

  v_cohort := public.trial_offer_policy_cohort(v_store.user_id);

  IF v_cohort = 'root_legacy'
     AND v_account_created_at < v_settings.launch_at THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'account_before_launch',
      'policy_cohort', v_cohort
    );
  END IF;

  IF v_store.cnpj_root_hash IS NULL OR btrim(v_store.cnpj_root_hash) = '' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'no_root',
      'policy_cohort', v_cohort
    );
  END IF;

  IF v_store.cnpj_normalized IS NULL
     OR btrim(v_store.cnpj_normalized) = ''
     OR v_store.cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'no_beneficiary_cnpj',
      'policy_cohort', v_cohort
    );
  END IF;

  IF v_store.is_test_store IS TRUE THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'test_store',
      'policy_cohort', v_cohort
    );
  END IF;

  -- Enrollment da própria loja é o único que pode ser retornado ao chamador.
  SELECT e.id INTO v_existing
  FROM public.trial_offer_enrollments e
  WHERE e.store_id = v_store.id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'existing_enrollment_id', v_existing,
      'policy_cohort', v_cohort
    );
  END IF;

  IF v_cohort = 'root_legacy' THEN
    -- A garantia legada é por raiz, e SOMENTE por enrollment root_legacy.
    -- Enrollment per_cnpj_f50_4 de outra filial nunca bloqueia esta conta.
    IF EXISTS (
      SELECT 1
      FROM public.trial_offer_enrollments e
      WHERE e.root_hash = v_store.cnpj_root_hash
        AND e.policy_cohort = 'root_legacy'
        AND e.store_id <> p_store_id
    ) THEN
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'root_used_other_beneficiary',
        'policy_cohort', v_cohort
      );
    END IF;

    v_prior := public.trial_offer_beneficiary_prior_benefit(
      v_store.cnpj_normalized,
      v_store.cnpj_root_hash
    );

    IF COALESCE((v_prior ->> 'ambiguous')::boolean, false) THEN
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'prior_benefit_ambiguous',
        'policy_cohort', v_cohort
      );
    END IF;

    IF public.trial_offer_legacy_root_prior_benefit(v_store.cnpj_root_hash) THEN
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'prior_benefit',
        'policy_cohort', v_cohort
      );
    END IF;
  ELSE
    -- per_cnpj_f50_4: somente o mesmo CNPJ completo bloqueia.
    -- Outras filiais da raiz e seus root_hash são ignorados por completo.
    IF EXISTS (
      SELECT 1
      FROM public.trial_offer_enrollments e
      WHERE e.beneficiary_cnpj_normalized = v_store.cnpj_normalized
    ) THEN
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'beneficiary_already_enrolled',
        'policy_cohort', v_cohort
      );
    END IF;

    v_prior := public.trial_offer_beneficiary_prior_benefit(
      v_store.cnpj_normalized,
      v_store.cnpj_root_hash
    );

    IF COALESCE((v_prior ->> 'ambiguous')::boolean, false) THEN
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'prior_benefit_ambiguous',
        'policy_cohort', v_cohort
      );
    END IF;

    IF COALESCE((v_prior ->> 'prior_benefit')::boolean, false) THEN
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'prior_benefit',
        'policy_cohort', v_cohort
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'existing_enrollment_id', NULL,
    'policy_cohort', v_cohort
  );
END;
$$;

-- =============================================================================
-- 13. Conclusão do onboarding (contrato preservado; não cria enrollment)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_onboarding_completion(
  p_store_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_completed_at TIMESTAMPTZ;
  v_ready BOOLEAN;
  v_eligibility JSONB;
BEGIN
  SELECT s.onboarding_completed_at INTO v_completed_at
  FROM public.stores s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('completed', false, 'status', 'store_not_found', 'reason', 'store_not_found');
  END IF;

  IF v_completed_at IS NULL THEN
    SELECT (public.check_store_readiness(p_store_id) ->> 'ready')::boolean INTO v_ready;
    IF v_ready IS NOT TRUE THEN
      RETURN jsonb_build_object('completed', false, 'status', 'not_ready', 'reason', 'not_ready');
    END IF;

    UPDATE public.stores
    SET onboarding_completed_at = p_now
    WHERE id = p_store_id AND onboarding_completed_at IS NULL;

    v_completed_at := p_now;
  END IF;

  v_eligibility := public.trial_offer_eligibility(p_store_id, p_now);

  RETURN jsonb_build_object(
    'completed', true,
    'status', 'completed',
    'onboarding_completed_at', v_completed_at,
    'eligibility', v_eligibility
  );
END;
$$;

-- =============================================================================
-- 14. Inscrição + parcela 0 (loja FOR UPDATE -> advisory de raiz -> insert)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.start_trial_offer_enrollment(
  p_store_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store RECORD;
  v_eligibility JSONB;
  v_cohort TEXT;
  v_enrollment_id UUID;
  v_started_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_granted_total INTEGER;
  v_last_granted_seq INTEGER;
  v_grant JSONB;
  v_reason TEXT;
BEGIN
  SELECT s.id,
         s.user_id,
         s.cnpj_root_hash AS root_hash,
         s.cnpj_normalized AS beneficiary_cnpj,
         s.onboarding_completed_at
  INTO v_store
  FROM public.stores s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_eligible', 'reason', 'store_not_found');
  END IF;

  IF v_store.onboarding_completed_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_ready', 'reason', 'not_completed');
  END IF;

  v_cohort := public.trial_offer_policy_cohort(v_store.user_id);

  -- Ordem do protocolo: loja FOR UPDATE -> advisory de raiz -> constraint -> saldo.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('vendeo:benefit:' || v_store.root_hash, 0)
  );

  v_eligibility := public.trial_offer_eligibility(p_store_id, p_now);

  IF (v_eligibility ->> 'eligible')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'status', 'not_eligible',
      'reason', v_eligibility ->> 'reason',
      'policy_cohort', v_cohort
    );
  END IF;

  IF v_eligibility ->> 'existing_enrollment_id' IS NOT NULL THEN
    SELECT e.id, e.started_at, e.expires_at, e.granted_total, e.last_granted_seq
    INTO v_enrollment_id, v_started_at, v_expires_at, v_granted_total, v_last_granted_seq
    FROM public.trial_offer_enrollments e
    WHERE e.id = (v_eligibility ->> 'existing_enrollment_id')::uuid;

    RETURN jsonb_build_object(
      'status', 'existing',
      'enrollment_id', v_enrollment_id,
      'started_at', v_started_at,
      'expires_at', v_expires_at,
      'granted_total', v_granted_total,
      'last_granted_seq', v_last_granted_seq,
      'policy_cohort', v_cohort
    );
  END IF;

  v_started_at := v_store.onboarding_completed_at;
  v_expires_at := v_started_at + interval '28 days';

  INSERT INTO public.trial_offer_enrollments (
    store_id, user_id, root_hash, offer_key, started_at, expires_at,
    beneficiary_cnpj_normalized, policy_cohort
  ) VALUES (
    v_store.id,
    v_store.user_id,
    v_store.root_hash,
    'trial_28d_v1',
    v_started_at,
    v_expires_at,
    v_store.beneficiary_cnpj,
    v_cohort
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_enrollment_id;

  IF v_enrollment_id IS NULL THEN
    -- Conflito resolvido SOMENTE pelo mesmo store_id. Nunca devolver a
    -- inscrição de outra filial nem seu beneficiário/root_hash.
    SELECT e.id, e.started_at, e.expires_at, e.granted_total, e.last_granted_seq
    INTO v_enrollment_id, v_started_at, v_expires_at, v_granted_total, v_last_granted_seq
    FROM public.trial_offer_enrollments e
    WHERE e.store_id = p_store_id
    LIMIT 1;

    IF v_enrollment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'enrollment_id', v_enrollment_id,
        'started_at', v_started_at,
        'expires_at', v_expires_at,
        'granted_total', v_granted_total,
        'last_granted_seq', v_last_granted_seq,
        'policy_cohort', v_cohort
      );
    END IF;

    IF v_cohort = 'per_cnpj_f50_4' THEN
      v_reason := 'beneficiary_already_enrolled';
    ELSE
      v_reason := 'root_used_other_beneficiary';
    END IF;

    RETURN jsonb_build_object(
      'status', 'not_eligible',
      'reason', v_reason,
      'policy_cohort', v_cohort
    );
  END IF;

  v_grant := public.grant_trial_offer_installment(v_enrollment_id, 0, p_now);

  IF (v_grant ->> 'granted')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'trial_offer_day0_failed';
  END IF;

  RETURN jsonb_build_object(
    'status', 'started',
    'enrollment_id', v_enrollment_id,
    'started_at', v_started_at,
    'expires_at', v_expires_at,
    'grant', v_grant,
    'policy_cohort', v_cohort
  );
END;
$$;

-- =============================================================================
-- 15. Privilégios: apenas service_role executa as RPCs de política
-- =============================================================================

REVOKE ALL ON FUNCTION public.trial_offer_policy_cohort(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_policy_cohort(UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_beneficiary_prior_benefit(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_beneficiary_prior_benefit(TEXT, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_legacy_root_prior_benefit(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_legacy_root_prior_benefit(TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_policy_context(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_policy_context(UUID, TEXT, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.trial_offer_eligibility(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_eligibility(UUID, TIMESTAMPTZ)
  TO service_role;

REVOKE ALL ON FUNCTION public.record_onboarding_completion(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_completion(UUID, TIMESTAMPTZ)
  TO service_role;

REVOKE ALL ON FUNCTION public.start_trial_offer_enrollment(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_trial_offer_enrollment(UUID, TIMESTAMPTZ)
  TO service_role;

-- =============================================================================
-- REVERT (comentado) — condicionado, NÃO executar automaticamente
-- =============================================================================
--
-- Permitido SOMENTE antes da ativação da F50.4 e após confirmar que NÃO existe
-- nenhum enrollment com policy_cohort = 'per_cnpj_f50_4'. Depois que duas
-- filiais da mesma raiz coexistirem, NÃO é possível restaurar a unicidade
-- global por root_hash sem apagar ou corromper dados. O rollback operacional é
-- desligar a oferta e corrigir para frente.
--
-- Verificação obrigatória antes do REVERT:
--   SELECT count(*) FROM public.trial_offer_enrollments
--   WHERE policy_cohort = 'per_cnpj_f50_4';  -- deve ser 0
--
-- REVOKE EXECUTE ON FUNCTION public.start_trial_offer_enrollment(UUID, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.start_trial_offer_enrollment(UUID, TIMESTAMPTZ);
-- DROP FUNCTION IF EXISTS public.record_onboarding_completion(UUID, TIMESTAMPTZ);
-- DROP FUNCTION IF EXISTS public.trial_offer_eligibility(UUID, TIMESTAMPTZ);
-- DROP FUNCTION IF EXISTS public.trial_offer_policy_context(UUID, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.trial_offer_legacy_root_prior_benefit(TEXT);
-- DROP FUNCTION IF EXISTS public.trial_offer_beneficiary_prior_benefit(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.trial_offer_policy_cohort(UUID);
-- DROP TRIGGER IF EXISTS trg_trial_offer_enrollments_immutable_identity
--   ON public.trial_offer_enrollments;
-- DROP FUNCTION IF EXISTS public.trial_offer_enrollments_immutable_identity();
-- DROP INDEX IF EXISTS public.uq_trial_offer_enrollments_root_legacy;
-- DROP INDEX IF EXISTS public.uq_trial_offer_enrollments_beneficiary;
-- ALTER TABLE public.trial_offer_enrollments
--   DROP CONSTRAINT IF EXISTS chk_trial_offer_enrollments_policy_cohort;
-- ALTER TABLE public.trial_offer_enrollments
--   DROP CONSTRAINT IF EXISTS chk_trial_offer_enrollments_beneficiary_cnpj;
-- ALTER TABLE public.trial_offer_enrollments
--   DROP COLUMN IF EXISTS policy_cohort;
-- ALTER TABLE public.trial_offer_enrollments
--   DROP COLUMN IF EXISTS beneficiary_cnpj_normalized;
--
-- PROIBIDO no REVERT: recriar a constraint UNIQUE(root_hash) global.
-- A garantia legada é recomposta apenas pelo índice parcial:
--   CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_offer_enrollments_root_legacy
--     ON public.trial_offer_enrollments (root_hash)
--     WHERE policy_cohort = 'root_legacy';
