// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createNodeHttpDownloadTransport } from "../node-http-download";

describe("createNodeHttpDownloadTransport", () => {
  it("entrega bytes do download injetado", async () => {
    const bytes = Buffer.from("artifact-bytes");
    const transport = createNodeHttpDownloadTransport(async () => bytes);

    await expect(transport("store/campaign/op/vertical.jpg", "bucket")).resolves.toEqual({
      kind: "bytes",
      bytes,
    });
  });

  it.each([
    ["timeout", new Error("storage_download_timeout")],
    ["rede", new Error("ECONNRESET")],
    ["401", new Error("storage_download_status_401")],
    ["403", new Error("storage_download_status_403")],
    ["404 ambíguo", new Error("storage_download_status_404")],
    ["payload ambíguo", new Error("unsupported_download_payload")],
  ])("converte falha %s em indeterminate, sem lançar", async (_label, error) => {
    const transport = createNodeHttpDownloadTransport(async () => {
      throw error;
    });

    await expect(transport("path", "bucket")).resolves.toEqual({
      kind: "indeterminate",
    });
  });

  it("usa o bucket interno como default", async () => {
    const seen: { bucket: string; path: string }[] = [];
    const transport = createNodeHttpDownloadTransport(async (input) => {
      seen.push(input);
      return Buffer.from("x");
    });

    await transport("path");
    expect(seen).toEqual([
      { bucket: "campaign-internal-artifacts", path: "path" },
    ]);
  });
});
