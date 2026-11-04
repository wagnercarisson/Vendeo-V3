import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const {
  mockUpdateSession,
  mockRpc,
  mockFrom,
  mockEnqueueNotification,
  mockDemoExpirationDedupKey,
  mockClaimEmailNotification,
  mockProcessClaimedEmail,
  mockRecordEvent,
} = vi.hoisted(() => ({
  mockUpdateSession: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockEnqueueNotification: vi.fn(),
  mockDemoExpirationDedupKey: vi.fn(),
  mockClaimEmailNotification: vi.fn(),
  mockProcessClaimedEmail: vi.fn(),
  mockRecordEvent: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

vi.mock("@/lib/notifications/outbox", () => ({
  enqueueNotification: mockEnqueueNotification,
  demoExpirationDedupKey: mockDemoExpirationDedupKey,
}));

vi.mock("@/lib/email/resend", () => ({
  claimEmailNotification: mockClaimEmailNotification,
  processClaimedEmail: mockProcessClaimedEmail,
}));

vi.mock("@/lib/product-events/service", () => ({
  ProductEventService: class {
    record = mockRecordEvent;
  },
}));

import { GET } from "../route";
import { middleware } from "@/middleware";

const VALID_BEARER = { authorization: "Bearer test-cron-secret" };

function request(
  pathname = "/api/cron/demo-credits",
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://localhost${pathname}`, {
    method: "GET",
    headers,
  });
}

function transactionsChain(data: unknown[] = [], error: unknown = null) {
  return {
    in: () => ({
      order: () => ({
        limit: async () => ({ data, error }),
      }),
    }),
  };
}

function balancesChain(data: unknown[] = [], error: unknown = null) {
  return {
    gt: async () => ({ data, error }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
  mockUpdateSession.mockResolvedValue({
    response: NextResponse.next(),
    claims: null,
  });
  mockRpc.mockResolvedValue({
    data: { granted: 0, skipped: 0, errors: 0 },
    error: null,
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === "credit_balances") return { select: () => balancesChain() };
    if (table === "credit_transactions") return { select: () => transactionsChain() };
    throw new Error(`unexpected table: ${table}`);
  });
  mockEnqueueNotification.mockResolvedValue(undefined);
  mockDemoExpirationDedupKey.mockReturnValue("demo-expiration-dedup");
  mockClaimEmailNotification.mockResolvedValue(null);
  mockProcessClaimedEmail.mockResolvedValue(undefined);
  mockRecordEvent.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("contrato estático preservado", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/api/cron/demo-credits/route.ts"),
    "utf8",
  );

  it("requer bearer CRON_SECRET e materializa saldos expirados", () => {
    expect(source).toMatch(/authorization.*Bearer/);
    expect(source).toContain("materialize_demo_expiration");
  });

  it("repara cada tipo de evidência durável com o id da transação como dedup key", () => {
    expect(source).toMatch(/type === "demo"[\s\S]*dedupKey: tx\.id/);
    expect(source).toMatch(/type === "expiration"[\s\S]*dedupKey: tx\.id/);
    expect(source).toMatch(/demo_exhausted[\s\S]*dedupKey: tx\.id/);
    expect(source).toContain("demo_expiring_24h");
  });

  it("usa o agendamento diário Hobby-safe configurado", () => {
    const vercel = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    expect(vercel).toContain("demo-credits");
    expect(vercel).toMatch(/0 7 \* \* \*/);
    expect(vercel).toContain("/api/cron/monthly-credits");
    expect(vercel).toContain("/api/cron/sync-openai-pricing");
  });
});

describe("GET /api/cron/demo-credits", () => {
  it("middleware real permite o scheduler sem sessão com bearer válido até o handler", async () => {
    const req = request("/api/cron/demo-credits", VALID_BEARER);

    const gate = await middleware(req);
    expect(gate.headers.get("x-middleware-next")).toBe("1");

    const response = await GET(req);
    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("process_trial_offer_installments", {});
  });

  it.each([undefined, "Bearer invalid-secret"])(
    "sem sessão o middleware alcança o handler, mas bearer %s responde 401 sem processar",
    async (authorization) => {
      const req = request(
        "/api/cron/demo-credits",
        authorization ? { authorization } : {},
      );

      const gate = await middleware(req);
      expect(gate.headers.get("x-middleware-next")).toBe("1");

      const response = await GET(req);
      expect(response.status).toBe(401);
      expect(mockRpc).not.toHaveBeenCalled();
    },
  );

  it("exige CRON_SECRET configurado com código estável", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(request("/api/cron/demo-credits", VALID_BEARER));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: "cron_secret_not_configured",
    });
  });

  it("falha do RPC responde 500 sem detalhe interno, após a reconciliação", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "boom SQLSTATE 42P01 stacktrace" },
    });
    mockEnqueueNotification.mockResolvedValue(undefined);

    const response = await GET(request("/api/cron/demo-credits", VALID_BEARER));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      error: "trial_offer_processing_failed",
      materialized: 0,
      repaired: 0,
      emails: 0,
      trialOffer: { granted: 0, skipped: 0, errors: 0 },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("SQLSTATE");
    expect(serialized).not.toContain("stacktrace");
    // A reconciliação de saldos/eventos/e-mails continua executando antes do status.
    expect(mockFrom).toHaveBeenCalledWith("credit_balances");
    expect(mockFrom).toHaveBeenCalledWith("credit_transactions");
    expect(mockClaimEmailNotification).toHaveBeenCalled();
  });

  it("RPC com errors > 0 responde 500 com agregados numéricos", async () => {
    mockRpc.mockResolvedValue({
      data: { granted: 2, skipped: 1, errors: 3 },
      error: null,
    });

    const response = await GET(request("/api/cron/demo-credits", VALID_BEARER));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      error: "trial_offer_processing_errors",
      trialOffer: { granted: 2, skipped: 1, errors: 3 },
    });
    expect(typeof body.materialized).toBe("number");
    expect(typeof body.repaired).toBe("number");
    expect(typeof body.emails).toBe("number");
  });

  it("sucesso responde 200 com trialOffer repassado", async () => {
    mockRpc.mockResolvedValue({
      data: { granted: 2, skipped: 0, errors: 0 },
      error: null,
    });

    const response = await GET(request("/api/cron/demo-credits", VALID_BEARER));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      materialized: 0,
      repaired: 0,
      emails: 0,
      trialOffer: { granted: 2, skipped: 0, errors: 0 },
    });
  });

  it("exceção é exata: rota vizinha continua 401 no middleware", async () => {
    const req = request("/api/cron/demo-credits/other", VALID_BEARER);

    const gate = await middleware(req);
    expect(gate.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
