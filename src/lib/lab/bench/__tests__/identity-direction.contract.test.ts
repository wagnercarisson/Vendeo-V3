// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PROMPT_BLOCK_LABELS } from "../domain/prompt-composer";
import { buildIdentityDirectionContributions } from "../domain/identity-direction";
import type { IdentityDirectionContribution } from "../domain/identity-direction";
import type { BenchIdentityReference } from "../domain/resolve-bench-identity";

/**
 * Contrato da **orientação de fidelidade da identidade** (F48.2.4, D9;
 * spec `lab-bench-identity-transport`).
 *
 * Prova, sem nenhuma chamada de rede/IA:
 *  - com `logo`/`visual_signature` ⇒ orientação de reprodução fiel no bloco de
 *    identidade; sem referência ⇒ nenhuma linha;
 *  - a orientação exige reprodução fiel, identidade secundária e sem posição
 *    fixa, sem inventar/redesenhar/distorcer/completar/reinterpretar;
 *  - determinismo;
 *  - módulo puro e separado (sem serviço produtivo, sem IA, sem policies).
 */

const LOGO: BenchIdentityReference = {
  kind: "logo",
  variantType: "normalized",
  storagePath: "store-logos/logo-normalized.png",
};

const SIGNATURE: BenchIdentityReference = {
  kind: "visual_signature",
  variantType: null,
  storagePath: "visual-signatures/assinatura.png",
};

function linesOf(contributions: readonly IdentityDirectionContribution[]): string[] {
  return contributions.flatMap((contribution) => contribution.lines);
}

// ─── Presença com referência ─────────────────────────────────────────────────

describe("identity direction — orientação de fidelidade presente com referência", () => {
  it("logo contribui no bloco [IDENTIDADE E DIREÇÃO VISUAL]", () => {
    const contributions = buildIdentityDirectionContributions(LOGO);

    expect(contributions.length).toBe(1);
    expect(contributions[0].block).toBe(PROMPT_BLOCK_LABELS.identity);
    expect(contributions[0].lines.length).toBeGreaterThan(0);
  });

  it("visual_signature contribui no bloco [IDENTIDADE E DIREÇÃO VISUAL]", () => {
    const contributions = buildIdentityDirectionContributions(SIGNATURE);

    expect(contributions.length).toBe(1);
    expect(contributions[0].block).toBe(PROMPT_BLOCK_LABELS.identity);
  });

  it("exige reprodução fiel sem redesenhar/distorcer/completar/reinterpretar", () => {
    const text = linesOf(buildIdentityDirectionContributions(LOGO)).join("\n").toLowerCase();

    expect(text).toContain("fidelidade");
    for (const verb of ["redesenhar", "distorcer", "completar", "reinterpretar", "inventar"]) {
      expect(text, `deve proibir ${verb}`).toContain(verb);
    }
  });

  it("mantém a identidade secundária e sem posição fixa", () => {
    const text = linesOf(buildIdentityDirectionContributions(SIGNATURE)).join("\n").toLowerCase();

    expect(text).toContain("secundária");
    expect(text).toContain("sem posição fixa");
  });
});

// ─── Ausência sem referência ─────────────────────────────────────────────────

describe("identity direction — ausência sem referência", () => {
  it("sem referência não produz nenhuma linha", () => {
    expect(buildIdentityDirectionContributions(null)).toEqual([]);
  });
});

// ─── Determinismo e pureza ───────────────────────────────────────────────────

describe("identity direction — determinismo e pureza", () => {
  it("mesma referência ⇒ mesma orientação", () => {
    expect(buildIdentityDirectionContributions(LOGO)).toEqual(
      buildIdentityDirectionContributions(LOGO),
    );
  });

  it("o módulo é puro (sem serviço produtivo, sem IA, sem policies)", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/identity-direction.ts"),
      "utf8",
    );
    // Apenas as linhas de import são inspecionadas (a prova de independência).
    const imports = source
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import"))
      .join("\n")
      .toLowerCase();

    for (const forbidden of [
      "art-director-briefing",
      "policies",
      "openai",
      "@google",
      "embedding",
    ]) {
      expect(imports).not.toContain(forbidden);
    }
  });
});

// ─── Sem sobreposição com oferta/produto ─────────────────────────────────────

describe("identity direction — sem sobreposição com as políticas de oferta/produto", () => {
  it("não repete orientações comerciais nem de produto", () => {
    const allLines = linesOf(buildIdentityDirectionContributions(LOGO)).map((line) =>
      line.toLowerCase(),
    );

    for (const commercial of ["preço", "desconto", "selo", "validade"]) {
      expect(allLines.some((line) => line.includes(commercial))).toBe(false);
    }
    for (const product of ["elemento principal", "embalagem", "benefício", "produto"]) {
      expect(allLines.some((line) => line.includes(product))).toBe(false);
    }
  });
});
