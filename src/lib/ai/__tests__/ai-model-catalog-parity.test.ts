import { describe, expect, it, vi } from "vitest";
import {
  ALL_CAPABILITIES,
  CAPABILITY_PROTOCOLS,
  CAPABILITY_SEGMENTS,
  MODEL_REGISTRY,
  MODEL_ALLOWLIST,
} from "../model-registry";
import { catalogTupleKey, type AiModelCatalogRow } from "../ai-model-catalog-service";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const catalog: AiModelCatalogRow[] = [
  ["campaign_copy", "text", "openai", "gpt-4o", "chat-completions"],
  ["campaign_copy", "text", "gemini", "gemini-3.1-flash-lite", "gemini"],
  ["campaign_correction_analysis", "text", "openai", "gpt-4o", "chat-completions"],
  ["brand_profile_text", "text", "openai", "gpt-4o", "chat-completions"],
  ["campaign_spec", "text", "openai", "gpt-4o-mini", "chat-completions"],
  ["campaign_input_validation", "vision", "openai", "gpt-4o", "chat-completions"],
  ["campaign_image_review", "vision", "openai", "gpt-4o", "chat-completions"],
  ["brand_profile_vision", "vision", "openai", "gpt-4o", "chat-completions"],
  ["visual_signature_validation", "vision", "openai", "gpt-4o-mini", "responses"],
  ["campaign_image", "image", "openai", "gpt-5.5", "responses"],
  ["campaign_image_edit", "image", "openai", "gpt-image-2", "images"],
  ["visual_signature_image", "image", "openai", "gpt-5.5", "responses"],
].map(([capability, segment, provider, model, protocol], index) => ({
  id: `catalog-${index}`,
  capability,
  segment,
  provider,
  model,
  protocol,
  label: null,
  status: "active",
  source_note: null,
  validated_at: null,
  created_at: "",
  updated_at: "",
}));

const map = new Map(catalog.map((row) => [catalogTupleKey(row.capability, row.provider, row.model, row.protocol), row]));

describe("registry × catalog parity", () => {
  it("contém exatamente os 12 seeds e todos os defaults primary/fallback", () => {
    expect(catalog).toHaveLength(12);
    for (const capability of ALL_CAPABILITIES) {
      const config = MODEL_REGISTRY[capability];
      for (const target of [config.primary, config.fallback].filter(Boolean)) {
        expect(map.has(catalogTupleKey(capability, target!.provider, target!.model, target!.protocol))).toBe(true);
      }
    }
  });

  it("mantém segmentos, protocolos e pareamento provider/protocol canônicos", () => {
    for (const row of catalog) {
      expect(row.segment).toBe(CAPABILITY_SEGMENTS[row.capability as keyof typeof CAPABILITY_SEGMENTS]);
      expect(CAPABILITY_PROTOCOLS[row.capability as keyof typeof CAPABILITY_PROTOCOLS]).toContain(row.protocol);
      expect(MODEL_ALLOWLIST[row.provider as keyof typeof MODEL_ALLOWLIST]?.[row.model] ?? (row.provider === "openai" ? ["chat-completions", "responses", "images"] : ["gemini"])).toContain(row.protocol);
      if (row.provider === "gemini") expect(row.protocol).toBe("gemini");
      if (row.provider === "openai") expect(["chat-completions", "responses", "images"]).toContain(row.protocol);
    }
  });
});
