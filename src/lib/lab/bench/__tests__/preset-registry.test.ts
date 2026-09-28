import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MODEL_ALLOWLIST } from "@/lib/ai/model-registry";
import { BENCH_MODEL_ALLOWLIST, assertBenchTargetAllowed } from "@/lib/lab/bench/domain/bench-model-allowlist";
import {
  BENCH_PRESETS,
  BenchPresetError,
  BenchPresetNotInCatalogError,
  listBenchPresets,
  resolveBenchPreset,
  validatePresetAgainstAllowlist,
  validatePresetAgainstCatalog,
  type BenchPreset,
} from "@/lib/lab/bench/domain/preset-registry";

/**
 * Registry de presets da bancada (F48.2.2, D7).
 *
 * Nenhum preset é habilitado antes do CHECKPOINT 1; a allowlist própria
 * (`BENCH_MODEL_ALLOWLIST`) é a autoridade dos presets e o `MODEL_ALLOWLIST`
 * produtivo permanece intocado (regressão).
 */

function enabledCopy(preset: BenchPreset, overrides: Partial<BenchPreset> = {}): BenchPreset {
  return { ...preset, enabled: true, reason: undefined, ...overrides };
}

interface CatalogRow {
  id: string;
  capability: string;
  provider: string;
  model: string;
  protocol: string;
  status: string;
  [column: string]: unknown;
}

/** Client fake **somente leitura** do catálogo — qualquer mutação lança. */
function createReadOnlyCatalogClient(rows: CatalogRow[]): {
  client: SupabaseClient;
  mutations: string[];
} {
  const mutations: string[] = [];
  const client = {
    from(table: string) {
      if (table !== "ai_model_catalog") throw new Error(`unexpected_table:${table}`);
      const filters: Array<[string, unknown]> = [];
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => {
          const match =
            rows.find((row) => filters.every(([column, value]) => row[column] === value)) ?? null;
          return { data: match, error: null };
        },
        insert: () => {
          mutations.push("insert");
          throw new Error("catalog_mutation_forbidden:insert");
        },
        update: () => {
          mutations.push("update");
          throw new Error("catalog_mutation_forbidden:update");
        },
        delete: () => {
          mutations.push("delete");
          throw new Error("catalog_mutation_forbidden:delete");
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, mutations };
}

describe("preset-registry — candidatos e estado inicial", () => {
  it("os quatro candidatos existem e nenhum está habilitado antes do CHECKPOINT 1", () => {
    const ids = BENCH_PRESETS.map((preset) => preset.id).sort();
    expect(ids).toEqual([
      "gpt-image-2-low",
      "gpt-image-2-medium",
      "gpt-image-2.5-flare-low",
      "gpt-image-2.5-flare-medium",
    ]);
    for (const preset of BENCH_PRESETS) {
      expect(preset.enabled, preset.id).toBe(false);
      expect(preset.reason, preset.id).toBeTruthy();
    }
    expect(listBenchPresets()).toBe(BENCH_PRESETS);
  });

  it("resolveBenchPreset de um preset desabilitado lança preset_not_enabled com motivo", () => {
    const error = (() => {
      try {
        resolveBenchPreset("gpt-image-2-low");
        return null;
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(BenchPresetError);
    expect((error as BenchPresetError).code).toBe("preset_not_enabled");
    expect((error as BenchPresetError).reason).toBe("spike_pendente");
  });

  it("resolveBenchPreset de um id inexistente lança preset_not_enabled", () => {
    expect(() => resolveBenchPreset("nao-existe")).toThrow(/preset_not_enabled/);
  });
});

describe("preset-registry — validação contra a allowlist própria da bancada", () => {
  it("preset válido com enabled:true é aceito pela allowlist da bancada", () => {
    const preset = enabledCopy(BENCH_PRESETS[0]);
    expect(validatePresetAgainstAllowlist(preset)).toEqual({ ok: true });
    expect(() =>
      assertBenchTargetAllowed(preset.provider, preset.model, preset.protocol),
    ).not.toThrow();
  });

  it("preset fora da allowlist é recusado", () => {
    const preset = enabledCopy(BENCH_PRESETS[0], { model: "modelo-inexistente" });
    expect(() => validatePresetAgainstAllowlist(preset)).toThrow(
      /fora da allowlist da bancada/,
    );
  });

  it("protocolo incompatível é recusado", () => {
    const preset = enabledCopy(BENCH_PRESETS[0], { protocol: "responses" });
    expect(() => validatePresetAgainstAllowlist(preset)).toThrow(/protocolo .* incompatível/);
  });

  it("gpt-image-2.5-flare (ausente do MODEL_ALLOWLIST) é aceito via BENCH_MODEL_ALLOWLIST sem alterar o MODEL_ALLOWLIST", () => {
    const preset = enabledCopy(
      BENCH_PRESETS.find((candidate) => candidate.model === "gpt-image-2.5-flare")!,
    );

    // Ausente da allowlist produtiva...
    const prodKeysBefore = Object.keys(MODEL_ALLOWLIST.openai).sort();
    expect(MODEL_ALLOWLIST.openai["gpt-image-2.5-flare"]).toBeUndefined();

    // ...mas aceito pela allowlist própria da bancada.
    expect(BENCH_MODEL_ALLOWLIST.openai["gpt-image-2.5-flare"]).toEqual(["images"]);
    expect(validatePresetAgainstAllowlist(preset)).toEqual({ ok: true });

    // O MODEL_ALLOWLIST produtivo permanece inalterado (mesmas chaves antes/depois).
    expect(Object.keys(MODEL_ALLOWLIST.openai).sort()).toEqual(prodKeysBefore);
    expect(MODEL_ALLOWLIST.openai["gpt-image-2.5-flare"]).toBeUndefined();
  });

  it("a expansão de um novo preset não exige migration (o registry acomoda sem persistência)", () => {
    const novo: BenchPreset = {
      id: "gpt-image-2-high",
      label: "GPT Image 2 · high",
      capability: "campaign_image",
      provider: "openai",
      model: "gpt-image-2",
      protocol: "images",
      quality: "high",
      size: "1536x1024",
      enabled: true,
    };
    // Nenhuma alteração de schema/migration: a validação em código acomoda o novo preset.
    expect(validatePresetAgainstAllowlist(novo)).toEqual({ ok: true });
  });
});

describe("preset-registry — validação contra o catálogo ativo (somente leitura)", () => {
  it("aceita um preset cujo alvo existe como linha ativa do catálogo", async () => {
    const preset = enabledCopy(BENCH_PRESETS[0]);
    const { client, mutations } = createReadOnlyCatalogClient([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        capability: preset.capability,
        provider: preset.provider,
        model: preset.model,
        protocol: preset.protocol,
        status: "active",
      },
    ]);

    await expect(validatePresetAgainstCatalog(preset, client)).resolves.toEqual({ ok: true });
    // O catálogo não é mutado.
    expect(mutations).toEqual([]);
  });

  it("recusa um preset cujo alvo não está no catálogo ativo", async () => {
    const preset = enabledCopy(BENCH_PRESETS[0]);
    const { client, mutations } = createReadOnlyCatalogClient([]);

    await expect(validatePresetAgainstCatalog(preset, client)).rejects.toBeInstanceOf(
      BenchPresetNotInCatalogError,
    );
    expect(mutations).toEqual([]);
  });
});
