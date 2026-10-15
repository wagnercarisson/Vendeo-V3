// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationResult, AiTelemetryContext } from "@/lib/ai/types";
import type {
  ImageGenerationConfigSnapshot,
  CurrentImageGenerationConfig,
} from "@/lib/ai/image-generation-config-snapshot";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { ProductPromptCompositionBriefing } from "../policies/types";
import type { CreditOperationState } from "../credit-operation/types";
import { CreditOperationError } from "../credit-operation/types";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// F56.2b2b — Plano 03 / Task 3: CAMADA 1 — simulação controlada das falhas
// raras (B2B-D8). Prova o CONTROLE DE FLUXO sob fakes: `failed` só no ponto de
// decisão terminal (4a); chamadores não-terminais inconclusivos; `invalid` NUNCA
// é ausência; falha de marcador/`unknown` imutável NÃO fecha. NÃO substitui a
// Camada 2 (Plano 06, efeitos reais em Postgres/Storage isolados). Sem banco,
// sem provider real, sem migrations.
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
    runId: "run-1",
    traceId: "trace-1",
  };
}

function baseOp(over: Partial<CreditOperationState> = {}): CreditOperationState {
  return Object.freeze({
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    status: "reserved",
    amount: 1,
    creditTxId: "tx-1",
    refundTxId: null,
    idempotent: false,
    consumedDefinitive: false,
    ...over,
  });
}

type ArtifactKind = "integral" | "absent" | "invalid" | "indeterminate";

interface Layer1Harness {
  readonly deps: Parameters<
    typeof import("../orchestration/generation-orchestrator").runProductOneToOneGeneration
  >[1];
  readonly closeCalls: Array<Record<string, unknown>>;
  readonly recordOutcomes: string[];
  readonly refundCalls: number;
  setProviderSequence(seq: Array<AiInvocationResult | Error>): void;
  setArtifactKind(kind: ArtifactKind): void;
  setStoreArtifactThrows(fail: boolean): void;
  setMarkerWriteThrows(fail: boolean): void;
  setCloseThrows(fail: boolean): void;
  setRecordAttemptThrows(fail: boolean): void;
  setAcquireSequence(seq: Array<{ acquired: boolean; reason: string | null }>): void;
}

async function buildHarness(): Promise<Layer1Harness> {
  const order: string[] = [];
  const closeCalls: Array<Record<string, unknown>> = [];
  const recordOutcomes: string[] = [];
  let refundCalls = 0;
  let providerSequence: Array<AiInvocationResult | Error> = [];
  let providerIndex = 0;
  let acquireSequence: Array<{ acquired: boolean; reason: string | null }> = [];
  let acquireIndex = 0;
  let artifactKind: ArtifactKind = "absent";
  let storeArtifactThrows = false;
  let markerWriteThrows = false;
  let closeThrows = false;
  let recordAttemptThrows = false;
  let currentTarget: "primary" | "fallback" = "primary";

  const credit = {
    reserve: vi.fn(async () => baseOp({ status: "reserved" })),
    markArtUploaded: vi.fn(async () => baseOp({ status: "art_uploaded" })),
    deliver: vi.fn(async () => baseOp({ status: "delivered", consumedDefinitive: true })),
    refund: vi.fn(async () => {
      refundCalls += 1;
      order.push("refund");
      return baseOp({ status: "refunded" });
    }),
    closeFailedOperation: vi.fn(async (input: Record<string, unknown>) => {
      order.push("closeFailedOperation");
      closeCalls.push(input);
      if (closeThrows) throw new Error("close_failed");
      return baseOp({ status: "refunded" });
    }),
  };

  const attempts = {
    acquire: vi.fn(async (input: { target: "primary" | "fallback"; attemptNumber: number }) => {
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
    finish: vi.fn(async () => ({ success: true })),
    recordOperationOutcome: vi.fn(async (input: { outcome: "unknown" | "failed" }) => {
      recordOutcomes.push(input.outcome);
      if (markerWriteThrows) throw new Error("marker_write_failed");
      return { success: true, outcome: input.outcome };
    }),
    getCampaignOperation: vi.fn(async () => null),
  };

  const artifact = {
    storeArtifact: vi.fn(async () => {
      if (storeArtifactThrows) throw new Error("store_failed");
      return Object.freeze({
        storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
      });
    }),
    probeArtifact: vi.fn(async () =>
      artifactKind === "integral"
        ? {
            kind: "integral" as const,
            ref: { storagePath: "x", width: 1024, height: 1024, mimeType: "image/jpeg" },
            width: 1024,
            height: 1024,
            mimeType: "image/jpeg",
            storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
          }
        : { kind: artifactKind },
    ),
  };

  const createGateway = vi.fn((): AiInvoker => {
    return {
      async invoke(): Promise<AiInvocationResult> {
        const next = providerSequence[providerIndex] ?? {
          imageBase64: "AAAA",
          mimeType: "image/png",
          model: currentTarget === "fallback" ? "gpt-image-2" : "gpt-image-2.5-sunburst",
        };
        providerIndex += 1;
        if (next instanceof Error) throw next;
        return next;
      },
      async hasFallback() {
        return true;
      },
    };
  });

  const deps = {
    runPreflight: async () => {
      order.push("preflight");
      return {
        config: CONFIG,
        pricing: {
          primary: {} as never,
          fallback: {} as never,
          missingComponents: [],
          pricingCoverage: "complete" as const,
        },
      };
    },
    buildSnapshot: () => SNAPSHOT,
    persistSnapshot: async () => ({ snapshotOriginalId: SNAPSHOT_ID, reused: false }),
    credit: credit as never,
    attempts: attempts as never,
    artifact: artifact as never,
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
    recordAttempt: vi.fn(async () => {
      if (recordAttemptThrows) throw new Error("attempt_history_failed");
      return { id: "op-row-1", operationId: OPERATION_ID };
    }),
    recordDiagnosis: vi.fn(async (input: { reference?: string }) => ({
      reference: input.reference ?? "ref",
    })),
    generateSupportReference: () => "66666666-6666-4666-8666-666666666666",
  } as Parameters<
    typeof import("../orchestration/generation-orchestrator").runProductOneToOneGeneration
  >[1];

  return {
    deps,
    closeCalls,
    recordOutcomes,
    get refundCalls() {
      return refundCalls;
    },
    setProviderSequence(seq) {
      providerSequence = seq;
      providerIndex = 0;
    },
    setArtifactKind(kind) {
      artifactKind = kind;
    },
    setStoreArtifactThrows(fail) {
      storeArtifactThrows = fail;
    },
    setMarkerWriteThrows(fail) {
      markerWriteThrows = fail;
    },
    setCloseThrows(fail) {
      closeThrows = fail;
    },
    setRecordAttemptThrows(fail) {
      recordAttemptThrows = fail;
    },
    setAcquireSequence(seq) {
      acquireSequence = seq;
      acquireIndex = 0;
    },
  } as Layer1Harness;
}

async function run(harness: Layer1Harness) {
  const { runProductOneToOneGeneration } = await import(
    "../orchestration/generation-orchestrator"
  );
  const response = await runProductOneToOneGeneration(makeInput(), harness.deps);
  const events = (await response.text())
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { terminal: events.at(-1) as Record<string, unknown> };
}

const TERMINAL_FAILURE = () =>
  Object.assign(new Error("content policy violation"), { code: "content_policy" });
const RETRYABLE_FAILURE = () =>
  Object.assign(new Error("model overloaded"), { code: "model_overloaded" });

describe("F56.2b2b — Camada 1: 'failed' só no ponto terminal (4a) e chamadores não-terminais inconclusivos", () => {
  it("sucesso ⇒ nenhum encerramento PF e nenhum estorno", async () => {
    const harness = await buildHarness();
    const { terminal } = await run(harness);
    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.closeCalls).toHaveLength(0);
    expect(harness.refundCalls).toBe(0);
    expect(harness.recordOutcomes).not.toContain("failed");
  });

  it("(i) falha de `storeArtifact` (~1145, artifact_store_failed) ⇒ inconclusivo, NÃO fecha, sem estorno", async () => {
    const harness = await buildHarness();
    harness.setStoreArtifactThrows(true);
    harness.setArtifactKind("absent");

    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "unknown" });
    expect(harness.closeCalls).toHaveLength(0);
    expect(harness.refundCalls).toBe(0);
    // O marcador `failed` NÃO é gravado fora do ponto terminal.
    expect(harness.recordOutcomes).not.toContain("failed");
  });

  it("(ii) sonda `indeterminate` no ponto terminal ⇒ pendência, NENHUM estorno, NENHUMA conclusão de ausência", async () => {
    const harness = await buildHarness();
    harness.setArtifactKind("indeterminate");
    harness.setProviderSequence([TERMINAL_FAILURE()]);

    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "unknown" });
    expect(harness.closeCalls).toHaveLength(0);
    expect(harness.refundCalls).toBe(0);
    // `failed` gravado só no ponto terminal; o `unknown` NÃO é reescrito.
    expect(harness.recordOutcomes).toEqual(["failed"]);
  });

  it("(ii-bis) sonda `invalid` (presente não íntegro) no terminal ⇒ pendência e NUNCA tratada como ausência", async () => {
    const harness = await buildHarness();
    harness.setArtifactKind("invalid");
    harness.setProviderSequence([TERMINAL_FAILURE()]);

    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "unknown" });
    // `invalid` NUNCA colapsa para o encerramento PF (não é ausência confirmada).
    expect(harness.closeCalls).toHaveLength(0);
    expect(harness.refundCalls).toBe(0);
  });

  it("(iii) falha de gravação do marcador `failed` ⇒ NÃO fecha (sem closeFailedOperation) e roteia à autorizada", async () => {
    const harness = await buildHarness();
    harness.setArtifactKind("absent");
    harness.setMarkerWriteThrows(true);
    harness.setProviderSequence([TERMINAL_FAILURE()]);

    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "unknown" });
    // Sem marcador persistido, o encerramento PF NÃO é apresentado.
    expect(harness.closeCalls).toHaveLength(0);
    expect(harness.refundCalls).toBe(0);
  });

  it("(iv) caller ~1031 (attempt_history_failed) ⇒ inconclusivo, NÃO fecha e NÃO grava `failed`", async () => {
    const harness = await buildHarness();
    harness.setRecordAttemptThrows(true);
    harness.setArtifactKind("absent");

    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "unknown" });
    expect(harness.closeCalls).toHaveLength(0);
    expect(harness.refundCalls).toBe(0);
    expect(harness.recordOutcomes).not.toContain("failed");
  });
});

describe("F56.2b2b — Camada 1: PF (4a) completo e janela principal→fallback", () => {
  it("ponto terminal + ausência CONFIRMADA + marcador persistido ⇒ `closeFailedOperation` UMA vez com o artKind REAL", async () => {
    const harness = await buildHarness();
    harness.setArtifactKind("absent");
    harness.setProviderSequence([TERMINAL_FAILURE()]);

    const { terminal } = await run(harness);

    expect(harness.recordOutcomes).toEqual(["failed"]);
    expect(harness.closeCalls).toHaveLength(1);
    expect(harness.closeCalls[0]).toEqual({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      artKind: "absent",
      reason: "generation_failed",
    });
    expect(harness.refundCalls).toBe(0);
    expect(terminal).toMatchObject({ type: "error", code: "IMG-001" });
    expect(String(terminal.message)).toContain("estornado");
  });

  it("janela principal→fallback NÃO grava `failed`; só a decisão terminal grava (exatamente uma vez)", async () => {
    const harness = await buildHarness();
    harness.setArtifactKind("absent");
    // primary falha retryável (fallback pendente) → fallback falha terminal.
    harness.setProviderSequence([RETRYABLE_FAILURE(), TERMINAL_FAILURE()]);

    const { terminal } = await run(harness);

    // Nenhum marcador durante a janela; exatamente UM `failed` (no terminal).
    expect(harness.recordOutcomes).toEqual(["failed"]);
    expect(harness.closeCalls).toHaveLength(1);
    expect(harness.refundCalls).toBe(0);
    expect(terminal).toMatchObject({ type: "error", code: "IMG-001" });
  });

  it("retry/fallback pendente (fallback vence) ⇒ NÃO estorna e NÃO grava `failed`", async () => {
    const harness = await buildHarness();
    harness.setArtifactKind("absent");
    harness.setProviderSequence([
      RETRYABLE_FAILURE(),
      { imageBase64: "BBBB", mimeType: "image/png", model: "gpt-image-2" },
    ]);

    const { terminal } = await run(harness);

    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.recordOutcomes).not.toContain("failed");
    expect(harness.closeCalls).toHaveLength(0);
    expect(harness.refundCalls).toBe(0);
  });

  it("encerramento PF recusado (close lança) ⇒ sem estorno e terminal `unknown`", async () => {
    const harness = await buildHarness();
    harness.setArtifactKind("absent");
    harness.setCloseThrows(true);
    harness.setProviderSequence([TERMINAL_FAILURE()]);

    const { terminal } = await run(harness);

    expect(harness.closeCalls).toHaveLength(1);
    expect(harness.refundCalls).toBe(0);
    expect(terminal).toMatchObject({ type: "unknown" });
    expect(String(terminal.message ?? "")).not.toContain("estornado");
  });
});

describe("F56.2b2b — Camada 1: contrato do cliente `closeFailedOperation` (cliente REAL + RPC simulada)", () => {
  function clientWithRpc(result: { data?: unknown; error?: unknown }) {
    const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
    return { client: { rpc } as unknown as SupabaseClient, rpc };
  }

  const successEnvelope = (over: Record<string, unknown> = {}) => ({
    success: true,
    idempotent: false,
    status: "refunded",
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    action: "close_failed_operation",
    ...over,
  });

  it("sucesso com IDENTIDADE exata ⇒ devolve estado `refunded` e envia o artKind REAL", async () => {
    const { client, rpc } = clientWithRpc({ data: successEnvelope() });
    const state = await new ProductOneToOneCreditOperationClient(client).closeFailedOperation({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      artKind: "absent",
      reason: "generation_failed",
    });
    expect(state).toMatchObject({ status: "refunded", campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    expect(rpc).toHaveBeenCalledWith("product_1_1_close_failed_operation", {
      p_campaign_id: CAMPAIGN_ID,
      p_operation_id: OPERATION_ID,
      p_art_kind: "absent",
      p_reason: "generation_failed",
    });
  });

  it("`success` ausente/falso, identidade ou ação divergentes ⇒ LANÇA (fail-closed)", async () => {
    const bad = [
      { status: "refunded", campaign_id: CAMPAIGN_ID, operation_id: OPERATION_ID, action: "close_failed_operation" },
      successEnvelope({ success: false }),
      successEnvelope({ operation_id: "99999999-9999-4999-8999-999999999999" }),
      successEnvelope({ campaign_id: "99999999-9999-4999-8999-999999999999" }),
      successEnvelope({ action: "refund" }),
      successEnvelope({ status: "weird" }),
      null,
    ];
    for (const data of bad) {
      const { client } = clientWithRpc({ data });
      await expect(
        new ProductOneToOneCreditOperationClient(client).closeFailedOperation({
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          artKind: "absent",
        }),
      ).rejects.toBeInstanceOf(CreditOperationError);
    }
  });

  it("recusas do PF são mapeadas para erros TIPADOS", async () => {
    for (const code of [
      "delivered_not_refundable",
      "operation_terminal",
      "finality_not_recorded",
      "operation_in_progress",
      "absent_not_confirmed",
    ]) {
      const { client } = clientWithRpc({ error: { message: code } });
      await expect(
        new ProductOneToOneCreditOperationClient(client).closeFailedOperation({
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          artKind: "absent",
        }),
      ).rejects.toMatchObject({ code });
    }
  });
});
