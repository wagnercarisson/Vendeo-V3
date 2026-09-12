import { describe, it, expect } from "vitest";
import {
  MODEL_REGISTRY,
  MODEL_ALLOWLIST,
  CAPABILITY_PROTOCOLS,
  CAPABILITY_SEGMENTS,
  ALL_CAPABILITIES,
  ModelRegistry,
  validateModelConfig,
  validateRegistry,
} from "../model-registry";
import type { AiCapability, AiModelConfig, AiProvider } from "../model-resolver";

const EXPECTED_CAPABILITIES: AiCapability[] = [
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
];

describe("ModelRegistry — resolução das 11 capacidades (D1)", () => {
  const registry = new ModelRegistry();

  it("resolve as 11 capacidades com capability/segment/primary consistentes", async () => {
    for (const capability of EXPECTED_CAPABILITIES) {
      const config = await registry.resolve(capability);
      expect(config.capability).toBe(capability);
      expect(config.primary.provider).toBe("openai");
      expect(config.primary.model).toBeTruthy();
      expect(config.primary.protocol).toBeTruthy();
    }
  });

  it("defaults preservados por capacidade (baseline D5)", async () => {
    const expected: Record<AiCapability, { segment: string; model: string; protocol: string }> = {
      campaign_copy: { segment: "text", model: "gpt-4o", protocol: "chat-completions" },
      campaign_correction_analysis: { segment: "text", model: "gpt-4o", protocol: "chat-completions" },
      brand_profile_text: { segment: "text", model: "gpt-4o", protocol: "chat-completions" },
      campaign_spec: { segment: "text", model: "gpt-4o-mini", protocol: "chat-completions" },
      campaign_input_validation: { segment: "vision", model: "gpt-4o", protocol: "chat-completions" },
      campaign_image_review: { segment: "vision", model: "gpt-4o", protocol: "chat-completions" },
      brand_profile_vision: { segment: "vision", model: "gpt-4o", protocol: "chat-completions" },
      visual_signature_validation: { segment: "vision", model: "gpt-4o-mini", protocol: "responses" },
      campaign_image: { segment: "image", model: "gpt-5.5", protocol: "responses" },
      campaign_image_edit: { segment: "image", model: "gpt-image-2", protocol: "images" },
      visual_signature_image: { segment: "image", model: "gpt-5.5", protocol: "responses" },
    };

    for (const capability of EXPECTED_CAPABILITIES) {
      const config = await registry.resolve(capability);
      expect(config.segment).toBe(expected[capability].segment);
      expect(config.primary.model).toBe(expected[capability].model);
      expect(config.primary.protocol).toBe(expected[capability].protocol);
    }
  });

  it("campaign_image → responses e campaign_image_edit → images (protocolos distintos no mesmo segmento)", async () => {
    const image = await registry.resolve("campaign_image");
    const edit = await registry.resolve("campaign_image_edit");
    expect(image.primary.protocol).toBe("responses");
    expect(edit.primary.protocol).toBe("images");
    expect(image.segment).toBe("image");
    expect(edit.segment).toBe("image");
  });

  it("campaign_copy tem primary chat-completions e fallback gemini (default inicial — configuração, não regra)", async () => {
    const config = await registry.resolve("campaign_copy");
    expect(config.primary.protocol).toBe("chat-completions");
    expect(config.fallback).toEqual({
      provider: "gemini",
      model: "gemini-3.1-flash-lite",
      protocol: "gemini",
    });
  });

  it("visão mantém modelos distintos (campaign_image_review gpt-4o × visual_signature_validation gpt-4o-mini)", async () => {
    const review = await registry.resolve("campaign_image_review");
    const validation = await registry.resolve("visual_signature_validation");
    expect(review.primary.model).toBe("gpt-4o");
    expect(validation.primary.model).toBe("gpt-4o-mini");
    expect(review.primary.model).not.toBe(validation.primary.model);
  });

  it("visual_signature_validation usa responses com gpt-4o-mini", async () => {
    const config = await registry.resolve("visual_signature_validation");
    expect(config.primary.model).toBe("gpt-4o-mini");
    expect(config.primary.protocol).toBe("responses");
  });

  it("listCapabilities() retorna exatamente as 11 capacidades", () => {
    const capabilities = registry.listCapabilities();
    expect(capabilities).toHaveLength(11);
    expect([...capabilities].sort()).toEqual([...EXPECTED_CAPABILITIES].sort());
  });

  it("resolve() retorna Promise (compatível com o resolver persistido da F47)", () => {
    const result = registry.resolve("campaign_copy");
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  it("resolve de capacidade desconhecida falha explicitamente", async () => {
    await expect(registry.resolve("capacidade_inexistente" as AiCapability)).rejects.toThrow(
      /capacidade desconhecida/,
    );
  });
});

describe("ModelRegistry — allowlist e validação de alvos (D1)", () => {
  it("MODEL_ALLOWLIST é estruturada por provider → modelo → protocolos", () => {
    expect(MODEL_ALLOWLIST.openai["gpt-4o"]).toEqual(["chat-completions"]);
    expect(MODEL_ALLOWLIST.openai["gpt-4o-mini"]).toEqual(["chat-completions", "responses"]);
    expect(MODEL_ALLOWLIST.openai["gpt-5.5"]).toEqual(["responses"]);
    expect(MODEL_ALLOWLIST.openai["gpt-image-2"]).toEqual(["images"]);
    expect(MODEL_ALLOWLIST.gemini["gemini-3.1-flash-lite"]).toEqual(["gemini"]);
    expect(MODEL_ALLOWLIST.gemini["gemini-2.0-flash"]).toEqual(["gemini"]);
    // modelos de um provider não aparecem no outro
    expect(MODEL_ALLOWLIST.gemini["gpt-4o"]).toBeUndefined();
    expect(MODEL_ALLOWLIST.openai["gemini-3.1-flash-lite"]).toBeUndefined();
  });

  it("CAPABILITY_PROTOCOLS define os protocolos aceitos por capacidade", () => {
    expect(CAPABILITY_PROTOCOLS.campaign_image).toEqual(["responses"]);
    expect(CAPABILITY_PROTOCOLS.campaign_image_edit).toEqual(["images"]);
    expect(CAPABILITY_PROTOCOLS.visual_signature_validation).toEqual(["responses"]);
    expect(CAPABILITY_PROTOCOLS.campaign_copy).toEqual(["chat-completions", "gemini"]);
  });

  it("CAPABILITY_SEGMENTS cobre as 11 capacidades com o segmento canônico", () => {
    expect(Object.keys(CAPABILITY_SEGMENTS).sort()).toEqual([...EXPECTED_CAPABILITIES].sort());
    expect(CAPABILITY_SEGMENTS.campaign_copy).toBe("text");
    expect(CAPABILITY_SEGMENTS.campaign_image_review).toBe("vision");
    expect(CAPABILITY_SEGMENTS.campaign_image).toBe("image");
    expect(ALL_CAPABILITIES).toHaveLength(11);
  });

  it("aceita o registry default (nenhuma configuração inválida)", () => {
    expect(() => validateModelConfig(MODEL_REGISTRY.campaign_copy)).not.toThrow();
    expect(() => validateModelConfig(MODEL_REGISTRY.campaign_image)).not.toThrow();
    expect(() => validateModelConfig(MODEL_REGISTRY.campaign_image_edit)).not.toThrow();
  });

  it("rejeita modelo fora da allowlist", () => {
    const invalid: AiModelConfig = {
      capability: "campaign_copy",
      segment: "text",
      primary: { provider: "openai", model: "modelo-inexistente", protocol: "chat-completions" },
    };
    expect(() => validateModelConfig(invalid)).toThrow(/fora da allowlist/);
  });

  it("rejeita protocolo incompatível com o modelo", () => {
    const invalid: AiModelConfig = {
      capability: "campaign_image",
      segment: "image",
      primary: { provider: "openai", model: "gpt-image-2", protocol: "responses" },
    };
    expect(() => validateModelConfig(invalid)).toThrow(/incompatível com o modelo/);
  });

  it("rejeita protocolo incompatível com a capacidade", () => {
    const invalid: AiModelConfig = {
      capability: "campaign_image_edit",
      segment: "image",
      // gpt-5.5 aceita responses, mas campaign_image_edit só aceita images
      primary: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
    };
    expect(() => validateModelConfig(invalid)).toThrow(/incompatível com a capacidade/);
  });

  it("rejeita primary e fallback com o mesmo provider + model", () => {
    const invalid: AiModelConfig = {
      capability: "campaign_copy",
      segment: "text",
      primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
      fallback: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
    };
    expect(() => validateModelConfig(invalid)).toThrow(/alvos distintos/);
  });

  it("aceita fallback distinto (provider ou modelo diferente)", () => {
    const valid: AiModelConfig = {
      capability: "campaign_copy",
      segment: "text",
      primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
      fallback: { provider: "gemini", model: "gemini-3.1-flash-lite", protocol: "gemini" },
    };
    expect(() => validateModelConfig(valid)).not.toThrow();
  });

  it("construtor do ModelRegistry valida um mapa injetado inválido (fail-fast)", () => {
    const invalidRegistry = {
      ...MODEL_REGISTRY,
      campaign_image: {
        capability: "campaign_image" as const,
        segment: "image" as const,
        primary: { provider: "openai", model: "gpt-image-2", protocol: "responses" as const },
      },
    };
    expect(() => new ModelRegistry(invalidRegistry)).toThrow(/incompatível com o modelo/);
  });

  it("rejeita provider desconhecido (fora da allowlist)", () => {
    const invalid: AiModelConfig = {
      capability: "campaign_copy",
      segment: "text",
      primary: {
        provider: "anthropic" as AiProvider,
        model: "gpt-4o",
        protocol: "chat-completions",
      },
    };
    expect(() => validateModelConfig(invalid)).toThrow(/provider "anthropic" fora da allowlist/);
  });

  it("rejeita combinação provider/model trocada (gemini + gpt-4o)", () => {
    const invalid: AiModelConfig = {
      capability: "campaign_copy",
      segment: "text",
      primary: { provider: "gemini", model: "gpt-4o", protocol: "chat-completions" },
    };
    expect(() => validateModelConfig(invalid)).toThrow(/fora da allowlist do provider "gemini"/);
  });

  it("rejeita combinação provider/model trocada (openai + gemini-3.1-flash-lite)", () => {
    const invalid: AiModelConfig = {
      capability: "campaign_copy",
      segment: "text",
      primary: { provider: "openai", model: "gemini-3.1-flash-lite", protocol: "gemini" },
    };
    expect(() => validateModelConfig(invalid)).toThrow(/fora da allowlist do provider "openai"/);
  });

  it("rejeita segmento incompatível com a capacidade", () => {
    const invalid: AiModelConfig = {
      capability: "campaign_copy",
      segment: "image",
      primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
    };
    expect(() => validateModelConfig(invalid)).toThrow(
      /segmento "image" incompatível com a capacidade/,
    );
  });

  it("validateRegistry rejeita chave que não corresponde a config.capability", () => {
    const invalid = {
      ...MODEL_REGISTRY,
      campaign_copy: {
        ...MODEL_REGISTRY.campaign_copy,
        capability: "brand_profile_text" as const,
      },
    };
    expect(() => validateRegistry(invalid as Record<string, AiModelConfig>)).toThrow(
      /chave "campaign_copy" não corresponde/,
    );
  });

  it("validateRegistry rejeita registry sem as 11 capacidades", () => {
    const { campaign_copy: _omit, ...partial } = MODEL_REGISTRY;
    expect(() => validateRegistry(partial as Record<string, AiModelConfig>)).toThrow(
      /sem capacidades obrigatórias: campaign_copy/,
    );
  });

  it("validateRegistry rejeita capacidade extra/desconhecida", () => {
    const invalid = { ...MODEL_REGISTRY, capacidade_extra: MODEL_REGISTRY.campaign_copy };
    expect(() => validateRegistry(invalid as Record<string, AiModelConfig>)).toThrow(
      /capacidades desconhecidas: capacidade_extra/,
    );
  });

  it("construtor do ModelRegistry rejeita mapa com capacidade ausente (fail-fast)", () => {
    const { campaign_image: _omit, ...partial } = MODEL_REGISTRY;
    expect(
      () => new ModelRegistry(partial as Record<AiCapability, AiModelConfig>),
    ).toThrow(/sem capacidades obrigatórias/);
  });
});
