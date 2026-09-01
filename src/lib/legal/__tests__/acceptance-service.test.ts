import { vi, describe, it, expect, beforeEach } from "vitest";

let docVersionCallCount = 0;

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

beforeEach(() => {
  vi.clearAllMocks();
  docVersionCallCount = 0;
});

describe("acceptance-service", () => {
  it("registerAcceptance inserts record with resolved version", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.insert.mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { registerAcceptance } = await import("../acceptance-service");
    await registerAcceptance({
      storeId: "store-1",
      userId: "user-1",
      documentType: "terms_of_service",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      source: "onboarding",
    });

    expect(acceptChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ document_version: "v1.0" }),
    );
  });

  it("getAcceptanceStatus returns current when version matches", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.maybeSingle.mockResolvedValue({
      data: { document_version: "v1.0" },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { getAcceptanceStatus } = await import("../acceptance-service");
    const status = await getAcceptanceStatus("store-1", "terms_of_service");
    expect(status).toBe("current");
  });

  it("getAcceptanceStatus returns outdated when version differs", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.maybeSingle.mockResolvedValue({
      data: { document_version: "v0.9" },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { getAcceptanceStatus } = await import("../acceptance-service");
    const status = await getAcceptanceStatus("store-1", "terms_of_service");
    expect(status).toBe("outdated");
  });

  it("getAcceptanceStatus returns never when no records", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { getAcceptanceStatus } = await import("../acceptance-service");
    const status = await getAcceptanceStatus("store-1", "terms_of_service");
    expect(status).toBe("never");
  });

  it("getStoreAcceptanceHistory returns ordered records", async () => {
    const acceptChain = makeChain();
    const historyData = [
      { id: "1", document_type: "terms_of_service" },
      { id: "2", document_type: "acceptable_use" },
    ];
    acceptChain.order = vi.fn().mockResolvedValue({ data: historyData, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return makeChain();
      return acceptChain;
    });

    const { getStoreAcceptanceHistory } = await import("../acceptance-service");
    const history = await getStoreAcceptanceHistory("store-1");
    expect(history).toHaveLength(2);
  });

  it("Teste 54: loja com aceite v1.2 antigo → getAcceptanceStatus 'outdated' com v1.4 vigente (D12)", async () => {
    // v1.4 vigente (publicada no 42-12) — mock sem depender do push
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.4", effective_at: "2026-08-17T00:00:00Z", summary: null },
      error: null,
    });
    // loja aceitou v1.2 (antiga)
    const acceptChain = makeChain();
    acceptChain.maybeSingle.mockResolvedValue({
      data: { document_version: "v1.2" },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { getAcceptanceStatus } = await import("../acceptance-service");
    const status = await getAcceptanceStatus("store-1", "terms_of_service");
    expect(status).toBe("outdated");
  });

  it("Teste 55: login_reacceptance registra v1.4 → getAcceptanceStatus 'current' (D12)", async () => {
    const docChain = makeChain();
    docChain.maybeSingle.mockResolvedValue({
      data: { version: "v1.4", effective_at: "2026-08-17T00:00:00Z", summary: null },
      error: null,
    });
    const acceptChain = makeChain();
    acceptChain.insert.mockResolvedValue({ error: null });
    // Após o reaceite, o aceite mais recente é v1.4
    acceptChain.maybeSingle.mockResolvedValue({
      data: { document_version: "v1.4" },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "legal_document_versions") return docChain;
      return acceptChain;
    });

    const { registerAcceptance, getAcceptanceStatus } = await import("../acceptance-service");

    // reaceite via fluxo login_reacceptance (source)
    await registerAcceptance({
      storeId: "store-1",
      userId: "user-1",
      documentType: "terms_of_service",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      source: "login_reacceptance",
    });

    expect(acceptChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_type: "terms_of_service",
        document_version: "v1.4",
        acceptance_source: "login_reacceptance",
      }),
    );

    const status = await getAcceptanceStatus("store-1", "terms_of_service");
    expect(status).toBe("current");
  });
});
