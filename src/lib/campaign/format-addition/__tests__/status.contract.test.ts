// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { runFormatAdditionOpening } from "../orchestration/run-addition";
import { statusForRun } from "../status";
import type {
  FormatAdditionOpeningDeps,
  FormatAdditionRunResult,
  OpenFormatAdditionInput,
  OpenFormatAdditionResult,
} from "../orchestration/types";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const REQUEST = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";

const INPUT: OpenFormatAdditionInput = {
  storeId: STORE,
  campaignId: CAMPAIGN,
  operationId: OPERATION,
  requestId: REQUEST,
  sourceOrigin: "new_flow_1_1",
  authorization: { kind: "system" },
  selection: {} as never,
  confirmedSourceChecksumSha256: "a".repeat(64),
};

function depsFor(
  gate:
    | { readonly allowed: true }
    | { readonly allowed: false; readonly code: string; readonly reason: string },
): FormatAdditionOpeningDeps {
  return {
    readLink: async () => ({ kind: "absent" }),
    readLinkByRequest: async () => ({ kind: "absent" }),
    checkOpeningGate: async () => gate,
    registerSource: async () => ({
      ok: false as const,
      reason: "bridge_provenance_conflict",
    }),
    captureFrozenEconomics: async () => ({
      ok: false as const,
      reason: "not_used",
    }),
    openAddition: async () => ({ success: false as const, reason: "not_used" }),
  } as unknown as FormatAdditionOpeningDeps;
}

async function statusFor(
  gate:
    | { readonly allowed: true }
    | { readonly allowed: false; readonly code: string; readonly reason: string },
): Promise<number> {
  const result: OpenFormatAdditionResult = await runFormatAdditionOpening(
    INPUT,
    depsFor(gate),
  );
  return statusForRun(result as FormatAdditionRunResult);
}

describe("F62-08 — status HTTP dos códigos reais do opening gate", () => {
  it("saldo insuficiente → 402, nunca 409 genérico", async () => {
    await expect(
      statusFor({
        allowed: false,
        code: "insufficient_credits",
        reason: "balance_below_one",
      }),
    ).resolves.toBe(402);
  });

  it("rate limit → 429", async () => {
    await expect(
      statusFor({
        allowed: false,
        code: "rate_limit_exceeded",
        reason: "1 hour",
      }),
    ).resolves.toBe(429);
  });

  it("autorização negada → 403", async () => {
    await expect(
      statusFor({
        allowed: false,
        code: "stage_not_enabling",
        reason: "stage_not_enabling",
      }),
    ).resolves.toBe(403);
    await expect(
      statusFor({
        allowed: false,
        code: "revoked",
        reason: "revoked",
      }),
    ).resolves.toBe(403);
  });

  it("autorização indisponível/leitura incerta → 503", async () => {
    await expect(
      statusFor({
        allowed: false,
        code: "authorization_unavailable",
        reason: "authorization_resolver_not_configured",
      }),
    ).resolves.toBe(503);
    await expect(
      statusFor({
        allowed: false,
        code: "gate_read_failed",
        reason: "opening_gate_unavailable",
      }),
    ).resolves.toBe(503);
  });

  it("conflito real da ponte continua 409 com código seguro", async () => {
    await expect(statusFor({ allowed: true })).resolves.toBe(409);
  });

  it("envelope legado gate_blocked mantém saldo/rate limit", () => {
    expect(
      statusForRun({
        ok: false,
        code: "gate_blocked",
        reason: "insufficient_credits",
      }),
    ).toBe(402);
    expect(
      statusForRun({
        ok: false,
        code: "gate_blocked",
        reason: "rate_limit_exceeded",
      }),
    ).toBe(429);
  });
});
