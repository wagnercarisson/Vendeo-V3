// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import { vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

function fakeClient(rows: Record<string, unknown>) {
  return {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        then(resolve: (value: { data: unknown; error: null }) => void) {
          resolve({ data: Array.isArray(rows[table]) ? rows[table] : [], error: null });
        },
      };
      return builder;
    },
    rpc() {
      throw new Error("rpc must not be called by getOperationView");
    },
  } as never;
}

const operation = { campaign_id: "c", operation_id: "o", origin: "9_16_two_stage" };
const steps = [
  { stage: "base", status: "done", attempts_used: 1, failure_class: null, updated_at: null },
  { stage: "expansion", status: "pending", attempts_used: 0, failure_class: null, updated_at: null },
];
const claims = [{ stage: "base", attempt_number: 1, created_at: null }];

describe("getOperationView", () => {
  it("returns found and maps step state", async () => {
    const client = new ProductTwoStageOperationClient(
      fakeClient({
        product_9_16_two_stage_operations: operation,
        product_9_16_two_stage_steps: steps,
        product_9_16_two_stage_attempt_claims: claims,
        product_9_16_two_stage_outcomes: null,
        product_1_1_campaign_credit_operations: { status: "reserved" },
      }),
    );
    const result = await client.getOperationView({ campaignId: "c", operationId: "o" });
    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.view.base.status).toBe("done");
    expect(result.view.nextAction).toBe("acquire_expansion");
    expect(result.view.credit.reserved).toBe(true);
  });

  it("returns absent for missing operation", async () => {
    const client = new ProductTwoStageOperationClient(
      fakeClient({
        product_9_16_two_stage_operations: null,
      }),
    );
    await expect(
      client.getOperationView({ campaignId: "c", operationId: "o" }),
    ).resolves.toEqual({ kind: "absent" });
  });
});
