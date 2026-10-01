// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

// `LabTelemetrySink` importa o resolvedor de custo produtivo → pricing →
// `@/lib/supabase/server`, que exige env na importação do módulo. Os testes da
// bancada nunca tocam a rede — só preenchem o env mínimo de importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import type { AiCapability, AiModelResolver } from "@/lib/ai/model-resolver";
import type { AiInvoker } from "@/lib/ai/gateway";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
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
import type { BenchPricingResolution } from "@/lib/lab/bench/domain/bench-pricing";
import { BENCH_PRESETS, resolveBenchPreset } from "@/lib/lab/bench/domain/preset-registry";
import {
  BenchPresetResolver,
  INVALID_BENCH_TARGET,
} from "@/lib/lab/bench/gateway/bench-model-resolver";
import {
  buildBenchInvocationRequest,
  createBenchGateway,
} from "@/lib/lab/bench/gateway/runtime";
import { resolveBenchCost } from "@/lib/lab/bench/execution/bench-cost-resolver";
import { executeBenchRun } from "@/lib/lab/bench/execution/bench-execution-service";

/**
 * Contrato do **harness da bancada** (F48.2.2, D8) — parte de resolução e
 * parâmetros.
 *
 * Prova que: (a) o resolver devolve capability + alvo do preset; (b) preset
 * desabilitado é recusado (`preset_not_enabled`); (c) a seleção produtiva não é
 * consultada; (d) a requisição montada leva modelo/qualidade/tamanho/prompt/
 * referências (ordem/papel) e `signal`; (e) a identidade canônica é transportada
 * quando resolvida (nunca inventada); e
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

  it("transporta a identidade (identityImageUrl) quando resolvida, sem inventá-la", async () => {
    const preset = resolveBenchPreset("gpt-image-2-low");
    const withoutIdentity = buildBenchInvocationRequest({
      preset,
      prompt: "p",
      productImagesDataUrls: [PNG_A],
    });
    expect(withoutIdentity).not.toHaveProperty("identityImageUrl");
    expect(withoutIdentity.productImagesDataUrls).toEqual([PNG_A]);

    const identity = "data:image/png;base64,TE9HTw==";
    const withIdentity = buildBenchInvocationRequest({
      preset,
      prompt: "p",
      productImagesDataUrls: [PNG_A],
      identityImageUrl: identity,
    });
    expect(withIdentity.identityImageUrl).toBe(identity);
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

// ─── Custo local da bancada (D11/D12) ────────────────────────────────────────

describe("resolveBenchCost — resolvedor local chaveado pelo preset completo", () => {
  const low = resolveBenchPreset("gpt-image-2-low");
  const medium = resolveBenchPreset("gpt-image-2-medium");

  it("carrega cost_source bench_local_pricing e cost_rule_version vigente", () => {
    const resolution = resolveBenchCost({ preset: low });
    expect(resolution.costSource).toBe("bench_local_pricing");
    expect(resolution.costRuleVersion).toBe("2026-10-bench-3");
    expect(resolution.mode).toBe("token_based");
    // Pricing v3 mantém partial: estimativa de saída comprovada, inputs adicionais.
    expect(resolution.coverage).toBe("partial");
  });

  it("gpt-image-2 low estima somente saída; medium continua sem valor comprovado", () => {
    const lowCost = resolveBenchCost({ preset: low });
    const mediumCost = resolveBenchCost({ preset: medium });
    expect(lowCost.isEstimate).toBe(true);
    expect(mediumCost.isEstimate).toBe(true);
    expect(lowCost.estimatedCostUsd).toBeCloseTo(0.00588, 6);
    expect(mediumCost.estimatedCostUsd).toBeNull();
    expect(lowCost.usageReported).toBeUndefined();
  });

  it("gpt-image-2.5-flare low: estimativa parcial de saída do calculador oficial", () => {
    const resolution = resolveBenchCost({ preset: resolveBenchPreset("gpt-image-2.5-flare-low") });
    expect(resolution.isEstimate).toBe(true);
    expect(resolution.coverage).toBe("partial");
    expect(resolution.estimatedCostUsd).toBeCloseTo(0.00588, 6);
  });

  it("cálculo pós-usage exato para os três modelos (taxas oficiais × tokens)", () => {
    const expected = (1_000_000 * 5 + 2_000_000 * 8 + 1_000_000 * 30) / 1_000_000; // = 51
    for (const presetId of [
      "gpt-image-2-low",
      "gpt-image-2.5-flare-low",
      "gpt-image-2.5-sunburst-medium",
    ]) {
      const resolution = resolveBenchCost({
        preset: resolveBenchPreset(presetId),
        usage: {
          inputTextTokens: 1_000_000,
          inputImageTokens: 2_000_000,
          outputImageTokens: 1_000_000,
        },
      });
      expect(resolution.isEstimate, presetId).toBe(false);
      expect(resolution.estimatedCostUsd, presetId).toBeCloseTo(expected, 6);
      expect(resolution.calculation?.tokenRates, presetId).toEqual({
        inputTextUsdPerMillion: 5,
        inputImageUsdPerMillion: 8,
        outputImageUsdPerMillion: 30,
      });
    }
  });

  it("token_based com usage: taxas por token × usage (nunca usage × unitPriceUsd)", () => {
    const pricing: BenchPricingResolution = {
      mode: "token_based",
      tokenRates: {
        inputTextUsdPerMillion: 5,
        inputImageUsdPerMillion: 8,
        outputImageUsdPerMillion: 30,
      },
      // Deliberadamente absurdo: se fosse multiplicado por usage, o valor explodiria.
      unitPriceUsd: 999,
      coverage: "partial",
      ruleVersion: "2026-09-bench-2",
    };
    const resolution = resolveBenchCost({
      preset: low,
      usage: { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      pricing,
    });
    // (1_000_000 × 5 + 0 × 8 + 1_000_000 × 30) / 1e6 = 35
    expect(resolution.estimatedCostUsd).toBeCloseTo(35, 6);
    expect(resolution.isEstimate).toBe(false);
    expect(resolution.calculation?.tokenRates.outputImageUsdPerMillion).toBe(30);
  });

  it("per_image: preço fixo por imagem, sem multiplicação por tokens", () => {
    const pricing: BenchPricingResolution = {
      mode: "per_image",
      unitPriceUsd: 0.04,
      coverage: "complete",
      ruleVersion: "2026-09-bench-2",
    };
    const resolution = resolveBenchCost({
      preset: low,
      usage: { promptTokens: 5_000_000, completionTokens: 5_000_000 },
      pricing,
    });
    expect(resolution.estimatedCostUsd).toBe(0.04);
    expect(resolution.isEstimate).toBe(false);
  });

  it("providerReportedCostUsd e cálculo local coexistem: o valor do provider não substitui o local", () => {
    const resolution = resolveBenchCost({
      preset: low,
      usage: { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      providerReportedCostUsd: 0.123,
    });
    // Custo local calculado (1_000_000×5 + 0×8 + 1_000_000×30) / 1e6 = 35.
    expect(resolution.estimatedCostUsd).toBeCloseTo(35, 6);
    expect(resolution.isEstimate).toBe(false);
    // O custo do provider fica em campo SEPARADO — nunca copiado para estimatedCostUsd.
    expect(resolution.providerReportedCostUsd).toBe(0.123);
    expect(resolution.estimatedCostUsd).not.toBe(0.123);
    expect(resolution.usageReported?.promptTokens).toBe(1_000_000);
  });

  it("sem usage e com providerReportedCostUsd: o custo local é estimado (ou indisponível), não o valor do provider", () => {
    const resolution = resolveBenchCost({ preset: low, providerReportedCostUsd: 0.123 });
    expect(resolution.isEstimate).toBe(true);
    expect(resolution.providerReportedCostUsd).toBe(0.123);
    // Estimativa local somente de saída; valor do provider NÃO substitui.
    expect(resolution.estimatedCostUsd).toBeCloseTo(0.00588, 6);
    expect(resolution.estimatedCostUsd).not.toBe(0.123);
  });

  it("coverage missing devolve estimatedCostUsd null", () => {
    const withoutPricing = { ...low, model: "modelo-sem-pricing" };
    const resolution = resolveBenchCost({ preset: withoutPricing });
    expect(resolution.coverage).toBe("missing");
    expect(resolution.estimatedCostUsd).toBeNull();
  });

  it("não reutiliza o resolvedor de custo produtivo (fonte exclusivamente local)", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/execution/bench-cost-resolver.ts"),
      "utf8",
    );
    expect(source).not.toContain("resolveAiCost");
    expect(source).not.toContain("estimateLabCampaignImageCost");
  });
});

// ─── Execução single-shot (D8/D11/D13) ───────────────────────────────────────

interface Row {
  [key: string]: unknown;
}
interface ServiceFilter {
  column: string;
  value: unknown;
  op: "eq" | "in" | "is" | "lt";
}
interface ServiceUpdate {
  table: string;
  values: Row;
  filters: ServiceFilter[];
}

class ServiceQueryBuilder {
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private readonly predicates: Array<(row: Row) => boolean> = [];
  private readonly descriptors: ServiceFilter[] = [];

  constructor(
    private readonly fake: FakeServiceClient,
    private readonly table: string,
  ) {}

  select(_columns?: string): this {
    return this;
  }
  insert(values: Row): this {
    this.mode = "insert";
    this.payload = values;
    return this;
  }
  update(values: Row): this {
    this.mode = "update";
    this.payload = values;
    return this;
  }
  eq(column: string, value: unknown): this {
    this.predicates.push((row) => row[column] === value);
    this.descriptors.push({ column, value, op: "eq" });
    return this;
  }
  in(column: string, values: readonly unknown[]): this {
    this.predicates.push((row) => values.includes(row[column]));
    this.descriptors.push({ column, value: values, op: "in" });
    return this;
  }
  is(column: string, value: unknown): this {
    this.predicates.push((row) => (row[column] ?? null) === value);
    this.descriptors.push({ column, value, op: "is" });
    return this;
  }
  lt(column: string, value: unknown): this {
    this.predicates.push((row) => {
      const left = row[column];
      if (typeof left !== "string" || typeof value !== "string") return false;
      return Date.parse(left) < Date.parse(value);
    });
    this.descriptors.push({ column, value, op: "lt" });
    return this;
  }
  order(_column: string, _options?: { ascending?: boolean }): this {
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    const rows = Array.isArray(res.data) ? res.data : [];
    return { data: rows[0] ?? null, error: null };
  }
  async single(): Promise<{ data: unknown; error: unknown }> {
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length !== 1) return { data: null, error: { message: "not_single" } };
    return { data: rows[0], error: null };
  }
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    const rows = this.fake.tables[this.table] ?? [];
    return rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
  }

  private async execute(): Promise<{ data: unknown; error: unknown }> {
    this.fake.operations.push({ table: this.table, op: this.mode });
    if (this.mode === "insert") {
      const rows = (this.fake.tables[this.table] ??= []);
      const row: Row = { id: `row-${++this.fake.idCounter}`, ...this.payload };
      rows.push(row);
      this.fake.inserts.push({ table: this.table, values: this.payload });
      return { data: [row], error: null };
    }
    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.payload);
      this.fake.updates.push({ table: this.table, values: this.payload, filters: [...this.descriptors] });
      return { data: matched, error: null };
    }
    return { data: this.matched(), error: null };
  }
}

class FakeServiceClient {
  readonly tables: Record<string, Row[]> = {};
  readonly operations: Array<{ table: string; op: string }> = [];
  readonly inserts: Array<{ table: string; values: Row }> = [];
  readonly updates: ServiceUpdate[] = [];
  readonly uploads: Array<{ bucket: string; path: string; options: unknown }> = [];
  idCounter = 0;

  readonly storage = {
    from: (bucket: string) => ({
      upload: async (path: string, _buffer: Buffer, options: unknown) => {
        this.uploads.push({ bucket, path, options });
        return { error: null };
      },
      remove: async () => ({ error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: "x" }, error: null }),
    }),
  };

  from(table: string): ServiceQueryBuilder {
    return new ServiceQueryBuilder(this, table);
  }
}

class FakeGateway implements AiInvoker {
  readonly invocations: Array<{ capability: AiCapability; request: AiInvocationRequest }> = [];
  result: AiInvocationResult = { imageBase64: "", mimeType: "image/png", model: "gpt-image-2" };
  error?: Error;

  async invoke(
    capability: AiCapability,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext,
  ): Promise<AiInvocationResult> {
    this.invocations.push({ capability, request });
    if (this.error) throw this.error;
    // Espelha o gateway real: exatamente um envelope por invocação.
    await telemetry.sink.emit({
      capability,
      protocol: "images",
      status: "success",
      provider: "openai",
      model: this.result.model,
      usage: this.result.usage,
      durationMs: 1,
    });
    return this.result;
  }
  async hasFallback(): Promise<boolean> {
    return false;
  }
}

const RUN_ID = "44444444-4444-4444-8444-444444444444";

let fake: FakeServiceClient;
let fakeGateway: FakeGateway;
let sink: LabTelemetrySink;
let testPng: Buffer;

beforeAll(async () => {
  testPng = await sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 12, g: 180, b: 40 } },
  })
    .png()
    .toBuffer();
});

beforeEach(() => {
  fake = new FakeServiceClient();
  fake.tables.lab_bench_runs = [
    { id: RUN_ID, status: "pending", created_at: new Date().toISOString() },
  ];
  fakeGateway = new FakeGateway();
  sink = new LabTelemetrySink();
});

function setup() {
  return {
    client: fake as unknown as SupabaseClient,
    telemetry: {
      operationRunId: RUN_ID,
      operationRunType: "campaign_delivery",
      traceId: "trace",
      storeId: STORE_ID,
      sink,
    } as AiTelemetryContext,
  };
}

describe("executeBenchRun — single-shot, custo local e erro sanitizado", () => {
  const preset = resolveBenchPreset("gpt-image-2-low");

  it("exatamente uma chamada paga; persiste latência/usage/custo/provider/modelo/protocolo", async () => {
    fakeGateway.result = {
      imageBase64: testPng.toString("base64"),
      mimeType: "image/png",
      model: "gpt-image-2",
      usage: { promptTokens: 1000, completionTokens: 2000 },
    };
    const { client, telemetry } = setup();

    const outcome = await executeBenchRun({
      client,
      gateway: fakeGateway,
      telemetrySink: sink,
      run: { id: RUN_ID },
      preset,
      request: { prompt: "p", productImagesDataUrls: [PNG_A] },
      telemetry,
    });

    expect(outcome.status).toBe("succeeded");
    // Exatamente uma invocação paga — sem fallback e sem segunda chamada.
    expect(fakeGateway.invocations).toHaveLength(1);
    expect(fakeGateway.invocations[0].capability).toBe("campaign_image");
    // Telemetria read-only acumulada (sem generation_events).
    expect(sink.entries).toHaveLength(1);

    const runUpdate = fake.updates.filter((update) => update.table === "lab_bench_runs").at(-1);
    expect(runUpdate?.values.status).toBe("succeeded");
    expect(typeof runUpdate?.values.latency_ms).toBe("number");
    expect(runUpdate?.values.usage).toMatchObject({ promptTokens: 1000 });
    expect(runUpdate?.values.cost_source).toBe("bench_local_pricing");
    expect(runUpdate?.values.cost_rule_version).toBe("2026-10-bench-3");
    const detail = runUpdate?.values.cost_detail as Record<string, unknown>;
    expect(detail).toMatchObject({
      provider: "openai",
      model: "gpt-image-2",
      protocol: "images",
      quality: "low",
    });
    expect(detail.is_estimate).toBe(false);

    // Saída persistida no bucket local, sob o path próprio da bancada.
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0].bucket).toBe("lab-artifacts");
    expect(fake.uploads[0].path).toBe(`bench/${RUN_ID}/output.png`);
    expect(fake.inserts.some((insert) => insert.table === "lab_bench_artifacts")).toBe(true);

    // Nunca toca generation_events.
    expect(fake.operations.some((op) => op.table === "generation_events")).toBe(false);
  });

  it("marca o run como running antes de invocar", async () => {
    fakeGateway.result = {
      imageBase64: testPng.toString("base64"),
      mimeType: "image/png",
      model: "gpt-image-2",
    };
    const { client, telemetry } = setup();

    await executeBenchRun({
      client,
      gateway: fakeGateway,
      telemetrySink: sink,
      run: { id: RUN_ID },
      preset,
      request: { prompt: "p", productImagesDataUrls: [PNG_A] },
      telemetry,
    });

    const running = fake.updates.find((update) => update.values.status === "running");
    expect(running).toBeDefined();
    expect(running?.filters).toContainEqual({ column: "status", value: "pending", op: "eq" });
  });

  it("sem usage: custo estimado marcado como estimativa (não faturado)", async () => {
    fakeGateway.result = {
      imageBase64: testPng.toString("base64"),
      mimeType: "image/png",
      model: "gpt-image-2",
    };
    const { client, telemetry } = setup();

    const outcome = await executeBenchRun({
      client,
      gateway: fakeGateway,
      telemetrySink: sink,
      run: { id: RUN_ID },
      preset,
      request: { prompt: "p", productImagesDataUrls: [PNG_A] },
      telemetry,
    });

    expect(outcome.cost?.isEstimate).toBe(true);
    const runUpdate = fake.updates.filter((update) => update.table === "lab_bench_runs").at(-1);
    const detail = runUpdate?.values.cost_detail as Record<string, unknown>;
    expect(detail.is_estimate).toBe(true);
  });

  it("erro do provider é sanitizado antes de persistir e não há segunda chamada", async () => {
    fakeGateway.error = new Error(
      "falha com Bearer sk-abc123456789 em https://api.exemplo.com/v1",
    );
    const { client, telemetry } = setup();

    const outcome = await executeBenchRun({
      client,
      gateway: fakeGateway,
      telemetrySink: sink,
      run: { id: RUN_ID },
      preset,
      request: { prompt: "p", productImagesDataUrls: [PNG_A] },
      telemetry,
    });

    expect(outcome.status).toBe("failed");
    expect(fakeGateway.invocations).toHaveLength(1);

    const runUpdate = fake.updates.filter((update) => update.table === "lab_bench_runs").at(-1);
    expect(runUpdate?.values.status).toBe("failed");
    const written = runUpdate?.values.error_message as string;
    expect(written).not.toContain("sk-");
    expect(written).not.toContain("https://api.exemplo.com");
    expect(written).toContain("[redacted]");
  });

  it("o serviço não chama o resolvedor produtivo nem grava generation_events (fonte)", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/execution/bench-execution-service.ts"),
      "utf8",
    );
    expect(source).not.toContain("resolveAiCost");
    expect(source).not.toContain("estimateLabCampaignImageCost");
    expect(source).not.toContain("generation_events");
    expect(source).toContain("LabTelemetrySink");
    expect(source).toContain("resolveBenchCost");
    expect(source).toContain("sanitizeAiErrorMessage");
    expect(source).toContain("validateArtifactTechnically");
    expect(source).toContain("cost_source");
    expect(source).toContain("cost_rule_version");
  });
});

// ─── Prova: `prompt_sent` byte a byte idêntico ao prompt final aprovado ──────
// (UAT F48.2.3 — sem provider; usa gateway real + adapter gravador.)

describe("prova — prompt_sent é byte a byte o prompt final aprovado (adapter gravador)", () => {
  it("envia exatamente o texto aprovado, sem transformação, com adapter gravador", async () => {
    const preset = resolveBenchPreset("gpt-image-2-low");
    const recorder = new RecordingAdapter();
    const gateway = createBenchGateway({
      preset,
      adapters: { get: (protocol) => (protocol === "images" ? recorder : undefined) },
      fallbackResolver: createFallbackResolver(),
    });
    const { client, telemetry } = setup();

    // Prompt final "aprovado" com blocos canônicos, edição manual, placeholder
    // `{{ }}`, aspas tipográficas e acentos — nada pode ser transformado.
    const approvedPrompt = [
      "[IDENTIDADE E DIREÇÃO VISUAL]",
      "Loja: Adega Mestre das Geladas",
      "Cor da marca: #242422",
      "",
      "[DIREÇÃO TIPOGRÁFICA]",
      "Direção tipográfica: sans moderna",
      "",
      "[PRODUTO E IMAGENS DE REFERÊNCIA]",
      "Produto: Coca-Cola 2 L",
      "",
      "[CONDIÇÕES COMERCIAIS]",
      "Preço original: R$ 8,99",
      "Preço promocional: R$ 7,49",
      "Selo: Promoção",
      "Validade: até 03/10/2026",
      "",
      "[INTENÇÃO E FORMATO]",
      "Intenção: offer",
      "Formato: 1:1",
      "",
      "[INSTRUÇÕES DO PROMPT-BASE]",
      "Texto editado manualmente — {{placeholder}} preservado, “aspas”, acentos: ção/ã.",
      "",
      "[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]",
      "Imagem meramente ilustrativa",
    ].join("\n");

    await executeBenchRun({
      client,
      gateway,
      telemetrySink: sink,
      run: { id: RUN_ID },
      preset,
      request: { prompt: approvedPrompt, productImagesDataUrls: [PNG_A] },
      telemetry,
    });

    expect(recorder.calls).toHaveLength(1);
    const sent = recorder.calls[0].request.prompt;
    expect(sent).toBe(approvedPrompt);
    expect(sent.length).toBe(approvedPrompt.length);
    expect(Buffer.from(sent, "utf8").equals(Buffer.from(approvedPrompt, "utf8"))).toBe(true);
  });
});
