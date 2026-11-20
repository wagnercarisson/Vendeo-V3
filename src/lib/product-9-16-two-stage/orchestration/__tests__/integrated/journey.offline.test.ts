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
  frozenSelectionOf,
  initialInput,
  resetTelemetryEvents,
  runOffline,
  telemetryEvents,
  terminalOf,
} from "./offline-harness";
import { LEGACY_SUNBURST_LOW } from "@/lib/ai/nine-sixteen-expansion-model-config";

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
    const copyPhases = events.filter(
      (event) => event.type === "phase" && event.phase === "campaign_copy",
    );
    expect(copyPhases.map((event) => event.status)).toEqual(["running", "complete"]);
    expect(copyPhases.at(-1)).toMatchObject({
      message: "Texto da campanha gerado.",
    });
    expect(world.rpcCounts.product_9_16_open_operation_v2).toBe(1);
    // A abertura v2 conta SOMENTE como v2 (nenhum alias legado artificial).
    expect(world.rpcCounts.product_9_16_open_operation ?? 0).toBe(0);
    expect(world.rpcCounts.product_1_1_deliver_campaign_credit_operation).toBe(1);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    expect(counters.baseProviderCalls).toBe(1);
    expect(counters.expansionProviderCalls).toBe(1);
    expect(counters.copyCalls).toBe(1);
    // Quick 261120-qvp (5b): a expansão recebeu o snapshot econômico CONGELADO
    // lido do `campaigns.input_snapshot` semeado (5,1 / 1) pelo leitor default.
    expect(counters.expansionTelemetry).toEqual({
      usdBrlRateAtGeneration: 5.1,
      creditValueBrlAtGeneration: 1,
    });
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
    expect(world.rpcCounts.product_9_16_open_operation_v2).toBe(
      before.product_9_16_open_operation_v2,
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

  it("a abertura nova congela a seleção na operação v2 (pass-through real, sem emulação)", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world);

    await runOffline(initialInput(), deps);

    expect(world.operation()).toMatchObject({
      contract_version: 2,
      expansion_model: "gpt-image-2.5-sunburst",
      expansion_quality: "low",
      expansion_selection_origin: "configured",
    });
    expect(world.rpcCounts.product_9_16_open_operation_v2).toBe(1);
    // v2 conta SOMENTE como v2: nenhum alias legado artificial.
    expect(world.rpcCounts.product_9_16_open_operation ?? 0).toBe(0);
    // O preflight da seleção congelada roda UMA vez por etapa paga.
    expect(counters.frozenPreflightCalls).toBe(1);

    // A derivação REAL (view do cliente de controle + função pura) devolve a
    // seleção efetivamente congelada na operação.
    await expect(frozenSelectionOf(deps)).resolves.toMatchObject({
      kind: "found",
      selection: {
        origin: "configured",
        model: "gpt-image-2.5-sunburst",
        quality: "low",
        configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
      },
    });
  });

  it("operação v1 deriva o legado e v2 incompleta falha fechado (sem banco real)", async () => {
    const legacy = createOfflineWorld();
    legacy.seedScenario();
    legacy.seedOperation({ contractVersion: 1 });
    const legacyComposition = await createOfflineDeps(legacy);
    await expect(frozenSelectionOf(legacyComposition.deps)).resolves.toEqual({
      kind: "found",
      selection: LEGACY_SUNBURST_LOW,
    });

    const broken = createOfflineWorld();
    broken.seedScenario();
    broken.seedOperation({ contractVersion: 2 });
    const brokenComposition = await createOfflineDeps(broken);
    await expect(frozenSelectionOf(brokenComposition.deps)).resolves.toEqual({
      kind: "invalid",
      reason: "frozen_selection_missing",
    });
  });
});
