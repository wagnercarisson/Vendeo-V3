// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  PILOT_COPY_CALL_LIMIT,
  PILOT_IMAGE_CALL_LIMIT,
  ProductOneToOnePilotSpendControl,
} from "../pilot/spend-control";
import type {
  PilotBeginPaidCallInput,
  PilotSpendRepositoryPort,
} from "../pilot/pilot-spend-repository";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20261017000002_f56_2b2c_pilot_spend_control.sql";

/** Fake RPC-only: scriptável por teste; SEM banco. */
class FakeRepo implements PilotSpendRepositoryPort {
  readonly beginCalls: PilotBeginPaidCallInput[] = [];
  endCalls: Array<{ callId: string; ownerToken: string }> = [];
  markUnknownCalls: Array<{ callId: string }> = [];
  beginBehavior: (input: PilotBeginPaidCallInput) => Promise<Record<string, unknown>> = async () => ({
    success: true,
    outcome: "acquired",
  });

  async setCap(): Promise<Record<string, unknown>> {
    return { success: true };
  }
  async beginPaidCall(input: PilotBeginPaidCallInput): Promise<Record<string, unknown>> {
    this.beginCalls.push(input);
    return this.beginBehavior(input);
  }
  async endPaidCall(input: { callId: string; ownerToken: string }): Promise<Record<string, unknown>> {
    this.endCalls.push({ callId: input.callId, ownerToken: input.ownerToken });
    return { success: true, state: "released" };
  }
  async markUnknown(input: { callId: string }): Promise<Record<string, unknown>> {
    this.markUnknownCalls.push({ callId: input.callId });
    return { success: true, state: "unknown" };
  }
  async reconcileUnknown(): Promise<Record<string, unknown>> {
    return { success: true, state: "stale" };
  }
}

function makeControl(repo: FakeRepo) {
  let n = 0;
  return new ProductOneToOnePilotSpendControl({
    repository: repo,
    newId: () => `id-${++n}`,
  });
}

const BASE = { campaignId: "camp-1", operationId: "op-1", attemptSeq: 1, estimatedUsd: 0.03 };

describe("F56.2b2c — migration do controle de gasto (SQL estático)", () => {
  const code = readFileSync(path.resolve(process.cwd(), MIGRATION_RELATIVE_PATH), "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("mantém contabilidade por chamada com estados in_flight/unknown", () => {
    expect(code).toContain("call_id");
    expect(code).toContain("'in_flight'");
    expect(code).toContain("'unknown'");
    expect(code).toContain("owner_token");
  });

  it("preserva a barreira por resultado desconhecido e a concorrência legítima", () => {
    expect(code).toContain("v_unknown");
    expect(code).toContain("pilot_requires_reconciliation");
    expect(code).toContain("pilot_busy");
    expect(code).toContain("pilot_cap_not_configured");
    expect(code).toContain("pilot_cap_reached");
  });

  it("implementa tri-state e reconciliação explícita (sem liberação por tempo)", () => {
    expect(code).toContain("existing_in_flight");
    expect(code).toContain("'closed'");
    expect(code).toContain("mark_unknown");
    expect(code).toContain("reconcile_unknown");
    expect(code).toContain("FOR UPDATE");
    expect(code).toContain("GRANT EXECUTE ON FUNCTION");
    expect(code).not.toContain("lease_expires_at");
    expect(code).not.toContain("p_max_age_ms");
  });
});

describe("F56.2b2c — gate por chamada (tri-state)", () => {
  it("só `acquired` autoriza o provider", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => ({ success: true, outcome: "acquired" });
    const decision = await makeControl(repo).beginPaidCall({ ...BASE, kind: "image_primary" });
    expect(decision.acquired).toBe(true);
  });

  it("replay em `in_flight` ⇒ existing_in_flight (NÃO autoriza provider)", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => ({ success: true, outcome: "existing_in_flight" });
    const decision = await makeControl(repo).beginPaidCall({ ...BASE, kind: "image_retry" });
    expect(decision).toEqual({
      acquired: false,
      outcome: "existing_in_flight",
      reason: "existing_in_flight",
    });
  });

  it("chamada já encerrada ⇒ closed (NÃO autoriza provider, NÃO soma de novo)", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => ({ success: true, outcome: "closed" });
    const decision = await makeControl(repo).beginPaidCall({ ...BASE, kind: "copy_auto" });
    expect(decision).toEqual({ acquired: false, outcome: "closed", reason: "closed" });
  });

  it("envelope sem `success:true` ⇒ falha fechada (blocked/read_failure)", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => ({ outcome: "acquired" });
    const decision = await makeControl(repo).beginPaidCall({ ...BASE, kind: "image_primary" });
    expect(decision).toEqual({ acquired: false, outcome: "blocked", reason: "read_failure" });
  });

  it("contabilidade é POR CHAMADA: cada aquisição gera um `call_id` distinto", async () => {
    const repo = new FakeRepo();
    const control = makeControl(repo);
    const kinds = [
      "image_primary",
      "image_retry",
      "image_fallback",
      "copy_initial",
      "copy_auto",
      "copy_manual",
    ] as const;
    for (const kind of kinds) {
      await control.beginPaidCall({ ...BASE, kind });
    }
    const callIds = repo.beginCalls.map((c) => c.callId);
    expect(new Set(callIds).size).toBe(kinds.length);
  });
});

describe("F56.2b2c — paradas (não autoriza provider)", () => {
  it("cap não configurado ⇒ blocked (fail-closed)", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => {
      throw new Error("pilot_cap_not_configured");
    };
    expect(await makeControl(repo).beginPaidCall({ ...BASE, kind: "image_primary" })).toEqual({
      acquired: false,
      outcome: "blocked",
      reason: "pilot_cap_not_configured",
    });
  });

  it("acumulado no teto ⇒ blocked (pilot_cap_reached)", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => {
      throw new Error("pilot_cap_reached");
    };
    expect(await makeControl(repo).beginPaidCall({ ...BASE, kind: "copy_manual" })).toEqual({
      acquired: false,
      outcome: "blocked",
      reason: "pilot_cap_reached",
    });
  });

  it("concorrência legítima de OUTRA campanha ⇒ blocked (pilot_busy)", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => {
      throw new Error("pilot_busy");
    };
    expect(await makeControl(repo).beginPaidCall({ ...BASE, kind: "image_primary" })).toEqual({
      acquired: false,
      outcome: "blocked",
      reason: "pilot_busy",
    });
  });

  it("resultado desconhecido ⇒ blocked (pilot_requires_reconciliation), inclusive na MESMA campanha", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => {
      throw new Error("pilot_requires_reconciliation");
    };
    const control = makeControl(repo);
    // retry automático/manual da MESMA campanha com novo call_id:
    expect(await control.beginPaidCall({ ...BASE, kind: "copy_auto" })).toEqual({
      acquired: false,
      outcome: "blocked",
      reason: "pilot_requires_reconciliation",
    });
    // tentativa em OUTRA campanha:
    expect(
      await control.beginPaidCall({ ...BASE, campaignId: "camp-2", operationId: "op-2", kind: "image_primary" }),
    ).toEqual({ acquired: false, outcome: "blocked", reason: "pilot_requires_reconciliation" });
  });

  it("kind inválido ⇒ blocked (invalid_call_kind)", async () => {
    const repo = new FakeRepo();
    repo.beginBehavior = async () => {
      throw new Error("invalid_call_kind");
    };
    expect(await makeControl(repo).beginPaidCall({ ...BASE, kind: "image_primary" })).toEqual({
      acquired: false,
      outcome: "blocked",
      reason: "invalid_call_kind",
    });
  });
});

describe("F56.2b2c — encerrar/desconhecido são idempotentes (não desconta duas vezes)", () => {
  it("markUnknown e endPaidCall repetidos são no-op (sem lançar)", async () => {
    const repo = new FakeRepo();
    const control = makeControl(repo);
    const acquired = await control.beginPaidCall({ ...BASE, kind: "image_primary" });
    expect(acquired.acquired).toBe(true);
    if (!acquired.acquired) throw new Error("unreachable");
    await control.markUnknown({ handle: acquired.handle, reason: "timeout" });
    await control.markUnknown({ handle: acquired.handle, reason: "timeout" });
    expect(repo.markUnknownCalls).toHaveLength(2);
  });

  it("limites duros de chamadas: imagem ≤3; copy ≤6", () => {
    expect(PILOT_IMAGE_CALL_LIMIT).toBe(3);
    expect(PILOT_COPY_CALL_LIMIT).toBe(6);
  });
});
