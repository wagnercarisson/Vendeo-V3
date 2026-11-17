// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ProductTwoStageOperationClient } from "../two-stage-operation-client";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

interface FakeOptions {
  readonly rows: Record<string, unknown>;
  readonly error?: { message: string } | null;
}

function fakeClient(options: FakeOptions) {
  const selects: Array<{ table: string; columns: string }> = [];
  return {
    selects,
    client: {
      from(table: string) {
        const builder = {
          select(columns: string) {
            selects.push({ table, columns });
            return builder;
          },
          eq() {
            return builder;
          },
          order() {
            return builder;
          },
          maybeSingle: async () => ({
            data: options.rows[table] ?? null,
            error: options.error ?? null,
          }),
          then(resolve: (value: { data: unknown; error: null }) => void) {
            resolve({
              data: Array.isArray(options.rows[table]) ? options.rows[table] : [],
              error: null,
            });
          },
        };
        return builder;
      },
      rpc() {
        throw new Error("rpc must not be called by getOperationView");
      },
    } as never,
  };
}

const steps = [
  { stage: "base", status: "done", attempts_used: 1, failure_class: null, updated_at: null },
  { stage: "expansion", status: "pending", attempts_used: 0, failure_class: null, updated_at: null },
];
const claims = [{ stage: "base", attempt_number: 1, created_at: null }];

const FROZEN_SELECTION = {
  model: "gpt-image-2.5-flare",
  quality: "medium",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
} as const;

function rowsWithOperation(operation: Record<string, unknown>): Record<string, unknown> {
  return {
    product_9_16_two_stage_operations: operation,
    product_9_16_two_stage_steps: steps,
    product_9_16_two_stage_attempt_claims: claims,
    product_9_16_two_stage_outcomes: null,
    product_1_1_campaign_credit_operations: { status: "reserved" },
  };
}

const V1_OPERATION = {
  campaign_id: "c",
  operation_id: "o",
  origin: "9_16_two_stage",
  contract_version: 1,
  expansion_model: null,
  expansion_quality: null,
  expansion_config_version_id: null,
  expansion_selection_origin: null,
};

const V2_OPERATION = {
  ...V1_OPERATION,
  contract_version: 2,
  expansion_model: FROZEN_SELECTION.model,
  expansion_quality: FROZEN_SELECTION.quality,
  expansion_config_version_id: FROZEN_SELECTION.configVersionId,
  expansion_selection_origin: "configured",
};

describe("getOperationView", () => {
  it("projeta contract_version e a seleção congelada com select explícito", async () => {
    const fake = fakeClient({ rows: rowsWithOperation(V2_OPERATION) });
    const client = new ProductTwoStageOperationClient(fake.client);
    const result = await client.getOperationView({ campaignId: "c", operationId: "o" });

    const operationSelect = fake.selects.find(
      (entry) => entry.table === "product_9_16_two_stage_operations",
    );
    expect(operationSelect).toBeDefined();
    expect(operationSelect?.columns).not.toBe("*");
    for (const column of [
      "contract_version",
      "expansion_model",
      "expansion_quality",
      "expansion_config_version_id",
      "expansion_selection_origin",
    ]) {
      expect(operationSelect?.columns).toContain(column);
    }

    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.view.contractVersion).toBe(2);
    expect(result.view.frozenSelection).toEqual({
      model: FROZEN_SELECTION.model,
      quality: FROZEN_SELECTION.quality,
      configVersionId: FROZEN_SELECTION.configVersionId,
      origin: "configured",
    });
  });

  it("mapeia estado das etapas e ação durável", async () => {
    const fake = fakeClient({ rows: rowsWithOperation(V1_OPERATION) });
    const client = new ProductTwoStageOperationClient(fake.client);
    const result = await client.getOperationView({ campaignId: "c", operationId: "o" });
    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.view.base.status).toBe("done");
    expect(result.view.nextAction).toBe("acquire_expansion");
    expect(result.view.credit.reserved).toBe(true);
    expect(result.view.contractVersion).toBe(1);
    expect(result.view.frozenSelection).toBeNull();
  });

  it("v2 incompleta/invalida falha fechado sem promover a legado", async () => {
    for (const patch of [
      { expansion_model: null },
      { expansion_quality: "high" },
      { expansion_config_version_id: null },
      { expansion_selection_origin: "legacy_sunburst_low" },
      { expansion_config_version_id: "not-a-uuid" },
    ]) {
      const fake = fakeClient({
        rows: rowsWithOperation({ ...V2_OPERATION, ...patch }),
      });
      const client = new ProductTwoStageOperationClient(fake.client);
      const result = await client.getOperationView({ campaignId: "c", operationId: "o" });
      expect(result.kind).toBe("found");
      if (result.kind !== "found") return;
      expect(result.view.contractVersion).toBe(2);
      expect(result.view.frozenSelection).toBeNull();
    }
  });

  it("contract_version ausente/inválida é read_failed, nunca v1", async () => {
    for (const patch of [{ contract_version: undefined }, { contract_version: 3 }]) {
      const fake = fakeClient({
        rows: rowsWithOperation({ ...V1_OPERATION, ...patch }),
      });
      const client = new ProductTwoStageOperationClient(fake.client);
      await expect(
        client.getOperationView({ campaignId: "c", operationId: "o" }),
      ).resolves.toEqual({ kind: "read_failed", reason: "invalid_contract_version" });
    }
  });

  it("returns absent for missing operation", async () => {
    const fake = fakeClient({
      rows: { product_9_16_two_stage_operations: null },
    });
    const client = new ProductTwoStageOperationClient(fake.client);
    await expect(
      client.getOperationView({ campaignId: "c", operationId: "o" }),
    ).resolves.toEqual({ kind: "absent" });
  });

  it("erro de leitura vira read_failed, nunca absent", async () => {
    const fake = fakeClient({
      rows: { product_9_16_two_stage_operations: null },
      error: { message: "db_offline" },
    });
    const client = new ProductTwoStageOperationClient(fake.client);
    await expect(
      client.getOperationView({ campaignId: "c", operationId: "o" }),
    ).resolves.toEqual({ kind: "read_failed", reason: "db_offline" });
  });
});
