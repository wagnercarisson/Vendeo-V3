import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("F50 support protocol contract", () => {
  it("returns durable protocol/receivedAt from the atomic RPC", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/support/credit-request/route.ts"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260921000001_f50_support_credit_request_rpc.sql"), "utf8");
    expect(route).toMatch(/protocol: result\.protocol/);
    expect(route).toMatch(/receivedAt: result\.received_at/);
    expect(migration).toMatch(/support_ack/);
    expect(migration).toMatch(/support_notice/);
    expect(migration).toMatch(/received_at/);
  });

  it("keeps manual reconsideration auditable and does not create an appeal system", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/admin/support-credit-requests/route.ts"), "utf8");
    expect(route).toMatch(/reconsiderEligible: z\.boolean\(\)\.optional/);
    expect(route).toMatch(/update_support_credit_request/);
    const rpc = readFileSync(resolve(process.cwd(), "supabase/migrations/20260924000002_f50_support_status_rpc.sql"), "utf8");
    expect(rpc).toMatch(/admin_audit_log/);
    expect(rpc).toMatch(/SECURITY DEFINER/);
  });
});
