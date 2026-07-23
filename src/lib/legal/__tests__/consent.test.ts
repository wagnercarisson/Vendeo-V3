import { vi, describe, it, expect, beforeEach } from "vitest";

const makeChain = () => {
  const chain: Record<string, any> = {};
  chain.insert = vi.fn();
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn();
  return chain;
};

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { from: mockFrom } }));

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue(makeChain());
});

describe("consent", () => {
  it("recordConsentEvent with granted inserts event", async () => {
    const chain = makeChain();
    chain.insert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    const { recordConsentEvent } = await import("../consent");
    await recordConsentEvent({
      userId: "user-1",
      consentType: "commercial_communications",
      action: "granted",
      policyVersion: "v1.0",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      source: "signup",
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "granted" }),
    );
  });

  it("getEffectiveConsent returns revoked after revoke", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: { action: "revoked" }, error: null });
    mockFrom.mockReturnValue(chain);

    const { getEffectiveConsent } = await import("../consent");
    const result = await getEffectiveConsent("user-1", "commercial_communications");
    expect(result).toBe("revoked");
  });

  it("getEffectiveConsent returns never_set when no events", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { getEffectiveConsent } = await import("../consent");
    const result = await getEffectiveConsent("user-1", "commercial_communications");
    expect(result).toBe("never_set");
  });

  it("revokeConsent inserts revoked event", async () => {
    const chain = makeChain();
    chain.insert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    const { revokeConsent } = await import("../consent");
    await revokeConsent("user-1", "commercial_communications", {
      policyVersion: "v1.0",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      source: "account_settings",
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "revoked" }),
    );
  });
});
