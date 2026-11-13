import { describe, expect, it } from "vitest";
import { deriveThumbnailPath } from "../thumbnail/thumbnail-path";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";

describe("listagem — miniatura do vertical de composição", () => {
  it("deriva a miniatura a partir do path do vertical (nunca o original)", () => {
    const vertical = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;
    expect(deriveThumbnailPath(vertical)).toBe(
      `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.thumb-v1.webp`,
    );
  });
});
