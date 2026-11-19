import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { createTwoFormatRunDeps } from "../run-two-format-deps";
import {
  CAMPAIGN_ID,
  OPERATION_ID,
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

describe("F60.7 C1 — status conjunto derivado dos dois formatos", () => {
  it("ambos estornados tornam a operação terminal e sem continuação", async () => {
    world.seedJointState({
      squareStatus: "refunded",
      verticalStatus: "refunded",
    });
    const deps = createTwoFormatRunDeps({ client: world.client, clock: world.clock });
    const status = await deps.readStatus({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      allowNewPaidStep: true,
    });
    expect(status.formats["1:1"].state).toBe("absent");
    expect(status.formats["9:16"].state).toBe("absent");
    expect(status.operationTerminal).toBe(true);
    expect(status.canContinue).toBe(false);
  });

  it("etapa gratuita pendente continua permitida com a flag OFF", async () => {
    const base = step("base");
    const expansion = step("expansion");
    if (!base || !expansion) throw new Error("missing steps");
    base.status = "done";
    expansion.status = "done";
    world.seedJointState({
      squareStatus: "reserved",
      verticalStatus: "reserved",
    });

    const deps = createTwoFormatRunDeps({ client: world.client, clock: world.clock });
    const status = await deps.readStatus({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      allowNewPaidStep: false,
    });
    expect(status.nextStep).toBe("delivery");
    expect(status.operationTerminal).toBe(false);
    expect(status.canContinue).toBe(true);
  });

  it("etapa paga pendente é bloqueada com a flag OFF", async () => {
    const deps = createTwoFormatRunDeps({ client: world.client, clock: world.clock });
    const status = await deps.readStatus({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      allowNewPaidStep: false,
    });
    expect(status.nextStep).toBe("base");
    expect(status.canContinue).toBe(false);
    expect(status.operationTerminal).toBe(false);
  });
});
