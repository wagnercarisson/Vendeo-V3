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
 * O spike (CHECKPOINT 1) confirmou ambos os modelos no caminho direto `images`;
 * o plano 04 habilita os quatro presets confirmados e mantém o caminho `responses`
 * desabilitado com motivo. A allowlist própria (`BENCH_MODEL_ALLOWLIST`) é a
 * autoridade dos presets e o `MODEL_ALLOWLIST` produtivo permanece intocado.
 */

/** Presets confirmados pelo spike (`docs/lab/48-2-2-spike-models.md`, seção "Decisão"). */
const CONFIRMED_PRESET_IDS = [
  "gpt-image-2-low",
  "gpt-image-2-medium",
  "gpt-image-2.5-flare-low",
  "gpt-image-2.5-flare-medium",
] as const;

/** Modelos confirmados no caminho direto `images` pelo spike. */
const CONFIRMED_MODELS = ["gpt-image-2", "gpt-image-2.5-flare"] as const;

const DISABLED_PRESET_IDS = ["gpt-image-2-responses", "gpt-image-2.5-flare-responses"] as const;

function findPreset(id: string): BenchPreset {
  const preset = BENCH_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`preset ausente: ${id}`);
  return preset;
}

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

describe("preset-registry — presets confirmados pelo spike", () => {
  it("os quatro presets do caminho direto `images` existem e estão habilitados", () => {
    for (const id of CONFIRMED_PRESET_IDS) {
      const preset = findPreset(id);
      expect(preset.enabled, id).toBe(true);
      expect(preset.reason, id).toBeUndefined();
      expect(preset.protocol, id).toBe("images");
      expect(preset.capability, id).toBe("campaign_image");
      expect(preset.provider, id).toBe("openai");
    }
    expect(listBenchPresets()).toBe(BENCH_PRESETS);
  });

  it("todo preset habilitado corresponde a um modelo confirmado pelo spike (caminho direto)", () => {
    for (const preset of BENCH_PRESETS) {
      if (!preset.enabled) continue;
      expect(CONFIRMED_MODELS).toContain(preset.model);
      expect(preset.protocol).toBe("images");
    }
  });

  it("resolveBenchPreset de um preset confirmado devolve o preset", () => {
    expect(resolveBenchPreset("gpt-image-2-low").id).toBe("gpt-image-2-low");
    expect(resolveBenchPreset("gpt-image-2.5-flare-medium").model).toBe("gpt-image-2.5-flare");
  });
});

describe("preset-registry — presets não confirmados ficam desabilitados com motivo", () => {
  it("o caminho `responses` permanece desabilitado com motivo explícito", () => {
    for (const id of DISABLED_PRESET_IDS) {
      const preset = findPreset(id);
      expect(preset.enabled, id).toBe(false);
      expect(preset.reason, id).toBe("protocolo_nao_confirmado");
      expect(preset.protocol, id).toBe("responses");
    }
  });

  it("resolveBenchPreset de um preset desabilitado lança preset_not_enabled com o motivo", () => {
    const error = (() => {
      try {
        resolveBenchPreset("gpt-image-2-responses");
        return null;
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(BenchPresetError);
    expect((error as BenchPresetError).code).toBe("preset_not_enabled");
    expect((error as BenchPresetError).reason).toBe("protocolo_nao_confirmado");
  });

  it("resolveBenchPreset de um id inexistente lança preset_not_enabled", () => {
    expect(() => resolveBenchPreset("nao-existe")).toThrow(/preset_not_enabled/);
  });
});

describe("preset-registry — validação contra a allowlist própria da bancada", () => {
  it("preset confirmado é aceito pela allowlist da bancada", () => {
    const preset = findPreset("gpt-image-2-low");
    expect(validatePresetAgainstAllowlist(preset)).toEqual({ ok: true });
    expect(() =>
      assertBenchTargetAllowed(preset.provider, preset.model, preset.protocol),
    ).not.toThrow();
  });

  it("preset fora da allowlist é recusado", () => {
    const preset = enabledCopy(findPreset("gpt-image-2-low"), { model: "modelo-inexistente" });
    expect(() => validatePresetAgainstAllowlist(preset)).toThrow(
      /fora da allowlist da bancada/,
    );
  });

  it("protocolo incompatível é recusado", () => {
    const preset = enabledCopy(findPreset("gpt-image-2-low"), { protocol: "responses" });
    expect(() => validatePresetAgainstAllowlist(preset)).toThrow(/protocolo .* incompatível/);
  });

  it("gpt-image-2.5-flare (ausente do MODEL_ALLOWLIST) é aceito via BENCH_MODEL_ALLOWLIST sem alterar o MODEL_ALLOWLIST", () => {
    const preset = findPreset("gpt-image-2.5-flare-low");

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
    const preset = findPreset("gpt-image-2-low");
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
    const preset = findPreset("gpt-image-2-low");
    const { client, mutations } = createReadOnlyCatalogClient([]);

    await expect(validatePresetAgainstCatalog(preset, client)).rejects.toBeInstanceOf(
      BenchPresetNotInCatalogError,
    );
    expect(mutations).toEqual([]);
  });
});
