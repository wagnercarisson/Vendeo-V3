// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { deliverJointSquare } from "@/lib/product-two-format/orchestration/deliver-square";
import { deliverTwoFormatVertical } from "@/lib/product-two-format/orchestration/deliver-joint-vertical";
import { openJointOperation } from "@/lib/product-two-format/orchestration/joint-operation-service";
import { preflightJointSelection } from "@/lib/product-two-format/orchestration/preflight";
import { runJointBase } from "@/lib/product-two-format/orchestration/joint-base";
import {
  createJointOfflineWorld,
  createJointWorldDeps,
  jointBaseInput,
  jointOpenInput,
  jointSquareInput,
  jointVerticalInput,
} from "@/lib/product-two-format/orchestration/__tests__/support/joint-offline-world";
import { createC4HttpInjection } from "../c4-http-injection";

describe("F60.7 C4-I — jornada offline com injeção determinística", () => {
  it("base, copy e expansão usam os invokers determinísticos, sem provider padrão", async () => {
    const world = createJointOfflineWorld();
    world.seedScenario();
    const injection = createC4HttpInjection({ client: world.client });
    const worldDeps = await createJointWorldDeps(world, {
      providerSeams: injection.seams,
    });

    const preflight = await preflightJointSelection(worldDeps.joint.preflight);
    expect(preflight.ok).toBe(true);
    if (!preflight.ok) throw new Error("preflight_failed");
    const opened = await openJointOperation(
      jointOpenInput({ selection: preflight.selection }),
      {
        openJointDelivery: (input) =>
          worldDeps.joint.jointClient.openJointDelivery(input),
      },
    );
    expect(opened.kind).toBe("opened");

    const base = await runJointBase(jointBaseInput(), worldDeps.baseDeps);
    expect(base).toEqual({ kind: "completed" });

    const square = await deliverJointSquare(
      jointSquareInput(),
      worldDeps.squareDeps,
    );
    expect(square.kind).toBe("delivered");

    const vertical = await deliverTwoFormatVertical(
      jointVerticalInput(),
      worldDeps.verticalDeps,
    );
    expect(vertical.kind).toBe("delivered");

    expect(injection.activation.map((event) => event.step).sort()).toEqual([
      "base_image",
      "copy",
      "vertical_expansion",
    ]);
    for (const event of injection.activation) {
      expect(event).toEqual({
        step: event.step,
        source: "deterministic",
        model: "c4-deterministic-provider",
      });
      expect(event).not.toHaveProperty("usage");
      expect(event).not.toHaveProperty("cost");
    }

    expect(worldDeps.counters.baseProviderCalls).toBe(0);
    expect(worldDeps.counters.copyCalls).toBe(0);
    expect(worldDeps.counters.expansionProviderCalls).toBe(0);

    const copyRow = world.rows.find(
      (row) => row.__table === "product_1_1_copy_state",
    );
    expect(String(copyRow?.copy_text)).toContain("Legenda determinística");
  });
});
