import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/ai", () => ({
  defaultAiGateway: { invoke: vi.fn(), hasFallback: vi.fn(async () => false) },
  withOnCallTelemetry: (base: unknown) => base,
}));
vi.mock("@/lib/ai-cost/ai-model-pricing", () => ({
  AiModelPricingService: class {
    async getModelPricing() {
      return null;
    }
  },
}));
vi.mock("../copy/copy-acquisition-client", () => ({
  ProductOneToOneCopyAcquisitionClient: class {},
}));
vi.mock("../copy/copy-state", () => ({
  COPY_BUDGET_MS: 30000,
  createCopyBudgetSignal: () => ({ signal: new AbortController().signal, dispose: () => {} }),
  readCopyRecoverySummary: vi.fn(async () => ({
    attemptSeq: 0,
    state: null,
    attemptActive: false,
    waitRemainingMs: 0,
    autoAttempts: 0,
    manualAttempts: 0,
    definitive: false,
  })),
  readCopyDelivery: vi.fn(async () => null),
  readCopyAttempts: vi.fn(async () => []),
  recordCopyState: vi.fn(async () => ({ success: true })),
  recordCancellation: vi.fn(async () => ({ success: true })),
  drainCopyTask: vi.fn(async (task: { run: (a: { signal: AbortSignal; commit: unknown }) => Promise<void>; signal: AbortSignal }) => {
    await task.run({ signal: task.signal, commit: vi.fn(async () => undefined) });
    return { state: "completed" };
  }),
}));

import { ProductOneToOneCopyRecoveryClient } from "../copy/copy-recovery";
import type { AiInvoker } from "@/lib/ai/gateway";

const COPY_INPUT = {
  campaignId: "camp-a",
  operationId: "op-a",
  storeId: "store-a",
  briefing: { product: { name: "P" }, commercial: { intent: "offer" as const } },
  copyContext: { storeName: "Loja", segment: "outros" },
  copyDirectorEnabled: true,
};

const PRICING = async () => ({ inputUsdPer1M: 0.1, outputUsdPer1M: 0.5, versionId: "test" });

function invokerOk() {
  const invokePrepared = vi.fn(async () => ({
    content: JSON.stringify({ title: "T", caption: "C", hashtags: [], cta_post: "x" }),
  }));
  return {
    invokePrepared,
    invoker: {
      invoke: vi.fn(),
      hasFallback: vi.fn(async () => false),
      prepare: vi.fn(async () => ({
        capability: "campaign_copy",
        target: "primary",
        provider: "openai",
        model: "gpt-6-luna",
        protocol: "chat-completions",
        resolved: { provider: "openai", model: "gpt-6-luna", protocol: "chat-completions" },
      })),
      invokePrepared,
    } as unknown as AiInvoker,
  };
}

function gateSpy() {
  const begin = vi.fn(async () => ({ acquired: true, handle: { callId: "c", ownerToken: "o", kind: "copy_auto" } }));
  return { beginPaidCall: begin, endPaidCall: vi.fn(async () => undefined), markUnknown: vi.fn(async () => undefined), begin } as never;
}

function acquisitionSpy(acquired = true) {
  return {
    acquire: vi.fn(async () => ({
      acquired,
      attemptSeq: acquired ? 1 : null,
      attemptToken: acquired ? "tok" : null,
      mode: "auto",
      reason: acquired ? null : "attempt_in_progress",
    })),
  };
}

describe("quick gpt6-luna — recuperação REAL via ProductOneToOneCopyRecoveryClient.recoverCopyAttempt", () => {
  it("vencedor: adquire, prepara alvo (primary), estima pelo pricing e invoca (invokePrepared)", async () => {
    const { invoker, invokePrepared } = invokerOk();
    const gate = gateSpy();
    const acquisition = acquisitionSpy(true);
    const client = new ProductOneToOneCopyRecoveryClient({} as never, acquisition as never);

    const result = await client.recoverCopyAttempt({
      campaignId: "camp-a",
      operationId: "op-a",
      mode: "auto",
      requestToken: "11111111-1111-4111-8111-111111111111",
      runner: COPY_INPUT,
      runnerDeps: { invoker, pilotSpend: gate, readCopyPricing: PRICING },
    } as never);

    expect(acquisition.acquire).toHaveBeenCalledTimes(1);
    // estimativa derivada do pricing do alvo: (2000*0.1 + 1000*0.5)/1e6 = 0.0007
    expect((gate as { begin: ReturnType<typeof vi.fn> }).begin).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedUsd: expect.closeTo(0.0007, 10) }),
    );
    expect(invokePrepared).toHaveBeenCalledTimes(1);
    expect((result as { outcome: string }).outcome).toBe("acquired_completed");
  });

  it("pricing inválido ⇒ BLOQUEIA sem provider (recuperação)", async () => {
    const { invoker, invokePrepared } = invokerOk();
    const gate = gateSpy();
    const acquisition = acquisitionSpy(true);
    const client = new ProductOneToOneCopyRecoveryClient({} as never, acquisition as never);

    await expect(
      client.recoverCopyAttempt({
        campaignId: "camp-a",
        operationId: "op-a",
        mode: "manual",
        requestToken: "22222222-2222-4222-8222-222222222222",
        runner: COPY_INPUT,
        runnerDeps: { invoker, pilotSpend: gate, readCopyPricing: async () => null },
      } as never),
    ).rejects.toThrow(/pricing_unavailable/);
    expect(invokePrepared).not.toHaveBeenCalled();
  });

  it("perdedor: NÃO chama provider nem o gate", async () => {
    const { invoker, invokePrepared } = invokerOk();
    const gate = gateSpy();
    const acquisition = acquisitionSpy(false);
    const client = new ProductOneToOneCopyRecoveryClient({} as never, acquisition as never);

    const result = await client.recoverCopyAttempt({
      campaignId: "camp-a",
      operationId: "op-a",
      mode: "auto",
      requestToken: "33333333-3333-4333-8333-333333333333",
      runner: COPY_INPUT,
      runnerDeps: { invoker, pilotSpend: gate, readCopyPricing: PRICING },
    } as never);

    expect(invokePrepared).not.toHaveBeenCalled();
    expect((gate as { begin: ReturnType<typeof vi.fn> }).begin).not.toHaveBeenCalled();
    expect((result as { outcome: string }).outcome).toBe("accompanied");
  });
});
