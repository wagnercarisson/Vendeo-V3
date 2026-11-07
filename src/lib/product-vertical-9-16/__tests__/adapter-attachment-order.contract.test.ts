// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { UpstreamImagesAdapter } from "@/lib/ai/adapters/upstream-images";
import type { AiModelTarget } from "@/lib/ai/model-resolver";

const TARGET: AiModelTarget = {
  provider: "openai",
  model: "gpt-image-2.5-sunburst",
  protocol: "images",
};

describe("F59 — ordem real dos anexos no adapter de imagem", () => {
  it("envia produto, referências e ativo de identidade por último", async () => {
    const fileNames: string[] = [];
    let wireImage: unknown = null;
    const loadSdk = vi.fn(async () => ({
      client: {
        images: {
          edit: vi.fn(async (params: { image: unknown }) => {
            wireImage = params.image;
            return { data: [{ b64_json: "IMG" }] };
          }),
        },
      },
      toFile: vi.fn(async (_data: unknown, name: string) => {
        fileNames.push(name);
        return { name };
      }),
    }));

    await new UpstreamImagesAdapter(loadSdk as never).invoke(
      {
        prompt: "p",
        quality: "medium",
        productImagesDataUrls: [
          "data:image/png;base64,PRIMARY",
          "data:image/png;base64,REF",
        ],
        identityImageUrl: "data:image/png;base64,IDENTITY",
      },
      TARGET,
    );

    expect(fileNames).toEqual(["product.png", "reference-1.png", "identity.png"]);
    expect(wireImage).toHaveLength(3);
  });

  it("sem ativo, envia somente produto e referências", async () => {
    const fileNames: string[] = [];
    const loadSdk = vi.fn(async () => ({
      client: {
        images: {
          edit: vi.fn(async () => ({ data: [{ b64_json: "IMG" }] })),
        },
      },
      toFile: vi.fn(async (_data: unknown, name: string) => {
        fileNames.push(name);
        return { name };
      }),
    }));

    await new UpstreamImagesAdapter(loadSdk as never).invoke(
      {
        prompt: "p",
        quality: "medium",
        productImagesDataUrls: ["data:image/png;base64,PRIMARY"],
      },
      TARGET,
    );

    expect(fileNames).toEqual(["product.png"]);
  });
});
