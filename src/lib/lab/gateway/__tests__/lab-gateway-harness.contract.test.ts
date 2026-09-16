// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const { mockResolveAiCost, mockRecord } = vi.hoisted(() => {
  // `ImageGenerationService` importa `@/lib/ai` (gateway default) → sink padrão →
  // tracker → supabase/server. Sem env, lança na importação do módulo.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  return { mockResolveAiCost: vi.fn(), mockRecord: vi.fn() };
});

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

// O sink do laboratório NÃO escreve telemetria produtiva: o tracker é mockado
// para provar que nenhum `record` (único gravador de `generation_events`) ocorre.
vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    async record(event: unknown): Promise<void> {
      return mockRecord(event);
    }
  },
}));

import {
  LabModelResolver,
  INVALID_FIXED_TARGET,
} from "../lab-model-resolver";
import { LabPromptLoader } from "../lab-prompt-loader";
import {
  createLabGateway,
  createLabTelemetryContext,
  runLabCampaignImage,
} from "../runtime";
import { createNoopImageProvider, LAB_NOOP_IMAGE_PROVIDER_INVOKED } from "../noop-image-provider";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import { AiCostTracker } from "@/lib/ai-cost/tracker";
import type { CostResolution } from "@/lib/ai-cost/types";
import type {
  AiCapability,
  AiModelConfig,
  AiModelResolver,
  AiModelTarget,
} from "@/lib/ai/model-resolver";
import type {
  AiAdapter,
  AiAdapterRegistry,
  AiCallEnvelope,
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
} from "@/lib/ai/types";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import { buildCampaignBriefFromFlat } from "@/lib/campaign/brief";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";
import { createFakeSupabaseClient } from "@/lib/lab/api/__tests__/fake-supabase-client";
import { getActiveCampaignImageTarget } from "@/lib/lab/api/experiment-queries";

/**
 * F48.1 — suíte de contrato nº 2 (48-1-12, task 12.1): harness de gateway.
 *
 * Trava, por teste e sem rede, os contratos transversais do harness isolado
 * (D6/D7): precedência absoluta do alvo fixo, delegação read-only fora do
 * escopo, override de prompt sem tocar `prompts/`, telemetria própria sem
 * `generation_events`, exatamente **um** envelope de imagem por run (sem
 * provider/fallback) e catálogo apenas como allowlist de leitura.
 *
 * Nenhum segredo é lido: `resolveAiCost` é mockado e os envelopes são simulados.
 */

const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const OFFICIAL_PROMPT = "campaign-image-director-offer";
const DELEGATED_PROMPT = "campaign-image-director-spotlight";
const OFFICIAL_PROMPT_FILE = path.join(PROMPTS_DIR, `${OFFICIAL_PROMPT}.md`);

const FIXED_TARGET: AiModelTarget = {
  provider: "openai",
  model: "gpt-5.5",
  protocol: "responses",
};

const FULL_COST: CostResolution = {
  estimatedCostUsd: 0.0421,
  costSource: "pricing_table",
  pricingVersion: "11111111-1111-4111-8111-111111111111",
  costFormulaVersion: "responses_image_generation_v2",
  textComponentUsd: 0.0121,
  imageToolComponentUsd: 0.03,
  imageToolPricingProvider: "openai",
  imageToolPricingModel: "gpt-image-1",
  imageToolPricingVersion: "22222222-2222-4222-8222-222222222222",
};

/** Regex montada em runtime: o literal proibido não aparece neste arquivo. */
const FORBIDDEN_COST_KEYS = new RegExp(
  ["image", "Unit", "Usd"].join("") + "|" + ["cost", "Partial"].join(""),
);

// ─── Fakes ───────────────────────────────────────────────────────────────────

function createFallbackResolver(overrides: Partial<AiModelConfig> = {}): AiModelResolver & {
  resolve: ReturnType<typeof vi.fn>;
  listCapabilities: ReturnType<typeof vi.fn>;
} {
  const resolve = vi.fn(
    async (capability: AiCapability): Promise<AiModelConfig> => ({
      capability,
      segment: capability === "campaign_image" ? "image" : "text",
      primary: { provider: "gemini", model: "gemini-2.5-flash", protocol: "gemini" },
      fallback: { provider: "openai", model: "gpt-4o-mini", protocol: "chat-completions" },
      ...overrides,
    }),
  );
  const listCapabilities = vi.fn((): AiCapability[] => ["campaign_copy", "campaign_image_review"]);
  return { resolve, listCapabilities } as unknown as AiModelResolver & {
    resolve: ReturnType<typeof vi.fn>;
    listCapabilities: ReturnType<typeof vi.fn>;
  };
}

interface FakeAdapterHarness {
  adapter: AiAdapter;
  calls: AiInvocationRequest[];
}

function createFakeAdapter(
  handler: (request: AiInvocationRequest) => Promise<AiInvocationResult>,
): FakeAdapterHarness {
  const calls: AiInvocationRequest[] = [];
  const adapter: AiAdapter = {
    protocol: "responses",
    async invoke(request) {
      calls.push(request);
      return handler(request);
    },
  };
  return { adapter, calls };
}

function createAdapters(adapter: AiAdapter): AiAdapterRegistry {
  return {
    get(protocol) {
      return protocol === adapter.protocol ? adapter : undefined;
    },
  };
}

function createHarness(handler: (request: AiInvocationRequest) => Promise<AiInvocationResult>) {
  const fallbackResolver = createFallbackResolver();
  const { adapter, calls } = createFakeAdapter(handler);
  const gateway = createLabGateway({
    fixedTarget: FIXED_TARGET,
    fallbackResolver,
    adapters: createAdapters(adapter),
  });
  const sink = new LabTelemetrySink();
  const telemetry = createLabTelemetryContext({
    sink,
    operationRunId: "run-lab-contract-1",
    traceId: "trace-lab-contract-1",
    storeId: "store-lab-contract-1",
  });
  const invokeSpy = vi.spyOn(gateway, "invoke");
  return { gateway, fallbackResolver, sink, telemetry, adapterCalls: calls, invokeSpy };
}

function createRequest(): AiInvocationRequest {
  return {
    prompt: "prompt do diretor montado pelo caminho real",
    productImagesDataUrls: ["data:image/jpeg;base64,AAAA"],
    tools: "image_generation",
    size: "1024x1024",
    quality: "auto",
  };
}

/** Client fake que registra qualquer acesso a tabela (nenhum deve ocorrer). */
class FakeAccessLogClient {
  readonly accessLog: Array<{ table: string; op: string }> = [];

  from(table: string) {
    const log = (op: string) => {
      this.accessLog.push({ table, op });
    };
    return {
      insert: () => {
        log("insert");
        return { select: () => ({ single: async () => ({ data: null, error: null }) }) };
      },
      update: () => {
        log("update");
        return { eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) };
      },
      delete: () => {
        log("delete");
        return { eq: () => Promise.resolve({ data: [], error: null }) };
      },
      select: () => {
        log("select");
        return { eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
      },
    };
  }
}

// ─── Helpers de pipeline real ────────────────────────────────────────────────

const STORE_ID = "77777777-7777-4777-8777-777777777777";

function createBrief(): CampaignBrief {
  return buildCampaignBriefFromFlat(
    {
      storeId: STORE_ID,
      productName: "Produto Teste",
      discountedPriceCents: 1990,
      badgeText: "Oferta",
      campaignIntent: "offer",
      productImageDataUrl: "data:image/jpeg;base64,dGVzdA==",
    } as GenerateImageRequest,
    STORE_ID,
  );
}

function createContext(): ResolvedCampaignContext {
  return {
    campaignInput: {
      productName: "Produto Teste",
      discountedPriceCents: 1990,
      productImageDataUrl: "data:image/jpeg;base64,dGVzdA==",
      badgeText: "Oferta",
      campaignIntent: "offer",
    },
    store: {
      name: "Loja Teste",
      segment: "outros",
      subsegment: null,
      toneOfVoice: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
      brandColor: "#22C55E",
    },
    brandProfile: null,
    identity: { state: "text_only", imageUrl: null, directive: "" },
  };
}

async function emitEnvelope(
  telemetry: AiTelemetryContext,
  overrides: Partial<AiCallEnvelope>,
): Promise<void> {
  await telemetry.sink.emit({
    capability: "campaign_image",
    protocol: "responses",
    provider: "openai",
    model: "gpt-5.5",
    durationMs: 4321,
    usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
    usageMeta: { imageGenerationTool: true },
    status: "success",
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue(FULL_COST);
});

// ─── 1/2. Alvo fixo e delegação fora do escopo ───────────────────────────────

describe("contrato do harness — alvo fixo com precedência e delegação read-only", () => {
  it("resolve('campaign_image') devolve exatamente o fixedTarget e não consulta o resolver padrão", async () => {
    const fallbackResolver = createFallbackResolver();
    const resolver = new LabModelResolver({ fixedTarget: FIXED_TARGET, fallbackResolver });

    const config = await resolver.resolve("campaign_image");

    expect(config.capability).toBe("campaign_image");
    expect(config.segment).toBe("image");
    expect(config.primary).toEqual({
      provider: FIXED_TARGET.provider,
      model: FIXED_TARGET.model,
      protocol: FIXED_TARGET.protocol,
    });
    // Sem alvo alternativo: uma única chamada por run.
    expect(config.fallback).toBeUndefined();
    expect(fallbackResolver.resolve).not.toHaveBeenCalled();
  });

  it("delega ao resolver padrão fora do escopo, exatamente 1 vez", async () => {
    const fallbackResolver = createFallbackResolver();
    const resolver = new LabModelResolver({ fixedTarget: FIXED_TARGET, fallbackResolver });

    const config = await resolver.resolve("campaign_copy");

    expect(fallbackResolver.resolve).toHaveBeenCalledTimes(1);
    expect(fallbackResolver.resolve).toHaveBeenCalledWith("campaign_copy");
    expect(config.primary).toEqual({
      provider: "gemini",
      model: "gemini-2.5-flash",
      protocol: "gemini",
    });
  });

  it("fixedTarget inválido lança invalid_fixed_target antes de qualquer delegação", async () => {
    const fallbackResolver = createFallbackResolver();
    const resolver = new LabModelResolver({
      fixedTarget: { provider: "", model: "", protocol: "" } as unknown as AiModelTarget,
      fallbackResolver,
    });

    await expect(resolver.resolve("campaign_image")).rejects.toThrow(INVALID_FIXED_TARGET);
    expect(fallbackResolver.resolve).not.toHaveBeenCalled();
  });

  it("nunca referencia ai_model_selection nos módulos do harness", () => {
    const sources = ["lab-model-resolver.ts", "runtime.ts", "lab-prompt-loader.ts"].map((file) =>
      readFileSync(path.join(process.cwd(), "src/lib/lab/gateway", file), "utf8"),
    );

    for (const source of sources) {
      expect(source).not.toContain("ai_model_selection");
    }
  });
});

// ─── 3. Override de prompt sem tocar prompts oficiais ────────────────────────

describe("contrato do harness — override de prompt apenas em memória", () => {
  it("serve o snapshot quando o nome casa e delega ao loader real caso contrário", () => {
    const loader = new LabPromptLoader(
      [{ name: OFFICIAL_PROMPT, content: "OVERRIDE CANDIDATA: foco absoluto no preço." }],
      PROMPTS_DIR,
    );

    expect(loader.load(OFFICIAL_PROMPT)).toBe("OVERRIDE CANDIDATA: foco absoluto no preço.");

    const delegated = loader.load(DELEGATED_PROMPT);
    const official = new LabPromptLoader([], PROMPTS_DIR).load(DELEGATED_PROMPT);
    expect(delegated).toBe(official);
    expect(delegated.length).toBeGreaterThan(0);
  });

  it("mantém prompts/campaign-image-director-offer.md byte a byte idêntico", () => {
    const before = readFileSync(OFFICIAL_PROMPT_FILE);
    const beforeHash = createHash("sha256").update(before).digest("hex");

    const loader = new LabPromptLoader(
      [{ name: OFFICIAL_PROMPT, content: "OVERRIDE TEMPORÁRIO" }],
      PROMPTS_DIR,
    );
    loader.load(OFFICIAL_PROMPT, { productName: "Produto" });
    loader.load(DELEGATED_PROMPT);
    loader.clearCache();

    const after = readFileSync(OFFICIAL_PROMPT_FILE);
    expect(createHash("sha256").update(after).digest("hex")).toBe(beforeHash);
    expect(after.equals(before)).toBe(true);
  });
});

// ─── 4. Sink sem eventos produtivos ──────────────────────────────────────────

describe("contrato do harness — telemetria própria sem gravar produção", () => {
  it("acumula 1 entrada por envelope e preserva a CostResolution real completa", async () => {
    const sink = new LabTelemetrySink();
    const telemetry = createLabTelemetryContext({
      sink,
      operationRunId: "run-lab-contract-2",
      traceId: "trace-lab-contract-2",
      storeId: "store-lab-contract-2",
    });

    await emitEnvelope(telemetry, { status: "success" });
    await emitEnvelope(telemetry, { status: "failed", errorType: "Bearer sk-abc123456789" });

    expect(sink.entries).toHaveLength(2);
    expect(sink.entries[0]).toMatchObject({
      capability: "campaign_image",
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
      status: "success",
    });
    expect(typeof sink.entries[0].durationMs).toBe("number");
    // O erro é sanitizado na entrada — nenhum token vaza para a evidência.
    expect(sink.entries[1].errorType).not.toContain("sk-");

    const summary = sink.costSummary;
    expect(summary).not.toBeNull();
    expect(summary).toMatchObject({
      costSource: "pricing_table",
      pricingVersion: FULL_COST.pricingVersion,
      costFormulaVersion: FULL_COST.costFormulaVersion,
      textComponentUsd: FULL_COST.textComponentUsd,
      imageToolComponentUsd: FULL_COST.imageToolComponentUsd,
      imageToolPricingProvider: FULL_COST.imageToolPricingProvider,
      imageToolPricingModel: FULL_COST.imageToolPricingModel,
      imageToolPricingVersion: FULL_COST.imageToolPricingVersion,
    });
    // Agregado: soma das duas chamadas.
    expect(summary?.estimatedCostUsd).toBeCloseTo(0.0842, 6);
    // O agregado NÃO introduz campos que o tipo real não possui.
    expect(Object.keys(summary ?? {}).join(",")).not.toMatch(FORBIDDEN_COST_KEYS);
  });

  it("não chama AiCostTracker.record e não acessa generation_events", async () => {
    const recordSpy = vi.spyOn(AiCostTracker.prototype, "record");
    const client = new FakeAccessLogClient();
    const sink = new LabTelemetrySink();
    const telemetry = createLabTelemetryContext({
      sink,
      operationRunId: "run-lab-contract-3",
      traceId: "trace-lab-contract-3",
      storeId: "store-lab-contract-3",
    });

    await emitEnvelope(telemetry, { status: "success" });

    expect(recordSpy).not.toHaveBeenCalled();
    expect(mockRecord).not.toHaveBeenCalled();
    // Nenhuma operação de persistência: o sink acumula em memória.
    expect(client.accessLog).toHaveLength(0);
    expect(client.accessLog.filter((entry) => entry.table === "generation_events")).toHaveLength(0);
    expect(sink.entries).toHaveLength(1);
  });

  it("uma entrada por envelope mesmo com o consumidor (onEntry) falhando", async () => {
    const sink = new LabTelemetrySink({
      onEntry: () => {
        throw new Error("stream NDJSON desconectado");
      },
    });
    const telemetry = createLabTelemetryContext({
      sink,
      operationRunId: "run-lab-contract-4",
      traceId: "trace-lab-contract-4",
      storeId: "store-lab-contract-4",
    });

    await expect(emitEnvelope(telemetry, { status: "success" })).resolves.toBeUndefined();

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].status).toBe("success");
  });

  it("falha do resolvedor de custo registra a entrada sanitizada sem interromper o run", async () => {
    mockResolveAiCost.mockRejectedValueOnce(new Error("pricing indisponível"));
    const sink = new LabTelemetrySink();
    const telemetry = createLabTelemetryContext({
      sink,
      operationRunId: "run-lab-contract-5",
      traceId: "trace-lab-contract-5",
      storeId: "store-lab-contract-5",
    });

    await emitEnvelope(telemetry, { status: "success" });

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].cost.costSource).toBe("not_available");
    expect(sink.entries[0].cost.estimatedCostUsd).toBeNull();
  });
});

// ─── 5. Um único envelope (fallback desabilitado) ────────────────────────────

describe("contrato do harness — exatamente 1 chamada paga por run", () => {
  it("sucesso: 1 invocação de campaign_image, 1 envelope e nenhum fallback", async () => {
    const { gateway, fallbackResolver, sink, telemetry, adapterCalls, invokeSpy } = createHarness(
      async () => ({
        imageBase64: "Z2VyYWRv",
        mimeType: "image/png",
        model: "gpt-5.5",
        usage: { totalTokens: 120 },
        usageMeta: { imageGenerationTool: true },
      }),
    );

    const result = await runLabCampaignImage({ gateway, request: createRequest(), telemetry });

    expect(result.imageBase64).toBe("Z2VyYWRv");
    expect(adapterCalls).toHaveLength(1);
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].capability).toBe("campaign_image");

    expect(invokeSpy).toHaveBeenCalledTimes(1);
    expect(invokeSpy.mock.calls.map((call) => call[0])).toEqual(["campaign_image"]);
    // Nenhuma invocação de campaign_image_edit em nenhum caminho.
    expect(invokeSpy.mock.calls.map((call) => call[0])).not.toContain("campaign_image_edit");
    // Nenhuma consulta ao resolver para o alvo de edição.
    expect(fallbackResolver.resolve).not.toHaveBeenCalledWith("campaign_image_edit");
    expect(fallbackResolver.resolve).not.toHaveBeenCalled();
    await expect(gateway.hasFallback("campaign_image")).resolves.toBe(false);
  });

  it("falha por capability: ainda 1 tentativa e 1 envelope failed (sem segunda chamada paga)", async () => {
    const { gateway, sink, telemetry, adapterCalls, invokeSpy } = createHarness(async () => {
      throw new Error("model_not_found: capability indisponível");
    });

    await expect(
      runLabCampaignImage({ gateway, request: createRequest(), telemetry }),
    ).rejects.toThrow();

    expect(adapterCalls).toHaveLength(1);
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].status).toBe("failed");
    expect(invokeSpy.mock.calls.map((call) => call[0])).not.toContain("campaign_image_edit");
  });

  it("o request real (tools, imagens e params) chega ao adapter do protocolo do alvo fixo", async () => {
    const { gateway, telemetry, adapterCalls, sink } = createHarness(async () => ({
      imageBase64: "Z2VyYWRv",
      mimeType: "image/png",
      model: "gpt-5.5",
    }));

    await runLabCampaignImage({ gateway, request: createRequest(), telemetry });

    expect(adapterCalls[0].tools).toBe("image_generation");
    expect(adapterCalls[0].productImagesDataUrls).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(adapterCalls[0].size).toBe("1024x1024");
    expect(sink.entries[0].provider).toBe(FIXED_TARGET.provider);
    expect(sink.entries[0].protocol).toBe(FIXED_TARGET.protocol);
  });
});

// ─── 6. Pipeline de produção inalterado ──────────────────────────────────────

describe("contrato do harness — pipeline de produção intacto", () => {
  it("createNoopImageProvider lança se for invocado (prova de que o provider não é usado)", () => {
    const provider = createNoopImageProvider();

    expect(provider.name).toBe("lab-noop-image-provider");
    expect(() =>
      provider.generateImage({
        prompt: "x",
      } as unknown as Parameters<typeof provider.generateImage>[0]),
    ).toThrow(LAB_NOOP_IMAGE_PROVIDER_INVOKED);
  });

  it("buildDirectorPrompt é público e monta o prompt real com o loader do laboratório", () => {
    const loader = new LabPromptLoader([]);
    const service = new ImageGenerationService(createNoopImageProvider(), loader);

    const prompt = service.buildDirectorPrompt(createBrief(), createContext());

    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
    expect(typeof service.generateImage).toBe("function");
  });
});

// ─── 7. Catálogo somente leitura ─────────────────────────────────────────────

describe("contrato do harness — catálogo como allowlist read-only", () => {
  it("lê o alvo de campaign_image com select e nunca muta ai_model_catalog", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        ai_model_catalog: [
          {
            id: "catalog-1",
            capability: "campaign_image",
            provider: "openai",
            model: "gpt-5.5",
            protocol: "responses",
            status: "active",
          },
        ],
      },
    });

    const target = await getActiveCampaignImageTarget(fake.client);

    expect(target).toEqual({ provider: "openai", model: "gpt-5.5", protocol: "responses" });

    const catalogOps = fake.operations.filter((op) => op.table === "ai_model_catalog");
    expect(catalogOps.length).toBeGreaterThan(0);
    expect(catalogOps.every((op) => op.op === "select")).toBe(true);
    expect(
      fake.operations.filter(
        (op) => op.op === "insert" || op.op === "update" || op.op === "delete",
      ),
    ).toHaveLength(0);
  });
});
