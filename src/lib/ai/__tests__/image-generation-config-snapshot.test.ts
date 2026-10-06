import { describe, expect, it } from "vitest";

import {
  IMAGE_GENERATION_CONFIG_ORIGINS,
  ImageGenerationConfigMissingError,
  ImageGenerationConfigOriginInvalidError,
  buildImageGenerationConfigSnapshot,
  resolveConfigForCorrection,
  resolveConfigForNewCampaign,
  type CurrentImageGenerationConfig,
} from "../image-generation-config-snapshot";
import type { ImageModelPairConfig } from "../image-model-pair";

const PAIR_CONFIG: ImageModelPairConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
};

const FIXED_NOW = () => "2026-10-06T00:00:00.000Z";

describe("image-generation-config-snapshot — builder tipado (F56.1 D-12)", () => {
  it("monta o snapshot com os dois pares, versão da configuração e origem", () => {
    const snapshot = buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
      campaignId: "camp-1",
      origin: "human_decision",
      configVersionId: "cfg-v1",
      now: FIXED_NOW,
    });

    expect(snapshot).toEqual({
      campaignId: "camp-1",
      primaryModel: "gpt-image-2.5-sunburst",
      primaryQuality: "medium",
      fallbackModel: "gpt-image-2",
      fallbackQuality: "medium",
      configVersionId: "cfg-v1",
      origin: "human_decision",
      createdAt: "2026-10-06T00:00:00.000Z",
    });
  });

  it("usa o gerador de versão injetável quando a configuração não traz a versão", () => {
    const snapshot = buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
      campaignId: "camp-1",
      origin: "selection",
      generateVersionId: () => "gerado",
      now: FIXED_NOW,
    });

    expect(snapshot.configVersionId).toBe("gerado");
  });

  it("aceita apenas as origens human_decision e selection — sem default", () => {
    expect([...IMAGE_GENERATION_CONFIG_ORIGINS]).toEqual(["human_decision", "selection"]);
  });

  it("rejeita a origem 'default' em runtime (fail-closed, D-12)", () => {
    expect(() =>
      buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
        campaignId: "camp-1",
        origin: "default" as never,
        now: FIXED_NOW,
      }),
    ).toThrow(ImageGenerationConfigOriginInvalidError);
  });

  it("trata a ausência de configuração como erro, não como origem (D-12)", () => {
    expect(() =>
      buildImageGenerationConfigSnapshot(null as never, {
        campaignId: "camp-1",
        origin: "selection",
        now: FIXED_NOW,
      }),
    ).toThrow(ImageGenerationConfigMissingError);
  });
});

describe("image-generation-config-snapshot — resolução por tipo de operação (F56.1 D-13)", () => {
  const currentConfig: CurrentImageGenerationConfig = {
    ...PAIR_CONFIG,
    origin: "selection",
    configVersionId: "cfg-v1",
  };

  it("nova campanha congela a configuração vigente com a sua origem e versão", () => {
    const snapshot = resolveConfigForNewCampaign(currentConfig, "camp-novo", {
      now: FIXED_NOW,
    });

    expect(snapshot.campaignId).toBe("camp-novo");
    expect(snapshot.primaryModel).toBe("gpt-image-2.5-sunburst");
    expect(snapshot.primaryQuality).toBe("medium");
    expect(snapshot.fallbackModel).toBe("gpt-image-2");
    expect(snapshot.fallbackQuality).toBe("medium");
    expect(snapshot.origin).toBe("selection");
    expect(snapshot.configVersionId).toBe("cfg-v1");
  });

  it("correção reutiliza exatamente o snapshot original, sem configuração vigente", () => {
    const original = resolveConfigForNewCampaign(currentConfig, "camp-novo", {
      now: FIXED_NOW,
    });

    const corrected = resolveConfigForCorrection(original);

    expect(corrected).toBe(original);
    expect(corrected?.configVersionId).toBe("cfg-v1");
  });
});
