import { vi, describe, it, expect, beforeEach } from "vitest";

const makeChain = () => {
  const chain: Record<string, any> = {};
  chain.insert = vi.fn();
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  return chain;
};

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { from: mockFrom } }));

function setupDocVersion(version: string) {
  const chain = makeChain();
  chain.maybeSingle.mockResolvedValue({
    data: { version, effective_at: "2026-07-23T00:00:00Z", summary: null },
    error: null,
  });
  return chain;
}

function setupAcceptance(statusData: Record<string, any> | null) {
  const chain = makeChain();
  chain.maybeSingle.mockResolvedValue({ data: statusData, error: null });
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("re-aceite flow", () => {
  it("outdated version causes clearance failure", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return setupDocVersion("v1.0");
      const chain = makeChain();
      chain.maybeSingle
        .mockResolvedValueOnce({ data: { document_version: "v0.9" }, error: null })
        .mockResolvedValueOnce({ data: { document_version: "v1.0" }, error: null });
      return chain;
    });

    const { requireLegalClearance } = await import("../clearance");
    const result = await requireLegalClearance({
      storeId: "store-1",
      userId: "user-1",
      capability: "content_generation",
    });
    expect(result.ok).toBe(false);
  });

  it("re-acceptance restores clearance", async () => {
    const docChain = setupDocVersion("v1.0");
    const acceptChain = makeChain();
    acceptChain.insert.mockResolvedValue({ error: null });
    acceptChain.maybeSingle
      .mockResolvedValueOnce({ data: { document_version: "v1.0" }, error: null })
      .mockResolvedValueOnce({ data: { document_version: "v1.0" }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { requireLegalClearance } = await import("../clearance");
    const result = await requireLegalClearance({
      storeId: "store-1",
      userId: "user-1",
      capability: "content_generation",
    });
    expect(result).toEqual({ ok: true });
  });

  it("previous acceptance history preserved after re-aceite", async () => {
    const acceptChain = makeChain();
    acceptChain.order = vi.fn().mockResolvedValue({
      data: [
        { id: "1", document_type: "terms_of_service", document_version: "v0.9" },
        { id: "2", document_type: "terms_of_service", document_version: "v1.0" },
      ],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return setupDocVersion("v1.0");
      return acceptChain;
    });

    const { getStoreAcceptanceHistory } = await import("../acceptance-service");
    const history = await getStoreAcceptanceHistory("store-1");
    expect(history).toHaveLength(2);
  });
});

describe("regression — pipeline clearance", () => {
  it("generation with clearance ok proceeds", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return setupDocVersion("v1.0");
      const chain = makeChain();
      chain.maybeSingle
        .mockResolvedValueOnce({ data: { document_version: "v1.0" }, error: null })
        .mockResolvedValueOnce({ data: { document_version: "v1.0" }, error: null });
      return chain;
    });

    const { requireLegalClearance } = await import("../clearance");
    const result = await requireLegalClearance({
      storeId: "store-1",
      userId: "user-1",
      capability: "content_generation",
    });
    expect(result).toEqual({ ok: true });
  });

  it("generation without clearance returns block", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return setupDocVersion("v1.0");
      const chain = makeChain();
      chain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      return chain;
    });

    const { requireLegalClearance } = await import("../clearance");
    const result = await requireLegalClearance({
      storeId: "store-1",
      userId: "user-1",
      capability: "content_generation",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiredDocuments).toContain("terms_of_service");
    }
  });
});
