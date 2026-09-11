// @vitest-environment node
// F37.2 (tasks.md §12): testes de análise/classificação do CorrectionIntentService
// (12.2-12.9). Sem IA real — TextProvider e AiCostTracker mockados.
// Nota 12.1: a validação de texto vazio/pontuação é contratual da ROTA
// (problem-report) e é coberta no plano 17; o serviço não expõe validador próprio.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TextProvider } from "@/lib/text-provider/types";

vi.mock("server-only", () => ({}));

const { recordMock, resolveMock } = vi.hoisted(() => ({
  recordMock: vi.fn(async (_event: unknown) => undefined),
  resolveMock: vi.fn(async () => ({
    estimatedCostUsd: 0.001,
    costSource: "pricing_table" as const,
  })),
}));

vi.mock("@/lib/ai-cost", () => ({
  AiCostTracker: class {
    record(event: unknown) {
      return recordMock(event);
    }
  },
  resolveAiCost: resolveMock,
}));

import {
  CorrectionIntentService,
  CORRECTION_ELIGIBLE_CATEGORIES,
} from "@/lib/campaign/correction-intent-service";

const OPTIONS = {
  operationRunId: "run-abc",
  campaignId: "camp-1",
  storeId: "store-1",
  userId: "user-1",
  attemptNumber: 2,
};

function makeProvider(
  impl: (prompt: string) => Promise<{
    content: string;
    usage: { promptTokens: number; completionTokens: number };
    model: string;
  }>
) {
  return {
    name: "mock-provider",
    generateText: vi.fn(impl),
  } as unknown as TextProvider;
}

function providerWithContent(content: string) {
  return makeProvider(async () => ({
    content,
    usage: { promptTokens: 12, completionTokens: 7 },
    model: "gpt-test",
  }));
}

function eligibleJson(category: string, instruction = "Elimine o defeito indicado.") {
  return JSON.stringify({
    analysisState: "eligible",
    category,
    normalizedInstruction: instruction,
    guidance: "Corrigir o defeito objetivo.",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveMock.mockResolvedValue({
    estimatedCostUsd: 0.001,
    costSource: "pricing_table",
  });
});

describe("CorrectionIntentService (F37.2 §12)", () => {
  it("12.2 — analisa o TEXTO e nunca envia imagem ao provider", async () => {
    const provider = providerWithContent(eligibleJson("truncated_element"));
    const service = new CorrectionIntentService(provider);

    await service.analyzeReport("o preço saiu cortado na borda", OPTIONS);

    const prompt = (provider.generateText as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(prompt).toContain("o preço saiu cortado na borda");
    expect(prompt).toContain("RELATO");
    expect(prompt).not.toMatch(/data:image\//);
  });

  it("12.3 — cada categoria elegível retorna eligible + category + normalizedInstruction", async () => {
    for (const category of CORRECTION_ELIGIBLE_CATEGORIES) {
      const service = new CorrectionIntentService(
        providerWithContent(eligibleJson(category, `Corrigir ${category}`))
      );
      const result = await service.analyzeReport("defeito objetivo", OPTIONS);
      expect(result.analysisState).toBe("eligible");
      expect(result.category).toBe(category);
      expect(result.normalizedInstruction).toBe(`Corrigir ${category}`);
    }
  });

  it("12.4 — blocked retorna guidance e não carrega campos de geração", async () => {
    const content = JSON.stringify({
      analysisState: "blocked",
      guidance: "Este canal não altera dados aprovados; gere uma nova campanha.",
    });
    const service = new CorrectionIntentService(providerWithContent(content));

    const result = await service.analyzeReport("muda o preço pra 90", OPTIONS);

    expect(result.analysisState).toBe("blocked");
    expect(result.category).toBeNull();
    expect(result.normalizedInstruction).toBeNull();
    expect(result.guidance).toContain("nova campanha");
  });

  it("12.5 — unclear retorna orientação e não carrega campos de geração", async () => {
    const content = JSON.stringify({
      analysisState: "unclear",
      guidance: "Descreva o defeito. Ex.: o preço saiu cortado.",
    });
    const service = new CorrectionIntentService(providerWithContent(content));

    const result = await service.analyzeReport("sei lá", OPTIONS);

    expect(result.analysisState).toBe("unclear");
    expect(result.category).toBeNull();
    expect(result.normalizedInstruction).toBeNull();
    expect(result.guidance).toContain("Ex.:");
  });

  it("12.6 — JSON inválido/fora do schema vira unclear", async () => {
    const freeText = new CorrectionIntentService(
      providerWithContent("Isso definitivamente não é um JSON.")
    );
    const r1 = await freeText.analyzeReport("texto", OPTIONS);
    expect(r1.analysisState).toBe("unclear");

    const outOfSchema = new CorrectionIntentService(
      providerWithContent(JSON.stringify({ foo: "bar" }))
    );
    const r2 = await outOfSchema.analyzeReport("texto", OPTIONS);
    expect(r2.analysisState).toBe("unclear");
  });

  it("12.7 — timeout/transporte/vazio vira analysis_failed", async () => {
    const throwing = new CorrectionIntentService(
      makeProvider(async () => {
        throw new Error("ETIMEDOUT");
      })
    );
    const r1 = await throwing.analyzeReport("texto", OPTIONS);
    expect(r1.analysisState).toBe("analysis_failed");

    const empty = new CorrectionIntentService(providerWithContent("   "));
    const r2 = await empty.analyzeReport("texto", OPTIONS);
    expect(r2.analysisState).toBe("analysis_failed");
  });

  it("12.8 — normalizedInstruction com {{ }} é saneada (sem placeholder não resolvido)", async () => {
    const provider = providerWithContent(
      eligibleJson("data_mismatch", "Ajuste o preço {{ preço }} exibido")
    );
    const service = new CorrectionIntentService(provider);

    const result = await service.analyzeReport("preço divergente", OPTIONS);

    expect(result.normalizedInstruction).not.toContain("{{");
    expect(result.normalizedInstruction).toBe("Ajuste o preço { preço } exibido");
  });

  it("12.9 — evento campaign_correction_analysis com provider/model/usage/attemptNumber no mesmo run; falha → status failed", async () => {
    const provider = providerWithContent(eligibleJson("truncated_element"));
    const service = new CorrectionIntentService(provider);

    await service.analyzeReport("texto", OPTIONS);

    expect(recordMock).toHaveBeenCalledTimes(1);
    const event = recordMock.mock.calls[0][0] as Record<string, unknown>;
    expect(event.generationType).toBe("campaign_correction_analysis");
    expect(event.provider).toBe("mock-provider");
    expect(event.model).toBe("gpt-test");
    expect(event.attemptNumber).toBe(2);
    expect(event.operationRunId).toBe("run-abc");
    expect(event.operationRunType).toBe("campaign_delivery");
    expect(event.status).toBe("success");
    expect(event.tokens).toEqual({ promptTokens: 12, completionTokens: 7 });

    const throwing = new CorrectionIntentService(
      makeProvider(async () => {
        throw new Error("boom");
      })
    );
    await throwing.analyzeReport("texto", OPTIONS);
    const failedEvent = recordMock.mock.calls[1][0] as Record<string, unknown>;
    expect(failedEvent.generationType).toBe("campaign_correction_analysis");
    expect(failedEvent.status).toBe("failed");
  });
});
