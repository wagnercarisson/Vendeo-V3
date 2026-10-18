import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// O caminho de `brand_profile_text` importa `@/lib/ai` (gateway default) → sink
// padrão → cost-estimator → supabase/server. Sem env, o módulo lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/image-generation/prompt-loader", () => ({
  PromptLoader: class {
    load = vi.fn(() => "mocked prompt");
  },
}));

import { PersistedModelResolver } from "../persisted-model-resolver";
import {
  CAPABILITY_PROTOCOLS,
  MODEL_ALLOWLIST,
  MODEL_REGISTRY,
  ModelRegistry,
} from "../model-registry";
import { catalogTupleKey, type AiModelCatalogRow } from "../ai-model-catalog-service";
import type { AiModelSelectionRow } from "../ai-model-selection-service";
import { NoopAiTelemetrySink } from "@/lib/ai";
import type { AiInvoker, AiInvocationResult, AiTelemetryContext } from "@/lib/ai";

const MIGRATION = "supabase/migrations/20261018000002_quick_gpt6_luna_brand_profile_text.sql";

const catalogRow = (
  capability: string,
  provider: string,
  model: string,
  protocol: string,
): AiModelCatalogRow =>
  ({
    id: `${capability}-${model}`,
    capability,
    segment: "text",
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
    capability: "brand_profile_text",
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

describe("quick 261018-k9c — catálogo Luna em brand_profile_text", () => {
  it("migration forward-only registra a tupla de brand_profile_text e não toca campaign_copy", () => {
    const sql = readFileSync(path.resolve(process.cwd(), MIGRATION), "utf8");
    expect(sql).toContain(
      "('brand_profile_text', 'text', 'openai', 'gpt-6-luna', 'chat-completions'",
    );
    expect(sql).toContain("catalog_divergence");
    expect(sql).toContain("NULL);"); // validated_at NULL (não declarar validação inexistente)
    // Nenhum comando executável toca campaign_copy (menções só existem em comentários).
    const executable = sql
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(executable).not.toContain("campaign_copy");
  });

  it("resolução por capacidade de brand_profile_text atinge Luna quando selecionado", async () => {
    const resolver = resolverFor(selection({}), [
      catalogRow("brand_profile_text", "openai", "gpt-4o", "chat-completions"),
      catalogRow("brand_profile_text", "openai", "gpt-6-luna", "chat-completions"),
    ]);

    const { config, source } = await resolver.resolveWithSource("brand_profile_text");
    expect(source).toBe("selection");
    expect(config.primary).toMatchObject({
      provider: "openai",
      model: "gpt-6-luna",
      protocol: "chat-completions",
    });
    expect(config.fallback).toBeUndefined();
  });

  it("campaign_copy preserva seu default/configuração", async () => {
    // Nenhuma seleção de campaign_copy → resolve o default do registry (gpt-4o), intacto.
    const resolver = resolverFor(null, [
      catalogRow("brand_profile_text", "openai", "gpt-6-luna", "chat-completions"),
    ]);
    await expect(resolver.resolve("campaign_copy")).resolves.toEqual(MODEL_REGISTRY.campaign_copy);

    // Não foi necessária mudança de código: allowlist e protocolo já aceitam Luna em texto.
    expect(MODEL_ALLOWLIST.openai["gpt-6-luna"]).toContain("chat-completions");
    expect(CAPABILITY_PROTOCOLS.brand_profile_text).toContain("chat-completions");
  });
});

describe("quick 261018-k9c — contrato JSON de brand_profile_text com resposta simulada", () => {
  const TELEMETRY: AiTelemetryContext = {
    operationRunId: "run-luna",
    operationRunType: "brand_profile",
    traceId: "trace-luna",
    storeId: "store-1",
    sink: new NoopAiTelemetrySink(),
  };

  const simulated = {
    safe_color_tokens: {
      primary: "#112233",
      secondary: "#666666",
      accent: "#CC0000",
      background: "#FFFFFF",
    },
    visual_style: "Moderno",
    visual_tone: "Elegante",
    typography_direction: "Sans-serif",
    brand_personality: "Sofisticado",
    campaign_guidelines: "Guidelines",
    campaign_brief: "Brief",
    inferred_primary_color: "#112233",
    inferred_accent_color: "#CC0000",
    confidence_score: 0.8,
  };

  const input = {
    storeName: "Minha Loja",
    segment: "alimentacao",
    subsegment: null,
    toneOfVoice: "moderno",
    positioning: null,
    shortDescription: null,
    slogan: null,
    city: "São Paulo",
    state: "SP",
  };

  function makeLunaInvoker(content: string): AiInvoker {
    const invoke = vi.fn(
      async (
        _capability: string,
        _request: unknown,
        telemetry: AiTelemetryContext,
      ): Promise<AiInvocationResult> => {
        await telemetry.sink.emit({
          capability: "brand_profile_text",
          protocol: "chat-completions",
          status: "success",
          provider: "openai",
          model: "gpt-6-luna",
          usage: { promptTokens: 2000, completionTokens: 1000, totalTokens: 3000 },
          durationMs: 15,
        });
        return {
          content,
          model: "gpt-6-luna",
          usage: { promptTokens: 2000, completionTokens: 1000, totalTokens: 3000 },
        };
      },
    );
    return { invoke: invoke as unknown as AiInvoker["invoke"], hasFallback: vi.fn(async () => false) };
  }

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    (process.env as Record<string, string>).NODE_ENV = "test";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = "test";
  });

  it("preserva o parsing do contrato a partir da resposta simulada de Luna", async () => {
    const { BrandTextOnlyInferenceService } = await import(
      "@/lib/brand-assets/text-only-inference-service"
    );
    const service = new BrandTextOnlyInferenceService(makeLunaInvoker(JSON.stringify(simulated)));
    const onCall = vi.fn();

    const result = await service.infer(input, 30000, onCall, TELEMETRY);

    expect(result).toEqual(simulated);
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall.mock.calls[0][0].model).toBe("gpt-6-luna");
  });
});
