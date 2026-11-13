import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSignedUrl } = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({ createSignedUrl }),
    },
  },
  createServerClient: vi.fn(),
}));

import { generateBatchThumbnailUrls } from "../list";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const VERTICAL = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;
const THUMBNAIL = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.thumb-v1.webp`;

function item(storagePath: string, status: "ready" | "error" = "ready") {
  return { id: CAMPAIGN, status, storagePath };
}

beforeEach(() => {
  createSignedUrl.mockReset();
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: `https://cdn.test/${THUMBNAIL}` },
    error: null,
  });
});

describe("listagem — assinatura da miniatura (consumidor de cards)", () => {
  it("assina SOMENTE o caminho derivado da miniatura do vertical de composicao", async () => {
    const urls = await generateBatchThumbnailUrls([item(VERTICAL)]);

    expect(urls[CAMPAIGN]).toBe(`https://cdn.test/${THUMBNAIL}`);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    const [signedPath, expiresIn] = createSignedUrl.mock.calls[0];
    expect(signedPath).toBe(THUMBNAIL);
    expect(signedPath.endsWith("vertical.thumb-v1.webp")).toBe(true);
    expect(signedPath).not.toBe(VERTICAL);
    expect(signedPath).not.toContain("vertical.jpg");
    expect(expiresIn).toBe(3600);
  });

  it("original inelegivel gera placeholder e NUNCA assina o original", async () => {
    const ineligible = `${STORE}/${CAMPAIGN}/inputs/logo.png`;
    const urls = await generateBatchThumbnailUrls([item(ineligible)]);

    expect(urls[CAMPAIGN]).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("falha ao assinar a miniatura cai em placeholder, sem fallback ao original", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });

    const urls = await generateBatchThumbnailUrls([item(VERTICAL)]);

    expect(urls[CAMPAIGN]).toBeNull();
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(createSignedUrl.mock.calls[0][0]).toBe(THUMBNAIL);
  });

  it("campanha nao entregue nao tenta assinar nada", async () => {
    const urls = await generateBatchThumbnailUrls([item(VERTICAL, "error")]);

    expect(urls[CAMPAIGN]).toBeUndefined();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
