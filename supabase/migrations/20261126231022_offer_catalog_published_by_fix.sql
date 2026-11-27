-- =============================================================================
-- F63 — Base versionada de ofertas (subfatia 2A)
-- Migration C — correção forward-only do guard de publicação (published_by).
--
-- Contexto: a Migration A (20261126223854_offer_catalog_versions.sql, já
-- aplicada) não permite definir published_by na primeira publicação: o UPDATE
-- rascunho -> publicado rejeita a transição NULL -> UUID com
-- trial_offer_version_author_immutable. A Migration A NÃO é editada, renomeada
-- nem reaplicada. Esta migration corrige o defeito apenas substituindo a
-- função de trigger public.trial_offer_versions_guard().
--
-- Escopo desta migration (e SOMENTE isto):
--   1. CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard();
--   2. REVOKE/GRANT EXECUTE da função, restrita a service_role;
--   3. Bloco REVERT comentado, sem auto-execução.
--
-- Esta migration NÃO altera:
--   - tabelas, colunas, constraints, índices, políticas ou grants de tabela;
--   - dados (nenhum INSERT/UPDATE/DELETE em linhas de negócio);
--   - outras funções (helper de calendário, guard de delete, guard de vigência
--     e as três leituras permanecem exatamente como na Migration A);
--   - RPCs, constantes, status, completion, copy, Admin ou flags.
--
-- Alvo exclusivo: homolog local existente (container supabase_db_vendeo-homolog,
-- banco postgres, 127.0.0.1:57782). NENHUMA aplicação em produção ou banco
-- remoto. Nenhum reset de banco, criação de banco, push, link ou backup.
--
-- A linha do ledger (supabase_migrations.schema_migrations) é inserida pelo
-- wrapper transacional do aplicador na MESMA transação desta migration.
--
-- Regras implementadas (published_by):
--   - INSERT com published_at IS NULL (rascunho): published_by MUST be NULL.
--   - INSERT com published_at IS NOT NULL (já publicado): motivo e calendário
--     obrigatórios; published_by NULL ou UUID são aceitos (autoria de criação).
--   - UPDATE rascunho -> rascunho: published_by MUST be NULL (sem definir/alterar).
--   - UPDATE rascunho -> publicado: motivo e calendário obrigatórios;
--     published_by NULL -> UUID é aceito (primeira publicação), inclusive NULL.
--   - UPDATE de versão publicada: published_by só pode transitar UUID -> NULL
--     por ação referencial; UUID -> outro UUID e NULL -> UUID são rejeitados.
--   - created_by, em qualquer estágio: apenas NOT NULL -> NULL.
--   - id, offer_key, version_label, condições, published_at, publication_reason
--     e created_at permanecem congelados conforme a Migration A.
--
-- Nota de fingerprint: esta é a TERCEIRA linha nova no ledger do F63. O F57.2
-- filtra nomes `f57_2_`; com +3 linhas o fingerprint armazenado do F57.2 passa
-- a divergir. O F57.2 NÃO é reexecutado após o F63; o re-baseline está
-- explicitamente FORA de escopo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Rascunho: autoria de publicação só existe com publicação.
    IF NEW.published_at IS NULL THEN
      IF NEW.published_by IS NOT NULL THEN
        RAISE EXCEPTION 'trial_offer_publisher_requires_publication';
      END IF;
      RETURN NEW;
    END IF;

    -- Inserção já publicada: motivo e calendário obrigatórios. published_by
    -- pode ser NULL ou UUID (autoria de criação), sem rejeição no insert.
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

  -- created_by, em qualquer estágio: apenas a ação referencial (valor -> NULL).
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND NOT (OLD.created_by IS NOT NULL AND NEW.created_by IS NULL) THEN
    RAISE EXCEPTION 'trial_offer_version_author_immutable';
  END IF;

  IF OLD.published_at IS NOT NULL THEN
    -- Versão publicada: publicação, condições e created_at congelados.
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

    -- published_by depois de publicado: apenas UUID -> NULL (ação referencial).
    IF NEW.published_by IS DISTINCT FROM OLD.published_by
       AND NOT (OLD.published_by IS NOT NULL AND NEW.published_by IS NULL) THEN
      RAISE EXCEPTION 'trial_offer_version_author_immutable';
    END IF;

    RETURN NEW;
  END IF;

  -- Rascunho -> rascunho: condições editáveis; published_by MUST remain NULL.
  IF NEW.published_at IS NULL THEN
    IF NEW.published_by IS NOT NULL
       OR NEW.published_by IS DISTINCT FROM OLD.published_by THEN
      RAISE EXCEPTION 'trial_offer_publisher_requires_publication';
    END IF;
    RETURN NEW;
  END IF;

  -- Rascunho -> publicado (primeira publicação): mesmas validações da inserção
  -- publicada. published_by NULL -> UUID é aceito; permanecer NULL também.
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

-- Nota: o COMMENT ON FUNCTION da Migration A não é alterado aqui. Esta
-- migration substitui apenas o corpo/atributos da função, com REVOKE/GRANT
-- reaplicados; nenhuma tabela, dado ou outra função é tocada.

REVOKE ALL ON FUNCTION public.trial_offer_versions_guard()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_versions_guard()
  TO service_role;

-- =============================================================================
-- REVERT (comentado) — NÃO executar automaticamente.
-- Restaura exatamente a versão do guard da Migration A (20261126223854).
-- Isso reintroduz o defeito conhecido: primeira publicação com published_by
-- NULL -> UUID é rejeitada com trial_offer_version_author_immutable.
-- =============================================================================
-- CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SET search_path = ''
-- AS $$
-- BEGIN
--   IF TG_OP = 'INSERT' THEN
--     IF NEW.published_at IS NULL THEN
--       RETURN NEW;
--     END IF;
--
--     IF NEW.publication_reason IS NULL OR btrim(NEW.publication_reason) = '' THEN
--       RAISE EXCEPTION 'trial_offer_publication_reason_required';
--     END IF;
--
--     IF NOT public.trial_offer_calendar_reaches_total(
--       NEW.release_frequency,
--       NEW.credits_per_release,
--       NEW.max_total_credits,
--       NEW.duration_days
--     ) THEN
--       RAISE EXCEPTION 'trial_offer_publication_calendar_insufficient';
--     END IF;
--
--     RETURN NEW;
--   END IF;
--
--   IF NEW.id IS DISTINCT FROM OLD.id THEN
--     RAISE EXCEPTION 'trial_offer_version_id_immutable';
--   END IF;
--
--   IF NEW.offer_key IS DISTINCT FROM OLD.offer_key
--      OR NEW.version_label IS DISTINCT FROM OLD.version_label THEN
--     RAISE EXCEPTION 'trial_offer_version_identity_immutable';
--   END IF;
--
--   IF NEW.created_by IS DISTINCT FROM OLD.created_by
--      AND NOT (OLD.created_by IS NOT NULL AND NEW.created_by IS NULL) THEN
--     RAISE EXCEPTION 'trial_offer_version_author_immutable';
--   END IF;
--
--   IF NEW.published_by IS DISTINCT FROM OLD.published_by
--      AND NOT (OLD.published_by IS NOT NULL AND NEW.published_by IS NULL) THEN
--     RAISE EXCEPTION 'trial_offer_version_author_immutable';
--   END IF;
--
--   IF OLD.published_at IS NOT NULL THEN
--     IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
--       RAISE EXCEPTION 'trial_offer_version_published_immutable';
--     END IF;
--
--     IF NEW.public_name IS DISTINCT FROM OLD.public_name
--        OR NEW.duration_days IS DISTINCT FROM OLD.duration_days
--        OR NEW.max_total_credits IS DISTINCT FROM OLD.max_total_credits
--        OR NEW.release_frequency IS DISTINCT FROM OLD.release_frequency
--        OR NEW.credits_per_release IS DISTINCT FROM OLD.credits_per_release
--        OR NEW.publication_reason IS DISTINCT FROM OLD.publication_reason
--        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
--       RAISE EXCEPTION 'trial_offer_version_conditions_immutable';
--     END IF;
--
--     RETURN NEW;
--   END IF;
--
--   IF NEW.published_at IS NULL THEN
--     RETURN NEW;
--   END IF;
--
--   IF NEW.publication_reason IS NULL OR btrim(NEW.publication_reason) = '' THEN
--     RAISE EXCEPTION 'trial_offer_publication_reason_required';
--   END IF;
--
--   IF NOT public.trial_offer_calendar_reaches_total(
--     NEW.release_frequency,
--     NEW.credits_per_release,
--     NEW.max_total_credits,
--     NEW.duration_days
--   ) THEN
--     RAISE EXCEPTION 'trial_offer_publication_calendar_insufficient';
--   END IF;
--
--   RETURN NEW;
-- END;
-- $$;
-- REVOKE ALL ON FUNCTION public.trial_offer_versions_guard()
--   FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.trial_offer_versions_guard()
--   TO service_role;
-- =============================================================================
