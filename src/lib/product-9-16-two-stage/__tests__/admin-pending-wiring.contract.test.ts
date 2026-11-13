// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  adapter: {
    resolveFormat: vi.fn(async () => ({ kind: "9:16" })),
    verticalArtifacts: { probeArtifact: vi.fn() },
    twoStageArtifacts: { probeArtifact: vi.fn() },
    projectionFor: vi.fn(() => vi.fn()),
  },
  buildRepository: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/product-vertical-9-16/recovery/pending-adapter", () => ({
  createPendingFormatAdapter: () => h.adapter,
  buildAdminPendingRepository: h.buildRepository,
}));
vi.mock("@/lib/product-1-1/pending/resolve-pending-operation", () => ({
  listPendingOperations: vi.fn(async ({ repository }: { repository: unknown }) =>
    (repository as { listPendingOperations: () => Promise<unknown[]> }).listPendingOperations(),
  ),
  resolvePendingOperation: vi.fn(async () => ({
    campaignId: "c",
    operationId: "o",
    action: "deliver_existing_art",
    status: "delivered",
    artifactKind: "integral",
    idempotent: false,
  })),
  PendingOperationResolutionError: class extends Error {},
  resolutionErrorStatus: () => 500,
}));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/components/ui/error-state", () => ({
  ErrorState: () => null,
}));
vi.mock("@/app/(app)/admin/product-1-1-pending/resolution-form", () => ({
  PendingOperationsList: () => null,
  PendingReadOnlyNotice: () => null,
  PendingResolutionPanel: () => null,
}));

import { NextRequest } from "next/server";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";
const OPERATION = "00000000-0000-4000-8000-0000000000a1";
const STORE = "00000000-0000-4000-8000-0000000000b1";

function repository() {
  return {
    listPendingOperations: vi.fn(async () => []),
    findPendingOperation: vi.fn(async () => ({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      status: "reserved",
      amount: 1,
      terminal: false,
      unknown: false,
      failed: false,
      processing: false,
      stateEpoch: 0,
      publicationState: "none",
      supportReference: null,
      createdAt: null,
      updatedAt: null,
      latestAttemptAt: null,
      origin: "9_16_two_stage",
      stage: "expansion",
      format: "9:16",
    })),
    probeArtifact: vi.fn(async () => ({ kind: "integral" })),
  };
}

describe("wiring administrativo das três superfícies", () => {
  it("GET, POST e pagina constroem o repositorio pela mesma fabrica com twoStageArtifacts", async () => {
    const repo = repository();
    h.buildRepository.mockReturnValue(repo);

    const route = await import("@/app/api/admin/product-1-1-pending/route");
    const getResponse = await route.GET();
    expect(getResponse.status).toBe(200);

    const request = new NextRequest(
      "http://localhost/api/admin/product-1-1-pending",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          action: "deliver_existing_art",
          resolutionOperationId: "00000000-0000-4000-8000-0000000000d1",
          reason: "arte existente",
        }),
      },
    );
    const postResponse = await route.POST(request);
    expect(postResponse.status).toBe(200);

    const page = (await import("@/app/(app)/admin/product-1-1-pending/page")).default;
    await page();

    expect(h.buildRepository).toHaveBeenCalledTimes(3);
    for (const call of h.buildRepository.mock.calls) {
      expect(call[0]).toBe(h.adapter);
    }
    expect(repo.findPendingOperation).toHaveBeenCalled();
  });
});
