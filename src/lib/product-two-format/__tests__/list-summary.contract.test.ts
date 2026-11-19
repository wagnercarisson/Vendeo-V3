// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { readTwoFormatListSummaries } from "../list-summary";

const STORE = "11111111-1111-4111-8111-111111111111";

function jointSnapshot() {
  return {
    campaignFormat: "1:1+9:16",
    formatContractVersion: "f60.7-two-format-v1",
    generationOrigin: "two_format_two_stage",
    generationContractVersion: "f60.7-two-format-v1",
  };
}

function chain(rows: unknown[]) {
  const query: Record<string, unknown> = {};
  query.select = () => query;
  query.in = () => query;
  query.eq = () => query;
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return query;
}

describe("F60.7 C3 — leitura em lote", () => {
  it("quantidade de consultas é constante e independente do número de cards", async () => {
    const campaignCount = 12;
    const campaigns = Array.from({ length: campaignCount }, (_, index) => ({
      id: `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`,
      input_snapshot: jointSnapshot(),
    }));
    const operations = campaigns.map((campaign, index) => ({
      campaign_id: campaign.id,
      operation_id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
      store_id: STORE,
    }));
    const links = operations.flatMap((operation) => [
      {
        campaign_id: operation.campaign_id,
        operation_id: operation.operation_id,
        store_id: STORE,
        format: "1:1",
        delivery_operation_id: `44444444-4444-4444-8444-${operation.operation_id.slice(-12)}`,
        artifact_role: "square_original",
        created_at: "2026-11-19T00:00:00.000Z",
      },
      {
        campaign_id: operation.campaign_id,
        operation_id: operation.operation_id,
        store_id: STORE,
        format: "9:16",
        delivery_operation_id: operation.operation_id,
        artifact_role: "vertical",
        created_at: "2026-11-19T00:00:00.000Z",
      },
    ]);
    const credits = links.map((link) => ({
      campaign_id: link.campaign_id,
      operation_id: link.delivery_operation_id,
      store_id: STORE,
      status: "delivered",
    }));
    const artifacts = operations.flatMap((operation) => [
      {
        campaign_id: operation.campaign_id,
        operation_id: operation.operation_id,
        role: "square_original",
        format: "1:1",
        width: 1024,
        height: 1024,
        mime_type: "image/jpeg",
        artifact_path: `${STORE}/${operation.campaign_id}/${operation.operation_id}/square_original.jpg`,
      },
      {
        campaign_id: operation.campaign_id,
        operation_id: operation.operation_id,
        role: "vertical",
        format: "9:16",
        width: 1080,
        height: 1920,
        mime_type: "image/jpeg",
        artifact_path: `${STORE}/${operation.campaign_id}/${operation.operation_id}/vertical.jpg`,
      },
    ]);
    const from = vi.fn((table: string) => {
      if (table === "product_9_16_two_stage_operations") return chain(operations);
      if (table === "product_two_format_deliveries") return chain(links);
      if (table === "product_1_1_campaign_credit_operations") return chain(credits);
      if (table === "campaign_composition_artifacts") return chain(artifacts);
      return chain([]);
    });
    const client = { from } as never;

    const summaries = await readTwoFormatListSummaries({
      client,
      storeId: STORE,
      campaigns,
    });

    expect(from).toHaveBeenCalledTimes(4);
    expect(summaries.size).toBe(campaignCount);
    for (const summary of summaries.values()) {
      expect(summary.preferredFormat).toBe("1:1");
      expect(summary.preferredThumbnailPath).toContain("square_original.thumb");
      expect(summary.formats).toEqual({
        "1:1": "delivered",
        "9:16": "delivered",
      });
    }
  });

  it("apenas vertical entregue ⇒ vertical é o preferido", async () => {
    const campaign = {
      id: "22222222-2222-4222-8222-222222222222",
      input_snapshot: jointSnapshot(),
    };
    const operationId = "33333333-3333-4333-8333-333333333333";
    const from = vi.fn((table: string) => {
      if (table === "product_9_16_two_stage_operations") {
        return chain([{ campaign_id: campaign.id, operation_id: operationId, store_id: STORE }]);
      }
      if (table === "product_two_format_deliveries") {
        return chain([
          {
            campaign_id: campaign.id,
            operation_id: operationId,
            store_id: STORE,
            format: "1:1",
            delivery_operation_id: "44444444-4444-4444-8444-444444444444",
            artifact_role: "square_original",
            created_at: "2026-11-19T00:00:00.000Z",
          },
          {
            campaign_id: campaign.id,
            operation_id: operationId,
            store_id: STORE,
            format: "9:16",
            delivery_operation_id: operationId,
            artifact_role: "vertical",
            created_at: "2026-11-19T00:00:00.000Z",
          },
        ]);
      }
      if (table === "product_1_1_campaign_credit_operations") {
        return chain([
          { campaign_id: campaign.id, operation_id: "44444444-4444-4444-8444-444444444444", store_id: STORE, status: "refunded" },
          { campaign_id: campaign.id, operation_id: operationId, store_id: STORE, status: "delivered" },
        ]);
      }
      if (table === "campaign_composition_artifacts") {
        return chain([
          {
            campaign_id: campaign.id,
            operation_id: operationId,
            role: "vertical",
            format: "9:16",
            width: 1080,
            height: 1920,
            mime_type: "image/jpeg",
            artifact_path: `${STORE}/${campaign.id}/${operationId}/vertical.jpg`,
          },
        ]);
      }
      return chain([]);
    });

    const summaries = await readTwoFormatListSummaries({
      client: { from } as never,
      storeId: STORE,
      campaigns: [campaign],
    });
    const summary = summaries.get(campaign.id);
    expect(summary?.formats).toEqual({ "1:1": "absent", "9:16": "delivered" });
    expect(summary?.preferredFormat).toBe("9:16");
    expect(summary?.preferredThumbnailPath).toContain("vertical.thumb");
  });

  it("entregue + unknown preserva o entregue e não empresta arte ao indeterminado", async () => {
    const campaign = {
      id: "22222222-2222-4222-8222-333333333333",
      input_snapshot: jointSnapshot(),
    };
    const operationId = "33333333-3333-4333-8333-444444444444";
    const squareOperationId = "44444444-4444-4444-8444-555555555555";
    const from = vi.fn((table: string) => {
      if (table === "product_9_16_two_stage_operations") {
        return chain([
          { campaign_id: campaign.id, operation_id: operationId, store_id: STORE },
        ]);
      }
      if (table === "product_two_format_deliveries") {
        return chain([
          {
            campaign_id: campaign.id,
            operation_id: operationId,
            store_id: STORE,
            format: "1:1",
            delivery_operation_id: squareOperationId,
            artifact_role: "square_original",
            created_at: "2026-11-19T00:00:00.000Z",
          },
          {
            campaign_id: campaign.id,
            operation_id: operationId,
            store_id: STORE,
            format: "9:16",
            delivery_operation_id: operationId,
            artifact_role: "vertical",
            created_at: "2026-11-19T00:00:00.000Z",
          },
        ]);
      }
      if (table === "product_1_1_campaign_credit_operations") {
        return chain([
          {
            campaign_id: campaign.id,
            operation_id: squareOperationId,
            store_id: STORE,
            status: "delivered",
          },
          {
            campaign_id: campaign.id,
            operation_id: operationId,
            store_id: STORE,
            status: "delivered",
          },
        ]);
      }
      if (table === "campaign_composition_artifacts") {
        return chain([
          {
            campaign_id: campaign.id,
            operation_id: operationId,
            role: "square_original",
            format: "1:1",
            width: 1024,
            height: 1024,
            mime_type: "image/jpeg",
            artifact_path: `${STORE}/${campaign.id}/${operationId}/square_original.jpg`,
          },
        ]);
      }
      return chain([]);
    });

    const summaries = await readTwoFormatListSummaries({
      client: { from } as never,
      storeId: STORE,
      campaigns: [campaign],
    });
    const summary = summaries.get(campaign.id);
    expect(summary?.formats).toEqual({ "1:1": "delivered", "9:16": "unknown" });
    expect(summary?.preferredFormat).toBe("1:1");
    expect(summary?.preferredThumbnailPath).toContain("square_original.thumb");
  });
});
