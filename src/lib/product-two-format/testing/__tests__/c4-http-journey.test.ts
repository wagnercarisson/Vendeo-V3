// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { deliverJointSquare } from "@/lib/product-two-format/orchestration/deliver-square";
import { deliverTwoFormatVertical } from "@/lib/product-two-format/orchestration/deliver-joint-vertical";
import { openJointOperation } from "@/lib/product-two-format/orchestration/joint-operation-service";
import { preflightJointSelection } from "@/lib/product-two-format/orchestration/preflight";
import { runJointBase } from "@/lib/product-two-format/orchestration/joint-base";
import { runExpansionStep } from "@/lib/product-9-16-two-stage/orchestration/expansion-step";
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
    const worldDeps = await createJointWorldDeps(world);
    const injection = createC4HttpInjection({
      client: world.client,
      baseSeams: worldDeps.baseSeams,
      expandSeams: worldDeps.expandSeams,
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

    const base = await runJointBase(jointBaseInput(), {
      ...worldDeps.baseDeps,
      base: injection.base,
    });
    expect(base).toEqual({ kind: "completed" });

    const square = await deliverJointSquare(
      jointSquareInput(),
      worldDeps.squareDeps,
    );
    expect(square.kind).toBe("delivered");

    const verticalDeps = {
      ...worldDeps.verticalDeps,
      expand: (input: Parameters<typeof runExpansionStep>[0]) =>
        runExpansionStep(input, {
          control: worldDeps.joint.control,
          expand: injection.expand,
          preflightFrozenExpansion:
            worldDeps.nine.deps.preflightFrozenExpansion,
          clock: worldDeps.joint.clock,
          client: world.client,
        }),
    };
    const vertical = await deliverTwoFormatVertical(
      jointVerticalInput(),
      verticalDeps,
    );
    expect(vertical.kind).toBe("delivered");

    const thumbnailPaths = world.base.handles.uploads
      .filter(
        (upload) =>
          upload.bucket === "campaign-images" &&
          upload.path.endsWith(".thumb-v1.webp"),
      )
      .map((upload) => upload.path);
    expect(
      thumbnailPaths.some((path) => path.endsWith("/square_original.thumb-v1.webp")),
    ).toBe(true);
    expect(
      thumbnailPaths.some((path) => path.endsWith("/vertical.thumb-v1.webp")),
    ).toBe(true);
    expect(world.rpcCounts["product_two_format_project_campaign"] ?? 0).toBe(0);

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
