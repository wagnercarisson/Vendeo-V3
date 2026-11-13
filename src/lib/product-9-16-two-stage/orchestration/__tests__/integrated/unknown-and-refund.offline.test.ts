// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  createOfflineDeps,
  createOfflineWorld,
  continueInput,
  initialInput,
  runOffline,
  terminalOf,
} from "./offline-harness";

const BASE_REQUEST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXPANSION_REQUEST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("resultado desconhecido, estorno e arte tardia (offline)", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.supabase.test";
  });

  it("resultado desconhecido nao gera retry/estorno e permanece desconhecido na releitura", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world, {
      expansionMode: "unknown",
    });

    const first = await runOffline(initialInput(), deps);
    expect(terminalOf(first)).toMatchObject({ type: "unknown" });
    expect(world.outcome()).toMatchObject({ outcome: "unknown" });
    expect(counters.expansionProviderCalls).toBe(1);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    expect(world.credit()?.status).toBe("reserved");

    // Reenvio inicial: query-only, sem provider/reserva/estorno.
    const resend = await runOffline(initialInput(), deps);
    expect(terminalOf(resend)).toMatchObject({ type: "unknown" });
    expect(counters.expansionProviderCalls).toBe(1);
    expect(world.rpcCounts.product_9_16_open_operation).toBe(1);

    // Continuacao autorizada: resume devolve blocked/unknown; nada executa.
    const resumed = await runOffline(
      continueInput({
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(resumed)).toMatchObject({ type: "unknown" });
    expect(counters.expansionProviderCalls).toBe(1);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
  });

  it("falha definitiva estorna uma vez, fecha a projecao e replay nao duplica", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps } = await createOfflineDeps(world, {
      expansionMode: "definitive",
    });

    const first = await runOffline(initialInput(), deps);
    expect(terminalOf(first)).toMatchObject({
      type: "error",
      refunded: true,
    });
    expect(world.rpcCounts.product_1_1_close_failed_operation).toBe(1);
    expect(world.credit()?.status).toBe("refunded");
    expect(world.outcome()).toMatchObject({ outcome: "failed" });
    expect(world.rows.find((row) => row.__table === "campaigns")?.status).toBe("error");

    const replay = await runOffline(
      continueInput({
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(replay)).toMatchObject({
      type: "error",
      code: "operation_refunded",
      refunded: true,
    });
    expect(world.rpcCounts.product_1_1_close_failed_operation).toBe(1);
  });

  it("arte integral descoberta depois de finish(failed) nao reabre, nao entrega e nao estorna", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    let probeCalls = 0;
    const { deps, counters } = await createOfflineDeps(world, {
      expansionMode: "definitive",
    });
    const withLateArtifact = {
      ...deps,
      probeVertical: {
        probeVerticalArtifact: async () => {
          probeCalls += 1;
          return {
            kind: "integral" as const,
            format: "9:16" as const,
            width: 1080 as const,
            height: 1920 as const,
            mimeType: "image/jpeg" as const,
            storagePath: "late/vertical.jpg",
            evidenceRef: "late-evidence",
          };
        },
      },
    };

    const first = await runOffline(initialInput(), withLateArtifact);
    expect(terminalOf(first)).toMatchObject({
      type: "processing",
      state: "delivery_pending",
      canContinue: false,
    });
    expect(probeCalls).toBeGreaterThan(0);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    expect(world.rpcCounts.product_1_1_begin_publication ?? 0).toBe(0);
    expect(world.rpcCounts.product_1_1_deliver_campaign_credit_operation ?? 0).toBe(0);
    expect(world.credit()?.status).toBe("reserved");

    // A continuacao apenas confirma o estado; nao reabre a etapa nem entrega.
    const resumed = await runOffline(
      continueInput({
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      withLateArtifact,
    );
    expect(terminalOf(resumed)).toMatchObject({
      type: "processing",
      state: "delivery_pending",
      canContinue: false,
    });
    expect(counters.expansionProviderCalls).toBe(1);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    expect(world.rpcCounts.product_1_1_deliver_campaign_credit_operation ?? 0).toBe(0);
  });

  it("evidencia indeterminada vira unknown sem estorno", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps } = await createOfflineDeps(world, {
      expansionMode: "definitive",
    });
    const indeterminate = {
      ...deps,
      probeVertical: {
        probeVerticalArtifact: async () => ({ kind: "indeterminate" as const }),
      },
    };

    const first = await runOffline(initialInput(), indeterminate);
    expect(terminalOf(first)).toMatchObject({ type: "unknown" });
    expect(world.outcome()).toMatchObject({ outcome: "unknown" });
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    expect(world.credit()?.status).toBe("reserved");
  });

  it("retomada nao reexecuta a copy concluida (M2)", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world, {
      expansionMode: "transient_once",
      copyText: "Copy entregue congelada",
    });

    const first = await runOffline(initialInput(), deps);
    expect(terminalOf(first).type).toBe("processing");
    expect(counters.copyCalls).toBe(1);
    const frozenCopyInput = counters.copyInputs[0];

    const resumed = await runOffline(
      continueInput({
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(resumed)).toMatchObject({ type: "result" });
    expect(counters.copyCalls).toBe(1);
    expect(counters.copyInputs[0]).toEqual(frozenCopyInput);
  });
});
