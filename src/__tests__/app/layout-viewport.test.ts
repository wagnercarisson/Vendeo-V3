// @vitest-environment node
import { describe, it, expect } from "vitest";
import { viewport } from "@/app/layout";

describe("layout viewport export", () => {
  it("emits width=device-width, initialScale=1 and themeColor", () => {
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect(viewport.themeColor).toBe("#0F172A");
  });
});