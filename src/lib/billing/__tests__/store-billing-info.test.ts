import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

vi.mock("server-only", () => ({}));

import { StoreNotFoundError } from "@/lib/auth/store-ownership";
import { getStoreBillingInfo, upsertStoreBillingInfo } from "../store-billing-info";

function makeQueryResult(data: any) {
  return { data, error: data ? null : null };
}

function makeError(code: string) {
  return { data: null, error: { code, message: code === "PGRST116" ? "No rows" : "Error" } };
}

function makeStoreQuery(data: any) {
  const single = vi.fn().mockResolvedValue(data);
  const eq2 = vi.fn().mockReturnValue({ single });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select, eq1, eq2, single };
}

function makeBillingQuery(data: any) {
  const single = vi.fn().mockResolvedValue(data);
  const eq1 = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select, eq1, single };
}

function makeUpsertResult(data: any) {
  const single = vi.fn().mockResolvedValue(data);
  const select = vi.fn().mockReturnValue({ single });
  const upsert = vi.fn().mockReturnValue({ select });
  return { upsert, select, single };
}

describe("getStoreBillingInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns billing info when ownership OK and data exists", async () => {
    const storeQ = makeStoreQuery(makeQueryResult({ id: "store-1" }));
    const billingQ = makeBillingQuery(makeQueryResult({
      id: "billing-1",
      store_id: "store-1",
      billing_email: "loja@test.com",
      billing_address_street: "Rua Teste",
      billing_address_number: "123",
      billing_address_city: "São Paulo",
      billing_address_state: "SP",
      billing_address_zipcode: "01001000",
      billing_data_confirmed_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      billing_phone: null,
      billing_address_complement: null,
      billing_address_neighborhood: null,
      billing_city_ibge_code: null,
      billing_data_source: null,
      billing_data_last_prefilled_from: null,
    }));

    mockFrom
      .mockReturnValueOnce({ select: storeQ.select })
      .mockReturnValueOnce({ select: billingQ.select });

    const result = await getStoreBillingInfo("store-1", "user-1");
    expect(result).not.toBeNull();
    expect(result!.billing_email).toBe("loja@test.com");
  });

  it("returns null when no billing info exists", async () => {
    const storeQ = makeStoreQuery(makeQueryResult({ id: "store-1" }));
    const billingQ = makeBillingQuery(makeError("PGRST116"));

    mockFrom
      .mockReturnValueOnce({ select: storeQ.select })
      .mockReturnValueOnce({ select: billingQ.select });

    const result = await getStoreBillingInfo("store-1", "user-1");
    expect(result).toBeNull();
  });

  it("throws StoreNotFoundError when ownership violated", async () => {
    const storeQ = makeStoreQuery(makeQueryResult(null));

    mockFrom.mockReturnValueOnce({ select: storeQ.select });

    await expect(getStoreBillingInfo("store-1", "user-other")).rejects.toThrow(StoreNotFoundError);
  });
});

describe("upsertStoreBillingInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts billing info with ownership check", async () => {
    const ownershipQ = makeStoreQuery(makeQueryResult({ id: "store-1" }));
    const getStoreQ = makeStoreQuery(makeQueryResult({ id: "store-1" }));
    const billingQ = makeBillingQuery(makeError("PGRST116"));
    const upsertData = makeUpsertResult(makeQueryResult({
      id: "billing-1",
      store_id: "store-1",
      billing_email: "loja@test.com",
      billing_data_confirmed_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }));

    mockFrom
      .mockReturnValueOnce({ select: ownershipQ.select })
      .mockReturnValueOnce({ select: getStoreQ.select })
      .mockReturnValueOnce({ select: billingQ.select })
      .mockReturnValueOnce({ upsert: upsertData.upsert });

    const result = await upsertStoreBillingInfo("store-1", "user-1", { billing_email: "loja@test.com" });
    expect(result).toBeDefined();
    expect(result.billing_email).toBe("loja@test.com");
  });

  it("throws StoreNotFoundError when ownership violated before upsert", async () => {
    const storeQ = makeStoreQuery(makeQueryResult(null));

    mockFrom.mockReturnValueOnce({ select: storeQ.select });

    await expect(upsertStoreBillingInfo("store-1", "user-other", { billing_email: "loja@test.com" })).rejects.toThrow(StoreNotFoundError);
  });
});
