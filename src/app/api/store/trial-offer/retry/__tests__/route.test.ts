import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockRequireApiUser = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: (...args: unknown[]) => mockRequireApiUser(...args),
}));

const mockGetCurrentStore = vi.fn();
vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: (...args: unknown[]) => mockGetCurrentStore(...args),
}));

const mockRetry = vi.fn();
vi.mock("@/lib/credit/trial-offer/completion", () => ({
  retryTrialOfferEnrollment: (...args: unknown[]) => mockRetry(...args),
}));

function request(headers: Record<string, string> = {}) {
  return new NextRequest(
    new Request("http://localhost/api/store/trial-offer/retry", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        host: "localhost",
        ...headers,
      },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiUser.mockResolvedValue({ userId: "user-1" });
  mockGetCurrentStore.mockResolvedValue({ id: "store-1" });
});

describe("F50.2 trial offer retry route", () => {
  it("chama somente o retry de conclusão/inscrição", async () => {
    mockRetry.mockResolvedValue({ status: "started" });
    const { POST } = await import("../route");

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mockRetry).toHaveBeenCalledWith("store-1");
    const body = await response.json();
    expect(body.trialOffer.status).toBe("started");
  });

  it("recusa CSRF sem origin", async () => {
    const { POST } = await import("../route");
    const response = await POST(request({ origin: "" }));
    expect(response.status).toBe(403);
    expect(mockRetry).not.toHaveBeenCalled();
  });

  it("404 quando não há loja", async () => {
    mockGetCurrentStore.mockResolvedValue(null);
    const { POST } = await import("../route");
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mockRetry).not.toHaveBeenCalled();
  });

  it("F50.4: retry de enrollment existente é idempotente e não duplica crédito", async () => {
    mockRetry.mockResolvedValue({ status: "existing" });
    const { POST } = await import("../route");

    const first = await POST(request());
    const second = await POST(request());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockRetry).toHaveBeenNthCalledWith(1, "store-1");
    expect(mockRetry).toHaveBeenNthCalledWith(2, "store-1");
    expect((await first.json()).trialOffer.status).toBe("existing");
    expect((await second.json()).trialOffer.status).toBe("existing");
    // A rota só delega; nenhuma concessão/onboarding é reexecutada localmente.
    expect(mockRetry).toHaveBeenCalledTimes(2);
  });

  it("F50.4: mapeia motivos por coorte sem expor dados sensíveis", async () => {
    mockRetry.mockResolvedValue({
      status: "not_eligible",
      reason: "beneficiary_already_enrolled",
    });
    const { POST } = await import("../route");

    const response = await POST(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.trialOffer).toEqual({
      status: "not_eligible",
      reason: "beneficiary_already_enrolled",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("beneficiary_cnpj_normalized");
    expect(serialized).not.toContain("root_hash");
  });

  it("F50.4: repassa motivos seguros root_used_other_beneficiary e prior_benefit_ambiguous", async () => {
    const { POST } = await import("../route");

    mockRetry.mockResolvedValueOnce({
      status: "not_eligible",
      reason: "root_used_other_beneficiary",
    });
    const first = await POST(request());
    expect((await first.json()).trialOffer.reason).toBe("root_used_other_beneficiary");

    mockRetry.mockResolvedValueOnce({
      status: "not_eligible",
      reason: "prior_benefit_ambiguous",
    });
    const second = await POST(request());
    expect((await second.json()).trialOffer.reason).toBe("prior_benefit_ambiguous");
  });
});
