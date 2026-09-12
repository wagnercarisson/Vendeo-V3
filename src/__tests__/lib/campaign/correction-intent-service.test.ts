// @vitest-environment node
// F37.2 (tasks.md §12): testes de análise/classificação do CorrectionIntentService
// (12.2-12.9). Sem IA real — o gateway é injetado como fake (seam AiInvoker).
// Nota 12.1: a validação de texto vazio/pontuação é contratual da ROTA
// (problem-report) e é coberta no plano 17; o serviço não expõe validador próprio.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// O serviço importa `@/lib/ai` (gateway default) → sink padrão →
// cost-estimator → supabase/server. Sem env, o módulo lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import type { AiCallEnvelope, AiInvoker, AiInvocationResult, AiTelemetryContext } from "@/lib/ai";
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

function makeTelemetry(): { telemetry: AiTelemetryContext; envelopes: AiCallEnvelope[] } {
  const envelopes: AiCallEnvelope[] = [];
  return {
    envelopes,
    telemetry: {
      operationRunId: "run-abc",
      operationRunType: "campaign_delivery",
      traceId: "trace-abc",
      storeId: "store-1",
      campaignId: "camp-1",
      userId: "user-1",
      attemptNumber: 2,
      sink: {
        emit: (envelope: AiCallEnvelope) => {
          envelopes.push(envelope);
        },
      },
    },
  };
}

/**
 * Fake `AiInvoker` (seam de teste): emite o envelope no sink e devolve o
 * conteúdo — ou emite falha e lança.
 */
function makeInvoker(
  contentOrError: string | Error
): { invoker: AiInvoker; invokeMock: ReturnType<typeof vi.fn> } {
  const invokeMock = vi.fn(
    async (
      _capability: string,
      _request: unknown,
      telemetry: AiTelemetryContext
    ): Promise<AiInvocationResult> => {
      if (contentOrError instanceof Error) {
        await telemetry.sink.emit({
          capability: "campaign_correction_analysis",
          protocol: "chat-completions",
          status: "failed",
          provider: "openai",
          model: "gpt-4o",
          durationMs: 5,
          errorType: contentOrError.name,
        });
        throw contentOrError;
      }
      await telemetry.sink.emit({
        capability: "campaign_correction_analysis",
        protocol: "chat-completions",
        status: "success",
        provider: "openai",
        model: "gpt-4o",
        usage: { promptTokens: 12, completionTokens: 7 },
        durationMs: 8,
      });
      return {
        content: contentOrError,
        model: "gpt-4o",
        usage: { promptTokens: 12, completionTokens: 7 },
      };
    }
  );

  return {
    invokeMock,
    invoker: {
      invoke: invokeMock as unknown as AiInvoker["invoke"],
      hasFallback: vi.fn(async () => false),
    },
  };
}

function serviceWithContent(content: string) {
  const { invoker, invokeMock } = makeInvoker(content);
  return { service: new CorrectionIntentService(invoker), invokeMock };
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
});

describe("CorrectionIntentService (F37.2 §12)", () => {
  it("12.2 — analisa o TEXTO via invoke e nunca envia imagem ao provider", async () => {
    const { service, invokeMock } = serviceWithContent(eligibleJson("truncated_element"));
    const { telemetry } = makeTelemetry();

    await service.analyzeReport("o preço saiu cortado na borda", OPTIONS, telemetry);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock.mock.calls[0][0]).toBe("campaign_correction_analysis");
    const request = invokeMock.mock.calls[0][1] as { prompt: string };
    expect(request.prompt).toContain("o preço saiu cortado na borda");
    expect(request.prompt).toContain("RELATO");
    expect(request.prompt).not.toMatch(/data:image\//);
  });

  it("12.3 — cada categoria elegível retorna eligible + category + normalizedInstruction", async () => {
    for (const category of CORRECTION_ELIGIBLE_CATEGORIES) {
      const { service } = serviceWithContent(eligibleJson(category, `Corrigir ${category}`));
      const { telemetry } = makeTelemetry();
      const result = await service.analyzeReport("defeito objetivo", OPTIONS, telemetry);
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
    const { service } = serviceWithContent(content);
    const { telemetry } = makeTelemetry();

    const result = await service.analyzeReport("muda o preço pra 90", OPTIONS, telemetry);

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
    const { service } = serviceWithContent(content);
    const { telemetry } = makeTelemetry();

    const result = await service.analyzeReport("sei lá", OPTIONS, telemetry);

    expect(result.analysisState).toBe("unclear");
    expect(result.category).toBeNull();
    expect(result.normalizedInstruction).toBeNull();
    expect(result.guidance).toContain("Ex.:");
  });

  it("12.6 — JSON inválido/schema inválido → analysis_failed", async () => {
    const freeText = serviceWithContent("Isso definitivamente não é um JSON.");
    const { telemetry: t1 } = makeTelemetry();
    const r1 = await freeText.service.analyzeReport("texto", OPTIONS, t1);
    expect(r1.analysisState).toBe("analysis_failed");

    const outOfSchema = serviceWithContent(JSON.stringify({ foo: "bar" }));
    const { telemetry: t2 } = makeTelemetry();
    const r2 = await outOfSchema.service.analyzeReport("texto", OPTIONS, t2);
    expect(r2.analysisState).toBe("analysis_failed");
  });

  it("12.10 — os três relatos reais de logo cortado → eligible/truncated_element", async () => {
    const reports = [
      "o logotipo do mercado ficou mal posicionado e cortado - por favor reposicione respeitando o respiro necessário sem cortar nenhum elemento",
      "o logo ficou cortado, reposicione",
      "o logo está encostado na borda, afaste um pouco",
    ];

    for (const report of reports) {
      const { service } = serviceWithContent(eligibleJson("truncated_element"));
      const { telemetry } = makeTelemetry();
      const result = await service.analyzeReport(report, OPTIONS, telemetry);
      expect(result.analysisState).toBe("eligible");
      expect(result.category).toBe("truncated_element");
      expect(result.normalizedInstruction).toBeTruthy();
    }
  });

  it("12.11 — eligible SEM guidance → eligible (guidance opcional)", async () => {
    const { service } = serviceWithContent(
      JSON.stringify({
        analysisState: "eligible",
        category: "truncated_element",
        normalizedInstruction: "Reenquadrar o elemento cortado.",
      })
    );
    const { telemetry } = makeTelemetry();
    const result = await service.analyzeReport("logo cortado", OPTIONS, telemetry);
    expect(result.analysisState).toBe("eligible");
    expect(result.category).toBe("truncated_element");
  });

  it("12.12 — eligible com guidance null → eligible", async () => {
    const { service } = serviceWithContent(
      JSON.stringify({
        analysisState: "eligible",
        category: "truncated_element",
        normalizedInstruction: "Reenquadrar o elemento cortado.",
        guidance: null,
      })
    );
    const { telemetry } = makeTelemetry();
    const result = await service.analyzeReport("logo cortado", OPTIONS, telemetry);
    expect(result.analysisState).toBe("eligible");
  });

  it("12.13 — blocked/unclear com category/normalizedInstruction ausentes OU null → aceitos", async () => {
    const absent = serviceWithContent(
      JSON.stringify({
        analysisState: "blocked",
        guidance: "Não é canal de edição de dados.",
      })
    );
    const { telemetry: t1 } = makeTelemetry();
    expect((await absent.service.analyzeReport("muda o preço", OPTIONS, t1)).analysisState).toBe(
      "blocked"
    );

    const withNull = serviceWithContent(
      JSON.stringify({
        analysisState: "unclear",
        category: null,
        normalizedInstruction: null,
        guidance: "Reformule o relato.",
      })
    );
    const { telemetry: t2 } = makeTelemetry();
    const result = await withNull.service.analyzeReport("sei lá", OPTIONS, t2);
    expect(result.analysisState).toBe("unclear");
    expect(result.category).toBeNull();
    expect(result.normalizedInstruction).toBeNull();
  });

  it("12.7 — timeout/transporte/vazio vira analysis_failed", async () => {
    const { invoker } = makeInvoker(new Error("ETIMEDOUT"));
    const throwing = new CorrectionIntentService(invoker);
    const { telemetry: t1 } = makeTelemetry();
    const r1 = await throwing.analyzeReport("texto", OPTIONS, t1);
    expect(r1.analysisState).toBe("analysis_failed");

    const empty = serviceWithContent("   ");
    const { telemetry: t2 } = makeTelemetry();
    const r2 = await empty.service.analyzeReport("texto", OPTIONS, t2);
    expect(r2.analysisState).toBe("analysis_failed");
  });

  it("12.8 — normalizedInstruction com {{ }} é saneada (sem placeholder não resolvido)", async () => {
    const { service } = serviceWithContent(
      eligibleJson("data_mismatch", "Ajuste o preço {{ preço }} exibido")
    );
    const { telemetry } = makeTelemetry();

    const result = await service.analyzeReport("preço divergente", OPTIONS, telemetry);

    expect(result.normalizedInstruction).not.toContain("{{");
    expect(result.normalizedInstruction).toBe("Ajuste o preço { preço } exibido");
  });

  it("12.9 — envelope campaign_correction_analysis com capability/model/usage/attempt (sucesso e falha)", async () => {
    const { service } = serviceWithContent(eligibleJson("truncated_element"));
    const { telemetry, envelopes } = makeTelemetry();

    await service.analyzeReport("texto", OPTIONS, telemetry);

    expect(envelopes).toHaveLength(1);
    const envelope = envelopes[0];
    expect(envelope.capability).toBe("campaign_correction_analysis");
    expect(envelope.protocol).toBe("chat-completions");
    expect(envelope.provider).toBe("openai");
    expect(envelope.model).toBe("gpt-4o");
    expect(envelope.status).toBe("success");
    expect(envelope.usage).toEqual({ promptTokens: 12, completionTokens: 7 });

    const { invoker } = makeInvoker(new Error("boom"));
    const throwing = new CorrectionIntentService(invoker);
    const { telemetry: t2, envelopes: env2 } = makeTelemetry();
    const failed = await throwing.analyzeReport("texto", OPTIONS, t2);
    expect(failed.analysisState).toBe("analysis_failed");
    expect(env2).toHaveLength(1);
    expect(env2[0].status).toBe("failed");
    expect(env2[0].errorType).toBe("Error");
  });

  it("12.14 — sem telemetria → erro de contrato (contexto obrigatório)", async () => {
    const { service } = serviceWithContent(eligibleJson("truncated_element"));
    await expect(service.analyzeReport("texto", OPTIONS)).rejects.toThrow(/AiTelemetryContext/);
  });
});
