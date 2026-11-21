// @vitest-environment node
/**
 * F61 (61-02) — wiring da apresentação dos formatos na LISTA e no DASHBOARD.
 *
 * Prova dois contratos:
 * 1. matriz completa (legado, individual, geração, erro, expansão vertical,
 *    conjunta completa/parcial/estornada, inconsistente, sem operação, leitura
 *    falha) conforme 61-CONTEXT §5;
 * 2. assinatura de chamadas IDÊNTICA ao baseline (`61-BASELINE.md`): 1 leitura
 *    conjunta em lote, 1 `createSignedUrls` para preferidas conjuntas e 1
 *    `createSignedUrl` por legado pronto assinável — nenhuma chamada nova.
 *
 * Todo I/O é mock: nenhum acesso a banco, Storage, homolog ou produção.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignFormatPresentation } from "@/lib/campaign/format-presentation";
import type { CampaignListItem } from "@/lib/campaign/list";
import type { EligibleCampaignCard } from "@/lib/dashboard/campaigns";

interface WiringRow {
  readonly id: string;
  readonly product_name: string;
  readonly status: string;
  readonly created_at: string;
  readonly storage_path: string;
  readonly input_snapshot: Record<string, unknown> | null;
}

type Counters = Record<string, number>;

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

/** Snapshot do novo fluxo sem chaves de formato ⇒ contrato histórico `1:1`. */
const HISTORICAL_ONE_TO_ONE_SNAPSHOT = { frozenContentReferences: [] } as const;

const VERTICAL_SNAPSHOT = {
  frozenContentReferences: [],
  campaignFormat: "9:16",
  formatContractVersion: "f59-vertical-9-16-v1",
} as const;

const h = vi.hoisted(() => {
  const counters: Counters = {
    from: 0,
    readTwoFormatListSummaries: 0,
    createSignedUrl: 0,
    createSignedUrls: 0,
    generateBatchPreferredThumbnailUrls: 0,
    generateBatchThumbnailUrls: 0,
  };

  return {
    counters,
    queryRows: [] as unknown[],
    queryCount: 0,
    summaries: new Map<string, unknown>(),
    summaryCalls: [] as Array<{ campaigns: ReadonlyArray<{ id: string }> }>,
    reset(): void {
      for (const key of Object.keys(counters)) counters[key] = 0;
      h.summaryCalls = [];
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
            return {
              data: { signedUrl: `https://signed/${path}` },
              error: null,
            };
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
    h.summaryCalls.push(input);
    const result = new Map<string, unknown>();
    for (const campaign of input.campaigns) {
      const summary = h.summaries.get(campaign.id);
      if (summary) result.set(campaign.id, summary);
    }
    return result;
  },
}));

vi.mock("@/lib/campaign/metrics", () => ({
  countReadyCampaigns: async () => 0,
}));

// Instrumenta as assinaturas de miniatura usadas PELO DASHBOARD (import externo),
// exatamente como o baseline. As chamadas internas da lista não passam por aqui —
// por isso a lista é medida pelos contadores de Storage.
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

function row(
  overrides: Partial<WiringRow> & Pick<WiringRow, "id">,
): WiringRow {
  return {
    product_name: `Produto ${overrides.id.slice(0, 4)}`,
    status: "ready",
    created_at: "2026-11-19T00:00:00.000Z",
    storage_path: `${STORE_ID}/${overrides.id}.jpg`,
    input_snapshot: { ...HISTORICAL_ONE_TO_ONE_SNAPSHOT },
    ...overrides,
  };
}

function jointRow(id: string): WiringRow {
  return row({ id, input_snapshot: { ...JOINT_SNAPSHOT } });
}

interface JointViewInput {
  readonly square: { readonly state: string; readonly creditRefunded: boolean };
  readonly vertical: { readonly state: string; readonly creditRefunded: boolean };
}

function viewFor(campaignId: string, input: JointViewInput): unknown {
  const format = (
    key: "1:1" | "9:16",
    source: { readonly state: string; readonly creditRefunded: boolean },
  ) => ({
    format: key,
    state: source.state,
    creditRefunded: source.creditRefunded,
    deliveryOperationId: CONTROL_OPERATION,
    artifactRole: key === "1:1" ? "square_original" : "vertical",
    artifactPath: null,
    supportReference: null,
  });
  return {
    origin: "two_format_two_stage",
    campaignId,
    operationId: CONTROL_OPERATION,
    square: format("1:1", input.square),
    vertical: format("9:16", input.vertical),
    preferredThumbnail: input.square.state === "delivered" ? "square" : null,
  };
}

function summaryFor(
  campaignId: string,
  input: {
    readonly view: unknown;
    readonly formats: { readonly "1:1": string; readonly "9:16": string };
  },
): unknown {
  return {
    campaignId,
    operationId: CONTROL_OPERATION,
    formats: input.formats,
    preferredFormat: null,
    preferredThumbnailPath: `${STORE_ID}/${campaignId}/${CONTROL_OPERATION}/square_original.thumb-v1.webp`,
    view: input.view,
  };
}

async function runList(
  rows: readonly WiringRow[],
  summaries: Map<string, unknown>,
): Promise<{ items: CampaignListItem[]; calls: Counters }> {
  h.reset();
  h.queryRows = [...rows];
  h.queryCount = rows.length;
  h.summaries = summaries;
  const { listCampaigns } = await import("@/lib/campaign/list");
  const result = await listCampaigns(STORE_ID);
  return { items: result.items, calls: { ...h.counters } };
}

async function runDashboard(
  rows: readonly WiringRow[],
  summaries: Map<string, unknown>,
): Promise<{ items: EligibleCampaignCard[]; calls: Counters }> {
  h.reset();
  h.queryRows = [...rows];
  h.queryCount = rows.length;
  h.summaries = summaries;
  const { queryEligibleCampaigns } = await import("@/lib/dashboard/campaigns");
  const items = await queryEligibleCampaigns(STORE_ID);
  return { items, calls: { ...h.counters } };
}

function presentationOf(items: readonly { formatPresentation: CampaignFormatPresentation }[], id: string) {
  const item = items.find((candidate) => (candidate as { id?: string }).id === id);
  if (!item) throw new Error(`item ${id} ausente`);
  return item.formatPresentation;
}

beforeEach(() => {
  h.reset();
});

describe("F61 — matriz de apresentação na LISTA", () => {
  it("legado quadrado (snapshot histórico sem chaves) ⇒ 1:1 disponível, 9:16 não incluído", async () => {
    const { items } = await runList([row({ id: LEGACY_ONE })], new Map());
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.flow).toBe("single_format");
    expect(presentation.partial).toBe(false);
    expect(presentation.anyDelivered).toBe(true);
    expect(presentation.formats["1:1"]).toMatchObject({
      state: "delivered",
      reason: null,
      refunded: false,
      active: false,
    });
    expect(presentation.formats["9:16"]).toMatchObject({
      state: "absent",
      reason: "not_requested",
      refunded: false,
    });
  });

  it("individual 1:1 pronto ⇒ entregue e NÃO parcial", async () => {
    const { items } = await runList(
      [row({ id: LEGACY_ONE, input_snapshot: { ...HISTORICAL_ONE_TO_ONE_SNAPSHOT } })],
      new Map(),
    );
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.formats["1:1"].state).toBe("delivered");
    // Campanha individual pronta nunca é parcial: o outro formato não foi pedido.
    expect(presentation.partial).toBe(false);
    expect(presentation.formats["9:16"].state).toBe("absent");
    expect(presentation.formats["9:16"].reason).toBe("not_requested");
  });

  it("individual 9:16 pronto ⇒ vertical entregue, quadrado não incluído", async () => {
    const { items } = await runList(
      [row({ id: LEGACY_ONE, input_snapshot: { ...VERTICAL_SNAPSHOT } })],
      new Map(),
    );
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.formats["9:16"].state).toBe("delivered");
    expect(presentation.formats["1:1"].state).toBe("absent");
    expect(presentation.formats["1:1"].reason).toBe("not_requested");
    expect(presentation.partial).toBe(false);
  });

  it("vertical por expansão (persistido 9:16) ⇒ o outro formato NÃO é incluído", async () => {
    const { items } = await runList(
      [row({ id: LEGACY_ONE, input_snapshot: { ...VERTICAL_SNAPSHOT } })],
      new Map(),
    );
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.flow).toBe("single_format");
    expect(presentation.formats["9:16"].state).toBe("delivered");
    expect(presentation.formats["1:1"].state).toBe("absent");
    expect(presentation.formats["1:1"].reason).toBe("not_requested");
    expect(presentation.anyDelivered).toBe(true);
  });

  it("individual em geração ⇒ processando", async () => {
    const { items } = await runList(
      [row({ id: LEGACY_ONE, status: "generating" })],
      new Map(),
    );
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.formats["1:1"].state).toBe("processing");
    expect(presentation.formats["9:16"].state).toBe("absent");
    expect(presentation.partial).toBe(false);
  });

  it("individual com erro ⇒ unknown (nunca ausência/não entregue)", async () => {
    const { items } = await runList(
      [row({ id: LEGACY_ONE, status: "error" })],
      new Map(),
    );
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.formats["1:1"].state).toBe("unknown");
    expect(presentation.formats["1:1"].reason).toBeNull();
    expect(presentation.formats["1:1"].refunded).toBe(false);
    expect(presentation.formats["1:1"].state).not.toBe("absent");
    expect(presentation.formats["9:16"].state).toBe("absent");
    expect(presentation.formats["9:16"].reason).toBe("not_requested");
  });

  it("conjunta completa ⇒ dois formatos disponíveis, fluxo conjunto, não parcial", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: viewFor(JOINT_ONE, {
            square: { state: "delivered", creditRefunded: false },
            vertical: { state: "delivered", creditRefunded: false },
          }),
          formats: { "1:1": "delivered", "9:16": "delivered" },
        }),
      ],
    ]);
    const { items } = await runList([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.flow).toBe("two_format");
    expect(presentation.partial).toBe(false);
    expect(presentation.anyDelivered).toBe(true);
    expect(presentation.formats["1:1"].state).toBe("delivered");
    expect(presentation.formats["9:16"].state).toBe("delivered");
  });

  it("conjunta parcial com estorno ⇒ ausente com crédito devolvido, parcial e entregue visível", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: viewFor(JOINT_ONE, {
            square: { state: "delivered", creditRefunded: false },
            vertical: { state: "absent", creditRefunded: true },
          }),
          formats: { "1:1": "delivered", "9:16": "absent" },
        }),
      ],
    ]);
    const { items } = await runList([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.flow).toBe("two_format");
    expect(presentation.partial).toBe(true);
    expect(presentation.formats["1:1"].state).toBe("delivered");
    expect(presentation.formats["9:16"]).toMatchObject({
      state: "absent",
      refunded: true,
      reason: "not_delivered",
    });
  });

  it("conjunta com view nula usa os estados do lote sem presumir estorno", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: null,
          formats: { "1:1": "delivered", "9:16": "processing" },
        }),
      ],
    ]);
    const { items } = await runList([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.formats["1:1"].state).toBe("delivered");
    expect(presentation.formats["9:16"].state).toBe("processing");
    expect(presentation.formats["9:16"].refunded).toBe(false);
  });

  it("conjunta inconsistente ⇒ ambos indisponíveis, sem fallback 1:1", async () => {
    const { items } = await runList(
      [
        row({
          id: JOINT_ONE,
          input_snapshot: { campaignFormat: "1:1+9:16" },
        }),
      ],
      new Map(),
    );
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.formats["1:1"].state).toBe("unavailable");
    expect(presentation.formats["9:16"].state).toBe("unavailable");
    expect(presentation.anyDelivered).toBe(false);
  });

  it("conjunta sem operação ⇒ ambos indisponíveis", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: null,
          formats: { "1:1": "unavailable", "9:16": "unavailable" },
        }),
      ],
    ]);
    const { items } = await runList([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.formats["1:1"].state).toBe("unavailable");
    expect(presentation.formats["9:16"].state).toBe("unavailable");
  });

  it("leitura conjunta falha ⇒ ambos unknown (nunca cai no individual)", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: null,
          formats: { "1:1": "unknown", "9:16": "unknown" },
        }),
      ],
    ]);
    const { items } = await runList([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.formats["1:1"].state).toBe("unknown");
    expect(presentation.formats["9:16"].state).toBe("unknown");
    expect(presentation.formats["1:1"].state).not.toBe("absent");
  });

  it("snapshot nulo (legado sem contrato) ⇒ ambos indisponíveis", async () => {
    const { items } = await runList(
      [row({ id: LEGACY_ONE, input_snapshot: null })],
      new Map(),
    );
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.formats["1:1"].state).toBe("unavailable");
    expect(presentation.formats["9:16"].state).toBe("unavailable");
    expect(presentation.partial).toBe(false);
  });

  it("não expõe snapshot, path ou URL na apresentação", async () => {
    const { items } = await runList([row({ id: LEGACY_ONE })], new Map());
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(JSON.stringify(presentation)).not.toContain(STORE_ID);
    expect(JSON.stringify(presentation)).not.toContain("storage");
    expect(Object.keys(presentation).sort()).toEqual([
      "anyDelivered",
      "flow",
      "formats",
      "partial",
    ]);
  });

  it("assinatura de chamadas idêntica ao baseline (2 conjuntas + 2 legadas)", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: null,
          formats: { "1:1": "delivered", "9:16": "delivered" },
        }),
      ],
      [
        JOINT_TWO,
        summaryFor(JOINT_TWO, {
          view: null,
          formats: { "1:1": "delivered", "9:16": "delivered" },
        }),
      ],
    ]);

    const { items, calls } = await runList(
      [jointRow(JOINT_ONE), jointRow(JOINT_TWO), row({ id: LEGACY_ONE }), row({ id: LEGACY_TWO })],
      summaries,
    );

    expect(items).toHaveLength(4);
    // Baseline (`61-BASELINE.md`): 1 consulta, 1 leitura conjunta, 1 lote de
    // assinatura para conjuntas e 1 assinatura por legado pronto assinável.
    expect(calls.from).toBe(1);
    expect(calls.readTwoFormatListSummaries).toBe(1);
    expect(calls.createSignedUrls).toBe(1);
    expect(calls.createSignedUrl).toBe(2);
    // A leitura conjunta recebe TODAS as campanhas da página, uma única vez.
    expect(h.summaryCalls).toHaveLength(1);
    expect(h.summaryCalls[0].campaigns.map((campaign) => campaign.id).sort()).toEqual(
      [JOINT_ONE, JOINT_TWO, LEGACY_ONE, LEGACY_TWO].sort(),
    );
  });
});

describe("F61 — matriz de apresentação no DASHBOARD", () => {
  it("individual pronta ⇒ entregue e não parcial", async () => {
    const { items } = await runDashboard([row({ id: LEGACY_ONE })], new Map());
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.formats["1:1"].state).toBe("delivered");
    expect(presentation.formats["9:16"].state).toBe("absent");
    expect(presentation.formats["9:16"].reason).toBe("not_requested");
    expect(presentation.partial).toBe(false);
  });

  it("individual 9:16 pronta ⇒ vertical entregue, quadrado não incluído", async () => {
    const { items } = await runDashboard(
      [row({ id: LEGACY_ONE, input_snapshot: { ...VERTICAL_SNAPSHOT } })],
      new Map(),
    );
    const presentation = presentationOf(items, LEGACY_ONE);

    expect(presentation.formats["9:16"].state).toBe("delivered");
    expect(presentation.formats["1:1"].state).toBe("absent");
  });

  it("conjunta completa ⇒ dois chips disponíveis em uma única linha", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: viewFor(JOINT_ONE, {
            square: { state: "delivered", creditRefunded: false },
            vertical: { state: "delivered", creditRefunded: false },
          }),
          formats: { "1:1": "delivered", "9:16": "delivered" },
        }),
      ],
    ]);
    const { items } = await runDashboard([jointRow(JOINT_ONE)], summaries);

    expect(items).toHaveLength(1);
    const presentation = presentationOf(items, JOINT_ONE);
    expect(presentation.flow).toBe("two_format");
    expect(presentation.formats["1:1"].state).toBe("delivered");
    expect(presentation.formats["9:16"].state).toBe("delivered");
    expect(presentation.partial).toBe(false);
  });

  it("conjunta parcial estornada ⇒ estorno visível e parcial", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: viewFor(JOINT_ONE, {
            square: { state: "absent", creditRefunded: true },
            vertical: { state: "delivered", creditRefunded: false },
          }),
          formats: { "1:1": "absent", "9:16": "delivered" },
        }),
      ],
    ]);
    const { items } = await runDashboard([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.partial).toBe(true);
    expect(presentation.formats["1:1"]).toMatchObject({
      state: "absent",
      refunded: true,
      reason: "not_delivered",
    });
    expect(presentation.formats["9:16"].state).toBe("delivered");
  });

  it("conjunta inconsistente ⇒ ambos indisponíveis", async () => {
    const { items } = await runDashboard(
      [row({ id: JOINT_ONE, input_snapshot: { campaignFormat: "1:1+9:16" } })],
      new Map(),
    );
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.formats["1:1"].state).toBe("unavailable");
    expect(presentation.formats["9:16"].state).toBe("unavailable");
  });

  it("leitura conjunta falha ⇒ ambos unknown", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: null,
          formats: { "1:1": "unknown", "9:16": "unknown" },
        }),
      ],
    ]);
    const { items } = await runDashboard([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.formats["1:1"].state).toBe("unknown");
    expect(presentation.formats["9:16"].state).toBe("unknown");
  });

  it("conjunta sem operação ⇒ ambos indisponíveis", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: null,
          formats: { "1:1": "unavailable", "9:16": "unavailable" },
        }),
      ],
    ]);
    const { items } = await runDashboard([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.formats["1:1"].state).toBe("unavailable");
    expect(presentation.formats["9:16"].state).toBe("unavailable");
  });

  it("conjunta com view nula usa os estados do lote sem presumir estorno", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: null,
          formats: { "1:1": "delivered", "9:16": "absent" },
        }),
      ],
    ]);
    const { items } = await runDashboard([jointRow(JOINT_ONE)], summaries);
    const presentation = presentationOf(items, JOINT_ONE);

    expect(presentation.formats["1:1"].state).toBe("delivered");
    expect(presentation.formats["9:16"]).toMatchObject({
      state: "absent",
      refunded: false,
      reason: "not_delivered",
    });
  });

  it("assinatura de chamadas idêntica ao baseline do dashboard", async () => {
    const summaries = new Map<string, unknown>([
      [
        JOINT_ONE,
        summaryFor(JOINT_ONE, {
          view: null,
          formats: { "1:1": "delivered", "9:16": "delivered" },
        }),
      ],
      [
        JOINT_TWO,
        summaryFor(JOINT_TWO, {
          view: null,
          formats: { "1:1": "delivered", "9:16": "delivered" },
        }),
      ],
    ]);

    const { items, calls } = await runDashboard(
      [jointRow(JOINT_ONE), jointRow(JOINT_TWO), row({ id: LEGACY_ONE })],
      summaries,
    );

    expect(items).toHaveLength(3);
    // Baseline `dashboard.joint`: 1 consulta, 1 lote conjunto, 1 assinatura
    // preferida em lote e 1 assinatura legada em lote.
    expect(calls.from).toBe(1);
    expect(calls.readTwoFormatListSummaries).toBe(1);
    expect(calls.generateBatchPreferredThumbnailUrls).toBe(1);
    expect(calls.generateBatchThumbnailUrls).toBe(1);
    // 1 lote de preferidas (2 conjuntas) + 1 assinatura do legado pronto.
    expect(calls.createSignedUrls).toBe(1);
    expect(calls.createSignedUrl).toBe(1);
  });

  it("3 conjuntas mantêm 1 único lote de assinatura (prova de lote)", async () => {
    const summaries = new Map<string, unknown>(
      [JOINT_ONE, JOINT_TWO, JOINT_THREE].map((id) => [
        id,
        summaryFor(id, {
          view: null,
          formats: { "1:1": "delivered", "9:16": "delivered" },
        }),
      ]),
    );

    const { items, calls } = await runDashboard(
      [jointRow(JOINT_ONE), jointRow(JOINT_TWO), jointRow(JOINT_THREE)],
      summaries,
    );

    expect(items).toHaveLength(3);
    expect(calls.createSignedUrls).toBe(1);
    expect(calls.createSignedUrl).toBe(0);
  });
});

describe("F61 — builders de apresentação não fazem I/O", () => {
  it("nenhuma consulta/assinatura ao montar apresentações", async () => {
    const {
      buildIndividualFormatPresentation,
      buildJointFormatPresentation,
      buildUnknownFormatPresentation,
      buildUnavailableFormatPresentation,
      individualLifecycleFromStatus,
    } = await import("@/lib/campaign/format-presentation");

    h.reset();

    buildUnknownFormatPresentation();
    buildUnavailableFormatPresentation();
    buildJointFormatPresentation({
      "1:1": { state: "delivered", refunded: false },
      "9:16": { state: "absent", refunded: true },
    });
    buildIndividualFormatPresentation({
      resolution: { kind: "1:1", source: "absent" },
      lifecycle: individualLifecycleFromStatus("error"),
    });

    expect(h.counters).toEqual({
      from: 0,
      readTwoFormatListSummaries: 0,
      createSignedUrl: 0,
      createSignedUrls: 0,
      generateBatchPreferredThumbnailUrls: 0,
      generateBatchThumbnailUrls: 0,
    });
    expect(h.summaryCalls).toHaveLength(0);
  });
});
