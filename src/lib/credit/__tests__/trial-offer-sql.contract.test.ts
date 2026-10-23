import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readMigration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

const settings = readMigration("20261020000001_f50_2_trial_offer_settings.sql");
const enrollment = readMigration("20261020000002_f50_2_trial_offer_enrollment.sql");
const rpcs = readMigration("20261020000003_f50_2_trial_offer_rpcs.sql");
const precedence = readMigration("20261020000004_f50_2_trial_offer_precedence.sql");

describe("F50.2 trial offer SQL contract", () => {
  it("defines the settings singleton and onboarding completion column", () => {
    expect(settings).toMatch(/CREATE TABLE IF NOT EXISTS public\.trial_offer_settings/);
    expect(settings).toMatch(/offer_key TEXT NOT NULL UNIQUE/);
    expect(settings).toMatch(/launch_at TIMESTAMPTZ/);
    expect(settings).toMatch(/ADD COLUMN IF NOT EXISTS onboarding_completed_at/);
    expect(settings).toMatch(/VALUES \('trial_28d_v1', false, NULL\)/);
    expect(settings).toMatch(/ALTER TABLE public\.trial_offer_settings ENABLE ROW LEVEL SECURITY/);
  });

  it("grants launch_at only when enabled=true and launch_at is null", () => {
    expect(settings).toMatch(/IF p_enabled IS TRUE AND v_launch_at IS NULL THEN/);
    expect(settings).toMatch(/v_new_launch_at := now\(\)/);
    expect(settings).toMatch(/v_new_launch_at := v_launch_at/);
    expect(settings).toMatch(/admin_audit_log/);
    expect(settings).toMatch(/'feature_flag_update'/);
    expect(settings).toMatch(/operation_id_conflict/);
    expect(settings).toMatch(/v_audit_actor IS DISTINCT FROM p_actor_id/);
    expect(settings).toMatch(/btrim\(v_audit_reason\) IS DISTINCT FROM btrim\(p_reason\)/);
    expect(settings).toMatch(/REVOKE ALL ON FUNCTION public\.admin_set_trial_offer_enabled/);
    expect(settings).toMatch(/GRANT EXECUTE ON FUNCTION public\.admin_set_trial_offer_enabled[\s\S]*TO service_role/);
  });

  it("defines enrollment uniqueness and window invariants", () => {
    expect(enrollment).toMatch(/CREATE TABLE IF NOT EXISTS public\.trial_offer_enrollments/);
    expect(enrollment).toMatch(/UNIQUE \(root_hash\)/);
    expect(enrollment).toMatch(/UNIQUE \(store_id\)/);
    expect(enrollment).toMatch(/granted_total <= 20/);
    expect(enrollment).toMatch(/last_granted_seq >= -1 AND last_granted_seq <= 3/);
    expect(enrollment).toMatch(/expires_at > started_at/);
  });

  it("separates completion from enrollment and propagates p_now", () => {
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.trial_offer_eligibility/);
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.record_onboarding_completion\([\s\S]*p_now TIMESTAMPTZ DEFAULT now\(\)/);
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.start_trial_offer_enrollment\([\s\S]*p_now TIMESTAMPTZ DEFAULT now\(\)/);
    expect(rpcs).toMatch(/onboarding_completed_at = p_now/);
    expect(rpcs).toMatch(/v_started_at := v_store\.onboarding_completed_at/);
    expect(rpcs).toMatch(/expired_window/);
    expect(rpcs).toMatch(/p_now >= v_store\.onboarding_completed_at \+ interval '28 days'/);
  });

  it("grants installments with idempotency, lock on balance and no grant_credits demo", () => {
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.grant_trial_offer_installment\([\s\S]*p_now TIMESTAMPTZ DEFAULT now\(\)/);
    expect(rpcs).toMatch(/v_due_at := v_enrollment\.started_at \+ make_interval\(days => p_seq \* 7\)/);
    expect(rpcs).toMatch(/idempotency_key = v_idempotency_key/);
    expect(rpcs).toMatch(/FROM public\.credit_balances[\s\S]*FOR UPDATE/);
    expect(rpcs).toMatch(/demo_contributing_tx_ids = array_append/);
    expect(enrollment).toMatch(/granted_total <= 20/);
    expect(rpcs).not.toMatch(/public\.grant_credits\([\s\S]{0,120}'demo'/);
  });

  it("processes due installments with the same clock and skips expired windows", () => {
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.process_trial_offer_installments\(\s*p_now TIMESTAMPTZ DEFAULT now\(\)/);
    expect(rpcs).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(rpcs).toMatch(/public\.grant_trial_offer_installment\(v_enrollment\.id, v_next, p_now\)/);
    expect(rpcs).toMatch(/e\.expires_at > p_now/);
    expect(rpcs).toMatch(/e\.last_granted_seq < 3/);
  });

  it("preserves legacy wrappers and exposes clock-aware variants", () => {
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.materialize_demo_expiration_at/);
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.materialize_demo_expiration\(p_store_id UUID\)/);
    expect(rpcs).toMatch(/public\.materialize_demo_expiration_at\(p_store_id, now\(\)\)/);
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.refund_credit_at/);
    expect(rpcs).toMatch(/CREATE OR REPLACE FUNCTION public\.refund_credit\(/);
    expect(rpcs).toMatch(/public\.refund_credit_at\(p_tx_id, p_reason, p_idempotency_key, p_metadata, now\(\)\)/);
    expect(rpcs).toMatch(/p_reason TEXT DEFAULT NULL/);
  });

  it("applies cohort and monthly precedence without changing legacy configuration", () => {
    expect(precedence).toMatch(/'trial_offer_applies'/);
    expect(precedence).toMatch(/'trial_offer_consumed'/);
    expect(precedence).toMatch(/'skipped_trial_offer_cohort'/);
    expect(precedence).toMatch(/v_account_created_at >= v_launch_at/);
    expect(precedence).toMatch(/WHERE e\.root_hash = p_root_hash/);
    expect(precedence).toMatch(/WHERE e\.root_hash = v_root_hash/);
    expect(precedence).toMatch(/GRANT EXECUTE ON FUNCTION public\.grant_demo_credits/);
    expect(precedence).toMatch(/GRANT EXECUTE ON FUNCTION public\.grant_monthly_credits/);
    expect(precedence).not.toMatch(/VENDEO_MONTHLY_CREDITS/);
  });

  it("restricts every new RPC to service_role", () => {
    for (const fn of [
      "admin_set_trial_offer_enabled",
      "trial_offer_eligibility",
      "record_onboarding_completion",
      "start_trial_offer_enrollment",
      "grant_trial_offer_installment",
      "process_trial_offer_installments",
      "materialize_demo_expiration_at",
      "refund_credit_at",
    ]) {
      expect(`${settings}\n${rpcs}`).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role`),
      );
    }
    expect(`${settings}\n${rpcs}`).not.toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*?TO authenticated/);
  });
});

// =============================================================================
// F50.4 — contrato estático das migrations M1/M2/M3
// =============================================================================

const f504M1 = readMigration("20261022000001_f50_4_individual_launch.sql");
const f504M2 = readMigration("20261022000002_f50_4_enrollment_identity.sql");
const f504M3 = readMigration("20261022000003_f50_4_benefit_coexistence.sql");
const f504M4 = readMigration("20261023000001_f50_4_snapshot_integrity.sql");
const f504All = `${f504M1}\n${f504M2}\n${f504M3}`;

describe("F50.4 enrollment identity SQL contract", () => {
  it("adds beneficiary snapshot and policy cohort with the canonical check", () => {
    expect(f504M2).toMatch(/ADD COLUMN IF NOT EXISTS beneficiary_cnpj_normalized TEXT/);
    expect(f504M2).toMatch(/ADD COLUMN IF NOT EXISTS policy_cohort TEXT NOT NULL DEFAULT 'root_legacy'/);
    expect(f504M2).toMatch(/beneficiary_cnpj_normalized ~ '\^\[A-Z0-9\]\{12\}\[0-9\]\{2\}\$'/);
    expect(f504M2).toMatch(/policy_cohort IN \('root_legacy','per_cnpj_f50_4'\)/);
  });

  it("enforces beneficiary/store uniqueness and a partial legacy root index", () => {
    expect(f504M2).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_offer_enrollments_beneficiary/);
    expect(f504M2).toMatch(/uq_trial_offer_enrollments_beneficiary[\s\S]*?\(beneficiary_cnpj_normalized\)/);
    expect(f504M2).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_offer_enrollments_root_legacy/);
    expect(f504M2).toMatch(/uq_trial_offer_enrollments_root_legacy[\s\S]*?WHERE policy_cohort = 'root_legacy'/);
  });

  it("does not keep a global UNIQUE(root_hash) in the F50.4 migrations", () => {
    expect(f504All).not.toMatch(/uq_trial_offer_enrollments_root UNIQUE \(root_hash\)/);
    expect(f504All).not.toMatch(/CONSTRAINT\s+\w+\s+UNIQUE\s*\(\s*root_hash\s*\)/);
    expect(f504M2).toMatch(/DROP CONSTRAINT IF EXISTS uq_trial_offer_enrollments_root/);
  });

  it("creates the identity immutability trigger", () => {
    expect(f504M2).toMatch(/CREATE OR REPLACE FUNCTION public\.trial_offer_enrollments_immutable_identity\(\)/);
    expect(f504M2).toMatch(/CREATE TRIGGER trg_trial_offer_enrollments_immutable_identity\s+BEFORE UPDATE ON public\.trial_offer_enrollments/);
    expect(f504M2).toMatch(/trial_offer_enrollment_identity_immutable/);
  });

  it("M1 writes individual_launch_at only inside the activation RPC", () => {
    const fnIndex = f504M1.indexOf(
      "CREATE OR REPLACE FUNCTION public.admin_activate_trial_offer_individual_launch",
    );
    const updateIndex = f504M1.indexOf("UPDATE public.trial_offer_settings");
    expect(fnIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(fnIndex);
    expect((f504M1.match(/UPDATE public\.trial_offer_settings/g) ?? []).length).toBe(1);
    expect((f504M1.match(/SET individual_launch_at/g) ?? []).length).toBe(1);
    expect(f504M1).not.toMatch(/UPDATE public\.trial_offer_settings\s+SET launch_at/);
  });

  it("M3 applies the root lock protocol and preserves legacy values", () => {
    expect(f504M3).toMatch(/CREATE OR REPLACE FUNCTION public\.grant_demo_credits\(/);
    expect(f504M3).toMatch(/p_ttl_hours INTEGER DEFAULT 168/);
    expect(f504M3).toMatch(/FROM public\.stores s\s+WHERE s\.id = p_store_id\s+FOR UPDATE/);
    expect(f504M3).toMatch(/pg_advisory_xact_lock\(\s*hashtextextended\('vendeo:benefit:' \|\| v_root_hash, 0\)\s*\)/);
    expect(f504M3).toMatch(/e\.policy_cohort = 'root_legacy'/);
    expect(f504M3).toMatch(/beneficiary_cnpj_normalized = v_cnpj_normalized/);
    expect(f504M3).toMatch(/p_reference_date DATE DEFAULT NULL/);
    expect(f504M3).toMatch(/ORDER BY s\.cnpj_root_hash/);
    expect(f504M3).toMatch(/v_recipient\.id FOR UPDATE[\s\S]*?pg_advisory_xact_lock/);
    expect(f504M3).toMatch(/EXCEPTION WHEN SQLSTATE 'P5040' THEN/);
    expect(f504M3).toMatch(/RAISE EXCEPTION 'f50_4_monthly_cap_reached' USING ERRCODE = 'P5040'/);
    expect(f504M3).toMatch(/skipped_new_policy_store/);
    expect(f504M3).toMatch(/skipped_trial_offer_cohort/);
    expect(f504M3).not.toMatch(/p_limit|p_cycle/);
  });

  it("M3 never redefines the out-of-scope financial functions", () => {
    for (const fn of [
      "grant_trial_offer_installment",
      "materialize_demo_expiration_at",
      "refund_credit_at",
      "admin_grant_credits",
    ]) {
      expect(f504All).not.toMatch(
        new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\b`),
      );
    }
  });

  it("restricts every F50.4 RPC to service_role", () => {
    for (const fn of [
      "admin_activate_trial_offer_individual_launch",
      "trial_offer_policy_cohort",
      "trial_offer_beneficiary_prior_benefit",
      "trial_offer_legacy_root_prior_benefit",
      "trial_offer_policy_context",
      "trial_offer_eligibility",
      "record_onboarding_completion",
      "start_trial_offer_enrollment",
      "grant_demo_credits",
      "grant_monthly_credits",
      "admin_grant_freemium_exception",
    ]) {
      expect(f504All).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*?FROM PUBLIC, anon, authenticated`),
      );
      expect(f504All).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role`),
      );
    }
    expect(f504All).not.toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*?TO authenticated/);
  });

  it("keeps F50.4 identifiers free of the CLI parser pitfall", () => {
    expect(f504All).not.toMatch(/atomic/i);
  });
});

// =============================================================================
// F50.4 — contrato estático da migration M4 (integridade do snapshot)
// =============================================================================

describe("F50.4 snapshot integrity SQL contract", () => {
  it("aborts before DDL when an enrollment snapshot diverges from its store", () => {
    const precheckIndex = f504M4.indexOf("F50_4_PRECHECK_BENEFICIARY_MISMATCH");
    const functionIndex = f504M4.indexOf(
      "CREATE OR REPLACE FUNCTION public.trial_offer_enrollments_validate_beneficiary",
    );

    expect(precheckIndex).toBeGreaterThan(-1);
    expect(functionIndex).toBeGreaterThan(precheckIndex);
    expect(f504M4).toMatch(/LEFT JOIN public\.stores s ON s\.id = e\.store_id/);
    expect(f504M4).toMatch(/s\.id IS NULL/);
    expect(f504M4).toMatch(/s\.cnpj_normalized IS NULL/);
    expect(f504M4).toMatch(
      /e\.beneficiary_cnpj_normalized IS DISTINCT FROM s\.cnpj_normalized/,
    );
  });

  it("defines a BEFORE INSERT trigger comparing the snapshot to stores.cnpj_normalized", () => {
    expect(f504M4).toMatch(
      /CREATE OR REPLACE FUNCTION public\.trial_offer_enrollments_validate_beneficiary\(\)/,
    );
    expect(f504M4).toMatch(/SET search_path = ''/);
    expect(f504M4).toMatch(/SELECT s\.cnpj_normalized/);
    expect(f504M4).toMatch(/FROM public\.stores s\s+WHERE s\.id = NEW\.store_id/);
    expect(f504M4).toMatch(
      /v_store_cnpj IS DISTINCT FROM NEW\.beneficiary_cnpj_normalized/,
    );
    expect(f504M4).toMatch(/trial_offer_enrollment_beneficiary_mismatch/);
    expect(f504M4).toMatch(
      /CREATE TRIGGER trg_trial_offer_enrollments_validate_beneficiary\s+BEFORE INSERT ON public\.trial_offer_enrollments/,
    );
  });

  it("keeps the UPDATE immutability trigger and never redefines existing columns/indexes", () => {
    expect(f504M2).toMatch(
      /CREATE TRIGGER trg_trial_offer_enrollments_immutable_identity\s+BEFORE UPDATE ON public\.trial_offer_enrollments/,
    );
    expect(f504M4).not.toMatch(/ADD COLUMN/i);
    expect(f504M4).not.toMatch(/ALTER COLUMN/i);
    expect(f504M4).not.toMatch(/CREATE (UNIQUE )?INDEX/i);
    expect(f504M4).not.toMatch(/DROP COLUMN/i);
    expect(f504M4).not.toMatch(/DROP CONSTRAINT/i);
  });

  it("restricts the trigger function to service_role", () => {
    expect(f504M4).toMatch(
      /REVOKE ALL ON FUNCTION public\.trial_offer_enrollments_validate_beneficiary\(\)\s+FROM PUBLIC, anon, authenticated/,
    );
    expect(f504M4).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.trial_offer_enrollments_validate_beneficiary\(\)\s+TO service_role/,
    );
  });
});
