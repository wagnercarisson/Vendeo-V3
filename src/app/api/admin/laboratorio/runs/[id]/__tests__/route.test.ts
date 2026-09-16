import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { mockRequireAdmin, mockAssertLabEnvironment, mockGetRunDetail } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockAssertLabEnvironment: vi.fn(),
  mockGetRunDetail: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/lab/environment-guard", () => {
  class LabEnvironmentError extends Error {
    readonly reason: string;
    constructor(reason: string) {
      super(`Laboratório bloqueado: ${reason}`);
      this.name = "LabEnvironmentError";
      this.reason = reason;
    }
  }
  return {
    LabEnvironmentError,
    assertLabEnvironment: () => mockAssertLabEnvironment(),
    labEnvironmentDeniedBody: (reason: string) => ({ error: "environment_blocked", reason }),
    getLabEnvironment: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/lib/lab/api/experiment-queries", () => ({
  getRunDetail: (...args: unknown[]) => mockGetRunDetail(...args),
  listScenarioVersions: vi.fn(),
  getActiveCampaignImageTarget: vi.fn(),
  listRecentExperiments: vi.fn(),
  listPendingEvaluations: vi.fn(),
  getExperimentDetail: vi.fn(),
}));

import { ForbiddenError } from "@/lib/auth/errors";
import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";

/**
 * F48.1 (D10/D11) — detalhe do run com snapshot e URLs assinadas.
 */

const RUN_ID = "66666666-6666-4666-8666-666666666666";
const STORAGE_PATH = `experiments/55555555-5555-4555-8555-555555555555/runs/${RUN_ID}/output.png`;

const RUN_FIXTURE = {
  run: {
    id: RUN_ID,
    status: "succeeded",
    provider: "openai",
    model: "gpt-5.5",
    protocol: "responses",
    error_message: null,
  },
  snapshot: { runType: "lab", capability: "campaign_image" },
  artifacts: [
    {
      id: "artifact-1",
      kind: "output",
      storagePath: STORAGE_PATH,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      bytes: 2048,
      checksum: "checksum",
      createdAt: "2026-09-16T00:00:06Z",
      signedUrl: `signed:${STORAGE_PATH}`,
    },
  ],
};

function getRun() {
  return import("../route").then(({ GET }) =>
    GET(new NextRequest(new Request("http://localhost/api/admin/laboratorio/runs/x")), {
      params: Promise.resolve({ id: RUN_ID }),
    }),
  );
}

async function blockEnvironment(reason: LabEnvironmentReason = "disabled_flag") {
  const { LabEnvironmentError } = await import("@/lib/lab/environment-guard");
  mockAssertLabEnvironment.mockImplementation(() => {
    throw new LabEnvironmentError(reason);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockAssertLabEnvironment.mockReturnValue({
    enabled: true,
    supabaseHost: "localhost",
    local: true,
    reason: "ok",
  });
  mockGetRunDetail.mockResolvedValue(RUN_FIXTURE);
});

describe("GET /api/admin/laboratorio/runs/[id]", () => {
  it("nega não-admin com 403 e não lê o run", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await getRun();

    expect(res.status).toBe(403);
    expect(mockGetRunDetail).not.toHaveBeenCalled();
  });

  it("ambiente bloqueado ⇒ 403 environment_blocked sem leitura", async () => {
    await blockEnvironment("remote_blocked");

    const res = await getRun();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: "environment_blocked", reason: "remote_blocked" });
    expect(mockGetRunDetail).not.toHaveBeenCalled();
  });

  it("devolve o snapshot congelado e o signedUrl dos artefatos", async () => {
    const res = await getRun();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshot).toEqual({ runType: "lab", capability: "campaign_image" });
    expect(body.artifacts[0].signedUrl).toBe(`signed:${STORAGE_PATH}`);
    expect(mockGetRunDetail).toHaveBeenCalledWith(expect.anything(), RUN_ID);
  });

  it("run ausente ⇒ 404 run_not_found", async () => {
    mockGetRunDetail.mockResolvedValue(null);

    const res = await getRun();

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("run_not_found");
  });

  it("a resposta não vaza chaves de API nem operation_id de outro experimento", async () => {
    const res = await getRun();
    const serialized = JSON.stringify(await res.json());

    expect(serialized).not.toContain("sk-");
    expect(serialized).not.toContain("AIza");
    expect(serialized).not.toContain("operation_id");
  });
});
