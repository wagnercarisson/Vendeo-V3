// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationResult, AiTelemetryContext } from "@/lib/ai/types";
import type {
  ImageGenerationConfigSnapshot,
  CurrentImageGenerationConfig,
} from "@/lib/ai/image-generation-config-snapshot";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";

import type {
  CampaignOperationState,
  AttemptTarget,
} from "../orchestration/attempt-start-types";
import type { ProductPromptCompositionBriefing } from "../policies/types";
import type { ProductOneToOneArtifactRef } from "../artifact/types";
import type { AttemptEnvelope } from "../orchestration/instrumentation";

// ---------------------------------------------------------------------------
// Reconciliação dos 4 gaps de integração do Plano 08 — testes de ROTA +
// ORQUESTRADOR com as dependências DEFAULT REAIS e provider/copy SIMULADOS:
//   (i)   texto entregue da copy persistido (Gap 1);
//   (ii)  reenvio / corrida perdida ⇒ ZERO chamadas à copy (Gap 2);
//   (iii) conclusão tardia da copy ⇒ nenhuma persistência tardia (Gap 3);
//   (iv)  custo interno pela pricing do NOVO FLUXO (modelo+qualidade+versão+origem) (Gap 4);
//   (v)   envelope emitido + AGUARDADO; sink falho ⇒ sem rejeição não tratada (Gap 4).
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT_ID = "44444444-4444-4444-8444-444444444444";

const CONFIG: CurrentImageGenerationConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
  origin: "human_decision",
  configVersionId: "55555555-5555-4555-8555-555555555555",
};

const SNAPSHOT: ImageGenerationConfigSnapshot = Object.freeze({
  campaignId: CAMPAIGN_ID,
  primaryModel: "gpt-image-2.5-sunburst",
  primaryQuality: "medium",
  fallbackModel: "gpt-image-2",
  fallbackQuality: "medium",
  configVersionId: CONFIG.configVersionId,
  origin: "human_decision",
  createdAt: "2026-10-12T00:00:00.000Z",
  runId: "run-1",
  traceId: "trace-1",
});

const BRIEFING: ProductPromptCompositionBriefing = {
  backgroundDirection: "studio",
  product: { name: "Produto Teste", description: null },
  commercial: {
    intent: "offer",
    originalPriceText: null,
    discountedPriceText: "R$ 19,90",
    badge: null,
    validity: null,
  },
  constraints: { mandatoryArtworkText: null },
};

const COPY_CONTEXT = {
  storeName: "Loja Teste",
  segment: "outros",
  discountedPriceCents: 1990,
};

function makeInput() {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    storeId: STORE_ID,
    briefing: BRIEFING,
    briefingText: "briefing congelado",
    campaignIntent: "offer" as const,
    backgroundDirection: "studio" as const,
    productImagesDataUrls: ["data:image/png;base64,primary"],
    copyContext: COPY_CONTEXT,
    runId: "run-1",
    traceId: "trace-1",
  };
}

interface RecordedEvent {
  table: string;
  op: string;
  payload: Record<string, unknown>;
}

function makeRecordingClient(): { client: SupabaseClient; events: RecordedEvent[] } {
  const events: RecordedEvent[] = [];
  const chain = () => {
    const c = {
      eq() {
        return c;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
    };
    return c;
  };
  const client = {
    from(table: string) {
      return {
        upsert(payload: Record<string, unknown>) {
          events.push({ table, op: "upsert", payload });
          return Promise.resolve({ error: null });
        },
        insert(payload: Record<string, unknown>) {
          events.push({ table, op: "insert", payload });
          return Promise.resolve({ error: null });
        },
        select() {
          return chain();
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, events };
}

interface Harness {
  deps: Record<string, unknown>;
  events: RecordedEvent[];
  envelopes: AttemptEnvelope[];
  copyCalls: () => number;
  setProviderSequence(seq: Array<AiInvocationResult | Error>): void;
  setExistingOperation(state: CampaignOperationState | null): void;
  setRacedOperation(state: CampaignOperationState | null): void;
  setAcquireSequence(seq: Array<{ acquired: boolean; reason: string | null }>): void;
  setEnvelopeSink(sink: (envelope: AttemptEnvelope) => void | Promise<void>): void;
}

function baseState(overrides: Partial<CampaignOperationState> = {}): CampaignOperationState {
  return Object.freeze({
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    status: "reserved",
    amount: 1,
    creditTxId: "tx-1",
    refundTxId: null,
    consumedDefinitive: false,
    terminal: false,
    unknown: false,
    outcome: null,
    supportReference: null,
    ...overrides,
  });
}

function buildHarness(): Harness {
  const { client, events } = makeRecordingClient();
  let providerSequence: Array<AiInvocationResult | Error> = [];
  let providerIndex = 0;
  let acquireSequence: Array<{ acquired: boolean; reason: string | null }> = [];
  let acquireIndex = 0;
  let existingOperation: CampaignOperationState | null = null;
  let racedOperation: CampaignOperationState | null = null;
  let operationReads = 0;
  let copyCallCount = 0;
  let currentTarget: AttemptTarget = "primary";
  const envelopes: AttemptEnvelope[] = [];

  // Copy SIMULADA (provider): o runner DEFAULT REAL é usado; só o provider é fake.
  const copyInvoker: AiInvoker = {
    async invoke(): Promise<AiInvocationResult> {
      copyCallCount += 1;
      return {
        content: JSON.stringify({
          title: "Oferta Especial",
          caption: "Legenda simulada da campanha",
          hashtags: [],
          cta_post: "Aproveite!",
        }),
        model: "gpt-4o",
      };
    },
    async hasFallback() {
      return false;
    },
  };

  const createGateway = vi.fn((_pair: ImageModelPairConfig): AiInvoker => ({
    async invoke(): Promise<AiInvocationResult> {
      const next = providerSequence[providerIndex] ?? {
        imageBase64: "AAAA",
        mimeType: "image/png",
        model: "gpt-image-2.5-sunburst",
      };
      providerIndex += 1;
      if (next instanceof Error) throw next;
      return next;
    },
    async hasFallback() {
      return true;
    },
  }));

  const deps: Record<string, unknown> = {
    client,
    runPreflight: async () => ({
      config: CONFIG,
      pricing: {
        primary: {} as never,
        fallback: {} as never,
        missingComponents: [],
        pricingCoverage: "complete" as const,
      },
    }),
    buildSnapshot: () => SNAPSHOT,
    persistSnapshot: async () => ({ snapshotOriginalId: SNAPSHOT_ID, reused: false }),
    credit: {
      reserve: vi.fn(async () => baseState()),
      markArtUploaded: vi.fn(async () => baseState({ status: "art_uploaded" })),
      deliver: vi.fn(async () => baseState({ status: "delivered", terminal: true, consumedDefinitive: true })),
      refund: vi.fn(async () => baseState({ status: "refunded", terminal: true })),
    },
    attempts: {
      acquire: vi.fn(async (input: { target: AttemptTarget; attemptNumber: number }) => {
        currentTarget = input.target;
        const step = acquireSequence[acquireIndex] ?? { acquired: true, reason: null };
        acquireIndex += 1;
        return {
          acquired: step.acquired,
          reason: step.reason,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          attemptNumber: step.acquired ? input.attemptNumber : null,
          target: step.acquired ? input.target : null,
        };
      }),
      finish: vi.fn(async () => ({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptNumber: 1,
        target: currentTarget,
        status: "done",
        idempotent: false,
      })),
      recordOperationOutcome: vi.fn(async () => ({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        outcome: "unknown",
        supportReference: null,
        idempotent: false,
      })),
      getCampaignOperation: vi.fn(async () => {
        operationReads += 1;
        // Primeira leitura: estado da operação (curto-circuito de reenvio). Após
        // a aquisição perdida, a reconsulta devolve a operação vencedora.
        if (operationReads === 1) return existingOperation;
        return racedOperation ?? existingOperation;
      }),
    },
    artifact: {
      storeArtifact: vi.fn(async (): Promise<ProductOneToOneArtifactRef> => ({
        storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
      })),
      probeArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    },
    createGateway,
    createTelemetry: (): AiTelemetryContext => ({
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      attemptNumber: 1,
      sink: { emit: async () => {} },
    }),
    recordAttempt: vi.fn(async () => ({ id: "op-row-1", operationId: OPERATION_ID })),
    recordDiagnosis: vi.fn(async () => ({ reference: "ref-test" })),
    generateSupportReference: () => "66666666-6666-4666-8666-666666666666",
    copyInvoker, // copy DEFAULT real + provider SIMULADO (não fornecemos deps.copy)
    copyDirectorEnabled: true,
    onAttemptEnvelope: (envelope: AttemptEnvelope) => {
      envelopes.push(envelope);
    },
    // pricing do NOVO FLUXO SIMULADA (modelo+qualidade+versão+origem).
    resolveAttemptCost: async () => ({
      primary: {
        model: SNAPSHOT.primaryModel,
        quality: SNAPSHOT.primaryQuality,
        costUsd: 0.041,
        versionId: "pricing-ver-1",
        costSource: "pricing_table" as const,
      },
      fallback: {
        model: SNAPSHOT.fallbackModel,
        quality: SNAPSHOT.fallbackQuality,
        costUsd: 0.019,
        versionId: "pricing-ver-1",
        costSource: "pricing_table" as const,
      },
    }),
  };

  return {
    deps,
    events,
    envelopes,
    copyCalls: () => copyCallCount,
    setProviderSequence(seq) {
      providerSequence = seq;
      providerIndex = 0;
    },
    setExistingOperation(state) {
      existingOperation = state;
    },
    setRacedOperation(state) {
      racedOperation = state;
    },
    setAcquireSequence(seq) {
      acquireSequence = seq;
      acquireIndex = 0;
    },
    setEnvelopeSink(sink) {
      deps.onAttemptEnvelope = sink;
    },
  };
}

async function runOrchestrator(harness: Harness) {
  const { runProductOneToOneGeneration } = await import(
    "../orchestration/generation-orchestrator"
  );
  // `onAttemptEnvelope` default do harness captura os envelopes.
  const response = await runProductOneToOneGeneration(
    makeInput(),
    harness.deps as never,
  );
  const text = await response.text();
  const events = text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { response, events, terminal: events.at(-1) };
}

describe("Plano 08 (correção) — copy DEFAULT real conectada ao fluxo produtivo (Gap 1)", () => {
  it("a copy DEFAULT gera o texto e o PERSISTE (copy_text/copy_payload) ao entregar", async () => {
    const harness = buildHarness();
    harness.setProviderSequence([
      { imageBase64: "AAAA", mimeType: "image/png", model: "gpt-image-2.5-sunburst" },
    ]);
    // Usa o sink de envelope de captura (padrão do harness).
    harness.deps.onAttemptEnvelope = (envelope: AttemptEnvelope) => {
      harness.envelopes.push(envelope);
    };

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.copyCalls()).toBe(1);

    const copyUpserts = harness.events.filter(
      (event) => event.table === "product_1_1_copy_state" && event.op === "upsert",
    );
    const states = copyUpserts.map((event) => event.payload.state);
    expect(states).toEqual(["pending", "completed"]);

    const completed = copyUpserts.find((event) => event.payload.state === "completed");
    expect(completed?.payload.copy_text).toBe("Legenda simulada da campanha");
    expect(completed?.payload.copy_payload).toMatchObject({
      caption: "Legenda simulada da campanha",
    });
  });

  it("Gap 2: reenvio (operação EXISTENTE) ⇒ ZERO chamadas à copy e nenhum estado de copy", async () => {
    const harness = buildHarness();
    harness.setExistingOperation(
      baseState({ status: "delivered", terminal: true, consumedDefinitive: true }),
    );

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.copyCalls()).toBe(0);
    expect(
      harness.events.filter((event) => event.table === "product_1_1_copy_state"),
    ).toHaveLength(0);
  });

  it("Gap 2: corrida PERDIDA ⇒ ZERO chamadas à copy e nenhum estado de copy", async () => {
    const harness = buildHarness();
    harness.setExistingOperation(null);
    harness.setRacedOperation(baseState({ status: "reserved" }));
    harness.setAcquireSequence([{ acquired: false, reason: "in_progress" }]);

    const { terminal } = await runOrchestrator(harness);

    // A operação existe (vencedora da corrida) ⇒ terminal somente leitura.
    expect(terminal).toMatchObject({ type: "error", code: "operation_in_progress" });
    expect(harness.copyCalls()).toBe(0);
    expect(
      harness.events.filter((event) => event.table === "product_1_1_copy_state"),
    ).toHaveLength(0);
  });
});

describe("Plano 08 (correção) — conclusão tardia da copy não persiste (Gap 3)", () => {
  it("task da copy que IGNORA o abort ⇒ drain cancelado determinístico e conclusão tardia NÃO persiste", async () => {
    const harness = buildHarness();
    harness.setProviderSequence([
      { imageBase64: "AAAA", mimeType: "image/png", model: "gpt-image-2.5-sunburst" },
    ]);
    let budgetController: AbortController | undefined;
    let lateCommit: (() => Promise<void>) | undefined;
    let releaseLate: (() => void) | undefined;
    const lateGate = new Promise<void>((resolve) => {
      releaseLate = resolve;
    });

    // Aqui injetamos uma copy que IGNORA o abort para provar o latch do drenador.
    harness.deps.copy = {
      makeBudgetSignal: () => {
        budgetController = new AbortController();
        return { signal: budgetController.signal, dispose: () => {} };
      },
      runCopy: async ({ commit }: { commit: (d: { copyText: string }) => Promise<void> }) => {
        // ignora o abort e roda ALÉM do orçamento
        queueMicrotask(() => budgetController?.abort());
        await lateGate;
        lateCommit = () => commit({ copyText: "tarde demais" });
      },
      recordCopyState: (input: { campaignId: string; operationId: string; state: string; copyText?: string | null }) => {
        harness.events.push({
          table: "product_1_1_copy_state",
          op: "upsert",
          payload: input as unknown as Record<string, unknown>,
        });
        return Promise.resolve();
      },
      recordCancellation: (input: { reason: string }) => {
        harness.events.push({
          table: "product_1_1_copy_cancellations",
          op: "insert",
          payload: input as unknown as Record<string, unknown>,
        });
        return Promise.resolve();
      },
    };

    const { terminal } = await runOrchestrator(harness);
    expect(terminal).toMatchObject({ type: "result" });

    const statesAfterDrain = harness.events
      .filter((e) => e.table === "product_1_1_copy_state")
      .map((e) => e.payload.state);
    expect(statesAfterDrain).toEqual(["pending", "failed"]);
    expect(
      harness.events.filter((e) => e.table === "product_1_1_copy_cancellations"),
    ).toHaveLength(1);

    // A conclusão TARDIA tenta persistir, mas o latch bloqueia: nada muda.
    releaseLate?.();
    await new Promise((r) => setTimeout(r, 10));
    await lateCommit?.();
    expect(
      harness.events
        .filter((e) => e.table === "product_1_1_copy_state")
        .map((e) => e.payload.state),
    ).toEqual(["pending", "failed"]);
  });
});

describe("Plano 08 (correção) — custo interno pela pricing do NOVO FLUXO (Gap 4)", () => {
  it("o custo registrado no envelope vem de modelo+qualidade (+versão/origem), não da resolução legada", async () => {
    const harness = buildHarness();
    harness.setProviderSequence([
      { imageBase64: "AAAA", mimeType: "image/png", model: "gpt-image-2.5-sunburst" },
    ]);
    harness.deps.onAttemptEnvelope = (envelope: AttemptEnvelope) => {
      harness.envelopes.push(envelope);
    };

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.envelopes).toHaveLength(1);
    expect(harness.envelopes[0]).toMatchObject({
      target: "primary",
      model: SNAPSHOT.primaryModel,
      quality: SNAPSHOT.primaryQuality,
      internalCostUsd: 0.041,
      internalCostVersionId: "pricing-ver-1",
      internalCostSource: "pricing_table",
    });
  });

  it("Gap 4: a emissão do envelope é AGUARDADA e um sink FALHO não vira rejeição não tratada", async () => {
    const harness = buildHarness();
    harness.setProviderSequence([
      { imageBase64: "AAAA", mimeType: "image/png", model: "gpt-image-2.5-sunburst" },
    ]);
    let sinkCompleted = false;
    harness.deps.onAttemptEnvelope = async () => {
      await new Promise((r) => setTimeout(r, 5));
      sinkCompleted = true;
      throw new Error("sink_down");
    };

    const { terminal } = await runOrchestrator(harness);

    // O terminal foi emitido APÓS o sink completar (emissão AGUARDADA) e a falha
    // do sink NÃO interrompeu a geração nem gerou rejeição não tratada.
    expect(terminal).toMatchObject({ type: "result" });
    expect(sinkCompleted).toBe(true);
  });
});

describe("Plano 08 (correção) — wiring da ROTA (Gap 1)", () => {
  it("a rota generate-image delega o `copyContext` server-side (o orquestrador usa o default real)", () => {
    const routeSource = readFileSync(
      path.resolve(process.cwd(), "src/app/api/campaign/generate-image/route.ts"),
      "utf8",
    );
    expect(routeSource).toContain("copyContext: newFlowCopyContext");
    // A rota NÃO injeta `deps.copy`: o orquestrador conecta o DEFAULT real.
    expect(routeSource).not.toMatch(/runProductOneToOneGeneration\(\{[\s\S]{0,400}?copy:\s/);
  });

  it("o orquestrador conecta a corrida produtiva EXISTENTE como DEFAULT (não um no-op)", () => {
    const orchestratorSource = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-1-1/orchestration/generation-orchestrator.ts",
      ),
      "utf8",
    );
    expect(orchestratorSource).toContain("createDefaultProductOneToOneCopyOps");
    expect(orchestratorSource).toContain("deps.copy ??");
    // Gap 2 — a copy inicia APÓS a aquisição vencedora.
    expect(orchestratorSource).toContain("startCopy()");
    // Gap 4 — custo do novo fluxo + destino persistente do envelope.
    expect(orchestratorSource).toContain("resolveAttemptCost");
    expect(orchestratorSource).toContain("createDurableAttemptEnvelopeSink");
  });
});
