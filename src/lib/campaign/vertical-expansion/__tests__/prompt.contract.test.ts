// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EXPANSION_PROMPT, EXPANSION_PROMPT_VERSION } from "../prompt";
import { EXPANSION_PROMPT_VERSION as POLICY_PROMPT_VERSION } from "../policy";

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("F60.3 prompt — texto estático versionado", () => {
  it("é string estática não vazia e versionada", () => {
    expect(typeof EXPANSION_PROMPT).toBe("string");
    expect(EXPANSION_PROMPT.trim().length).toBeGreaterThan(200);
    expect(EXPANSION_PROMPT_VERSION).toBe("f60.3-expand-9-16-v1");
    expect(EXPANSION_PROMPT).toContain("f60.3-expand-9-16-v1");
  });

  it("compartilha o mesmo literal de versão de policy.ts", () => {
    expect(POLICY_PROMPT_VERSION).toBe(EXPANSION_PROMPT_VERSION);
  });

  it("preserva textos, preço, logo, avisos obrigatórios e composição central", () => {
    expect(EXPANSION_PROMPT).toMatch(/textos/i);
    expect(EXPANSION_PROMPT).toMatch(/pre[çc]o/i);
    expect(EXPANSION_PROMPT).toMatch(/logo/i);
    expect(EXPANSION_PROMPT).toMatch(/avisos obrigat[óo]rios/i);
    expect(EXPANSION_PROMPT).toMatch(/centralizada/i);
  });

  it("instrui ampliar apenas o quadro e proíbe recorte, moldura e elementos novos", () => {
    expect(EXPANSION_PROMPT.toLowerCase()).toContain("amplie apenas o quadro");
    expect(EXPANSION_PROMPT.toLowerCase()).toContain("não recorte");
    expect(EXPANSION_PROMPT.toLowerCase()).toContain("letterbox");
    expect(EXPANSION_PROMPT.toLowerCase()).toContain("molduras");
    expect(EXPANSION_PROMPT.toLowerCase()).toContain("elementos novos");
  });

  it("declara que é orientação de composição, não garantia pixel a pixel", () => {
    expect(EXPANSION_PROMPT.toLowerCase()).toContain("orientação de composição");
    expect(EXPANSION_PROMPT.toLowerCase()).toContain("garantia pixel a pixel");
  });
});

describe("F60.3 prompt — sem interpolação e sem laboratório", () => {
  it("não contém placeholders nem interpolação", () => {
    const source = readFileSync(sourcePath("../prompt.ts"), "utf8");

    expect(EXPANSION_PROMPT).not.toContain("{{");
    expect(EXPANSION_PROMPT).not.toContain("${");
    expect(EXPANSION_PROMPT).not.toContain("%s");
    expect(source).not.toContain("{{");
    expect(source).not.toContain("${");
    expect(source).not.toContain("%s");
  });

  it("não carrega dados de produto/campanha do chamador", () => {
    expect(EXPANSION_PROMPT).not.toMatch(/campaignId|storeId|operationId|productId/);
  });

  it("não importa o executor do laboratório e não expõe função", () => {
    const source = readFileSync(sourcePath("../prompt.ts"), "utf8");

    expect(source).not.toContain("@/lib/lab");
    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/export\s+function/);
    expect(source).not.toMatch(/export\s+const\s+\w+\s*=\s*\(/);
  });
});
