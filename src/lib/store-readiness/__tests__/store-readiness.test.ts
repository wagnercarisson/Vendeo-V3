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

  it("billing info does not affect readiness result — only cadastro_fiscal and brand_profile are checked", async () => {
    const billingResult = {
      ready: true,
      missing: [],
    };
    mockRpc.mockResolvedValue({ data: billingResult, error: null });

    const result = await getStoreReadiness("store-1");
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    expect(Object.keys(result)).not.toContain("billing");
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

describe("F36 readiness — draft store (F36-READINESS-01/02/04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consumer still calls check_store_readiness RPC with p_store_id (RPC unchanged)", async () => {
    mockRpc.mockResolvedValue({ data: { ready: true, missing: [] }, error: null });

    await getStoreReadiness("store-draft-1");

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("check_store_readiness", { p_store_id: "store-draft-1" });
  });

  it("draft store (fiscal fields NULL) reports ready:false with cadastro_fiscal in missing", async () => {
    // Sem mudança de lógica: a RPC F34 já gera a pendência quando cnpj_normalized/
    // razao_social/nome_fantasia são NULL (loja criada via create_store_draft).
    mockRpc.mockResolvedValue({
      data: {
        ready: false,
        missing: [
          { item: "cadastro_fiscal", reason: "CNPJ, razão social e nome fantasia são obrigatórios" },
        ],
      },
      error: null,
    });

    const result = await getStoreReadiness("store-draft-1");
    expect(result.ready).toBe(false);
    expect(result.missing.map((m) => m.item)).toContain("cadastro_fiscal");
  });

  it("identity_state/onboarding state is NOT a readiness criterion — fiscal absence still pending", async () => {
    // Loja com identity_state preenchido (onboarding completo) mas fiscal ausente
    // continua ready:false com cadastro_fiscal pendente. O consumer ignora
    // identity_state — somente ready/missing do RPC F34 importam.
    mockRpc.mockResolvedValue({
      data: {
        ready: false,
        missing: [
          { item: "cadastro_fiscal", reason: "CNPJ, razão social e nome fantasia são obrigatórios" },
        ],
      },
      error: null,
    });

    const result = await getStoreReadiness("store-onboarded-no-fiscal");
    expect(result.ready).toBe(false);
    expect(result.missing[0].item).toBe("cadastro_fiscal");
    expect(Object.keys(result).sort()).toEqual(["missing", "ready"]);
  });

  it("draft store with both fiscal and brand profile absent — cadastro_fiscal first (priority kept)", async () => {
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

    const result = await getStoreReadiness("store-draft-1");
    expect(result.ready).toBe(false);
    expect(result.missing.map((m) => m.item)).toEqual(["cadastro_fiscal", "brand_profile"]);
  });
});
