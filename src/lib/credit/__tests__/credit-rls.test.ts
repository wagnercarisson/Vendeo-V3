import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("available balance access contract", () => {
  const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260920000001_f50_demo_credits.sql"), "utf8");

  it("allows authenticated balance reads without exposing service RPCs", () => {
    expect(migration).toMatch(/credit_balances[\s\S]*authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.(grant_demo_credits|reserve_credit)/);
  });

  it("keeps demo expiry materialization out of read paths", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.materialize_demo_expiration");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.reserve_credit");
    expect(migration).toMatch(/NEW\.balance := NEW\.demo_balance \+ NEW\.bonus_balance \+ NEW\.purchased_balance/);
  });
});
