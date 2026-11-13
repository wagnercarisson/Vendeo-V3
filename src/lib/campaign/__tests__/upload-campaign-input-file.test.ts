// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = {
  upload: vi.fn(),
  download: vi.fn(),
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { storage: { from: () => storage } },
}));

import {
  downloadCampaignInputFile,
  uploadCampaignInputFile,
} from "../persistence";

const BYTES = Buffer.from("original-bytes");
const PREFIX = "data:image/png;base64,";
const DATA_URL = `${PREFIX}${BYTES.toString("base64")}`;
const { createHash } = await import("node:crypto");
const CONTENT_ID = createHash("sha256").update(DATA_URL).digest("hex");

describe("campaign input durable helpers", () => {
  beforeEach(() => {
    storage.upload.mockReset();
    storage.download.mockReset();
  });

  it("uploads original bytes without transcode", async () => {
    storage.upload.mockResolvedValue({ error: null });
    const result = await uploadCampaignInputFile("s", "c", {
      contentId: CONTENT_ID,
      mimeType: "image/png",
      dataUrlPrefix: PREFIX,
      buffer: BYTES,
    });
    expect(result).toEqual({ kind: "uploaded" });
    expect(storage.upload).toHaveBeenCalledWith(
      `s/c/inputs/${CONTENT_ID}.png`,
      BYTES,
      { contentType: "image/png", upsert: false },
    );
  });

  it("reuses an existing equal object and rejects a different one", async () => {
    storage.upload.mockResolvedValue({ error: { message: "already exists" } });
    storage.download.mockResolvedValue({
      data: new Blob([BYTES]),
      error: null,
    });
    await expect(
      uploadCampaignInputFile("s", "c", {
        contentId: CONTENT_ID,
        mimeType: "image/png",
        dataUrlPrefix: PREFIX,
        buffer: BYTES,
      }),
    ).resolves.toEqual({ kind: "reused" });

    storage.download.mockResolvedValue({
      data: new Blob([Buffer.from("different")]),
      error: null,
    });
    await expect(
      uploadCampaignInputFile("s", "c", {
        contentId: CONTENT_ID,
        mimeType: "image/png",
        dataUrlPrefix: PREFIX,
        buffer: BYTES,
      }),
    ).resolves.toEqual({ kind: "conflict", reason: "content_mismatch" });
  });

  it("distinguishes absent from indeterminate on download", async () => {
    storage.download.mockResolvedValue({
      data: null,
      error: { statusCode: "404", message: "Object not found" },
    });
    await expect(downloadCampaignInputFile("p")).resolves.toEqual({ kind: "absent" });
    storage.download.mockResolvedValue({
      data: null,
      error: { statusCode: "500", message: "boom" },
    });
    await expect(downloadCampaignInputFile("p")).resolves.toEqual({ kind: "indeterminate" });
  });
});
