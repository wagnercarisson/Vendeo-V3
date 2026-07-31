import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { ChangelogFrontmatterSchema } from "../schema";

const validFrontmatter = {
  id: "fase-30-legal-foundation",
  title: "Fundação Legal",
  date: "2026-07-30",
  milestone: "v1.5",
  category: "feature",
  importance: "major",
  announcement: "none",
};

describe("ChangelogFrontmatterSchema", () => {
  it("accepts valid frontmatter", () => {
    const result = ChangelogFrontmatterSchema.safeParse(validFrontmatter);
    expect(result.success).toBe(true);
  });

  it("rejects category outside the enum", () => {
    expect(() =>
      ChangelogFrontmatterSchema.parse({ ...validFrontmatter, category: "oops" })
    ).toThrow(ZodError);
  });

  it("rejects date outside the YYYY-MM-DD regex", () => {
    for (const badDate of ["31/07/2026", "2026-7-1"]) {
      expect(() =>
        ChangelogFrontmatterSchema.parse({ ...validFrontmatter, date: badDate })
      ).toThrow(ZodError);
    }
  });

  it("rejects empty id or title", () => {
    for (const field of ["id", "title"]) {
      expect(() =>
        ChangelogFrontmatterSchema.parse({ ...validFrontmatter, [field]: "" })
      ).toThrow(ZodError);
    }
  });
});
