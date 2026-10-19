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

describe("F56.2e - gate alinhado a decisao server-side", () => {
  it("test_stores -> armed", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "test_stores", usedGeneralPrecedence: false });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toMatchObject({ kind: "armed" });
  });

  it("isolated_pilot -> armed", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "isolated_pilot", usedGeneralPrecedence: false });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toMatchObject({ kind: "armed" });
  });

  it("all_stores -> armed (abertura geral)", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: true, stage: "all_stores", usedGeneralPrecedence: false });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toMatchObject({ kind: "armed" });
  });

  it("read_failure -> blocked", async () => {
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

  it("excecao ao resolver -> blocked", async () => {
    mockResolveAuth.mockRejectedValue(new Error("db down"));
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({
      kind: "blocked",
      reason: "eligibility_context_failure",
    });
  });

  it("decisao deterministica nao-armada -> inactive", async () => {
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "missing_authorization" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({ kind: "inactive" });
  });

  it("loja nao-test sem autorizacao -> inactive", async () => {
    mockContext.mockReturnValue({ requestedScope: "all_stores" });
    mockResolveAuth.mockResolvedValue({ allowed: false, code: "missing_authorization" });
    await expect(resolvePilotSpendGate({ store: STORE })).resolves.toEqual({ kind: "inactive" });
  });
});
