import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";
import { getLaunchConfig } from "@/lib/launch-config/config";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const rpcCalls: unknown[][] = [];
const fromCalls: unknown[][] = [];
const mockRpc = vi.fn<
  (...args: unknown[]) => Promise<{ data: unknown; error: { message: string } | null }>
>((..._args: unknown[]) => Promise.resolve({ data: null, error: null }));
const mockFrom = vi.fn((..._args: unknown[]) => {
  throw new Error("from() não deveria ser chamado na ativação");
});
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => {
      rpcCalls.push(args);
      return mockRpc(...args);
    },
    from: (...args: unknown[]) => {
      fromCalls.push(args);
      return mockFrom(...args);
    },
  },
}));

const MONTHLY_FIELDS = [
  "monthlyCreditsEnabled",
  "monthlyCreditsAmount",
  "monthlyBonusCap",
  "monthlyCreditsMinStoreAgeDays",
] as const;

const MONTHLY_ENV_KEYS = [
  "VENDEO_MONTHLY_CREDITS_ENABLED",
  "VENDEO_MONTHLY_CREDITS_AMOUNT",
  "VENDEO_MONTHLY_BONUS_CAP",
  "VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS",
] as const;

function monthlySnapshot() {
  const config = getLaunchConfig();
  const monthly = Object.fromEntries(
    MONTHLY_FIELDS.map((field) => [field, config[field]]),
  );
  const env = Object.fromEntries(
    MONTHLY_ENV_KEYS.map((key) => [key, process.env[key] ?? null]),
  );
  return { monthly, env };
}

function request(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new NextRequest(
    new Request("http://localhost/api/admin/trial-offer/activate", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        host: "localhost",
        ...headers,
      },
    }),
  );
}

async function post(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const { POST } = await import("../route");
  return POST(request(body, headers));
}

function assertNoSideEffects() {
  expect(mockFrom).not.toHaveBeenCalled();
  expect(fromCalls).toHaveLength(0);
  expect(rpcCalls).toHaveLength(1);
  expect(rpcCalls[0][0]).toBe(
    "admin_activate_trial_offer_individual_launch",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  rpcCalls.length = 0;
  fromCalls.length = 0;
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("F50.4 admin trial offer activate route", () => {
  it("ativa com motivo, ator e operation_id e devolve o marco", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        idempotent: false,
        individual_launch_at: "2026-10-22T12:00:00.000Z",
        cohort_state: "active",
      },
      error: null,
    });

    const response = await post({
      reason: "Ativar coorte F50.4 no descartável",
      operationId: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_activate_trial_offer_individual_launch",
      {
        p_actor_id: "admin-1",
        p_reason: "Ativar coorte F50.4 no descartável",
        p_operation_id: "11111111-1111-4111-8111-111111111111",
      },
    );
    expect(await response.json()).toEqual({
      success: true,
      idempotent: false,
      individualLaunchAt: "2026-10-22T12:00:00.000Z",
      cohortState: "active",
    });
    assertNoSideEffects();
  });

  it("replay idempotente devolve idempotent true sem nova gravação", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        idempotent: true,
        individual_launch_at: "2026-10-22T12:00:00.000Z",
        cohort_state: "active",
      },
      error: null,
    });

    const response = await post({
      reason: "Ativar coorte F50.4",
      operationId: "22222222-2222-4222-8222-222222222222",
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.idempotent).toBe(true);
    expect(body.cohortState).toBe("active");
    assertNoSideEffects();
  });

  it("recusa não-admin (requireAdmin) sem chamar a RPC", async () => {
    mockRequireAdmin.mockRejectedValueOnce(
      new ForbiddenError("Acesso restrito a administradores"),
    );

    const response = await post({ reason: "Ativar" });

    expect(response.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("recusa CSRF com origin inválido sem chamar a RPC", async () => {
    const response = await post(
      { reason: "Ativar" },
      { origin: "http://evil.example" },
    );

    expect(response.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("recusa motivo vazio sem chamar a RPC", async () => {
    const response = await post({ reason: "   " });

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("recusa campo extra (strict) sem chamar a RPC", async () => {
    const response = await post({ reason: "Ativar", enabled: true });

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("mapeia operation_id_conflict para 409", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "operation_id_conflict" },
    });

    const response = await post({
      reason: "Ativar",
      operationId: "33333333-3333-4333-8333-333333333333",
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("operation_id_conflict");
  });

  it("mapeia marco já gravado para 409", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "individual_launch_already_set" },
    });

    const response = await post({ reason: "Ativar" });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      "individual_launch_already_set",
    );
  });

  it("mapeia oferta desligada e launch_at ausente para 409", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "trial_offer_not_enabled" },
    });
    const disabled = await post({ reason: "Ativar" });
    expect(disabled.status).toBe(409);
    expect((await disabled.json()).error).toBe("trial_offer_not_enabled");

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "launch_at_missing" },
    });
    const missing = await post({ reason: "Ativar" });
    expect(missing.status).toBe(409);
    expect((await missing.json()).error).toBe("launch_at_missing");
  });

  it("erro genérico vira 500 sem expor error.message cru", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "pg: internal detail secret" },
    });

    const response = await post({ reason: "Ativar" });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toContain("secret");
    expect(body.error).toBe(
      "Não foi possível ativar a oferta por CNPJ completo",
    );
  });

  it("não altera configuração mensal, env nem escreve em tabelas", async () => {
    const before = monthlySnapshot();
    const envBefore = { ...process.env };

    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        idempotent: false,
        individual_launch_at: "2026-10-22T12:00:00.000Z",
        cohort_state: "active",
      },
      error: null,
    });

    const response = await post({ reason: "Ativar coorte F50.4" });

    expect(response.status).toBe(200);
    assertNoSideEffects();

    const after = monthlySnapshot();
    expect(after).toEqual(before);
    expect(after.monthly).toEqual({
      monthlyCreditsEnabled: before.monthly.monthlyCreditsEnabled,
      monthlyCreditsAmount: before.monthly.monthlyCreditsAmount,
      monthlyBonusCap: before.monthly.monthlyBonusCap,
      monthlyCreditsMinStoreAgeDays:
        before.monthly.monthlyCreditsMinStoreAgeDays,
    });
    expect(process.env).toEqual(envBefore);
  });
});
