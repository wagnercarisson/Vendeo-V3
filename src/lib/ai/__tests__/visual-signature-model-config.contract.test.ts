import { describe, expect, it } from "vitest";
import * as configModule from "../visual-signature-model-config";
import {
  VISUAL_SIGNATURE_CONFIG_SCOPE,
  VISUAL_SIGNATURE_ENVIRONMENT_SCOPE,
  VISUAL_SIGNATURE_EVALUATED_COMBINATIONS,
  VISUAL_SIGNATURE_IMAGE_PRESETS,
  VISUAL_SIGNATURE_ORCHESTRATORS,
  VISUAL_SIGNATURE_REASONING_EFFORT,
  VisualSignatureConfigError,
  assertVisualSignatureConfigTuple,
  resolveVisualSignaturePreset,
} from "../visual-signature-model-config";

function captureCode(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof VisualSignatureConfigError) {
      return error.code;
    }
    throw error;
  }
  throw new Error("esperado erro tipado, nenhum foi lançado");
}

const EXPECTED_PRESETS = {
  flare_low: { model: "gpt-image-2.5-flare", quality: "low" },
  flare_medium: { model: "gpt-image-2.5-flare", quality: "medium" },
  sunburst_low: { model: "gpt-image-2.5-sunburst", quality: "low" },
  sunburst_medium: { model: "gpt-image-2.5-sunburst", quality: "medium" },
} as const;

describe("F47.1 — registry puro da configuração da Assinatura Visual", () => {
  it("expõe exatamente 2 orquestradores e 4 presets fechados", () => {
    expect(VISUAL_SIGNATURE_ORCHESTRATORS).toEqual(["gpt-5.5", "gpt-6-luna"]);
    expect(Object.keys(VISUAL_SIGNATURE_IMAGE_PRESETS).sort()).toEqual(
      Object.keys(EXPECTED_PRESETS).sort(),
    );
    expect(VISUAL_SIGNATURE_IMAGE_PRESETS).toEqual(EXPECTED_PRESETS);
  });

  it("fixa reasoning=low e escopos local_validation/visual_signature", () => {
    expect(VISUAL_SIGNATURE_REASONING_EFFORT).toBe("low");
    expect(VISUAL_SIGNATURE_ENVIRONMENT_SCOPE).toBe("local_validation");
    expect(VISUAL_SIGNATURE_CONFIG_SCOPE).toBe("visual_signature");
  });

  it("não expõe preço nem default de modelo", () => {
    const exported = Object.keys(configModule);
    expect(exported.some((key) => /pric|cost|default/i.test(key))).toBe(false);
  });

  it("aceita somente as 2 combinações avaliadas", () => {
    for (const { orchestratorModel, imagePreset } of VISUAL_SIGNATURE_EVALUATED_COMBINATIONS) {
      const resolved = resolveVisualSignaturePreset(imagePreset);
      expect(() =>
        assertVisualSignatureConfigTuple({
          orchestratorModel,
          imagePreset,
          imageModel: resolved.model,
          imageQuality: resolved.quality,
          reasoningEffort: "low",
        }),
      ).not.toThrow();
    }

    for (const orchestratorModel of VISUAL_SIGNATURE_ORCHESTRATORS) {
      for (const imagePreset of Object.keys(EXPECTED_PRESETS)) {
        if (
          (orchestratorModel === "gpt-5.5" || orchestratorModel === "gpt-6-luna") &&
          imagePreset === "sunburst_medium"
        ) {
          continue;
        }
        const resolved = resolveVisualSignaturePreset(imagePreset);
        expect(
          captureCode(() =>
            assertVisualSignatureConfigTuple({
              orchestratorModel,
              imagePreset,
              imageModel: resolved.model,
              imageQuality: resolved.quality,
              reasoningEffort: "low",
            }),
          ),
        ).toBe("preset_not_evaluated");
      }
    }
  });

  it("resolve preset → modelo/qualidade sem fallback", () => {
    expect(resolveVisualSignaturePreset("flare_low")).toEqual({
      preset: "flare_low",
      model: "gpt-image-2.5-flare",
      quality: "low",
    });
    expect(resolveVisualSignaturePreset("sunburst_medium")).toEqual({
      preset: "sunburst_medium",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
  });

  it("recusa orquestrador fora do conjunto", () => {
    expect(
      captureCode(() =>
        assertVisualSignatureConfigTuple({
          orchestratorModel: "gpt-4o",
          imagePreset: "flare_low",
          imageModel: "gpt-image-2.5-flare",
          imageQuality: "low",
          reasoningEffort: "low",
        }),
      ),
    ).toBe("invalid_orchestrator");
  });

  it("recusa preset fora dos quatro, inclusive image-2-low", () => {
    expect(captureCode(() => resolveVisualSignaturePreset("image-2-low"))).toBe(
      "invalid_preset",
    );
    expect(captureCode(() => resolveVisualSignaturePreset("flare_high"))).toBe(
      "invalid_preset",
    );
    expect(
      captureCode(() =>
        assertVisualSignatureConfigTuple({
          orchestratorModel: "gpt-5.5",
          imagePreset: "image-2-low",
          imageModel: "gpt-image-2",
          imageQuality: "low",
          reasoningEffort: "low",
        }),
      ),
    ).toBe("invalid_preset");
  });

  it("recusa qualidade inválida e reasoning diferente de low", () => {
    expect(
      captureCode(() =>
        assertVisualSignatureConfigTuple({
          orchestratorModel: "gpt-5.5",
          imagePreset: "flare_low",
          imageModel: "gpt-image-2.5-flare",
          imageQuality: "auto",
          reasoningEffort: "low",
        }),
      ),
    ).toBe("invalid_image_quality");

    expect(
      captureCode(() =>
        assertVisualSignatureConfigTuple({
          orchestratorModel: "gpt-5.5",
          imagePreset: "flare_low",
          imageModel: "gpt-image-2.5-flare",
          imageQuality: "low",
          reasoningEffort: "medium",
        }),
      ),
    ).toBe("invalid_reasoning");
  });

  it("recusa divergência preset × modelo/qualidade", () => {
    expect(
      captureCode(() =>
        assertVisualSignatureConfigTuple({
          orchestratorModel: "gpt-5.5",
          imagePreset: "flare_low",
          imageModel: "gpt-image-2.5-sunburst",
          imageQuality: "low",
          reasoningEffort: "low",
        }),
      ),
    ).toBe("preset_tuple_mismatch");

    expect(
      captureCode(() =>
        assertVisualSignatureConfigTuple({
          orchestratorModel: "gpt-6-luna",
          imagePreset: "sunburst_medium",
          imageModel: "gpt-image-2.5-sunburst",
          imageQuality: "low",
          reasoningEffort: "low",
        }),
      ),
    ).toBe("preset_tuple_mismatch");

    expect(
      captureCode(() =>
        assertVisualSignatureConfigTuple({
          orchestratorModel: "gpt-5.5",
          imagePreset: "flare_low",
          imageModel: "gpt-image-2-low",
          imageQuality: "low",
          reasoningEffort: "low",
        }),
      ),
    ).toBe("preset_tuple_mismatch");
  });
});
