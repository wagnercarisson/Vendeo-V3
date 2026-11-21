// @vitest-environment node
/**
 * F61 (61-03) — MATRIZ do detalhe `/campanhas/[id]`.
 *
 * Prova, executando a PÁGINA REAL (server component):
 * - apresentação por fluxo (conjunto, novo fluxo, legado, aprovação, indeterminado);
 * - `?format=` estrito (inválido/vazio/duplicado/não entregue);
 * - chip ativo SOMENTE com preview/arte efetivamente exibidos;
 * - hrefs SOMENTE para formatos `delivered`;
 * - snapshot nulo/malformado/indeterminado sem fallback para `1:1`;
 * - ZERO chamadas adicionais: contagens por fixture comparadas ao baseline do
 *   plano 61-01 (mesmos mocks/fixtures fixos; nenhum I/O real).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const CONTROL_OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_OPERATION = "44444444-4444-4444-8444-444444444444";

const JOINT_SNAPSHOT = {
  frozenContentReferences: [],
  campaignFormat: "1:1+9:16",
  formatContractVersion: "f60.7-two-format-v1",
  generationOrigin: "two_format_two_stage",
  generationContractVersion: "f60.7-two-format-v1",
} as const;

const NEW_FLOW_SQUARE_SNAPSHOT = { frozenContentReferences: [] } as const;

const NEW_FLOW_VERTICAL_SNAPSHOT = {
  frozenContentReferences: [],
  campaignFormat: "9:16",
  formatContractVersion: "f59-vertical-9-16-v1",
} as const;

const VERTICAL_EXPANSION_SNAPSHOT = {
  frozenContentReferences: [],
  campaignFormat: "9:16",
  formatContractVersion: "f59-vertical-9-16-v1",
  generationOrigin: "9_16_two_stage",
  generationContractVersion: "f60.5-two-stage-9-16-v1",
} as const;

const LEGACY_SNAPSHOT = { product: { name: "Produto legado" } } as const;

const h = vi.hoisted(() => {
  const counters: Record<string, number> = {
    control: 0,
    delivery: 0,
    durable: 0,
    attemptStart: 0,
    signedPreview: 0,
    copyDelivery: 0,
    copyCancellation: 0,
    copyRecovery: 0,
    artifactProbes: 0,
    signedArtifactUrls: 0,
    createSignedUrl: 0,
    from: 0,
  };

  return {
    counters,
    campaign: {} as Record<string, unknown>,
    operation: null as unknown,
    controlResult: null as unknown,
    deliveryResult: null as unknown,
    outcomesResult: null as unknown,
    approvalEnabled: false,
    versions: [] as unknown[],
    probeKind: "missing" as "missing" | "integral",
    signedUrlMode: "ok" as "ok" | "null",
    reset(): void {
      for (const key of Object.keys(counters)) counters[key] = 0;
      this.approvalEnabled = false;
      this.versions = [];
      this.probeKind = "missing";
      this.signedUrlMode = "ok";
      this.outcomesResult = {
        kind: "found",
        unknownOperationIds: new Set<string>(),
        controlSupportReference: null,
      };
    },
    snapshot(): Record<string, number> {
      return { ...counters };
    },
  };
});

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: async () => ({ userId: "user-1" }),
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: async () => ({ id: STORE_ID, user_id: "user-1" }),
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: async () => ({ ok: true, locale: "pt-BR" }),
}));

vi.mock("@/lib/campaign/display", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/campaign/display")>();
  return {
    ...actual,
    getCampaignForDisplay: async () => h.campaign,
    generateSignedPreviewUrl: async (storagePath: string) => {
      h.counters.signedPreview += 1;
      return actual.generateSignedPreviewUrl(storagePath);
    },
  };
});

vi.mock("@/lib/campaign/persistence", () => ({
  listArtVersions: async () => h.versions,
}));

vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: async () => h.approvalEnabled,
}));

vi.mock("@/lib/campaign/correction-reports", () => ({
  getCorrectionReport: async () => null,
}));

vi.mock("@/lib/product-1-1/snapshot/persist-snapshot", () => ({
  readProductOneToOneBackgroundDirection: async () => null,
}));

vi.mock("@/lib/product-two-format/control-reader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/product-two-format/control-reader")>();
  return {
    ...actual,
    resolveTwoFormatControlOperation: async () => {
      h.counters.control += 1;
      return h.controlResult;
    },
    readTwoFormatDurableOutcomes: async () => {
      h.counters.durable += 1;
      return h.outcomesResult;
    },
  };
});

vi.mock("@/lib/product-two-format/delivery-reader", () => ({
  readTwoFormatDelivery: async () => {
    h.counters.delivery += 1;
    return h.deliveryResult;
  },
}));

vi.mock("@/lib/product-1-1/copy/copy-state", () => ({
  readCopyDelivery: async () => {
    h.counters.copyDelivery += 1;
    return null;
  },
  readCopyCancellation: async () => {
    h.counters.copyCancellation += 1;
    return null;
  },
  readCopyRecoverySummary: async () => {
    h.counters.copyRecovery += 1;
    return {
      state: null,
      attemptSeq: 0,
      attemptActive: false,
      waitRemainingMs: 0,
      autoAttempts: 0,
      manualAttempts: 0,
      definitive: false,
    };
  },
}));

vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    async getCampaignOperation() {
      h.counters.attemptStart += 1;
      return h.operation;
    }
  },
}));

vi.mock("@/lib/product-1-1/artifact/artifact-store", () => ({
  ProductOneToOneArtifactStore: class {
    async probeArtifact() {
      h.counters.artifactProbes += 1;
      return h.probeKind === "integral"
        ? { kind: "integral", storagePath: "s/art.jpg" }
        : { kind: "missing" };
    }
    async getSignedArtifactUrl() {
      h.counters.signedArtifactUrls += 1;
      return "https://signed/artifact";
    }
  },
}));

vi.mock("@/lib/product-vertical-9-16/artifact/artifact-store", () => ({
  VerticalArtifactStore: class {
    async probeArtifact() {
      h.counters.artifactProbes += 1;
      return h.probeKind === "integral"
        ? { kind: "integral", storagePath: "s/vertical.jpg" }
        : { kind: "missing" };
    }
    async getSignedArtifactUrl() {
      h.counters.signedArtifactUrls += 1;
      return "https://signed/vertical-artifact";
    }
  },
}));

vi.mock("@/lib/product-9-16-two-stage/orchestration/vertical-access", () => ({
  nineSixteenVerticalAccess: async () => ({
    kind: "previewUrl",
    url: "https://signed/vertical-preview",
  }),
}));

vi.mock("@/lib/supabase/server", () => {
  function makeQueryRow(): Record<string, unknown> {
    const query: Record<string, unknown> = {};
    const chain = (): Record<string, unknown> => query;
    query.select = chain;
    query.eq = chain;
    query.in = chain;
    query.order = chain;
    query.range = chain;
    query.limit = chain;
    query.maybeSingle = async () => ({ data: null, error: null });
    query.then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(resolve, reject);
    return query;
  }

  return {
    createServerClient: async () => ({
      from: () => {
        h.counters.from += 1;
        return makeQueryRow();
      },
    }),
    supabaseAdmin: {
      from: () => {
        h.counters.from += 1;
        return makeQueryRow();
      },
      storage: {
        from: () => ({
          createSignedUrl: async (path: string) => {
            h.counters.createSignedUrl += 1;
            if (h.signedUrlMode === "null") {
              return { data: null, error: null };
            }
            return {
              data: { signedUrl: `https://signed/${path}` },
              error: null,
            };
          },
        }),
      },
    },
  };
});

function campaignRecord(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: CAMPAIGN_ID,
    store_id: STORE_ID,
    product_name: "Produto teste",
    status: "ready",
    input_snapshot: JOINT_SNAPSHOT,
    identity_snapshot: null,
    generation_metadata: null,
    render_snapshot: null,
    publication_copy_snapshot: null,
    publication_copy_current: null,
    storage_path: null,
    error_message: null,
    approval_status: "pending_approval",
    rejection_count: 0,
    approved_version_id: null,
    approved_at: null,
    operation_run_id: null,
    created_at: "2026-11-19T00:00:00.000Z",
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function jointView() {
  return {
    origin: "two_format_two_stage",
    campaignId: CAMPAIGN_ID,
    operationId: CONTROL_OPERATION,
    square: {
      format: "1:1",
      state: "delivered",
      creditRefunded: false,
      deliveryOperationId: SQUARE_OPERATION,
      artifactRole: "square_original",
      artifactPath: `${STORE_ID}/${CAMPAIGN_ID}/${CONTROL_OPERATION}/square_original.jpg`,
      supportReference: null,
    },
    vertical: {
      format: "9:16",
      state: "delivered",
      creditRefunded: false,
      deliveryOperationId: CONTROL_OPERATION,
      artifactRole: "vertical",
      artifactPath: `${STORE_ID}/${CAMPAIGN_ID}/${CONTROL_OPERATION}/vertical.jpg`,
      supportReference: null,
    },
    preferredThumbnail: null,
  };
}

type View = ReturnType<typeof jointView>;

function setState(
  view: View,
  format: "square" | "vertical",
  state: string,
  refunded = false,
): View {
  const next = structuredClone(view) as unknown as {
    square: Record<string, unknown>;
    vertical: Record<string, unknown>;
  };
  const slot = next[format];
  slot.state = state;
  slot.creditRefunded = refunded;
  if (state !== "delivered") {
    slot.artifactRole = null;
    slot.artifactPath = null;
  }
  return next as unknown as View;
}

function jointFixture(view: View = jointView()) {
  h.campaign = campaignRecord({ input_snapshot: JOINT_SNAPSHOT });
  h.operation = null;
  h.controlResult = { kind: "found", operationId: CONTROL_OPERATION };
  h.deliveryResult = { kind: "found", view };
  h.outcomesResult = {
    kind: "found",
    unknownOperationIds: new Set<string>(),
    controlSupportReference: null,
  };
}

async function renderProps(format?: string | string[]) {
  const { default: CampaignDetailPage } = await import(
    "@/app/(app)/campanhas/[id]/page"
  );
  const element = (await CampaignDetailPage({
    params: Promise.resolve({ id: CAMPAIGN_ID }),
    searchParams: Promise.resolve(format === undefined ? {} : { format }),
  })) as unknown as { props: Record<string, unknown> };
  return element.props;
}

interface PresentationShape {
  readonly formats: Readonly<
    Record<
      "1:1" | "9:16",
      { readonly state: string; readonly active: boolean }
    >
  >;
  readonly flow: string;
  readonly partial: boolean;
}

function presentation(props: Record<string, unknown>): PresentationShape {
  return props.formatPresentation as PresentationShape;
}

beforeEach(() => {
  h.reset();
  h.campaign = campaignRecord();
  h.operation = null;
  h.controlResult = { kind: "not_found" };
  h.deliveryResult = { kind: "not_found" };
});

describe("F61 — detalhe conjunto", () => {
  it("dois entregues: ativo segue `?format=` e hrefs cobrem os dois", async () => {
    jointFixture();

    const props = await renderProps("9:16");

    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: false,
    });
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "delivered",
      active: true,
    });
    expect(presentation(props)).toMatchObject({
      flow: "two_format",
      partial: false,
    });
    expect(props.formatHrefs).toEqual({
      "1:1": `/campanhas/${CAMPAIGN_ID}?format=1:1`,
      "9:16": `/campanhas/${CAMPAIGN_ID}?format=9:16`,
    });
  });

  it("sem `?format=` o preferido entregue é o ativo", async () => {
    jointFixture();

    const props = await renderProps();

    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: true,
    });
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "delivered",
      active: false,
    });
  });

  it("previewFormat presente com `previewUrl` nulo ⇒ entregue SEM ativo", async () => {
    jointFixture();
    h.signedUrlMode = "null";

    const props = await renderProps("9:16");

    expect(props.imageUrl).toBeNull();
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "delivered",
      active: false,
    });
    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: false,
    });
  });

  it("parcial estornada: ausente com crédito devolvido, sem href e ativo no entregue", async () => {
    jointFixture(setState(jointView(), "vertical", "absent", true));

    const props = await renderProps();

    expect(presentation(props)).toMatchObject({
      flow: "two_format",
      partial: true,
      anyDelivered: true,
    });
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "absent",
      active: false,
      refunded: true,
    });
    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: true,
    });
    expect(props.formatHrefs).toEqual({
      "1:1": `/campanhas/${CAMPAIGN_ID}?format=1:1`,
    });
  });

  it.each([
    ["inválido", "bogus"],
    ["vazio", ""],
    ["duplicado", ["1:1", "9:16"]],
  ])("`?format=` %s falha fechado: sem ativo e sem preview/download", async (_label, format) => {
    jointFixture();

    const props = await renderProps(format as string | string[]);

    expect(props.imageUrl).toBeNull();
    expect(props.downloadDisabled).toBe(true);
    expect(presentation(props).formats["1:1"].active).toBe(false);
    expect(presentation(props).formats["9:16"].active).toBe(false);
    // Os estados entregues continuam honestos e os hrefs existem (não há
    // seleção inventada, mas o formato entregue segue acessível).
    expect(presentation(props).formats["1:1"].state).toBe("delivered");
    expect(presentation(props).formats["9:16"].state).toBe("delivered");
  });

  it("`?format=` de formato NÃO entregue não vira o irmão nem ganha link", async () => {
    const view = setState(jointView(), "vertical", "absent");
    jointFixture(view);

    const props = await renderProps("9:16");

    expect(props.imageUrl).toBeNull();
    expect(props.downloadDisabled).toBe(true);
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "absent",
      active: false,
    });
    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: false,
    });
    expect(props.formatHrefs).toEqual({
      "1:1": `/campanhas/${CAMPAIGN_ID}?format=1:1`,
    });
  });

  it("controle ausente ⇒ ambos `unavailable`", async () => {
    jointFixture();
    h.controlResult = { kind: "not_found" };

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unavailable");
    expect(presentation(props).formats["9:16"].state).toBe("unavailable");
    expect(props.formatHrefs).toBeUndefined();
  });

  it("leitura conjunta falha ⇒ ambos `unknown`", async () => {
    jointFixture();
    h.deliveryResult = { kind: "not_found" };

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unknown");
    expect(presentation(props).formats["9:16"].state).toBe("unknown");
    expect(props.formatHrefs).toBeUndefined();
  });

  it("snapshot conjunto `inconsistent` ⇒ ambos `unavailable`", async () => {
    h.campaign = campaignRecord({
      input_snapshot: {
        frozenContentReferences: [],
        campaignFormat: "1:1+9:16",
        formatContractVersion: "f60.7-two-format-v1",
      },
    });

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unavailable");
    expect(presentation(props).formats["9:16"].state).toBe("unavailable");
  });

  it("NÃO gera chamadas adicionais na conjunta (baseline 61-01)", async () => {
    jointFixture();

    await renderProps("9:16");

    expect(h.snapshot()).toEqual({
      control: 1,
      delivery: 1,
      durable: 1,
      attemptStart: 0,
      signedPreview: 0,
      copyDelivery: 1,
      copyCancellation: 0,
      copyRecovery: 0,
      artifactProbes: 0,
      signedArtifactUrls: 0,
      createSignedUrl: 1,
      from: 0,
    });
  });
});

describe("F61 — detalhe do NOVO fluxo (individual)", () => {
  function newFlowFixture(
    snapshot: Record<string, unknown> | string | null,
    status: "reserved" | "delivered" | "refunded",
    extra: Record<string, unknown> = {},
  ) {
    h.campaign = campaignRecord({
      input_snapshot: snapshot,
      status: "ready",
      ...extra,
    });
    h.operation = {
      operationId: CONTROL_OPERATION,
      status,
      unknown: false,
      outcome: null,
      supportReference: null,
    };
    h.controlResult = { kind: "not_found" };
    h.deliveryResult = { kind: "not_found" };
  }

  it("delivered com arte exibida ⇒ 1:1 entregue e ATIVO; outro não incluído", async () => {
    newFlowFixture(NEW_FLOW_SQUARE_SNAPSHOT, "delivered");
    h.probeKind = "integral";

    const props = await renderProps();

    expect(props.imageUrl).toBe("https://signed/artifact");
    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: true,
    });
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "absent",
      reason: "not_requested",
      active: false,
    });
    expect(presentation(props).flow).toBe("single_format");
    expect(presentation(props).partial).toBe(false);
    expect(props.formatHrefs).toBeUndefined();
  });

  it("delivered SEM arte exibida ⇒ entregue porém SEM ativo", async () => {
    newFlowFixture(NEW_FLOW_SQUARE_SNAPSHOT, "delivered");
    h.probeKind = "missing";

    const props = await renderProps();

    expect(props.imageUrl).toBeNull();
    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: false,
    });
  });

  it("running ⇒ processando, sem ativo", async () => {
    newFlowFixture(NEW_FLOW_SQUARE_SNAPSHOT, "reserved");

    const props = await renderProps();

    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "processing",
      active: false,
    });
    expect(presentation(props).formats["9:16"].state).toBe("absent");
  });

  it("refunded ⇒ ausente com crédito devolvido, sem ativo", async () => {
    newFlowFixture(NEW_FLOW_SQUARE_SNAPSHOT, "refunded");

    const props = await renderProps();

    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "absent",
      refunded: true,
      active: false,
    });
    expect(presentation(props).formats["9:16"].state).toBe("absent");
  });

  it("unknown (operação ilegível) ⇒ ambos `unknown`, sem recuperação inventada", async () => {
    newFlowFixture(NEW_FLOW_SQUARE_SNAPSHOT, "delivered");
    h.operation = null;

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unknown");
    expect(presentation(props).formats["9:16"].state).toBe("unknown");
  });

  it("vertical por expansão ⇒ 9:16 conforme ciclo, 1:1 `not_requested`", async () => {
    newFlowFixture(VERTICAL_EXPANSION_SNAPSHOT, "delivered");

    const props = await renderProps();

    expect(props.imageUrl).toBe("https://signed/vertical-preview");
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "delivered",
      active: true,
    });
    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "absent",
      reason: "not_requested",
      active: false,
    });
    expect(presentation(props).partial).toBe(false);
  });

  it("vertical 9:16 delivered sem arte ⇒ entregue sem ativo", async () => {
    newFlowFixture(NEW_FLOW_VERTICAL_SNAPSHOT, "delivered");
    h.probeKind = "missing";

    const props = await renderProps();

    expect(props.imageUrl).toBeNull();
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "delivered",
      active: false,
    });
  });

  it("resolução individual `unavailable` ⇒ ambos `unavailable` (sem fallback 1:1)", async () => {
    newFlowFixture(
      { frozenContentReferences: [], campaignFormat: "bogus" },
      "delivered",
    );
    h.probeKind = "integral";

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unavailable");
    expect(presentation(props).formats["9:16"].state).toBe("unavailable");
    expect(presentation(props).formats["1:1"].active).toBe(false);
    expect(presentation(props).formats["9:16"].active).toBe(false);
    expect(props.formatHrefs).toBeUndefined();
  });

  it("NÃO gera chamadas adicionais no novo fluxo (baseline 61-01)", async () => {
    newFlowFixture(NEW_FLOW_SQUARE_SNAPSHOT, "delivered");
    h.probeKind = "missing";

    await renderProps();

    expect(h.snapshot()).toEqual({
      control: 0,
      delivery: 0,
      durable: 0,
      attemptStart: 1,
      signedPreview: 0,
      copyDelivery: 1,
      copyCancellation: 0,
      copyRecovery: 1,
      artifactProbes: 1,
      signedArtifactUrls: 0,
      createSignedUrl: 0,
      from: 0,
    });
  });
});

describe("F61 — detalhe LEGADO", () => {
  function legacyFixture(
    snapshot: Record<string, unknown> | string | Array<unknown> | null,
    status: "ready" | "generating" | "error",
    storagePath: string | null = null,
    updatedAt = new Date().toISOString(),
  ) {
    h.campaign = campaignRecord({
      input_snapshot: snapshot,
      status,
      storage_path: storagePath,
      updated_at: updatedAt,
    });
    h.operation = null;
    h.controlResult = { kind: "not_found" };
    h.deliveryResult = { kind: "not_found" };
  }

  it("legado quadrado pronto com arte ⇒ 1:1 entregue e ativo", async () => {
    legacyFixture(LEGACY_SNAPSHOT, "ready", `${STORE_ID}/${CAMPAIGN_ID}.jpg`);

    const props = await renderProps();

    expect(props.imageUrl).not.toBeNull();
    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: true,
    });
    expect(presentation(props).formats["9:16"]).toMatchObject({
      state: "absent",
      reason: "not_requested",
      active: false,
    });
  });

  it("legado ready SEM arte ⇒ entregue sem ativo", async () => {
    legacyFixture(LEGACY_SNAPSHOT, "ready", null);

    const props = await renderProps();

    expect(props.imageUrl).toBeNull();
    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: false,
    });
  });

  it("legado generating ⇒ processando, sem ativo", async () => {
    legacyFixture(LEGACY_SNAPSHOT, "generating", null);

    const props = await renderProps();

    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "processing",
      active: false,
    });
  });

  it("legado stale ⇒ `unknown` (nunca ausência)", async () => {
    legacyFixture(
      LEGACY_SNAPSHOT,
      "generating",
      null,
      "2020-01-01T00:00:00.000Z",
    );

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unknown");
    expect(presentation(props).formats["9:16"].state).toBe("absent");
  });

  it("legado error ⇒ `unknown` (nunca ausência)", async () => {
    legacyFixture(LEGACY_SNAPSHOT, "error", null);

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unknown");
    expect(presentation(props).formats["9:16"].state).toBe("absent");
  });

  it("snapshot NULO ⇒ resolver `malformed_format` ⇒ ambos `unavailable`", async () => {
    legacyFixture(null, "ready", `${STORE_ID}/${CAMPAIGN_ID}.jpg`);

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unavailable");
    expect(presentation(props).formats["9:16"].state).toBe("unavailable");
  });

  it.each([
    ["formato desconhecido", { product: {}, campaignFormat: "bogus" }],
    ["9:16 sem versão", { product: {}, campaignFormat: "9:16" }],
    [
      "par incoerente",
      { product: {}, formatContractVersion: "f59-vertical-9-16-v1" },
    ],
  ])("snapshot objeto malformado (%s) ⇒ ambos `unavailable`", async (_label, snapshot) => {
    legacyFixture(snapshot, "ready", null);

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unavailable");
    expect(presentation(props).formats["9:16"].state).toBe("unavailable");
  });

  it.each([["não-objeto", "not-an-object"], ["array", ["1:1"]]])(
    "snapshot %s ⇒ fluxo INDETERMINADO ⇒ ambos `unknown`",
    async (_label, snapshot) => {
      legacyFixture(snapshot as unknown as Record<string, unknown>, "ready", null);

      const props = await renderProps();

      expect(presentation(props).formats["1:1"].state).toBe("unknown");
      expect(presentation(props).formats["9:16"].state).toBe("unknown");
    },
  );

  it("NÃO gera chamadas adicionais no legado (baseline 61-01)", async () => {
    legacyFixture(
      null,
      "ready",
      `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
    );

    await renderProps();

    expect(h.snapshot()).toEqual({
      control: 0,
      delivery: 0,
      durable: 0,
      attemptStart: 1,
      signedPreview: 1,
      copyDelivery: 0,
      copyCancellation: 0,
      copyRecovery: 0,
      artifactProbes: 0,
      signedArtifactUrls: 0,
      createSignedUrl: 1,
      from: 0,
    });
  });
});

describe("F61 — aprovação e regeneração (legado)", () => {
  function approvalFixture(
    status: "pending" | "regenerating",
    snapshot: Record<string, unknown> = LEGACY_SNAPSHOT,
  ) {
    h.campaign = campaignRecord({
      input_snapshot: snapshot,
      status: "ready",
      storage_path: null,
    });
    h.approvalEnabled = true;
    h.versions = [
      {
        id: "v1",
        version_number: 1,
        asset_status: "active",
        storage_path: `${STORE_ID}/${CAMPAIGN_ID}/candidate.jpg`,
        correction_in_progress: status === "regenerating",
      },
    ];
    h.operation = null;
    h.controlResult = { kind: "not_found" };
    h.deliveryResult = { kind: "not_found" };
  }

  it("pending COM candidata ⇒ entregue, SEM ativo", async () => {
    approvalFixture("pending");

    const props = await renderProps();

    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "delivered",
      active: false,
    });
    // Gate existente preservado: nenhuma URL de arte principal é inventada.
    expect(props.imageUrl).toBeNull();
  });

  it("regenerating ⇒ processando, SEM ativo", async () => {
    approvalFixture("regenerating");

    const props = await renderProps();

    expect(presentation(props).formats["1:1"]).toMatchObject({
      state: "processing",
      active: false,
    });
  });

  it("resolução `unavailable` VENCE aprovação/regeneração ⇒ ambos indisponíveis", async () => {
    approvalFixture("regenerating", {
      product: {},
      campaignFormat: "bogus",
    });

    const props = await renderProps();

    expect(presentation(props).formats["1:1"].state).toBe("unavailable");
    expect(presentation(props).formats["9:16"].state).toBe("unavailable");
    expect(presentation(props).formats["1:1"].active).toBe(false);
  });
});
