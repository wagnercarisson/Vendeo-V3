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

beforeEach(() => {
  vi.clearAllMocks();
  mockContext.mockReturnValue({ requestedScope: "test_stores" });
});

describe("F56.2b2c — resolução do gate (arma / inativo / BLOQUEADO)", () => {
  it("falha de leitura da autorização ⇒ blocked (não desarma a proteção)", async () => {
    mockResolveAuth.mockRejectedValue(new Error("db down"));
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "eligibility_context_failure",
    });
  });

  it("leitura determinística não-armada ⇒ inactive (segue sem gate)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "missing_authorization" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({ kind: "inactive" });
  });

  it("resposta REAL `read_failure` (não-exceção) ⇒ blocked (INCERTEZA, não inativo)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "read_failure" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "authorization_read_failure",
    });
  });

  it("autorização estreita + flag ligada ⇒ armed", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "isolated_pilot", usedGeneralPrecedence: false });
    mockFlags.mockResolvedValue({
      testStoresEnabled: true,
      allStoresEnabled: false,
      testStoresStatus: "valid",
      allStoresStatus: "valid",
    });
    const resolution = await resolvePilotSpendGate({ store: STORE });
    expect(resolution.kind).toBe("armed");
  });

  it("falha/leitura inválida das flags ⇒ blocked (INCERTEZA)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "isolated_pilot", usedGeneralPrecedence: false });
    mockFlags.mockRejectedValue(new Error("flags down"));
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "flags_unavailable",
    });
  });

  it("estágio habilitador NÃO-estreito ⇒ blocked (M2: não arma gate para escopo geral)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "test_stores", usedGeneralPrecedence: false });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "non_narrow_enabling_stage",
    });
  });

  it("flag desligada com autorização estreita ⇒ blocked (inconsistência)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "isolated_pilot", usedGeneralPrecedence: false });
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
});
