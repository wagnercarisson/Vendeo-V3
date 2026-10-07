import { describe, expect, it } from "vitest";

import {
  buildImageGenerationConfigSnapshot,
  resolveConfigForCorrection,
} from "../image-generation-config-snapshot";
import type { ImageModelPairConfig } from "../image-model-pair";

const ORIGINAL_PAIR: ImageModelPairConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
};

describe("image-generation-config-snapshot — reuso original (F56.2a D-16/D-17)", () => {
  it("reutiliza exatamente o snapshot original, apesar da configuração vigente mudar", () => {
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

    const reused = resolveConfigForCorrection(original);

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
