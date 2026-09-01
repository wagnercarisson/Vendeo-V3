import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/auth/errors";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

// ── Mocks ──────────────────────────────────────────────────────────

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc },
}));

vi.mock("@/lib/logging/pipeline-logger", () => ({
  logPipelineEvent: vi.fn(),
}));

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

// ── Helpers ────────────────────────────────────────────────────────

const GRANT_RESULT = {
  eligible: 20,
  granted: 20,
  skipped: 0,
  errors: 0,
  details: {
    roots_considered: 24,
    skipped_no_cnpj: 1,
    skipped_already_granted: 0,
    skipped_not_due: 4,
    skipped_bonus_threshold: 0,
  },
};

// Shape canônico do RPC com skipped NUMÉRICO (limiar/idempotência) — NÃO deve
// ser interpretado como disabled pelos handlers/routes (o flag booleano de
// disabled é `{ skipped: true }`, emitido apenas quando monthlyCreditsEnabled=false).
const GRANT_RESULT_NUMERIC_SKIPPED = {
  eligible: 25,
  granted: 20,
  skipped: 5,
  errors: 0,
  details: {
    roots_considered: 26,
    skipped_no_cnpj: 0,
    skipped_already_granted: 3,
    skipped_not_due: 1,
    skipped_bonus_threshold: 2,
  },
};

// ── POST /api/admin/monthly-credits/grant ──────────────────────────

async function postGrant() {
  const { POST } = await import(
    "../../../app/api/admin/monthly-credits/grant/route"
  );
  const req = new NextRequest(
    new Request("http://localhost/api/admin/monthly-credits/grant", {
      method: "POST",
    }),
  );
  return POST(req);
}

describe("POST /api/admin/monthly-credits/grant", () => {
  it("returns 200 with grant result on success", async () => {
    mockRpc.mockResolvedValue({ data: GRANT_RESULT, error: null });

    const res = await postGrant();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(GRANT_RESULT);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const res = await postGrant();
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await postGrant();
    expect(res.status).toBe(403);
  });

  it("returns 500 on RPC error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "db error" } });

    const res = await postGrant();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("db error");
  });

  it("returns skipped=true when monthlyCreditsEnabled=false", async () => {
    process.env.VENDEO_MONTHLY_CREDITS_ENABLED = "false";

    const res = await postGrant();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: true });
  });

  it("returns numeric skipped shape without treating it as disabled", async () => {
    // Contrato botão/flags: o RPC retorna `skipped` NUMÉRICO (shape canônico),
    // que NÃO deve ser confundido com o flag booleano `{ skipped: true }` dos
    // routes quando monthlyCreditsEnabled=false. O handler repassa o shape
    // intacto (status 200, body com skipped: 5) — o botão usa `body.skipped === true`.
    mockRpc.mockResolvedValue({ data: GRANT_RESULT_NUMERIC_SKIPPED, error: null });

    const res = await postGrant();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(GRANT_RESULT_NUMERIC_SKIPPED);
    expect(typeof body.skipped).toBe("number");
    expect(body.skipped).not.toBe(true);
  });
});

// ── GET /api/cron/monthly-credits ───────────────────────────────────

async function getCron(authHeader?: string) {
  const { GET } = await import(
    "../../../app/api/cron/monthly-credits/route"
  );
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  const req = new NextRequest(
    new Request("http://localhost/api/cron/monthly-credits", { headers }),
  );
  return GET(req);
}

describe("GET /api/cron/monthly-credits", () => {
  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const res = await getCron("Bearer secret");
    expect(res.status).toBe(500);
  });

  it("returns 401 without Authorization header", async () => {
    process.env.CRON_SECRET = "secret";

    const res = await getCron();
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    process.env.CRON_SECRET = "secret";

    const res = await getCron("Bearer wrong");
    expect(res.status).toBe(401);
  });

  it("returns 200 with grant result on success", async () => {
    process.env.CRON_SECRET = "secret";
    mockRpc.mockResolvedValue({ data: GRANT_RESULT, error: null });

    const res = await getCron("Bearer secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(GRANT_RESULT);
  });

  it("returns skipped=true when monthlyCreditsEnabled=false", async () => {
    process.env.CRON_SECRET = "secret";
    process.env.VENDEO_MONTHLY_CREDITS_ENABLED = "false";

    const res = await getCron("Bearer secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: true });
  });

  it("returns numeric skipped shape without treating it as disabled", async () => {
    // Mesmo contrato do admin route: `skipped` numérico do shape canônico não é
    // flag de disabled — o handler repassa o shape intacto com status 200.
    process.env.CRON_SECRET = "secret";
    mockRpc.mockResolvedValue({ data: GRANT_RESULT_NUMERIC_SKIPPED, error: null });

    const res = await getCron("Bearer secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(GRANT_RESULT_NUMERIC_SKIPPED);
    expect(typeof body.skipped).toBe("number");
    expect(body.skipped).not.toBe(true);
  });

  it("returns 500 on RPC error", async () => {
    process.env.CRON_SECRET = "secret";
    mockRpc.mockResolvedValue({ data: null, error: { message: "rpc error" } });

    const res = await getCron("Bearer secret");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("rpc error");
  });
});


