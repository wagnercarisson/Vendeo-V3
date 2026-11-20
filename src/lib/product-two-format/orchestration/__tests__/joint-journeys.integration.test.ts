// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { openJointOperation } from "../joint-operation-service";
import { preflightJointSelection } from "../preflight";
import { runJointBase } from "../joint-base";
import { deliverJointSquare } from "../deliver-square";
import { deliverTwoFormatVertical } from "../deliver-joint-vertical";
import { finalizeJointFailure } from "../finalize-joint-failure";
import { resumeJointOperation } from "../resume-joint-operation";
import {
  CAMPAIGN_ID,
  OPERATION_ID,
  SQUARE_DELIVERY_ID,
  STORE_ID,
  createJointOfflineWorld,
  createJointWorldDeps,
  jointBaseInput,
  jointOpenInput,
  jointSquareInput,
  jointVerticalInput,
} from "./support/joint-offline-world";

function creditStatus(
  world: ReturnType<typeof createJointOfflineWorld>,
  operationId: string,
) {
  return world.creditRowFor(operationId)?.status ?? null;
}

function campaign(world: ReturnType<typeof createJointOfflineWorld>) {
  return world.rows.find(
    (row) => row.__table === "campaigns" && row.id === CAMPAIGN_ID,
  ) as Record<string, unknown> | undefined;
}

function rpcCount(
  world: ReturnType<typeof createJointOfflineWorld>,
  name: string,
  suffix: string,
) {
  return world.rpcOrder.filter((entry) => entry === `${name}:${suffix}`).length;
}

function finalizeInput(stage: "base" | "expansion", outcomeKind: "definitive" | "unknown") {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    stage,
    outcomeKind,
  } as const;
}

function resumeInput() {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    authorization: { kind: "system" as const },
    acquisitionId: "33333333-3333-4333-8333-333333333333",
    attemptReference: "retry",
    deadlineAtMs: Date.now() + 60_000,
    allowNewPaidStep: true,
    attemptTarget: "initial" as const,
  };
}

async function openBaseSquare(
  options: Parameters<typeof createJointWorldDeps>[1] = {},
) {
  const world = createJointOfflineWorld();
  world.seedScenario();
  const deps = await createJointWorldDeps(world, options);
  const preflight = await preflightJointSelection(deps.joint.preflight);
  expect(preflight.ok).toBe(true);
  if (!preflight.ok) throw new Error("preflight_failed");
  const opened = await openJointOperation(
    jointOpenInput({ selection: preflight.selection }),
    {
      openJointDelivery: (input) => deps.joint.jointClient.openJointDelivery(input),
    },
  );
  expect(opened.kind).toBe("opened");
  const base = await runJointBase(jointBaseInput(), deps.baseDeps);
  expect(base).toEqual({ kind: "completed" });
  const square = await deliverJointSquare(jointSquareInput(), deps.squareDeps);
  expect(square.kind).toBe("delivered");
  return { world, deps };
}

async function fullSuccess() {
  const { world, deps } = await openBaseSquare();
  const vertical = await deliverTwoFormatVertical(
    jointVerticalInput(),
    deps.verticalDeps,
  );
  expect(vertical.kind).toBe("delivered");
  return { world, deps };
}

describe("F60.7-10 — jornadas conjuntas offline", () => {
  it("Teste 1: sucesso completo, uma base + uma expansão + uma copy", async () => {
    const { world, deps } = await fullSuccess();
    expect(creditStatus(world, OPERATION_ID)).toBe("delivered");
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
    expect(campaign(world)?.status).toBe("ready");
    expect(world.rpcCounts["product_two_format_open_delivery"]).toBe(1);
    expect(world.rpcCounts["product_two_format_deliver_format"]).toBe(2);
    expect(deps.counters.baseProviderCalls).toBe(1);
    expect(deps.counters.expansionProviderCalls).toBe(1);
    expect(deps.counters.copyCalls).toBe(1);
  });

  it("Teste 2: quadrado entregue antes da preparação/expansão", async () => {
    const { world, deps } = await fullSuccess();
    const squareIndex = world.rpcOrder.indexOf(
      "product_two_format_deliver_format:1:1",
    );
    const expansionIndex = world.rpcOrder.indexOf(
      "product_9_16_acquire_step:expansion",
    );
    expect(squareIndex).toBeGreaterThanOrEqual(0);
    expect(expansionIndex).toBeGreaterThan(squareIndex);
    expect(deps.counters.order.indexOf("baseProvider")).toBeLessThan(
      deps.counters.order.indexOf("expansionProvider"),
    );
  });

  it("Teste 3: vertical usa o confirmador dedicado e runners reais", async () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-two-format/orchestration/deliver-joint-vertical.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/deliverVertical\(/);
    expect(source).not.toMatch(/confirmOnVerticalDelivery\(/);
    const { world } = await fullSuccess();
    expect(world.rpcOrder).toContain("product_two_format_deliver_format:9:16");
  });

  it("Teste 4: falha definitiva da expansão estorna só o vertical", async () => {
    const { world, deps } = await openBaseSquare({ expansionMode: "definitive" });
    const expansion = await deliverTwoFormatVertical(
      jointVerticalInput(),
      deps.verticalDeps,
    );
    expect(expansion.kind).toBe("definitive");
    const outcome = await finalizeJointFailure(
      finalizeInput("expansion", "definitive"),
      deps.finalizeDeps,
    );
    expect(outcome.kind).toBe("refunded");
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
    expect(creditStatus(world, OPERATION_ID)).toBe("refunded");
    expect(rpcCount(world, "product_two_format_refund_format", "9:16")).toBe(1);
    expect(rpcCount(world, "product_two_format_refund_format", "1:1") ?? 0).toBe(0);
    expect(campaign(world)?.status).toBe("ready");
  });

  it("Teste 5: indeterminação não estorna nem repete provider", async () => {
    const { world, deps } = await openBaseSquare({ expansionMode: "unknown" });
    const expansion = await deliverTwoFormatVertical(
      jointVerticalInput(),
      deps.verticalDeps,
    );
    expect(expansion.kind).toBe("unknown");
    const beforeProviders =
      deps.counters.baseProviderCalls + deps.counters.expansionProviderCalls;
    const outcome = await finalizeJointFailure(
      finalizeInput("expansion", "unknown"),
      deps.finalizeDeps,
    );
    expect(outcome.kind).toBe("unknown");
    expect(rpcCount(world, "product_two_format_refund_format", "9:16") ?? 0).toBe(0);
    expect(rpcCount(world, "product_two_format_refund_format", "1:1") ?? 0).toBe(0);
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
    expect(
      deps.counters.baseProviderCalls + deps.counters.expansionProviderCalls,
    ).toBe(beforeProviders);
  });

  it("Teste 6: refund do quadrado exige handoff e replay não duplica", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "refunded",
      sharedOutcome: "failed",
    });
    const deps = await createJointWorldDeps(world);
    const outcome = await finalizeJointFailure(
      finalizeInput("base", "definitive"),
      deps.finalizeDeps,
    );
    expect(outcome.kind).toBe("refunded");
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("refunded");
    expect(rpcCount(world, "product_two_format_refund_format", "1:1")).toBe(1);
    expect(
      world.rows.some(
        (row) =>
          row.__table === "product_1_1_generation_outcomes" &&
          row.operation_id === SQUARE_DELIVERY_ID &&
          row.outcome === "failed",
      ),
    ).toBe(true);
    const outcomeIndex = world.rpcOrder.indexOf(
      "product_1_1_record_generation_outcome:",
    );
    const refundIndex = world.rpcOrder.indexOf(
      "product_two_format_refund_format:1:1",
    );
    expect(outcomeIndex).toBeGreaterThanOrEqual(0);
    expect(refundIndex).toBeGreaterThan(outcomeIndex);
    const replay = await finalizeJointFailure(
      finalizeInput("base", "definitive"),
      deps.finalizeDeps,
    );
    expect(replay.kind).toBe("refunded");
    expect(rpcCount(world, "product_two_format_refund_format", "1:1")).toBe(1);
  });

  it("Teste 7: base sem artefato estorna os dois formatos", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    world.seedJointState();
    const deps = await createJointWorldDeps(world);
    const outcome = await finalizeJointFailure(
      finalizeInput("base", "definitive"),
      deps.finalizeDeps,
    );
    expect(outcome.kind).toBe("refunded");
    expect(creditStatus(world, OPERATION_ID)).toBe("refunded");
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("refunded");
    expect(rpcCount(world, "product_two_format_refund_format", "9:16")).toBe(1);
    expect(rpcCount(world, "product_two_format_refund_format", "1:1")).toBe(1);
    expect(campaign(world)?.status).toBe("error");
  });

  it("Teste 8: replay/reparo projeta uma vez sem novo efeito financeiro", async () => {
    const { world, deps } = await fullSuccess();
    const beforeDeliver =
      world.rpcCounts["product_two_format_deliver_format"] ?? 0;
    const resumed = await resumeJointOperation(resumeInput(), deps.resumeDeps);
    expect(resumed.kind).toBe("executed");
    if (resumed.kind === "executed") {
      expect(resumed.action).toBe("repair_only");
    }
    expect(world.rpcCounts["product_two_format_project_campaign"]).toBe(1);
    expect(world.rpcCounts["product_two_format_deliver_format"] ?? 0).toBe(
      beforeDeliver,
    );
  });

  it("Teste 9: resposta tardia não regride etapa nem estorna", async () => {
    const { world, deps } = await fullSuccess();
    const beforeExpansion = deps.counters.expansionProviderCalls;
    const late = await deliverTwoFormatVertical(
      jointVerticalInput({ expansionStatus: "in_progress" }),
      deps.verticalDeps,
    );
    expect(late.kind).not.toBe("definitive");
    expect(creditStatus(world, OPERATION_ID)).toBe("delivered");
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
    expect(rpcCount(world, "product_two_format_refund_format", "9:16")).toBe(0);
    expect(deps.counters.expansionProviderCalls).toBe(beforeExpansion);
  });

  it("Teste 10: recuperação atua só no formato faltante", async () => {
    const { world, deps } = await openBaseSquare();
    const resumed = await resumeJointOperation(resumeInput(), deps.resumeDeps);
    expect(resumed.kind).toBe("executed");
    if (resumed.kind === "executed") {
      expect(resumed.action).toBe("run_vertical_only");
    }
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
    expect(creditStatus(world, OPERATION_ID)).toBe("delivered");
    expect(rpcCount(world, "product_two_format_deliver_format", "1:1")).toBe(1);
    expect(deps.counters.baseProviderCalls).toBe(1);
  });

  it("Teste 11: liquidação do quadrado sem novo provider de base", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    world.seedOperation({ contractVersion: 2 });
    world.seedJointState({ squareStatus: "reserved", verticalStatus: "reserved" });
    await world.seedJointArtifact({ role: "square_original", operationId: OPERATION_ID });
    const deps = await createJointWorldDeps(world);
    const resumed = await resumeJointOperation(resumeInput(), deps.resumeDeps);
    expect(resumed.kind).toBe("settle_square");
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
    expect(deps.counters.baseProviderCalls).toBe(0);
  });

  it("Teste 12: reparo de projeção perdida após entrega", async () => {
    const { world, deps } = await fullSuccess();
    const row = campaign(world);
    if (row) {
      row.storage_path = null;
      row.status = "generating";
    }
    const repaired = await deps.resumeDeps.repairProjection({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(repaired.kind).toBe("repaired");
    expect(world.rpcCounts["product_two_format_project_campaign"]).toBe(1);
    expect(campaign(world)?.status).toBe("ready");
    const callsAfterFirst = deps.thumbnailCalls();
    expect(callsAfterFirst).toBeGreaterThan(0);
    // As duas miniaturas já vieram da entrega normal: o reparo não cria outra.
    expect(deps.thumbnailStatuses().every((status) => status === "already_exists")).toBe(
      true,
    );
    expect(
      world.base.handles.uploads.some(
        (upload) => upload.bucket === "campaign-images",
      ),
    ).toBe(true);
    const second = await deps.resumeDeps.repairProjection({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(second.kind).toBe("repaired");
    expect(deps.thumbnailCalls()).toBe(callsAfterFirst);
  });

  it("Teste 13b: jornada normal entrega o vertical E gera as duas miniaturas, sem reparo posterior", async () => {
    const { world } = await fullSuccess();
    const thumbnailUploads = world.base.handles.uploads.filter(
      (upload) =>
        upload.bucket === "campaign-images" &&
        upload.path.endsWith(".thumb-v1.webp"),
    );
    const paths = thumbnailUploads.map((upload) => upload.path);
    expect(paths.some((path) => path.endsWith("/square_original.thumb-v1.webp"))).toBe(
      true,
    );
    expect(paths.some((path) => path.endsWith("/vertical.thumb-v1.webp"))).toBe(
      true,
    );
    // A miniatura veio da entrega normal: nenhuma projeção/reparo foi acionado.
    expect(world.rpcCounts["product_two_format_project_campaign"] ?? 0).toBe(0);
  });

  it("Teste 13: leitura parcial bloqueia e não estorna", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    world.seedJointState({ squareStatus: "delivered", verticalStatus: "reserved" });
    await world.seedJointArtifact({ role: "square_original", operationId: OPERATION_ID });
    for (let index = world.rows.length - 1; index >= 0; index -= 1) {
      const row = world.rows[index];
      if (
        row.__table === "product_two_format_deliveries" &&
        row.format === "9:16"
      ) {
        world.rows.splice(index, 1);
      }
      if (
        row.__table === "product_1_1_campaign_credit_operations" &&
        row.operation_id === OPERATION_ID
      ) {
        world.rows.splice(index, 1);
      }
    }
    const deps = await createJointWorldDeps(world);
    const resumed = await resumeJointOperation(resumeInput(), deps.resumeDeps);
    expect(resumed.kind).toBe("blocked");
    if (resumed.kind === "blocked") {
      expect(resumed.reason).toBe("partial_read");
    }
    expect(rpcCount(world, "product_two_format_refund_format", "1:1") ?? 0).toBe(0);
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
  });

  it("Teste 14: interleaving controlado não duplica entrega", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    world.seedJointState();
    await world.seedJointArtifact({ role: "square_original", operationId: OPERATION_ID });
    const deps = await createJointWorldDeps(world);
    world.interleaveBeginPublication();
    const [first, second] = await Promise.all([
      deliverJointSquare(jointSquareInput(), deps.squareDeps),
      deliverJointSquare(jointSquareInput(), deps.squareDeps),
    ]);
    expect([first.kind, second.kind].sort()).toEqual([
      "delivered",
      "publication_pending",
    ]);
    expect(rpcCount(world, "product_two_format_deliver_format", "1:1")).toBe(1);
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
  });

  it("Teste 15: falha entre outcome e refund é retomável sem repetir efeito", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    world.seedJointState();
    const deps = await createJointWorldDeps(world);
    world.failNextRefund("9:16", "throw");
    const failed = await finalizeJointFailure(
      finalizeInput("base", "definitive"),
      deps.finalizeDeps,
    );
    expect(failed.kind).toBe("blocked");
    if (failed.kind === "blocked") {
      expect(failed.outcomeRecorded).toBe(true);
    }
    expect(creditStatus(world, OPERATION_ID)).toBe("reserved");
    const retry = await finalizeJointFailure(
      finalizeInput("base", "definitive"),
      deps.finalizeDeps,
    );
    expect(retry.kind).toBe("refunded");
    expect(creditStatus(world, OPERATION_ID)).toBe("refunded");
  });

  it("Teste 16: falha entre os dois estornos preserva progresso parcial", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    world.seedJointState();
    const deps = await createJointWorldDeps(world);
    world.failNextRefund("1:1", "throw");
    const partial = await finalizeJointFailure(
      finalizeInput("base", "definitive"),
      deps.finalizeDeps,
    );
    expect(partial.kind).toBe("partial");
    if (partial.kind === "partial") {
      expect(partial.refunded).toEqual(["9:16"]);
      expect(partial.pending).toEqual(["1:1"]);
    }
    expect(creditStatus(world, OPERATION_ID)).toBe("refunded");
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("reserved");
    const retry = await finalizeJointFailure(
      finalizeInput("base", "definitive"),
      deps.finalizeDeps,
    );
    expect(retry.kind).toBe("refunded");
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("refunded");
  });

  it("Teste 17: corrida de entrega do quadrado prevalece sobre refund", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "reserved",
      sharedOutcome: "failed",
    });
    const deps = await createJointWorldDeps(world);
    world.failNextRefund("1:1", "deliver");
    const outcome = await finalizeJointFailure(
      finalizeInput("base", "definitive"),
      deps.finalizeDeps,
    );
    expect(outcome.kind).toBe("blocked");
    if (outcome.kind === "blocked") {
      expect(outcome.code).toBe("delivered_not_refundable");
    }
    expect(creditStatus(world, SQUARE_DELIVERY_ID)).toBe("delivered");
    expect(rpcCount(world, "product_two_format_refund_format", "1:1")).toBe(1);
  });

  it("Teste 18: falha de configuração no preflight não abre, reserva nem chama provider", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    for (let index = world.rows.length - 1; index >= 0; index -= 1) {
      if (world.rows[index].__table === "nine_sixteen_expansion_model_config") {
        world.rows.splice(index, 1);
      }
    }
    const deps = await createJointWorldDeps(world);
    const preflight = await preflightJointSelection(deps.joint.preflight);
    expect(preflight.ok).toBe(false);
    expect(world.rpcCounts["product_two_format_open_delivery"] ?? 0).toBe(0);
    expect(world.creditRowFor(OPERATION_ID)).toBeNull();
    expect(deps.counters.baseProviderCalls).toBe(0);
    expect(deps.counters.expansionProviderCalls).toBe(0);
  });
});
