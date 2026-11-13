import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * F59 / 59-07 — guardas estruturais da rota de geração.
 *
 * O comportamento fim-a-fim (primeira submissão 9:16, 409 de formato, flag
 * fail-closed, reenvio e snapshot 1:1 byte-compatível) é exercitado com o
 * Supabase/orquestradores mockados na suíte da própria rota:
 * `src/app/api/campaign/generate-image/__tests__/route.test.ts`
 * (describe "formato vertical 9:16 (F59)").
 *
 * Este arquivo fixa os invariantes que não devem regredir por acidente.
 */
const ROUTE_PATH = path.resolve(
  process.cwd(),
  "src",
  "app",
  "api",
  "campaign",
  "generate-image",
  "route.ts",
);

const source = readFileSync(ROUTE_PATH, "utf8");

describe("F59/59-07 — contrato estrutural da rota generate-image", () => {
  it("importa o módulo NEUTRO de formato, sem cruzar o boundary vertical", () => {
    expect(source).toContain('from "@/lib/campaign/format-resolution"');
    expect(source).not.toContain('from "@/lib/product-vertical-9-16/format"');
  });

  it("despacha o 9:16 por import dinâmico do orquestrador de duas etapas", () => {
    const dynamicImports = source.match(
      /import\(\s*["']@\/lib\/product-9-16-two-stage\/orchestration\/run-nine-sixteen["']\s*\)/g,
    );
    expect(dynamicImports).toHaveLength(1);
    expect(source).not.toMatch(
      /import\(\s*["']@\/lib\/product-vertical-9-16\/orchestration\/entrypoint["']\s*\)/,
    );
    expect(source).not.toMatch(
      /from\s+["']@\/lib\/product-vertical-9-16\/orchestration\/entrypoint["']/,
    );
  });

  it("mantém o congelamento das duas chaves somente no ramo 9:16", () => {
    expect(source).toContain("campaignFormat: \"9:16\" as const");
    expect(source).toContain("formatContractVersion: FORMAT_CONTRACT_VERSION");
    expect(source).toContain('requestedFormat === "9:16"');
  });
});
