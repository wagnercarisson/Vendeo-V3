import { describe, expect, it } from "vitest";
import {
  VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT,
  VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION,
  VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN,
  VISUAL_SIGNATURE_IMAGE_USAGE_SIZE,
  getVisualSignatureImageUsageEstimate,
} from "../visual-signature-image-usage";

const CASES = [
  ["gpt-image-2.5-flare", "low", 350, 250],
  ["gpt-image-2.5-flare", "medium", 350, 500],
  ["gpt-image-2.5-sunburst", "low", 400, 250],
  ["gpt-image-2.5-sunburst", "medium", 400, 500],
] as const;

describe("getVisualSignatureImageUsageEstimate — tabela aprovada vs-image-usage-v1", () => {
  it.each(CASES)(
    "%s/%s em 1024x1024 → %i entrada textual + %i saída de imagem",
    (imageModel, imageQuality, inputTextTokens, outputImageTokens) => {
      const estimate = getVisualSignatureImageUsageEstimate({
        imageModel,
        imageQuality,
        size: "1024x1024",
      });

      expect(estimate).toEqual({
        model: imageModel,
        quality: imageQuality,
        size: VISUAL_SIGNATURE_IMAGE_USAGE_SIZE,
        inputTextTokens,
        outputImageTokens,
        version: VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION,
        approvedAt: VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT,
        origin: VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN,
      });
    },
  );

  it("não cobre tamanho diferente de 1024x1024", () => {
    expect(
      getVisualSignatureImageUsageEstimate({
        imageModel: "gpt-image-2.5-flare",
        imageQuality: "low",
        size: "512x512",
      }),
    ).toBeNull();
  });

  it("não cobre modelo ou qualidade desconhecidos (sem herdar outra opção)", () => {
    expect(
      getVisualSignatureImageUsageEstimate({
        imageModel: "gpt-image-2",
        imageQuality: "low",
        size: "1024x1024",
      }),
    ).toBeNull();
    expect(
      getVisualSignatureImageUsageEstimate({
        imageModel: "gpt-image-2.5-flare",
        imageQuality: "high",
        size: "1024x1024",
      }),
    ).toBeNull();
  });

  it("a versão e a origem identificam a observação manual, não medição automática", () => {
    const estimate = getVisualSignatureImageUsageEstimate({
      imageModel: "gpt-image-2.5-sunburst",
      imageQuality: "medium",
      size: "1024x1024",
    });
    expect(estimate?.version).toBe("vs-image-usage-v1");
    expect(estimate?.approvedAt).toBe("2026-10-26");
    expect(estimate?.origin).toBe(
      "manual_observation_openai_platform_with_rounding_and_margin",
    );
  });
});
