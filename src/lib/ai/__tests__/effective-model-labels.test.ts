import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { effectiveModelLabel } from "../effective-model-label";
import { PersistedModelResolver } from "../persisted-model-resolver";
import { ModelRegistry } from "../model-registry";
import { catalogTupleKey } from "../ai-model-catalog-service";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("F47 effective diagnostic labels", () => {
  it("prefers returned model, falls back to resolved target on errors/absence", () => {
    expect(effectiveModelLabel("gpt-image-2", "gpt-5.5")).toBe("gpt-image-2");
    expect(effectiveModelLabel(undefined, "gpt-5.5")).toBe("gpt-5.5");
    expect(effectiveModelLabel(undefined, "gpt-image-2")).toBe("gpt-image-2");
  });

  it("liga override persistido ao label efetivo diagnosticado", async () => {
    const selection = {
      id: "selection", capability: "campaign_image", provider: "openai", model: "custom-image", protocol: "responses",
      fallback_provider: null, fallback_model: null, fallback_protocol: null, reason: "test", updated_by: null, updated_at: "",
    } as const;
    const catalog = {
      id: "catalog", capability: "campaign_image", segment: "image", provider: "openai", model: "custom-image", protocol: "responses", status: "active",
      label: null, source_note: null, validated_at: null, created_at: "", updated_at: "",
    } as const;
    const resolver = new PersistedModelResolver({
      registry: new ModelRegistry(),
      selectionService: { getSelectionMap: async () => new Map([["campaign_image", selection as never]]) },
      catalogService: { getCatalogMap: async () => new Map([[catalogTupleKey("campaign_image", "openai", "custom-image", "responses"), catalog as never]]) },
    });
    const resolved = await resolver.resolve("campaign_image");
    expect(effectiveModelLabel(undefined, resolved.primary.model)).toBe("custom-image");
  });

  it("does not use static image defaults for diagnostics", () => {
    const imageService = read("src/lib/image-generation/services/image-generation-service.ts");
    const visualSignature = read("src/lib/visual-signature/server-actions.ts");
    const benchmark = read("scripts/benchmark.ts");

    expect(imageService).not.toContain("DEFAULT_IMAGE_MODEL");
    expect(imageService).toContain("effectiveModelLabel(currentModel");
    expect(visualSignature).not.toContain("VISUAL_SIGNATURE_IMAGE_MODEL");
    expect(visualSignature).toContain('.resolve("visual_signature_image")');
    expect(benchmark).not.toContain("MODEL_REGISTRY.campaign_image.primary");
    expect(benchmark).toContain('defaultAiModelResolver.resolve("campaign_image")');
  });

  it("preserva a capacidade independente de edição de imagem", () => {
    const registry = read("src/lib/ai/model-registry.ts");
    expect(registry).toContain('campaign_image_edit:');
    expect(registry).toContain('protocol: "images"');
  });
});
