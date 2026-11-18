// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type {
  TwoFormatOpenInput,
  TwoFormatOpenResult,
} from "../joint-financial-client";
import { openJointOperation } from "../orchestration/joint-operation-service";

/**
 * Contrato OFFLINE da abertura conjunta (F60.7 / Plano 60.7-04).
 *
 * O cliente é um fake estrutural: nenhuma RPC, banco, provider ou Storage.
 * O serviço não importa o módulo server-only do cliente em runtime; o erro
 * tipado é reconhecido pelo `name`/`code` estáveis.
 */

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE = "44444444-4444-4444-8444-444444444444";
const CONFIG_VERSION = "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";
const MODEL = "gpt-image-2.5-flare";
const QUALITY = "medium";

const JOINT_SNAPSHOT = {
  campaignFormat: "1:1+9:16",
  formatContractVersion: "f60.7-two-format-v1",
  generationOrigin: "two_format_two_stage",
  generationContractVersion: "f60.7-two-format-v1",
};

function selection(overrides: Record<string, unknown> = {}) {
  return {
    model: MODEL,
    quality: QUALITY,
    configVersionId: CONFIG_VERSION,
    ...overrides,
  };
}

function newInput(overrides: Record<string, unknown> = {}) {
  return {
    mode: "new" as const,
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    squareDeliveryId: SQUARE,
    inputSnapshot: JOINT_SNAPSHOT,
    selection: selection(),
    ...overrides,
  };
}

function replayInput(overrides: Record<string, unknown> = {}) {
  return {
    mode: "replay" as const,
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    squareDeliveryId: SQUARE,
    inputSnapshot: JOINT_SNAPSHOT,
    frozenSelection: selection(),
    ...overrides,
  };
}

function openSuccess(overrides: Record<string, unknown> = {}): TwoFormatOpenResult {
  return {
    success: true,
    idempotent: false,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    squareDeliveryId: SQUARE,
    verticalDeliveryOperationId: OPERATION,
    contractVersion: "f60.7-two-format-v1",
    frozenSelection: {
      model: MODEL,
      quality: QUALITY,
      configVersionId: CONFIG_VERSION,
      origin: "configured",
    },
    creditStatus: "reserved",
    squareCreditStatus: "reserved",
    steps: [
      { stage: "base", status: "pending", attemptsUsed: 0, failureClass: null },
      { stage: "expansion", status: "pending", attemptsUsed: 0, failureClass: null },
    ],
    ...overrides,
  } as TwoFormatOpenResult;
}

function deliveryError(code: string): Error {
  return Object.assign(new Error(code), {
    name: "TwoFormatDeliveryError",
    code,
  });
}

function depsWith(
  response: TwoFormatOpenResult | (() => Promise<never>),
) {
  const calls: TwoFormatOpenInput[] = [];
  return {
    calls,
    deps: {
      openJointDelivery: async (
        input: TwoFormatOpenInput,
      ): Promise<TwoFormatOpenResult> => {
        calls.push(input);
        if (typeof response === "function") return response();
        return response;
      },
    },
  };
}

describe("abertura conjunta — serviço injetável", () => {
  it("Teste 1: nova operação devolve as duas identidades e a seleção congelada", async () => {
    const fake = depsWith(openSuccess());
    const result = await openJointOperation(newInput(), fake.deps);

    expect(result.kind).toBe("opened");
    if (result.kind !== "opened") return;
    expect(result.squareDeliveryId).toBe(SQUARE);
    expect(result.verticalDeliveryOperationId).toBe(OPERATION);
    expect(result.squareDeliveryId).not.toBe(result.verticalDeliveryOperationId);
    expect(result.frozenSelection).toEqual({
      model: MODEL,
      quality: QUALITY,
      configVersionId: CONFIG_VERSION,
      origin: "configured",
    });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].selection).toEqual(selection());
  });

  it("Teste 2: snapshot não conjunto é contract_invalid sem chamar a RPC", async () => {
    const snapshots: unknown[] = [
      null,
      {},
      {
        campaignFormat: "9:16",
        formatContractVersion: "f59-vertical-9-16-v1",
        generationOrigin: "9_16_two_stage",
        generationContractVersion: "f60.5-two-stage-9-16-v1",
      },
    ];
    for (const inputSnapshot of snapshots) {
      const fake = depsWith(openSuccess());
      const result = await openJointOperation(newInput({ inputSnapshot }), fake.deps);
      expect(result).toEqual({ kind: "contract_invalid", reason: "not_two_format" });
      expect(fake.calls).toHaveLength(0);
    }
  });

  it("Teste 3: par conjunto corrompido é contract_invalid com motivo", async () => {
    const snapshots: unknown[] = [
      { campaignFormat: "1:1+9:16", formatContractVersion: "f60.7-two-format-v1" },
      {
        campaignFormat: "1:1+9:16",
        formatContractVersion: "f60.7-two-format-v1",
        generationOrigin: "historical",
        generationContractVersion: "x",
      },
      {
        campaignFormats: ["1:1", "9:16"],
        generationOrigin: "two_format_two_stage",
        generationContractVersion: "f60.7-two-format-v1",
      },
    ];
    for (const inputSnapshot of snapshots) {
      const fake = depsWith(openSuccess());
      const result = await openJointOperation(newInput({ inputSnapshot }), fake.deps);
      expect(result.kind).toBe("contract_invalid");
      if (result.kind !== "contract_invalid") return;
      expect(result.reason.length).toBeGreaterThan(0);
      expect(fake.calls).toHaveLength(0);
    }
  });

  it("Teste 4: joint_contract_required é rejeição de negócio", async () => {
    const fake = depsWith({ success: false, reason: "joint_contract_required" });
    expect(await openJointOperation(newInput(), fake.deps)).toEqual({
      kind: "business",
      reason: "joint_contract_required",
    });
  });

  it("Teste 5: motivos de negócio da abertura são tipados, nunca failed", async () => {
    for (const reason of [
      "operation_config_conflict",
      "operation_origin_conflict",
      "operation_identity_conflict",
      "operation_in_progress",
      "delivery_link_incomplete",
      "joint_open_failed",
    ] as const) {
      const fake = depsWith({ success: false, reason });
      expect(await openJointOperation(newInput(), fake.deps)).toEqual({
        kind: "business",
        reason,
      });
    }
  });

  it("Teste 6: replay usa a seleção congelada e é idempotente", async () => {
    const frozen = selection({ model: "gpt-image-2.5-sunburst" });
    const fake = depsWith(
      openSuccess({
        idempotent: true,
        frozenSelection: {
          model: "gpt-image-2.5-sunburst",
          quality: QUALITY,
          configVersionId: CONFIG_VERSION,
          origin: "configured",
        },
      }),
    );
    const result = await openJointOperation(
      replayInput({ frozenSelection: frozen }),
      fake.deps,
    );

    expect(result.kind).toBe("opened");
    if (result.kind !== "opened") return;
    expect(result.idempotent).toBe(true);
    expect(result.squareDeliveryId).toBe(SQUARE);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].selection).toEqual(frozen);
  });

  it("Teste 7: exceções tipadas viram failed com código preservado", async () => {
    for (const code of [
      "invalid_envelope",
      "unknown",
      "shared_operation_not_final",
      "delivery_links_inconsistent",
      "identity_mismatch",
    ]) {
      const fake = depsWith(async () => {
        throw deliveryError(code);
      });
      expect(await openJointOperation(newInput(), fake.deps)).toEqual({
        kind: "failed",
        code,
      });
    }
  });

  it("Teste 8: identidade inválida falha antes da RPC", async () => {
    const fake = depsWith(openSuccess());
    expect(
      await openJointOperation(newInput({ squareDeliveryId: OPERATION }), fake.deps),
    ).toEqual({ kind: "failed", code: "delivery_identity_conflict" });

    expect(
      await openJointOperation(newInput({ storeId: "not-a-uuid" }), fake.deps),
    ).toEqual({ kind: "failed", code: "identity_mismatch" });

    expect(fake.calls).toHaveLength(0);
  });

  it("Teste 9: seleção divergente da congelada é failed/operation_config_conflict", async () => {
    const fake = depsWith(async () => {
      throw deliveryError("operation_config_conflict");
    });
    expect(await openJointOperation(newInput(), fake.deps)).toEqual({
      kind: "failed",
      code: "operation_config_conflict",
    });
    expect(fake.calls).toHaveLength(1);
  });

  it("Teste 10: o serviço não importa infraestrutura nem efeitos financeiros", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/lib/product-two-format/orchestration/joint-operation-service.ts",
      ),
      "utf8",
    );
    for (const forbidden of [
      "server-only",
      "@/lib/supabase",
      "@/lib/product-1-1",
      "nine-sixteen-expansion-model-config-service",
      "readConfiguration",
      "preflightSelection",
      "reserveOperationOnce",
      "markArtUploaded",
      ".deliver(",
      ".upload(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("Teste 11: new usa selection; replay usa frozenSelection", async () => {
    const newFake = depsWith(openSuccess());
    await openJointOperation(newInput(), newFake.deps);
    expect(newFake.calls[0].selection).toEqual(selection());

    const frozen = selection({ quality: "low" });
    const replayFake = depsWith(openSuccess({ idempotent: true }));
    await openJointOperation(replayInput({ frozenSelection: frozen }), replayFake.deps);
    expect(replayFake.calls[0].selection).toEqual(frozen);
  });

  it("Teste 12: seleção inválida é recusada localmente com operation_config_conflict", async () => {
    const fake = depsWith(openSuccess());
    for (const invalid of [
      selection({ model: "gpt-image-3" }),
      selection({ quality: "ultra" }),
      selection({ configVersionId: "config" }),
    ]) {
      expect(
        await openJointOperation(newInput({ selection: invalid }), fake.deps),
      ).toEqual({ kind: "failed", code: "operation_config_conflict" });
    }
    expect(fake.calls).toHaveLength(0);
  });
});
