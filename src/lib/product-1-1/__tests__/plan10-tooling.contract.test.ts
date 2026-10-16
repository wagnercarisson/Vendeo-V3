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
  storeId: "store",
  status: "refunded",
  outcome: "failed",
  outcomeOperationId: "op",
  creditTxId: "ct",
  creditTxExists: true,
  creditTxStoreId: "store",
  refundTxId: "rt",
  refundTxExists: true,
  refundTxStoreId: "store",
  refundTxType: "refund",
  evidenceDirection: "original",
  expectedDirection: "original" as const,
  snapshotHasNewFlowMarker: true,
  snapshotIsRestorable: true,
  expectedRestorable: true,
};

describe("F56.2b2b — Plano 10: TOOLING (runner / fixture)", () => {
  it("runner usa `npx --no-install vitest run` (sem resolução/download em runtime)", () => {
    expect(activeRunner).toMatch(/npx --no-install vitest run \$suite/);
    expect(activeRunner).not.toMatch(/npx vitest run \$suite/);
  });

  it("o script coleta LEDGER/LOJA/SNAPSHOT e usa o VALIDADOR puro (aborta em parcial)", () => {
    expect(fixture).toMatch(/validateFixturePostconditions/);
    expect(fixture).toMatch(/fixture_partial_state/);
    expect(fixture).toMatch(/credit_transactions/);
    expect(fixture).toMatch(/isNewFlowCampaign/);
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

  it("RECUSA referência inexistente/divergente, efeito incompatível e snapshot incompleto", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      // Terminal / mesma operação.
      [{ status: "reserved" }, "status=reserved"],
      [{ outcome: "unknown" }, "outcome=unknown"],
      [{ outcomeOperationId: "other" }, "outcome_operation_mismatch"],
      // Ledger da reserva: existe e é da MESMA loja.
      [{ creditTxId: null }, "credit_tx_mismatch"],
      [{ creditTxExists: false }, "credit_tx_mismatch"],
      [{ creditTxStoreId: "other-store" }, "credit_tx_mismatch"],
      // Ledger do estorno: existe, MESMA loja e tipo `refund`.
      [{ refundTxId: null }, "refund_tx_mismatch"],
      [{ refundTxExists: false }, "refund_tx_mismatch"],
      [{ refundTxStoreId: "other-store" }, "refund_tx_mismatch"],
      [{ refundTxType: "deduction" }, "refund_tx_mismatch"],
      // Snapshot esperado do cenário.
      [{ snapshotHasNewFlowMarker: false }, "snapshot_marker_missing"],
      [{ snapshotIsRestorable: false }, "snapshot_restorable=false"],
      // Evidência congelada.
      [{ evidenceDirection: "ambient" }, "direction=ambient"],
      [{ evidenceDirection: "studio", expectedDirection: null }, "unexpected_evidence=studio"],
    ];
    for (const [override, reason] of cases) {
      const result = validateFixturePostconditions({ ...COMPLETE, ...override } as never);
      expect(result.ok, JSON.stringify(override)).toBe(false);
      expect(result.reason, JSON.stringify(override)).toBe(reason);
    }
  });
});
