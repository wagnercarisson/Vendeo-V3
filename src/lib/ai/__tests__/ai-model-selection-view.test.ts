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
  it("calcula active/deprecated/missing pela tupla completa de primary e fallback", async () => {
    const rows = [
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
    expect(copy?.source).toBe("selection");
    expect(copy?.current.primary.catalogStatus).toBe("deprecated");
    expect(copy?.current.fallback?.catalogStatus).toBe("missing");
    expect(copy?.default.primary.catalogStatus).toBe("missing");
  });
});
