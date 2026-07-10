// @vitest-environment node
import { describe, it, expect } from "vitest";
// No mocks needed — validatePublicationCopy is pure logic

describe("validatePublicationCopy", () => {
  it("accepts valid body", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const result = validatePublicationCopy({
      caption: "Texto promocional",
      hashtags: ["#tag", "#oferta"],
      cta_post: "Compre agora",
    });

    expect(result.valid).toBe(true);
    if (result.valid && !("restore" in result.data)) {
      expect(result.data.caption).toBe("Texto promocional");
      expect(result.data.hashtags).toEqual(["#tag", "#oferta"]);
      expect(result.data.cta_post).toBe("Compre agora");
    }
  });

  it("accepts restore: true", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const result = validatePublicationCopy({ restore: true });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect((result.data as { restore: true }).restore).toBe(true);
    }
  });

  it("rejects caption > 2200 chars", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const result = validatePublicationCopy({
      caption: "x".repeat(2201),
      hashtags: ["#tag"],
      cta_post: "x",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const captionIssue = result.issues.find((i) => i.field === "caption");
      expect(captionIssue).toBeDefined();
      expect(captionIssue!.code).toBe("too_long");
    }
  });

  it("rejects hashtag without # prefix", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const result = validatePublicationCopy({
      caption: "x",
      hashtags: ["tag"],
      cta_post: "x",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const hashtagIssue = result.issues.find((i) => i.field === "hashtags[0]");
      expect(hashtagIssue).toBeDefined();
      expect(hashtagIssue!.code).toBe("invalid_format");
    }
  });

  it("rejects > 30 hashtags", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const hashtags = Array.from({ length: 31 }, (_, i) => `#tag${i}`);
    const result = validatePublicationCopy({
      caption: "x",
      hashtags,
      cta_post: "x",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const tooManyIssue = result.issues.find((i) => i.field === "hashtags" && i.code === "too_many");
      expect(tooManyIssue).toBeDefined();
    }
  });

  it("rejects hashtag with space", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const result = validatePublicationCopy({
      caption: "x",
      hashtags: ["#minha tag"],
      cta_post: "x",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const hashtagIssue = result.issues.find((i) => i.field === "hashtags[0]");
      expect(hashtagIssue).toBeDefined();
      expect(hashtagIssue!.code).toBe("invalid_format");
    }
  });

  it("rejects cta_post > 200 chars", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const result = validatePublicationCopy({
      caption: "x",
      hashtags: ["#tag"],
      cta_post: "x".repeat(201),
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const ctaIssue = result.issues.find((i) => i.field === "cta_post");
      expect(ctaIssue).toBeDefined();
      expect(ctaIssue!.code).toBe("too_long");
    }
  });

  it("accepts Portuguese accented hashtags", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const result = validatePublicationCopy({
      caption: "Pão Francês",
      hashtags: ["#pãofrancêskg", "#çafé", "#ótimo"],
      cta_post: "Compre",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects empty body", async () => {
    const { validatePublicationCopy } = await import("@/lib/campaign/publication-copy");
    const result = validatePublicationCopy({});

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const bodyIssue = result.issues.find((i) => i.field === "body");
      expect(bodyIssue).toBeDefined();
      expect(bodyIssue!.code).toBe("invalid_body");
    }
  });
});
