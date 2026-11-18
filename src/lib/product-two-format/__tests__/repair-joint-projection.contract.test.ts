// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { TwoFormatReadResult } from "../delivery-reader";
import type { TwoFormatFormatView } from "../read-model";
import type {
  TwoFormatDeliveryErrorCode,
  TwoFormatProjectResult,
} from "../joint-financial-client";

import {
  repairJointProjection,
  type JointProjectionRepairDeps,
} from "../orchestration/repair-joint-projection";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;
const VERTICAL_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

function formatView(
  format: "1:1" | "9:16",
  overrides: Partial<TwoFormatFormatView> = {},
): TwoFormatFormatView {
  return {
    format,
    state: "delivered",
    creditRefunded: false,
    deliveryOperationId:
      format === "1:1" ? "44444444-4444-4444-8444-444444444444" : OPERATION,
    artifactRole: format === "1:1" ? "square_original" : "vertical",
    artifactPath: format === "1:1" ? SQUARE_PATH : VERTICAL_PATH,
    supportReference: null,
    ...overrides,
  };
}

function readFound(overrides: {
  square?: Partial<TwoFormatFormatView>;
  vertical?: Partial<TwoFormatFormatView>;
} = {}): TwoFormatReadResult {
  return {
    kind: "found",
    view: {
      origin: "two_format_two_stage",
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      square: formatView("1:1", overrides.square),
      vertical: formatView("9:16", overrides.vertical),
      preferredThumbnail: "square",
    },
  };
}

function projected(
  overrides: Partial<Extract<TwoFormatProjectResult, { success: true }>> = {},
): TwoFormatProjectResult {
  return {
    success: true,
    campaignId: CAMPAIGN,
    projected: true,
    alreadyProjected: false,
    campaignStatus: "ready",
    storagePath: SQUARE_PATH,
    preferredFormat: "1:1",
    ...overrides,
  };
}

function twoFormatError(code: TwoFormatDeliveryErrorCode): Error {
  return Object.assign(new Error(code), {
    name: "TwoFormatDeliveryError",
    code,
  });
}

interface DepsConfig {
  readonly read?: TwoFormatReadResult;
  readonly project?: TwoFormatProjectResult;
  readonly projectThrows?: Error;
  readonly exists?: (input: {
    campaignId: string;
    role: "square_original" | "vertical";
  }) => boolean;
  readonly thumbnailThrows?: Error;
  readonly thumbnailResult?: unknown;
  readonly useThumbnailResult?: boolean;
}

function makeDeps(config: DepsConfig = {}) {
  const order: string[] = [];
  const deps: JointProjectionRepairDeps = {
    readDelivery: vi.fn(async () => {
      order.push("read");
      return config.read ?? readFound();
    }),
    projectCampaign: vi.fn(async () => {
      order.push("project");
      if (config.projectThrows !== undefined) throw config.projectThrows;
      return config.project ?? projected();
    }),
    thumbnailExists: vi.fn(async (input) => {
      order.push(`exists:${input.role}`);
      return config.exists?.(input) ?? false;
    }),
    generateThumbnail: vi.fn(async (input) => {
      order.push(`thumbnail:${input.role}`);
      if (config.thumbnailThrows !== undefined) throw config.thumbnailThrows;
      if (config.useThumbnailResult === true) return config.thumbnailResult;
      return {
        status: "created",
        thumbnailPath: `${CAMPAIGN}-thumb.jpg`,
        width: 640,
        height: 360,
      };
    }),
  };
  return { deps, order };
}

describe("F60.7-07 — reparo idempotente de projeção e miniatura", () => {
  it("Teste 1: projeção atrasada ⇒ projectCampaign uma vez + miniatura do quadrado", async () => {
    const { deps, order } = makeDeps({
      read: readFound({ vertical: { state: "processing", artifactPath: null } }),
    });
    expect(
      await repairJointProjection(
        { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
        deps,
      ),
    ).toEqual({
      kind: "repaired",
      projected: true,
      alreadyProjected: false,
      thumbnails: ["1:1"],
    });
    expect(order).toEqual(["read", "project", "exists:square_original", "thumbnail:square_original"]);
  });

  it("Teste 2: replay já projetado e miniatura existente ⇒ nenhuma segunda geração", async () => {
    const { deps } = makeDeps({
      project: projected({ alreadyProjected: true, projected: false }),
      exists: () => true,
    });
    expect(
      await repairJointProjection(
        { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
        deps,
      ),
    ).toEqual({
      kind: "repaired",
      projected: false,
      alreadyProjected: true,
      thumbnails: [],
    });
    expect(deps.generateThumbnail).not.toHaveBeenCalled();
  });

  it("Teste 3: somente vertical entregue ⇒ miniatura do vertical, nunca do quadrado", async () => {
    const { deps } = makeDeps({
      read: readFound({ square: { state: "processing", artifactPath: null } }),
    });
    const outcome = await repairJointProjection(
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
      deps,
    );
    expect(outcome).toEqual({
      kind: "repaired",
      projected: true,
      alreadyProjected: false,
      thumbnails: ["9:16"],
    });
    expect(deps.generateThumbnail).toHaveBeenCalledTimes(1);
    expect(deps.generateThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ role: "vertical", storagePath: VERTICAL_PATH }),
    );
  });

  it("Teste 4: unknown/unavailable não geram miniatura; o irmão entregue é reparado", async () => {
    const { deps } = makeDeps({
      read: readFound({ vertical: { state: "unknown" } }),
    });
    expect(
      await repairJointProjection(
        { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
        deps,
      ),
    ).toEqual({
      kind: "repaired",
      projected: true,
      alreadyProjected: false,
      thumbnails: ["1:1"],
    });
    expect(deps.generateThumbnail).toHaveBeenCalledTimes(1);
  });

  it("Teste 5: falha de miniatura não rebaixa a projeção e não entra na lista", async () => {
    const thrown = makeDeps({ thumbnailThrows: new Error("storage") });
    expect(
      await repairJointProjection(
        { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
        thrown.deps,
      ),
    ).toEqual({
      kind: "repaired",
      projected: true,
      alreadyProjected: false,
      thumbnails: [],
    });

    for (const status of ["failed", "skipped"] as const) {
      const notCreated = makeDeps({
        thumbnailResult: { status },
        useThumbnailResult: true,
      });
      expect(
        await repairJointProjection(
          { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
          notCreated.deps,
        ),
      ).toEqual({
        kind: "repaired",
        projected: true,
        alreadyProjected: false,
        thumbnails: [],
      });
    }
  });

  it("Teste 6: campaign_not_found ⇒ projection_failed sem efeitos", async () => {
    const { deps } = makeDeps({
      project: { success: false, reason: "campaign_not_found" },
    });
    expect(
      await repairJointProjection(
        { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
        deps,
      ),
    ).toEqual({ kind: "projection_failed", reason: "campaign_not_found" });
    expect(deps.generateThumbnail).not.toHaveBeenCalled();
  });

  it("Teste 7: erro tipado da projeção preserva o código", async () => {
    for (const code of [
      "delivery_links_inconsistent",
      "invalid_envelope",
      "unknown",
    ] as const) {
      const run = makeDeps({ projectThrows: twoFormatError(code) });
      expect(
        await repairJointProjection(
          { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
          run.deps,
        ),
      ).toEqual({ kind: "failed", code });
    }
  });

  it("Teste 8: o módulo não tem efeito financeiro nem entrega", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-two-format/orchestration/repair-joint-projection.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/deliverFormat|refundFormat|beginPublication|runBase|runNineSixteenTwoStageGeneration/);
  });

  it("Teste 9: duas execuções ⇒ uma projeção por execução e sem miniatura duplicada", async () => {
    let generated = false;
    const deps: JointProjectionRepairDeps = {
      readDelivery: vi.fn(async () => readFound()),
      projectCampaign: vi.fn(async () => projected({ alreadyProjected: generated })),
      thumbnailExists: vi.fn(async () => generated),
      generateThumbnail: vi.fn(async () => {
        generated = true;
        return { status: "created", thumbnailPath: "t.jpg", width: 640, height: 360 };
      }),
    };
    await repairJointProjection(
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
      deps,
    );
    await repairJointProjection(
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
      deps,
    );
    expect(deps.projectCampaign).toHaveBeenCalledTimes(2);
    expect(deps.generateThumbnail).toHaveBeenCalledTimes(1);
  });

  it("Teste 10: exceção em thumbnailExists não rejeita e preserva o outro formato", async () => {
    const { deps } = makeDeps({
      exists: (item) => {
        if (item.role === "square_original") throw new Error("storage");
        return false;
      },
    });
    const outcome = await repairJointProjection(
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
      deps,
    );
    expect(outcome).toEqual({
      kind: "repaired",
      projected: true,
      alreadyProjected: false,
      thumbnails: ["9:16"],
    });
    expect(deps.generateThumbnail).toHaveBeenCalledTimes(1);
    expect(deps.generateThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ role: "vertical" }),
    );
  });

  it("Teste 11: contrato real do gerador — só `created` é nova geração", async () => {
    for (const thumbnailResult of [
      { status: "already_exists", thumbnailPath: "t.jpg" },
      { status: "skipped", reason: "upstream_failed" },
      { status: "failed", reason: "thumbnail_generation_failed" },
      {},
      undefined,
    ]) {
      const run = makeDeps({
        thumbnailResult,
        useThumbnailResult: true,
      });
      expect(
        await repairJointProjection(
          { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
          run.deps,
        ),
      ).toEqual({
        kind: "repaired",
        projected: true,
        alreadyProjected: false,
        thumbnails: [],
      });
    }
  });
});
