// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { decideJointResolution } from "../pending-guards";
import { listJointPendingOperations } from "../pending-recognition";
import { resolveJointPending } from "../resolve-joint-pending";
import {
  CAMPAIGN_ID,
  OPERATION_ID,
  SQUARE_DELIVERY_ID,
  STORE_ID,
  createJointOfflineWorld,
  createJointWorldDeps,
} from "./support/joint-offline-world";

function request(overrides: {
  format?: "1:1" | "9:16";
  action?: "deliver" | "refund";
} = {}) {
  return {
    actorId: "admin-1",
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    format: overrides.format ?? "1:1",
    action: overrides.action ?? "deliver",
    reason: "motivo",
  } as const;
}

function rpcCount(
  world: ReturnType<typeof createJointOfflineWorld>,
  name: string,
  suffix: string,
) {
  return world.rpcOrder.filter((entry) => entry === `${name}:${suffix}`).length;
}

async function setup(input: {
  state?: Parameters<ReturnType<typeof createJointOfflineWorld>["seedJointState"]>[0];
  squareArtifact?: boolean;
} = {}) {
  const world = createJointOfflineWorld();
  world.seedScenario();
  world.seedJointState(input.state);
  if (input.squareArtifact !== false) {
    await world.seedJointArtifact({
      role: "square_original",
      operationId: OPERATION_ID,
    });
  }
  const deps = await createJointWorldDeps(world);
  return { world, deps };
}

describe("F60.7-10 — proteção administrativa integrada", () => {
  it("Teste 1: pendência quadrada usa a sonda de composição", async () => {
    const { world, deps } = await setup();
    const pending = await listJointPendingOperations({
      client: world.client,
      probeSquare: deps.joint.probeSquare,
      probeVertical: deps.joint.probeVertical,
    });
    expect(pending.kind).toBe("ok");
    if (pending.kind !== "ok") return;
    const square = pending.items.find((item) => item.format === "1:1");
    expect(square?.artifactKind).toBe("integral");
    expect(square?.activeClaim).toBe(false);
  });

  it("Teste 2: pendência vertical é reconhecida pelo formato 9:16", async () => {
    const { world, deps } = await setup();
    const pending = await listJointPendingOperations({
      client: world.client,
      probeSquare: deps.joint.probeSquare,
      probeVertical: deps.joint.probeVertical,
    });
    expect(pending.kind).toBe("ok");
    if (pending.kind !== "ok") return;
    const vertical = pending.items.find((item) => item.format === "9:16");
    expect(vertical).toBeDefined();
    expect(vertical?.artifactKind).toBe("absent");
  });

  it("Teste 3: entrega permitida audita uma vez e não projeta", async () => {
    const { world, deps } = await setup();
    const decision = decideJointResolution({
      action: "deliver",
      creditStatus: "reserved",
      outcomeKind: "none",
      sharedOutcomeKind: "none",
      sharedCreditStatus: "reserved",
      artifactKind: "integral",
      activeClaim: false,
      linkComplete: true,
    });
    expect(decision).toEqual({ allowed: true, action: "deliver" });

    const outcome = await resolveJointPending(request(), deps.adminDeps);
    expect(outcome).toEqual({
      kind: "resolved",
      action: "deliver",
      format: "1:1",
      idempotent: false,
      auditRecorded: true,
    });
    expect(world.rows.filter((row) => row.__table === "admin_audit_log")).toHaveLength(1);
    expect(rpcCount(world, "product_two_format_deliver_format", "1:1")).toBe(1);
    expect(world.rpcCounts["product_two_format_project_campaign"] ?? 0).toBe(0);
  });

  it("Teste 4: estorno permitido do vertical audita uma vez", async () => {
    const { world, deps } = await setup({
      state: { sharedOutcome: "failed" },
      squareArtifact: false,
    });
    const outcome = await resolveJointPending(
      request({ format: "9:16", action: "refund" }),
      deps.adminDeps,
    );
    expect(outcome.kind).toBe("resolved");
    expect(world.creditRowFor(OPERATION_ID)?.status).toBe("refunded");
    expect(rpcCount(world, "product_two_format_refund_format", "9:16")).toBe(1);
    expect(world.rows.filter((row) => row.__table === "admin_audit_log")).toHaveLength(1);
  });

  it("Teste 5: bloqueios não produzem efeito nem auditoria", async () => {
    const active = await setup({ state: { activeClaim: true } });
    expect(
      await resolveJointPending(request(), active.deps.adminDeps),
    ).toEqual({
      kind: "blocked",
      block: "operation_in_progress",
      outcomeRecorded: false,
    });
    expect(active.world.rows.some((row) => row.__table === "admin_audit_log")).toBe(false);

    const delivered = await setup({ state: { squareStatus: "delivered" } });
    expect(
      await resolveJointPending(
        request({ format: "1:1", action: "refund" }),
        delivered.deps.adminDeps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "delivered_not_refundable",
      outcomeRecorded: false,
    });
    expect(delivered.world.rows.some((row) => row.__table === "admin_audit_log")).toBe(false);

    const artifact = await setup({
      state: { squareOutcome: "failed", sharedOutcome: "failed" },
    });
    expect(
      await resolveJointPending(
        request({ format: "1:1", action: "refund" }),
        artifact.deps.adminDeps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "artifact_present",
      outcomeRecorded: false,
    });
    expect(rpcCount(artifact.world, "product_two_format_refund_format", "1:1")).toBe(0);

    const invalid = await setup({
      state: { squareOutcome: "failed", sharedOutcome: "failed" },
    });
    invalid.world.base.replaceObjectBytes(
      `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_original.jpg`,
      Buffer.from("not-an-image"),
    );
    expect(
      await resolveJointPending(
        request({ format: "1:1", action: "refund" }),
        invalid.deps.adminDeps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "invalid_evidence",
      outcomeRecorded: false,
    });

    const indeterminate = await setup({
      state: { squareOutcome: "failed", sharedOutcome: "failed" },
    });
    indeterminate.world.base.setInfoError({ statusCode: "503" });
    expect(
      await resolveJointPending(
        request({ format: "1:1", action: "refund" }),
        indeterminate.deps.adminDeps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "insufficient_evidence",
      outcomeRecorded: false,
    });
  });

  it("Teste 6: leitura parcial não autoriza estorno", async () => {
    const { world, deps } = await setup({
      state: { squareStatus: "delivered", verticalStatus: "reserved" },
    });
    for (let index = world.rows.length - 1; index >= 0; index -= 1) {
      const row = world.rows[index];
      if (
        row.__table === "product_two_format_deliveries" &&
        row.format === "9:16"
      ) {
        world.rows.splice(index, 1);
      }
    }
    const outcome = await resolveJointPending(
      request({ format: "1:1", action: "deliver" }),
      deps.adminDeps,
    );
    expect(outcome.kind).toBe("blocked");
    if (outcome.kind === "blocked") {
      expect(outcome.block).toBe("delivery_link_incomplete");
    }
    expect(rpcCount(world, "product_two_format_deliver_format", "1:1")).toBe(0);
    expect(world.rows.some((row) => row.__table === "admin_audit_log")).toBe(false);
  });

  it("Teste 7: segunda resolução idêntica não duplica efeito nem auditoria", async () => {
    const { world, deps } = await setup();
    const first = await resolveJointPending(request(), deps.adminDeps);
    const second = await resolveJointPending(request(), deps.adminDeps);
    expect(first.kind).toBe("resolved");
    expect(second).toEqual({
      kind: "resolved",
      action: "deliver",
      format: "1:1",
      idempotent: true,
      auditRecorded: true,
      alreadyAudited: true,
    });
    expect(rpcCount(world, "product_two_format_deliver_format", "1:1")).toBe(1);
    expect(world.rows.filter((row) => row.__table === "admin_audit_log")).toHaveLength(1);
  });

  it("Teste 8: falha de auditoria é reparada sem novo efeito financeiro", async () => {
    const { world, deps } = await setup();
    const realWrite = deps.adminDeps.writeAudit;
    let fail = true;
    deps.adminDeps.writeAudit = async (entry) => {
      if (fail) {
        fail = false;
        throw new Error("insert_failed");
      }
      await realWrite(entry);
    };
    const first = await resolveJointPending(request(), deps.adminDeps);
    expect(first).toEqual({
      kind: "audit_pending",
      code: "audit_write_failed",
    });
    const deliverBefore = rpcCount(world, "product_two_format_deliver_format", "1:1");
    const second = await resolveJointPending(request(), deps.adminDeps);
    expect(second.kind).toBe("reconciled");
    expect(rpcCount(world, "product_two_format_deliver_format", "1:1")).toBe(
      deliverBefore,
    );
    expect(world.rpcCounts["product_two_format_project_campaign"] ?? 0).toBe(0);
    expect(world.rows.filter((row) => row.__table === "admin_audit_log")).toHaveLength(1);
  });

  it("Teste 9: refund do quadrado usa handoff; unknown bloqueia; sem outcome a RPC recusa", async () => {
    const { world, deps } = await setup({
      state: {
        squareStatus: "reserved",
        verticalStatus: "refunded",
        sharedOutcome: "failed",
      },
      squareArtifact: false,
    });
    const refunded = await resolveJointPending(
      request({ format: "1:1", action: "refund" }),
      deps.adminDeps,
    );
    expect(refunded.kind).toBe("resolved");
    expect(world.creditRowFor(SQUARE_DELIVERY_ID)?.status).toBe("refunded");
    expect(rpcCount(world, "product_two_format_refund_format", "1:1")).toBe(1);
    expect(world.rows.filter((row) => row.__table === "admin_audit_log")).toHaveLength(1);
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

    const unknown = await setup({
      state: {
        squareStatus: "reserved",
        verticalStatus: "refunded",
        squareOutcome: "unknown",
        sharedOutcome: "failed",
      },
      squareArtifact: false,
    });
    expect(
      await resolveJointPending(
        request({ format: "1:1", action: "refund" }),
        unknown.deps.adminDeps,
      ),
    ).toEqual({
      kind: "blocked",
      block: "unknown_outcome",
      outcomeRecorded: false,
    });
    expect(rpcCount(unknown.world, "product_two_format_refund_format", "1:1")).toBe(0);

    const withoutOutcome = await setup({
      state: {
        squareStatus: "reserved",
        verticalStatus: "refunded",
        sharedOutcome: "failed",
      },
      squareArtifact: false,
    });
    const rpc = await withoutOutcome.world.client.rpc(
      "product_two_format_refund_format",
      {
        p_store_id: STORE_ID,
        p_campaign_id: CAMPAIGN_ID,
        p_operation_id: OPERATION_ID,
        p_format: "1:1",
        p_art_kind: "absent",
        p_observed_epoch: 0,
        p_reason: "motivo",
      },
    );
    expect(rpc.error?.message).toBe("finality_not_recorded");
  });

  it("Teste 10: simulador recusa finalidade, arte, publicação, replay divergente e par incoerente", async () => {
    const noFinality = await setup({ state: {}, squareArtifact: false });
    const missing = await noFinality.world.client.rpc(
      "product_two_format_refund_format",
      {
        p_store_id: STORE_ID,
        p_campaign_id: CAMPAIGN_ID,
        p_operation_id: OPERATION_ID,
        p_format: "1:1",
        p_art_kind: "absent",
        p_observed_epoch: 0,
        p_reason: "motivo",
      },
    );
    expect(missing.error?.message).toBe("shared_operation_not_final");
    expect(noFinality.world.creditRowFor(SQUARE_DELIVERY_ID)?.status).toBe("reserved");

    const present = await setup({
      state: { sharedOutcome: "failed" },
      squareArtifact: true,
    });
    const artifactPresent = await present.world.client.rpc(
      "product_two_format_refund_format",
      {
        p_store_id: STORE_ID,
        p_campaign_id: CAMPAIGN_ID,
        p_operation_id: OPERATION_ID,
        p_format: "1:1",
        p_art_kind: "absent",
        p_observed_epoch: 0,
        p_reason: "motivo",
      },
    );
    expect(artifactPresent.data).toMatchObject({
      success: false,
      reason: "artifact_present",
    });
    expect(present.world.creditRowFor(SQUARE_DELIVERY_ID)?.status).toBe("reserved");

    const publishing = await setup({
      state: { sharedOutcome: "failed" },
      squareArtifact: false,
    });
    const squareCredit = publishing.world.creditRowFor(SQUARE_DELIVERY_ID);
    if (squareCredit) squareCredit.publication_state = "in_flight";
    const publication = await publishing.world.client.rpc(
      "product_two_format_refund_format",
      {
        p_store_id: STORE_ID,
        p_campaign_id: CAMPAIGN_ID,
        p_operation_id: OPERATION_ID,
        p_format: "1:1",
        p_art_kind: "absent",
        p_observed_epoch: 0,
        p_reason: "motivo",
      },
    );
    expect(publication.error?.message).toBe("publication_in_progress");
    expect(publishing.world.creditRowFor(SQUARE_DELIVERY_ID)?.status).toBe("reserved");

    const replay = createJointOfflineWorld();
    replay.seedScenario();
    const openParams = {
      p_store_id: STORE_ID,
      p_campaign_id: CAMPAIGN_ID,
      p_operation_id: OPERATION_ID,
      p_square_delivery_id: SQUARE_DELIVERY_ID,
      p_expansion_model: "gpt-image-2.5-sunburst",
      p_expansion_quality: "low",
      p_expansion_config_version_id: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
    };
    await replay.client.rpc("product_two_format_open_delivery", openParams);
    const divergent = await replay.client.rpc(
      "product_two_format_open_delivery",
      { ...openParams, p_expansion_quality: "medium" },
    );
    expect(divergent.data).toMatchObject({
      success: false,
      reason: "operation_config_conflict",
    });

    const incoherent = createJointOfflineWorld();
    incoherent.seedScenario();
    incoherent.seedJointState();
    for (let index = incoherent.rows.length - 1; index >= 0; index -= 1) {
      const row = incoherent.rows[index];
      if (
        row.__table === "product_two_format_deliveries" &&
        row.format === "9:16"
      ) {
        incoherent.rows.splice(index, 1);
      }
    }
    const projection = await incoherent.client.rpc(
      "product_two_format_project_campaign",
      { p_campaign_id: CAMPAIGN_ID },
    );
    expect(projection.error?.message).toBe("delivery_links_inconsistent");
  });

  it("Teste 11: entrega valida arte canônica, par estrito e replay de refund antes de arte/publicação", async () => {
    const delivery = await setup();
    const publication = await delivery.deps.joint.credit.beginPublication(
      CAMPAIGN_ID,
      SQUARE_DELIVERY_ID,
    );
    expect(publication.acquired).toBe(true);
    delivery.world.base.removeObject(
      `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_original.jpg`,
    );
    const invalidArtifact = await delivery.world.client.rpc(
      "product_two_format_deliver_format",
      {
        p_store_id: STORE_ID,
        p_campaign_id: CAMPAIGN_ID,
        p_operation_id: OPERATION_ID,
        p_format: "1:1",
        p_publication_token: publication.token,
      },
    );
    expect(invalidArtifact.data).toMatchObject({
      success: false,
      reason: "artifact_incompatible",
    });
    expect(delivery.world.creditRowFor(SQUARE_DELIVERY_ID)?.status).toBe("reserved");

    const duplicate = createJointOfflineWorld();
    duplicate.seedScenario();
    duplicate.seedJointState();
    duplicate.rows.push({
      __table: "product_two_format_deliveries",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: STORE_ID,
      format: "1:1",
      delivery_operation_id: SQUARE_DELIVERY_ID,
      artifact_role: "square_original",
      created_at: "2026-11-19T00:00:00.000Z",
    });
    const duplicateCampaign = duplicate.rows.find(
      (row) => row.__table === "campaigns" && row.id === CAMPAIGN_ID,
    );
    const duplicateBefore = {
      status: duplicateCampaign?.status,
      storage_path: duplicateCampaign?.storage_path,
    };
    const duplicated = await duplicate.client.rpc(
      "product_two_format_project_campaign",
      { p_campaign_id: CAMPAIGN_ID },
    );
    expect(duplicated.error?.message).toBe("delivery_links_inconsistent");
    expect({
      status: duplicateCampaign?.status,
      storage_path: duplicateCampaign?.storage_path,
    }).toEqual(duplicateBefore);

    const mixed = createJointOfflineWorld();
    mixed.seedScenario();
    mixed.seedJointState();
    mixed.rows.push({
      __table: "product_two_format_deliveries",
      campaign_id: CAMPAIGN_ID,
      operation_id: "99999999-9999-4999-8999-999999999999",
      store_id: STORE_ID,
      format: "1:1",
      delivery_operation_id: SQUARE_DELIVERY_ID,
      artifact_role: "square_original",
      created_at: "2026-11-19T00:00:00.000Z",
    });
    const mixedResult = await mixed.client.rpc(
      "product_two_format_project_campaign",
      { p_campaign_id: CAMPAIGN_ID },
    );
    expect(mixedResult.error?.message).toBe("delivery_links_inconsistent");

    const replay = await setup({
      state: { sharedOutcome: "failed" },
      squareArtifact: true,
    });
    const credit = replay.world.creditRowFor(SQUARE_DELIVERY_ID);
    if (credit) {
      credit.status = "refunded";
      credit.publication_state = "published";
    }
    const replayed = await replay.world.client.rpc(
      "product_two_format_refund_format",
      {
        p_store_id: STORE_ID,
        p_campaign_id: CAMPAIGN_ID,
        p_operation_id: OPERATION_ID,
        p_format: "1:1",
        p_art_kind: "absent",
        p_observed_epoch: 0,
        p_reason: "motivo",
      },
    );
    expect(replayed.data).toMatchObject({ success: true, idempotent: true });
  });
});
