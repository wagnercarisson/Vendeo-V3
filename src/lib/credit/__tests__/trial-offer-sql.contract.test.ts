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
