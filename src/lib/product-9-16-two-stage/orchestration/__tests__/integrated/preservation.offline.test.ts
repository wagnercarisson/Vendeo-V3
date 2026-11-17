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

import { deriveTwoStageStatus } from "../../status-view";
import {
  CAMPAIGN_ID,
  OPERATION_ID,
  createOfflineDeps,
  createOfflineWorld,
  initialInput,
  runOffline,
  terminalOf,
} from "./offline-harness";

describe("preservacao, suspensao e acesso (offline)", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.supabase.test";
  });

  it("flag OFF suspende a etapa paga sem provider/cobranca e nao cria operacao", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world);

    const suspended = await runOffline(
      initialInput({ allowNewPaidStep: false }),
      deps,
    );
    expect(terminalOf(suspended)).toMatchObject({
      type: "processing",
      state: "suspended",
      canContinue: false,
    });
    expect(counters.baseProviderCalls).toBe(0);
    expect(counters.expansionProviderCalls).toBe(0);
    expect(world.rpcCounts.product_1_1_close_failed_operation ?? 0).toBe(0);
    // Suspensão SEM efeitos: sem seleção não existe abertura legítima, então
    // nada é aberto/reservado/adquirido enquanto a geração está pausada.
    expect(world.rpcCounts.product_9_16_open_operation_v2 ?? 0).toBe(0);
    expect(world.rpcCounts.product_9_16_open_operation ?? 0).toBe(0);
    expect(world.rpcCounts.product_9_16_acquire_step ?? 0).toBe(0);
    expect(world.credit()).toBeNull();

    // A consulta continua possível: a operação ainda não existe (ausência é
    // ausência, não erro) e nenhum estado foi inventado.
    const view = await deps.control.getOperationView({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(view.kind).toBe("absent");

    // Autorizada, a geração nova começa e conclui normalmente.
    const started = await runOffline(
      initialInput({ allowNewPaidStep: true }),
      deps,
    );
    expect(terminalOf(started)).toMatchObject({ type: "result" });
    expect(counters.baseProviderCalls).toBe(1);
    expect(counters.expansionProviderCalls).toBe(1);
  });

  it("depois de entregue, a suspensao nao impede consultar/entregar o vertical integro", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps, counters } = await createOfflineDeps(world);
    await runOffline(initialInput(), deps);

    const query = await runOffline(
      initialInput({ allowNewPaidStep: false }),
      deps,
    );
    expect(terminalOf(query)).toMatchObject({ type: "result" });
    expect(counters.baseProviderCalls).toBe(1);
    expect(counters.expansionProviderCalls).toBe(1);

    const view = await deps.control.getOperationView({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    if (view.kind === "found") {
      const status = deriveTwoStageStatus(view.view, { allowNewPaidStep: false });
      expect(status.state).toBe("delivered");
      expect(status.terminal).toBe(true);
    }
  });

  it("abertura/confirmacao/publicacao acontecem uma vez e na ordem do contrato", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps } = await createOfflineDeps(world);
    await runOffline(initialInput(), deps);

    expect(world.rpcCounts.product_9_16_open_operation_v2).toBe(1);
    expect(world.rpcCounts.product_1_1_begin_publication).toBe(1);
    expect(world.rpcCounts.product_1_1_mark_campaign_credit_art_uploaded).toBe(1);
    expect(world.rpcCounts.product_1_1_deliver_campaign_credit_operation).toBe(1);
    expect(world.credit()?.status).toBe("delivered");
  });

  it("snapshot duravel permanece intacto (sem conversao/marcador novo) e o vertical nao vaza para campaign-images", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const campaignRow = world.rows.find((row) => row.__table === "campaigns");
    const snapshotBefore = JSON.stringify(campaignRow?.input_snapshot);
    const { deps } = await createOfflineDeps(world);
    await runOffline(initialInput(), deps);

    expect(JSON.stringify(campaignRow?.input_snapshot)).toBe(snapshotBefore);

    const campaignImagesUploads = world.base.handles.uploads.filter(
      (upload) => upload.bucket === "campaign-images",
    );
    expect(
      campaignImagesUploads.some((upload) => upload.path.endsWith(".jpg")),
    ).toBe(false);
    expect(
      campaignImagesUploads.every((upload) => upload.path.endsWith(".thumb-v1.webp")),
    ).toBe(true);
  });
});
