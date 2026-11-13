import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  client: null as Record<string, unknown> | null,
  adapter: null as Record<string, unknown> | null,
  squareProbe: null as ((input: unknown) => Promise<unknown>) | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "00000000-0000-4000-8000-0000000000ad" })),
}));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/supabase/server", () => {
  const proxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        const inner = h.client;
        if (!inner) return undefined;
        const value = inner[prop as string];
        return typeof value === "function" ? value.bind(inner) : value;
      },
    },
  );
  return { supabaseAdmin: proxy };
});
vi.mock("@/lib/product-vertical-9-16/recovery/pending-adapter", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/product-vertical-9-16/recovery/pending-adapter")
    >();
  return {
    ...actual,
    createPendingFormatAdapter: () => h.adapter,
  };
});
vi.mock("@/lib/product-1-1/artifact/artifact-store", () => ({
  ProductOneToOneArtifactStore: class {
    probeArtifact(input: unknown) {
      if (!h.squareProbe) throw new Error("square_probe_missing");
      return h.squareProbe(input);
    }
  },
}));

const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";
const OPERATION = "00000000-0000-4000-8000-0000000000a1";
const STORE = "00000000-0000-4000-8000-0000000000b1";
const RESOLUTION = "00000000-0000-4000-8000-0000000000d1";

type Row = Record<string, unknown>;

function chain(rows: Row[]) {
  let data = rows;
  const api = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      data = data.filter((row) => row[column] === value);
      return api;
    },
    in: (column: string, values: unknown[]) => {
      data = data.filter((row) => values.includes(row[column]));
      return api;
    },
    order: () => api,
    maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return api;
}

function tables(): Record<string, Row[]> {
  return {
    product_1_1_campaign_credit_operations: [
      {
        campaign_id: CAMPAIGN,
        operation_id: OPERATION,
        store_id: STORE,
        amount: 1,
        status: "reserved",
        state_epoch: 0,
        publication_state: "none",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    product_9_16_two_stage_operations: [
      { campaign_id: CAMPAIGN, operation_id: OPERATION },
    ],
    product_9_16_two_stage_steps: [
      { campaign_id: CAMPAIGN, operation_id: OPERATION, stage: "base", status: "done", attempts_used: 1, updated_at: "2026-01-01T00:00:00Z" },
      { campaign_id: CAMPAIGN, operation_id: OPERATION, stage: "expansion", status: "done", attempts_used: 1, updated_at: "2026-01-01T00:10:00Z" },
    ],
    product_generation_claim_history_v: [],
    product_generation_active_claims_v: [],
    product_generation_operation_outcomes_v: [],
  };
}

function client(rpcResult: unknown = null) {
  const data = tables();
  const rpc = vi.fn(async () => ({ data: rpcResult, error: null }));
  return { from: (table: string) => chain(data[table] ?? []), rpc };
}

function request() {
  return new NextRequest("http://localhost/api/admin/product-1-1-pending", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      action: "deliver_existing_art",
      resolutionOperationId: RESOLUTION,
      reason: "arte existente",
    }),
  });
}

describe("rota administrativa x origem de duas etapas", () => {
  beforeEach(() => {
    h.squareProbe = vi.fn(async () => ({
      kind: "integral",
      ref: { storagePath: "quadrada", width: 1024, height: 1024, mimeType: "image/jpeg" },
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
      storagePath: "quadrada",
    }));
    h.adapter = {
      resolveFormat: vi.fn(async () => ({ kind: "9:16" })),
      // A sonda DIRETA não é usada para a origem de duas etapas.
      verticalArtifacts: { probeArtifact: vi.fn(async () => ({ kind: "integral" })) },
      // A sonda de COMPOSIÇÃO não encontra a arte vertical final.
      twoStageArtifacts: { probeArtifact: vi.fn(async () => ({ kind: "absent" })) },
      projectionFor: vi.fn(() => vi.fn()),
    };
  });

  it("base quadrada existente NÃO autoriza entrega administrativa de origem nova", async () => {
    const controlled = client();
    h.client = controlled as unknown as Record<string, unknown>;
    const { POST } = await import("@/app/api/admin/product-1-1-pending/route");

    const response = await POST(request());
    expect(response.status).not.toBe(200);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("insufficient_evidence");
    // Nunca cai na sonda quadrada nem chama a RPC administrativa.
    expect(h.squareProbe).not.toHaveBeenCalled();
    expect(controlled.rpc).not.toHaveBeenCalled();
  });

  it("composicao integral resolve a entrega sem tocar a sonda quadrada/direta", async () => {
    h.adapter = {
      resolveFormat: vi.fn(async () => ({ kind: "9:16" })),
      verticalArtifacts: { probeArtifact: vi.fn(async () => ({ kind: "absent" })) },
      twoStageArtifacts: { probeArtifact: vi.fn(async () => ({ kind: "integral" })) },
      projectionFor: vi.fn(() => vi.fn(async () => ({ projected: true, reason: "projected" }))),
    };
    const controlled = client({
      success: true,
      campaign_id: CAMPAIGN,
      operation_id: OPERATION,
      action: "deliver_existing_art",
      status: "delivered",
      idempotent: false,
    });
    h.client = controlled as unknown as Record<string, unknown>;
    const { POST } = await import("@/app/api/admin/product-1-1-pending/route");

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(
      (h.adapter as { twoStageArtifacts: { probeArtifact: { mock: { calls: unknown[] } } } })
        .twoStageArtifacts.probeArtifact.mock.calls,
    ).toHaveLength(1);
    expect(
      (h.adapter as { verticalArtifacts: { probeArtifact: { mock: { calls: unknown[] } } } })
        .verticalArtifacts.probeArtifact.mock.calls,
    ).toHaveLength(0);
    expect(h.squareProbe).not.toHaveBeenCalled();
    expect(
      (h.adapter as { projectionFor: { mock: { calls: unknown[] } } }).projectionFor.mock.calls,
    ).toHaveLength(1);
  });
});
