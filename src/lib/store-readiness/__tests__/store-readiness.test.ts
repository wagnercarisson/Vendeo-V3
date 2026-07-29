import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
  },
}));

vi.mock("server-only", () => ({}));

import { getStoreReadiness } from "../../store-readiness";

describe("getStoreReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ready true when cadastro fiscal complete and brand profile synced", async () => {
    mockRpc.mockResolvedValue({
      data: { ready: true, missing: [] },
      error: null,
    });

    const result = await getStoreReadiness("store-1");
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns ready false when cadastro fiscal is missing", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ready: false,
        missing: [{ item: "cadastro_fiscal", reason: "CNPJ, razão social e nome fantasia são obrigatórios" }],
      },
      error: null,
    });

    const result = await getStoreReadiness("store-1");
    expect(result.ready).toBe(false);
    expect(result.missing[0].item).toBe("cadastro_fiscal");
  });

  it("returns ready false when brand profile is missing", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ready: false,
        missing: [{ item: "brand_profile", reason: "Direção visual da loja não configurada" }],
      },
      error: null,
    });

    const result = await getStoreReadiness("store-1");
    expect(result.ready).toBe(false);
    expect(result.missing[0].item).toBe("brand_profile");
  });

  it("returns both missing items when both are missing (cadastro_fiscal first)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ready: false,
        missing: [
          { item: "cadastro_fiscal", reason: "CNPJ, razão social e nome fantasia são obrigatórios" },
          { item: "brand_profile", reason: "Direção visual da loja não configurada" },
        ],
      },
      error: null,
    });

    const result = await getStoreReadiness("store-1");
    expect(result.ready).toBe(false);
    expect(result.missing).toHaveLength(2);
    expect(result.missing[0].item).toBe("cadastro_fiscal");
    expect(result.missing[1].item).toBe("brand_profile");
  });

  it("returns fallback on RPC error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "RPC failed" },
    });

    const result = await getStoreReadiness("store-1");
    expect(result.ready).toBe(false);
    expect(result.missing[0].item).toBe("brand_profile");
    expect(result.missing[0].reason).toContain("RPC failed");
  });

  it("returns fallback on exception", async () => {
    mockRpc.mockRejectedValue(new Error("Network error"));

    const result = await getStoreReadiness("store-1");
    expect(result.ready).toBe(false);
    expect(result.missing[0].item).toBe("brand_profile");
  });
});
