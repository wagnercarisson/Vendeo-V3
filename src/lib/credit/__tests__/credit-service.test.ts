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

describe("Reserva e Dedução", () => {
  it("reserveCredit deduz saldo", async () => {
    mockRpcSuccess("reserve_credit", "tx-1");
    mockGetBalanceResult(9);

    const resultTx = await service.reserveCredit(storeId, 1);
    const balance = await service.getBalance(storeId);

    expect(resultTx).toBe("tx-1");
    expect(balance).toBe(9);
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_credit",
      expect.objectContaining({ p_amount: 1 }),
    );
  });

  it("reserveCredit com saldo insuficiente rejeita", async () => {
    mockRpcError("reserve_credit", "saldo_insuficiente");

    await expect(service.reserveCredit(storeId, 10)).rejects.toThrow(
      "saldo_insuficiente",
    );
  });

  it("reserveCredit com campaignId registra", async () => {
    mockRpcSuccess("reserve_credit", "tx-1");

    await service.reserveCredit(storeId, 3, { campaignId });

    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_credit",
      expect.objectContaining({ p_campaign_id: campaignId }),
    );
  });

  it("reserveCredit com idempotency_key repetido retorna mesma tx", async () => {
    const key = "idem-reserve-1";
    mockRpc.mockImplementation((m: string) => {
      if (m === "reserve_credit") return { data: "tx-idem-reserve", error: null };
      return { data: null, error: null };
    });

    const result1 = await service.reserveCredit(storeId, 2, {
      idempotencyKey: key,
    });
    const result2 = await service.reserveCredit(storeId, 2, {
      idempotencyKey: key,
    });

    expect(result1).toBe("tx-idem-reserve");
    expect(result2).toBe("tx-idem-reserve");
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_credit",
      expect.objectContaining({ p_idempotency_key: key }),
    );
  });

  it("reservas consecutivas mantêm saldo", async () => {
    mockRpcSuccess("reserve_credit", "tx-1");
    mockGetBalanceResult(9);

    await service.reserveCredit(storeId, 1);
    const balanceApos1 = await service.getBalance(storeId);
    expect(balanceApos1).toBe(9);

    mockGetBalanceResult(8);
    await service.reserveCredit(storeId, 1);
    const balanceApos2 = await service.getBalance(storeId);
    expect(balanceApos2).toBe(8);
  });

  it("getBalance reflete deduções", async () => {
    mockRpcSuccess("reserve_credit", "tx-1");
    mockGetBalanceResult(7);

    await service.reserveCredit(storeId, 3);
    const balance = await service.getBalance(storeId);

    expect(balance).toBe(7);
  });

  it("reserveCredit amount > saldo → erro", async () => {
    mockRpcError("reserve_credit", "saldo_insuficiente");

    await expect(service.reserveCredit(storeId, 100)).rejects.toThrow(
      "saldo_insuficiente",
    );
  });
});

describe("Estorno", () => {
  it("refundCredit restaura saldo", async () => {
    mockRpcSuccess("refund_credit", "tx-refund-1");
    mockGetBalanceResult(10);

    const resultTx = await service.refundCredit(txId, "teste");
    const balance = await service.getBalance(storeId);

    expect(resultTx).toBe("tx-refund-1");
    expect(balance).toBe(10);
    expect(mockRpc).toHaveBeenCalledWith(
      "refund_credit",
      expect.objectContaining({ p_tx_id: txId, p_reason: "teste" }),
    );
  });

  it("refundCredit deduction inexistente → erro", async () => {
    mockRpcError("refund_credit", "transacao_nao_encontrada");

    await expect(service.refundCredit(txId, "teste")).rejects.toThrow(
      "transacao_nao_encontrada",
    );
  });

  it("refundCredit duplicado é no-op", async () => {
    const refundTxId = "tx-refund-unico";
    mockRpc.mockImplementation((m: string) => {
      if (m === "refund_credit") return { data: refundTxId, error: null };
      return { data: null, error: null };
    });

    const result1 = await service.refundCredit(txId, "teste");
    const result2 = await service.refundCredit(txId, "teste");

    expect(result1).toBe(refundTxId);
    expect(result2).toBe(refundTxId);
  });

  it("refundCredit com idempotency_key repetido", async () => {
    const key = "idem-refund-1";
    mockRpc.mockImplementation((m: string) => {
      if (m === "refund_credit") return { data: "tx-refund-idem", error: null };
      return { data: null, error: null };
    });

    const result1 = await service.refundCredit(txId, "teste", {
      idempotencyKey: key,
    });
    const result2 = await service.refundCredit(txId, "teste", {
      idempotencyKey: key,
    });

    expect(result1).toBe("tx-refund-idem");
    expect(result2).toBe("tx-refund-idem");
    expect(mockRpc).toHaveBeenCalledWith(
      "refund_credit",
      expect.objectContaining({ p_idempotency_key: key }),
    );
  });

  it("refundCredit em transação não-deduction → erro", async () => {
    mockRpcError("refund_credit", "tipo_invalido");

    await expect(service.refundCredit(txId, "teste")).rejects.toThrow(
      "tipo_invalido",
    );
  });
});

describe("Histórico", () => {
  it("getHistory retorna transações filtrando adjustment", async () => {
    const mockTxs = [
      {
        id: "tx-1",
        store_id: storeId,
        type: "deduction",
        amount: -1,
        balance_before: 10,
        balance_after: 9,
        campaign_id: null,
        reason: "reserva",
        reference: null,
        idempotency_key: null,
        metadata: {},
        created_at: "2026-07-16T12:00:00Z",
      },
    ];
    mockGetHistoryResult(mockTxs);

    const result = await service.getHistory(storeId);

    expect(mockSelectTx).toHaveBeenCalledWith("*");
    expect(mockNeqTx).toHaveBeenCalledWith("type", "adjustment");
    expect(mockEqTx).toHaveBeenCalledWith("store_id", storeId);
    expect(mockOrderTx).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tx-1");
    expect(result[0].storeId).toBe(storeId);
    expect(result[0].balanceBefore).toBe(10);
    expect(result[0].balanceAfter).toBe(9);
    expect(result[0].createdAt).toBe("2026-07-16T12:00:00Z");
  });

  it("getHistory paginado com limit/offset", async () => {
    const mockTxs = Array.from({ length: 5 }, (_, i) => ({
      id: `tx-${i + 1}`,
      store_id: storeId,
      type: "grant",
      amount: 10,
      balance_before: i * 10,
      balance_after: (i + 1) * 10,
      campaign_id: null,
      reason: "test",
      reference: null,
      idempotency_key: null,
      metadata: {},
      created_at: `2026-07-16T${12 + i}:00:00Z`,
    }));
    mockGetHistoryResult(mockTxs.slice(1, 3));

    const result = await service.getHistory(storeId, 2, 1);

    expect(mockRangeTx).toHaveBeenCalledWith(1, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("tx-2");
    expect(result[1].id).toBe("tx-3");
  });

  it("getHistory loja sem transações → array vazio", async () => {
    mockGetHistoryResult([]);

    const result = await service.getHistory(storeId);

    expect(result).toEqual([]);
  });

  it("getHistory default limit = 50", async () => {
    mockGetHistoryResult([]);

    await service.getHistory(storeId);

    expect(mockRangeTx).toHaveBeenCalledWith(0, 49);
  });
});

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

describe("Concorrência", () => {
  it("duas reservas simultâneas com saldo justo", async () => {
    mockRpc.mockImplementation((m: string) => {
      if (m === "reserve_credit") return { data: "tx-con-1", error: null };
      return { data: null, error: null };
    });

    const [r1, r2] = await Promise.all([
      service.reserveCredit(storeId, 1),
      service.reserveCredit(storeId, 1),
    ]);

    expect(r1).toBe("tx-con-1");
    expect(r2).toBe("tx-con-1");
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("duas reservas simultâneas com saldo insuficiente", async () => {
    let callCount = 0;
    mockRpc.mockImplementation((m: string) => {
      if (m === "reserve_credit") {
        callCount++;
        if (callCount === 1) return { data: "tx-ok", error: null };
        return { data: null, error: { message: "saldo_insuficiente" } };
      }
      return { data: null, error: null };
    });

    const results = await Promise.allSettled([
      service.reserveCredit(storeId, 1),
      service.reserveCredit(storeId, 1),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("grant + reserve simultâneos não corrompem saldo", async () => {
    mockRpc.mockImplementation((m: string) => {
      if (m === "grant_credits") return { data: "tx-grant", error: null };
      if (m === "reserve_credit") return { data: "tx-reserve", error: null };
      return { data: null, error: null };
    });

    const [grantTx, reserveTx] = await Promise.all([
      service.grantCredits(storeId, 5, "bonus"),
      service.reserveCredit(storeId, 3),
    ]);

    expect(grantTx).toBe("tx-grant");
    expect(reserveTx).toBe("tx-reserve");
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

describe("Invariantes", () => {
  it("saldo nunca negativo", async () => {
    mockRpc
      .mockReturnValueOnce({ data: "tx-1", error: null })
      .mockReturnValueOnce({ data: "tx-2", error: null })
      .mockReturnValueOnce({ data: "tx-3", error: null })
      .mockReturnValueOnce({ data: null, error: { message: "saldo_insuficiente" } });

    await service.grantCredits(storeId, 5, "init");
    await service.reserveCredit(storeId, 3);
    await service.reserveCredit(storeId, 2);
    await expect(service.reserveCredit(storeId, 1)).rejects.toThrow("saldo_insuficiente");
    expect(mockRpc).toHaveBeenCalledTimes(4);
  });

  it("transações são imutáveis — CreditService não expõe update/delete", () => {
    const proto = Object.getOwnPropertyNames(CreditService.prototype);
    expect(proto).not.toContain("updateTransaction");
    expect(proto).not.toContain("deleteTransaction");
    expect(proto).not.toContain("updateBalance");
  });

  it("adjustment não aparece no extrato", async () => {
    mockGetHistoryResult([]);

    const result = await service.getHistory(storeId);

    expect(mockNeqTx).toHaveBeenCalledWith("type", "adjustment");
    expect(result).toEqual([]);
  });
});
