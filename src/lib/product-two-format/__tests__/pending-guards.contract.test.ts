// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  decideJointResolution,
  type JointResolutionInput,
} from "../orchestration/pending-guards";

function input(
  overrides: Partial<JointResolutionInput> = {},
): JointResolutionInput {
  return {
    action: "deliver",
    creditStatus: "reserved",
    outcomeKind: "none",
    sharedOutcomeKind: "none",
    sharedCreditStatus: "reserved",
    artifactKind: "integral",
    activeClaim: false,
    linkComplete: true,
    ...overrides,
  };
}

describe("F60.7-08 — decisão pura de resolução conjunta (fail-closed)", () => {
  it("Teste 1: deliver com crédito reservado, arte íntegra e par completo ⇒ allowed", () => {
    expect(decideJointResolution(input())).toEqual({
      allowed: true,
      action: "deliver",
    });
  });

  it("Teste 2: deliver sem arte íntegra ⇒ insufficient_evidence", () => {
    for (const artifactKind of ["absent", "indeterminate", "invalid"] as const) {
      expect(decideJointResolution(input({ artifactKind }))).toEqual({
        allowed: false,
        block: "insufficient_evidence",
      });
    }
  });

  it("Teste 3: refund com ausência comprovada e finalidade compartilhada ⇒ allowed", () => {
    expect(
      decideJointResolution(
        input({
          action: "refund",
          artifactKind: "absent",
          outcomeKind: "failed",
          sharedOutcomeKind: "failed",
        }),
      ),
    ).toEqual({ allowed: true, action: "refund" });
  });

  it("Teste 4: refund com arte íntegra ⇒ artifact_present", () => {
    expect(
      decideJointResolution(
        input({
          action: "refund",
          artifactKind: "integral",
          sharedOutcomeKind: "failed",
        }),
      ),
    ).toEqual({ allowed: false, block: "artifact_present" });
  });

  it("Teste 5: refund com evidência indeterminada/inválida nunca estorna", () => {
    expect(
      decideJointResolution(
        input({
          action: "refund",
          artifactKind: "indeterminate",
          sharedOutcomeKind: "failed",
        }),
      ),
    ).toEqual({ allowed: false, block: "insufficient_evidence" });
    expect(
      decideJointResolution(
        input({
          action: "refund",
          artifactKind: "invalid",
          sharedOutcomeKind: "failed",
        }),
      ),
    ).toEqual({ allowed: false, block: "invalid_evidence" });
  });

  it("Teste 6: claim ativo bloqueia antes de vínculo/evidência", () => {
    for (const action of ["deliver", "refund"] as const) {
      expect(
        decideJointResolution(
          input({
            action,
            activeClaim: true,
            linkComplete: false,
            artifactKind: "invalid",
          }),
        ),
      ).toEqual({ allowed: false, block: "operation_in_progress" });
    }
  });

  it("Teste 7: refund de crédito entregue ⇒ delivered_not_refundable", () => {
    expect(
      decideJointResolution(
        input({ action: "refund", creditStatus: "delivered" }),
      ),
    ).toEqual({ allowed: false, block: "delivered_not_refundable" });
  });

  it("Teste 8: deliver com crédito estornado ⇒ terminal; refund ⇒ replay", () => {
    expect(decideJointResolution(input({ creditStatus: "refunded" }))).toEqual({
      allowed: false,
      block: "operation_terminal",
    });
    expect(
      decideJointResolution(
        input({ action: "refund", creditStatus: "refunded" }),
      ),
    ).toEqual({ allowed: true, action: "refund" });
  });

  it("Teste 9: deliver de crédito já entregue ⇒ already_delivered", () => {
    expect(
      decideJointResolution(input({ creditStatus: "delivered" })),
    ).toEqual({ allowed: false, block: "already_delivered" });
  });

  it("Teste 10: par incompleto bloqueia qualquer ação", () => {
    for (const action of ["deliver", "refund"] as const) {
      expect(
        decideJointResolution(input({ action, linkComplete: false })),
      ).toEqual({ allowed: false, block: "delivery_link_incomplete" });
    }
  });

  it("Teste 11: ação inválida e módulo puro", () => {
    const invalid = {
      ...input(),
      action: "publish",
    } as unknown as JointResolutionInput;
    expect(decideJointResolution(invalid)).toEqual({
      allowed: false,
      block: "invalid_action",
    });

    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/product-two-format/orchestration/pending-guards.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/server-only/);
    expect(source).not.toMatch(/@\/lib\/supabase/);
    expect(source).not.toMatch(/\.rpc\(/);
    expect(source).not.toMatch(/fetch\(/);
  });

  it("Teste 12: matriz de precedência", () => {
    expect(
      decideJointResolution(
        input({
          activeClaim: true,
          linkComplete: false,
          artifactKind: "invalid",
        }),
      ),
    ).toEqual({ allowed: false, block: "operation_in_progress" });
    expect(
      decideJointResolution(
        input({ linkComplete: false, artifactKind: "invalid" }),
      ),
    ).toEqual({ allowed: false, block: "delivery_link_incomplete" });
    expect(
      decideJointResolution(
        input({
          action: "refund",
          creditStatus: "delivered",
          artifactKind: "invalid",
        }),
      ),
    ).toEqual({ allowed: false, block: "delivered_not_refundable" });
  });

  it("Teste 13: outcome próprio governa o refund; failed é finalidade", () => {
    expect(
      decideJointResolution(
        input({
          action: "refund",
          outcomeKind: "unknown",
          artifactKind: "absent",
          sharedOutcomeKind: "failed",
        }),
      ),
    ).toEqual({ allowed: false, block: "unknown_outcome" });
    expect(
      decideJointResolution(
        input({
          action: "refund",
          outcomeKind: "failed",
          artifactKind: "absent",
          sharedOutcomeKind: "failed",
        }),
      ),
    ).toEqual({ allowed: true, action: "refund" });
  });

  it("Teste 14: outcome próprio bloqueia deliver", () => {
    expect(
      decideJointResolution(input({ outcomeKind: "unknown" })),
    ).toEqual({ allowed: false, block: "unknown_outcome" });
    expect(decideJointResolution(input({ outcomeKind: "failed" }))).toEqual({
      allowed: false,
      block: "outcome_failed",
    });
    expect(
      decideJointResolution(input({ outcomeKind: "indeterminate" })),
    ).toEqual({ allowed: false, block: "outcome_indeterminate" });
  });

  it("Teste 15: precedência por ação", () => {
    expect(
      decideJointResolution(
        input({ creditStatus: "refunded", artifactKind: "integral" }),
      ),
    ).toEqual({ allowed: false, block: "operation_terminal" });
    expect(
      decideJointResolution(
        input({
          action: "refund",
          creditStatus: "delivered",
          outcomeKind: "unknown",
        }),
      ),
    ).toEqual({ allowed: false, block: "delivered_not_refundable" });
    expect(
      decideJointResolution(
        input({
          action: "refund",
          creditStatus: "refunded",
          artifactKind: "integral",
        }),
      ),
    ).toEqual({ allowed: true, action: "refund" });
  });

  it("Teste 16: compartilhado não terminal com unknown bloqueia mesmo com próprio none", () => {
    for (const action of ["deliver", "refund"] as const) {
      expect(
        decideJointResolution(
          input({
            action,
            sharedOutcomeKind: "unknown",
            artifactKind: action === "deliver" ? "integral" : "absent",
          }),
        ),
      ).toEqual({ allowed: false, block: "unknown_outcome" });
    }
  });

  it("Teste 17: compartilhado failed não terminal bloqueia deliver e dá finalidade", () => {
    expect(
      decideJointResolution(input({ sharedOutcomeKind: "failed" })),
    ).toEqual({ allowed: false, block: "outcome_failed" });
    expect(
      decideJointResolution(
        input({
          action: "refund",
          sharedOutcomeKind: "failed",
          artifactKind: "absent",
        }),
      ),
    ).toEqual({ allowed: true, action: "refund" });
  });

  it("Teste 18: compartilhado indeterminado não terminal bloqueia ambos", () => {
    for (const action of ["deliver", "refund"] as const) {
      expect(
        decideJointResolution(
          input({
            action,
            sharedOutcomeKind: "indeterminate",
            artifactKind: action === "deliver" ? "integral" : "absent",
          }),
        ),
      ).toEqual({ allowed: false, block: "outcome_indeterminate" });
    }
  });

  it("Teste 19: replay de estorno e ausência de finalidade", () => {
    for (const artifactKind of ["integral", "indeterminate", "invalid"] as const) {
      expect(
        decideJointResolution(
          input({
            action: "refund",
            creditStatus: "refunded",
            artifactKind,
          }),
        ),
      ).toEqual({ allowed: true, action: "refund" });
    }

    for (const sharedCreditStatus of ["reserved", "art_uploaded", "delivered"] as const) {
      expect(
        decideJointResolution(
          input({
            action: "refund",
            sharedCreditStatus,
            sharedOutcomeKind: "none",
            artifactKind: "absent",
          }),
        ),
      ).toEqual({ allowed: false, block: "shared_operation_not_final" });
    }

    for (const sharedCreditStatus of ["reserved", "delivered", "refunded"] as const) {
      expect(
        decideJointResolution(
          input({
            action: "refund",
            sharedCreditStatus,
            sharedOutcomeKind: "failed",
            artifactKind: "absent",
          }),
        ),
      ).toEqual({ allowed: true, action: "refund" });
    }
  });

  it("Teste 20: compartilhado delivered prevalece sobre o histórico failed", () => {
    expect(
      decideJointResolution(
        input({
          sharedCreditStatus: "delivered",
          sharedOutcomeKind: "failed",
          artifactKind: "integral",
        }),
      ),
    ).toEqual({ allowed: true, action: "deliver" });
  });

  it("Teste 21: compartilhado reservado + unknown bloqueia com arte ausente", () => {
    expect(
      decideJointResolution(
        input({
          action: "refund",
          sharedOutcomeKind: "unknown",
          artifactKind: "absent",
        }),
      ),
    ).toEqual({ allowed: false, block: "unknown_outcome" });
  });

  it("Teste 22: compartilhado estornado não apaga outcome próprio unknown", () => {
    expect(
      decideJointResolution(
        input({
          action: "refund",
          sharedCreditStatus: "refunded",
          sharedOutcomeKind: "failed",
          outcomeKind: "unknown",
          artifactKind: "absent",
        }),
      ),
    ).toEqual({ allowed: false, block: "unknown_outcome" });
  });
});
