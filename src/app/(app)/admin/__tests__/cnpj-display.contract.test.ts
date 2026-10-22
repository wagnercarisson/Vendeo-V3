// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static contract for PASSIVE admin CNPJ displays (F50.3).
 *
 * Every passive listing/detail surface must go through the central `maskCnpj`
 * (alphanumeric suffix preserved, placeholder for invalid input) and must not
 * reintroduce a local numeric regex.
 *
 * `reveal-cnpj` (raw reveal) is intentionally OUTSIDE this contract: it is the
 * audited, admin-only exception and must not change in this phase.
 */
const ADMIN_DISPLAY_FILES = [
  "src/app/(app)/admin/reviews/page.tsx",
  "src/app/(app)/admin/users/page.tsx",
  "src/app/(app)/admin/users/[id]/page.tsx",
  "src/app/(app)/admin/users/[id]/grant-freemium-exception/page.tsx",
] as const;

const REVEAL_EXCEPTIONS = [
  "src/app/api/admin/reviews/[id]/reveal-cnpj/route.ts",
  "src/components/admin/reveal-cnpj-button.tsx",
] as const;

const LOCAL_NUMERIC_CNPJ_REGEX = /\(\\d\{2\}\)\(\\d\{3\}\)/;

function read(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("admin passive CNPJ display contract", () => {
  it.each(ADMIN_DISPLAY_FILES)(
    "%s imports and calls the central maskCnpj",
    (file) => {
      const source = read(file);
      expect(source).toContain('from "@/lib/cnpj/mask"');
      expect(source).toContain("maskCnpj(");
    },
  );

  it.each(ADMIN_DISPLAY_FILES)(
    "%s has no local numeric CNPJ regex",
    (file) => {
      expect(read(file)).not.toMatch(LOCAL_NUMERIC_CNPJ_REGEX);
    },
  );

  it("keeps reveal-cnpj outside the automated masking contract", () => {
    for (const exception of REVEAL_EXCEPTIONS) {
      expect(ADMIN_DISPLAY_FILES).not.toContain(exception);
    }

    // The raw reveal remains the audited admin-only exception.
    const route = read("src/app/api/admin/reviews/[id]/reveal-cnpj/route.ts");
    expect(route).toContain("requireAdmin");
  });

  it("maskCnpj preserves the alphanumeric suffix and fails closed", () => {
    const source = read("src/lib/cnpj/mask.ts");
    expect(source).toContain('"CNPJ inválido"');
    expect(source).toContain("normalized.slice(8, 12)");
  });
});
