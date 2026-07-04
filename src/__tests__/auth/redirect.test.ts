import { describe, it, expect } from "vitest";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

describe("sanitizeRedirectPath", () => {
  it("allows /campaign/preview", () => {
    expect(sanitizeRedirectPath("/campaign/preview")).toBe("/campaign/preview");
  });

  it("preserves query string", () => {
    expect(sanitizeRedirectPath("/campaign/preview?foo=bar")).toBe(
      "/campaign/preview?foo=bar",
    );
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeRedirectPath("//evil.com")).toBe("/");
  });

  it("rejects backslashes", () => {
    expect(sanitizeRedirectPath("\\evil")).toBe("/");
  });

  it("rejects /campaign-evil (prefix match not startsWith)", () => {
    expect(sanitizeRedirectPath("/campaign-evil")).toBe("/");
  });

  it("rejects /login", () => {
    expect(sanitizeRedirectPath("/login")).toBe("/");
  });

  it("discards fragments", () => {
    expect(sanitizeRedirectPath("/campaign/preview#section")).toBe(
      "/campaign/preview",
    );
  });

  it("returns / for empty string", () => {
    expect(sanitizeRedirectPath("")).toBe("/");
  });
});
