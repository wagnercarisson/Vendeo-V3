import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260920000001_f50_demo_credits.sql"), "utf8");

describe("F50 credit RPC database contract", () => {
  it("defines the demo grant and expiration RPCs with the fail-closed invariants", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.grant_demo_credits\(/);
    expect(migration).toMatch(/p_demo_grant_enabled BOOLEAN/);
    expect(migration).toMatch(/reason.*disabled/);
    expect(migration).toMatch(/reason.*onboarding_consumed/);
    expect(migration).toMatch(/reason.*already_granted/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.materialize_demo_expiration\(/);
    expect(migration).toMatch(/FOR UPDATE/);
    expect(migration).toMatch(/origin_demo_grant_tx_id.*NÃO|origin_demo_grant_tx_id/);
  });

  it("defines consumption/refund order and temporal grace metadata", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.reserve_credit\(/);
    expect(migration).toMatch(/demo_amount/);
    expect(migration).toMatch(/bonus_amount/);
    expect(migration).toMatch(/purchased_amount/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.refund_credit\(/);
    expect(migration).toMatch(/24 hours|24h|INTERVAL '24 hours'/i);
    expect(migration).toMatch(/demo_cycle_id/);
    expect(migration).toMatch(/origin_demo_grant_tx_id/);
  });

  it("keeps wrappers single-signature, service-role-only, and admin creation grant-free", () => {
    for (const fn of ["create_store_with_cnpj", "update_store_cnpj", "admin_approve_store_verification", "admin_exception_store_verification", "create_store_with_initial_grant", "admin_create_store_for_user"]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
    }
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.grant_demo_credits/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.grant_demo_credits[\s\S]*service_role/i);
    expect(migration).toMatch(/admin_create_store_for_user[\s\S]{0,12000}without.*credit|admin_create_store_for_user[\s\S]{0,12000}grant_demo_credits/i);
  });
});
