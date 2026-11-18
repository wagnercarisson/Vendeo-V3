// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    async record() {
      return undefined;
    }
  },
}));

import type { ImageGenerationConfigSnapshot } from "@/lib/ai/image-generation-config-snapshot";
import {
  buildProductOneToOneFrozenEvidence,
  computeContentFingerprint,
  persistProductOneToOneSnapshot,
  ProductOneToOneSnapshotPersistError,
  type ProductOneToOneFrozenEvidence,
} from "@/lib/product-1-1/snapshot/persist-snapshot";

import { CAMPAIGN_ID, createOfflineWorld } from "./offline-harness";

const OPERATION_A = "4d5e6f70-4d5e-4f60-9b8c-4d5e6f708192";
const OPERATION_B = "5e6f7081-5e6f-4a71-8c9d-5e6f70819203";

const SNAPSHOT: ImageGenerationConfigSnapshot = {
  campaignId: CAMPAIGN_ID,
  primaryModel: "gpt-image-2.5-sunburst",
  primaryQuality: "medium",
  fallbackModel: "gpt-image-2",
  fallbackQuality: "low",
  configVersionId: "0f7c3a1e-1c2b-4c3d-8e4f-1a2b3c4d5e6f",
  origin: "selection",
  createdAt: "2026-11-18T00:00:00.000Z",
};

function evidence(
  overrides: { operationId?: string; briefing?: string } = {},
): ProductOneToOneFrozenEvidence {
  return buildProductOneToOneFrozenEvidence({
    campaignId: CAMPAIGN_ID,
    operationId: overrides.operationId ?? OPERATION_A,
    campaignIntent: "offer",
    backgroundDirection: "studio",
    briefing: overrides.briefing ?? "briefing congelado",
    baseVersion: "base-v1",
    composerVersion: "composer-v1",
  });
}

type World = ReturnType<typeof createOfflineWorld>;

function snapshotRows(world: World) {
  return world.rows.filter(
    (row) => row.__table === "image_generation_config_snapshots",
  );
}

function bindingRows(world: World) {
  return world.rows.filter(
    (row) => row.__table === "product_1_1_snapshot_content_binding",
  );
}

function evidenceRows(world: World) {
  return world.rows.filter(
    (row) => row.__table === "product_1_1_snapshot_frozen_evidence",
  );
}

function snapshotOf(rows: Array<Record<string, unknown>>) {
  return structuredClone(rows);
}

async function expectIdentityConflict(run: () => Promise<unknown>) {
  let caught: unknown;
  try {
    await run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ProductOneToOneSnapshotPersistError);
  if (!(caught instanceof ProductOneToOneSnapshotPersistError)) {
    throw new Error("esperava ProductOneToOneSnapshotPersistError");
  }
  expect(caught.code).toBe("operation_identity_conflict");
  // Divergência recusada pelo binding, não pela evidência.
  expect(caught.message).not.toContain("evidence_divergent");
}

/**
 * F60.7-05 — a simulação da RPC `product_1_1_persist_snapshot_with_binding`
 * precisa recusar como a RPC real (`20261009000003`): reuso só sob equivalência
 * de snapshot/configuração/operação/fingerprint, com binding imutável.
 */
describe("binding de snapshot — simulação fiel da RPC atômica", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.supabase.test";
  });

  it("replay equivalente reusa snapshot e binding sem mutar o estado", async () => {
    const world = createOfflineWorld();

    const first = await persistProductOneToOneSnapshot(
      world.client,
      SNAPSHOT,
      evidence(),
    );
    expect(first.reused).toBe(false);

    const snapshotsBefore = snapshotOf(snapshotRows(world));
    const bindingsBefore = snapshotOf(bindingRows(world));

    const second = await persistProductOneToOneSnapshot(
      world.client,
      SNAPSHOT,
      evidence(),
    );

    expect(second.snapshotOriginalId).toBe(first.snapshotOriginalId);
    expect(second.reused).toBe(true);
    expect(snapshotRows(world)).toEqual(snapshotsBefore);
    expect(bindingRows(world)).toEqual(bindingsBefore);
    expect(snapshotRows(world)).toHaveLength(1);
    expect(bindingRows(world)).toHaveLength(1);
    expect(evidenceRows(world)).toHaveLength(1);
    expect(bindingRows(world)[0].content_fingerprint).toBe(
      computeContentFingerprint(evidence()),
    );
  });

  it("fingerprint divergente para a mesma operação ⇒ conflito sem sobrescrever o binding", async () => {
    const world = createOfflineWorld();
    await persistProductOneToOneSnapshot(
      world.client,
      SNAPSHOT,
      evidence({ briefing: "briefing A" }),
    );
    const bindingsBefore = snapshotOf(bindingRows(world));
    const snapshotsBefore = snapshotOf(snapshotRows(world));
    const persistedFingerprint = bindingRows(world)[0].content_fingerprint;

    await expectIdentityConflict(() =>
      persistProductOneToOneSnapshot(
        world.client,
        SNAPSHOT,
        evidence({ briefing: "briefing B" }),
      ),
    );

    expect(bindingRows(world)).toEqual(bindingsBefore);
    expect(snapshotRows(world)).toEqual(snapshotsBefore);
    expect(bindingRows(world)[0].content_fingerprint).toBe(
      persistedFingerprint,
    );
    expect(bindingRows(world)[0].content_fingerprint).not.toBe(
      computeContentFingerprint(evidence({ briefing: "briefing B" })),
    );
  });

  it("operação divergente não reutiliza o snapshot já vinculado ⇒ conflito sem novo binding", async () => {
    const world = createOfflineWorld();
    await persistProductOneToOneSnapshot(
      world.client,
      SNAPSHOT,
      evidence({ operationId: OPERATION_A }),
    );
    const bindingsBefore = snapshotOf(bindingRows(world));
    const evidenceBefore = snapshotOf(evidenceRows(world));

    await expectIdentityConflict(() =>
      persistProductOneToOneSnapshot(
        world.client,
        SNAPSHOT,
        evidence({ operationId: OPERATION_B }),
      ),
    );

    expect(bindingRows(world)).toEqual(bindingsBefore);
    expect(bindingRows(world)).toHaveLength(1);
    expect(bindingRows(world)[0].operation_id).toBe(OPERATION_A);
    expect(evidenceRows(world)).toEqual(evidenceBefore);
    expect(evidenceRows(world)).toHaveLength(1);
  });

  it("configuração divergente não substitui o snapshot congelado ⇒ conflito sem mutação", async () => {
    const world = createOfflineWorld();
    await persistProductOneToOneSnapshot(world.client, SNAPSHOT, evidence());
    const snapshotsBefore = snapshotOf(snapshotRows(world));
    const bindingsBefore = snapshotOf(bindingRows(world));
    const evidenceBefore = snapshotOf(evidenceRows(world));

    await expectIdentityConflict(() =>
      persistProductOneToOneSnapshot(
        world.client,
        { ...SNAPSHOT, primaryModel: "gpt-image-2" },
        evidence(),
      ),
    );

    expect(snapshotRows(world)).toEqual(snapshotsBefore);
    expect(snapshotRows(world)).toHaveLength(1);
    expect(snapshotRows(world)[0].primary_model).toBe(
      SNAPSHOT.primaryModel,
    );
    expect(bindingRows(world)).toEqual(bindingsBefore);
    expect(evidenceRows(world)).toEqual(evidenceBefore);
  });
});
