// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { validateFixturePostconditions } from "../../../../scripts/f56-2b2b/fixture-postconditions";

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");
const runner = read("scripts/run-f56-2b2b-isolated-integration.ps1");
const activeRunner = runner
  .split(/\r?\n/)
  .filter((l) => !l.trimStart().startsWith("#"))
  .join("\n");
const fixture = read("scripts/f56-2b2b/prepare-visual-uat.ts");

const COMPLETE = {
  key: "refunded-original",
  campaignId: "c",
  operationId: "op",
  status: "refunded",
  creditTxId: "tx",
  refundTxId: "rf",
  outcome: "failed",
  outcomeOperationId: "op",
  evidenceDirection: "original",
  expectedDirection: "original" as const,
};

describe("F56.2b2b — Plano 10: TOOLING (runner / fixture)", () => {
  it("runner usa `npx --no-install vitest run` (sem resolução/download em runtime)", () => {
    expect(activeRunner).toMatch(/npx --no-install vitest run \$suite/);
    expect(activeRunner).not.toMatch(/npx vitest run \$suite/);
  });

  it("o script usa o VALIDADOR puro e ABORTA em estado parcial (nunca valida por nome)", () => {
    expect(fixture).toMatch(/validateFixturePostconditions/);
    expect(fixture).toMatch(/fixture_partial_state/);
    expect(fixture).toMatch(/expectedDirection: fixture\.direction/);
  });
});

describe("F56.2b2b — Plano 10: validador de pós-condições (comportamental)", () => {
  it("fixture COMPLETA ⇒ ok", () => {
    expect(validateFixturePostconditions(COMPLETE)).toEqual({ ok: true });
  });

  it("cenário SEM evidência esperada e SEM evidência ⇒ ok", () => {
    expect(
      validateFixturePostconditions({
        ...COMPLETE,
        evidenceDirection: null,
        expectedDirection: null,
      }),
    ).toEqual({ ok: true });
  });

  it("rejeita cada desvio de pós-condição", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ status: "reserved" }, "status=reserved"],
      [{ outcome: "unknown" }, "outcome=unknown"],
      [{ outcomeOperationId: "other" }, "outcome_operation_mismatch"],
      [{ creditTxId: null }, "missing_credit_tx"],
      [{ refundTxId: null }, "missing_refund_tx"],
      [{ evidenceDirection: "ambient" }, "direction=ambient"],
      [{ evidenceDirection: "studio", expectedDirection: null }, "unexpected_evidence=studio"],
    ];
    for (const [override, reason] of cases) {
      const result = validateFixturePostconditions({ ...COMPLETE, ...override } as never);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(reason);
    }
  });
});
