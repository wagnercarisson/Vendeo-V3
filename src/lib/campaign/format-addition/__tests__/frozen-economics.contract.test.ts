// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { AiModelCatalogRow } from "@/lib/ai/ai-model-catalog-service";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import type { ExpansionSelection } from "@/lib/ai/nine-sixteen-expansion-model-config";

import {
  captureFrozenEconomics,
  createFrozenExpansionReaders,
  parseFrozenEconomics,
  toFormatAdditionRpcPayload,
  type FrozenEconomics,
} from "../frozen-economics";

const CONFIG_VERSION_ID = "11111111-1111-4111-8111-111111111111";
const PRICING_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const CAPTURED_AT = "2026-11-23T12:00:00.000Z";

const PRICING: ModelPricing = {
  inputCostUsd: 1,
  cachedInputCostUsd: 0.5,
  imageInputTokenUsdPer1M: 2,
  imageTokenUsdPer1M: 30,
  imageCachedInputTokenUsdPer1M: 1,
  imageUnitCostUsd: 0.03,
};

const CATALOG_ROW: AiModelCatalogRow = {
  id: "catalog-row-1",
  capability: "campaign_product_image",
  segment: "campaign",
  provider: "openai",
  model: "gpt-image-2.5-flare",
  protocol: "images",
  label: "Flare",
  status: "active",
  source_note: null,
  validated_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const SELECTION: ExpansionSelection = {
  model: "gpt-image-2.5-flare",
  quality: "low",
  configVersionId: CONFIG_VERSION_ID,
  origin: "configured",
};

function readers(options: { rows?: AiModelCatalogRow[]; pricing?: ModelPricing | null } = {}) {
  const rows = options.rows ?? [CATALOG_ROW];
  const pricing = options.pricing === undefined ? PRICING : options.pricing;
  return {
    catalog: {
      getActiveCatalogRows: vi.fn(async () => rows),
      readActiveCatalogRows: vi.fn(async () => ({ kind: "ok" as const, rows })),
    },
    pricing: {
      getModelPricing: vi.fn(async () =>
        pricing === null ? null : { pricing, versionId: PRICING_VERSION_ID },
      ),
      readModelPricing: vi.fn(async () =>
        pricing === null
          ? { kind: "row_missing" as const }
          : { kind: "found" as const, pricing, versionId: PRICING_VERSION_ID },
      ),
    },
  };
}

function frozenFixture(overrides: Partial<FrozenEconomics> = {}): FrozenEconomics {
  return {
    selection: {
      model: "gpt-image-2.5-flare",
      quality: "low",
      configVersionId: CONFIG_VERSION_ID,
      selectionOrigin: "configured",
    },
    pricingVersionId: PRICING_VERSION_ID,
    pricing: PRICING,
    usdBrlRateAtGeneration: 5.5,
    creditValueBrlAtGeneration: 1.2,
    capturedAt: CAPTURED_AT,
    ...overrides,
  };
}

describe("F62-03 — economia congelada", () => {
  it("captura seleção, catálogo, pricing e economia uma única vez", async () => {
    const fake = readers();
    const readEconomicValues = vi.fn(async () => ({
      usdBrlRateAtGeneration: 5.5,
      creditValueBrlAtGeneration: 1.2,
    }));
    const client = { from: vi.fn() };

    const result = await captureFrozenEconomics(SELECTION, {
      client: client as never,
      catalog: fake.catalog,
      pricing: fake.pricing,
      readEconomicValues,
      now: () => new Date(CAPTURED_AT),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frozen).toMatchObject({
      selection: {
        model: "gpt-image-2.5-flare",
        quality: "low",
        configVersionId: CONFIG_VERSION_ID,
        selectionOrigin: "configured",
      },
      pricingVersionId: PRICING_VERSION_ID,
      usdBrlRateAtGeneration: 5.5,
      creditValueBrlAtGeneration: 1.2,
      capturedAt: CAPTURED_AT,
    });
    expect(result.frozen.pricing).toEqual(PRICING);
    expect(fake.catalog.readActiveCatalogRows).toHaveBeenCalledTimes(1);
    expect(fake.pricing.readModelPricing).toHaveBeenCalledTimes(1);
    expect(readEconomicValues).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("campanha legada usa a mesma seleção atual configured", async () => {
    const fake = readers();
    const result = await captureFrozenEconomics(SELECTION, {
      catalog: fake.catalog,
      pricing: fake.pricing,
      readEconomicValues: async () => ({
        usdBrlRateAtGeneration: null,
        creditValueBrlAtGeneration: null,
      }),
      now: () => new Date(CAPTURED_AT),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frozen.selection.selectionOrigin).toBe("configured");
    expect(result.frozen.selection.configVersionId).toBe(CONFIG_VERSION_ID);
  });

  it("rejeita seleção legada, modelo/qualidade inválidos ou sem versão", async () => {
    const fake = readers();
    const readEconomicValues = vi.fn(async () => ({
      usdBrlRateAtGeneration: null,
      creditValueBrlAtGeneration: null,
    }));

    for (const [selection, reason] of [
      [
        { ...SELECTION, origin: "legacy_sunburst_low" as const },
        "invalid_selection_origin",
      ],
      [{ ...SELECTION, model: "other-model" as never }, "invalid_selection_model"],
      [{ ...SELECTION, quality: "high" as never }, "invalid_selection_quality"],
      [{ ...SELECTION, configVersionId: null }, "invalid_selection_config_version"],
      [{ ...SELECTION, configVersionId: "not-uuid" }, "invalid_selection_config_version"],
    ] as const) {
      const result = await captureFrozenEconomics(selection as ExpansionSelection, {
        catalog: fake.catalog,
        pricing: fake.pricing,
        readEconomicValues,
      });
      expect(result).toMatchObject({ ok: false, reason });
    }

    expect(readEconomicValues).not.toHaveBeenCalled();
    expect(fake.catalog.readActiveCatalogRows).not.toHaveBeenCalled();
  });

  it("bloqueia modelo/pricing inválidos antes de ler economia", async () => {
    const readEconomicValues = vi.fn(async () => ({
      usdBrlRateAtGeneration: 1,
      creditValueBrlAtGeneration: 1,
    }));

    const noModel = readers({ rows: [] });
    const modelResult = await captureFrozenEconomics(SELECTION, {
      catalog: noModel.catalog,
      pricing: noModel.pricing,
      readEconomicValues,
    });
    expect(modelResult).toMatchObject({ ok: false, reason: "model_unavailable" });

    const noPricing = readers({ pricing: null });
    const pricingResult = await captureFrozenEconomics(SELECTION, {
      catalog: noPricing.catalog,
      pricing: noPricing.pricing,
      readEconomicValues,
    });
    expect(pricingResult).toMatchObject({
      ok: false,
      reason: "pricing_unavailable",
    });

    expect(readEconomicValues).not.toHaveBeenCalled();
  });

  it("falha na leitura econômica vira null explícito, nunca fallback", async () => {
    const fake = readers();
    const result = await captureFrozenEconomics(SELECTION, {
      catalog: fake.catalog,
      pricing: fake.pricing,
      readEconomicValues: async () => {
        throw new Error("economic down");
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frozen.usdBrlRateAtGeneration).toBeNull();
    expect(result.frozen.creditValueBrlAtGeneration).toBeNull();
    expect(result.frozen.pricing).toEqual(PRICING);
  });

  it("exporta payloads exatos para a RPC de abertura", () => {
    const payload = toFormatAdditionRpcPayload(frozenFixture());

    expect(payload.selection).toEqual({
      model: "gpt-image-2.5-flare",
      quality: "low",
      configVersionId: CONFIG_VERSION_ID,
      selectionOrigin: "configured",
    });
    expect(payload.frozenEconomics).toEqual({
      pricingVersionId: PRICING_VERSION_ID,
      pricing: PRICING,
      usdBrlRateAtGeneration: 5.5,
      creditValueBrlAtGeneration: 1.2,
      capturedAt: CAPTURED_AT,
    });
    expect(Object.keys(payload.frozenEconomics).sort()).toEqual([
      "capturedAt",
      "creditValueBrlAtGeneration",
      "pricing",
      "pricingVersionId",
      "usdBrlRateAtGeneration",
    ]);
  });

  it("leitores estáticos usam o congelado e recusam seleção divergente", async () => {
    const frozen = frozenFixture();
    const readers = createFrozenExpansionReaders(frozen);

    await expect(
      readers.preflightFrozenExpansion(SELECTION),
    ).resolves.toMatchObject({
      ok: true,
      model: "gpt-image-2.5-flare",
      quality: "low",
      pricing: PRICING,
      versionId: PRICING_VERSION_ID,
    });

    await expect(
      readers.preflightFrozenExpansion({
        ...SELECTION,
        model: "gpt-image-2.5-sunburst",
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure: "model_unavailable",
      detail: "frozen_selection_mismatch:model",
    });

    await expect(
      readers.preflightFrozenExpansion({ ...SELECTION, quality: "medium" }),
    ).resolves.toMatchObject({
      ok: false,
      failure: "model_unavailable",
      detail: "frozen_selection_mismatch:quality",
    });

    await expect(
      readers.preflightFrozenExpansion({
        ...SELECTION,
        configVersionId: "33333333-3333-4333-8333-333333333333",
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure: "model_unavailable",
      detail: "frozen_selection_mismatch:config_version",
    });

    await expect(
      readers.preflightFrozenExpansion({
        ...SELECTION,
        origin: "legacy_sunburst_low",
        configVersionId: null,
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure: "model_unavailable",
      detail: "frozen_selection_mismatch:config_version",
    });

    await expect(
      readers.preflightFrozenExpansion({
        ...SELECTION,
        origin: "legacy_sunburst_low",
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure: "model_unavailable",
      detail: "frozen_selection_mismatch:selection_origin",
    });

    await expect(
      readers.readEconomicSnapshot({
        campaignId: "ignored",
        storeId: "ignored",
      }),
    ).resolves.toEqual({
      usdBrlRateAtGeneration: 5.5,
      creditValueBrlAtGeneration: 1.2,
    });

    await expect(
      readers.pricing.getModelPricing({
        provider: "openai",
        model: "gpt-image-2.5-sunburst",
        quality: "low",
      }),
    ).resolves.toBeNull();
    await expect(
      readers.pricing.readModelPricing!({
        provider: "openai",
        model: "gpt-image-2.5-flare",
        quality: "medium",
      }),
    ).resolves.toMatchObject({ kind: "read_failed" });
    await expect(readers.catalog.getActiveCatalogRows()).resolves.toHaveLength(1);
  });

  it("parse do congelado aceita roundtrip e bloqueia estrutura inválida", () => {
    const frozen = frozenFixture();
    const valid = parseFrozenEconomics(frozen.selection, {
      pricingVersionId: frozen.pricingVersionId,
      pricing: frozen.pricing,
      usdBrlRateAtGeneration: frozen.usdBrlRateAtGeneration,
      creditValueBrlAtGeneration: frozen.creditValueBrlAtGeneration,
      capturedAt: frozen.capturedAt,
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.frozen).toEqual(frozen);

    for (const [selection, payload] of [
      [{ ...frozen.selection, selectionOrigin: "legacy" }, frozen],
      [frozen.selection, { ...frozen, pricingVersionId: "not-uuid" }],
      [frozen.selection, { ...frozen, pricing: {} }],
      [frozen.selection, { ...frozen, capturedAt: "not-a-date" }],
      [
        frozen.selection,
        {
          pricingVersionId: frozen.pricingVersionId,
          pricing: frozen.pricing,
          usdBrlRateAtGeneration: 5.5,
          capturedAt: frozen.capturedAt,
        },
      ],
      [
        frozen.selection,
        {
          pricingVersionId: frozen.pricingVersionId,
          pricing: frozen.pricing,
          usdBrlRateAtGeneration: "5.5",
          creditValueBrlAtGeneration: 1.2,
          capturedAt: frozen.capturedAt,
        },
      ],
    ] as const) {
      expect(parseFrozenEconomics(selection, payload).ok).toBe(false);
    }
  });

  it("não importa nem chama o snapshot econômico da campanha original", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "src/lib/campaign/format-addition/frozen-economics.ts",
      "utf8",
    );

    expect(source).not.toContain("readExpansionEconomicSnapshot");
    expect(source).not.toContain("economic-snapshot-reader");
    expect(source).not.toMatch(/from\s+["']@\/lib\/product-9-16-two-stage/);
    expect(source).not.toContain("campaigns");
  });
});
