// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type {
  TwoFormatDeliverInput,
  TwoFormatDeliverResult,
} from "../joint-financial-client";
import { deliverJointSquare } from "../orchestration/deliver-square";

vi.mock("server-only", () => ({}));

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE = "44444444-4444-4444-8444-444444444444";
const PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;

function input() {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    deliveryOperationId: SQUARE,
  };
}

function deliverSuccess(overrides: Record<string, unknown> = {}): TwoFormatDeliverResult {
  return {
    success: true,
    idempotent: false,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format: "1:1",
    deliveryOperationId: SQUARE,
    artifactRole: "square_original",
    creditStatus: "delivered",
    campaignStatus: "ready",
    storagePath: PATH,
    preferredFormat: "1:1",
    projected: true,
    alreadyProjected: false,
    ...overrides,
  } as TwoFormatDeliverResult;
}

function twoFormatError(code: string): Error {
  return Object.assign(new Error(code), {
    name: "TwoFormatDeliveryError",
    code,
  });
}

function creditError(code: string): Error {
  return Object.assign(new Error(code), {
    name: "CreditOperationError",
    code,
  });
}

function fakeDeps(overrides: Record<string, unknown> = {}) {
  const order: string[] = [];
  const deps = {
    probeSquareOriginal: vi.fn(async () => {
      order.push("probe");
      return {
        kind: "integral" as const,
        storagePath: PATH,
        artifactId: "artifact",
        width: 1024 as const,
        height: 1024 as const,
        mimeType: "image/jpeg" as const,
      };
    }),
    beginPublication: vi.fn(async () => {
      order.push("token");
      return { acquired: true, token: "token-1", publicationState: "in_flight" };
    }),
    abortPublication: vi.fn(async () => {
      order.push("abort");
      return { success: true };
    }),
    deliverFormat: vi.fn(async (deliverInput: TwoFormatDeliverInput) => {
      order.push("deliver");
      expect(deliverInput.operationId).toBe(OPERATION);
      expect(deliverInput.publicationToken).toBe("token-1");
      return deliverSuccess();
    }),
    generateThumbnail: vi.fn(async () => {
      order.push("thumb");
      return { status: "generated" };
    }),
    ...overrides,
  };
  return { deps: deps as never, order, raw: deps };
}

describe("entrega do quadrado conjunto", () => {
  it("Teste 1: ordem artefato→token→RPC→miniatura, com identidades separadas", async () => {
    const fake = fakeDeps();
    const result = await deliverJointSquare(input(), fake.deps);

    expect(result).toEqual({
      kind: "delivered",
      idempotent: false,
      campaignStatus: "ready",
      storagePath: PATH,
    });
    expect(fake.order).toEqual(["probe", "token", "deliver", "thumb"]);
  });

  it("Teste 2: sonda invalid ⇒ nenhum efeito", async () => {
    const fake = fakeDeps({
      probeSquareOriginal: vi.fn(async () => ({ kind: "invalid", reason: "x" })),
    });
    expect(await deliverJointSquare(input(), fake.deps)).toEqual({
      kind: "artifact_incompatible",
      reason: "x",
    });
    expect(fake.order).toEqual([]);
  });

  it("Teste 3: sonda indeterminate ⇒ nenhum efeito", async () => {
    const fake = fakeDeps({
      probeSquareOriginal: vi.fn(async () => ({ kind: "indeterminate" })),
    });
    expect(await deliverJointSquare(input(), fake.deps)).toEqual({ kind: "indeterminate" });
    expect(fake.order).toEqual([]);
  });

  it("Teste 4: sonda absent ⇒ artifact_absent sem efeito", async () => {
    const fake = fakeDeps({
      probeSquareOriginal: vi.fn(async () => ({ kind: "absent" })),
    });
    expect(await deliverJointSquare(input(), fake.deps)).toEqual({ kind: "artifact_absent" });
    expect(fake.order).toEqual([]);
  });

  it("Teste 5: token não adquirido ⇒ publication_pending, artefato intacto", async () => {
    const fake = fakeDeps({
      beginPublication: vi.fn(async () => ({
        acquired: false,
        token: null,
        publicationState: "in_flight",
      })),
    });
    expect(await deliverJointSquare(input(), fake.deps)).toEqual({
      kind: "publication_pending",
    });
    expect(fake.order).toEqual(["probe"]);
  });

  it("Teste 6: falhas de negócio mapeadas sem estorno", async () => {
    const cases: Array<[string, unknown]> = [
      ["missing_publication_token", { kind: "publication_pending" }],
      ["artifact_incompatible", { kind: "artifact_incompatible", reason: "artifact_incompatible" }],
      ["invalid_transition", { kind: "terminal_conflict", code: "invalid_transition", reason: "invalid_transition" }],
      ["delivery_link_missing", { kind: "failed", code: "delivery_link_missing" }],
      ["credit_operation_missing", { kind: "failed", code: "credit_operation_missing" }],
    ];
    for (const [reason, expected] of cases) {
      const fake = fakeDeps({
        deliverFormat: vi.fn(async () => ({ success: false, reason })),
      });
      expect(await deliverJointSquare(input(), fake.deps)).toEqual(expected);
    }
  });

  it("Teste 7: exceção tipada/ambígua ⇒ failed e NÃO aborta", async () => {
    for (const code of ["invalid_envelope", "unknown", "publication_not_owner", "publication_in_progress"]) {
      const fake = fakeDeps({
        deliverFormat: vi.fn(async () => {
          throw twoFormatError(code);
        }),
      });
      expect(await deliverJointSquare(input(), fake.deps)).toEqual({
        kind: "failed",
        code,
      });
      expect(fake.raw.abortPublication).not.toHaveBeenCalled();
    }
  });

  it("Teste 8: falha da miniatura não desfaz a entrega", async () => {
    const fake = fakeDeps({
      generateThumbnail: vi.fn(async () => {
        throw new Error("thumb failed");
      }),
    });
    expect(await deliverJointSquare(input(), fake.deps)).toMatchObject({
      kind: "delivered",
    });
  });

  it("Teste 9: crédito terminal no token ⇒ terminal_conflict sem entrega", async () => {
    const fake = fakeDeps({
      beginPublication: vi.fn(async () => {
        throw creditError("operation_terminal");
      }),
    });
    expect(await deliverJointSquare(input(), fake.deps)).toEqual({
      kind: "terminal_conflict",
      code: "operation_terminal",
      reason: "operation_terminal",
    });
    expect(fake.raw.deliverFormat).not.toHaveBeenCalled();
  });

  it("Teste 10: módulo não projeta, não faz upload nem copia arte", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/product-two-format/orchestration/deliver-square.ts"),
      "utf8",
    );
    for (const forbidden of [
      "projectCampaign",
      "projectDelivered",
      "markArtUploaded",
      ".deliver(",
      ".upload(",
      "storeArtifact",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("Teste 11: abort só na allowlist comprovadamente sem confirmação", async () => {
    for (const reason of [
      "missing_publication_token",
      "artifact_incompatible",
      "delivery_link_missing",
      "credit_operation_missing",
      "invalid_transition",
    ]) {
      const fake = fakeDeps({
        deliverFormat: vi.fn(async () => ({ success: false, reason })),
      });
      await deliverJointSquare(input(), fake.deps);
      expect(fake.raw.abortPublication).toHaveBeenCalledTimes(1);
      expect(fake.raw.abortPublication).toHaveBeenCalledWith(
        CAMPAIGN,
        SQUARE,
        "token-1",
        "before_upload",
      );
    }

    for (const code of ["invalid_envelope", "unknown", "publication_not_owner"]) {
      const fake = fakeDeps({
        deliverFormat: vi.fn(async () => {
          throw twoFormatError(code);
        }),
      });
      await deliverJointSquare(input(), fake.deps);
      expect(fake.raw.abortPublication).not.toHaveBeenCalled();
    }
  });

  it("Teste 12: before_upload não remove o artefato interno", async () => {
    const fake = fakeDeps({
      deliverFormat: vi.fn(async () => ({ success: false, reason: "artifact_incompatible" })),
    });
    await deliverJointSquare(input(), fake.deps);

    const stillIntegral = await fake.raw.probeSquareOriginal({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });
    expect(stillIntegral).toMatchObject({ kind: "integral", storagePath: PATH });
  });
});
