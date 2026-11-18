// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { ExpansionSelection } from "@/lib/ai/nine-sixteen-expansion-model-config";

import {
  preflightJointSelection,
  type JointPreflightConfigReadResult,
  type JointPreflightEvaluation,
} from "../orchestration/preflight";

/**
 * Contrato OFFLINE do preflight conjunto (F60.7 / Plano 60.7-04).
 *
 * Nenhum banco, RPC, Storage ou provider: as duas costuras são falsas. O
 * módulo não importa infraestrutura; o teste prova a distinção entre ausente,
 * inválido e indeterminado e a seleção exata a ser congelada.
 */

const CONFIG_VERSION = "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";

function configuredSelection(
  overrides: Partial<ExpansionSelection> = {},
): ExpansionSelection {
  return {
    model: "gpt-image-2.5-flare",
    quality: "medium",
    configVersionId: CONFIG_VERSION,
    origin: "configured",
    ...overrides,
  };
}

function depsWith(
  read: JointPreflightConfigReadResult | (() => Promise<never>),
  evaluation: JointPreflightEvaluation = { ok: true },
) {
  const calls: ExpansionSelection[] = [];
  return {
    calls,
    deps: {
      readConfiguration: async (): Promise<JointPreflightConfigReadResult> => {
        if (typeof read === "function") return read();
        return read;
      },
      preflightSelection: async (
        selection: ExpansionSelection,
      ): Promise<JointPreflightEvaluation> => {
        calls.push(selection);
        return evaluation;
      },
    },
  };
}

describe("preflight conjunto — seleção administrativa", () => {
  it("Teste 1: seleção válida é devolvida exatamente e o preflight roda uma vez", async () => {
    const selection = configuredSelection();
    const { deps, calls } = depsWith({ kind: "found", selection });

    const result = await preflightJointSelection(deps);

    expect(result).toEqual({
      ok: true,
      selection: {
        model: selection.model,
        quality: selection.quality,
        configVersionId: selection.configVersionId,
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(selection);
  });

  it("Teste 2: configuração ausente é absent, nunca indistinguível de leitura", async () => {
    const { deps } = depsWith({ kind: "absent" });
    expect(await preflightJointSelection(deps)).toEqual({
      ok: false,
      kind: "absent",
      reason: "expansion_config_absent",
      missing: [],
    });
  });

  it("Teste 3: configuração inválida preserva o motivo", async () => {
    const { deps } = depsWith({ kind: "invalid", reason: "divergent_row" });
    expect(await preflightJointSelection(deps)).toEqual({
      ok: false,
      kind: "invalid",
      reason: "divergent_row",
      missing: [],
    });
  });

  it("Teste 4: falha de leitura é indeterminate, nunca absent/invalid", async () => {
    const { deps } = depsWith({ kind: "read_failed", reason: "timeout" });
    expect(await preflightJointSelection(deps)).toEqual({
      ok: false,
      kind: "indeterminate",
      reason: "timeout",
      missing: [],
    });
  });

  it("Teste 5: pricing_unavailable é invalid e preserva missing", async () => {
    const { deps } = depsWith(
      { kind: "found", selection: configuredSelection() },
      {
        ok: false,
        failure: "pricing_unavailable",
        reason: "incomplete_coverage",
        missing: ["imageTokenUsdPer1M"],
      },
    );
    expect(await preflightJointSelection(deps)).toEqual({
      ok: false,
      kind: "invalid",
      reason: "incomplete_coverage",
      missing: ["imageTokenUsdPer1M"],
    });
  });

  it("Teste 6: configuration_read_failed é indeterminate", async () => {
    const { deps } = depsWith(
      { kind: "found", selection: configuredSelection() },
      {
        ok: false,
        failure: "configuration_read_failed",
        reason: "catalog_read_failed",
      },
    );
    expect(await preflightJointSelection(deps)).toEqual({
      ok: false,
      kind: "indeterminate",
      reason: "catalog_read_failed",
      missing: [],
    });
  });

  it("Teste 7: model_unavailable é invalid", async () => {
    const { deps } = depsWith(
      { kind: "found", selection: configuredSelection() },
      { ok: false, failure: "model_unavailable", reason: "model_inactive" },
    );
    expect(await preflightJointSelection(deps)).toEqual({
      ok: false,
      kind: "invalid",
      reason: "model_inactive",
      missing: [],
    });
  });

  it("Teste 8: exceção em qualquer costura vira indeterminate e nunca lança", async () => {
    const throwingRead = depsWith(async () => {
      throw new Error("boom");
    });
    expect(await preflightJointSelection(throwingRead.deps)).toEqual({
      ok: false,
      kind: "indeterminate",
      reason: "configuration_read_failed",
      missing: [],
    });

    const throwingEvaluation = depsWith(
      { kind: "found", selection: configuredSelection() },
      { ok: true },
    );
    throwingEvaluation.deps.preflightSelection = async () => {
      throw new Error("boom");
    };
    expect(await preflightJointSelection(throwingEvaluation.deps)).toEqual({
      ok: false,
      kind: "indeterminate",
      reason: "preflight_read_failed",
      missing: [],
    });
  });

  it("Teste 9: o módulo não carrega infraestrutura global", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/product-two-format/orchestration/preflight.ts"),
      "utf8",
    );
    for (const forbidden of [
      "server-only",
      "@/lib/supabase",
      "@/lib/product-1-1",
      "nine-sixteen-expansion-model-config-service",
      "readNineSixteenExpansionConfig",
      "preflightExpansionToNineSixteen",
      ".rpc(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("Teste 10: seleção legada ou versão nula é invalid", async () => {
    const legacy = depsWith({
      kind: "found",
      selection: configuredSelection({
        origin: "legacy_sunburst_low",
        configVersionId: null,
      }),
    });
    expect(await preflightJointSelection(legacy.deps)).toEqual({
      ok: false,
      kind: "invalid",
      reason: "expansion_selection_not_configured",
      missing: [],
    });
    expect(legacy.calls).toHaveLength(0);

    const nullVersion = depsWith({
      kind: "found",
      selection: configuredSelection({ configVersionId: null }),
    });
    expect(await preflightJointSelection(nullVersion.deps)).toEqual({
      ok: false,
      kind: "invalid",
      reason: "expansion_selection_not_configured",
      missing: [],
    });
    expect(nullVersion.calls).toHaveLength(0);
  });
});
