import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock supabase/server to prevent top-level env-var check on import.
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import { CreditService } from "../credit-service";

// ── Mock setup ──────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockRpc = vi.fn();

// Chain mocks for getBalance: from("credit_balances") → select → eq → single
const mockSelectBalance = vi.fn();
const mockEqBalance = vi.fn();
const mockSingle = vi.fn();

// Chain mocks for getHistory: from("credit_transactions") → select → neq → eq → order → range
const mockSelectTx = vi.fn();
const mockNeqTx = vi.fn();
const mockEqTx = vi.fn();
const mockOrderTx = vi.fn();
const mockRangeTx = vi.fn();

const mockAdminClient = { from: mockFrom, rpc: mockRpc };

let service: CreditService;

// ── Test constants ──────────────────────────────────────────────────────────

const storeId = "00000000-0000-0000-0000-000000000001";
const campaignId = "00000000-0000-0000-0000-000000000002";
const txId = "00000000-0000-0000-0000-000000000003";

// ── beforeEach ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  service = new CreditService(mockAdminClient as any);

  // Restore mockFrom table dispatcher (cleared by vi.clearAllMocks).
  mockFrom.mockImplementation((table: string) => {
    if (table === "credit_balances") return { select: mockSelectBalance };
    if (table === "credit_transactions") return { select: mockSelectTx };
    return {};
  });
});

// ── Helper: configure getBalance chain ──────────────────────────────────────

function mockGetBalanceResult(balance: number | null) {
  const result =
    balance !== null
      ? { data: { balance }, error: null }
      : { data: null, error: null };
  mockSingle.mockReturnValue(result);
  mockEqBalance.mockReturnValue({ single: mockSingle });
  mockSelectBalance.mockReturnValue({ eq: mockEqBalance });
}

// ── Helper: configure getHistory chain ──────────────────────────────────────

function mockGetHistoryResult(data: unknown[]) {
  mockRangeTx.mockReturnValue({ data, error: null });
  mockOrderTx.mockReturnValue({ range: mockRangeTx });
  mockEqTx.mockReturnValue({ order: mockOrderTx });
  mockNeqTx.mockReturnValue({ eq: mockEqTx });
  mockSelectTx.mockReturnValue({ neq: mockNeqTx });
}

// ── Helper: mock RPC success ────────────────────────────────────────────────

function mockRpcSuccess(method: string, result: string) {
  mockRpc.mockImplementation((m: string) => {
    if (m === method) return { data: result, error: null };
    return { data: null, error: null };
  });
}

// ── Helper: mock RPC error ──────────────────────────────────────────────────

function mockRpcError(method: string, message: string) {
  mockRpc.mockImplementation((m: string) => {
    if (m === method) return { data: null, error: { message } };
    return { data: null, error: null };
  });
}

// ── Test suites ─────────────────────────────────────────────────────────────

describe("Saldo e Grant", () => {
  it("getBalance retorna 0 para loja sem registro", async () => {
    mockGetBalanceResult(null);

    const balance = await service.getBalance(storeId);

    expect(balance).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith("credit_balances");
    expect(mockSelectBalance).toHaveBeenCalledWith("balance");
    expect(mockEqBalance).toHaveBeenCalledWith("store_id", storeId);
    expect(mockSingle).toHaveBeenCalledWith();
  });

  it("grantCredits adiciona saldo", async () => {
    mockRpcSuccess("grant_credits", "tx-1");
    mockGetBalanceResult(5);

    const txId = await service.grantCredits(storeId, 5, "onboarding");
    const balance = await service.getBalance(storeId);

    expect(txId).toBe("tx-1");
    expect(balance).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith(
      "grant_credits",
      expect.objectContaining({ p_amount: 5, p_reason: "onboarding" }),
    );
  });

  it("grants acumulam", async () => {
    mockRpc
      .mockReturnValueOnce({ data: "tx-1", error: null })
      .mockReturnValueOnce({ data: "tx-2", error: null })
      .mockReturnValueOnce({ data: "tx-3", error: null });
    mockGetBalanceResult(15);

    await service.grantCredits(storeId, 5, "test");
    await service.grantCredits(storeId, 5, "test");
    await service.grantCredits(storeId, 5, "test");
    const balance = await service.getBalance(storeId);

    expect(balance).toBe(15);
    expect(mockRpc).toHaveBeenCalledTimes(3);
  });

  it("grantCredits com idempotency_key repetido retorna mesma tx", async () => {
    const key = "idem-onboarding";
    mockRpc.mockImplementation((m: string) => {
      if (m === "grant_credits") return { data: "tx-idem-1", error: null };
      return { data: null, error: null };
    });

    const result1 = await service.grantCredits(storeId, 5, "onboarding", {
      idempotencyKey: key,
    });
    const result2 = await service.grantCredits(storeId, 5, "onboarding", {
      idempotencyKey: key,
    });

    expect(result1).toBe("tx-idem-1");
    expect(result2).toBe("tx-idem-1");
    expect(mockRpc).toHaveBeenCalledWith(
      "grant_credits",
      expect.objectContaining({ p_idempotency_key: key }),
    );
  });

  it("getBalance reflete grant após chamada", async () => {
    mockRpcSuccess("grant_credits", "tx-1");
    mockGetBalanceResult(10);

    await service.grantCredits(storeId, 10, "bonus");
    const balance = await service.getBalance(storeId);

    expect(balance).toBe(10);
  });

  it("grantCredits com reason null funciona", async () => {
    mockRpcSuccess("grant_credits", "tx-1");

    const result = await service.grantCredits(storeId, 5, null as unknown as string);

    expect(result).toBe("tx-1");
    expect(mockRpc).toHaveBeenCalledWith(
      "grant_credits",
      expect.objectContaining({ p_reason: null }),
    );
  });
});
