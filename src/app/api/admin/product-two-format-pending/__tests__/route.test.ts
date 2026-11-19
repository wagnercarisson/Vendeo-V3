// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  outcome: null as unknown,
  throwOnResolve: false,
  denyAdmin: false,
  denyCsrf: false,
  resolveCalls: [] as unknown[],
  deps: { marker: "joint-admin-deps" },
  campaign: {
    id: "22222222-2222-4222-8222-222222222222",
    store_id: "11111111-1111-4111-8111-111111111111",
    product_name: "Conjunta",
    status: "ready",
    created_at: "2026-11-19T00:00:00.000Z",
    input_snapshot: {
      campaignFormat: "1:1+9:16",
      formatContractVersion: "f60.7-two-format-v1",
      generationOrigin: "two_format_two_stage",
      generationContractVersion: "f60.7-two-format-v1",
    },
  } as Record<string, unknown> | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: vi.fn(async () => {
    if (h.denyAdmin) {
      const { ForbiddenError } = await import("@/lib/auth/errors");
      throw new ForbiddenError("Acesso restrito a administradores");
    }
    return { userId: "admin-1" };
  }),
}));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async () => h.campaign),
}));
vi.mock("@/lib/product-two-format/admin/joint-admin-deps", () => ({
  createJointAdminDeps: vi.fn(() => h.deps),
}));
vi.mock("@/lib/product-two-format/orchestration/resolve-joint-pending", () => ({
  resolveJointPending: vi.fn(async (request: unknown, deps: unknown) => {
    h.resolveCalls.push({ request, deps });
    if (h.throwOnResolve) throw new Error("transport_failed");
    return h.outcome;
  }),
}));

const CAMPAIGN = h.campaign?.id as string;
const OPERATION = "33333333-3333-4333-8333-333333333333";

function body(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    format: "1:1",
    action: "deliver",
    reason: "resolução administrativa",
    ...overrides,
  };
}

function request(
  overrides: Record<string, unknown> = {},
  origin: string | null = "http://localhost",
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    host: "localhost",
  };
  if (origin !== null) headers.origin = origin;
  return new NextRequest(
    "http://localhost/api/admin/product-two-format-pending",
    {
      method: "POST",
      headers,
      body: JSON.stringify(body(overrides)),
    },
  );
}

async function call(
  overrides: Record<string, unknown> = {},
  origin: string | null = "http://localhost",
) {
  const { POST } = await import("../route");
  return POST(request(overrides, origin) as never);
}

beforeEach(() => {
  h.outcome = {
    kind: "resolved",
    action: "deliver",
    format: "1:1",
    idempotent: false,
    auditRecorded: true,
  };
  h.resolveCalls = [];
  h.throwOnResolve = false;
  h.denyAdmin = false;
  h.campaign = {
    id: "22222222-2222-4222-8222-222222222222",
    store_id: "11111111-1111-4111-8111-111111111111",
    product_name: "Conjunta",
    status: "ready",
    created_at: "2026-11-19T00:00:00.000Z",
    input_snapshot: {
      campaignFormat: "1:1+9:16",
      formatContractVersion: "f60.7-two-format-v1",
      generationOrigin: "two_format_two_stage",
      generationContractVersion: "f60.7-two-format-v1",
    },
  };
});

describe("F60.7 C4 — rota administrativa conjunta", () => {
  it("resolved/reconciled retornam 200 e chamam a composição dedicada", async () => {
    const resolved = await call();
    expect(resolved.status).toBe(200);
    expect(h.resolveCalls).toHaveLength(1);
    expect((h.resolveCalls[0] as { deps: unknown }).deps).toBe(h.deps);

    h.outcome = {
      kind: "reconciled",
      action: "refund",
      format: "9:16",
      auditRecorded: true,
      authorship: "unverified",
    };
    const reconciled = await call({ format: "9:16", action: "refund" });
    expect(reconciled.status).toBe(200);
  });

  it("mapeia invalid_request, blocked, publication, auditoria e unavailable", async () => {
    const cases: Array<[unknown, number, string]> = [
      [{ kind: "invalid_request", reason: "unsupported_format" }, 400, "unsupported_format"],
      [{ kind: "blocked", block: "invalid_evidence", outcomeRecorded: false }, 409, "invalid_evidence"],
      [{ kind: "publication_pending" }, 409, "publication_pending"],
      [{ kind: "audit_conflict" }, 409, "audit_conflict"],
      [{ kind: "audit_pending", code: "audit_write_failed" }, 503, "audit_write_failed"],
      [{ kind: "audit_unavailable", code: "audit_read_failed" }, 503, "audit_read_failed"],
      [{ kind: "unavailable", reason: "not_found" }, 503, "not_found"],
    ];

    for (const [outcome, status, code] of cases) {
      h.outcome = outcome;
      const response = await call();
      expect(response.status).toBe(status);
      const payload = await response.json();
      expect(payload.error.code).toBe(code);
    }
  });

  it("failed técnico retorna 502 e nunca vira rejeição de negócio", async () => {
    h.outcome = { kind: "failed", code: "artifact_incompatible" };
    const response = await call();
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("artifact_incompatible");
  });

  it("exceção inesperada do serviço também retorna 502 técnico", async () => {
    h.throwOnResolve = true;
    const response = await call();
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("resolution_unavailable");
  });

  it("administrador negado retorna 403 sem chamar o serviço", async () => {
    h.denyAdmin = true;
    const response = await call();
    expect(response.status).toBe(403);
    expect(h.resolveCalls).toHaveLength(0);
  });

  it("CSRF negado retorna 403 sem chamar o serviço", async () => {
    const response = await call({}, "http://evil.example");
    expect(response.status).toBe(403);
    expect(h.resolveCalls).toHaveLength(0);
  });

  it("recusa corpo estrito sem chamar o serviço", async () => {
    const response = await call({ extra: true });
    expect(response.status).toBe(400);
    expect(h.resolveCalls).toHaveLength(0);
  });

  it("não cai no fluxo legado para campanha não conjunta ou inconsistente", async () => {
    h.campaign = {
      ...(h.campaign as Record<string, unknown>),
      input_snapshot: { frozenContentReferences: [] },
    };
    const notJoint = await call();
    expect(notJoint.status).toBe(409);
    expect((await notJoint.json()).error.code).toBe("not_two_format");

    h.campaign = {
      ...(h.campaign as Record<string, unknown>),
      input_snapshot: {
        campaignFormat: "1:1+9:16",
        formatContractVersion: "f60.7-two-format-v1",
        generationOrigin: "two_stage_9_16",
      },
    };
    const inconsistent = await call();
    expect(inconsistent.status).toBe(409);
    expect((await inconsistent.json()).error.code).toBe(
      "joint_contract_inconsistent",
    );
    expect(h.resolveCalls).toHaveLength(0);
  });
});
