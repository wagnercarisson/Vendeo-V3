import { describe, expect, it, vi } from "vitest";
import { buildAiModelSelectionView } from "../ai-model-selection-view";
import { catalogTupleKey, type AiModelCatalogRow } from "../ai-model-catalog-service";
import type { AiModelSelectionRow } from "../ai-model-selection-service";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const catalogRow = (capability: string, provider: string, model: string, protocol: string, status: string): AiModelCatalogRow => ({
  id: `${capability}-${model}`,
  capability,
  segment: capability === "campaign_copy" ? "text" : "image",
  provider,
  model,
  protocol,
  label: null,
  status,
  source_note: null,
  validated_at: null,
  created_at: "",
  updated_at: "",
});

const selection = (overrides: Partial<AiModelSelectionRow> = {}) => ({
  id: "selection-1",
  capability: "campaign_copy",
  provider: "openai",
  model: "deprecated-copy",
  protocol: "chat-completions",
  fallback_provider: "openai",
  fallback_model: "missing-fallback",
  fallback_protocol: "chat-completions",
  reason: "test",
  updated_by: "admin",
  updated_at: "",
  ...overrides,
}) as AiModelSelectionRow;

describe("buildAiModelSelectionView", () => {
  it("mostra a configuração default completa quando não há seleção", async () => {
    const rows = [
      catalogRow("campaign_copy", "openai", "gpt-4o", "chat-completions", "active"),
      catalogRow("campaign_copy", "gemini", "gemini-3.1-flash-lite", "gemini", "active"),
    ];
    const map = new Map(rows.map((row) => [catalogTupleKey(row.capability, row.provider, row.model, row.protocol), row]));
    const view = await buildAiModelSelectionView({
      catalogService: { getActiveCatalogRows: vi.fn().mockResolvedValue(rows), getCatalogMap: vi.fn().mockResolvedValue(map) },
      selectionService: { getSelectionMap: vi.fn().mockResolvedValue(new Map()) },
    });
    const copy = view.capabilities.find((item) => item.capability === "campaign_copy");
    expect(copy?.source).toBe("default");
    expect(copy?.current.fallback?.model).toBe("gemini-3.1-flash-lite");
  });

  it("calcula active/deprecated/missing pela tupla completa de primary e fallback", async () => {
    const rows = [
      catalogRow("campaign_copy", "openai", "gpt-4o", "chat-completions", "active"),
      catalogRow("campaign_copy", "openai", "deprecated-copy", "chat-completions", "deprecated"),
      catalogRow("campaign_copy", "openai", "missing-fallback", "responses", "active"),
    ];
    const map = new Map(rows.map((row) => [catalogTupleKey(row.capability, row.provider, row.model, row.protocol), row]));
    const view = await buildAiModelSelectionView({
      catalogService: {
        getActiveCatalogRows: vi.fn().mockResolvedValue(rows.filter((row) => row.status === "active")),
        getCatalogMap: vi.fn().mockResolvedValue(map),
      },
      selectionService: { getSelectionMap: vi.fn().mockResolvedValue(new Map([["campaign_copy", selection()]])) },
    });

    const copy = view.capabilities.find((item) => item.capability === "campaign_copy");
    expect(copy?.source).toBe("default");
    expect(copy?.current.primary.model).toBe("gpt-4o");
    expect(copy?.configured?.primary?.catalogStatus).toBe("deprecated");
    expect(copy?.configured?.fallback?.catalogStatus).toBe("missing");
    expect(copy?.default.primary.catalogStatus).toBe("active");
  });

  it("mantém seleção deprecated válida como configuração efetiva", async () => {
    const rows = [catalogRow("campaign_copy", "openai", "deprecated-copy", "chat-completions", "deprecated")];
    const map = new Map(rows.map((row) => [catalogTupleKey(row.capability, row.provider, row.model, row.protocol), row]));
    const view = await buildAiModelSelectionView({
      catalogService: { getActiveCatalogRows: vi.fn().mockResolvedValue([]), getCatalogMap: vi.fn().mockResolvedValue(map) },
      selectionService: { getSelectionMap: vi.fn().mockResolvedValue(new Map([["campaign_copy", selection({ fallback_provider: null, fallback_model: null, fallback_protocol: null })]])) },
    });
    const copy = view.capabilities.find((item) => item.capability === "campaign_copy");
    expect(copy?.source).toBe("selection");
    expect(copy?.current.primary.model).toBe("deprecated-copy");
    expect(copy?.current.primary.catalogStatus).toBe("deprecated");
  });

  it("mantém pricing independente por modelo ativo da mesma capacidade", async () => {
    const rows = [
      catalogRow("campaign_copy", "openai", "gpt-4o", "chat-completions", "active"),
      catalogRow("campaign_copy", "openai", "custom-no-price", "chat-completions", "active"),
    ];
    const map = new Map(rows.map((row) => [catalogTupleKey(row.capability, row.provider, row.model, row.protocol), row]));
    const view = await buildAiModelSelectionView({
      catalogService: { getActiveCatalogRows: vi.fn().mockResolvedValue(rows), getCatalogMap: vi.fn().mockResolvedValue(map) },
      selectionService: { getSelectionMap: vi.fn().mockResolvedValue(new Map()) },
      pricingService: vi.fn().mockResolvedValue([
        { capability: "campaign_copy", target: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" }, components: [], missingComponents: [], pricingCoverage: "complete", selectionAllowed: true },
        { capability: "campaign_copy", target: { provider: "openai", model: "custom-no-price", protocol: "chat-completions" }, components: [], missingComponents: ["input_tokens", "output_tokens"], pricingCoverage: "missing", selectionAllowed: true },
      ]),
    });
    const copy = view.capabilities.find((item) => item.capability === "campaign_copy");
    expect(copy?.pricingOptions).toHaveLength(2);
    expect(copy?.pricingOptions?.find((status) => status.target.model === "custom-no-price")?.pricingCoverage).toBe("missing");
  });
});
