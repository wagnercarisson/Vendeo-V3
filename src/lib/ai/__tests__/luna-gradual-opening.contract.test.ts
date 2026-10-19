import { describe, expect, it, vi } from "vitest";
import { PersistedModelResolver } from "../persisted-model-resolver";
import { ModelRegistry } from "../model-registry";
import { catalogTupleKey, type AiModelCatalogRow } from "../ai-model-catalog-service";
import type { AiModelSelectionRow } from "../ai-model-selection-service";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const row = (capability: string, model = "gpt-6-luna"): AiModelCatalogRow =>
  ({
    id: `${capability}-${model}`,
    capability,
    segment: capability.includes("vision") ? "vision" : "text",
    provider: "openai",
    model,
    protocol: "chat-completions",
    label: null,
    status: "active",
    source_note: null,
    validated_at: null,
    created_at: "",
    updated_at: "",
  }) as AiModelCatalogRow;

const selection = (overrides: Partial<AiModelSelectionRow> = {}): AiModelSelectionRow =>
  ({
    id: "s1",
    capability: "brand_profile_text",
    provider: "openai",
    model: "gpt-6-luna",
    protocol: "chat-completions",
    fallback_provider: null,
    fallback_model: null,
    fallback_protocol: null,
    reason: "f56-2e",
    updated_by: null,
    updated_at: "",
    ...overrides,
  }) as AiModelSelectionRow;

function resolver(sel: AiModelSelectionRow | null, rows: AiModelCatalogRow[]) {
  return new PersistedModelResolver({
    registry: new ModelRegistry(),
    selectionService: { getSelectionMap: async () => new Map(sel ? [[sel.capability, sel]] : []) },
    catalogService: {
      getCatalogMap: async () =>
        new Map(rows.map((r) => [catalogTupleKey(r.capability, r.provider, r.model, r.protocol), r])),
    },
  });
}

describe("F56.2e - Luna nas tres capacidades", () => {
  for (const capability of [
    "campaign_copy",
    "brand_profile_text",
    "brand_profile_vision",
  ] as const) {
    it(`resolve ${capability} para Luna quando selecionado`, async () => {
      const result = await resolver(selection({ capability }), [row(capability)]).resolveWithSource(
        capability,
      );
      expect(result.source).toBe("selection");
      expect(result.config.primary).toMatchObject({ provider: "openai", model: "gpt-6-luna" });
    });
  }

  it("brand_profile_text com fallback preenchido descarta a selecao (volta ao default)", async () => {
    const result = await resolver(
      selection({
        capability: "brand_profile_text",
        fallback_provider: "openai",
        fallback_model: "gpt-4o",
        fallback_protocol: "chat-completions",
      }),
      [row("brand_profile_text"), row("brand_profile_text", "gpt-4o")],
    ).resolveWithSource("brand_profile_text");
    expect(result.source).toBe("default");
    expect(result.config.primary.model).toBe("gpt-4o");
  });

  it("campaign_copy aceita fallback completo e distinto", async () => {
    const result = await resolver(
      selection({
        capability: "campaign_copy",
        fallback_provider: "gemini",
        fallback_model: "gemini-3.1-flash-lite",
        fallback_protocol: "gemini",
      }),
      [
        row("campaign_copy"),
        {
          ...row("campaign_copy", "gemini-3.1-flash-lite"),
          provider: "gemini",
          protocol: "gemini",
        } as AiModelCatalogRow,
      ],
    ).resolveWithSource("campaign_copy");
    expect(result.source).toBe("selection");
    expect(result.config.fallback).toMatchObject({ provider: "gemini" });
  });
});
