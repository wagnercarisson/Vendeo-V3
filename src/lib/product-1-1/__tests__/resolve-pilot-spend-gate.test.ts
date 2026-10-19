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

import { resolvePilotSpendGate } from "../pilot/resolve-pilot-spend-gate";

const STORE = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockContext.mockReturnValue({ requestedScope: "test_stores" });
});

describe("F56.2e - resolucao do gate (arma / inativo / bloqueado)", () => {
  it("falha de contexto -> blocked", async () => {
    mockContext.mockImplementation(() => {
      throw new Error("context down");
    });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "eligibility_context_failure",
    });
  });

  it("falha de leitura da autorizacao -> blocked", async () => {
    mockResolveAuth.mockRejectedValue(new Error("db down"));
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "eligibility_context_failure",
    });
  });

  it("leitura deterministica nao-armada -> inactive", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "missing_authorization" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({ kind: "inactive" });
  });

  it("read_failure (nao-excecao) -> blocked", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "read_failure" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "authorization_read_failure",
    });
  });

  it("flags_unavailable -> blocked", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "flags_unavailable" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "authorization_read_failure",
    });
  });

  it("test_stores permitido -> armed", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "test_stores", usedGeneralPrecedence: false });
    const resolution = await resolvePilotSpendGate({ store: STORE });
    expect(resolution.kind).toBe("armed");
  });

  it("all_stores permitido -> armed (abertura geral)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "all_stores", usedGeneralPrecedence: false });
    const resolution = await resolvePilotSpendGate({ store: STORE });
    expect(resolution.kind).toBe("armed");
  });

  it("isolated_pilot permitido -> armed", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "isolated_pilot", usedGeneralPrecedence: false });
    const resolution = await resolvePilotSpendGate({ store: STORE });
    expect(resolution.kind).toBe("armed");
  });

  it("decisao negada por flag -> inactive", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "flag_not_applicable_off" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({ kind: "inactive" });
  });
});
