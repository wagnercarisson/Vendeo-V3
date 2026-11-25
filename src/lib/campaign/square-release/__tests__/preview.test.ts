// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ retrieve: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/retrieve", () => ({
  retrieveCompositionArtifact: h.retrieve,
}));

import { readSquareReleasePreview } from "../preview";

beforeEach(() => {
  h.retrieve.mockReset();
  h.retrieve.mockResolvedValue({
    kind: "integral",
    artifact: {
      storagePath: "store/campaign/op/square_original.jpg",
      mimeType: "image/jpeg",
    },
    bytes: Buffer.from("square"),
  });
});

function client() {
  return {
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://signed/square" },
          error: null,
        }),
      }),
    },
  };
}

describe("preview do quadrado pago", () => {
  it("injeta transporte Node HTTP no probe binário e usa a rota de download autenticada", async () => {
    const result = await readSquareReleasePreview(
      {
        storeId: "store",
        campaignId: "campaign",
        verticalOperationId: "operation",
      },
      { client: client() as never },
    );

    expect(result).toEqual({
      previewUrl: "https://signed/square",
      downloadUrl: "/api/campaign/campaign/download?format=1:1",
    });
    expect(h.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ role: "square_original" }),
      }),
      expect.objectContaining({
        downloadBytes: expect.any(Function),
      }),
    );
  });

  it("falha do probe não inventa URL e não cai para outro formato", async () => {
    h.retrieve.mockResolvedValue({ kind: "absent" });
    const result = await readSquareReleasePreview(
      {
        storeId: "store",
        campaignId: "campaign",
        verticalOperationId: "operation",
      },
      { client: client() as never },
    );
    expect(result).toBeNull();
  });
});
