// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  additions: [] as Record<string, unknown>[],
  credits: [] as Record<string, unknown>[],
  artifacts: [] as Record<string, unknown>[],
  outcomes: [] as Record<string, unknown>[],
  twoFormat: new Map<string, unknown>(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/product-two-format/list-summary", () => ({
  readTwoFormatListSummaries: vi.fn(async () => h.twoFormat),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => {
    const query: Record<string, unknown> = {};
    query.select = () => query;
    query.eq = () => query;
    query.in = () => query;
    query.order = () => query;
    query.range = () => query;
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: h.rows,
        count: h.rows.length,
        error: null,
      }).then(resolve);
    return { from: () => query };
  },
  supabaseAdmin: {
    from: (table: string) => {
      const rows =
        table === "campaign_format_additions"
          ? h.additions
          : table === "product_1_1_campaign_credit_operations"
            ? h.credits
            : table === "campaign_composition_artifacts"
              ? h.artifacts
              : table === "product_generation_operation_outcomes_v"
                ? h.outcomes
                : [];
      const query: Record<string, unknown> = {};
      query.select = () => query;
      query.in = () => query;
      query.eq = () => query;
      query.order = () => query;
      query.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
      return query;
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://signed/square.jpg" },
          error: null,
        }),
        createSignedUrls: async () => ({ data: [], error: null }),
      }),
    },
  },
}));

const JOINT_SNAPSHOT = {
  campaignFormat: "1:1+9:16",
  formatContractVersion: "f60.7-two-format-v1",
  generationOrigin: "two_format_two_stage",
  generationContractVersion: "f60.7-two-format-v1",
};

beforeEach(() => {
  h.rows = [
    {
      id: "c11",
      product_name: "Quadrado com adição",
      status: "ready",
      created_at: "2026-11-23T00:00:00Z",
      storage_path: "store/c11.jpg",
      input_snapshot: {},
    },
    {
      id: "c916",
      product_name: "Vertical individual",
      status: "ready",
      created_at: "2026-11-22T00:00:00Z",
      storage_path: "store/c916.jpg",
      input_snapshot: {
        campaignFormat: "9:16",
        formatContractVersion: "f59-vertical-9-16-v1",
      },
    },
    {
      id: "cjoint",
      product_name: "Conjunta",
      status: "ready",
      created_at: "2026-11-21T00:00:00Z",
      storage_path: "store/cjoint.jpg",
      input_snapshot: JOINT_SNAPSHOT,
    },
    {
      id: "cnone",
      product_name: "Quadrado sem adição",
      status: "ready",
      created_at: "2026-11-20T00:00:00Z",
      storage_path: "store/cnone.jpg",
      input_snapshot: {},
    },
    {
      id: "cunknown",
      product_name: "Quadrado com resultado incerto",
      status: "ready",
      created_at: "2026-11-19T00:00:00Z",
      storage_path: "store/cunknown.jpg",
      input_snapshot: {},
    },
  ];
  h.additions = [
    {
      campaign_id: "c11",
      operation_id: "op11",
      source_origin: "legacy_campaign",
      status: "delivered",
      created_at: "2026-11-23T00:00:00Z",
    },
    {
      campaign_id: "cunknown",
      operation_id: "opunknown",
      source_origin: "legacy_campaign",
      status: "open",
      created_at: "2026-11-19T00:00:00Z",
    },
  ];
  h.credits = [
    { operation_id: "op11", status: "delivered" },
    { operation_id: "opunknown", status: "reserved" },
  ];
  h.artifacts = [
    {
      operation_id: "op11",
      role: "vertical",
      format: "9:16",
      width: 1080,
      height: 1920,
      mime_type: "image/jpeg",
      storage_path: "op11/vertical.jpg",
    },
  ];
  h.outcomes = [{ operation_id: "opunknown", outcome: "unknown" }];
  h.twoFormat = new Map([
    [
      "cjoint",
      {
        campaignId: "cjoint",
        operationId: "opjoint",
        formats: { "1:1": "delivered", "9:16": "delivered" },
        preferredFormat: "1:1",
        preferredThumbnailPath: null,
        view: null,
      },
    ],
  ]);
});

describe("F62-06 — regressões integradas da adição", () => {
  it("mantém uma linha por campanha e não altera quadrado, 9:16, conjunto ou legado", async () => {
    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store", { page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(5);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(5);

    const addition = result.items.find((item) => item.id === "c11");
    expect(addition?.formatPresentation.formats["1:1"].state).toBe("delivered");
    expect(addition?.formatPresentation.formats["9:16"].state).toBe(
      "delivered",
    );
    expect(addition).not.toHaveProperty("operationId");
    expect(addition?.storagePath).toBe("store/c11.jpg");

    const vertical = result.items.find((item) => item.id === "c916");
    expect(vertical?.formatPresentation.formats["9:16"].state).toBe(
      "delivered",
    );

    const joint = result.items.find((item) => item.id === "cjoint");
    expect(joint?.joint).toBe(true);
    expect(joint?.formatPresentation.formats["9:16"].state).toBe(
      "delivered",
    );

    const absent = result.items.find((item) => item.id === "cnone");
    expect(absent?.formatPresentation.formats["9:16"].state).toBe("absent");
    expect(absent?.formatPresentation.formats["9:16"].reason).toBe(
      "not_requested",
    );

    const unknown = result.items.find((item) => item.id === "cunknown");
    expect(unknown?.formatPresentation.formats["9:16"].state).toBe("unknown");
    expect(unknown?.formatPresentation.formats["1:1"].state).toBe("delivered");
  });

  it("não repointa storage_path nem cria operação primária nova", async () => {
    const before = h.rows.map((row) => ({ ...row }));
    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store", { page: 1, pageSize: 10 });

    expect(h.rows).toEqual(before);
    for (const row of h.rows) {
      expect(row.storage_path).toMatch(/^store\/c/);
      expect(row).not.toHaveProperty("operation_id");
    }
  });
});
