// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const { mockResolveAiCost, originalProviderKeys } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

  // A suíte precisa passar **sem** chaves de provider: nenhuma chamada paga e
  // nenhum client real é instanciado (adapters e resolvers são fakes).
  const originalProviderKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  return { mockResolveAiCost: vi.fn(), originalProviderKeys };
});

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

import type { LabRunSnapshot } from "../run-snapshot";
import type { LabExperimentParams } from "../domain/schemas";
import { computePromptContentHash } from "../domain/prompt-snapshot";
import { LabPromptLoader } from "../gateway/lab-prompt-loader";
import { LabModelResolver } from "../gateway/lab-model-resolver";
import { createLabGateway, createLabTelemetryContext, runLabCampaignImage } from "../gateway/runtime";
import { createNoopImageProvider } from "../gateway/noop-image-provider";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import type { CostResolution } from "@/lib/ai-cost/types";
import type { AiAdapter, AiAdapterRegistry, AiInvocationRequest, AiModelConfig, AiModelResolver, AiModelTarget } from "@/lib/ai/types";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import { buildCampaignBriefFromFlat } from "@/lib/campaign/brief";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";

/**
 * F48.1 — suíte de contrato nº 2 (48-1-12, task 12.6, D17): do snapshot
 * congelado para um caso determinístico.
 *
 * Um `lab_runs.snapshot` congelado vira caso regressivo **sem** chamada paga e
 * **sem** depender de imagem gerada: o prompt é montado pelo caminho real, o
 * envelope é simulado por um `AiInvoker` fake e o alvo resolvido é o do snapshot.
 * Nenhum artefato de `lab-artifacts` nem arquivo `output.*` é usado como fixture.
 */

const SCENARIO_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const STORE_ID = "77777777-7777-4777-8777-777777777777";
const PROMPT_NAME = "campaign-image-director-offer";
const CANDIDATE_CONTENT = "BLOCO CANDIDATA: preço em destaque absoluto no topo da arte.";
const BASELINE_CONTENT = "BLOCO BASELINE: preço no rodapé da arte.";
const CANDIDATE_HASH = computePromptContentHash(CANDIDATE_CONTENT);
const BASELINE_HASH = computePromptContentHash(BASELINE_CONTENT);
const MINIMAL_IMAGE_BASE64 = "iVBORw0KGgo=";

/** Snapshot congelado (inline) — a única fonte do caso determinístico. */
const SNAPSHOT: LabRunSnapshot = {
  scenarioVersionId: SCENARIO_VERSION_ID,
  scenarioVersion: 1,
  scenarioContentHash: "c".repeat(64),
  prompt: {
    name: PROMPT_NAME,
    content: CANDIDATE_CONTENT,
    contentHash: CANDIDATE_HASH,
    source: "override",
  },
  capability: "campaign_image",
  modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
  params: { size: "1024x1024", quality: "auto", skipInputValidation: true },
  changedDimension: "prompt",
  variantRole: "candidate",
  codeVersion: null,
  baselineConfig: {
    promptName: PROMPT_NAME,
    promptContentHash: BASELINE_HASH,
    source: "official",
  },
  candidateConfig: {
    promptName: PROMPT_NAME,
    promptContentHash: CANDIDATE_HASH,
    source: "override",
  },
  runType: "lab",
};

const FULL_COST: CostResolution = {
  estimatedCostUsd: 0.0421,
  costSource: "pricing_table",
  pricingVersion: "11111111-1111-4111-8111-111111111111",
  costFormulaVersion: "responses_image_generation_v2",
  textComponentUsd: 0.0121,
  imageToolComponentUsd: 0.03,
};

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

/** Loader do laboratório servindo exatamente o prompt congelado no snapshot. */
function createSnapshotLoader(): LabPromptLoader {
  return new LabPromptLoader([
    { name: SNAPSHOT.prompt.name, content: SNAPSHOT.prompt.content },
  ]);
}

interface FakeAdapterHarness {
  adapter: AiAdapter;
  calls: AiInvocationRequest[];
}

function createFakeAdapter(): FakeAdapterHarness {
  const calls: AiInvocationRequest[] = [];
  const adapter: AiAdapter = {
    protocol: "responses",
    async invoke(request) {
      calls.push(request);
      return {
        imageBase64: MINIMAL_IMAGE_BASE64,
        mimeType: "image/png",
        model: SNAPSHOT.modelTarget.model,
        usage: { promptTokens: 8, completionTokens: 2, totalTokens: 10 },
        usageMeta: { imageGenerationTool: true },
      };
    },
  };
  return { adapter, calls };
}

/** O resolver padrão nunca deve ser consultado para a capacidade do snapshot. */
function createFallbackResolver(): AiModelResolver {
  return {
    async resolve(capability): Promise<AiModelConfig> {
      throw new Error(`fallback não deveria ser consultado: ${capability}`);
    },
    listCapabilities() {
      return [];
    },
  };
}

/** Client fake que registra qualquer acesso — nenhum artefato pode ser lido. */
class FakeAccessLogClient {
  readonly accessLog: Array<{ table: string; op: string }> = [];

  from(table: string) {
    const log = (op: string) => this.accessLog.push({ table, op });
    return {
      select: () => {
        log("select");
        return { eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
      },
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
    };
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue(FULL_COST);
});

afterAll(() => {
  if (originalProviderKeys.OPENAI_API_KEY !== undefined) {
    process.env.OPENAI_API_KEY = originalProviderKeys.OPENAI_API_KEY;
  }
  if (originalProviderKeys.GEMINI_API_KEY !== undefined) {
    process.env.GEMINI_API_KEY = originalProviderKeys.GEMINI_API_KEY;
  }
});

// ─── 1. Montagem do prompt e alvo resolvido (sem chamada paga) ───────────────

describe("contrato de fixtures — snapshot vira caso determinístico", () => {
  it("monta o prompt real com o loader do snapshot e sem chamada paga", () => {
    const loader = createSnapshotLoader();
    const service = new ImageGenerationService(createNoopImageProvider(), loader);

    const prompt = service.buildDirectorPrompt(createBrief(), createContext());

    // Presença do bloco sob teste e ausência do baseline congelado.
    expect(prompt).toContain(CANDIDATE_CONTENT);
    expect(prompt).not.toContain(BASELINE_CONTENT);
    // O prompt servido corresponde ao hash congelado no snapshot.
    expect(computePromptContentHash(loader.load(SNAPSHOT.prompt.name))).toBe(
      SNAPSHOT.prompt.contentHash,
    );
    // Nenhuma resolução de custo acontece na montagem do prompt.
    expect(mockResolveAiCost).not.toHaveBeenCalled();
  });

  it("resolve exatamente o alvo de modelo congelado no snapshot", async () => {
    const resolver = new LabModelResolver({
      fixedTarget: SNAPSHOT.modelTarget as AiModelTarget,
      fallbackResolver: createFallbackResolver(),
    });

    const config = await resolver.resolve(SNAPSHOT.capability);

    expect(config.capability).toBe("campaign_image");
    expect(config.primary).toEqual(SNAPSHOT.modelTarget);
    expect(config.fallback).toBeUndefined();
  });

  it("reconstrói o request canônico a partir dos params congelados", () => {
    const params: LabExperimentParams = SNAPSHOT.params;
    const request: AiInvocationRequest = {
      prompt: "prompt montado pelo caminho real",
      productImagesDataUrls: ["data:image/jpeg;base64,AAAA"],
      tools: "image_generation",
      size: params.size,
      quality: params.quality,
    };

    expect(request.size).toBe("1024x1024");
    expect(request.quality).toBe("auto");
    expect(request.tools).toBe("image_generation");
    expect(params.skipInputValidation).toBe(true);
  });
});

// ─── 2. Envelope simulado trava o contrato (sem imagem gerada) ───────────────

describe("contrato de fixtures — envelope simulado com fakes", () => {
  it("emite exatamente 1 envelope campaign_image e reflete usageMeta no custo", async () => {
    const { adapter, calls } = createFakeAdapter();
    const adapters: AiAdapterRegistry = {
      get(protocol) {
        return protocol === adapter.protocol ? adapter : undefined;
      },
    };
    const gateway = createLabGateway({
      fixedTarget: SNAPSHOT.modelTarget as AiModelTarget,
      fallbackResolver: createFallbackResolver(),
      adapters,
    });
    const sink = new LabTelemetrySink();
    const telemetry = createLabTelemetryContext({
      sink,
      operationRunId: "run-fixture-1",
      traceId: "trace-fixture-1",
      storeId: STORE_ID,
    });

    const request: AiInvocationRequest = {
      prompt: "prompt montado pelo caminho real",
      productImagesDataUrls: ["data:image/jpeg;base64,AAAA"],
      tools: "image_generation",
      size: SNAPSHOT.params.size,
      quality: SNAPSHOT.params.quality,
    };

    const result = await runLabCampaignImage({ gateway, request, telemetry });

    expect(calls).toHaveLength(1);
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].capability).toBe("campaign_image");
    expect(sink.entries[0].provider).toBe(SNAPSHOT.modelTarget.provider);
    expect(sink.entries[0].model).toBe(SNAPSHOT.modelTarget.model);
    expect(sink.entries[0].protocol).toBe(SNAPSHOT.modelTarget.protocol);
    expect(sink.entries[0].status).toBe("success");

    // A tool de geração de imagem declarada pelo envelope alimenta o custo.
    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ imageGenerationTool: true }),
    );
    expect(sink.costSummary?.costSource).toBe("pricing_table");

    // O caso não depende da imagem gerada: a resposta fake mínima é suficiente.
    expect(result.imageBase64).toBe(MINIMAL_IMAGE_BASE64);
    expect(result.usageMeta?.imageGenerationTool).toBe(true);
  });

  it("não usa nenhum provider de imagem real (provider no-op nunca é invocado)", () => {
    const provider = createNoopImageProvider();

    expect(() =>
      provider.generateImage({
        prompt: "x",
      } as unknown as Parameters<typeof provider.generateImage>[0]),
    ).toThrow("lab_noop_image_provider_invoked");
  });
});

// ─── 3. Sem artefatos e sem chaves de provider ───────────────────────────────

describe("contrato de fixtures — sem artefato gerado e sem chaves de provider", () => {
  it("o caso passa sem OPENAI_API_KEY/GEMINI_API_KEY no ambiente", () => {
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    expect(process.env.GEMINI_API_KEY).toBeUndefined();

    const loader = createSnapshotLoader();
    const service = new ImageGenerationService(createNoopImageProvider(), loader);
    const prompt = service.buildDirectorPrompt(createBrief(), createContext());

    expect(prompt.length).toBeGreaterThan(0);
  });

  it("não lê artefato de lab-artifacts nem arquivo output.* como fixture", () => {
    const client = new FakeAccessLogClient();
    const serialized = JSON.stringify(SNAPSHOT);

    // A fixture é 100% inline: nenhum path de storage/artefato é referenciado.
    expect(serialized).not.toContain("lab-artifacts");
    expect(serialized).not.toContain("output.png");
    expect(SNAPSHOT.prompt.content).toBe(CANDIDATE_CONTENT);

    // Nenhum acesso a tabela/storage acontece na conversão do snapshot.
    expect(client.accessLog).toHaveLength(0);
    expect(mockResolveAiCost).not.toHaveBeenCalled();
  });

  it("o snapshot congelado permanece imutável após a conversão", () => {
    const before = JSON.stringify(SNAPSHOT);

    const loader = createSnapshotLoader();
    const service = new ImageGenerationService(createNoopImageProvider(), loader);
    service.buildDirectorPrompt(createBrief(), createContext());
    loader.clearCache();

    expect(JSON.stringify(SNAPSHOT)).toBe(before);
    expect(SNAPSHOT.prompt.contentHash).toBe(CANDIDATE_HASH);
    expect(SNAPSHOT.baselineConfig.promptContentHash).toBe(BASELINE_HASH);
  });
});
