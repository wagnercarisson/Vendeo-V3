import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("credit ledger linear invariants", () => {
  it("syncs total balance from the three buckets and records before/after", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260920000001_f50_demo_credits.sql"), "utf8");
    expect(migration).toContain("NEW.balance := NEW.demo_balance + NEW.bonus_balance + NEW.purchased_balance");
    expect(migration).toContain("balance_before");
    expect(migration).toContain("balance_after");
    expect(migration).toMatch(/type.*expiration[\s\S]*amount.*< 0|expiration.*-1/i);
  });
});
