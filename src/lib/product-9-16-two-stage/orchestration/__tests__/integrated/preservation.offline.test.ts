// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { deriveTwoStageStatus } from "../../status-view";
import {
  CAMPAIGN_ID,
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

describe("preservacao, suspensao e acesso (offline)", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.supabase.test";
  });

  it("flag OFF suspende a etapa paga sem provider/cobranca e nao bloqueia a consulta", async () => {
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

    const view = await deps.control.getOperationView({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(view.kind).toBe("found");
    if (view.kind === "found") {
      const status = deriveTwoStageStatus(view.view, { allowNewPaidStep: false });
      expect(status.state).toBe("processing");
      expect(status.processingPhase).toBe("suspended");
      expect(status.canContinue).toBe(false);
    }

    // A mesma operacao continua normalmente quando autorizada; cada
    // continuacao executa UMA etapa (a UI encadeia).
    const afterBase = await runOffline(
      continueInput({
        allowNewPaidStep: true,
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(afterBase)).toMatchObject({
      type: "processing",
      nextStep: "expansion",
      canContinue: true,
    });
    const resumed = await runOffline(
      continueInput({
        allowNewPaidStep: true,
        acquisitionIds: { base: BASE_REQUEST, expansion: EXPANSION_REQUEST },
      }),
      deps,
    );
    expect(terminalOf(resumed)).toMatchObject({ type: "result" });
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

    expect(world.rpcCounts.product_9_16_open_operation).toBe(1);
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
