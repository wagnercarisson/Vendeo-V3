import { describe, expect, it } from "vitest";
import {
  MODEL_ALLOWLIST,
  MODEL_REGISTRY,
  isModelAllowedForCapability,
  validateModelConfig,
} from "../model-registry";
import type { AiCapability, AiProtocol } from "../model-resolver";

const lunaResponses = {
  provider: "openai" as const,
  model: "gpt-6-luna",
  protocol: "responses" as const,
};

const ALL_CAPABILITIES: AiCapability[] = [
  "campaign_copy",
  "campaign_correction_analysis",
  "brand_profile_text",
  "campaign_spec",
  "campaign_input_validation",
  "campaign_image_review",
  "brand_profile_vision",
  "visual_signature_validation",
  "campaign_image",
  "campaign_image_edit",
  "visual_signature_image",
  "campaign_product_image",
];

describe("F47.1 — allowlist restrita de gpt-6-luna/responses", () => {
  it("preserva chat-completions e adiciona responses de forma aditiva", () => {
    const protocols: readonly AiProtocol[] = MODEL_ALLOWLIST.openai["gpt-6-luna"];
    expect(protocols).toContain("chat-completions");
    expect(protocols).toContain("responses");
  });

  it("aceita gpt-6-luna/responses SOMENTE em visual_signature_image", () => {
    expect(isModelAllowedForCapability("visual_signature_image", lunaResponses)).toBe(
      true,
    );
    for (const capability of ALL_CAPABILITIES) {
      if (capability === "visual_signature_image") continue;
      expect(isModelAllowedForCapability(capability, lunaResponses)).toBe(false);
    }
  });

  it("recusa explicitamente campaign_image e visual_signature_validation", () => {
    expect(isModelAllowedForCapability("campaign_image", lunaResponses)).toBe(false);
    expect(
      isModelAllowedForCapability("visual_signature_validation", lunaResponses),
    ).toBe(false);
  });

  it("gpt-6-luna/chat-completions continua aceito nas capacidades de texto/visão", () => {
    const chat = {
      provider: "openai" as const,
      model: "gpt-6-luna",
      protocol: "chat-completions" as const,
    };
    expect(isModelAllowedForCapability("brand_profile_text", chat)).toBe(true);
    expect(isModelAllowedForCapability("brand_profile_vision", chat)).toBe(true);
    expect(isModelAllowedForCapability("campaign_copy", chat)).toBe(true);
  });

  it("defaults não mudam: visual_signature_image segue gpt-5.5/responses", () => {
    expect(MODEL_REGISTRY.visual_signature_image.primary).toEqual({
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
    });
    expect(() => validateModelConfig(MODEL_REGISTRY.visual_signature_image)).not.toThrow();
    expect(MODEL_REGISTRY.campaign_image.primary).toEqual({
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
    });
  });

  it("registry default continua válido (nenhum default usa Luna/responses)", () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(() => validateModelConfig(MODEL_REGISTRY[capability])).not.toThrow();
    }
  });

  it("uma config injetada com Luna/responses em campaign_image é recusada", () => {
    expect(() =>
      validateModelConfig({
        capability: "campaign_image",
        segment: "image",
        primary: lunaResponses,
      }),
    ).toThrow(/não autorizada/);
  });
});
