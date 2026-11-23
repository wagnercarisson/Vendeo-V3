// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatAdditionPresentation,
  readFormatAdditionListSummaries,
} from "../format-addition/list-summary";

interface QueryResult {
  readonly data: unknown[] | null;
  readonly error: { message: string } | null;
}

function fakeClient(tables: Record<string, QueryResult>) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(table);
      const result = tables[table] ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      query.select = () => query;
      query.in = () => query;
      query.eq = () => query;
      query.order = () => query;
      query.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result).then(resolve);
      return query;
    },
  };
  return { client: client as never, calls };
}

const STORE = "11111111-1111-4111-8111-111111111111";

function campaign(id: string, snapshot: Record<string, unknown> = {}) {
  return { id, input_snapshot: snapshot };
}

function addition(
  campaignId: string,
  operationId: string,
  status: "open" | "delivered" | "refunded",
  sourceOrigin: "new_flow_1_1" | "legacy_campaign" = "new_flow_1_1",
) {
  return {
    campaign_id: campaignId,
    operation_id: operationId,
    source_origin: sourceOrigin,
    status,
    created_at: "2026-11-23T12:00:00.000Z",
  };
}

const verticalArtifact = (operationId: string) => ({
  operation_id: operationId,
  role: "vertical",
  format: "9:16",
  width: 1080,
  height: 1920,
  mime_type: "image/jpeg",
  storage_path: `${operationId}/vertical.jpg`,
});

describe("F62-06 — leitura em lote das adições", () => {
  it("faz três consultas constantes e deriva estados sanitizados", async () => {
    const tables = {
      campaign_format_additions: {
        data: [
          addition("c1", "op1", "delivered"),
          addition("c2", "op2", "open"),
          addition("c3", "op3", "refunded"),
          addition("c4", "op4", "delivered"),
        ],
        error: null,
      },
      product_1_1_campaign_credit_operations: {
        data: [
          { operation_id: "op1", status: "delivered" },
          { operation_id: "op2", status: "reserved" },
          { operation_id: "op3", status: "refunded" },
          { operation_id: "op4", status: "delivered" },
        ],
        error: null,
      },
      campaign_composition_artifacts: {
        data: [verticalArtifact("op1")],
        error: null,
      },
    };
    const { client, calls } = fakeClient(tables);
    const result = await readFormatAdditionListSummaries({
      client,
      storeId: STORE,
      campaigns: [campaign("c1"), campaign("c2"), campaign("c3"), campaign("c4"), campaign("c5")],
    });

    expect(calls).toEqual([
      "campaign_format_additions",
      "product_1_1_campaign_credit_operations",
      "campaign_composition_artifacts",
    ]);
    expect(result.get("c1")).toMatchObject({ state: "delivered" });
    expect(result.get("c2")).toMatchObject({ state: "processing" });
    expect(result.get("c3")).toMatchObject({
      state: "absent",
      refunded: true,
    });
    expect(result.get("c4")).toMatchObject({ state: "unknown" });
    expect(result.has("c5")).toBe(false);
    expect(result.get("c1")?.preferredThumbnailPath).toBeNull();
  });

  it("mantém a mesma contagem de consultas com 1 ou 3 adições", async () => {
    const base = {
      product_1_1_campaign_credit_operations: {
        data: [{ operation_id: "op1", status: "delivered" }],
        error: null,
      },
      campaign_composition_artifacts: {
        data: [verticalArtifact("op1")],
        error: null,
      },
    };
    const one = fakeClient({
      ...base,
      campaign_format_additions: {
        data: [addition("c1", "op1", "delivered")],
        error: null,
      },
    });
    await readFormatAdditionListSummaries({
      client: one.client,
      storeId: STORE,
      campaigns: [campaign("c1"), campaign("c2"), campaign("c3")],
    });

    const three = fakeClient({
      ...base,
      campaign_format_additions: {
        data: [
          addition("c1", "op1", "delivered"),
          addition("c2", "op2", "delivered"),
          addition("c3", "op3", "delivered"),
        ],
        error: null,
      },
    });
    await readFormatAdditionListSummaries({
      client: three.client,
      storeId: STORE,
      campaigns: [campaign("c1"), campaign("c2"), campaign("c3")],
    });

    expect(one.calls).toHaveLength(3);
    expect(three.calls).toHaveLength(3);
  });

  it("leitura de crédito indisponível vira unknown, nunca ausência", async () => {
    const { client } = fakeClient({
      campaign_format_additions: {
        data: [addition("c1", "op1", "open")],
        error: null,
      },
      product_1_1_campaign_credit_operations: {
        data: null,
        error: { message: "down" },
      },
      campaign_composition_artifacts: { data: [], error: null },
    });
    const result = await readFormatAdditionListSummaries({
      client,
      storeId: STORE,
      campaigns: [campaign("c1")],
    });
    expect(result.get("c1")).toMatchObject({ state: "unknown" });
  });

  it("converte o summary em apresentação segura", () => {
    const summary = {
      campaignId: "c1",
      operationId: "op1",
      state: "absent" as const,
      sourceOrigin: "legacy_campaign" as const,
      refunded: true,
      preferredThumbnailPath: null,
    };
    expect(formatAdditionPresentation(summary)).toEqual({
      format: "9:16",
      state: "absent",
      refunded: true,
    });
  });
});
