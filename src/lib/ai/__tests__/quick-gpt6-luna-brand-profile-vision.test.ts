import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { PersistedModelResolver } from "../persisted-model-resolver";
import {
  CAPABILITY_PROTOCOLS,
  MODEL_ALLOWLIST,
  MODEL_REGISTRY,
  ModelRegistry,
} from "../model-registry";
import { catalogTupleKey, type AiModelCatalogRow } from "../ai-model-catalog-service";
import type { AiModelSelectionRow } from "../ai-model-selection-service";

const MIGRATION = "supabase/migrations/20261018000003_quick_gpt6_luna_brand_profile_vision.sql";

const catalogRow = (
  capability: string,
  provider: string,
  model: string,
  protocol: string,
): AiModelCatalogRow =>
  ({
    id: `${capability}-${model}`,
    capability,
    segment: capability === "brand_profile_vision" ? "vision" : "text",
    provider,
    model,
    protocol,
    label: null,
    status: "active",
    source_note: null,
    validated_at: null,
    created_at: "",
    updated_at: "",
  }) as AiModelCatalogRow;

const selection = (overrides: Partial<AiModelSelectionRow>): AiModelSelectionRow =>
  ({
    id: "selection-1",
    capability: "brand_profile_vision",
    provider: "openai",
    model: "gpt-6-luna",
    protocol: "chat-completions",
    fallback_provider: null,
    fallback_model: null,
    fallback_protocol: null,
    reason: "quick-261018-k9c",
    updated_by: null,
    updated_at: "",
    ...overrides,
  }) as AiModelSelectionRow;

function resolverFor(row: AiModelSelectionRow | null, rows: AiModelCatalogRow[]) {
  return new PersistedModelResolver({
    registry: new ModelRegistry(),
    selectionService: {
      getSelectionMap: vi.fn(async () => new Map(row ? [[row.capability, row]] : [])),
    },
    catalogService: {
      getCatalogMap: vi.fn(
        async () =>
          new Map(
            rows.map((r) => [catalogTupleKey(r.capability, r.provider, r.model, r.protocol), r]),
          ),
      ),
    },
  });
}

describe("quick 261018-k9c — Luna em brand_profile_vision (catálogo + resolução)", () => {
  it("migration forward-only registra a tupla de brand_profile_vision e não toca as demais capacidades", () => {
    const sql = readFileSync(path.resolve(process.cwd(), MIGRATION), "utf8");
    expect(sql).toContain(
      "('brand_profile_vision', 'vision', 'openai', 'gpt-6-luna', 'chat-completions'",
    );
    expect(sql).toContain("catalog_divergence");
    expect(sql).toContain("NULL);"); // validated_at NULL
    const executable = sql
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(executable).not.toContain("campaign_copy");
    expect(executable).not.toContain("brand_profile_text");
  });

  it("resolução por capacidade de brand_profile_vision atinge Luna quando selecionado", async () => {
    const resolver = resolverFor(selection({}), [
      catalogRow("brand_profile_vision", "openai", "gpt-4o", "chat-completions"),
      catalogRow("brand_profile_vision", "openai", "gpt-6-luna", "chat-completions"),
    ]);

    const { config, source } = await resolver.resolveWithSource("brand_profile_vision");
    expect(source).toBe("selection");
    expect(config.primary).toMatchObject({
      provider: "openai",
      model: "gpt-6-luna",
      protocol: "chat-completions",
    });
    expect(config.fallback).toBeUndefined();
    expect(MODEL_ALLOWLIST.openai["gpt-6-luna"]).toContain("chat-completions");
    expect(CAPABILITY_PROTOCOLS.brand_profile_vision).toContain("chat-completions");
  });

  it("preserva brand_profile_text e campaign_copy (sem seleção → defaults intactos)", async () => {
    const resolver = resolverFor(null, [
      catalogRow("brand_profile_vision", "openai", "gpt-6-luna", "chat-completions"),
    ]);
    await expect(resolver.resolve("brand_profile_text")).resolves.toEqual(MODEL_REGISTRY.brand_profile_text);
    await expect(resolver.resolve("campaign_copy")).resolves.toEqual(MODEL_REGISTRY.campaign_copy);
  });
});
