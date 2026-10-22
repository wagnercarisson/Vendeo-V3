// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

const { mockPersist } = vi.hoisted(() => ({ mockPersist: vi.fn() }));

vi.mock("../persistence", () => ({
  persistSignature: mockPersist,
}));

import { parseCreativeIntent } from "../creative-intent";
import { StoreIdentityArtDirectorService } from "../identity-art-director";

const BASE_INPUT = {
  storeId: "store-1",
  storeName: "Loja Teste",
  segment: "moda",
  subsegment: null,
  tone_of_voice: "profissional",
  positioning: null,
  short_description: null,
  slogan: null,
  city: null,
  state: null,
  brandColor: null,
};

describe("F47.1 - identity art director: rejectionContext e brandColor", () => {
  it("preserva o feedback do lojista e o fallback de brandColor no prompt", async () => {
    const promptLoader = { load: vi.fn().mockReturnValue("prompt-final") };
    const creativeIntent = parseCreativeIntent(
      JSON.stringify({
        visual_direction: "Minimalista",
        content_used: { store_name: true, city: false, state: false, slogan: false },
      }),
    );
    const aiImageGenerator = {
      generate: vi.fn().mockResolvedValue({
        tier: "image_direct",
        assetUrl: "https://example.test/asset.png",
        storagePath: "store-1/asset.png",
        mimeType: "image/png",
        prompt: "prompt-final",
        metadata: { generation_tier: "image_direct" },
        creativeIntent,
      }),
    };
    mockPersist.mockImplementation(async (input) => ({
      id: "sig-1",
      ...input,
      metadata: input.metadata,
    }));

    const service = new StoreIdentityArtDirectorService({
      promptLoader: promptLoader as never,
      aiImageGenerator: aiImageGenerator as never,
    });

    await service.generate({
      ...BASE_INPUT,
      rejectionContext: { reason: "Use azul e fonte mais grossa", attempt: 1 },
    });

    // rejectionContext é histórico: a operação atual começa em attempt=0.
    expect(aiImageGenerator.generate.mock.calls[0][0]).toMatchObject({
      attempt: 0,
    });
    expect(promptLoader.load).toHaveBeenCalledWith(
      "store-identity-art-director",
      expect.objectContaining({
        brandColor:
          "NÃO DEFINIDA (Escolha uma paleta coerente com o segmento)",
        rejectionContext: expect.stringContaining("Use azul e fonte mais grossa"),
      }),
    );
    expect(promptLoader.load.mock.calls[0][1].rejectionContext).toContain(
      "PRIORIDADE MÁXIMA",
    );

    const persisted = mockPersist.mock.calls.at(-1)![0];
    expect(persisted.metadata).toMatchObject({
      creative_intent_parse_status: "parsed_json",
      creative_intent_source: "model",
      artDirectorOutput: { visual_direction: "Minimalista" },
    });
  });

  it("sem rejectionContext não inventa feedback e mantém o prompt normal", async () => {
    const promptLoader = { load: vi.fn().mockReturnValue("prompt-final") };
    const creativeIntent = parseCreativeIntent(undefined);
    const aiImageGenerator = {
      generate: vi.fn().mockResolvedValue({
        tier: "image_direct",
        assetUrl: "https://example.test/asset.png",
        storagePath: "store-1/asset.png",
        mimeType: "image/png",
        prompt: "prompt-final",
        metadata: { generation_tier: "image_direct" },
        creativeIntent,
      }),
    };
    mockPersist.mockImplementation(async (input) => ({ id: "sig-2", ...input }));

    const service = new StoreIdentityArtDirectorService({
      promptLoader: promptLoader as never,
      aiImageGenerator: aiImageGenerator as never,
    });

    await service.generate({ ...BASE_INPUT, brandColor: "#112233" });

    // Primeira tentativa do Diretor de Arte é attempt=0 (image_direct).
    expect(aiImageGenerator.generate.mock.calls[0][0]).toMatchObject({
      attempt: 0,
    });
    const vars = promptLoader.load.mock.calls[0][1];
    expect(vars.brandColor).toBe("#112233");
    expect(vars.rejectionContext).toBe("");
    expect(mockPersist.mock.calls.at(-1)![0].metadata).toMatchObject({
      creative_intent_parse_status: "no_json",
      creative_intent_source: "fallback",
      artDirectorOutput: { visual_direction: "Personalizada" },
    });
  });
});
