import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { createTwoFormatRunDeps } from "../run-two-format-deps";
import { runTwoFormatGeneration } from "../run-two-format";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import {
  CAMPAIGN_ID,
  OPERATION_ID,
  SQUARE_DELIVERY_ID,
  STORE_ID,
  createJointOfflineWorld,
} from "./support/joint-offline-world";

let world: ReturnType<typeof createJointOfflineWorld>;

beforeEach(() => {
  world = createJointOfflineWorld();
  world.seedScenario();
  world.seedOperation({
    contractVersion: 2,
    selection: {
      expansion_model: "gpt-image-2.5-sunburst",
      expansion_quality: "low",
      expansion_config_version_id: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
      expansion_selection_origin: "configured",
    },
  });
});

function step(stage: "base" | "expansion") {
  return world.rows.find(
    (row) =>
      row.__table === "product_9_16_two_stage_steps" &&
      row.stage === stage,
  );
}

function status(allowNewPaidStep: boolean) {
  const deps = createTwoFormatRunDeps({ client: world.client, clock: world.clock });
  return deps.readStatus({
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    allowNewPaidStep,
  });
}

describe("F60.7 C1 — status conjunto derivado do planejamento conjunto", () => {
  it("base concluída + quadrado reservado anuncia a entrega gratuita com flag OFF", async () => {
    const base = step("base");
    if (!base) throw new Error("missing base step");
    base.status = "done";
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "reserved",
    });

    const result = await status(false);
    expect(result.nextStep).toBe("square_delivery");
    expect(result.canContinue).toBe(true);
    expect(result.operationTerminal).toBe(false);
  });

  it("vertical entregue + quadrado reservado anuncia a liquidação do quadrado", async () => {
    const base = step("base");
    if (!base) throw new Error("missing base step");
    base.status = "done";
    // Linha de artefato suficiente para o read model (role/formato/dimensões/
    // MIME). O status não precisa de evidência/objeto para classificar.
    world.base.seedArtifactRow({
      id: "7b8c9d0e-7b8c-4d0e-9f1a-7b8c9d0e1f2a",
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      role: "vertical",
      format: "9:16",
      origin: "ai_expansion",
      derived_from_artifact_id: null,
      source_campaign_id: null,
      storage_bucket: "campaign-composition-artifacts",
      storage_path: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.jpg`,
      width: 1080,
      height: 1920,
      mime_type: "image/jpeg",
      byte_size: 1,
      checksum_sha256: "fixture",
      provenance: {},
      created_at: "2026-11-18T00:00:00.000Z",
    });
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "delivered",
    });

    const result = await status(false);
    expect(result.formats["9:16"].state).toBe("delivered");
    expect(result.formats["1:1"].state).toBe("processing");
    expect(result.nextStep).toBe("square_delivery");
    expect(result.canContinue).toBe(true);
    expect(result.operationTerminal).toBe(false);
  });

  it("vertical estornado + quadrado reservado anuncia finalização recuperável", async () => {
    const base = step("base");
    if (!base) throw new Error("missing base step");
    base.status = "done";
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "refunded",
    });

    const result = await status(false);
    expect(result.formats["9:16"].state).toBe("absent");
    expect(result.nextStep).toBe("delivery");
    expect(result.canContinue).toBe(true);
    expect(result.operationTerminal).toBe(false);
  });

  it("base pendente continua paga: flag OFF bloqueia e flag ON libera", async () => {
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "reserved",
    });

    const off = await status(false);
    expect(off.nextStep).toBe("base");
    expect(off.canContinue).toBe(false);

    const on = await status(true);
    expect(on.nextStep).toBe("base");
    expect(on.canContinue).toBe(true);
  });

  it("quadrado entregue + vertical reservado continua paga (expansão)", async () => {
    const base = step("base");
    if (!base) throw new Error("missing base step");
    base.status = "done";
    await world.seedJointArtifact({
      role: "square_original",
      operationId: OPERATION_ID,
    });
    world.seedJointState({
      squareStatus: "delivered",
      verticalStatus: "reserved",
    });

    const off = await status(false);
    expect(off.formats["1:1"].state).toBe("delivered");
    expect(off.nextStep).toBe("expansion");
    expect(off.canContinue).toBe(false);

    const on = await status(true);
    expect(on.nextStep).toBe("expansion");
    expect(on.canContinue).toBe(true);
  });

  it("expansão concluída + vertical reservado anuncia entrega gratuita", async () => {
    const base = step("base");
    const expansion = step("expansion");
    if (!base || !expansion) throw new Error("missing steps");
    base.status = "done";
    expansion.status = "done";
    await world.seedJointArtifact({
      role: "square_original",
      operationId: OPERATION_ID,
    });
    world.seedJointState({
      squareStatus: "delivered",
      verticalStatus: "reserved",
    });

    const off = await status(false);
    expect(off.nextStep).toBe("delivery");
    expect(off.canContinue).toBe(true);
    expect(off.operationTerminal).toBe(false);

    const on = await status(true);
    expect(on.nextStep).toBe("delivery");
    expect(on.canContinue).toBe(true);
  });

  it("expansão pendente continua paga e bloqueada com flag OFF", async () => {
    const base = step("base");
    if (!base) throw new Error("missing base step");
    base.status = "done";
    await world.seedJointArtifact({
      role: "square_original",
      operationId: OPERATION_ID,
    });
    world.seedJointState({
      squareStatus: "delivered",
      verticalStatus: "reserved",
    });

    const off = await status(false);
    expect(off.nextStep).toBe("expansion");
    expect(off.canContinue).toBe(false);

    const on = await status(true);
    expect(on.nextStep).toBe("expansion");
    expect(on.canContinue).toBe(true);
  });

  it("continuação com expansão concluída entrega sem provider nem nova reserva", async () => {
    const base = step("base");
    const expansion = step("expansion");
    if (!base || !expansion) throw new Error("missing steps");
    base.status = "done";
    expansion.status = "done";

    const squarePath = `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_original.jpg`;
    const verticalPath = `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.jpg`;
    world.base.putObject(squarePath, Buffer.from("square-artifact"));
    world.base.putObject(verticalPath, Buffer.from("vertical-artifact"));
    world.base.seedArtifactRow({
      id: "6a7b8c9d-6a7b-4c8d-9e0f-6a7b8c9d0e1f",
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      role: "square_original",
      format: "1:1",
      origin: "provider_generation",
      derived_from_artifact_id: null,
      source_campaign_id: null,
      storage_bucket: "campaign-composition-artifacts",
      storage_path: squarePath,
      width: 1024,
      height: 1024,
      mime_type: "image/jpeg",
      byte_size: 1,
      checksum_sha256: "fixture",
      provenance: {},
      created_at: "2026-11-18T00:00:00.000Z",
    });
    world.base.seedArtifactRow({
      id: "7b8c9d0e-7b8c-4d0e-9f1a-7b8c9d0e1f2a",
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      role: "vertical",
      format: "9:16",
      origin: "ai_expansion",
      derived_from_artifact_id: null,
      source_campaign_id: null,
      storage_bucket: "campaign-composition-artifacts",
      storage_path: verticalPath,
      width: 1080,
      height: 1920,
      mime_type: "image/jpeg",
      byte_size: 1,
      checksum_sha256: "fixture",
      provenance: {},
      created_at: "2026-11-18T00:00:00.000Z",
    });
    world.seedJointState({
      squareStatus: "delivered",
      verticalStatus: "reserved",
    });

    const beforeCredits = world.rows.filter(
      (row) => row.__table === "product_1_1_campaign_credit_operations",
    );
    const deps = createTwoFormatRunDeps({
      client: world.client,
      clock: world.clock,
      probeVertical: async () => ({
        kind: "integral",
        format: "9:16",
        width: 1080,
        height: 1920,
        mimeType: "image/jpeg",
        storagePath: verticalPath,
        evidenceRef: "7b8c9d0e-7b8c-4d0e-9f1a-7b8c9d0e1f2a",
      }),
    });

    const response = await runTwoFormatGeneration(
      {
        mode: "continue",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        authorization: { kind: "system" },
        allowNewPaidStep: false,
        requestStartedAtMs: world.clock(),
        deadlineAtMs: world.clock() + 120_000,
        inputSnapshot: {},
        squareDeliveryId: SQUARE_DELIVERY_ID,
        requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      deps,
    );
    const events = (await response.text())
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events.at(-1)).toMatchObject({
      type: "result",
      operationTerminal: true,
      formats: {
        "1:1": { state: "delivered" },
        "9:16": { state: "delivered" },
      },
    });
    expect(world.creditRowFor(OPERATION_ID)?.status).toBe("delivered");
    expect(world.creditRowFor(SQUARE_DELIVERY_ID)?.status).toBe("delivered");
    expect(
      world.rows.filter(
        (row) => row.__table === "product_1_1_campaign_credit_operations",
      ),
    ).toHaveLength(beforeCredits.length);
    expect(world.rpcOrder).toContain("product_two_format_deliver_format:9:16");
    expect(world.rpcOrder).not.toContain("product_9_16_acquire_step:expansion");
  });

  it("ambos estornados tornam a operação terminal e sem continuação", async () => {
    world.seedJointState({
      squareStatus: "refunded",
      verticalStatus: "refunded",
    });
    const result = await status(true);
    expect(result.formats["1:1"].state).toBe("absent");
    expect(result.formats["9:16"].state).toBe("absent");
    expect(result.operationTerminal).toBe(true);
    expect(result.nextStep).toBeNull();
    expect(result.canContinue).toBe(false);
  });

  it("outcome durável unknown não regride para processing no replay/status", async () => {
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "reserved",
      sharedOutcome: "unknown",
    });

    const first = await status(true);
    expect(first.formats["1:1"].state).toBe("unknown");
    expect(first.formats["9:16"].state).toBe("unknown");
    expect(first.nextStep).toBeNull();
    expect(first.canContinue).toBe(false);
    expect(first.operationTerminal).toBe(false);

    // Releitura (POST repetido/status) preserva a indeterminação durável.
    const replay = await status(false);
    expect(replay.formats["1:1"].state).toBe("unknown");
    expect(replay.formats["9:16"].state).toBe("unknown");
    expect(replay.nextStep).toBeNull();
    expect(replay.canContinue).toBe(false);
    expect(replay.operationTerminal).toBe(false);
  });

  it("vertical entregue + unknown histórico do controle: quadrado pendente NÃO é bloqueado", async () => {
    const base = step("base");
    if (!base) throw new Error("missing base step");
    base.status = "done";
    world.base.seedArtifactRow({
      id: "7b8c9d0e-7b8c-4d0e-9f1a-7b8c9d0e1f2b",
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      role: "vertical",
      format: "9:16",
      origin: "ai_expansion",
      derived_from_artifact_id: null,
      source_campaign_id: null,
      storage_bucket: "campaign-composition-artifacts",
      storage_path: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.jpg`,
      width: 1080,
      height: 1920,
      mime_type: "image/jpeg",
      byte_size: 1,
      checksum_sha256: "fixture",
      provenance: {},
      created_at: "2026-11-18T00:00:00.000Z",
    });
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "delivered",
      sharedOutcome: "unknown",
    });

    const result = await status(false);
    expect(result.formats["9:16"].state).toBe("delivered");
    expect(result.formats["1:1"].state).toBe("processing");
    expect(result.nextStep).toBe("square_delivery");
    expect(result.canContinue).toBe(true);
    expect(result.operationTerminal).toBe(false);
  });

  it("vertical estornado + unknown histórico do controle: finalização continua recuperável", async () => {
    const base = step("base");
    if (!base) throw new Error("missing base step");
    base.status = "done";
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "refunded",
      sharedOutcome: "unknown",
    });

    const result = await status(false);
    expect(result.formats["9:16"].state).toBe("absent");
    expect(result.formats["1:1"].state).toBe("processing");
    expect(result.nextStep).toBe("delivery");
    expect(result.canContinue).toBe(true);
    expect(result.operationTerminal).toBe(false);
  });

  it("unknown PRÓPRIO do quadrado continua bloqueando mesmo com controle entregue", async () => {
    const base = step("base");
    if (!base) throw new Error("missing base step");
    base.status = "done";
    world.base.seedArtifactRow({
      id: "7b8c9d0e-7b8c-4d0e-9f1a-7b8c9d0e1f2c",
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      role: "vertical",
      format: "9:16",
      origin: "ai_expansion",
      derived_from_artifact_id: null,
      source_campaign_id: null,
      storage_bucket: "campaign-composition-artifacts",
      storage_path: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.jpg`,
      width: 1080,
      height: 1920,
      mime_type: "image/jpeg",
      byte_size: 1,
      checksum_sha256: "fixture",
      provenance: {},
      created_at: "2026-11-18T00:00:00.000Z",
    });
    world.seedJointState({
      squareStatus: "reserved",
      squareOutcome: "unknown",
      verticalStatus: "delivered",
      sharedOutcome: "unknown",
    });

    const result = await status(false);
    expect(result.formats["9:16"].state).toBe("delivered");
    expect(result.formats["1:1"].state).toBe("unknown");
    expect(result.nextStep).toBeNull();
    expect(result.canContinue).toBe(false);
  });

  it("requestId da tentativa anterior é query_only; nova tentativa exige novo ID", async () => {
    const base = step("base");
    const expansion = step("expansion");
    if (!base || !expansion) throw new Error("missing steps");
    base.status = "done";
    expansion.status = "failed";
    expansion.failure_class = "transient";
    expansion.attempts_used = 1;
    world.rows.push({
      __table: "product_9_16_two_stage_attempt_claims",
      id: "claim-old",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      stage: "expansion",
      attempt_number: 1,
      target: "initial",
      request_id: "11111111-1111-4111-8111-111111111111",
      status: "failed",
      failure_class: "transient",
      attempt_token: "old-token",
    });

    const control = new ProductTwoStageOperationClient(world.client);
    const reused = await control.acquire({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      stage: "expansion",
      requestId: "11111111-1111-4111-8111-111111111111",
      target: "retry",
    });
    expect(reused).toMatchObject({
      acquired: false,
      authorization: "query_only",
    });

    const fresh = await control.acquire({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      stage: "expansion",
      requestId: "22222222-2222-4222-8222-222222222222",
      target: "retry",
    });
    expect(fresh).toMatchObject({
      acquired: true,
      authorization: "execute",
    });
  });
});
