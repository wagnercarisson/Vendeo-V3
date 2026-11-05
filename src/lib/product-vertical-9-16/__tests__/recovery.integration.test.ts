// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const { mockProjectDelivered } = vi.hoisted(() => ({
  mockProjectDelivered: vi.fn(async (_input?: unknown, _deps?: unknown) => ({
    campaignId: "c",
    ready: true,
    finalArtifactPath: "p",
  })),
}));
vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: mockProjectDelivered,
}));

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FormatUnavailableError,
  SupabasePendingOperationsRepository,
  type PendingArtifactProber,
} from "@/lib/product-1-1/pending/pending-operations-repository";
import { ProductOneToOneArtifactRecovery } from "@/lib/product-1-1/artifact/artifact-recovery";
import { resolvePendingOperation } from "@/lib/product-1-1/pending/resolve-pending-operation";
import {
  resolveRecoveryProfile,
  type RecoveryProfile,
} from "@/lib/product-vertical-9-16/recovery/format-dispatch";
import { createPendingFormatAdapter } from "@/lib/product-vertical-9-16/recovery/pending-adapter";
import { artifactStoragePath } from "@/lib/product-vertical-9-16/artifact/artifact-path";
import { makeVerticalProjection } from "@/lib/product-vertical-9-16/orchestration/entrypoint";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_SQUARE = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_VERTICAL = "33333333-3333-4333-8333-333333333333";
const OPERATION_SQUARE = "44444444-4444-4444-8444-444444444444";
const OPERATION_VERTICAL = "55555555-5555-4555-8555-555555555555";

interface CreditRow {
  campaign_id: string;
  operation_id: string;
  store_id: string;
  amount: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

function creditRow(campaignId: string, operationId: string): CreditRow {
  return {
    campaign_id: campaignId,
    operation_id: operationId,
    store_id: STORE_ID,
    amount: 1,
    status: "art_uploaded",
    created_at: "2026-10-12T00:00:00.000Z",
    updated_at: "2026-10-12T00:00:00.000Z",
  };
}

function createFakeClient(options: {
  rows?: CreditRow[];
  snapshots?: Record<string, unknown>;
}) {
  const rows = options.rows ?? [];
  const snapshots = options.snapshots ?? {};
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    const filters: Record<string, string> = {};
    const self = () => chain;
    chain.select = vi.fn(self);
    chain.eq = vi.fn((column: string, value: string) => {
      filters[column] = value;
      return chain;
    });
    chain.in = vi.fn(self);
    chain.order = vi.fn(self);
    chain.maybeSingle = vi.fn(async () => {
      if (table === "campaigns") {
        return {
          data: { input_snapshot: snapshots[CAMPAIGN_VERTICAL] ?? null },
          error: null,
        };
      }
      return {
        data:
          rows.find(
            (row) =>
              row.campaign_id === filters.campaign_id &&
              row.operation_id === filters.operation_id,
          ) ?? null,
        error: null,
      };
    });
    chain.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(
        table === "product_1_1_campaign_credit_operations"
          ? { data: rows, error: null }
          : { data: [], error: null },
      ).then(resolve);
    return chain;
  });
  return { from, rpc: vi.fn(), storage: { from: vi.fn() } } as unknown as SupabaseClient;
}

function fakeProber(kind: "integral" | "absent" | "invalid" | "indeterminate" = "integral"): PendingArtifactProber & {
  probeArtifact: ReturnType<typeof vi.fn>;
} {
  return {
    probeArtifact: vi.fn(async () =>
      kind === "integral"
        ? {
            kind: "integral" as const,
            ref: { storagePath: "vertical-path", width: 1080, height: 1920, mimeType: "image/jpeg" },
            width: 1080,
            height: 1920,
            mimeType: "image/jpeg",
            storagePath: "vertical-path",
          }
        : { kind },
    ),
  };
}

describe("F59/59-06 — despacho de formato no repositório de pendências", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sem resolvedor mantém o histórico 1:1 (sonda quadrada)", async () => {
    const client = createFakeClient({ rows: [creditRow(CAMPAIGN_SQUARE, OPERATION_SQUARE)] });
    const oneToOne = fakeProber("integral");
    const repo = new SupabasePendingOperationsRepository(client, oneToOne);

    const found = await repo.findPendingOperation(CAMPAIGN_SQUARE, OPERATION_SQUARE);
    expect(found?.format).toBe("1:1");
    await expect(
      repo.probeArtifact(STORE_ID, CAMPAIGN_SQUARE, OPERATION_SQUARE),
    ).resolves.toMatchObject({ kind: "integral" });
    expect(oneToOne.probeArtifact).toHaveBeenCalledTimes(1);
  });

  it("9:16 usa a sonda vertical; 1:1 usa a sonda quadrada", async () => {
    const client = createFakeClient({
      rows: [creditRow(CAMPAIGN_SQUARE, OPERATION_SQUARE)],
    });
    const oneToOne = fakeProber("integral");
    const vertical = fakeProber("absent");
    const repo = new SupabasePendingOperationsRepository(client, oneToOne, {
      resolveFormat: async (campaignId) => ({
        kind: campaignId === CAMPAIGN_VERTICAL ? "9:16" : "1:1",
      }),
      verticalArtifacts: vertical,
    });

    await expect(
      repo.probeArtifact(STORE_ID, CAMPAIGN_VERTICAL, OPERATION_VERTICAL),
    ).resolves.toMatchObject({ kind: "absent" });
    expect(vertical.probeArtifact).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_VERTICAL,
      operationId: OPERATION_VERTICAL,
    });

    await expect(
      repo.probeArtifact(STORE_ID, CAMPAIGN_SQUARE, OPERATION_SQUARE),
    ).resolves.toMatchObject({ kind: "integral" });
    expect(oneToOne.probeArtifact).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_SQUARE,
      operationId: OPERATION_SQUARE,
    });
  });

  it("formato indisponível falha fechado na sonda (sem cair em 1:1)", async () => {
    const client = createFakeClient({ rows: [creditRow(CAMPAIGN_SQUARE, OPERATION_SQUARE)] });
    const oneToOne = fakeProber("integral");
    const repo = new SupabasePendingOperationsRepository(client, oneToOne, {
      resolveFormat: async () => ({ kind: "unavailable" }),
    });

    await expect(
      repo.probeArtifact(STORE_ID, CAMPAIGN_SQUARE, OPERATION_SQUARE),
    ).rejects.toBeInstanceOf(FormatUnavailableError);
    expect(oneToOne.probeArtifact).not.toHaveBeenCalled();
  });

  it("erro do resolvedor também falha fechado", async () => {
    const client = createFakeClient({ rows: [creditRow(CAMPAIGN_SQUARE, OPERATION_SQUARE)] });
    const oneToOne = fakeProber("integral");
    const repo = new SupabasePendingOperationsRepository(client, oneToOne, {
      resolveFormat: async () => {
        throw new Error("boom");
      },
    });

    await expect(
      repo.probeArtifact(STORE_ID, CAMPAIGN_SQUARE, OPERATION_SQUARE),
    ).rejects.toBeInstanceOf(FormatUnavailableError);
    expect(oneToOne.probeArtifact).not.toHaveBeenCalled();
  });

  it("a lista expõe o formato por linha e marca indisponibilidade sem derrubar as demais", async () => {
    const client = createFakeClient({
      rows: [
        creditRow(CAMPAIGN_SQUARE, OPERATION_SQUARE),
        creditRow(CAMPAIGN_VERTICAL, OPERATION_VERTICAL),
      ],
    });
    const oneToOne = fakeProber("integral");
    const vertical = fakeProber("integral");
    const repo = new SupabasePendingOperationsRepository(client, oneToOne, {
      resolveFormat: async (campaignId) => ({
        kind:
          campaignId === CAMPAIGN_VERTICAL
            ? "9:16"
            : campaignId === CAMPAIGN_SQUARE
              ? "1:1"
              : "unavailable",
      }),
      verticalArtifacts: vertical,
    });

    const views = await repo.listPendingOperations();
    expect(views).toHaveLength(2);
    expect(views[0]).toMatchObject({ format: "1:1", artifactKind: "integral" });
    expect(views[1]).toMatchObject({ format: "9:16", artifactKind: "integral" });
    expect(vertical.probeArtifact).toHaveBeenCalledTimes(1);
  });

  it("a lista marca `formatUnavailable`/`indeterminate` quando a resolução falha", async () => {
    const client = createFakeClient({ rows: [creditRow(CAMPAIGN_SQUARE, OPERATION_SQUARE)] });
    const repo = new SupabasePendingOperationsRepository(client, fakeProber("integral"), {
      resolveFormat: async () => ({ kind: "unavailable" }),
    });

    const views = await repo.listPendingOperations();
    expect(views[0]).toMatchObject({
      format: null,
      formatUnavailable: true,
      artifactKind: "indeterminate",
    });
  });
});

describe("F59/59-06 — resolução de formato e perfis", () => {
  it("o adaptador lê o snapshot persistido: 9:16, 1:1 histórico e indisponível", async () => {
    const snapshots: Record<string, unknown> = {
      [CAMPAIGN_VERTICAL]: {
        campaignFormat: "9:16",
        formatContractVersion: "f59-vertical-9-16-v1",
      },
      [CAMPAIGN_SQUARE]: {},
    };
    let selected = "";
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn((_column: string, value: string) => {
      selected = value;
      return chain;
    });
    chain.maybeSingle = vi.fn(async () => ({
      data: selected in snapshots ? { input_snapshot: snapshots[selected] } : null,
      error: null,
    }));
    const adapterClient = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
    const adapter = createPendingFormatAdapter({ client: adapterClient });

    await expect(adapter.resolveFormat(CAMPAIGN_VERTICAL)).resolves.toEqual({ kind: "9:16" });
    await expect(adapter.resolveFormat(CAMPAIGN_SQUARE)).resolves.toEqual({ kind: "1:1" });
    await expect(adapter.resolveFormat("unknown")).resolves.toEqual({ kind: "unavailable" });
  });

  it("resolveRecoveryProfile escolhe o perfil vertical/quadrado e falha fechado", () => {
    const oneToOne: RecoveryProfile = {
      format: "1:1",
      prober: fakeProber(),
      projection: mockProjectDelivered as never,
    };
    const vertical: RecoveryProfile = {
      format: "9:16",
      prober: fakeProber(),
      projection: mockProjectDelivered as never,
    };

    expect(
      resolveRecoveryProfile({
        resolution: { kind: "1:1", source: "absent" },
        oneToOne,
        vertical,
      }),
    ).toEqual({ kind: "profile", profile: oneToOne });
    expect(
      resolveRecoveryProfile({
        resolution: {
          kind: "9:16",
          contractVersion: "f59-vertical-9-16-v1",
        },
        oneToOne,
        vertical,
      }),
    ).toEqual({ kind: "profile", profile: vertical });
    expect(
      resolveRecoveryProfile({
        resolution: { kind: "unavailable", reason: "malformed_format" },
        oneToOne,
        vertical,
      }),
    ).toMatchObject({ kind: "unavailable", reason: { reason: "malformed_format" } });
  });

  it("makeVerticalProjection injeta o path vertical esperado e o cliente", async () => {
    const client = createFakeClient({});
    const projection = makeVerticalProjection(
      STORE_ID,
      CAMPAIGN_VERTICAL,
      OPERATION_VERTICAL,
      { client },
    );

    await projection({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_VERTICAL,
      operationId: OPERATION_VERTICAL,
    });

    expect(mockProjectDelivered).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: STORE_ID,
        campaignId: CAMPAIGN_VERTICAL,
        operationId: OPERATION_VERTICAL,
        expectedArtifactPath: artifactStoragePath(
          STORE_ID,
          CAMPAIGN_VERTICAL,
          OPERATION_VERTICAL,
        ),
      }),
      { client },
    );
  });
});

describe("F59/59-06 — recuperação vertical sem regeneração", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sonda vertical integral → entrega confirmada → projeção vertical", async () => {
    const client = createFakeClient({});
    const verticalProbe = fakeProber("integral");
    const projection = vi.fn(async () => ({ campaignId: CAMPAIGN_VERTICAL }));
    const credit = {
      get: vi.fn(async () => ({
        campaignId: CAMPAIGN_VERTICAL,
        operationId: OPERATION_VERTICAL,
        status: "art_uploaded" as const,
      })),
      confirmExistingArt: vi.fn(async () => ({
        campaignId: CAMPAIGN_VERTICAL,
        operationId: OPERATION_VERTICAL,
        status: "delivered" as const,
      })),
    };

    const result = await new ProductOneToOneArtifactRecovery(client, {
      artifacts: verticalProbe,
      credit,
      projectDeliveredCampaign: projection as never,
    }).recoverDelivery({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_VERTICAL,
      operationId: OPERATION_VERTICAL,
    });

    expect(result).toMatchObject({ outcome: "delivered", kind: "integral", status: "delivered" });
    expect(verticalProbe.probeArtifact).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_VERTICAL,
      operationId: OPERATION_VERTICAL,
    });
    expect(credit.confirmExistingArt).toHaveBeenCalledWith(
      CAMPAIGN_VERTICAL,
      OPERATION_VERTICAL,
      "integral",
    );
    expect(projection).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_VERTICAL,
      operationId: OPERATION_VERTICAL,
    });
  });

  it.each([
    ["invalid", "unresolved", "invalid"],
    ["absent", "absent", "absent"],
    ["indeterminate", "unresolved", "indeterminate"],
  ] as const)(
    "sonda %s ⇒ %s, sem entregar nem projetar",
    async (kind, outcome, resultKind) => {
      const client = createFakeClient({});
      const credit = {
        get: vi.fn(),
        confirmExistingArt: vi.fn(),
      };
      const projection = vi.fn(async () => ({ campaignId: CAMPAIGN_VERTICAL }));

      const result = await new ProductOneToOneArtifactRecovery(client, {
        artifacts: fakeProber(kind),
        credit,
        projectDeliveredCampaign: projection as never,
      }).recoverDelivery({
        storeId: STORE_ID,
        campaignId: CAMPAIGN_VERTICAL,
        operationId: OPERATION_VERTICAL,
      });

      expect(result).toMatchObject({ outcome, kind: resultKind });
      expect(credit.get).not.toHaveBeenCalled();
      expect(credit.confirmExistingArt).not.toHaveBeenCalled();
      expect(projection).not.toHaveBeenCalled();
    },
  );

  it("resolução administrativa `deliver_existing_art` projeta o path vertical esperado", async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: {
          success: true,
          idempotent: false,
          campaign_id: CAMPAIGN_VERTICAL,
          operation_id: OPERATION_VERTICAL,
          action: "deliver_existing_art",
          status: "delivered",
          art_kind: "integral",
        },
        error: null,
      })),
    } as unknown as SupabaseClient;
    const verticalProbe = fakeProber("integral");
    const repository = {
      findPendingOperation: vi.fn(async () => ({
        campaignId: CAMPAIGN_VERTICAL,
        operationId: OPERATION_VERTICAL,
        storeId: STORE_ID,
        status: "art_uploaded" as const,
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
        format: "9:16" as const,
      })),
      probeArtifact: (storeId: string, campaignId: string, operationId: string) =>
        verticalProbe.probeArtifact({ storeId, campaignId, operationId }),
      listPendingOperations: vi.fn(async () => []),
    };
    mockProjectDelivered.mockClear();
    const projection = makeVerticalProjection(
      STORE_ID,
      CAMPAIGN_VERTICAL,
      OPERATION_VERTICAL,
      { client },
    );

    const resolution = await resolvePendingOperation(
      {
        actorId: "99999999-9999-4999-8999-999999999999",
        campaignId: CAMPAIGN_VERTICAL,
        operationId: OPERATION_VERTICAL,
        action: "deliver_existing_art",
        reason: "arte vertical existente",
        resolutionOperationId: "66666666-6666-4666-8666-666666666666",
      },
      { client, repository, projectDeliveredCampaign: projection },
    );

    expect(resolution).toMatchObject({ status: "delivered", action: "deliver_existing_art" });
    expect(mockProjectDelivered).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedArtifactPath: artifactStoragePath(
          STORE_ID,
          CAMPAIGN_VERTICAL,
          OPERATION_VERTICAL,
        ),
      }),
      { client },
    );
    expect(
      (
        mockProjectDelivered.mock.calls[0][0] as {
          expectedArtifactPath: string;
        }
      ).expectedArtifactPath,
    ).toMatch(/product-9-16\/[0-9a-f-]+\/art-1080x1920\.jpg$/);
  });
});
