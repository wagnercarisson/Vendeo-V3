import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("F47 frozen contract guard", () => {
  it("keeps gateway, prompts and public generation surfaces free of catalog wiring", () => {
    const gateway = read("src/lib/ai/gateway.ts");
    expect(gateway).not.toContain("ai_model_selection");
    expect(gateway).not.toContain("PersistedModelResolver");

    const frozenFiles = [
      "src/lib/campaign/brief.ts",
      "src/lib/campaign/brief-schema.ts",
    ];
    for (const file of frozenFiles) {
      expect(read(file)).not.toContain("ai_model_selection");
    }
  });

  it("has no diff in the phase-frozen paths against the pre-execution baseline", () => {
    const base = "87a96af0";
    const changed = execFileSync("git", ["diff", "--name-only", base], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);
    const frozen = [
      "src/lib/ai/gateway.ts",
      "src/components/flow/campaign-input-form.tsx",
      "src/lib/campaign/",
      "src/lib/campaign-intelligence/",
      "src/lib/image-generation/schema.ts",
      "prompts/",
    ];
    const violations = changed.filter((file) => frozen.some((prefix) => file === prefix || file.startsWith(prefix)));
    expect(violations).toEqual([]);
  });

  it("keeps explicit fallback orchestration in the existing gateway contract", () => {
    const gateway = read("src/lib/ai/gateway.ts");
    expect(gateway).toContain('target === "fallback"');
    expect(gateway).toContain("hasFallback");
  });
});
