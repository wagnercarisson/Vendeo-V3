// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: vi.fn(async () => ({
    projected: true,
    reason: "projected",
  })),
}));
vi.mock("@/lib/product-1-1/orchestration/project-closed-campaign", () => ({
  projectClosedCampaign: vi.fn(async () => ({
    projected: true,
    reason: "projected",
  })),
}));

import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import {
  TwoStageFinancialError,
  TwoStageFinancialService,
} from "../two-stage-financial-service";
import type { VerticalArtifactProbe } from "../two-stage-financial-service";

const authority = {
  campaignId: "c",
  operationId: "o",
  storeId: "s",
  amount: 1,
  status: "reserved" as const,
  terminal: false,
  delivered: false,
  refunded: false,
  reserved: true,
  stateEpoch: 0,
  publicationState: "none",
};

const integralProbe: VerticalArtifactProbe = {
  probeVerticalArtifact: vi.fn(async () => ({
    kind: "integral" as const,
    format: "9:16" as const,
    width: 1080 as const,
    height: 1920 as const,
    mimeType: "image/jpeg" as const,
    storagePath: "s/c/o/vertical.jpg",
    evidenceRef: "ref",
  })),
};

function serviceWith(resolvePending: ReturnType<typeof vi.fn>) {
  const repository = { marker: "service-repository" };
  const service = new TwoStageFinancialService({
    client: { rpc: vi.fn(), from: vi.fn() } as never,
    repository: repository as never,
    resolvePending: resolvePending as never,
  });
  vi.spyOn(service, "readFinancialAuthority").mockResolvedValue(authority);
  return { service, repository };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "admin",
    campaignId: "c",
    operationId: "o",
    decision: "deliver" as const,
    reason: "manual",
    resolutionOperationId: "r",
    verticalArtifactProbe: integralProbe,
    ...overrides,
  };
}

describe("resolveUnknown artifact source", () => {
  beforeEach(() => {
    vi.mocked(projectDeliveredCampaign).mockClear();
  });

  it("repasses the composition source and the expected path to the projection", async () => {
    const resolvePending = vi.fn(async (..._args: unknown[]) => ({
      campaignId: "c",
      operationId: "o",
      action: "deliver_existing_art",
      status: "delivered",
      artifactKind: "integral",
      idempotent: false,
    }));
    const { service } = serviceWith(resolvePending);

    await service.resolveUnknown(
      baseInput({
        deliveredArtifactSource: {
          kind: "composition",
          role: "vertical",
          expectedPath: "s/c/o/vertical.jpg",
        },
      }),
    );

    const deps = resolvePending.mock.calls[0][1] as {
      projectDeliveredCampaign: (
        input: Record<string, unknown>,
        deps?: Record<string, unknown>,
      ) => Promise<unknown>;
    };
    await deps.projectDeliveredCampaign({ storeId: "s", campaignId: "c", operationId: "o" });
    expect(projectDeliveredCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        expectedArtifactPath: "s/c/o/vertical.jpg",
        source: {
          kind: "composition",
          role: "vertical",
          expectedPath: "s/c/o/vertical.jpg",
        },
      }),
      expect.anything(),
    );
  });

  it("defaults to the product_1_1 source (absent = legacy behavior)", async () => {
    const resolvePending = vi.fn(async (..._args: unknown[]) => ({
      campaignId: "c",
      operationId: "o",
      action: "deliver_existing_art",
      status: "delivered",
      artifactKind: "integral",
      idempotent: false,
    }));
    const { service } = serviceWith(resolvePending);
    await service.resolveUnknown(baseInput());

    const deps = resolvePending.mock.calls[0][1] as {
      projectDeliveredCampaign: (
        input: Record<string, unknown>,
        deps?: Record<string, unknown>,
      ) => Promise<unknown>;
    };
    await deps.projectDeliveredCampaign({ storeId: "s", campaignId: "c", operationId: "o" });
    const lastCall = vi.mocked(projectDeliveredCampaign).mock.calls.at(-1)?.[0];
    expect(lastCall).not.toHaveProperty("source");
  });

  it("uses a per-call repository override and a composition prober", async () => {
    const resolvePending = vi.fn(async (..._args: unknown[]) => ({
      campaignId: "c",
      operationId: "o",
      action: "deliver_existing_art",
      status: "delivered",
      artifactKind: "integral",
      idempotent: false,
    }));
    const { service, repository } = serviceWith(resolvePending);
    const override = { marker: "override" };

    await service.resolveUnknown(baseInput({ repository: override }));
    expect((resolvePending.mock.calls[0][1] as { repository: unknown }).repository).toBe(
      override,
    );

    const prober = { probeArtifact: vi.fn() };
    await service.resolveUnknown(baseInput({ twoStageArtifacts: prober }));
    const used = (resolvePending.mock.calls[1][1] as { repository: unknown }).repository;
    expect(used).not.toBe(repository);
    expect(used).not.toBe(prober);
  });

  it("requires the vertical probe for a deliver decision", async () => {
    const resolvePending = vi.fn();
    const { service } = serviceWith(resolvePending);
    await expect(
      service.resolveUnknown(baseInput({ verticalArtifactProbe: undefined })),
    ).rejects.toBeInstanceOf(TwoStageFinancialError);
    expect(resolvePending).not.toHaveBeenCalled();
  });

  it("does not project a delivery for a refund decision", async () => {
    const resolvePending = vi.fn(async (..._args: unknown[]) => ({
      campaignId: "c",
      operationId: "o",
      action: "refund_once",
      status: "refunded",
      artifactKind: "absent",
      idempotent: false,
    }));
    const { service } = serviceWith(resolvePending);
    await service.resolveUnknown(
      baseInput({ decision: "refund", verticalArtifactProbe: undefined }),
    );
    // O serviço não projeta entrega por conta própria; a decisão é do resolvePending.
    expect(projectDeliveredCampaign).not.toHaveBeenCalled();
  });
});
