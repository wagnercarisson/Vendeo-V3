import { describe, expect, it, vi } from "vitest";
import { PersistedModelResolver } from "../persisted-model-resolver";
import { MODEL_REGISTRY, ModelRegistry } from "../model-registry";
import { catalogTupleKey, type AiModelCatalogRow } from "../ai-model-catalog-service";
import type { AiModelSelectionRow } from "../ai-model-selection-service";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const catalogRow = (capability: string, provider: string, model: string, protocol: string, status = "active") => ({
  id: `${capability}-${model}`,
  capability,
  segment: MODEL_REGISTRY[capability as keyof typeof MODEL_REGISTRY]?.segment ?? "text",
  provider,
  model,
  protocol,
  label: null,
  status,
  source_note: null,
  validated_at: null,
  created_at: "",
  updated_at: "",
}) as AiModelCatalogRow;

const selectionRow = (overrides: Partial<AiModelSelectionRow> = {}) => ({
  id: "selection-1",
  capability: "campaign_copy",
  provider: "openai",
  model: "gpt-4o",
  protocol: "chat-completions",
  fallback_provider: null,
  fallback_model: null,
  fallback_protocol: null,
  reason: "test",
  updated_by: null,
  updated_at: "",
  ...overrides,
}) as AiModelSelectionRow;

function resolverFor(
  selection: AiModelSelectionRow | null,
  rows: AiModelCatalogRow[],
  selectionError = false,
  catalogError = false,
) {
  return new PersistedModelResolver({
    registry: new ModelRegistry(),
    selectionService: {
      getSelectionMap: selectionError
        ? vi.fn().mockRejectedValue(new Error("selection unavailable"))
        : vi.fn().mockResolvedValue(new Map(selection ? [[selection.capability, selection]] : [])),
    },
    catalogService: {
      getCatalogMap: catalogError
        ? vi.fn().mockRejectedValue(new Error("catalog unavailable"))
        : vi.fn().mockResolvedValue(new Map(rows.map((row) => [catalogTupleKey(row.capability, row.provider, row.model, row.protocol), row]))),
    },
  });
}

describe("PersistedModelResolver", () => {
  it("dá precedência à seleção válida e aceita modelo adicional catalogado", async () => {
    const resolver = resolverFor(
      selectionRow({ model: "custom-text-model" }),
      [catalogRow("campaign_copy", "openai", "custom-text-model", "chat-completions")],
    );

    const config = await resolver.resolve("campaign_copy");
    expect(config.primary.model).toBe("custom-text-model");
  });

  it("mantém seleção vigente deprecated executável", async () => {
    const resolver = resolverFor(
      selectionRow({ model: "deprecated-text-model" }),
      [catalogRow("campaign_copy", "openai", "deprecated-text-model", "chat-completions", "deprecated")],
    );

    await expect(resolver.resolve("campaign_copy")).resolves.toMatchObject({
      primary: { model: "deprecated-text-model" },
    });
  });

  it.each([
    ["ausente", resolverFor(null, [])],
    ["erro de seleção", resolverFor(selectionRow(), [], true)],
    ["erro de catálogo", resolverFor(selectionRow(), [], false, true)],
    ["tupla missing", resolverFor(selectionRow({ model: "missing" }), [])],
    ["seleção parcial", resolverFor(selectionRow({ model: "" }), [catalogRow("campaign_copy", "openai", "gpt-4o", "chat-completions")])],
    ["protocolo incompatível", resolverFor(selectionRow({ protocol: "responses" }), [catalogRow("campaign_copy", "openai", "gpt-4o", "responses")])],
    ["primary igual ao fallback", resolverFor(selectionRow({ fallback_provider: "openai", fallback_model: "gpt-4o", fallback_protocol: "chat-completions" }), [catalogRow("campaign_copy", "openai", "gpt-4o", "chat-completions")])],
    ["fallback em capacidade sem caller", resolverFor(selectionRow({ capability: "campaign_image", fallback_provider: "openai", fallback_model: "gpt-image-2", fallback_protocol: "images", model: "gpt-5.5", protocol: "responses" }), [catalogRow("campaign_image", "openai", "gpt-5.5", "responses"), catalogRow("campaign_image", "openai", "gpt-image-2", "images")])],
  ])("usa o default completo no caso %s", async (_name, resolver) => {
    await expect(resolver.resolve("campaign_copy")).resolves.toEqual(MODEL_REGISTRY.campaign_copy);
  });

  it("três campos nulos desabilitam fallback", async () => {
    const resolver = resolverFor(selectionRow(), [catalogRow("campaign_copy", "openai", "gpt-4o", "chat-completions")]);
    const config = await resolver.resolve("campaign_copy");
    expect(config.fallback).toBeUndefined();
  });

  it("lista as capacidades do registry sem consultar o banco", () => {
    const resolver = resolverFor(null, []);
    expect(resolver.listCapabilities()).toHaveLength(11);
  });
});
