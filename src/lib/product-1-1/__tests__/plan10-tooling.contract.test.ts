// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");
const runner = read("scripts/run-f56-2b2b-isolated-integration.ps1");
const activeRunner = runner
  .split(/\r?\n/)
  .filter((l) => !l.trimStart().startsWith("#"))
  .join("\n");
const fixture = read("scripts/f56-2b2b/prepare-visual-uat.ts");

describe("F56.2b2b — Plano 10: TOOLING (runner / fixture)", () => {
  it("runner usa `npx --no-install vitest run` (sem resolução/download em runtime)", () => {
    expect(activeRunner).toMatch(/npx --no-install vitest run \$suite/);
    expect(activeRunner).not.toMatch(/npx vitest run \$suite/);
  });

  it("fixture PARCIAL ⇒ PARADA EXPLÍCITA (valida pós-condições; NUNCA skips por nome)", () => {
    expect(fixture).toMatch(/fixture_partial_state/);
    expect(fixture).toMatch(/status !== "refunded" \|\| outcome\.rows\[0\]\?\.outcome !== "failed"/);
    expect(fixture).toMatch(/validated: true/);
    // Reexecução valida o estado terminal; não declara pronta só pela existência.
    expect(fixture).not.toMatch(/skipped: true,\s*\n\s*campaignId,\s*\n\s*operationId: op\.rows/);
  });
});
