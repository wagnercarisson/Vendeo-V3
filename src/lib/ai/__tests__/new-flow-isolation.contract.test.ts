import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
// Mock parcial: preserva os demais exports (DEFAULT_AI_MODEL_PRICING etc.) e
// controla apenas a leitura de pricing para provar a cadeia legada.
vi.mock("@/lib/ai-cost/ai-model-pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-cost/ai-model-pricing")>();
  return { ...actual, getModelPricing: vi.fn() };
});

import { buildAiModelSelectionView } from "../ai-model-selection-view";
import {
  LEGACY_SELECTION_CAPABILITIES,
  MODEL_ALLOWLIST,
} from "../model-registry";
import { resolveAiCost } from "@/lib/ai-cost/cost-estimator";
import { getModelPricing } from "@/lib/ai-cost/ai-model-pricing";

type ViewDependencies = Parameters<typeof buildAiModelSelectionView>[0];

const emptyDependencies: ViewDependencies = {
  catalogService: {
    getActiveCatalogRows: async () => [],
    getCatalogMap: async () => new Map(),
  },
  selectionService: { getSelectionMap: async () => new Map() },
  pricingService: async () => [],
};

const mockGetModelPricing = getModelPricing as unknown as ReturnType<typeof vi.fn>;

function read(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

/** Arquivos do novo fluxo Produto 1:1 (F56.1) — nunca devem criar campanha nem tocar crédito. */
const NEW_FLOW_FILES = [
  "src/lib/ai/image-model-pair.ts",
  "src/lib/ai/image-model-pair-config-service.ts",
  "src/lib/ai/image-model-pair-config-view.ts",
  "src/lib/ai/image-generation-config-snapshot.ts",
  "src/lib/ai/image-generation-failure-policy.ts",
  "src/lib/ai/image-generation-support-reference.ts",
  "src/lib/ai/image-generation-diagnosis-repository.ts",
  "src/lib/ai/adapters/upstream-images.ts",
  "src/lib/ai/upstream-images-runtime.ts",
  "src/lib/ai-cost/image-pair-pricing.ts",
];

afterEach(() => {
  vi.unstubAllEnvs();
  mockGetModelPricing.mockReset();
});

describe("new-flow isolation guard — fronteira produtiva legada intocada (F56.1 D-07/D-25)", () => {
  it("(a) ImagesAdapter e defaultAdapterRegistry permanecem sem propagação de quality", () => {
    const images = read("src/lib/ai/adapters/images.ts");
    const registry = read("src/lib/ai/adapters/registry.ts");

    // O adapter produtivo NUNCA propagou `quality` (D-07/D-20): a propagação
    // ocorre só no adapter do novo fluxo (`upstream-images.ts`).
    expect(images).not.toMatch(/\bquality\b/);
    expect(registry).not.toMatch(/\bquality\b/);
    // O registry legado continua montando o ImagesAdapter produtivo.
    expect(registry).toMatch(/images:\s*new ImagesAdapter\(\)/);
  });

  it("(b) buildAiModelSelectionView oferece EXATAMENTE LEGACY_SELECTION_CAPABILITIES, sem campaign_product_image", async () => {
    const view = await buildAiModelSelectionView(emptyDependencies);
    const offered = view.capabilities.map((item) => item.capability);

    expect(offered).toEqual([...LEGACY_SELECTION_CAPABILITIES]);
    expect(offered).toHaveLength(11);
    expect(offered).not.toContain("campaign_product_image");
    // Se a view voltar a iterar ALL_CAPABILITIES (12), esta asserção falha.
    expect(view.capabilities).toHaveLength(LEGACY_SELECTION_CAPABILITIES.length);
  });

  it("(c) nenhum alvo oferecido sob capacidade legada referencia gpt-image-2.5-flare/sunburst", async () => {
    const view = await buildAiModelSelectionView(emptyDependencies);
    const models = view.capabilities.flatMap((item) =>
      [
        item.current.primary,
        item.current.fallback,
        item.default.primary,
        item.default.fallback,
        item.configured?.primary ?? null,
        item.configured?.fallback ?? null,
      ]
        .filter((target) => target !== null)
        .map((target) => target!.model),
    );

    expect(models).not.toContain("gpt-image-2.5-flare");
    expect(models).not.toContain("gpt-image-2.5-sunburst");
  });

  it("(d) MODEL_ALLOWLIST produtivo permanece intocado (sem os modelos novos)", () => {
    const openaiModels = Object.keys(MODEL_ALLOWLIST.openai);
    expect(openaiModels).not.toContain("gpt-image-2.5-flare");
    expect(openaiModels).not.toContain("gpt-image-2.5-sunburst");
    // Regressão: o único modelo de imagem da allowlist produtiva continua gpt-image-2.
    expect(openaiModels).toContain("gpt-image-2");
  });

  it("(e) resolveAiCost preserva a cadeia legada provider_reported → manual_unknown → pricing_table → fallback_static → not_available", async () => {
    // 1. provider_reported
    const providerReported = await resolveAiCost({
      provider: "openai",
      model: "gpt-4o",
      providerReportedCostUsd: 0.02,
    });
    expect(providerReported.costSource).toBe("provider_reported");
    expect(providerReported.estimatedCostUsd).toBe(0.02);

    // 2. manual_unknown
    const manual = await resolveAiCost({
      provider: "openai",
      model: "gpt-4o",
      manualCostUsd: 0.03,
    });
    expect(manual.costSource).toBe("manual_unknown");

    // 3. pricing_table
    mockGetModelPricing.mockResolvedValueOnce({
      pricing: { imageUnitCostUsd: 0.04 },
      versionId: "22222222-2222-4222-8222-222222222222",
    });
    const pricingTable = await resolveAiCost({ provider: "openai", model: "gpt-image-2" });
    expect(pricingTable.costSource).toBe("pricing_table");

    // 4. fallback_static (sem linha e sem desabilitação)
    mockGetModelPricing.mockResolvedValueOnce(null);
    const fallbackStatic = await resolveAiCost({ provider: "openai", model: "gpt-4o" });
    expect(fallbackStatic.costSource).toBe("fallback_static");

    // 5. not_available (fallback explicitamente desabilitado)
    mockGetModelPricing.mockResolvedValueOnce(null);
    vi.stubEnv("VENDEO_AI_FALLBACK_COST_USD", "disabled");
    const notAvailable = await resolveAiCost({ provider: "openai", model: "gpt-4o" });
    expect(notAvailable.costSource).toBe("not_available");
    expect(notAvailable.estimatedCostUsd).toBeNull();
  });

  it("(f) nenhum arquivo do novo fluxo cria campanha nem importa serviço de crédito/ledger", () => {
    for (const file of NEW_FLOW_FILES) {
      const source = read(file);
      expect(source, `${file}: não pode importar o serviço de crédito`).not.toMatch(
        /\bfrom\s+["'][^"']*\/credit[^"']*["']/,
      );
      expect(source, `${file}: não pode importar ledger de créditos`).not.toMatch(
        /^\s*import\b[^\n]*ledger/im,
      );
      expect(source, `${file}: não pode criar campanha`).not.toMatch(/\bcreateCampaign\s*\(/);
    }
  });

  it("(f) o adapter do novo fluxo carrega o SDK do provider de forma dinâmica (sem chamada no load do módulo)", () => {
    const upstream = read("src/lib/ai/adapters/upstream-images.ts");
    // Import dinâmico é o que impede instanciar/chamar o provider ao carregar o
    // módulo (o teste nunca dispara uma chamada paga).
    expect(upstream).toMatch(/await import\("openai"\)/);
    expect(upstream).not.toMatch(/^\s*import\s+OpenAI\b/m);
  });
});
