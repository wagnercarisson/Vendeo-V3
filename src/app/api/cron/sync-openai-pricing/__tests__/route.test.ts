import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockRunSync, mockUpdateSession } = vi.hoisted(() => ({
  mockRunSync: vi.fn(),
  mockUpdateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

vi.mock("@/lib/ai-cost/openai-pricing-sync", () => ({
  runOpenAiPricingSync: mockRunSync,
}));

import { GET } from "../route";
import { middleware } from "@/middleware";

function request(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/cron/sync-openai-pricing", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSession.mockImplementation(async () => ({
    response: NextResponse.next(),
    claims: null,
  }));
  process.env.CRON_SECRET = "test-cron-secret";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/sync-openai-pricing", () => {
  it.each([undefined, "Bearer invalid-secret"])(
    "sem sessão, middleware alcança handler mas bearer %s não autoriza sync",
    async (authorization) => {
      const req = request(authorization ? { authorization } : {});
      const gate = await middleware(req);
      expect(gate.headers.get("x-middleware-next")).toBe("1");
      const result = await GET(req);
      expect(result.status).toBe(401);
      expect(mockRunSync).not.toHaveBeenCalled();
    },
  );

  it("middleware real permite cron sem sessão com secret válido até o handler", async () => {
    mockRunSync.mockResolvedValue({
      status: "success", attemptId: "attempt-1",
      modelsChecked: 7, pricesChecked: 11, pricesChanged: 0,
    });
    const req = request({ authorization: "Bearer test-cron-secret" });
    const gate = await middleware(req);
    expect(gate.headers.get("x-middleware-next")).toBe("1");
    const result = await GET(req);
    expect(result.status).toBe(200);
    expect(mockRunSync).toHaveBeenCalledTimes(1);
  });

  it("exceção é exata: outra rota de cron continua exigindo sessão", async () => {
    const req = new NextRequest("http://localhost/api/cron/sync-openai-pricing/other", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    expect((await middleware(req)).status).toBe(401);
    expect(mockRunSync).not.toHaveBeenCalled();
  });

  it("exige CRON_SECRET configurado", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: "cron_secret_not_configured",
    });
  });

  it("rejeita bearer inválido/ausente", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mockRunSync).not.toHaveBeenCalled();
  });

  it("sucesso responde ok com contagens", async () => {
    mockRunSync.mockResolvedValue({
      status: "success",
      attemptId: "attempt-1",
      modelsChecked: 7,
      pricesChecked: 11,
      pricesChanged: 2,
    });

    const response = await GET(
      request({ authorization: "Bearer test-cron-secret" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "success",
      attemptId: "attempt-1",
      modelsChecked: 7,
      pricesChecked: 11,
      pricesChanged: 2,
    });
  });

  it("tentativa concorrente responde 409 distinguível", async () => {
    mockRunSync.mockResolvedValue({ status: "skipped", reason: "already_running" });

    const response = await GET(
      request({ authorization: "Bearer test-cron-secret" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      status: "skipped",
      error: "pricing_sync_in_progress",
    });
  });

  it("falha responde 500 com estágio/código seguros (sem mensagem bruta)", async () => {
    mockRunSync.mockResolvedValue({
      status: "failed",
      attemptId: "attempt-1",
      stage: "fetch",
      code: "fetch_timeout",
    });

    const response = await GET(
      request({ authorization: "Bearer test-cron-secret" }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      status: "failed",
      error: "pricing_sync_failed",
      stage: "fetch",
      code: "fetch_timeout",
    });
    expect(JSON.stringify(body)).not.toContain("SQLSTATE");
  });

  it("agendamento diário está no vercel.json sem alterar os crons de créditos", () => {
    const vercel = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    expect(vercel).toContain("/api/cron/sync-openai-pricing");
    expect(vercel).toMatch(/sync-openai-pricing[\s\S]*0 8 \* \* \*/);
    expect(vercel).toContain("/api/cron/monthly-credits");
    expect(vercel).toContain("/api/cron/demo-credits");
  });
});
