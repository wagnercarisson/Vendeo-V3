// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createSignedUrls: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: h.createSignedUrl,
        createSignedUrls: h.createSignedUrls,
      }),
    },
  },
}));

import { generateBatchPreferredThumbnailUrls } from "@/lib/campaign/list";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F60.7 C3 — assinatura em lote das miniaturas conjuntas", () => {
  it("assina todos os caminhos em UMA chamada e mapeia por id", async () => {
    h.createSignedUrls.mockResolvedValue({
      data: [
        {
          path: "store/c1/op/square_original.thumb-v1.webp",
          signedUrl: "https://signed/square",
          error: null,
        },
        {
          path: "store/c2/op/vertical.thumb-v1.webp",
          signedUrl: "https://signed/vertical",
          error: null,
        },
      ],
      error: null,
    });

    const result = await generateBatchPreferredThumbnailUrls([
      {
        id: "c1",
        preferredThumbnailPath: "store/c1/op/square_original.thumb-v1.webp",
      },
      {
        id: "c2",
        preferredThumbnailPath: "store/c2/op/vertical.thumb-v1.webp",
      },
      {
        // Mesmo caminho de c1: não deve gerar assinatura duplicada.
        id: "c3",
        preferredThumbnailPath: "store/c1/op/square_original.thumb-v1.webp",
      },
      { id: "c4", preferredThumbnailPath: null },
    ]);

    expect(h.createSignedUrl).not.toHaveBeenCalled();
    expect(h.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(h.createSignedUrls).toHaveBeenCalledWith(
      [
        "store/c1/op/square_original.thumb-v1.webp",
        "store/c2/op/vertical.thumb-v1.webp",
      ],
      3600,
    );
    expect(result).toEqual({
      c1: "https://signed/square",
      c2: "https://signed/vertical",
      c3: "https://signed/square",
      c4: null,
    });
  });

  it("path ausente ou falha de assinatura ⇒ placeholder, sem original", async () => {
    h.createSignedUrls.mockResolvedValue({ data: null, error: { message: "x" } });

    const result = await generateBatchPreferredThumbnailUrls([
      { id: "c1", preferredThumbnailPath: "store/c1/op/vertical.thumb-v1.webp" },
      { id: "c2", preferredThumbnailPath: null },
    ]);

    expect(result).toEqual({ c1: null, c2: null });
  });
});
