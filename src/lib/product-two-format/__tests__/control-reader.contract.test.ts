// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  applyTwoFormatDurableOutcomes,
  readTwoFormatDurableOutcomes,
  resolveTwoFormatControlOperation,
} from "../control-reader";

function chain(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.select = () => query;
  query.eq = () => query;
  query.in = () => query;
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return query;
}

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const CONTROL = "33333333-3333-4333-8333-333333333333";
const SQUARE = "44444444-4444-4444-8444-444444444444";

describe("F60.7 C3 — autoridade conjunta", () => {
  it("resolve UMA operação de controle; múltiplas falham fechado", async () => {
    const single = {
      from: vi.fn(() =>
        chain({
          data: [{ operation_id: CONTROL }, { operation_id: CONTROL }],
          error: null,
        }),
      ),
    };
    await expect(
      resolveTwoFormatControlOperation({
        campaignId: CAMPAIGN,
        storeId: STORE,
        client: single as never,
      }),
    ).resolves.toEqual({ kind: "found", operationId: CONTROL });

    const mixed = {
      from: vi.fn(() =>
        chain({
          data: [{ operation_id: CONTROL }, { operation_id: SQUARE }],
          error: null,
        }),
      ),
    };
    await expect(
      resolveTwoFormatControlOperation({
        campaignId: CAMPAIGN,
        storeId: STORE,
        client: mixed as never,
      }),
    ).resolves.toEqual({
      kind: "inconsistent",
      reason: "multiple_control_operations",
    });
  });

  it("lê outcome unknown por identidade e preserva crédito terminal", async () => {
    const client = {
      from: vi.fn(() =>
        chain({
          data: [
            {
              operation_id: CONTROL,
              outcome: "unknown",
              support_reference: "ref-1",
            },
            { operation_id: SQUARE, outcome: "failed", support_reference: null },
          ],
          error: null,
        }),
      ),
    };
    const result = await readTwoFormatDurableOutcomes({
      campaignId: CAMPAIGN,
      controlOperationId: CONTROL,
      operations: [SQUARE],
      client: client as never,
    });
    expect(result).toMatchObject({
      kind: "found",
      controlSupportReference: "ref-1",
    });
    expect(
      result.kind === "found" ? [...result.unknownOperationIds] : [],
    ).toEqual([CONTROL]);
  });

  it("aplica unknown só em processing e nunca rebaixa delivered", () => {
    const view = {
      origin: "two_format_two_stage" as const,
      campaignId: CAMPAIGN,
      operationId: CONTROL,
      square: {
        format: "1:1" as const,
        state: "delivered" as const,
        creditRefunded: false,
        deliveryOperationId: SQUARE,
        artifactRole: "square_original" as const,
        artifactPath: `${STORE}/${CAMPAIGN}/${CONTROL}/square_original.jpg`,
        supportReference: null,
      },
      vertical: {
        format: "9:16" as const,
        state: "processing" as const,
        creditRefunded: false,
        deliveryOperationId: CONTROL,
        artifactRole: null,
        artifactPath: null,
        supportReference: null,
      },
      preferredThumbnail: null,
    };

    const applied = applyTwoFormatDurableOutcomes(view, {
      unknownOperationIds: new Set([CONTROL]),
      outcomesReadFailed: false,
      controlOperationId: CONTROL,
    });
    expect(applied.square.state).toBe("delivered");
    expect(applied.vertical.state).toBe("unknown");
  });

  it("crédito compartilhado terminal torna o unknown histórico do controle inerte", () => {
    const base = {
      origin: "two_format_two_stage" as const,
      campaignId: CAMPAIGN,
      operationId: CONTROL,
      square: {
        format: "1:1" as const,
        state: "processing" as const,
        creditRefunded: false,
        deliveryOperationId: SQUARE,
        artifactRole: null,
        artifactPath: null,
        supportReference: null,
      },
      vertical: {
        format: "9:16" as const,
        state: "delivered" as const,
        creditRefunded: false,
        deliveryOperationId: CONTROL,
        artifactRole: "vertical" as const,
        artifactPath: `${STORE}/${CAMPAIGN}/${CONTROL}/vertical.jpg`,
        supportReference: null,
      },
      preferredThumbnail: null,
    };

    const delivered = applyTwoFormatDurableOutcomes(base, {
      unknownOperationIds: new Set([CONTROL]),
      outcomesReadFailed: false,
      controlOperationId: CONTROL,
    });
    expect(delivered.square.state).toBe("processing");
    expect(delivered.vertical.state).toBe("delivered");

    const refunded = applyTwoFormatDurableOutcomes(
      {
        ...base,
        vertical: {
          ...base.vertical,
          state: "absent",
          creditRefunded: true,
          artifactRole: null,
          artifactPath: null,
        },
      },
      {
        unknownOperationIds: new Set([CONTROL]),
        outcomesReadFailed: false,
        controlOperationId: CONTROL,
      },
    );
    expect(refunded.square.state).toBe("processing");
    expect(refunded.vertical.state).toBe("absent");
  });

  it("unknown PRÓPRIO do quadrado continua bloqueando e falha de leitura é fail-closed", () => {
    const base = {
      origin: "two_format_two_stage" as const,
      campaignId: CAMPAIGN,
      operationId: CONTROL,
      square: {
        format: "1:1" as const,
        state: "processing" as const,
        creditRefunded: false,
        deliveryOperationId: SQUARE,
        artifactRole: null,
        artifactPath: null,
        supportReference: null,
      },
      vertical: {
        format: "9:16" as const,
        state: "delivered" as const,
        creditRefunded: false,
        deliveryOperationId: CONTROL,
        artifactRole: "vertical" as const,
        artifactPath: `${STORE}/${CAMPAIGN}/${CONTROL}/vertical.jpg`,
        supportReference: null,
      },
      preferredThumbnail: null,
    };

    const ownUnknown = applyTwoFormatDurableOutcomes(base, {
      unknownOperationIds: new Set([SQUARE]),
      outcomesReadFailed: false,
      controlOperationId: CONTROL,
    });
    expect(ownUnknown.square.state).toBe("unknown");
    expect(ownUnknown.vertical.state).toBe("delivered");

    const failedRead = applyTwoFormatDurableOutcomes(base, {
      unknownOperationIds: new Set(),
      outcomesReadFailed: true,
      controlOperationId: CONTROL,
    });
    expect(failedRead.square.state).toBe("unknown");
  });
});
