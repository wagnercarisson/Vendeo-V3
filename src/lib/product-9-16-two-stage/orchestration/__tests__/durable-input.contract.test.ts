// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  describeDurableInput,
  isReconstructibleDataUrl,
  reconstructDataUrl,
  verifyReconstructedInput,
} from "../durable-input";

const BYTES = Buffer.from("hello-image");
const BASE64 = BYTES.toString("base64");
const DATA_URL = `data:image/png;base64,${BASE64}`;

describe("durable input", () => {
  it("hashes the exact data URL, not the bytes", () => {
    const result = describeDurableInput({
      kind: "product",
      role: "primary",
      index: 0,
      storagePath: "s/c/inputs/hash.png",
      mimeType: "image/png",
      dataUrl: DATA_URL,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.descriptor.dataUrlPrefix).toBe("data:image/png;base64,");
    expect(result.descriptor.byteSize).toBe(BYTES.byteLength);
    expect(reconstructDataUrl(result.descriptor.dataUrlPrefix, BYTES)).toBe(DATA_URL);
    expect(verifyReconstructedInput(result.descriptor, BYTES)).toMatchObject({ ok: true });
  });

  it("rejects non-canonical or malformed data URLs", () => {
    expect(isReconstructibleDataUrl(`data:image/png;base64, ${BASE64}`)).toBe(false);
    expect(isReconstructibleDataUrl(`data:image/png;charset=utf-8;base64,${BASE64}`)).toBe(false);
    expect(isReconstructibleDataUrl("data:image/png;base64,!!!!")).toBe(false);
    expect(isReconstructibleDataUrl(DATA_URL)).toBe(true);
  });
});
