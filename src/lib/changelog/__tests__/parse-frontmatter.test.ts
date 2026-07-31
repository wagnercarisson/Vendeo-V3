import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../parse-frontmatter";

describe("parseFrontmatter", () => {
  it("parses complete frontmatter and returns trimmed body", () => {
    const raw = [
      "---",
      'id: "fase-30-legal-foundation"',
      'title: "Fundação Legal"',
      'date: "2026-07-30"',
      'milestone: "v1.5"',
      'category: "feature"',
      'importance: "major"',
      'announcement: "none"',
      "---",
      "",
      "## O que mudou",
      "",
      "- Texto do body",
    ].join("\n");

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.id).toBe("fase-30-legal-foundation");
    expect(result.frontmatter.title).toBe("Fundação Legal");
    expect(result.frontmatter.date).toBe("2026-07-30");
    expect(result.frontmatter.milestone).toBe("v1.5");
    expect(result.frontmatter.category).toBe("feature");
    expect(result.body).toBe("## O que mudou\n\n- Texto do body");
  });

  it("removes quotes from scalar values", () => {
    const raw = [
      "---",
      'announcement: "none"',
      "category: 'feature'",
      "---",
      "",
      "body",
    ].join("\n");

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.announcement).toBe("none");
    expect(result.frontmatter.category).toBe("feature");
  });

  it("preserves values containing colons", () => {
    const raw = ['---', 'title: "Lançamento: v1.5"', "---", "", "body"].join("\n");

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.title).toBe("Lançamento: v1.5");
  });

  it("throws when opening delimiter is missing", () => {
    const raw = ['id: "fase-30-legal-foundation"', "---", "body"].join("\n");

    expect(() => parseFrontmatter(raw)).toThrow(/abertura ausente|Frontmatter/);
  });

  it("throws when closing delimiter is missing", () => {
    const raw = ["---", 'id: "fase-30-legal-foundation"', "body"].join("\n");

    expect(() => parseFrontmatter(raw)).toThrow(/fechamento/);
  });
});
