// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RUNTIME_ROOT = path.resolve(process.cwd(), "src");
const CANDIDATE_DOCUMENT_REFERENCE =
  /48\.2\.5-CANDIDATE(?:\.schema)?\.json|candidate-manifest-loader/;

function collectRuntimeSources(directory: string): string[] {
  const sources: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      sources.push(...collectRuntimeSources(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      sources.push(fullPath);
    }
  }
  return sources;
}

describe("candidate manifest — isolamento documental", () => {
  it("nenhum módulo TypeScript/TSX do runtime carrega schema ou exemplar documental", () => {
    const references: string[] = [];
    for (const sourcePath of collectRuntimeSources(RUNTIME_ROOT)) {
      const contents = readFileSync(sourcePath, "utf8");
      if (CANDIDATE_DOCUMENT_REFERENCE.test(contents)) {
        references.push(path.relative(process.cwd(), sourcePath));
      }
    }

    expect(references).toEqual([]);
  });
});
