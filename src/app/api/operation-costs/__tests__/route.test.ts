import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireApiUser = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: (...args: unknown[]) => mockRequireApiUser(...args),
}));

const mockGetCost = vi.fn();
class MockOperationCostUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao ler custo de operação");
    this.name = "OperationCostUnavailableError";
  }
}
vi.mock("@/lib/credit/operation-cost-service", () => ({
  OperationCostService: vi.fn(function () {
    return { getCost: mockGetCost };
  }),
  OperationCostUnavailableError: MockOperationCostUnavailableError,
  DEFAULT_OPERATION_COSTS: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
}));

async function getCosts() {
  const { GET } = await import("../route");
  return GET(
    new NextRequest(new Request("http://localhost/api/operation-costs")),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiUser.mockResolvedValue({ userId: "user-1" });
  mockGetCost.mockImplementation(async (key: string) => ({
    operationKey: key,
    costCredits: 1,
    enabled: true,
    source: "table",
  }));
});

describe("GET /api/operation-costs", () => {
  it("200 mapa com costCredits/enabled sem campos internos", async () => {
    const res = await getCosts();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      campaign_generation: { costCredits: 1, enabled: true },
      visual_signature_generation: { costCredits: 1, enabled: true },
    });
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("updated_by");
    expect(raw).not.toContain("updatedAt");
    expect(raw).not.toContain("source");
    expect(mockGetCost).toHaveBeenCalledTimes(2);
  });

  it("503 operation_cost_unavailable", async () => {
    mockGetCost.mockRejectedValue(new MockOperationCostUnavailableError("down"));
    const res = await getCosts();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("operation_cost_unavailable");
  });

  it("401 sem login", async () => {
    mockRequireApiUser.mockRejectedValue(new UnauthorizedError());
    const res = await getCosts();
    expect(res.status).toBe(401);
  });
});
