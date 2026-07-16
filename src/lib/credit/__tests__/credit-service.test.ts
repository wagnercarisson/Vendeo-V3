import { vi, describe, it, expect, beforeEach } from "vitest";
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

describe("CreditService", () => {
  // Setup smoke test
  it("is instantiated with a mock admin client", () => {
    expect(service).toBeInstanceOf(CreditService);
  });
});
