// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
  CAMPAIGN_ID,
  OPERATION_ID,
  PRODUCT_CONTENT_ID,
  createOfflineDeps,
  createOfflineWorld,
  initialInput,
  resetTelemetryEvents,
  runOffline,
  telemetryEvents,
  terminalOf,
} from "./offline-harness";

describe("percurso integrado offline (deps reais, DB/Storage/provider simulados)", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.supabase.test";
  });

  beforeEach(() => {
    resetTelemetryEvents();
  });

  it("executa base -> preparacao -> expansao -> entrega com uma reserva, uma confirmacao e um vertical", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world);

    const events = await runOffline(initialInput(), deps);

    expect(terminalOf(events)).toMatchObject({ type: "result", campaignId: CAMPAIGN_ID });
    expect(world.rpcCounts.product_9_16_open_operation).toBe(1);
    expect(world.rpcCounts.product_1_1_deliver_campaign_credit_operation).toBe(1);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    expect(counters.baseProviderCalls).toBe(1);
    expect(counters.expansionProviderCalls).toBe(1);
    expect(counters.copyCalls).toBe(1);
    expect(world.credit()?.status).toBe("delivered");
    expect(world.step("base")?.status).toBe("done");
    expect(world.step("expansion")?.status).toBe("done");
    expect(
      world.base
        .rowsForTable("campaign_composition_artifacts")
        .filter((row) => row.role === "vertical"),
    ).toHaveLength(1);
    // A derivacao REAL da miniatura roda (Sharp + Storage simulado).
    expect(
      world.base.handles.uploads.some((upload) =>
        upload.path.endsWith("vertical.thumb-v1.webp"),
      ),
    ).toBe(true);
    expect(world.rows.find((row) => row.__table === "campaigns")?.status).toBe("ready");
    // Identidade 9:16: o id e o hash do DATA URL bruto (contrato da F60.4).
    const evidence = world.rows.find(
      (row) => row.__table === "product_1_1_snapshot_frozen_evidence",
    );
    const selections = evidence?.reference_selections as Array<{ id: string }>;
    expect(selections[0]?.id).toBe(PRODUCT_CONTENT_ID);

    // Copy REAL persistida (estado/texto no caminho produtivo).
    const copy = world.copyState()[0];
    expect(copy).toMatchObject({
      state: "completed",
      copy_text: "Copy entregue congelada",
    });

    // Telemetria REAL: custo derivado de usage x pricing, nao um valor fixo.
    const baseEvent = telemetryEvents().find(
      (event) => event.cost?.costSource === "pricing_table",
    );
    expect(counters.telemetryEmits).toBe(1);
    expect(baseEvent).toBeDefined();
    expect(baseEvent?.cost?.pricingVersion).toBe("pricing-1");
    expect(baseEvent?.tokens?.promptTokens).toBe(120);
    expect(baseEvent?.tokens?.completionTokens).toBe(80);
    expect(baseEvent?.tokens?.totalTokens).toBe(200);
    expect(baseEvent?.tokens?.imageTokens).toBe(80);
    expect(baseEvent?.cost?.estimatedCostUsd).toBeGreaterThan(0);
    expect(baseEvent?.cost?.estimatedCostUsd).not.toBe(0.04);
  });

  it("reenvio inicial de operacao existente e query-only (zero provisao/provider/reserva)", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const first = await createOfflineDeps(world);
    await runOffline(initialInput(), first.deps);

    const before = { ...world.rpcCounts };
    const second = await createOfflineDeps(world);
    const events = await runOffline(initialInput(), second.deps);

    expect(terminalOf(events)).toMatchObject({ type: "result" });
    expect(second.counters.baseProviderCalls).toBe(0);
    expect(second.counters.expansionProviderCalls).toBe(0);
    expect(world.rpcCounts.product_9_16_open_operation).toBe(
      before.product_9_16_open_operation,
    );
    expect(world.rpcCounts.product_9_16_acquire_step).toBe(
      before.product_9_16_acquire_step,
    );
    expect(
      world.rpcCounts.product_1_1_deliver_campaign_credit_operation,
    ).toBe(before.product_1_1_deliver_campaign_credit_operation);
  });

  it("retomada apos base done reutiliza a base e nao regenera (uma unica chamada de provider na base)", async () => {
    const world = createOfflineWorld();
    world.seedScenario();

    // timeout apertado: a base cabe; depois dela o relogio avanca e a expansao
    // paga deixa de caber (nenhuma aquisicao/chamada de expansao).
    const { deps, counters } = await createOfflineDeps(world, {
      baseClockAdvanceMs: 30_000,
    });
    const firstEvents = await runOffline(initialInput({ timeoutMs: 40_000 }), deps);
    expect(terminalOf(firstEvents).type).toBe("processing");
    expect(counters.baseProviderCalls).toBe(1);
    expect(counters.expansionProviderCalls).toBe(0);
    expect(world.step("base")?.status).toBe("done");

    const resumeEvents = await runOffline(
      {
        ...initialInput(),
        mode: "continue",
        acquisitionIds: {
          base: "11111111-1111-4111-8111-111111111111",
          expansion: "22222222-2222-4222-8222-222222222222",
        },
      },
      deps,
    );
    expect(terminalOf(resumeEvents)).toMatchObject({ type: "result" });
    expect(counters.baseProviderCalls).toBe(1);
    expect(counters.expansionProviderCalls).toBe(1);
  });
});
