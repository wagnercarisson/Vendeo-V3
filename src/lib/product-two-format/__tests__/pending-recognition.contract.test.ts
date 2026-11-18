// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerticalArtifactProbe } from "@/lib/product-9-16-two-stage/two-stage-financial-service";

import type { JointSquareProbe } from "../orchestration/square-probe";
import {
  listJointPendingOperations,
  type JointPendingRecognitionDeps,
} from "../orchestration/pending-recognition";
import { decideJointResolution } from "../orchestration/pending-guards";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_ID = "44444444-4444-4444-8444-444444444444";

const LINKS = "product_two_format_deliveries";
const CREDIT = "product_1_1_campaign_credit_operations";
const CLAIMS = "product_generation_active_claims_v";
const CONTROL_OUTCOMES = "product_9_16_two_stage_outcomes";
const SQUARE_OUTCOMES = "product_1_1_generation_outcomes";

type Row = Record<string, unknown>;

function link(format: "1:1" | "9:16", overrides: Row = {}): Row {
  return {
    campaign_id: CAMPAIGN,
    operation_id: OPERATION,
    store_id: STORE,
    format,
    delivery_operation_id: format === "1:1" ? SQUARE_ID : OPERATION,
    artifact_role: format === "1:1" ? "square_original" : "vertical",
    ...overrides,
  };
}

function credit(
  operationId: string,
  status = "reserved",
  overrides: Row = {},
): Row {
  return {
    campaign_id: CAMPAIGN,
    operation_id: operationId,
    store_id: STORE,
    status,
    ...overrides,
  };
}

function outcome(operationId: string, value: string): Row {
  return { campaign_id: CAMPAIGN, operation_id: operationId, outcome: value };
}

interface FakeTables {
  readonly [table: string]: Row[];
}

function baseTables(overrides: Partial<FakeTables> = {}): FakeTables {
  return {
    [LINKS]: [link("1:1"), link("9:16")],
    [CREDIT]: [credit(OPERATION), credit(SQUARE_ID)],
    [CLAIMS]: [],
    [CONTROL_OUTCOMES]: [],
    [SQUARE_OUTCOMES]: [],
    ...overrides,
  };
}

function makeClient(tables: FakeTables, errors: Record<string, string> = {}) {
  const client = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select(_columns: string) {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        then(
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          if (errors[table] !== undefined) {
            return Promise.resolve({
              data: null,
              error: { message: errors[table] },
            }).then(resolve, reject);
          }
          const raw = tables[table] ?? [];
          const hasMalformed = raw.some(
            (row) => typeof row !== "object" || row === null,
          );
          const rows = hasMalformed
            ? raw
            : raw.filter((row) =>
                filters.every(([column, value]) => row[column] === value),
              );
          return Promise.resolve({ data: rows, error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

interface ProbeConfig {
  readonly square?: { kind: "integral" | "absent" | "invalid"; reason?: string };
  readonly vertical?: { kind: "integral" | "absent" | "indeterminate" };
  readonly squareThrows?: boolean;
  readonly verticalThrows?: boolean;
}

function makeProbes(config: ProbeConfig = {}) {
  const calls: string[] = [];
  const squareProbe: JointSquareProbe = {
    probeSquareOriginal: vi.fn(async (input) => {
      calls.push(`square:${input.operationId}`);
      if (config.squareThrows === true) throw new Error("storage");
      const probe = config.square ?? { kind: "integral" as const };
      if (probe.kind === "integral") {
        return {
          kind: "integral" as const,
          storagePath: "square.jpg",
          artifactId: "artifact-square",
          width: 1024 as const,
          height: 1024 as const,
          mimeType: "image/jpeg" as const,
        };
      }
      if (probe.kind === "invalid") {
        return { kind: "invalid" as const, reason: probe.reason ?? "invalid" };
      }
      return { kind: "absent" as const };
    }),
  };
  const verticalProbe: VerticalArtifactProbe = {
    probeVerticalArtifact: vi.fn(async (input) => {
      calls.push(`vertical:${input.operationId}`);
      if (config.verticalThrows === true) throw new Error("storage");
      const probe = config.vertical ?? { kind: "absent" as const };
      if (probe.kind === "integral") {
        return {
          kind: "integral" as const,
          format: "9:16" as const,
          width: 1080 as const,
          height: 1920 as const,
          mimeType: "image/jpeg" as const,
          storagePath: "vertical.jpg",
          evidenceRef: "evidence",
        };
      }
      return probe.kind === "indeterminate"
        ? { kind: "indeterminate" as const }
        : { kind: "absent" as const };
    }),
  };
  return { squareProbe, verticalProbe, calls };
}

function makeDeps(
  tables: FakeTables,
  probes: ReturnType<typeof makeProbes>,
  errors: Record<string, string> = {},
): JointPendingRecognitionDeps {
  return {
    client: makeClient(tables, errors),
    probeSquare: probes.squareProbe,
    probeVertical: probes.verticalProbe,
  };
}

describe("F60.7-08 — reconhecimento de pendências conjuntas", () => {
  it("Teste 1: dois vínculos reservados ⇒ dois itens completos", async () => {
    const probes = makeProbes();
    const result = await listJointPendingOperations(
      makeDeps(baseTables(), probes),
    );
    expect(result).toEqual({
      kind: "ok",
      items: [
        {
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          storeId: STORE,
          format: "1:1",
          deliveryOperationId: SQUARE_ID,
          artifactRole: "square_original",
          creditStatus: "reserved",
          outcomeKind: "none",
          sharedOutcomeKind: "none",
          sharedCreditStatus: "reserved",
          artifactKind: "integral",
          activeClaim: false,
          linkComplete: true,
          supportReference: null,
        },
        {
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          storeId: STORE,
          format: "9:16",
          deliveryOperationId: OPERATION,
          artifactRole: "vertical",
          creditStatus: "reserved",
          outcomeKind: "none",
          sharedOutcomeKind: "none",
          sharedCreditStatus: "reserved",
          artifactKind: "absent",
          activeClaim: false,
          linkComplete: true,
          supportReference: null,
        },
      ],
      reasons: [],
    });
  });

  it("Teste 2: sonda por papel, sempre na identidade de controle", async () => {
    const probes = makeProbes();
    const result = await listJointPendingOperations(
      makeDeps(baseTables(), probes),
    );
    expect(result.kind).toBe("ok");
    expect(probes.calls).toEqual([
      `square:${OPERATION}`,
      `vertical:${OPERATION}`,
    ]);
  });

  it("Teste 3: créditos terminais não são pendência", async () => {
    const probes = makeProbes();
    const result = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CREDIT]: [
            credit(OPERATION, "delivered"),
            credit(SQUARE_ID, "refunded"),
          ],
        }),
        probes,
      ),
    );
    expect(result).toEqual({ kind: "ok", items: [], reasons: [] });
  });

  it("Teste 4: claim ativo no controle marca os dois itens", async () => {
    const probes = makeProbes();
    const result = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CLAIMS]: [{ campaign_id: CAMPAIGN, operation_id: OPERATION, status: "in_progress" }],
        }),
        probes,
      ),
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("esperava ok");
    expect(result.items.map((item) => item.activeClaim)).toEqual([true, true]);
  });

  it("Teste 5: leitura de vínculos falha; sonda de um formato preserva o irmão", async () => {
    const probes = makeProbes();
    const failed = await listJointPendingOperations(
      makeDeps(baseTables(), probes, { [LINKS]: "boom" }),
    );
    expect(failed).toEqual({ kind: "read_failed", reason: "boom" });

    const squareFails = makeProbes({ squareThrows: true });
    const partial = await listJointPendingOperations(
      makeDeps(baseTables(), squareFails),
    );
    expect(partial.kind).toBe("ok");
    if (partial.kind !== "ok") throw new Error("esperava ok");
    expect(partial.items).toHaveLength(2);
    expect(partial.items[0].artifactKind).toBe("indeterminate");
    expect(partial.items[1].artifactKind).toBe("absent");
  });

  it("Teste 6: vínculo malformado sem itens legíveis ⇒ inconsistent", async () => {
    const probes = makeProbes();
    const result = await listJointPendingOperations(
      makeDeps(
        baseTables({ [LINKS]: [link("1:1", { format: "4:3" })] }),
        probes,
      ),
    );
    expect(result.kind).toBe("inconsistent");
    if (result.kind !== "inconsistent") throw new Error("esperava inconsistent");
    expect(result.reasons).toContain("link_unknown_format");
  });

  it("Teste 7: campanha sem vínculos ⇒ ok vazio", async () => {
    const probes = makeProbes();
    const result = await listJointPendingOperations(
      makeDeps(baseTables({ [LINKS]: [] }), probes),
    );
    expect(result).toEqual({ kind: "ok", items: [], reasons: [] });
    expect(probes.calls).toEqual([]);
  });

  it("Teste 8: a sonda 1:1 legada não é usada", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-two-format/orchestration/pending-recognition.ts",
      ),
      "utf8",
    );
    const forbidden = [
      ["ProductOneToOne", "ArtifactStore"].join(""),
      ["product_1_1", "campaign_artifacts"].join("_"),
      ["SupabasePending", "OperationsRepository"].join(""),
      ["probe", "Artifact("].join(""),
    ];
    for (const name of forbidden) {
      expect(source).not.toContain(name);
    }
  });

  it("Teste 9: desfecho próprio e compartilhado são preservados separadamente", async () => {
    const probes = makeProbes();
    const unknownControl = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CONTROL_OUTCOMES]: [outcome(OPERATION, "unknown")],
        }),
        probes,
      ),
    );
    expect(unknownControl.kind).toBe("ok");
    if (unknownControl.kind !== "ok") throw new Error("esperava ok");
    expect(unknownControl.items[0].outcomeKind).toBe("none");
    expect(unknownControl.items[0].sharedOutcomeKind).toBe("unknown");
    expect(unknownControl.items[1].outcomeKind).toBe("unknown");

    const failedControl = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CONTROL_OUTCOMES]: [outcome(OPERATION, "failed")],
        }),
        probes,
      ),
    );
    expect(failedControl.kind).toBe("ok");
    if (failedControl.kind !== "ok") throw new Error("esperava ok");
    expect(failedControl.items[0].sharedOutcomeKind).toBe("failed");

    const indeterminate = await listJointPendingOperations(
      makeDeps(baseTables(), probes, { [CONTROL_OUTCOMES]: "boom" }),
    );
    expect(indeterminate.kind).toBe("ok");
    if (indeterminate.kind !== "ok") throw new Error("esperava ok");
    expect(indeterminate.items[0].sharedOutcomeKind).toBe("indeterminate");
    expect(indeterminate.items[0].outcomeKind).toBe("none");
  });

  it("Teste 10: par incompleto/duplicado/identidade incoerente ⇒ linkComplete:false", async () => {
    const probes = makeProbes();
    const duplicate = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [LINKS]: [link("1:1"), link("9:16"), link("9:16")],
        }),
        probes,
      ),
    );
    expect(duplicate.kind).toBe("ok");
    if (duplicate.kind !== "ok") throw new Error("esperava ok");
    expect(duplicate.items.every((item) => item.linkComplete === false)).toBe(true);
    expect(duplicate.reasons.some((reason) => reason.startsWith("pair_incomplete"))).toBe(true);

    const incoherent = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [LINKS]: [
            link("1:1", { delivery_operation_id: OPERATION }),
            link("9:16"),
          ],
        }),
        probes,
      ),
    );
    expect(incoherent.kind).toBe("ok");
    if (incoherent.kind !== "ok") throw new Error("esperava ok");
    expect(incoherent.items.every((item) => item.linkComplete === false)).toBe(true);
  });

  it("Teste 11: ok vazio, read_failed e inconsistência são distintos", async () => {
    const probes = makeProbes();
    const delivered = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CREDIT]: [credit(OPERATION, "delivered"), credit(SQUARE_ID, "delivered")],
        }),
        probes,
      ),
    );
    expect(delivered).toEqual({ kind: "ok", items: [], reasons: [] });

    const readFailed = await listJointPendingOperations(
      makeDeps(baseTables(), probes, { [CREDIT]: "boom" }),
    );
    expect(readFailed).toEqual({
      kind: "read_failed",
      reason: "shared_credit_read_failed:boom",
    });

    const malformed = await listJointPendingOperations(
      makeDeps(
        baseTables({ [LINKS]: [link("9:16", { artifact_role: "square_original" })] }),
        probes,
      ),
    );
    expect(malformed.kind).toBe("inconsistent");
  });

  it("Teste 12: loja divergente/ausente no crédito invalida o par e o guard bloqueia", async () => {
    const probes = makeProbes();
    const mismatch = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CREDIT]: [credit(OPERATION), credit(SQUARE_ID, "reserved", { store_id: "outra" })],
        }),
        probes,
      ),
    );
    expect(mismatch.kind).toBe("ok");
    if (mismatch.kind !== "ok") throw new Error("esperava ok");
    expect(mismatch.items).toHaveLength(2);
    expect(mismatch.items.every((item) => item.linkComplete === false)).toBe(true);
    for (const item of mismatch.items) {
      expect(
        decideJointResolution({
          action: "deliver",
          creditStatus: item.creditStatus,
          outcomeKind: item.outcomeKind,
          sharedOutcomeKind: item.sharedOutcomeKind,
          sharedCreditStatus: item.sharedCreditStatus,
          artifactKind: item.artifactKind,
          activeClaim: item.activeClaim,
          linkComplete: item.linkComplete,
        }),
      ).toEqual({ allowed: false, block: "delivery_link_incomplete" });
    }

    const missingStore = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CREDIT]: [credit(OPERATION), credit(SQUARE_ID, "reserved", { store_id: null })],
        }),
        probes,
      ),
    );
    expect(missingStore.kind).toBe("ok");
    if (missingStore.kind !== "ok") throw new Error("esperava ok");
    expect(missingStore.items.every((item) => item.linkComplete === false)).toBe(true);
  });

  it("Teste 13: linha malformada extra invalida o par mesmo com dois vínculos válidos", async () => {
    const probes = makeProbes();
    const result = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [LINKS]: [link("1:1"), link("9:16"), link("1:1", { format: "4:3" })],
        }),
        probes,
      ),
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("esperava ok");
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.linkComplete === false)).toBe(true);
    expect(
      decideJointResolution({
        action: "deliver",
        creditStatus: result.items[0].creditStatus,
        outcomeKind: result.items[0].outcomeKind,
        sharedOutcomeKind: result.items[0].sharedOutcomeKind,
        sharedCreditStatus: result.items[0].sharedCreditStatus,
        artifactKind: result.items[0].artifactKind,
        activeClaim: result.items[0].activeClaim,
        linkComplete: result.items[0].linkComplete,
      }),
    ).toEqual({ allowed: false, block: "delivery_link_incomplete" });
  });

  it("Teste 14: outcome malformado/duplicado é indeterminado, nunca none", async () => {
    const probes = makeProbes();
    const malformedControl = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CONTROL_OUTCOMES]: [null as unknown as Row],
        }),
        probes,
      ),
    );
    expect(malformedControl.kind).toBe("ok");
    if (malformedControl.kind !== "ok") throw new Error("esperava ok");
    expect(malformedControl.items[0].sharedOutcomeKind).toBe("indeterminate");
    expect(
      decideJointResolution({
        action: "deliver",
        creditStatus: malformedControl.items[0].creditStatus,
        outcomeKind: malformedControl.items[0].outcomeKind,
        sharedOutcomeKind: malformedControl.items[0].sharedOutcomeKind,
        sharedCreditStatus: malformedControl.items[0].sharedCreditStatus,
        artifactKind: "integral",
        activeClaim: false,
        linkComplete: true,
      }),
    ).toEqual({ allowed: false, block: "outcome_indeterminate" });

    const duplicateControl = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CONTROL_OUTCOMES]: [
            outcome(OPERATION, "failed"),
            outcome(OPERATION, "unknown"),
          ],
        }),
        probes,
      ),
    );
    expect(duplicateControl.kind).toBe("ok");
    if (duplicateControl.kind !== "ok") throw new Error("esperava ok");
    expect(duplicateControl.items[0].sharedOutcomeKind).toBe("indeterminate");

    const malformedOwn = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [SQUARE_OUTCOMES]: [null as unknown as Row],
        }),
        probes,
      ),
    );
    expect(malformedOwn.kind).toBe("ok");
    if (malformedOwn.kind !== "ok") throw new Error("esperava ok");
    const square = malformedOwn.items.find((item) => item.format === "1:1");
    expect(square?.outcomeKind).toBe("indeterminate");
  });

  it("Teste 15: claims malformados impedem autorização e não comprovam ausência", async () => {
    const probes = makeProbes();
    const result = await listJointPendingOperations(
      makeDeps(
        baseTables({
          [CLAIMS]: [null as unknown as Row],
        }),
        probes,
      ),
    );
    expect(result.kind).toBe("read_failed");
    expect((result as { reason: string }).reason).toContain("active_claim_read_failed");
  });
});
