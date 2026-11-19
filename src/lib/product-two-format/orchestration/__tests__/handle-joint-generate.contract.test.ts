// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  world: null as unknown as ReturnType<
    typeof import("./support/joint-offline-world").createJointOfflineWorld
  >,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  get supabaseAdmin() {
    return h.world?.client;
  },
  createServerClient: vi.fn(),
}));
vi.mock("@/lib/legal/clearance", () => ({
  requireLegalClearance: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/store-readiness", () => ({
  getStoreReadiness: vi.fn(async () => ({ ready: true, missing: [] })),
}));
vi.mock("@/lib/rate-limit/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: () => ({ rateLimitEnabled: false }),
}));
vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: class {
    async getBalance() {
      return 100;
    }
  },
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isProduct9_16TwoStageEnabled: vi.fn(async () => true),
}));

import type { NewFlowGenerateImageRequest } from "@/lib/image-generation/schema";
import { computeFrozenContentHash } from "../frozen-content";
import {
  attachJointResumeContext,
  buildJointInitialSnapshot,
} from "../joint-initial-snapshot";
import {
  buildJointResumeContext,
} from "../joint-resume-context";
import { handleJointGenerateRequest } from "../handle-joint-generate";
import type { TwoFormatEvent } from "../two-format-events";
import {
  CAMPAIGN_ID,
  OPERATION_ID,
  PRODUCT_DATA_URL,
  SQUARE_DELIVERY_ID,
  STORE_ID,
  createJointOfflineWorld,
  createJointWorldDeps,
} from "./support/joint-offline-world";

const WINNER_BASE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBMITTED_BASE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function uuidSequence(base: string = SUBMITTED_BASE): () => string {
  const values = [SQUARE_DELIVERY_ID, base];
  return () => values.shift() ?? base;
}

const newFlow: NewFlowGenerateImageRequest = {
  storeId: STORE_ID,
  productName: "Produto conjunto",
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
  campaignIntent: "offer",
  backgroundDirection: "studio",
  campaignFormat: "1:1+9:16",
  originalPriceCents: 9990,
  discountedPriceCents: 7990,
  badgeText: "Oferta",
  productImages: [
    {
      role: "primary",
      source: "upload",
      mimeType: "image/png",
      dataUrl: PRODUCT_DATA_URL,
    },
  ],
};

const economicSnapshot = {
  usdBrlRateAtGeneration: 5.1,
  creditValueBrlAtGeneration: 1,
};

let joint: Awaited<ReturnType<typeof createJointWorldDeps>>;

function seedStore() {
  h.world.rows.push({
    __table: "stores",
    id: STORE_ID,
    user_id: "user-1",
    name: "Loja Integrada",
    logo_url: null,
    segment: "variedades-utilidades",
    brand_color: "#123456",
    subsegment: null,
    tone_of_voice: "amigavel",
    positioning: null,
    short_description: null,
    slogan: null,
    identity_state: "text_only",
  });
}

function removeSeededCampaign() {
  const index = h.world.rows.findIndex(
    (row) => row.__table === "campaigns" && row.id === CAMPAIGN_ID,
  );
  if (index >= 0) h.world.rows.splice(index, 1);
}

function campaignRow() {
  return h.world.rows.find(
    (row) => row.__table === "campaigns" && row.id === CAMPAIGN_ID,
  );
}

function campaignSnapshot(): Record<string, unknown> {
  return campaignRow()?.input_snapshot as Record<string, unknown>;
}

function raceClient(options: {
  readonly winnerSnapshot: Record<string, unknown>;
  readonly winnerIdentity: Record<string, unknown> | null;
}) {
  let campaignSelects = 0;
  return {
    ...(h.world.client as unknown as Record<string, unknown>),
    from(table: string) {
      if (table !== "campaigns") {
        return (h.world.client as unknown as { from: (t: string) => unknown }).from(
          table,
        );
      }
      const base = (h.world.client as unknown as {
        from: (t: string) => {
          select: (columns?: string) => unknown;
          update: (patch: Record<string, unknown>) => unknown;
        };
      }).from("campaigns");
      return {
        select(columns?: string) {
          campaignSelects += 1;
          if (campaignSelects === 1) {
            return {
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            };
          }
          return base.select(columns);
        },
        insert() {
          return { error: { message: "duplicate key" } };
        },
        update: (patch: Record<string, unknown>) => base.update(patch),
      };
    },
  } as unknown as typeof h.world.client;
}

async function events(response: Response): Promise<TwoFormatEvent[]> {
  return (await response.text())
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TwoFormatEvent);
}

beforeEach(async () => {
  h.world = createJointOfflineWorld();
  h.world.seedScenario();
  removeSeededCampaign();
  seedStore();
  joint = await createJointWorldDeps(h.world);
});

describe("F60.7 C1 — helper → composition root → componentes reais", () => {
  it("cria o snapshot completo e a primeira base reconstrói sem falha", async () => {
    const response = await handleJointGenerateRequest(
      { newFlow, userId: "user-1" },
      {
        client: h.world.client,
        nineDeps: joint.nine.deps,
        uuid: uuidSequence(),
        economicSnapshot,
        requestStartedAtMs: h.world.clock(),
      },
    );
    const result = await events(response);

    expect(result.at(-1)).toMatchObject({
      type: "processing",
      nextStep: "expansion",
      operationTerminal: false,
    });
    expect(joint.counters.baseProviderCalls).toBe(1);

    const snapshot = campaignSnapshot();
    expect(snapshot.jointResumeContext).toBeDefined();
    expect(snapshot.resumeContext).toMatchObject({
      briefing: {
        commercial: expect.objectContaining({ intent: "offer" }),
        constraints: expect.any(Object),
      },
      economicSnapshot,
    });
    expect(snapshot.frozenContentReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "product", role: "primary", index: 0 }),
      ]),
    );
    const resume = snapshot.resumeContext as {
      inputFiles: Array<Record<string, unknown>>;
    };
    expect(resume.inputFiles[0]).toMatchObject({
      kind: "product",
      role: "primary",
      index: 0,
    });
    expect(typeof resume.inputFiles[0]?.storagePath).toBe("string");
  });

  it("replay do POST inicial com operação existente não gasta provider", async () => {
    const first = await handleJointGenerateRequest(
      { newFlow, userId: "user-1" },
      {
        client: h.world.client,
        nineDeps: joint.nine.deps,
        uuid: uuidSequence(),
        economicSnapshot,
        requestStartedAtMs: h.world.clock(),
      },
    );
    await events(first);
    expect(joint.counters.baseProviderCalls).toBe(1);

    const replay = await handleJointGenerateRequest(
      { newFlow, userId: "user-1" },
      {
        client: h.world.client,
        nineDeps: joint.nine.deps,
        uuid: uuidSequence(),
        economicSnapshot,
        requestStartedAtMs: h.world.clock(),
      },
    );
    const result = await events(replay);
    expect(result.at(-1)).toMatchObject({ type: "processing" });
    expect(joint.counters.baseProviderCalls).toBe(1);
  });

  it("falha definitiva da base conecta o finalize REAL e estorna", async () => {
    const failingNine = {
      ...joint.nine.deps,
      base: (async () => ({ kind: "definitive_failure" })) as never,
    };
    const response = await handleJointGenerateRequest(
      { newFlow, userId: "user-1" },
      {
        client: h.world.client,
        nineDeps: failingNine,
        uuid: uuidSequence(),
        economicSnapshot,
        requestStartedAtMs: h.world.clock(),
      },
    );
    const result = await events(response);
    expect(result.at(-1)).toMatchObject({
      type: "error",
      code: "joint_refunded",
      operationTerminal: true,
      refunded: true,
    });
    const refunded = h.world.rows.filter(
      (row) =>
        row.__table === "product_1_1_campaign_credit_operations" &&
        row.status === "refunded",
    );
    expect(refunded).toHaveLength(2);
    expect(h.world.outcome()).toMatchObject({ outcome: "failed" });
  });

  it("corrida adota o snapshot e a identidade VENCEDORES", async () => {
    const built = await buildJointInitialSnapshot({
      newFlow,
      client: h.world.client,
      economicSnapshot,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const winnerContext = buildJointResumeContext({
      operationId: OPERATION_ID,
      uuid: (() => {
        const values = [SQUARE_DELIVERY_ID, WINNER_BASE];
        return () => values.shift() ?? WINNER_BASE;
      })(),
    });
    const winnerSnapshot = attachJointResumeContext(
      built.inputSnapshot,
      winnerContext,
    );
    h.world.rows.push({
      __table: "campaigns",
      id: CAMPAIGN_ID,
      store_id: STORE_ID,
      status: "generating",
      input_snapshot: winnerSnapshot,
      identity_snapshot: built.identitySnapshot,
    });
    const client = raceClient({
      winnerSnapshot,
      winnerIdentity: built.identitySnapshot,
    });

    const response = await handleJointGenerateRequest(
      { newFlow, userId: "user-1" },
      {
        client,
        nineDeps: joint.nine.deps,
        uuid: uuidSequence(),
        economicSnapshot,
        requestStartedAtMs: h.world.clock(),
      },
    );
    const result = await events(response);
    expect(result.at(-1)).toMatchObject({ type: "processing" });

    // O claim da base usa a aquisição VENCEDORA, não a da requisição perdedora.
    const baseClaim = h.world
      .claims()
      .find((claim) => claim.stage === "base");
    expect(baseClaim?.request_id).toBe(WINNER_BASE);

    // E a campanha persistida continua sendo a vencedora, sem sobrescrita.
    expect(campaignSnapshot().jointResumeContext).toEqual(winnerContext);
  });

  it("corrida com conteúdo divergente é recusada sem abrir/reservar", async () => {
    const diverging = {
      ...newFlow,
      productName: "Produto divergente",
    };
    const built = await buildJointInitialSnapshot({
      newFlow: diverging,
      client: h.world.client,
      economicSnapshot,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const winnerSnapshot = attachJointResumeContext(
      built.inputSnapshot,
      buildJointResumeContext({ operationId: OPERATION_ID }),
    );
    h.world.rows.push({
      __table: "campaigns",
      id: CAMPAIGN_ID,
      store_id: STORE_ID,
      status: "generating",
      input_snapshot: winnerSnapshot,
      identity_snapshot: built.identitySnapshot,
    });
    const client = raceClient({
      winnerSnapshot,
      winnerIdentity: built.identitySnapshot,
    });

    const response = await handleJointGenerateRequest(
      { newFlow, userId: "user-1" },
      {
        client,
        nineDeps: joint.nine.deps,
        uuid: uuidSequence(),
        economicSnapshot,
        requestStartedAtMs: h.world.clock(),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "operation_identity_conflict" },
    });
    expect(h.world.claims()).toHaveLength(0);
    expect(joint.counters.baseProviderCalls).toBe(0);
  });

  it("identidade visual entra nos inputs duráveis e é reconstruída", async () => {
    const logoBytes = Buffer.from("durable-identity-logo-bytes");
    const logoPath = `${STORE_ID}/logo.png`;
    h.world.base.putObject(logoPath, logoBytes, {}, "store-brand-assets");
    const store = h.world.rows.find(
      (row) => row.__table === "stores" && row.id === STORE_ID,
    );
    if (!store) throw new Error("missing store");
    store.identity_state = "logo";
    h.world.rows.push({
      __table: "store_brand_assets",
      store_id: STORE_ID,
      status: "active",
      variant_type: "original",
      storage_path: logoPath,
    });
    const storage = h.world.client.storage as unknown as {
      from: (bucket: string) => Record<string, unknown>;
    };
    const originalFrom = storage.from.bind(storage);
    storage.from = (bucket: string) => {
      const handle = originalFrom(bucket);
      if (bucket !== "store-brand-assets") return handle;
      return {
        ...handle,
        createSignedUrl: async () => ({
          data: { signedUrl: "https://offline.test/logo.png" },
          error: null,
        }),
      };
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(logoBytes, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    try {
      const response = await handleJointGenerateRequest(
        { newFlow, userId: "user-1" },
        {
          client: h.world.client,
          nineDeps: joint.nine.deps,
          uuid: uuidSequence(),
          economicSnapshot,
          requestStartedAtMs: h.world.clock(),
        },
      );
      const result = await events(response);
      expect(result.at(-1)).toMatchObject({ type: "processing" });
      expect(joint.counters.baseProviderCalls).toBe(1);

      const snapshot = campaignSnapshot();
      const resume = snapshot.resumeContext as {
        inputFiles: Array<Record<string, unknown>>;
        identityDirective: string;
      };
      expect(resume.inputFiles).toHaveLength(2);
      expect(resume.inputFiles[1]).toMatchObject({
        kind: "identity",
        role: "identity",
        index: 1,
      });
      expect(resume.identityDirective.length).toBeGreaterThan(0);
      expect(campaignRow()?.identity_snapshot).toBeTruthy();
      expect(snapshot.frozenContentReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "identity", index: 1 }),
        ]),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("hash de conteúdo é estável e ignora as chaves voláteis", async () => {
    const built = await buildJointInitialSnapshot({
      newFlow,
      client: h.world.client,
      economicSnapshot,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const persisted = {
      ...built.inputSnapshot,
      jointResumeContext: {
        squareDeliveryId: OTHER,
        initialRequestIds: { base: OTHER },
      },
    } as Record<string, unknown>;
    const references = built.inputSnapshot
      .frozenContentReferences as readonly unknown[];
    const persistedWithoutVolatile: Record<string, unknown> = { ...persisted };
    delete persistedWithoutVolatile.jointResumeContext;
    delete persistedWithoutVolatile.resumeContext;
    delete persistedWithoutVolatile.frozenContentReferences;
    expect(
      computeFrozenContentHash(persistedWithoutVolatile, references),
    ).toBe(built.frozenContentHash);
  });
});
