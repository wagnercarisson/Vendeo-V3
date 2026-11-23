// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { VerticalArtifactProbeResult } from "@/lib/product-9-16-two-stage/two-stage-financial-service";
import type { RecordOutcomeResult } from "@/lib/product-9-16-two-stage/types";

import type {
  FormatAdditionDeliverResult,
  FormatAdditionRefundResult,
} from "../../financial-client";
import { deliverFormatAdditionVertical } from "../deliver-vertical";
import { finalizeFormatAdditionFailure } from "../finalize-failure";
import { createOfflineAdditionWorld } from "./support/offline-addition-world";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const TOKEN = "9c0d1e2f-9c0d-4e2f-8a1b-9c0d1e2f3a4b";
const SYSTEM: AuthorizationContext = { kind: "system" };

function integral(): VerticalArtifactProbeResult {
  return {
    kind: "integral",
    format: "9:16",
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    storagePath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`,
    evidenceRef: "evidence-1",
  };
}

const RECORDED_FAILURE: RecordOutcomeResult = {
  success: true,
  idempotent: false,
  outcome: "failed",
  stage: "expansion",
  supportReference: null,
};

function deliverySuccess(overrides: Record<string, unknown> = {}): FormatAdditionDeliverResult {
  return {
    success: true,
    idempotent: false,
    state: "delivered",
    operationId: OPERATION,
    ...overrides,
  };
}

function refundSuccess(): FormatAdditionRefundResult {
  return {
    success: true,
    idempotent: false,
    state: "refunded",
    operationId: OPERATION,
  };
}

function deliveryDeps(options: {
  probe?: VerticalArtifactProbeResult;
  token?: string | null;
  deliverResult?: FormatAdditionDeliverResult;
  thumbnailThrows?: boolean;
  world?: ReturnType<typeof createOfflineAdditionWorld>;
}) {
  const world = options.world ?? createOfflineAdditionWorld();
  return {
    world,
    deps: {
      probe: {
        probeVerticalArtifact: vi.fn(async () => options.probe ?? integral()),
      },
      publication: {
        beginPublication: vi.fn(async () => ({
          acquired: options.token !== null,
          token: options.token === undefined ? TOKEN : options.token,
          publicationState: options.token === null ? "in_flight" : "in_flight",
        })),
      },
      deliver: vi.fn(async () => {
        world.recordDeliveryCall();
        return options.deliverResult ?? deliverySuccess();
      }),
      generateThumbnail: vi.fn(async () => {
        world.recordThumbnailCall();
        if (options.thumbnailThrows) throw new Error("thumbnail down");
        return { status: "created" };
      }),
    },
  };
}

function finalizeDeps(options: {
  probe?: VerticalArtifactProbeResult;
  epoch?: number;
  recordOutcome?: RecordOutcomeResult;
  refundResult?: FormatAdditionRefundResult;
  refundThrows?: boolean;
  world?: ReturnType<typeof createOfflineAdditionWorld>;
}) {
  const world = options.world ?? createOfflineAdditionWorld();
  return {
    world,
    deps: {
      probe: {
        probeVerticalArtifact: vi.fn(async () => options.probe ?? { kind: "absent" as const }),
      },
      publication: {
        getPublicationEpoch: vi.fn(async () => options.epoch ?? 7),
      },
      control: {
        recordOutcome: vi.fn(async () => options.recordOutcome ?? RECORDED_FAILURE),
      },
      refund: vi.fn(async () => {
        world.recordRefundCall();
        if (options.refundThrows) throw new Error("refund down");
        return options.refundResult ?? refundSuccess();
      }),
    },
  };
}

describe("F62-04 — entrega vertical offline", () => {
  it("entrega artefato íntegro sem projeção de campanha/quadrado/copy", async () => {
    const world = createOfflineAdditionWorld();
    const { deps } = deliveryDeps({ world });

    const result = await deliverFormatAdditionVertical(
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, authorization: SYSTEM },
      deps,
    );

    expect(result).toEqual({ kind: "delivered", idempotent: false });
    expect(world.counters.deliveryCalls).toBe(1);
    expect(world.counters.thumbnailCalls).toBe(1);
    expect(world.counters.providerCalls).toBe(0);
    expect(world.counters.expansionCalls).toBe(0);
    expect(world.counters.campaignWrites).toBe(0);
    expect(world.counters.squareWrites).toBe(0);
    expect(world.counters.copyWrites).toBe(0);
  });

  it("falha de miniatura não desfaz a entrega", async () => {
    const world = createOfflineAdditionWorld();
    const { deps } = deliveryDeps({ world, thumbnailThrows: true });

    await expect(
      deliverFormatAdditionVertical(
        { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, authorization: SYSTEM },
        deps,
      ),
    ).resolves.toEqual({ kind: "delivered", idempotent: false });
    expect(world.counters.thumbnailCalls).toBe(1);
  });

  it("token indisponível vira processing sem chamar a RPC de entrega", async () => {
    const world = createOfflineAdditionWorld();
    const { deps } = deliveryDeps({ world, token: null });

    await expect(
      deliverFormatAdditionVertical(
        { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, authorization: SYSTEM },
        deps,
      ),
    ).resolves.toEqual({ kind: "processing", reason: "in_flight" });
    expect(world.counters.deliveryCalls).toBe(0);
  });

  it("sonda ausente/inválida/indeterminada é distinguida", async () => {
    for (const [probe, expected] of [
      [{ kind: "absent" as const }, { kind: "absent" }],
      [{ kind: "invalid" as const }, { kind: "invalid" }],
      [{ kind: "indeterminate" as const }, { kind: "indeterminate" }],
    ] as const) {
      const { deps } = deliveryDeps({ probe });
      await expect(
        deliverFormatAdditionVertical(
          { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, authorization: SYSTEM },
          deps,
        ),
      ).resolves.toEqual(expected);
    }
  });

  it("falha da RPC de entrega não vira sucesso", async () => {
    const { deps } = deliveryDeps({
      deliverResult: { success: false, reason: "stale_publication" },
    });
    await expect(
      deliverFormatAdditionVertical(
        { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, authorization: SYSTEM },
        deps,
      ),
    ).resolves.toMatchObject({
      kind: "failed",
      code: "stale_publication",
    });
  });
});

describe("F62-04 — falha definitiva/unknown offline", () => {
  it("arte ausente + outcome failed estorna somente a adição, uma vez", async () => {
    const world = createOfflineAdditionWorld();
    const { deps } = finalizeDeps({ world, epoch: 11 });

    const result = await finalizeFormatAdditionFailure(
      {
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        authorization: SYSTEM,
        reason: "invalid_output",
      },
      deps,
    );

    expect(result).toEqual({ kind: "refunded" });
    expect(deps.control.recordOutcome).toHaveBeenCalledWith({
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      stage: "expansion",
      outcome: "failed",
      supportReference: "invalid_output",
    });
    expect(deps.refund).toHaveBeenCalledWith({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      observedEpoch: 11,
      reason: "invalid_output",
    });
    expect(world.counters.refundCalls).toBe(1);
    expect(world.counters.campaignWrites).toBe(0);
    expect(world.counters.squareWrites).toBe(0);
    expect(world.counters.copyWrites).toBe(0);
  });

  it("artefato íntegro recuperado não estorna e retorna delivered", async () => {
    const world = createOfflineAdditionWorld();
    const { deps } = finalizeDeps({ world, probe: integral() });

    await expect(
      finalizeFormatAdditionFailure(
        {
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          authorization: SYSTEM,
          reason: "timeout",
        },
        deps,
      ),
    ).resolves.toEqual({ kind: "delivered", reason: "artifact_present" });
    expect(deps.control.recordOutcome).not.toHaveBeenCalled();
    expect(deps.refund).not.toHaveBeenCalled();
    expect(world.counters.refundCalls).toBe(0);
  });

  it("sonda indeterminada vira unknown, sem estorno/outcome", async () => {
    const { deps } = finalizeDeps({ probe: { kind: "indeterminate" } });

    await expect(
      finalizeFormatAdditionFailure(
        {
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          authorization: SYSTEM,
          reason: "timeout",
        },
        deps,
      ),
    ).resolves.toEqual({ kind: "unknown", reason: "probe_indeterminate" });
    expect(deps.control.recordOutcome).not.toHaveBeenCalled();
    expect(deps.refund).not.toHaveBeenCalled();
  });

  it("outcome failed não confirmado bloqueia sem estorno", async () => {
    const { deps } = finalizeDeps({
      recordOutcome: { success: false, reason: "operation_terminal" },
    });

    await expect(
      finalizeFormatAdditionFailure(
        {
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          authorization: SYSTEM,
          reason: "timeout",
        },
        deps,
      ),
    ).resolves.toEqual({ kind: "blocked", reason: "operation_terminal" });
    expect(deps.refund).not.toHaveBeenCalled();
  });

  it("refund unknown não vira refunded", async () => {
    const { deps } = finalizeDeps({
      refundResult: { success: false, reason: "operation_unknown" },
    });
    await expect(
      finalizeFormatAdditionFailure(
        {
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          authorization: SYSTEM,
          reason: "timeout",
        },
        deps,
      ),
    ).resolves.toEqual({ kind: "unknown", reason: "operation_unknown" });
  });

  it("refund lançado é unknown, nunca sucesso", async () => {
    const { deps } = finalizeDeps({ refundThrows: true });
    await expect(
      finalizeFormatAdditionFailure(
        {
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          authorization: SYSTEM,
          reason: "timeout",
        },
        deps,
      ),
    ).resolves.toMatchObject({ kind: "unknown" });
  });

  it("entrega/estorno não chamam projeção de campanha", async () => {
    const fs = await import("node:fs");
    for (const file of ["deliver-vertical.ts", "finalize-failure.ts"]) {
      const source = fs.readFileSync(
        `src/lib/campaign/format-addition/orchestration/${file}`,
        "utf8",
      );
      expect(source).not.toContain("projectDeliveredCampaign");
      expect(source).not.toContain("projectClosedCampaign");
      expect(source).not.toMatch(/UPDATE\s+public\.campaigns/i);
      expect(source).not.toMatch(/campaigns\.storage_path/);
      expect(source).not.toContain("product_two_format");
    }
  });
});
