// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { CreditService } from "../credit-service";

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const client = { from: mockFrom } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ single: mockSingle });
});

describe("CreditService.getBalanceBreakdown — throwOnError", () => {
  it("(a) sem opção, erro do Supabase retorna breakdown com zeros", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "connection failure" },
    });

    const result = await new CreditService(client).getBalanceBreakdown("store");

    expect(result.availableBalance).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.bonusBalance).toBe(0);
    expect(result.purchasedBalance).toBe(0);
  });

  it("(b) { throwOnError: false } mantém retorno de zeros", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "connection failure" },
    });

    const result = await new CreditService(client).getBalanceBreakdown("store", {
      throwOnError: false,
    });

    expect(result.availableBalance).toBe(0);
  });

  it("(c) { throwOnError: true } rejeita o erro do Supabase", async () => {
    const error = { code: "08006", message: "connection failure" };
    mockSingle.mockResolvedValue({ data: null, error });

    await expect(
      new CreditService(client).getBalanceBreakdown("store", {
        throwOnError: true,
      }),
    ).rejects.toBe(error);
  });

  it("(d) PGRST116 (nenhuma linha) continua retornando zeros com throwOnError true", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows returned" },
    });

    const result = await new CreditService(client).getBalanceBreakdown("store", {
      throwOnError: true,
    });

    expect(result.availableBalance).toBe(0);
    expect(result).toMatchObject({
      balance: 0,
      demoBalance: 0,
      demoExpiresAt: null,
      originDemoGrantTxId: null,
      bonusBalance: 0,
      purchasedBalance: 0,
    });
  });

  it("mantém o breakdown normal quando a leitura tem sucesso", async () => {
    mockSingle.mockResolvedValue({
      data: {
        balance: 5,
        demo_balance: 0,
        demo_expires_at: null,
        origin_demo_grant_tx_id: null,
        bonus_balance: 2,
        purchased_balance: 3,
      },
      error: null,
    });

    const result = await new CreditService(client).getBalanceBreakdown("store", {
      throwOnError: true,
    });

    expect(result.availableBalance).toBe(5);
  });
});
