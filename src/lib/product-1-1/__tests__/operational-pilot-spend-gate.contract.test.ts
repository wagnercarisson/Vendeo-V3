// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const mockResolveAuth = vi.fn();
vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: (...args: unknown[]) => mockResolveAuth(...args),
}));

const mockContext = vi.fn();
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: (...args: unknown[]) => mockContext(...args),
}));

const mockFlags = vi.fn();
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  FeatureFlagService: class {
    readProductOneToOneFlags = (...args: unknown[]) => mockFlags(...args);
  },
}));

import { resolvePilotSpendGate } from "../pilot/resolve-pilot-spend-gate";

const STORE = {} as never;

const VALID_FLAGS = {
  testStoresEnabled: true,
  allStoresEnabled: false,
  testStoresStatus: "valid",
  allStoresStatus: "valid",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockContext.mockReturnValue({ requestedScope: "test_stores" });
});

describe("F56.2b2d — gate reconhece a via operacional (test_stores) sem afrouxar a barreira", () => {
  it("test_stores + flags válidas ⇒ armed (nova via operacional)", async () => {
    mockResolveAuth.mockResolvedValue({
      allowed: true,
      stage: "test_stores",
      usedGeneralPrecedence: false,
    });
    mockFlags.mockResolvedValue(VALID_FLAGS);
    const resolution = await resolvePilotSpendGate({ store: STORE });
    expect(resolution.kind).toBe("armed");
  });

  it("isolated_pilot + flags válidas ⇒ armed (via local inalterada)", async () => {
    mockResolveAuth.mockResolvedValue({
      allowed: true,
      stage: "isolated_pilot",
      usedGeneralPrecedence: false,
    });
    mockFlags.mockResolvedValue(VALID_FLAGS);
    const resolution = await resolvePilotSpendGate({ store: STORE });
    expect(resolution.kind).toBe("armed");
  });

  it("test_stores com testStoresEnabled=false ⇒ blocked (flags_unavailable)", async () => {
    mockResolveAuth.mockResolvedValue({
      allowed: true,
      stage: "test_stores",
      usedGeneralPrecedence: false,
    });
    mockFlags.mockResolvedValue({
      testStoresEnabled: false,
      allStoresEnabled: false,
      testStoresStatus: "valid",
      allStoresStatus: "valid",
    });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "flags_unavailable",
    });
  });

  it("all_stores ⇒ blocked (non_narrow_enabling_stage)", async () => {
    mockResolveAuth.mockResolvedValue({
      allowed: true,
      stage: "all_stores",
      usedGeneralPrecedence: false,
    });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "non_narrow_enabling_stage",
    });
  });

  it("resposta REAL read_failure (não-exceção) ⇒ blocked (INCERTEZA, nunca inactive)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "read_failure" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "authorization_read_failure",
    });
  });

  it("flags_unavailable (resposta) ⇒ blocked (INCERTEZA)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "flags_unavailable" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "authorization_read_failure",
    });
  });

  it("exceção ao resolver a autorização ⇒ blocked (eligibility_context_failure)", async () => {
    mockResolveAuth.mockRejectedValue(new Error("db down"));
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "eligibility_context_failure",
    });
  });

  it("exceção das flags com via estreita ⇒ blocked (flags_unavailable)", async () => {
    mockResolveAuth.mockResolvedValue({
      allowed: true,
      stage: "test_stores",
      usedGeneralPrecedence: false,
    });
    mockFlags.mockRejectedValue(new Error("flags down"));
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "flags_unavailable",
    });
  });

  it("leitura determinística não-armada (loja não-test ⇒ escopo all_stores) ⇒ inactive", async () => {
    mockContext.mockReturnValue({ requestedScope: "all_stores" });
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "missing_authorization" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "inactive",
    });
  });
});
