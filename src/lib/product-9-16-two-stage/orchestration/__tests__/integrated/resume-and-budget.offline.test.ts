// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    async record(event: unknown) {
      const store = globalThis as { __vendeoTelemetryEvents?: unknown[] };
      store.__vendeoTelemetryEvents = [...(store.__vendeoTelemetryEvents ?? []), event];
    }
  },
}));

import {
  OPERATION_ID,
  createOfflineDeps,
  createOfflineWorld,
  continueInput,
  initialInput,
  runOffline,
  terminalOf,
} from "./offline-harness";

const BASE_REQUEST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXPANSION_REQUEST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RETRY_BASE_REQUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RETRY_EXPANSION_REQUEST = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("retomada, orcamento e retry entre requisicoes (offline)", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.supabase.test";
  });

  it("orcamento insuficiente para a expansao devolve processing sem adquirir; a continuacao conclui", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world, {
      baseClockAdvanceMs: 30_000,
    });

    const first = await runOffline(initialInput({ timeoutMs: 40_000 }), deps);
    expect(terminalOf(first)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "expansion",
      canContinue: true,
    });
    expect(world.rpcCounts.product_9_16_acquire_step).toBe(1); // apenas a base
    expect(world.step("base")?.status).toBe("done");
    expect(world.step("expansion")?.status).toBe("pending");
    expect(counters.baseProviderCalls).toBe(1);
    expect(counters.expansionProviderCalls).toBe(0);

    const resumed = await runOffline(
      continueInput({
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(resumed)).toMatchObject({ type: "result" });
    expect(counters.baseProviderCalls).toBe(1); // base nao regenera
    expect(counters.expansionProviderCalls).toBe(1);
    expect(world.credit()?.status).toBe("delivered");
  });

  it("retry entre requisicoes: falha transitoria -> status read-only -> resume com uma nova tentativa", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world, {
      expansionMode: "transient_once",
    });

    const first = await runOffline(initialInput(), deps);
    expect(terminalOf(first)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "expansion",
      canContinue: true,
    });
    expect(counters.expansionProviderCalls).toBe(1);
    expect(world.step("expansion")?.status).toBe("failed");
    expect(world.credit()?.status).toBe("reserved");
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);

    // Leitura de status: zero provider/RPC de efeito.
    const view = await deps.control.getOperationView({
      campaignId: initialInput().campaignId,
      operationId: OPERATION_ID,
    });
    expect(view.kind).toBe("found");
    if (view.kind === "found") {
      expect(view.view.canContinue).toBe(true);
      expect(view.view.nextAction).toBe("retry_expansion");
    }
    expect(counters.expansionProviderCalls).toBe(1);

    const retried = await runOffline(
      continueInput({
        acquisitionIds: {
          base: RETRY_BASE_REQUEST,
          expansion: RETRY_EXPANSION_REQUEST,
        },
      }),
      deps,
    );
    expect(terminalOf(retried)).toMatchObject({ type: "result" });
    expect(counters.expansionProviderCalls).toBe(2);
    expect(world.rpcCounts.product_9_16_open_operation).toBe(1);
    expect(world.rpcCounts.product_1_1_begin_publication).toBe(1);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    expect(world.credit()?.status).toBe("delivered");
  });

  it("limite esgotado com falha conhecida estorna UMA vez; replay nao duplica", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world, {
      expansionMode: "transient_always",
    });

    const first = await runOffline(initialInput(), deps);
    expect(terminalOf(first).type).toBe("processing");

    // 2a tentativa (retry) tambem falha transitoriamente: limite esgotado.
    const second = await runOffline(
      continueInput({
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(second)).toMatchObject({
      type: "error",
      refunded: true,
    });
    expect(counters.expansionProviderCalls).toBe(2);
    expect(world.rpcCounts.product_1_1_close_failed_operation).toBe(1);
    expect(world.credit()?.status).toBe("refunded");
    expect(world.outcome()).toMatchObject({ outcome: "failed" });
    expect(world.rows.find((row) => row.__table === "campaigns")?.status).toBe("error");

    // Replay da continuacao: estorno idempotente, sem terceira chamada.
    const replay = await runOffline(
      continueInput({
        acquisitionIds: { base: RETRY_BASE_REQUEST, expansion: RETRY_EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(replay)).toMatchObject({
      type: "error",
      code: "operation_refunded",
      refunded: true,
    });
    expect(counters.expansionProviderCalls).toBe(2);
    expect(world.rpcCounts.product_1_1_close_failed_operation).toBe(1);
  });

  it("vertical integral nao estorna no limite esgotado (resolucao administrativa)", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world, {
      expansionMode: "transient_always",
    });
    const withIntegralArtifact = {
      ...deps,
      probeVertical: {
        probeVerticalArtifact: async () => ({
          kind: "integral" as const,
          format: "9:16" as const,
          width: 1080 as const,
          height: 1920 as const,
          mimeType: "image/jpeg" as const,
          storagePath: `${world.rows[0]?.store_id ?? "s"}/art/vertical.jpg`,
          evidenceRef: "vertical-evidence",
        }),
      },
    };

    await runOffline(initialInput(), withIntegralArtifact);
    const second = await runOffline(
      continueInput({
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      withIntegralArtifact,
    );
    expect(terminalOf(second)).toMatchObject({
      type: "processing",
      state: "delivery_pending",
      canContinue: false,
    });
    expect(counters.expansionProviderCalls).toBe(2);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    expect(world.credit()?.status).toBe("reserved");
  });

  it("operacao entregue em replay repara a projecao sem nova confirmacao/reserva", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps } = await createOfflineDeps(world);
    await runOffline(initialInput(), deps);

    const beforeDeliveries =
      world.rpcCounts.product_1_1_deliver_campaign_credit_operation;
    const beforePublications =
      world.rpcCounts.product_1_1_begin_publication;

    const replay = await runOffline(
      continueInput({
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(replay)).toMatchObject({ type: "result" });
    expect(world.rpcCounts.product_1_1_deliver_campaign_credit_operation).toBe(
      beforeDeliveries,
    );
    expect(world.rpcCounts.product_1_1_begin_publication).toBe(
      beforePublications,
    );
  });
});
