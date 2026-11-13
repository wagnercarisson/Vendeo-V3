// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { identityReferenceId } from "../identity-id";

const DATA_URL = "data:image/png;base64,AAAA";
const BYTES_HASH = createHash("sha256").update("bytes").digest("hex");
const DATA_URL_HASH = createHash("sha256").update(DATA_URL).digest("hex");

describe("identityReferenceId", () => {
  it("uses the exact data URL hash for 9:16 and the bytes hash for 1:1", () => {
    expect(
      identityReferenceId({
        format: "9:16",
        contentId: BYTES_HASH,
        dataUrl: DATA_URL,
      }),
    ).toBe(DATA_URL_HASH);
    expect(
      identityReferenceId({
        format: "1:1",
        contentId: BYTES_HASH,
        dataUrl: DATA_URL,
      }),
    ).toBe(BYTES_HASH);
    expect(DATA_URL_HASH).not.toBe(BYTES_HASH);
  });
});
