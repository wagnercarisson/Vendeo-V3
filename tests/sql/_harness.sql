-- F50.4 — sentinela de identidade do PostgreSQL DESCARTÁVEL.
--
-- Aplicado por scripts/f50-4/disposable-db.mjs (subcomando `create`) logo após
-- o bootstrap real (`supabase start`) e ANTES de qualquer migration do repo.
-- A presença desta tabela com purpose='disposable' é pré-condição para o
-- runner SQL e para scripts/verify/50-4-f50-4-verification.mjs.
--
-- Esta tabela NUNCA é criada em produção, no isolado antigo ou em ambiente
-- compartilhado: o harness recusa esses alvos antes de conectar.

CREATE TABLE IF NOT EXISTS public.f50_4_harness_identity (
  run_id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose = 'disposable'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  migrations_dir TEXT NOT NULL,
  migrations_expected INTEGER NOT NULL CHECK (migrations_expected >= 0)
);

COMMENT ON TABLE public.f50_4_harness_identity IS
  'F50.4: sentinela de banco descartável. purpose=disposable obrigatório; nunca criada em produção.';

REVOKE ALL ON TABLE public.f50_4_harness_identity FROM anon;
REVOKE ALL ON TABLE public.f50_4_harness_identity FROM authenticated;
REVOKE ALL ON TABLE public.f50_4_harness_identity FROM service_role;
