// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it } from "vitest";
import type { NineSixteenEvent } from "../types";
import type {
  ExpansionConfigurationPreflight,
  RunNineSixteenDeps,
  RunNineSixteenExpandDeps,
} from "../types";
import type { ExpansionSelection } from "@/lib/ai/nine-sixteen-expansion-model-config";

function classify(event: NineSixteenEvent): string {
  switch (event.type) {
    case "phase":
      return "phase";
    case "processing":
      return "processing";
    case "result":
      return "result";
    case "error":
      return "error";
    case "unknown":
      return "unknown";
    default: {
      const never: never = event;
      return never;
    }
  }
}

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

const CONFIGURED_SELECTION: ExpansionSelection = {
  model: "gpt-image-2.5-sunburst",
  quality: "low",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
};

describe("orchestration event contract", () => {
  it("narrows processing separately from terminals", () => {
    const processing: NineSixteenEvent = {
      type: "processing",
      campaignId: "c",
      operationId: "o",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    };
    expect(classify(processing)).toBe("processing");
    expect(classify({ type: "result", campaignId: "c", operationId: "o", campaignUrl: "/x" })).toBe("result");
    expect(
      classify({ type: "unknown", campaignId: "c", operationId: "o", reference: "r" }),
    ).toBe("unknown");
  });
});

describe("orchestration — seleção congelada nos tipos", () => {
  it("o sucesso do preflight carrega a seleção resolvida", () => {
    const preflight: ExpansionConfigurationPreflight = {
      ok: true,
      selection: CONFIGURED_SELECTION,
    };

    expect(preflight.ok).toBe(true);
    if (!preflight.ok) return;
    expect(preflight.selection).toEqual(CONFIGURED_SELECTION);
    expectTypeOf<Extract<ExpansionConfigurationPreflight, { ok: true }>["selection"]>()
      .toEqualTypeOf<ExpansionSelection>();
  });

  it("separa configuração ausente/inválida de leitura indeterminada", () => {
    const failures: Array<
      Extract<ExpansionConfigurationPreflight, { ok: false }>["failure"]
    > = [
      "model_unavailable",
      "pricing_unavailable",
      "configuration_missing",
      "configuration_read_failed",
    ];

    expect(failures).toHaveLength(4);
    expectTypeOf<
      Extract<ExpansionConfigurationPreflight, { ok: false }>["failure"]
    >().toEqualTypeOf<
      | "model_unavailable"
      | "pricing_unavailable"
      | "configuration_missing"
      | "configuration_read_failed"
    >();
  });

  it("`expand` exige a seleção como segundo argumento (nunca opcional)", () => {
    expectTypeOf<RunNineSixteenExpandDeps["selection"]>().toEqualTypeOf<ExpansionSelection>();
    expectTypeOf<RunNineSixteenDeps["expand"]>().toEqualTypeOf<
      (
        input: import("@/lib/campaign/vertical-expansion/types").ExpandVerticalInput,
        deps: RunNineSixteenExpandDeps,
      ) => Promise<import("@/lib/campaign/vertical-expansion/types").ExpandVerticalResult>
    >();
    // A seleção não é opcional: um deps sem ela não compila.
    // @ts-expect-error — `selection` é obrigatória em `RunNineSixteenExpandDeps`.
    const missingSelection: RunNineSixteenExpandDeps = {};
    expect(missingSelection).toBeDefined();
  });

  it("preflightExpansion permanece obrigatória e a seleção não é montada na rota", () => {
    const source = readFileSync(sourcePath("../types.ts"), "utf8");

    expect(source).toContain("RunNineSixteenExpandDeps");
    expect(source).not.toMatch(/preflightExpansion\?/);
    expect(source).not.toMatch(/selection\?/);
  });
});
