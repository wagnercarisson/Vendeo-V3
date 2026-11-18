// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { TwoFormatFormatView } from "../read-model";

import {
  classifyJointFormat,
  needsSquareArtifact,
  planJointResume,
  type JointArtifactObservation,
  type JointFormatResumeState,
  type JointResumePlan,
} from "../orchestration/classify-joint-resume";

function view(
  overrides: Partial<TwoFormatFormatView> = {},
): TwoFormatFormatView {
  return {
    format: "1:1",
    state: "processing",
    creditRefunded: false,
    deliveryOperationId: "44444444-4444-4444-8444-444444444444",
    artifactRole: "square_original",
    artifactPath: null,
    supportReference: null,
    ...overrides,
  };
}

const STATES: readonly JointFormatResumeState[] = [
  "delivered",
  "reserved",
  "refunded",
  "unknown",
  "unavailable",
];

const ARTIFACTS: readonly JointArtifactObservation[] = [
  "integral",
  "absent",
  "invalid",
  "indeterminate",
];

function plan(
  square: JointFormatResumeState,
  vertical: JointFormatResumeState,
  squareArtifact: JointArtifactObservation = "indeterminate",
): JointResumePlan {
  return planJointResume({ square, vertical, squareArtifact });
}

describe("F60.7-07 — classificação pura e plano de continuação (D13)", () => {
  it("Teste 1: mapeia cada estado do read model", () => {
    expect(classifyJointFormat(view({ state: "delivered" }))).toBe("delivered");
    expect(classifyJointFormat(view({ state: "processing" }))).toBe("reserved");
    expect(
      classifyJointFormat(view({ state: "absent", creditRefunded: true })),
    ).toBe("refunded");
    expect(classifyJointFormat(view({ state: "unknown" }))).toBe("unknown");
    expect(classifyJointFormat(view({ state: "unavailable" }))).toBe(
      "unavailable",
    );
  });

  it("Teste 2: `absent` sem crédito devolvido é indeterminado, nunca refunded", () => {
    expect(
      classifyJointFormat(view({ state: "absent", creditRefunded: false })),
    ).toBe("unknown");
  });

  it("Teste 3: quadrado entregue + vertical reservado ⇒ run_vertical_only", () => {
    expect(plan("delivered", "reserved")).toEqual({
      action: "run_vertical_only",
    });
  });

  it("Teste 4: quadrado entregue + vertical estornado ⇒ partial_terminal", () => {
    expect(plan("delivered", "refunded")).toEqual({
      action: "partial_terminal",
      reason: "vertical_refunded",
    });
  });

  it("Teste 5: quadrado reservado + artefato íntegro ⇒ settle_square", () => {
    expect(plan("reserved", "reserved", "integral")).toEqual({
      action: "settle_square",
    });
  });

  it("Teste 6: quadrado reservado + ausência comprovada + vertical reservado ⇒ run_base", () => {
    expect(plan("reserved", "reserved", "absent")).toEqual({
      action: "run_base",
    });
  });

  it("Teste 6b: artefato inválido/indeterminado nunca autoriza run_base", () => {
    expect(plan("reserved", "reserved", "invalid")).toEqual({
      action: "fail_closed",
      reason: "artifact_invalid",
    });
    expect(plan("reserved", "reserved", "indeterminate")).toEqual({
      action: "fail_closed",
      reason: "artifact_indeterminate",
    });
  });

  it("Teste 7: vertical entregue + quadrado reservado depende do artefato", () => {
    expect(plan("reserved", "delivered", "integral")).toEqual({
      action: "settle_square",
    });
    expect(plan("reserved", "delivered", "absent")).toEqual({
      action: "fail_closed",
      reason: "base_missing",
    });
    expect(plan("reserved", "delivered", "invalid")).toEqual({
      action: "fail_closed",
      reason: "artifact_invalid",
    });
    expect(plan("reserved", "delivered", "indeterminate")).toEqual({
      action: "fail_closed",
      reason: "artifact_indeterminate",
    });
  });

  it("Teste 8: ambos entregues ⇒ repair_only", () => {
    expect(plan("delivered", "delivered")).toEqual({ action: "repair_only" });
  });

  it("Teste 9: unknown/unavailable têm precedência sobre terminais", () => {
    expect(plan("unknown", "refunded")).toEqual({ action: "blocked_unknown" });
    expect(plan("refunded", "unknown")).toEqual({ action: "blocked_unknown" });
    expect(plan("unavailable", "refunded")).toEqual({
      action: "blocked_partial_read",
    });
    expect(plan("delivered", "unavailable")).toEqual({
      action: "blocked_partial_read",
    });
  });

  it("Teste 10: estornado + entregue é terminal; estornado + reservado é pendência", () => {
    expect(plan("refunded", "delivered")).toEqual({
      action: "partial_terminal",
      reason: "square_refunded",
    });
    expect(plan("refunded", "refunded")).toEqual({ action: "terminal_error" });
    expect(plan("refunded", "reserved")).toEqual({
      action: "pending_finalization",
      refunded: "1:1",
    });
    expect(plan("delivered", "refunded")).toEqual({
      action: "partial_terminal",
      reason: "vertical_refunded",
    });
    expect(plan("reserved", "refunded")).toEqual({
      action: "pending_finalization",
      refunded: "9:16",
    });
  });

  it("Teste 11: o plano é total e o módulo é puro", () => {
    const actions = new Set<string>();
    for (const square of STATES) {
      for (const vertical of STATES) {
        for (const squareArtifact of ARTIFACTS) {
          const result = planJointResume({ square, vertical, squareArtifact });
          actions.add(result.action);
        }
      }
    }
    expect([...actions].sort()).toEqual([
      "blocked_partial_read",
      "blocked_unknown",
      "fail_closed",
      "partial_terminal",
      "pending_finalization",
      "repair_only",
      "run_base",
      "run_vertical_only",
      "settle_square",
      "terminal_error",
    ]);

    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-two-format/orchestration/classify-joint-resume.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/server-only/);
    expect(source).not.toMatch(/@\/lib\/supabase/);
    expect(source).not.toMatch(/\.rpc\(/);
  });

  it("Teste 12: nenhuma ação gasta/estorna — conjunto fechado e enumerado", () => {
    for (const square of STATES) {
      for (const vertical of STATES) {
        for (const squareArtifact of ARTIFACTS) {
          const result = planJointResume({ square, vertical, squareArtifact });
          expect(result.action).not.toMatch(/provider|refund|reserve|upload/);
        }
      }
    }
  });

  it("Teste 13: needsSquareArtifact só para quadrado reservado com vertical reservado/entregue", () => {
    expect(
      needsSquareArtifact({ square: "reserved", vertical: "reserved" }),
    ).toBe(true);
    expect(
      needsSquareArtifact({ square: "reserved", vertical: "delivered" }),
    ).toBe(true);
    for (const vertical of ["unknown", "unavailable", "refunded"] as const) {
      expect(needsSquareArtifact({ square: "reserved", vertical })).toBe(false);
    }
    expect(
      needsSquareArtifact({ square: "delivered", vertical: "reserved" }),
    ).toBe(false);
    expect(
      needsSquareArtifact({ square: "delivered", vertical: "delivered" }),
    ).toBe(false);
  });
});
