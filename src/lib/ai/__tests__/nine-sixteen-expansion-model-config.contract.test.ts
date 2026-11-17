// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  LEGACY_SUNBURST_LOW,
  NINE_SIXTEEN_EXPANSION_CONFIG_DIVERGENT,
  NINE_SIXTEEN_EXPANSION_CONFIG_MISSING,
  NINE_SIXTEEN_EXPANSION_MODEL_NOT_ELIGIBLE,
  NINE_SIXTEEN_EXPANSION_MODELS,
  NineSixteenExpansionConfigDivergentError,
  NineSixteenExpansionConfigMissingError,
  NineSixteenExpansionModelNotEligibleError,
  isExpansionSelection,
  isNineSixteenExpansionModel,
  resolveNineSixteenExpansionConfigFromRow,
  type NineSixteenExpansionConfigRow,
} from "../nine-sixteen-expansion-model-config";
import { NineSixteenExpansionConfigUpdateSchema } from "@/lib/admin/schemas";

const VALID_CONFIG_VERSION_ID = "11111111-1111-4111-8111-111111111111";

function row(
  overrides: Partial<NineSixteenExpansionConfigRow> = {},
): NineSixteenExpansionConfigRow {
  return {
    scope: "expansion",
    model: "gpt-image-2.5-sunburst",
    quality: "low",
    config_version_id: VALID_CONFIG_VERSION_ID,
    reason: "provisionamento inicial F60.6",
    updated_by: null,
    updated_at: "2026-11-17T00:00:00.000Z",
    created_at: "2026-11-17T00:00:00.000Z",
    ...overrides,
  };
}

const VALID_OPERATION_ID = "44444444-4444-4444-8444-444444444444";

describe("NINE_SIXTEEN_EXPANSION_MODELS — lista fechada da expansão", () => {
  it("expõe exatamente flare e sunburst, congelados nessa ordem", () => {
    expect(NINE_SIXTEEN_EXPANSION_MODELS).toEqual([
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ]);
    expect(NINE_SIXTEEN_EXPANSION_MODELS).toHaveLength(2);
    expect(Object.isFrozen(NINE_SIXTEEN_EXPANSION_MODELS)).toBe(true);
  });

  it("não inclui gpt-image-2 nem qualquer outra família", () => {
    expect(
      (NINE_SIXTEEN_EXPANSION_MODELS as readonly string[]).includes("gpt-image-2"),
    ).toBe(false);
    expect(isNineSixteenExpansionModel("gpt-image-2")).toBe(false);
    expect(isNineSixteenExpansionModel("dall-e-3")).toBe(false);
    expect(isNineSixteenExpansionModel("gpt-image-2.5-flare")).toBe(true);
    expect(isNineSixteenExpansionModel("gpt-image-2.5-sunburst")).toBe(true);
  });
});

describe("resolveNineSixteenExpansionConfigFromRow — resolução fail-closed", () => {
  it.each([
    ["gpt-image-2.5-flare", "low"],
    ["gpt-image-2.5-flare", "medium"],
    ["gpt-image-2.5-sunburst", "low"],
    ["gpt-image-2.5-sunburst", "medium"],
  ] as const)("resolve %s / %s como configuração humana", (model, quality) => {
    const selection = resolveNineSixteenExpansionConfigFromRow(
      row({ model, quality }),
    );

    expect(selection).toEqual({
      model,
      quality,
      configVersionId: VALID_CONFIG_VERSION_ID,
      origin: "configured",
    });
  });

  it("linha nula → nine_sixteen_expansion_config_missing (nunca default)", () => {
    const error = (() => {
      try {
        resolveNineSixteenExpansionConfigFromRow(null);
        return null;
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(NineSixteenExpansionConfigMissingError);
    expect((error as NineSixteenExpansionConfigMissingError).code).toBe(
      NINE_SIXTEEN_EXPANSION_CONFIG_MISSING,
    );
  });

  it("modelo gpt-image-2 → erro de elegibilidade no campo model", () => {
    const error = (() => {
      try {
        resolveNineSixteenExpansionConfigFromRow(row({ model: "gpt-image-2" }));
        return null;
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(NineSixteenExpansionModelNotEligibleError);
    expect((error as NineSixteenExpansionModelNotEligibleError).code).toBe(
      NINE_SIXTEEN_EXPANSION_MODEL_NOT_ELIGIBLE,
    );
    expect((error as NineSixteenExpansionModelNotEligibleError).field).toBe("model");
  });

  it("qualidade high → erro de elegibilidade no campo quality", () => {
    const error = (() => {
      try {
        resolveNineSixteenExpansionConfigFromRow(row({ quality: "high" }));
        return null;
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(NineSixteenExpansionModelNotEligibleError);
    expect((error as NineSixteenExpansionModelNotEligibleError).field).toBe("quality");
  });

  it("config_version_id ausente vira erro divergente (corrupção, não ausência)", () => {
    const error = (() => {
      try {
        resolveNineSixteenExpansionConfigFromRow(
          row({ config_version_id: "" }),
        );
        return null;
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(NineSixteenExpansionConfigDivergentError);
    expect((error as NineSixteenExpansionConfigDivergentError).code).toBe(
      NINE_SIXTEEN_EXPANSION_CONFIG_DIVERGENT,
    );
  });

  it("config_version_id que não é UUID v4 vira erro divergente", () => {
    expect(() =>
      resolveNineSixteenExpansionConfigFromRow(
        row({ config_version_id: "not-a-uuid" }),
      ),
    ).toThrow(NineSixteenExpansionConfigDivergentError);
  });

  it("escopo diferente de expansion vira erro divergente", () => {
    expect(() =>
      resolveNineSixteenExpansionConfigFromRow(
        row({ scope: "new_flow" as never }),
      ),
    ).toThrow(NineSixteenExpansionConfigDivergentError);
  });
});

describe("LEGACY_SUNBURST_LOW — legado explícito", () => {
  it("é congelado, Sunburst low, origem legacy_sunburst_low e sem versão inventada", () => {
    expect(Object.isFrozen(LEGACY_SUNBURST_LOW)).toBe(true);
    expect(LEGACY_SUNBURST_LOW).toEqual({
      model: "gpt-image-2.5-sunburst",
      quality: "low",
      configVersionId: null,
      origin: "legacy_sunburst_low",
    });
  });

  it("passa no guard estrito de seleção", () => {
    expect(isExpansionSelection(LEGACY_SUNBURST_LOW)).toBe(true);
  });

  it("rejeita seleção configurada sem versão e legado com versão", () => {
    expect(
      isExpansionSelection({
        model: "gpt-image-2.5-flare",
        quality: "low",
        configVersionId: null,
        origin: "configured",
      }),
    ).toBe(false);
    expect(
      isExpansionSelection({
        ...LEGACY_SUNBURST_LOW,
        configVersionId: VALID_CONFIG_VERSION_ID,
      }),
    ).toBe(false);
    expect(isExpansionSelection(null)).toBe(false);
    expect(isExpansionSelection({})).toBe(false);
  });
});

describe("NineSixteenExpansionConfigUpdateSchema — Zod estrito", () => {
  it("aceita o corpo canônico", () => {
    const parsed = NineSixteenExpansionConfigUpdateSchema.safeParse({
      model: "gpt-image-2.5-flare",
      quality: "medium",
      reason: "troca aprovada pelo responsável",
      operationId: VALID_OPERATION_ID,
    });

    expect(parsed.success).toBe(true);
  });

  it("recusa chaves extras (par, ator, ativação)", () => {
    const base = {
      model: "gpt-image-2.5-flare",
      quality: "low",
      reason: "motivo",
      operationId: VALID_OPERATION_ID,
    };

    for (const extra of [
      { fallbackModel: "gpt-image-2" },
      { primaryModel: "gpt-image-2.5-sunburst" },
      { fallbackQuality: "medium" },
      { actor: "99999999-9999-4999-8999-999999999999" },
      { actorId: "99999999-9999-4999-8999-999999999999" },
      { active: true },
    ]) {
      const parsed = NineSixteenExpansionConfigUpdateSchema.safeParse({
        ...base,
        ...extra,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("recusa reason em branco e operationId não-UUID", () => {
    const blank = NineSixteenExpansionConfigUpdateSchema.safeParse({
      model: "gpt-image-2.5-flare",
      quality: "low",
      reason: "   ",
      operationId: VALID_OPERATION_ID,
    });
    expect(blank.success).toBe(false);

    const badOperation = NineSixteenExpansionConfigUpdateSchema.safeParse({
      model: "gpt-image-2.5-flare",
      quality: "low",
      reason: "motivo",
      operationId: "operation-1",
    });
    expect(badOperation.success).toBe(false);
  });

  it("recusa gpt-image-2 apontando o path model", () => {
    const parsed = NineSixteenExpansionConfigUpdateSchema.safeParse({
      model: "gpt-image-2",
      quality: "low",
      reason: "motivo",
      operationId: VALID_OPERATION_ID,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(
      parsed.error.issues.some((issue) => issue.path.join(".") === "model"),
    ).toBe(true);
  });

  it("recusa qualidade fora de low/medium", () => {
    const parsed = NineSixteenExpansionConfigUpdateSchema.safeParse({
      model: "gpt-image-2.5-sunburst",
      quality: "high",
      reason: "motivo",
      operationId: VALID_OPERATION_ID,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("pureza do módulo de contrato", () => {
  const source = readFileSync(
    path.resolve(
      process.cwd(),
      "src/lib/ai/nine-sixteen-expansion-model-config.ts",
    ),
    "utf8",
  );

  it("não importa server-only, Supabase, Next, Sharp nem node:fs", () => {
    expect(source).not.toMatch(/from\s+["']server-only["']/);
    expect(source).not.toMatch(/import\s+["']server-only["']/);
    expect(source).not.toMatch(/from\s+["']@supabase\/[^"']+["']/);
    expect(source).not.toMatch(/from\s+["']next\/[^"']+["']/);
    expect(source).not.toMatch(/from\s+["']sharp["']/);
    expect(source).not.toMatch(/from\s+["']node:fs["']/);
  });

  it("não expõe par principal/auxiliar nem o tipo do fluxo 1:1", () => {
    expect(source).not.toMatch(/fallback/i);
    expect(source).not.toMatch(/primaryModel/);
    expect(source).not.toMatch(/ImageModelPair/);
  });
});
