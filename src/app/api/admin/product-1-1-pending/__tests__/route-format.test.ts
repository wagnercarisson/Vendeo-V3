// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { marker: "admin" },
  createServerClient: vi.fn(),
}));
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "99999999-9999-4999-8999-999999999999" })),
}));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));

const {
  mockCreateAdapter,
  mockResolveFormat,
  mockProjectionFor,
  mockFindPendingOperation,
  mockResolvePendingOperation,
  mockListPendingOperations,
  mockVerticalArtifacts,
  mockTwoStageArtifacts,
  MockRepository,
  MockResolutionError,
  repoOptions,
  resolutionErrorStatus,
} = vi.hoisted(() => {
  const resolveFormat = vi.fn();
  const projectionFor = vi.fn(() => async () => ({ campaignId: "c" }));
  const findPendingOperation = vi.fn(async () => ({
    storeId: "11111111-1111-4111-8111-111111111111",
  }));
  // Sondas fake ESTÁVEIS — a identidade precisa sobreviver entre chamadas do
  // adapter e chegar intacta às opções do repositório (F60.5).
  const verticalProbe = {
    probeArtifact: vi.fn(async () => ({ kind: "absent" as const })),
  };
  const twoStageProbe = {
    probeArtifact: vi.fn(async () => ({ kind: "absent" as const })),
  };
  const optionsSeen: Array<Record<string, unknown>> = [];
  class MockResolutionError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }

  /** Códigos que mapeiam para 400 (espelho de `resolve-pending-operation.ts`). */
  const BAD_REQUEST_CODES: readonly string[] = [
    "missing_reason",
    "missing_actor_id",
    "missing_campaign_id",
    "missing_operation_id",
    "missing_resolution_operation_id",
    "invalid_action",
    "invalid_evidence",
    "insufficient_evidence",
  ];
  /** Códigos que mapeiam para 409 (espelho de `resolve-pending-operation.ts`). */
  const CONFLICT_CODES: readonly string[] = [
    "operation_terminal",
    "operation_in_progress",
    "execution_not_ended",
    "delivered_not_refundable",
    "operation_identity_conflict",
  ];

  /**
   * Espelho FIEL de `resolutionErrorStatus`: erro técnico/desconhecido vira 500,
   * nunca 409 — era exatamente o que o stub antigo mascarava.
   */
  function resolutionErrorStatus(error: unknown): number {
    const code =
      error instanceof MockResolutionError
        ? error.code
        : ((error as { code?: string } | null)?.code ?? "unknown");
    if (BAD_REQUEST_CODES.includes(code)) return 400;
    if (code === "operation_not_found") return 404;
    if (CONFLICT_CODES.includes(code)) return 409;
    return 500;
  }

  class MockRepository {
    constructor(
      public readonly client?: unknown,
      public readonly artifacts?: unknown,
      public readonly options?: Record<string, unknown>,
    ) {
      if (options) optionsSeen.push(options);
    }
    findPendingOperation = findPendingOperation;
    probeArtifact = vi.fn();
    listPendingOperations = vi.fn(async () => []);
  }
  return {
    mockCreateAdapter: vi.fn(() => ({
      resolveFormat,
      verticalArtifacts: verticalProbe,
      twoStageArtifacts: twoStageProbe,
      projectionFor,
    })),
    mockResolveFormat: resolveFormat,
    mockProjectionFor: projectionFor,
    mockFindPendingOperation: findPendingOperation,
    mockResolvePendingOperation: vi.fn(async () => ({ status: "delivered" })),
    mockListPendingOperations: vi.fn(async () => []),
    mockVerticalArtifacts: verticalProbe,
    mockTwoStageArtifacts: twoStageProbe,
    MockRepository,
    MockResolutionError,
    repoOptions: optionsSeen,
    resolutionErrorStatus,
  };
});

// F60.5 — mock PARCIAL: `buildAdminPendingRepository` deve permanecer REAL (é o
// objeto do teste); apenas a fábrica do adapter é substituída. Mock total deixa
// `buildAdminPendingRepository` como `undefined` e transforma a rota em TypeError.
vi.mock("@/lib/product-vertical-9-16/recovery/pending-adapter", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/product-vertical-9-16/recovery/pending-adapter")
    >();
  return { ...actual, createPendingFormatAdapter: mockCreateAdapter };
});
vi.mock("@/lib/product-1-1/pending/pending-operations-repository", () => ({
  SupabasePendingOperationsRepository: MockRepository,
}));
vi.mock("@/lib/product-1-1/pending/resolve-pending-operation", () => ({
  listPendingOperations: mockListPendingOperations,
  resolvePendingOperation: mockResolvePendingOperation,
  PendingOperationResolutionError: MockResolutionError,
  resolutionErrorStatus,
}));

import { GET, POST } from "../route";

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const RESOLUTION_ID = "44444444-4444-4444-8444-444444444444";

function request(body?: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/admin/product-1-1-pending", {
      method: body ? "POST" : "GET",
      ...(body
        ? {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
          }
        : {}),
    }),
  );
}

const validBody = {
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
  action: "deliver_existing_art" as const,
  resolutionOperationId: RESOLUTION_ID,
  reason: "arte encontrada",
};

describe("F59/59-06 — GET/POST admin de pendências por formato", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoOptions.length = 0;
    mockResolveFormat.mockResolvedValue({ kind: "1:1" });
    mockFindPendingOperation.mockResolvedValue({
      storeId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("GET compõe o resolvedor de formato e a sonda vertical no repositório", async () => {
    const res = await GET(request() as never);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(409);
    expect(res.status).not.toBe(500);
    expect(mockCreateAdapter).toHaveBeenCalledTimes(1);
    expect(repoOptions[0]?.resolveFormat).toBe(mockResolveFormat);
    expect(repoOptions[0]?.verticalArtifacts).toBe(mockVerticalArtifacts);
    expect(repoOptions[0]?.twoStageArtifacts).toBe(mockTwoStageArtifacts);
    expect(mockListPendingOperations).toHaveBeenCalledWith({
      repository: expect.any(MockRepository),
    });
  });

  it("POST com formato indisponível ⇒ 503 antes da resolução", async () => {
    mockResolveFormat.mockResolvedValue({ kind: "unavailable" });
    const res = await POST(request(validBody) as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("format_unavailable");
    expect(mockResolvePendingOperation).not.toHaveBeenCalled();
  });

  it("POST 9:16 injeta a projeção vertical derivada do estado persistido", async () => {
    mockResolveFormat.mockResolvedValue({ kind: "9:16" });
    const res = await POST(request(validBody) as never);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(409);
    expect(res.status).not.toBe(500);
    expect(mockFindPendingOperation).toHaveBeenCalledWith(CAMPAIGN_ID, OPERATION_ID);
    expect(mockProjectionFor).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      CAMPAIGN_ID,
      OPERATION_ID,
    );
    expect(mockResolvePendingOperation).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
      expect.objectContaining({ projectDeliveredCampaign: expect.any(Function) }),
    );
  });

  it("POST 1:1 mantém o caminho histórico sem projeção vertical", async () => {
    mockResolveFormat.mockResolvedValue({ kind: "1:1" });
    const res = await POST(request(validBody) as never);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(409);
    expect(res.status).not.toBe(500);
    expect(mockProjectionFor).not.toHaveBeenCalled();
    const deps = (
      mockResolvePendingOperation.mock.calls as unknown as [
        unknown,
        Record<string, unknown>,
      ][]
    )[0][1];
    expect("projectDeliveredCampaign" in deps).toBe(false);
  });

  it("POST 9:16 sem estado persistido NÃO injeta projeção (não inventa path)", async () => {
    mockResolveFormat.mockResolvedValue({ kind: "9:16" });
    mockFindPendingOperation.mockResolvedValueOnce(null as never);
    const res = await POST(request(validBody) as never);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(409);
    expect(res.status).not.toBe(500);
    expect(mockProjectionFor).not.toHaveBeenCalled();
  });
});
