// @vitest-environment node
/**
 * Fase 61 — EVIDÊNCIA de baseline de chamadas (fora de `src/`).
 *
 * Mede, com fixtures e mocks fixos, quantas chamadas reais cada superfície faz
 * HOJE (antes dos chips): lista, dashboard e detalhe. O objetivo futuro é provar
 * comparativamente que os chips introduzem ZERO chamadas adicionais.
 *
 * Idempotência:
 * - grava `baseline-calls.json` somente com `BASELINE_CAPTURE=1` ou quando o
 *   arquivo ainda não existe (bootstrap);
 * - em modo leitura, LÊ o JSON imutável e assere `toEqual`.
 *
 * Nenhum acesso a banco, Storage, homolog ou produção: todo I/O é mock.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

type Counters = Record<string, number>;

interface BaselineRow {
  readonly id: string;
  readonly product_name: string;
  readonly status: string;
  readonly created_at: string;
  readonly storage_path: string;
  readonly input_snapshot: Record<string, unknown> | null;
}

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const LEGACY_ONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEGACY_TWO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOINT_ONE = "22222222-2222-4222-8222-222222222222";
const JOINT_TWO = "22222222-2222-4222-8222-222222222223";
const JOINT_THREE = "22222222-2222-4222-8222-222222222224";
const CONTROL_OPERATION = "33333333-3333-4333-8333-333333333333";

const JOINT_SNAPSHOT = {
  frozenContentReferences: [],
  campaignFormat: "1:1+9:16",
  formatContractVersion: "f60.7-two-format-v1",
  generationOrigin: "two_format_two_stage",
  generationContractVersion: "f60.7-two-format-v1",
} as const;

const NEW_FLOW_SNAPSHOT = { frozenContentReferences: [] } as const;

const h = vi.hoisted(() => {
  const counters: Counters = {
    from: 0,
    readTwoFormatListSummaries: 0,
    createSignedUrl: 0,
    createSignedUrls: 0,
    generateBatchPreferredThumbnailUrls: 0,
    generateBatchThumbnailUrls: 0,
    resolveTwoFormatControlOperation: 0,
    readTwoFormatDelivery: 0,
    readTwoFormatDurableOutcomes: 0,
    ProductOneToOneAttemptStartClient: 0,
    generateSignedPreviewUrl: 0,
    readCopyDelivery: 0,
    readCopyCancellation: 0,
    readCopyRecoverySummary: 0,
    artifactProbes: 0,
    signedArtifactUrls: 0,
  };

  return {
    counters,
    queryRows: [] as unknown[],
    queryCount: 0,
    summaries: new Map<string, unknown>(),
    detailCampaign: null as unknown,
    detailOperation: null as unknown,
    controlResult: null as unknown,
    deliveryResult: null as unknown,
    outcomesResult: null as unknown,
    reset(): void {
      for (const key of Object.keys(counters)) counters[key] = 0;
    },
  };
});

vi.mock("server-only", () => ({}));

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
    query.ilike = chain;
    query.gte = chain;
    query.lte = chain;
    query.then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve({
        data: h.queryRows,
        count: h.queryCount,
        error: null,
      }).then(resolve, reject);
    query.maybeSingle = async () => ({ data: null, error: null });
    return query;
  }

  return {
    createServerClient: async () => ({
      from: () => {
        h.counters.from += 1;
        return makeQueryRow();
      },
      rpc: async () => ({ data: null, error: null }),
    }),
    supabaseAdmin: {
      from: () => {
        h.counters.from += 1;
        return makeQueryRow();
      },
      rpc: async () => ({ data: null, error: null }),
      storage: {
        from: () => ({
          createSignedUrl: async (path: string) => {
            h.counters.createSignedUrl += 1;
            return { data: { signedUrl: `https://signed/${path}` }, error: null };
          },
          createSignedUrls: async (paths: string[]) => {
            h.counters.createSignedUrls += 1;
            return {
              data: paths.map((path) => ({
                path,
                signedUrl: `https://signed/${path}`,
                error: null,
              })),
              error: null,
            };
          },
          download: async () => ({
            data: null,
            error: { message: "not_found" },
          }),
        }),
      },
    },
  };
});

vi.mock("@/lib/product-two-format/list-summary", () => ({
  readTwoFormatListSummaries: async (input: {
    campaigns: ReadonlyArray<{ id: string }>;
  }) => {
    h.counters.readTwoFormatListSummaries += 1;
    const result = new Map<string, unknown>();
    for (const campaign of input.campaigns) {
      const summary = h.summaries.get(campaign.id);
      if (summary) result.set(campaign.id, summary);
    }
    return result;
  },
}));

vi.mock("@/lib/campaign/list", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/campaign/list")>();
  return {
    ...actual,
    generateBatchPreferredThumbnailUrls: async (
      ...args: Parameters<typeof actual.generateBatchPreferredThumbnailUrls>
    ) => {
      h.counters.generateBatchPreferredThumbnailUrls += 1;
      return actual.generateBatchPreferredThumbnailUrls(...args);
    },
    generateBatchThumbnailUrls: async (
      ...args: Parameters<typeof actual.generateBatchThumbnailUrls>
    ) => {
      h.counters.generateBatchThumbnailUrls += 1;
      return actual.generateBatchThumbnailUrls(...args);
    },
  };
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: async () => ({ userId: "user-1" }),
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "user-1",
  }),
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: async () => ({ ok: true, locale: "pt-BR" }),
}));

vi.mock("@/lib/campaign/display", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/campaign/display")>();
  return {
    ...actual,
    getCampaignForDisplay: async () => h.detailCampaign,
    generateSignedPreviewUrl: async (storagePath: string) => {
      h.counters.generateSignedPreviewUrl += 1;
      return actual.generateSignedPreviewUrl(storagePath);
    },
  };
});

vi.mock("@/lib/campaign/persistence", () => ({
  listArtVersions: async () => [],
}));

vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: async () => false,
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
      h.counters.resolveTwoFormatControlOperation += 1;
      return h.controlResult;
    },
    readTwoFormatDurableOutcomes: async () => {
      h.counters.readTwoFormatDurableOutcomes += 1;
      return h.outcomesResult;
    },
  };
});

vi.mock("@/lib/product-two-format/delivery-reader", () => ({
  readTwoFormatDelivery: async () => {
    h.counters.readTwoFormatDelivery += 1;
    return h.deliveryResult;
  },
}));

vi.mock("@/lib/product-1-1/copy/copy-state", () => ({
  readCopyDelivery: async () => {
    h.counters.readCopyDelivery += 1;
    return null;
  },
  readCopyCancellation: async () => {
    h.counters.readCopyCancellation += 1;
    return null;
  },
  readCopyRecoverySummary: async () => {
    h.counters.readCopyRecoverySummary += 1;
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
      h.counters.ProductOneToOneAttemptStartClient += 1;
      return h.detailOperation;
    }
  },
}));

vi.mock("@/lib/product-1-1/artifact/artifact-store", () => ({
  ProductOneToOneArtifactStore: class {
    async probeArtifact() {
      h.counters.artifactProbes += 1;
      return { kind: "missing" };
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
      return { kind: "missing" };
    }
    async getSignedArtifactUrl() {
      h.counters.signedArtifactUrls += 1;
      return "https://signed/artifact";
    }
  },
}));

function legacyRow(id: string, storagePath: string): BaselineRow {
  return {
    id,
    product_name: `Legado ${id.slice(0, 4)}`,
    status: "ready",
    created_at: "2026-11-19T00:00:00.000Z",
    storage_path: storagePath,
    input_snapshot: null,
  };
}

function jointRow(id: string): BaselineRow {
  return {
    id,
    product_name: `Conjunta ${id.slice(-1)}`,
    status: "ready",
    created_at: "2026-11-19T00:00:00.000Z",
    storage_path: `${STORE_ID}/${id}.jpg`,
    input_snapshot: { ...JOINT_SNAPSHOT },
  };
}

function summaryFor(id: string): Record<string, unknown> {
  return {
    campaignId: id,
    operationId: CONTROL_OPERATION,
    formats: { "1:1": "delivered", "9:16": "delivered" },
    preferredFormat: "1:1",
    preferredThumbnailPath: `${STORE_ID}/${id}/${CONTROL_OPERATION}/square_original.thumb-v1.webp`,
    view: null,
  };
}

function summariesFor(ids: readonly string[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const id of ids) map.set(id, summaryFor(id));
  return map;
}

async function runList(
  rows: readonly BaselineRow[],
  summaries: Map<string, unknown>,
): Promise<Record<string, number>> {
  h.reset();
  h.queryRows = [...rows];
  h.queryCount = rows.length;
  h.summaries = summaries;
  const { listCampaigns } = await import("@/lib/campaign/list");
  await listCampaigns("store-1");
  return {
    from: h.counters.from,
    readTwoFormatListSummaries: h.counters.readTwoFormatListSummaries,
    createSignedUrl: h.counters.createSignedUrl,
    createSignedUrls: h.counters.createSignedUrls,
  };
}

async function runDashboard(
  rows: readonly BaselineRow[],
  summaries: Map<string, unknown>,
): Promise<Record<string, number>> {
  h.reset();
  h.queryRows = [...rows];
  h.queryCount = rows.length;
  h.summaries = summaries;
  const { queryEligibleCampaigns } = await import("@/lib/dashboard/campaigns");
  await queryEligibleCampaigns("store-1");
  return {
    from: h.counters.from,
    readTwoFormatListSummaries: h.counters.readTwoFormatListSummaries,
    generateBatchPreferredThumbnailUrls:
      h.counters.generateBatchPreferredThumbnailUrls,
    generateBatchThumbnailUrls: h.counters.generateBatchThumbnailUrls,
  };
}

interface DetailConfig {
  readonly campaign: Record<string, unknown>;
  readonly operation: unknown;
  readonly controlResult: unknown;
  readonly deliveryResult: unknown;
  readonly outcomesResult: unknown;
}

async function runDetail(config: DetailConfig): Promise<Record<string, number>> {
  h.reset();
  h.detailCampaign = config.campaign;
  h.detailOperation = config.operation;
  h.controlResult = config.controlResult;
  h.deliveryResult = config.deliveryResult;
  h.outcomesResult = config.outcomesResult;

  const { default: CampaignDetailPage } = await import(
    "@/app/(app)/campanhas/[id]/page"
  );
  const element = (await CampaignDetailPage({
    params: Promise.resolve({ id: String(config.campaign.id) }),
    searchParams: Promise.resolve({}),
  })) as unknown as { props: Record<string, unknown> };

  expect(element.props).toBeTruthy();

  return {
    resolveTwoFormatControlOperation:
      h.counters.resolveTwoFormatControlOperation,
    readTwoFormatDelivery: h.counters.readTwoFormatDelivery,
    readTwoFormatDurableOutcomes: h.counters.readTwoFormatDurableOutcomes,
    ProductOneToOneAttemptStartClient:
      h.counters.ProductOneToOneAttemptStartClient,
    generateSignedPreviewUrl: h.counters.generateSignedPreviewUrl,
    readCopyDelivery: h.counters.readCopyDelivery,
    readCopyCancellation: h.counters.readCopyCancellation,
    readCopyRecoverySummary: h.counters.readCopyRecoverySummary,
    artifactProbes: h.counters.artifactProbes,
    createSignedUrl: h.counters.createSignedUrl,
  };
}

function jointView(): Record<string, unknown> {
  const base = {
    creditRefunded: false,
    supportReference: null,
  };
  return {
    origin: "two_format_two_stage",
    campaignId: JOINT_ONE,
    operationId: CONTROL_OPERATION,
    square: {
      ...base,
      format: "1:1",
      state: "delivered",
      deliveryOperationId: "44444444-4444-4444-8444-444444444444",
      artifactRole: "square_original",
      artifactPath: `${STORE_ID}/${JOINT_ONE}/${CONTROL_OPERATION}/square_original.jpg`,
    },
    vertical: {
      ...base,
      format: "9:16",
      state: "delivered",
      deliveryOperationId: CONTROL_OPERATION,
      artifactRole: "vertical",
      artifactPath: `${STORE_ID}/${JOINT_ONE}/${CONTROL_OPERATION}/vertical.jpg`,
    },
    preferredThumbnail: "square",
  };
}

function baseCampaign(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: JOINT_ONE,
    store_id: STORE_ID,
    product_name: "Produto",
    created_at: "2026-11-19T00:00:00.000Z",
    updated_at: "2026-11-19T00:00:00.000Z",
    status: "ready",
    storage_path: "",
    input_snapshot: { ...JOINT_SNAPSHOT },
    identity_snapshot: null,
    publication_copy_current: null,
    publication_copy_snapshot: null,
    ...overrides,
  };
}

const BASELINE_PATH = fileURLToPath(
  new URL("./baseline-calls.json", import.meta.url),
);

describe("Fase 61 — baseline medido de chamadas (lista/dashboard/detalhe)", () => {
  it("captura (BASELINE_CAPTURE=1) ou compara com o baseline imutável", async () => {
    const observed = {
      list: {
        joint: await runList([jointRow(JOINT_ONE), jointRow(JOINT_TWO)], summariesFor([JOINT_ONE, JOINT_TWO])),
        legacy_only: await runList(
          [
            legacyRow(LEGACY_ONE, `${STORE_ID}/${LEGACY_ONE}.jpg`),
            legacyRow(LEGACY_TWO, `${STORE_ID}/${LEGACY_TWO}.jpg`),
          ],
          new Map(),
        ),
        no_signable_thumbnail: await runList(
          [
            legacyRow(LEGACY_ONE, `${STORE_ID}/inputs/logo.png`),
            legacyRow(LEGACY_TWO, `${STORE_ID}/bench/arte.png`),
          ],
          new Map(),
        ),
        batch_1: await runList([jointRow(JOINT_ONE)], summariesFor([JOINT_ONE])),
        batch_3: await runList(
          [jointRow(JOINT_ONE), jointRow(JOINT_TWO), jointRow(JOINT_THREE)],
          summariesFor([JOINT_ONE, JOINT_TWO, JOINT_THREE]),
        ),
      },
      dashboard: {
        joint: await runDashboard(
          [jointRow(JOINT_ONE), jointRow(JOINT_TWO)],
          summariesFor([JOINT_ONE, JOINT_TWO]),
        ),
        legacy_only: await runDashboard(
          [
            legacyRow(LEGACY_ONE, `${STORE_ID}/${LEGACY_ONE}.jpg`),
            legacyRow(LEGACY_TWO, `${STORE_ID}/${LEGACY_TWO}.jpg`),
          ],
          new Map(),
        ),
        no_signable_thumbnail: await runDashboard(
          [
            legacyRow(LEGACY_ONE, `${STORE_ID}/inputs/logo.png`),
            legacyRow(LEGACY_TWO, `${STORE_ID}/bench/arte.png`),
          ],
          new Map(),
        ),
      },
      detail: {
        joint: await runDetail({
          campaign: baseCampaign({
            input_snapshot: { ...JOINT_SNAPSHOT },
            storage_path: "",
          }),
          operation: null,
          controlResult: { kind: "found", operationId: CONTROL_OPERATION },
          deliveryResult: { kind: "found", view: jointView() },
          outcomesResult: {
            kind: "found",
            unknownOperationIds: new Set<string>(),
            controlSupportReference: null,
          },
        }),
        new_flow: await runDetail({
          campaign: baseCampaign({
            input_snapshot: { ...NEW_FLOW_SNAPSHOT },
            storage_path: "",
          }),
          operation: {
            operationId: CONTROL_OPERATION,
            status: "delivered",
            unknown: false,
            outcome: null,
            supportReference: null,
          },
          controlResult: { kind: "not_found" },
          deliveryResult: { kind: "not_found" },
          outcomesResult: { kind: "found", unknownOperationIds: new Set<string>(), controlSupportReference: null },
        }),
        legacy: await runDetail({
          campaign: baseCampaign({
            input_snapshot: null,
            storage_path: `${STORE_ID}/${LEGACY_ONE}.jpg`,
          }),
          operation: null,
          controlResult: { kind: "not_found" },
          deliveryResult: { kind: "not_found" },
          outcomesResult: { kind: "found", unknownOperationIds: new Set<string>(), controlSupportReference: null },
        }),
      },
    };

    const capture = process.env.BASELINE_CAPTURE === "1";

    if (capture) {
      mkdirSync(dirname(BASELINE_PATH), { recursive: true });
      writeFileSync(
        BASELINE_PATH,
        `${JSON.stringify(observed, null, 2)}\n`,
        "utf8",
      );
    }

    const baseline: unknown = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    expect(observed).toEqual(baseline);
  });
});
