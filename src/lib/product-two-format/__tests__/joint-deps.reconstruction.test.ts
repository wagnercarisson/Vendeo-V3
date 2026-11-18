// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

const { globalTouched } = vi.hoisted(() => ({ globalTouched: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        globalTouched();
        return undefined;
      },
    },
  ),
}));
vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    async record() {
      return undefined;
    }
  },
}));

import { readSquareBaseFrozenState } from "@/lib/campaign/square-base/frozen-state";
import { reconstructForRepair } from "@/lib/product-9-16-two-stage/orchestration/reconstruction";
import {
  createOfflineDeps,
  createOfflineWorld,
  initialInput,
  runOffline,
  terminalOf,
} from "@/lib/product-9-16-two-stage/orchestration/__tests__/integrated/offline-harness";

import { createJointDeps } from "../orchestration/joint-deps";

/**
 * Prova REAL do caminho reparável: a jornada 9:16 offline cria o congelado
 * completo; o teste remove a evidência durável e reconstrói pelo
 * `reconstructForRepair` com as dependências conjuntas — leitura de campanha,
 * inputs e reparo usam o client injetado; o global é proibido.
 */
describe("composition root — reconstrução reparável real", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.supabase.test";
  });

  it("repara o congelado e lê os inputs pelo client injetado, sem tocar o global", async () => {
    const world = createOfflineWorld();
    world.seedScenario();
    const { deps: deps916 } = await createOfflineDeps(world);
    const events = await runOffline(initialInput(), deps916);
    expect(terminalOf(events)).toMatchObject({ type: "result" });

    const input = initialInput();
    const identity = {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
    };

    const complete = await readSquareBaseFrozenState(identity, {
      client: world.client,
    });
    expect(complete.kind).toBe("complete");

    const evidenceIndex = world.rows.findIndex(
      (row) => row.__table === "product_1_1_snapshot_frozen_evidence",
    );
    expect(evidenceIndex).toBeGreaterThanOrEqual(0);
    world.rows.splice(evidenceIndex, 1);

    const repairable = await readSquareBaseFrozenState(identity, {
      client: world.client,
    });
    expect(repairable.kind).toBe("repairable");

    const joint = createJointDeps({ client: world.client, thumbnailContext: null });
    const repaired = await reconstructForRepair(
      { ...identity, frozen: repairable },
      joint,
    );

    expect(repaired.ok ? null : repaired.reason).toBeNull();
    if (!repaired.ok) return;
    expect(repaired.repaired).toBe(true);
    expect(repaired.frozenState).toBe("complete");
    expect(repaired.content.productImagesDataUrls.length).toBeGreaterThan(0);

    const after = await readSquareBaseFrozenState(identity, {
      client: world.client,
    });
    expect(after.kind).toBe("complete");
    expect(globalTouched).not.toHaveBeenCalled();
  });
});
