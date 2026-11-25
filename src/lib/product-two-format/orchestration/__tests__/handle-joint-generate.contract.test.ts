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

function setStoreIdentityState(
  state: "text_only" | "logo" | "visual_signature",
) {
  const store = h.world.rows.find(
    (row) => row.__table === "stores" && row.id === STORE_ID,
  );
  if (!store) throw new Error("missing store");
  store.identity_state = state;
}

function seedBrandProfile(typographyDirection: string | null) {
  h.world.rows.push({
    __table: "store_brand_profiles",
    store_id: STORE_ID,
    status: "synced",
    source: "text_only",
    brand_colors_chosen: ["#242422"],
    safe_color_tokens: { primary: "#242422" },
    inferred_primary_color: null,
    typography_direction: typographyDirection,
    visual_style: null,
    visual_tone: null,
    brand_personality: null,
    campaign_guidelines: null,
    campaign_brief: null,
  });
}

function wrapSignedUrl(bucket: string, signedUrl: string) {
  const storage = h.world.client.storage as unknown as {
    from: (bucket: string) => Record<string, unknown>;
  };
  const originalFrom = storage.from.bind(storage);
  storage.from = (requested: string) => {
    const handle = originalFrom(requested);
    if (requested !== bucket) return handle;
    return {
      ...handle,
      createSignedUrl: async () => ({
        data: { signedUrl },
        error: null,
      }),
    };
  };
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
      nextStep: "square_delivery",
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
    // Perfil com tipografia disponível: o modo `logo` não deve receber a linha
    // tipográfica (ela é exclusiva do `text_only`).
    seedBrandProfile("Serifada editorial elegante");
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
      // Quick 261125-i09 — `logo` com arquivo recebe a redação oficial uma única
      // vez na montagem inicial conjunta.
      const logoHead =
        'Use obrigatoriamente o logotipo oficial da loja "Loja Integrada", fornecido como imagem de referência de identidade.';
      expect(resume.identityDirective).toContain(logoHead);
      expect(resume.identityDirective.split(logoHead)).toHaveLength(2);
      // Não recebe as redações dos outros modos, nem direção tipográfica.
      expect(resume.identityDirective).not.toContain(
        "Inclua obrigatoriamente o nome da loja",
      );
      expect(resume.identityDirective).not.toContain(
        "Use obrigatoriamente a assinatura visual oficial da loja",
      );
      expect(resume.identityDirective).not.toContain("Direção tipográfica");
      expect(resume.identityDirective).toContain("Paleta da loja");
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

  it("montagem inicial conjunta: text_only + tipografia ⇒ instruções aprovadas uma única vez", async () => {
    seedBrandProfile("Serifada editorial elegante");

    const built = await buildJointInitialSnapshot({
      newFlow,
      client: h.world.client,
      economicSnapshot,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const directive = built.resumeContext.identityDirective ?? "";
    const head =
      'Inclua obrigatoriamente o nome da loja "Loja Integrada" como identificação institucional, em texto legível.';
    const typography =
      "Direção tipográfica da loja: Serifada editorial elegante.";

    expect(directive).toContain(head);
    expect(directive.split(head)).toHaveLength(2);
    expect(directive).toContain(typography);
    expect(directive.split(typography)).toHaveLength(2);
    expect(directive).not.toContain(
      "Não colocar logotipo. Não gerar assinatura visual.",
    );
    expect(directive).toContain('Paleta da loja "Loja Integrada"');
    expect(directive).toContain("#242422");
    // Congelamento existente: snapshot e resumeContext carregam a MESMA diretiva.
    expect(built.inputSnapshot.identityDirective).toBe(directive);
  });

  it("montagem inicial conjunta: text_only sem tipografia ⇒ sem linha tipográfica", async () => {
    seedBrandProfile(null);

    const built = await buildJointInitialSnapshot({
      newFlow,
      client: h.world.client,
      economicSnapshot,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const directive = built.resumeContext.identityDirective ?? "";
    expect(directive).toContain(
      'Inclua obrigatoriamente o nome da loja "Loja Integrada"',
    );
    expect(directive).not.toContain("Direção tipográfica");
    expect(directive).not.toContain("Não colocar logotipo.");
  });

  it("montagem inicial conjunta: logo sem arquivo mantém o fallback anterior", async () => {
    setStoreIdentityState("logo");

    const built = await buildJointInitialSnapshot({
      newFlow,
      client: h.world.client,
      economicSnapshot,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const directive = built.resumeContext.identityDirective ?? "";
    expect(directive).toContain("Não inventar logotipo.");
    expect(directive).not.toContain(
      "Use obrigatoriamente o logotipo oficial da loja",
    );
    expect(directive).not.toContain("Inclua obrigatoriamente o nome da loja");
    expect(directive).not.toContain("Direção tipográfica");
  });

  it("montagem inicial conjunta: visual_signature sem arquivo mantém o fallback anterior", async () => {
    setStoreIdentityState("visual_signature");

    const built = await buildJointInitialSnapshot({
      newFlow,
      client: h.world.client,
      economicSnapshot,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const directive = built.resumeContext.identityDirective ?? "";
    expect(directive).toContain("Não inventar assinatura visual nem logotipo.");
    expect(directive).not.toContain(
      "Use obrigatoriamente a assinatura visual oficial da loja",
    );
    expect(directive).not.toContain("Inclua obrigatoriamente o nome da loja");
    expect(directive).not.toContain("Direção tipográfica");
  });

  it("montagem inicial conjunta: visual_signature com arquivo recebe a instrução oficial uma única vez", async () => {
    const signatureBytes = Buffer.from("durable-visual-signature-bytes");
    const signaturePath = `${STORE_ID}/signature.png`;
    h.world.base.putObject(signaturePath, signatureBytes, {}, "visual-signatures");
    setStoreIdentityState("visual_signature");
    // Perfil com tipografia disponível: `visual_signature` não recebe a linha.
    seedBrandProfile("Serifada editorial elegante");
    h.world.rows.push({
      __table: "store_visual_signatures",
      id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
      store_id: STORE_ID,
      status: "active",
      storage_path: signaturePath,
    });
    wrapSignedUrl("visual-signatures", "https://offline.test/signature.png");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(signatureBytes, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    try {
      const built = await buildJointInitialSnapshot({
        newFlow,
        client: h.world.client,
        economicSnapshot,
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const directive = built.resumeContext.identityDirective ?? "";
      const head =
        'Use obrigatoriamente a assinatura visual oficial da loja "Loja Integrada", fornecida como imagem de referência de identidade.';
      expect(directive).toContain(head);
      expect(directive.split(head)).toHaveLength(2);
      expect(directive).not.toContain(
        "Use obrigatoriamente o logotipo oficial da loja",
      );
      expect(directive).not.toContain("Inclua obrigatoriamente o nome da loja");
      expect(directive).not.toContain("Direção tipográfica");
      expect(built.inputSnapshot.identityDirective).toBe(directive);
      expect(built.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "identity", role: "identity", index: 1 }),
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
