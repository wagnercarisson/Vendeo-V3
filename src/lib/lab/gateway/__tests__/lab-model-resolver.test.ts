import { describe, it, expect, vi } from "vitest";

import { LabModelResolver, INVALID_FIXED_TARGET } from "../lab-model-resolver";
import type { LabModelResolverParams } from "../lab-model-resolver";
import type {
  AiCapability,
  AiModelConfig,
  AiModelResolver,
  AiModelTarget,
} from "@/lib/ai/model-resolver";

/**
 * F48.1 (D6/D18/T-48-1-33) — resolver laboratorial com alvo fixo.
 */

const FIXED_TARGET: AiModelTarget = {
  provider: "openai",
  model: "gpt-5.5",
  protocol: "responses",
};

function createFallbackResolver() {
  const resolve = vi.fn(
    async (capability: AiCapability): Promise<AiModelConfig> => ({
      capability,
      segment: capability === "campaign_copy" ? "text" : "vision",
      primary: { provider: "gemini", model: "gemini-2.5-flash", protocol: "gemini" },
      fallback: { provider: "openai", model: "gpt-4o-mini", protocol: "chat-completions" },
    }),
  );
  const listCapabilities = vi.fn((): AiCapability[] => ["campaign_copy", "campaign_image_review"]);

  return { resolve, listCapabilities } as unknown as AiModelResolver & {
    resolve: ReturnType<typeof vi.fn>;
    listCapabilities: ReturnType<typeof vi.fn>;
  };
}

function createResolver(params?: Partial<LabModelResolverParams>): {
  resolver: LabModelResolver;
  fallbackResolver: ReturnType<typeof createFallbackResolver>;
} {
  const fallbackResolver = createFallbackResolver();
  const resolver = new LabModelResolver({
    fixedTarget: FIXED_TARGET,
    fallbackResolver,
    ...params,
  });
  return { resolver, fallbackResolver };
}

describe("LabModelResolver — alvo fixo com precedência (F48.1, D6)", () => {
  it("resolve('campaign_image') devolve exatamente o fixedTarget injetado", async () => {
    const { resolver } = createResolver();

    const config = await resolver.resolve("campaign_image");

    expect(config.capability).toBe("campaign_image");
    expect(config.segment).toBe("image");
    expect(config.primary).toEqual({
      provider: FIXED_TARGET.provider,
      model: FIXED_TARGET.model,
      protocol: FIXED_TARGET.protocol,
    });
  });

  it("resolve('campaign_image') não expõe alvo alternativo (fallback undefined)", async () => {
    const { resolver } = createResolver();

    const config = await resolver.resolve("campaign_image");

    expect(config.fallback).toBeUndefined();
  });

  it("o resolver padrão NUNCA é consultado para campaign_image", async () => {
    const { resolver, fallbackResolver } = createResolver();

    await resolver.resolve("campaign_image");

    expect(fallbackResolver.resolve).not.toHaveBeenCalled();
  });

  it("resolve('campaign_image_review') delega ao resolver padrão (read-only)", async () => {
    const { resolver, fallbackResolver } = createResolver();

    const config = await resolver.resolve("campaign_image_review");

    expect(fallbackResolver.resolve).toHaveBeenCalledTimes(1);
    expect(fallbackResolver.resolve).toHaveBeenCalledWith("campaign_image_review");
    expect(config.primary).toEqual({
      provider: "gemini",
      model: "gemini-2.5-flash",
      protocol: "gemini",
    });
  });

  it("resolve('campaign_copy') delega ao resolver padrão", async () => {
    const { resolver, fallbackResolver } = createResolver();

    const config = await resolver.resolve("campaign_copy");

    expect(fallbackResolver.resolve).toHaveBeenCalledWith("campaign_copy");
    expect(config.segment).toBe("text");
  });

  it("listCapabilities() delega ao resolver padrão", () => {
    const { resolver, fallbackResolver } = createResolver();

    expect(resolver.listCapabilities()).toEqual(["campaign_copy", "campaign_image_review"]);
    expect(fallbackResolver.listCapabilities).toHaveBeenCalledTimes(1);
  });

  it("fixedTarget com provider/model/protocolo vazios lança invalid_fixed_target", async () => {
    const { resolver } = createResolver({
      fixedTarget: { provider: "", model: "", protocol: "" } as unknown as AiModelTarget,
    });

    await expect(resolver.resolve("campaign_image")).rejects.toThrow(INVALID_FIXED_TARGET);
  });

  it("fixedTarget ausente lança invalid_fixed_target", async () => {
    const { resolver } = createResolver({
      fixedTarget: undefined as unknown as AiModelTarget,
    });

    await expect(resolver.resolve("campaign_image")).rejects.toThrow(INVALID_FIXED_TARGET);
  });
});
