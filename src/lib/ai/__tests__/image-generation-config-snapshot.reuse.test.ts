import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildImageGenerationConfigSnapshot,
  resolveConfigForCorrection,
} from "../image-generation-config-snapshot";
import { SupabaseImageGenerationOperationsRepository } from "../image-generation-operations-repository";
import type { ImageModelPairConfig } from "../image-model-pair";

const ORIGINAL_PAIR: ImageModelPairConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
};

describe("image-generation-config-snapshot — reuso original (F56.2a D-16/D-17)", () => {
  it("reutiliza o snapshot original e preserva run/trace após registrar outra tentativa", async () => {
    const original = buildImageGenerationConfigSnapshot(ORIGINAL_PAIR, {
      campaignId: "campaign-original",
      origin: "human_decision",
      configVersionId: "original-config-version",
      runId: "11111111-1111-4111-8111-111111111111",
      traceId: "original-trace",
      now: () => "2026-10-06T00:00:00.000Z",
    });
    const historicalReferences = { runId: original.runId, traceId: original.traceId };
    const currentConfiguration = {
      primary: { model: "gpt-image-2", quality: "low" as const },
      fallback: { model: "gpt-image-2.5-sunburst", quality: "low" as const },
      configVersionId: "new-current-version",
    };
    const insertedAttempts: Record<string, unknown>[] = [];
    const client = {
      from: () => ({
        insert(values: Record<string, unknown>) {
          insertedAttempts.push(values);
          return {
            select: () => ({
              single: async () => ({
                data: { id: "operation-attempt-2", operation_id: "operation-2" },
                error: null,
              }),
            }),
          };
        },
      }),
    } as unknown as SupabaseClient;
    const repository = new SupabaseImageGenerationOperationsRepository(client);

    await repository.recordOperation({
      campaignId: original.campaignId,
      snapshotOriginalId: "snapshot-original-id",
      operationId: "operation-2",
      attemptNumber: 2,
      target: "fallback",
      model: "gpt-image-2.5-sunburst",
      quality: "low",
      runId: "22222222-2222-4222-8222-222222222222",
      traceId: "new-attempt-trace",
    });

    const reused = resolveConfigForCorrection(original);

    expect(insertedAttempts).toHaveLength(1);
    expect(insertedAttempts[0]).toMatchObject({
      campaign_id: original.campaignId,
      snapshot_original_id: "snapshot-original-id",
      operation_id: "operation-2",
      run_id: "22222222-2222-4222-8222-222222222222",
      trace_id: "new-attempt-trace",
    });
    expect(reused).toBe(original);
    expect(reused?.primaryModel).toBe(ORIGINAL_PAIR.primary.model);
    expect(reused?.primaryQuality).toBe(ORIGINAL_PAIR.primary.quality);
    expect(reused?.configVersionId).toBe("original-config-version");
    expect(reused?.primaryModel).not.toBe(currentConfiguration.primary.model);
    expect({ runId: reused?.runId, traceId: reused?.traceId }).toEqual(historicalReferences);
    expect(original.runId).toBe("11111111-1111-4111-8111-111111111111");
    expect(original.traceId).toBe("original-trace");
  });

  it("retorna null para operações legadas sem snapshot sem lançar", () => {
    expect(() => resolveConfigForCorrection(null)).not.toThrow();
    expect(() => resolveConfigForCorrection(undefined)).not.toThrow();
    expect(resolveConfigForCorrection(null)).toBeNull();
    expect(resolveConfigForCorrection(undefined)).toBeNull();
  });
});
