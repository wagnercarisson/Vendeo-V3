import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("F47 effective diagnostic labels", () => {
  it("does not use static image defaults for diagnostics", () => {
    const imageService = read("src/lib/image-generation/services/image-generation-service.ts");
    const visualSignature = read("src/lib/visual-signature/server-actions.ts");
    const benchmark = read("scripts/benchmark.ts");

    expect(imageService).not.toContain("DEFAULT_IMAGE_MODEL");
    expect(imageService).toContain("currentModel ?? effectiveImageModel");
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
