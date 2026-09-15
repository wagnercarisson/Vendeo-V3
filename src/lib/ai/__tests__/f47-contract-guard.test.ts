import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

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

  it("keeps explicit fallback orchestration in the existing gateway contract", () => {
    const gateway = read("src/lib/ai/gateway.ts");
    expect(gateway).toContain('target === "fallback"');
    expect(gateway).toContain("hasFallback");
  });
});
