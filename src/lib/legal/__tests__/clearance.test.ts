import { vi, describe, it, expect, beforeEach } from "vitest";

const makeChain = () => {
  const chain: Record<string, any> = {};
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("clearance", () => {
  it("all documents accepted returns ok: true", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
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

  it("terms pending returns ok: false with terms_of_service", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
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
    expect(result).toEqual({
      ok: false,
      reason: "Documentos pendentes de aceitação.",
      requiredDocuments: ["terms_of_service"],
    });
  });

  it("both pending returns ok: false", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

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
    expect(result.ok).toBe(false);
    expect(result).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  it("store without any acceptance blocks clearance", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { requireLegalClearance } = await import("../clearance");
    const result = await requireLegalClearance({
      storeId: "store-no-acceptance",
      userId: "user-1",
      capability: "content_generation",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiredDocuments).toContain("terms_of_service");
      expect(result.requiredDocuments).toContain("acceptable_use");
    }
  });

  it("re-aceite restores clearance", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.1", effective_at: "2026-07-24T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.maybeSingle
      .mockResolvedValueOnce({ data: { document_version: "v1.1" }, error: null })
      .mockResolvedValueOnce({ data: { document_version: "v1.1" }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { requireLegalClearance } = await import("../clearance");
    const result = await requireLegalClearance({
      storeId: "store-reaccepted",
      userId: "user-1",
      capability: "content_generation",
    });
    expect(result).toEqual({ ok: true });
  });

  it("unknown capability returns ok: true", async () => {
    const { requireLegalClearance } = await import("../clearance");
    const result = await requireLegalClearance({
      storeId: "store-1",
      userId: "user-1",
      capability: "some_future_capability" as any,
    });
    expect(result).toEqual({ ok: true });
  });
});
