// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { readSquareReleaseListSummaries, squareReleasePresentation } from "../batch";
import { squareReleaseKey, squareReleaseMetadata } from "../identity";
import type { SquareReleaseIdentity } from "../types";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGNS = [
  "22222222-2222-4222-8222-222222222221",
  "22222222-2222-4222-8222-222222222222",
  "22222222-2222-4222-8222-222222222223",
] as const;
const OPERATIONS = [
  "33333333-3333-4333-8333-333333333331",
  "33333333-3333-4333-8333-333333333332",
  "33333333-3333-4333-8333-333333333333",
] as const;
const ARTIFACTS = [
  "44444444-4444-4444-8444-444444444441",
  "44444444-4444-4444-8444-444444444442",
  "44444444-4444-4444-8444-444444444443",
] as const;
const CHECKSUM = "a".repeat(64);
const SNAPSHOT = {
  campaignFormat: "9:16",
  formatContractVersion: "f59-vertical-9-16-v1",
};

function identity(index: number): SquareReleaseIdentity {
  return {
    storeId: STORE,
    campaignId: CAMPAIGNS[index],
    verticalOperationId: OPERATIONS[index],
    artifactId: ARTIFACTS[index],
    checksumSha256: CHECKSUM,
  };
}

function fakeClient(options: {
  readonly deductions?: readonly Record<string, unknown>[];
  readonly refunds?: readonly Record<string, unknown>[];
  readonly errorTable?: string;
}) {
  let fromCalls = 0;
  let creditQueries = 0;
  const client = {
    from(table: string) {
      fromCalls += 1;
      if (table === "credit_transactions") creditQueries += 1;
      const result = () => {
        if (options.errorTable === table) return { data: null, error: { message: "boom" } };
        if (table === "product_9_16_two_stage_operations") {
          return {
            data: CAMPAIGNS.map((campaignId, index) => ({
              campaign_id: campaignId,
              operation_id: OPERATIONS[index],
            })),
            error: null,
          };
        }
        if (table === "campaign_composition_artifacts") {
          return {
            data: CAMPAIGNS.map((campaignId, index) => ({
              campaign_id: campaignId,
              operation_id: OPERATIONS[index],
              id: ARTIFACTS[index],
              checksum_sha256: CHECKSUM,
            })),
            error: null,
          };
        }
        if (table === "credit_transactions") {
          return { data: null, error: null };
        }
        return { data: [], error: null };
      };
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = chain;
      builder.in = chain;
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
        if (table === "credit_transactions") {
          const isRefundQuery = creditQueries > 1;
          return Promise.resolve({
            data: isRefundQuery ? (options.refunds ?? []) : (options.deductions ?? []),
            error: options.errorTable === table ? { message: "boom" } : null,
          }).then(resolve, reject);
        }
        return Promise.resolve(result()).then(resolve, reject);
      };
      return builder;
    },
    get fromCalls() {
      return fromCalls;
    },
  };
  return client;
}

describe("liberação do quadrado — leitura em lote", () => {
  it("3 campanhas ⇒ 4 consultas, sem Storage e sem N+1", async () => {
    const deduction = {
      id: "55555555-5555-4555-8555-555555555555",
      type: "deduction",
      amount: -1,
      campaign_id: CAMPAIGNS[0],
      idempotency_key: squareReleaseKey(identity(0)),
      metadata: squareReleaseMetadata(identity(0)),
    };
    const client = fakeClient({ deductions: [deduction] });

    const result = await readSquareReleaseListSummaries(
      {
        storeId: STORE,
        campaigns: CAMPAIGNS.map((id) => ({ id, input_snapshot: SNAPSHOT })),
      },
      { client: client as never },
    );

    expect(client.fromCalls).toBe(4);
    expect(result.get(CAMPAIGNS[0])?.state).toBe("delivered");
    expect(result.get(CAMPAIGNS[1])?.state).toBe("eligible");
    expect(result.get(CAMPAIGNS[2])?.state).toBe("eligible");
    expect(squareReleasePresentation(result.get(CAMPAIGNS[0]))).toEqual({
      format: "1:1",
      state: "delivered",
    });
    expect(squareReleasePresentation(result.get(CAMPAIGNS[1]))).toBeNull();
  });

  it("refund na dedução ⇒ refunded", async () => {
    const deduction = {
      id: "55555555-5555-4555-8555-555555555555",
      type: "deduction",
      amount: -1,
      campaign_id: CAMPAIGNS[0],
      idempotency_key: squareReleaseKey(identity(0)),
      metadata: squareReleaseMetadata(identity(0)),
    };
    const client = fakeClient({
      deductions: [deduction],
      refunds: [{ id: "66666666-6666-4666-8666-666666666666", reference: deduction.id }],
    });

    const result = await readSquareReleaseListSummaries(
      {
        storeId: STORE,
        campaigns: CAMPAIGNS.map((id) => ({ id, input_snapshot: SNAPSHOT })),
      },
      { client: client as never },
    );

    expect(result.get(CAMPAIGNS[0])).toMatchObject({
      state: "refunded",
      refunded: true,
    });
  });

  it("falha de leitura ⇒ unknown, sem inventar entrega", async () => {
    const client = fakeClient({ errorTable: "credit_transactions" });
    const result = await readSquareReleaseListSummaries(
      {
        storeId: STORE,
        campaigns: [{ id: CAMPAIGNS[0], input_snapshot: SNAPSHOT }],
      },
      { client: client as never },
    );
    expect(result.get(CAMPAIGNS[0])?.state).toBe("unknown");
  });
});
