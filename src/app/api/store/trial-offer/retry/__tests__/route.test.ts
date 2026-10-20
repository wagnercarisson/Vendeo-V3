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
});
