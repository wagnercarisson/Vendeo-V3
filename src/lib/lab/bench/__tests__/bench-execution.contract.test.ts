// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { AiModelResolver } from "@/lib/ai/model-resolver";
import type {
  AiAdapter,
  AiAdapterRegistry,
  AiCallEnvelope,
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
  AiTelemetrySink,
} from "@/lib/ai/types";
import type { AiModelTarget } from "@/lib/ai/model-resolver";
import { BENCH_PRESETS, resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";
import {
  BenchPresetResolver,
  INVALID_BENCH_TARGET,
} from "@/lib/lab/bench/gateway/bench-model-resolver";
import {
  buildBenchInvocationRequest,
  createBenchGateway,
} from "@/lib/lab/bench/gateway/runtime";

/**
 * Contrato do **harness da bancada** (F48.2.2, D8) — parte de resolução e
 * parâmetros.
 *
 * Prova que: (a) o resolver devolve capability + alvo do preset; (b) preset
 * desabilitado é recusado (`preset_not_enabled`); (c) a seleção produtiva não é
 * consultada; (d) a requisição montada leva modelo/qualidade/tamanho/prompt/
 * referências (ordem/papel) e `signal`; (e) o branding não vira referência; e
 * (f) exatamente um envelope de imagem é emitido, sem fallback/segunda chamada.
 *
 * Tudo com fakes em memória: nenhuma chamada de rede e nenhuma chamada paga.
 */

const STORE_ID = "33333333-3333-4333-8333-333333333333";
const PNG_A = "data:image/png;base64,QUFB";
const PNG_B = "data:image/png;base64,QkJC";

// ─── Fakes ───────────────────────────────────────────────────────────────────

/** Resolver padrão de delegação (nunca usado para a capability do preset). */
function createFallbackResolver(): AiModelResolver {
  return {
    async resolve(capability) {
      return {
        capability,
        segment: "image",
        primary: { provider: "openai", model: "fallback-model", protocol: "images" },
      };
    },
    listCapabilities: () => ["campaign_image"],
  };
}

class RecordingAdapter implements AiAdapter {
  readonly protocol = "images" as const;
  readonly calls: Array<{ request: AiInvocationRequest; target: AiModelTarget }> = [];
  result: AiInvocationResult = {
    imageBase64: "ZmFrZS1pbWFnZQ==",
    mimeType: "image/png",
    model: "gpt-image-2",
  };
  error?: Error;

  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    this.calls.push({ request, target });
    if (this.error) throw this.error;
    return this.result;
  }
}

class CountingSink implements AiTelemetrySink {
  readonly envelopes: AiCallEnvelope[] = [];
  async emit(envelope: AiCallEnvelope): Promise<void> {
    this.envelopes.push(envelope);
  }
}

function telemetryContext(sink: AiTelemetrySink): AiTelemetryContext {
  return {
    operationRunId: "run-1",
    operationRunType: "campaign_delivery",
    traceId: "trace-1",
    storeId: STORE_ID,
    sink,
  };
}

let adapter: RecordingAdapter;
let adapters: AiAdapterRegistry;

beforeEach(() => {
  adapter = new RecordingAdapter();
  adapters = { get: (protocol) => (protocol === "images" ? adapter : undefined) };
});

// ─── Resolução ───────────────────────────────────────────────────────────────

describe("BenchPresetResolver — capability + alvo do preset, single-shot", () => {
  it("devolve a capability e o alvo (provider/model/protocolo) do preset habilitado", async () => {
    const preset = resolveBenchPreset("gpt-image-2-low");
    const resolver = new BenchPresetResolver({
      preset,
      fallbackResolver: createFallbackResolver(),
    });

    const config = await resolver.resolve("campaign_image");

    expect(config.capability).toBe("campaign_image");
    expect(config.segment).toBe("image");
    expect(config.primary).toEqual({ provider: "openai", model: "gpt-image-2", protocol: "images" });
    expect(config.fallback).toBeUndefined();
  });

  it("recusa preset desabilitado com preset_not_enabled", async () => {
    const disabled = BENCH_PRESETS.find((preset) => preset.id === "gpt-image-2-responses");
    expect(disabled?.enabled).toBe(false);

    const resolver = new BenchPresetResolver({
      preset: disabled!,
      fallbackResolver: createFallbackResolver(),
    });

    await expect(resolver.resolve("campaign_image")).rejects.toMatchObject({
      code: "preset_not_enabled",
    });
  });

  it("lança INVALID_BENCH_TARGET quando o alvo do preset diverge do registry", async () => {
    const preset = { ...resolveBenchPreset("gpt-image-2-low"), model: "modelo-divergente" };
    const resolver = new BenchPresetResolver({
      preset,
      fallbackResolver: createFallbackResolver(),
    });

    await expect(resolver.resolve("campaign_image")).rejects.toThrow(INVALID_BENCH_TARGET);
  });

  it("delega capabilities fora do escopo ao resolver padrão (read-only)", async () => {
    const resolver = new BenchPresetResolver({
      preset: resolveBenchPreset("gpt-image-2-low"),
      fallbackResolver: createFallbackResolver(),
    });
    const config = await resolver.resolve("campaign_copy");
    expect(config.primary.model).toBe("fallback-model");
  });

  it("não consulta a seleção produtiva (ai_model_selection) em nenhum ponto do harness", () => {
    for (const file of [
      "src/lib/lab/bench/gateway/bench-model-resolver.ts",
      "src/lib/lab/bench/gateway/runtime.ts",
    ]) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source).not.toContain("ai_model_selection");
    }
  });
});

// ─── Parâmetros explícitos e single-shot ─────────────────────────────────────

describe("harness — parâmetros explícitos e exatamente uma chamada", () => {
  it("leva modelo/qualidade/tamanho/prompt/referências (ordem) e signal ao adapter", async () => {
    const preset = resolveBenchPreset("gpt-image-2-medium");
    const gateway = createBenchGateway({
      preset,
      adapters,
      fallbackResolver: createFallbackResolver(),
    });
    const sink = new CountingSink();
    const controller = new AbortController();

    const request = buildBenchInvocationRequest({
      preset,
      prompt: "prompt manual",
      productImagesDataUrls: [PNG_A, PNG_B],
      signal: controller.signal,
    });

    await gateway.invoke("campaign_image", request, telemetryContext(sink));

    expect(adapter.calls).toHaveLength(1);
    const call = adapter.calls[0];
    expect(call.target.model).toBe("gpt-image-2");
    expect(call.target.protocol).toBe("images");
    expect(call.request.quality).toBe("medium");
    expect(call.request.size).toBe(preset.size);
    expect(call.request.prompt).toBe("prompt manual");
    expect(call.request.productImagesDataUrls).toEqual([PNG_A, PNG_B]);
    expect(call.request.signal).toBe(controller.signal);
  });

  it("não envia o branding (identityImageUrl) como referência", async () => {
    const preset = resolveBenchPreset("gpt-image-2-low");
    const request = buildBenchInvocationRequest({
      preset,
      prompt: "p",
      productImagesDataUrls: [PNG_A],
    });
    expect(request).not.toHaveProperty("identityImageUrl");
    expect(request.productImagesDataUrls).toEqual([PNG_A]);
  });

  it("emite exatamente um envelope de imagem e não tem alvo de fallback", async () => {
    const preset = resolveBenchPreset("gpt-image-2-low");
    const gateway = createBenchGateway({
      preset,
      adapters,
      fallbackResolver: createFallbackResolver(),
    });
    const sink = new CountingSink();

    await gateway.invoke(
      "campaign_image",
      buildBenchInvocationRequest({ preset, prompt: "p", productImagesDataUrls: [PNG_A] }),
      telemetryContext(sink),
    );

    expect(adapter.calls).toHaveLength(1);
    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0].capability).toBe("campaign_image");
    expect(sink.envelopes[0].status).toBe("success");

    // Sem alvo alternativo: nenhum fallback é possível (single-shot).
    expect(await gateway.hasFallback("campaign_image")).toBe(false);
    await expect(
      gateway.invoke(
        "campaign_image",
        buildBenchInvocationRequest({ preset, prompt: "p", productImagesDataUrls: [PNG_A] }),
        telemetryContext(sink),
        "fallback",
      ),
    ).rejects.toMatchObject({ kind: "capability" });
    // A tentativa de fallback não dispara uma segunda chamada paga.
    expect(adapter.calls).toHaveLength(1);
  });
});
