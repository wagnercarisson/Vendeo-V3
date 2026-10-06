import { describe, it, expect } from "vitest";
import {
  ELIGIBLE_IMAGE_MODELS,
  ELIGIBLE_IMAGE_QUALITIES,
  INITIAL_IMAGE_MODEL_PAIR,
  IMAGE_MODEL_PAIR_NOT_ELIGIBLE,
  ImageModelPairNotEligibleError,
  assertEligibleModelPair,
  isEligibleImageModel,
  isEligibleImageQuality,
} from "../image-model-pair";
import {
  AiInvocationError,
  normalizeAiError,
  type AiCallEnvelope,
  type AiInvocationErrorKind,
} from "../types";

describe("image-model-pair — catálogo elegível fechado (F56.1 D-02)", () => {
  it("congela exatamente os três modelos elegíveis", () => {
    expect([...ELIGIBLE_IMAGE_MODELS]).toEqual([
      "gpt-image-2",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ]);
  });

  it("congela exatamente as qualidades low/medium", () => {
    expect([...ELIGIBLE_IMAGE_QUALITIES]).toEqual(["low", "medium"]);
  });

  it("isEligibleImageModel/isEligibleImageQuality reconhecem apenas o catálogo", () => {
    expect(isEligibleImageModel("gpt-image-2")).toBe(true);
    expect(isEligibleImageModel("gpt-image-2.5-sunburst")).toBe(true);
    expect(isEligibleImageModel("dall-e-3")).toBe(false);
    expect(isEligibleImageQuality("low")).toBe(true);
    expect(isEligibleImageQuality("medium")).toBe(true);
    expect(isEligibleImageQuality("high")).toBe(false);
  });
});

describe("image-model-pair — validação fail-closed (F56.1 D-06)", () => {
  it("aceita o par principal sunburst/medium e o fallback gpt-image-2/medium", () => {
    expect(() =>
      assertEligibleModelPair({ model: "gpt-image-2.5-sunburst", quality: "medium" }),
    ).not.toThrow();
    expect(() => assertEligibleModelPair({ model: "gpt-image-2", quality: "medium" })).not.toThrow();
  });

  it("rejeita modelo fora da lista com erro de código determinístico", () => {
    try {
      assertEligibleModelPair({ model: "dall-e-3", quality: "medium" });
      throw new Error("deveria ter rejeitado modelo fora do catálogo");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageModelPairNotEligibleError);
      expect((error as ImageModelPairNotEligibleError).code).toBe(IMAGE_MODEL_PAIR_NOT_ELIGIBLE);
      expect((error as ImageModelPairNotEligibleError).field).toBe("model");
    }
  });

  it("rejeita qualidade fora da lista com erro de código determinístico", () => {
    try {
      assertEligibleModelPair({ model: "gpt-image-2", quality: "high" as never });
      throw new Error("deveria ter rejeitado qualidade fora do catálogo");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageModelPairNotEligibleError);
      expect((error as ImageModelPairNotEligibleError).code).toBe(IMAGE_MODEL_PAIR_NOT_ELIGIBLE);
      expect((error as ImageModelPairNotEligibleError).field).toBe("quality");
    }
  });
});

describe("image-model-pair — escolha inicial como decisão humana (F56.1 D-03)", () => {
  it("registra o par inicial aprovado pelo responsável", () => {
    expect(INITIAL_IMAGE_MODEL_PAIR.primary).toEqual({
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
    expect(INITIAL_IMAGE_MODEL_PAIR.fallback).toEqual({
      model: "gpt-image-2",
      quality: "medium",
    });
  });

  it("expõe origem human_decision e nenhuma flag de ativação verdadeira", () => {
    expect(INITIAL_IMAGE_MODEL_PAIR.origin).toBe("human_decision");
    expect(INITIAL_IMAGE_MODEL_PAIR.active).toBe(false);
    expect(INITIAL_IMAGE_MODEL_PAIR.production).toBe(false);
  });
});

describe("normalizeAiError — taxonomia quota/billing e envelope (F56.1 D-15/D-21)", () => {
  const kindOf = (err: unknown): AiInvocationErrorKind | undefined =>
    err instanceof AiInvocationError ? err.kind : undefined;
  const retryableOf = (err: unknown): boolean | undefined =>
    err instanceof AiInvocationError ? err.retryable : undefined;

  it("code insufficient_quota normaliza para kind quota, retryable=false", () => {
    const err = normalizeAiError({
      code: "insufficient_quota",
      message: "You exceeded your current quota",
    });
    expect(kindOf(err)).toBe("quota");
    expect(retryableOf(err)).toBe(false);
  });

  it("code billing_hard_limit_reached normaliza para kind billing, retryable=false", () => {
    const err = normalizeAiError({
      code: "billing_hard_limit_reached",
      message: "Billing hard limit reached",
    });
    expect(kindOf(err)).toBe("billing");
    expect(retryableOf(err)).toBe(false);
  });

  it("sinal de faturamento na mensagem normaliza para kind billing", () => {
    const err = normalizeAiError({
      code: "account_deactivated",
      message: "Your account is deactivated due to billing",
    });
    expect(kindOf(err)).toBe("billing");
    expect(retryableOf(err)).toBe(false);
  });

  it("429 genérico sem sinal de quota/faturamento permanece rate_limit retryable=true", () => {
    const err = normalizeAiError({ status: 429, message: "Too many requests, slow down" });
    expect(kindOf(err)).toBe("rate_limit");
    expect(retryableOf(err)).toBe(true);
  });

  it("envelope aceita quality/target/attemptNumber sem quebrar os campos existentes", () => {
    const envelope: AiCallEnvelope = {
      capability: "campaign_product_image",
      protocol: "images",
      status: "success",
      provider: "openai",
      model: "gpt-image-2",
      durationMs: 1234,
      quality: "medium",
      target: "primary",
      attemptNumber: 2,
    };
    expect(envelope.quality).toBe("medium");
    expect(envelope.target).toBe("primary");
    expect(envelope.attemptNumber).toBe(2);
    expect(envelope.provider).toBe("openai");
    expect(envelope.model).toBe("gpt-image-2");
    expect(envelope.status).toBe("success");
  });
});
