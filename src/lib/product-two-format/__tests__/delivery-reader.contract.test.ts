// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { readTwoFormatDelivery } from "../delivery-reader";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: new Proxy(
    {},
    {
      get() {
        throw new Error("supabaseAdmin must not be touched by the reader");
      },
    },
  ),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: supabaseAdminMock }));

/**
 * Contrato OFFLINE do leitor server-only (F60.7 / Plano 60.7-03).
 *
 * Nenhum banco, RPC, Storage ou provider é tocado: um fake encadeável registra
 * `from(table).select(columns).eq(...)` e devolve linhas controladas. O leitor
 * deriva estado SÓ de vínculo + crédito + linha de artefato.
 */

const STORE = "11111111-1111-4111-8111-111111111111";
const OTHER_STORE = "99999999-9999-4999-8999-999999999999";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_DELIVERY = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = "2026-11-18T00:00:00.000Z";

const SQUARE_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;
const VERTICAL_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

const JOINT_SNAPSHOT = {
  campaignFormat: "1:1+9:16",
  formatContractVersion: "f60.7-two-format-v1",
  generationOrigin: "two_format_two_stage",
  generationContractVersion: "f60.7-two-format-v1",
};

const CAMPAIGN_ROW = {
  id: CAMPAIGN,
  store_id: STORE,
  input_snapshot: JOINT_SNAPSHOT,
};

interface QueryShape {
  readonly table: string;
  readonly columns: string;
  readonly filters: Array<[string, string]>;
}

type QueryResult = { data: unknown; error?: { message: string } | null };
type Resolver = (query: QueryShape) => QueryResult;

function filterValue(query: QueryShape, column: string): string | null {
  const entry = query.filters.find(([name]) => name === column);
  return entry ? entry[1] : null;
}

function fakeClient(resolve: Resolver, options: { throwOn?: string } = {}) {
  const queries: QueryShape[] = [];
  const rpc = vi.fn(() => {
    throw new Error("rpc must not be called by the reader");
  });
  const client = {
    from(table: string) {
      if (options.throwOn === table) throw new Error(`boom:${table}`);
      const record: QueryShape = { table, columns: "", filters: [] };
      queries.push(record);
      const builder = {
        select(columns: string) {
          (record as { columns: string }).columns = columns;
          return builder;
        },
        eq(column: string, value: string) {
          (record.filters as Array<[string, string]>).push([column, value]);
          return builder;
        },
        maybeSingle: async () => {
          const result = resolve(record);
          return { data: result.data ?? null, error: result.error ?? null };
        },
        then(
          onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          const result = resolve(record);
          return Promise.resolve({
            data: result.data ?? null,
            error: result.error ?? null,
          }).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
    rpc,
  };
  return { client: client as never, queries, rpc };
}

function squareLink(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    campaign_id: CAMPAIGN,
    operation_id: OPERATION,
    store_id: STORE,
    format: "1:1",
    delivery_operation_id: SQUARE_DELIVERY,
    artifact_role: "square_original",
    created_at: CREATED_AT,
    ...overrides,
  };
}

function verticalLink(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    campaign_id: CAMPAIGN,
    operation_id: OPERATION,
    store_id: STORE,
    format: "9:16",
    delivery_operation_id: OPERATION,
    artifact_role: "vertical",
    created_at: CREATED_AT,
    ...overrides,
  };
}

function squareArtifact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    role: "square_original",
    format: "1:1",
    width: 1024,
    height: 1024,
    mime_type: "image/jpeg",
    artifact_path: SQUARE_PATH,
    ...overrides,
  };
}

function verticalArtifact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    role: "vertical",
    format: "9:16",
    width: 1080,
    height: 1920,
    mime_type: "image/jpeg",
    artifact_path: VERTICAL_PATH,
    ...overrides,
  };
}

interface Config {
  readonly campaign?: unknown;
  readonly campaignError?: string;
  readonly links?: unknown;
  readonly linksError?: string;
  readonly credits?: Record<string, unknown>;
  readonly creditError?: string;
  readonly artifacts?: Record<string, unknown>;
  readonly artifactError?: string;
}

const DEFAULT_CREDITS: Record<string, unknown> = {
  [SQUARE_DELIVERY]: { status: "delivered" },
  [OPERATION]: { status: "delivered" },
};

const DEFAULT_ARTIFACTS: Record<string, unknown> = {
  square_original: squareArtifact(),
  vertical: verticalArtifact(),
};

function resolver(config: Config = {}): Resolver {
  return (query) => {
    switch (query.table) {
      case "campaigns":
        if (config.campaignError) {
          return { data: null, error: { message: config.campaignError } };
        }
        return { data: config.campaign === undefined ? CAMPAIGN_ROW : config.campaign };
      case "product_two_format_deliveries":
        if (config.linksError) {
          return { data: null, error: { message: config.linksError } };
        }
        return {
          data:
            config.links === undefined ? [squareLink(), verticalLink()] : config.links,
        };
      case "product_1_1_campaign_credit_operations": {
        if (config.creditError) {
          return { data: null, error: { message: config.creditError } };
        }
        const operationId = filterValue(query, "operation_id") ?? "";
        const credits = config.credits ?? DEFAULT_CREDITS;
        return unwrap(credits[operationId]);
      }
      case "campaign_composition_artifacts": {
        if (config.artifactError) {
          return { data: null, error: { message: config.artifactError } };
        }
        const role = filterValue(query, "role") ?? "";
        const artifacts = config.artifacts ?? DEFAULT_ARTIFACTS;
        return unwrap(artifacts[role]);
      }
      default:
        throw new Error(`unexpected_table:${query.table}`);
    }
  };
}

function unwrap(value: unknown): QueryResult {
  if (value !== null && typeof value === "object" && "errorMessage" in value) {
    return { data: null, error: { message: String((value as { errorMessage: string }).errorMessage) } };
  }
  return { data: value ?? null };
}

const INPUT = { campaignId: CAMPAIGN, operationId: OPERATION };

describe("leitor server-only da entrega conjunta", () => {
  it("Teste 1: campanha entregue nos dois formatos é found com miniatura quadrada", async () => {
    const fake = fakeClient(resolver());
    const result = await readTwoFormatDelivery(INPUT, { client: fake.client });

    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.view.square.state).toBe("delivered");
    expect(result.view.vertical.state).toBe("delivered");
    expect(result.view.preferredThumbnail).toBe("square");
    expect(result.view.campaignId).toBe(CAMPAIGN);
    expect(result.view.operationId).toBe(OPERATION);
  });

  it("Teste 2: ausência, outra loja, legado e par corrompido são distinguidos", async () => {
    const absent = fakeClient(resolver({ campaign: null }));
    expect(await readTwoFormatDelivery(INPUT, { client: absent.client })).toEqual({
      kind: "not_found",
    });

    const otherStore = fakeClient(resolver());
    expect(
      await readTwoFormatDelivery({ ...INPUT, storeId: OTHER_STORE }, { client: otherStore.client }),
    ).toEqual({ kind: "not_found" });

    const legacySnapshots: unknown[] = [
      {},
      {
        campaignFormat: "9:16",
        formatContractVersion: "f59-vertical-9-16-v1",
        generationOrigin: "9_16_two_stage",
        generationContractVersion: "f60.5-two-stage-9-16-v1",
      },
      { campaignFormat: "1:1", formatContractVersion: "f59-vertical-9-16-v1" },
    ];

    for (const inputSnapshot of legacySnapshots) {
      const legacy = fakeClient(
        resolver({ campaign: { ...CAMPAIGN_ROW, input_snapshot: inputSnapshot } }),
      );
      expect(await readTwoFormatDelivery(INPUT, { client: legacy.client })).toEqual({
        kind: "not_two_format",
      });
    }

    const corruptSnapshots: unknown[] = [
      { campaignFormat: "1:1+9:16", formatContractVersion: "f60.7-two-format-v1" },
      { campaignFormat: "1:1+9:16", formatContractVersion: "f60.7-two-format-v1", generationOrigin: "historical", generationContractVersion: "x" },
      { campaignFormats: ["1:1", "9:16"], generationOrigin: "two_format_two_stage", generationContractVersion: "f60.7-two-format-v1" },
    ];

    for (const inputSnapshot of corruptSnapshots) {
      const corrupt = fakeClient(
        resolver({ campaign: { ...CAMPAIGN_ROW, input_snapshot: inputSnapshot } }),
      );
      const result = await readTwoFormatDelivery(INPUT, { client: corrupt.client });
      expect(result.kind).toBe("inconsistent");
      if (result.kind !== "inconsistent") return;
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("Teste 3: falha de campanha/vínculo é read_failed; falha de formato preserva o irmão", async () => {
    const campaignFailure = fakeClient(resolver({ campaignError: "campaign_timeout" }));
    expect(await readTwoFormatDelivery(INPUT, { client: campaignFailure.client })).toEqual({
      kind: "read_failed",
      reason: "campaign_timeout",
    });

    const linkFailure = fakeClient(resolver({ linksError: "links_timeout" }));
    expect(await readTwoFormatDelivery(INPUT, { client: linkFailure.client })).toEqual({
      kind: "read_failed",
      reason: "links_timeout",
    });

    const unexpected = fakeClient(resolver(), { throwOn: "campaigns" });
    expect((await readTwoFormatDelivery(INPUT, { client: unexpected.client })).kind).toBe(
      "read_failed",
    );

    const divergingOperation = fakeClient(
      resolver({ links: [squareLink({ operation_id: OTHER_STORE }), verticalLink()] }),
    );
    expect((await readTwoFormatDelivery(INPUT, { client: divergingOperation.client })).kind).toBe(
      "read_failed",
    );

    const squareCreditFailure = fakeClient(
      resolver({
        credits: {
          [SQUARE_DELIVERY]: { errorMessage: "credit_timeout" },
          [OPERATION]: { status: "delivered" },
        },
      }),
    );
    const creditResult = await readTwoFormatDelivery(INPUT, {
      client: squareCreditFailure.client,
    });
    expect(creditResult.kind).toBe("found");
    if (creditResult.kind === "found") {
      expect(creditResult.view.square.state).toBe("unknown");
      expect(creditResult.view.vertical.state).toBe("delivered");
    }

    const verticalArtifactFailure = fakeClient(
      resolver({ artifacts: { square_original: squareArtifact(), vertical: { errorMessage: "artifact_timeout" } } }),
    );
    const artifactResult = await readTwoFormatDelivery(INPUT, {
      client: verticalArtifactFailure.client,
    });
    expect(artifactResult.kind).toBe("found");
    if (artifactResult.kind === "found") {
      expect(artifactResult.view.vertical.state).toBe("unknown");
      expect(artifactResult.view.square.state).toBe("delivered");
      expect(artifactResult.view.preferredThumbnail).toBe("square");
    }

    for (const result of [creditResult, artifactResult]) {
      expect(result.kind).not.toBe("not_found");
      expect(result.kind).not.toBe("not_two_format");
      if (result.kind === "found") {
        expect(result.view.square.state).not.toBe("absent");
        expect(result.view.vertical.state).not.toBe("absent");
      }
    }
  });

  it("Teste 4: campanha conjunta sem vínculos fica indisponível, nunca ausente", async () => {
    const fake = fakeClient(resolver({ links: [] }));
    const result = await readTwoFormatDelivery(INPUT, { client: fake.client });

    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.view.square.state).toBe("unavailable");
    expect(result.view.vertical.state).toBe("unavailable");
    expect(result.view.preferredThumbnail).toBeNull();
  });

  it("Teste 5: estados de crédito/vínculo são explícitos e indeterminação não vira ausência", async () => {
    const processing = fakeClient(
      resolver({
        credits: {
          [SQUARE_DELIVERY]: { status: "reserved" },
          [OPERATION]: { status: "reserved" },
        },
      }),
    );
    const processingResult = await readTwoFormatDelivery(INPUT, { client: processing.client });
    expect(processingResult.kind).toBe("found");
    if (processingResult.kind === "found") {
      expect(processingResult.view.square.state).toBe("processing");
      expect(processingResult.view.vertical.state).toBe("processing");
    }

    const refunded = fakeClient(
      resolver({
        credits: {
          [SQUARE_DELIVERY]: { status: "delivered" },
          [OPERATION]: { status: "refunded" },
        },
      }),
    );
    const refundedResult = await readTwoFormatDelivery(INPUT, { client: refunded.client });
    expect(refundedResult.kind).toBe("found");
    if (refundedResult.kind === "found") {
      expect(refundedResult.view.vertical.state).toBe("absent");
      expect(refundedResult.view.vertical.creditRefunded).toBe(true);
      expect(refundedResult.view.square.state).toBe("delivered");
    }

    const noArtifact = fakeClient(
      resolver({ artifacts: { square_original: null, vertical: verticalArtifact() } }),
    );
    const noArtifactResult = await readTwoFormatDelivery(INPUT, { client: noArtifact.client });
    expect(noArtifactResult.kind).toBe("found");
    if (noArtifactResult.kind === "found") {
      expect(noArtifactResult.view.square.state).toBe("unknown");
    }

    const incompatible = fakeClient(
      resolver({
        artifacts: { square_original: squareArtifact({ width: 1152, height: 1152 }), vertical: verticalArtifact() },
      }),
    );
    const incompatibleResult = await readTwoFormatDelivery(INPUT, { client: incompatible.client });
    expect(incompatibleResult.kind).toBe("found");
    if (incompatibleResult.kind === "found") {
      expect(incompatibleResult.view.square.state).toBe("unknown");
    }

    const missingCredit = fakeClient(
      resolver({
        credits: { [SQUARE_DELIVERY]: null, [OPERATION]: { status: "delivered" } },
      }),
    );
    const missingCreditResult = await readTwoFormatDelivery(INPUT, {
      client: missingCredit.client,
    });
    expect(missingCreditResult.kind).toBe("found");
    if (missingCreditResult.kind === "found") {
      expect(missingCreditResult.view.square.state).toBe("unavailable");
    }

    const incoherentLink = fakeClient(
      resolver({ links: [squareLink({ artifact_role: "vertical" }), verticalLink()] }),
    );
    const incoherentResult = await readTwoFormatDelivery(INPUT, { client: incoherentLink.client });
    expect(incoherentResult.kind).toBe("found");
    if (incoherentResult.kind === "found") {
      expect(incoherentResult.view.square.state).toBe("unavailable");
    }
  });

  it("Teste 6: quadrado entregue com vertical estornado mantém o quadrado acessível", async () => {
    const fake = fakeClient(
      resolver({
        credits: {
          [SQUARE_DELIVERY]: { status: "delivered" },
          [OPERATION]: { status: "refunded" },
        },
      }),
    );
    const result = await readTwoFormatDelivery(INPUT, { client: fake.client });

    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.view.square.state).toBe("delivered");
    expect(result.view.vertical.state).toBe("absent");
    expect(result.view.vertical.creditRefunded).toBe(true);
    expect(result.view.preferredThumbnail).toBe("square");
  });

  it("Teste 7: miniatura prefere o formato entregue e é nula quando nada foi entregue", async () => {
    const verticalOnly = fakeClient(
      resolver({
        credits: {
          [SQUARE_DELIVERY]: { status: "refunded" },
          [OPERATION]: { status: "delivered" },
        },
        artifacts: { square_original: squareArtifact(), vertical: verticalArtifact() },
      }),
    );
    const verticalResult = await readTwoFormatDelivery(INPUT, { client: verticalOnly.client });
    expect(verticalResult.kind).toBe("found");
    if (verticalResult.kind === "found") {
      expect(verticalResult.view.preferredThumbnail).toBe("vertical");
    }

    const noneDelivered = fakeClient(
      resolver({
        credits: {
          [SQUARE_DELIVERY]: { status: "refunded" },
          [OPERATION]: { status: "refunded" },
        },
      }),
    );
    const noneResult = await readTwoFormatDelivery(INPUT, { client: noneDelivered.client });
    expect(noneResult.kind).toBe("found");
    if (noneResult.kind === "found") {
      expect(noneResult.view.preferredThumbnail).toBeNull();
    }
  });

  it("Teste 8: consulta as quatro tabelas com filtros de identidade e sem tabelas proibidas", async () => {
    const fake = fakeClient(resolver());
    await readTwoFormatDelivery(INPUT, { client: fake.client });

    const byTable = new Map<string, QueryShape[]>();
    for (const query of fake.queries) {
      const list = byTable.get(query.table) ?? [];
      list.push(query);
      byTable.set(query.table, list);
    }

    expect(new Set(byTable.keys())).toEqual(
      new Set([
        "campaigns",
        "product_two_format_deliveries",
        "product_1_1_campaign_credit_operations",
        "campaign_composition_artifacts",
      ]),
    );

    const campaignQuery = byTable.get("campaigns")?.[0];
    expect(campaignQuery?.filters).toEqual([["id", CAMPAIGN]]);
    for (const column of ["id", "store_id", "input_snapshot"]) {
      expect(campaignQuery?.columns).toContain(column);
    }

    const linkQuery = byTable.get("product_two_format_deliveries")?.[0];
    expect(linkQuery?.filters).toEqual([["campaign_id", CAMPAIGN]]);
    for (const column of ["format", "delivery_operation_id", "artifact_role"]) {
      expect(linkQuery?.columns).toContain(column);
    }

    const creditQueries = byTable.get("product_1_1_campaign_credit_operations") ?? [];
    expect(creditQueries.map((query) => query.filters)).toEqual(
      expect.arrayContaining([
        [
          ["campaign_id", CAMPAIGN],
          ["operation_id", SQUARE_DELIVERY],
        ],
        [
          ["campaign_id", CAMPAIGN],
          ["operation_id", OPERATION],
        ],
      ]),
    );

    const artifactQueries = byTable.get("campaign_composition_artifacts") ?? [];
    expect(artifactQueries.map((query) => query.filters)).toEqual(
      expect.arrayContaining([
        [
          ["campaign_id", CAMPAIGN],
          ["operation_id", OPERATION],
          ["role", "square_original"],
        ],
        [
          ["campaign_id", CAMPAIGN],
          ["operation_id", OPERATION],
          ["role", "vertical"],
        ],
      ]),
    );
    for (const query of artifactQueries) {
      expect(query.columns).not.toBe("*");
      for (const column of ["role", "format", "width", "height", "mime_type"]) {
        expect(query.columns).toContain(column);
      }
    }

    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("Teste 9: estado nunca é derivado do caminho persistido", async () => {
    const arbitraryPath = fakeClient(
      resolver({
        artifacts: {
          square_original: squareArtifact({ artifact_path: "https://example.invalid/whatever.jpg" }),
          vertical: verticalArtifact({ artifact_path: "some/other/name.png" }),
        },
      }),
    );
    const arbitraryResult = await readTwoFormatDelivery(INPUT, { client: arbitraryPath.client });
    expect(arbitraryResult.kind).toBe("found");
    if (arbitraryResult.kind === "found") {
      expect(arbitraryResult.view.square.state).toBe("delivered");
      expect(arbitraryResult.view.vertical.state).toBe("delivered");
    }

    const canonicalPath = fakeClient(
      resolver({
        artifacts: {
          square_original: squareArtifact({ width: 1152, height: 1152 }),
          vertical: verticalArtifact({ mime_type: "image/png" }),
        },
      }),
    );
    const canonicalResult = await readTwoFormatDelivery(INPUT, { client: canonicalPath.client });
    expect(canonicalResult.kind).toBe("found");
    if (canonicalResult.kind === "found") {
      expect(canonicalResult.view.square.state).toBe("unknown");
      expect(canonicalResult.view.vertical.state).toBe("unknown");
    }
  });

  it("Teste 10: o client injetado é o único usado e o admin global não é tocado", async () => {
    const fake = fakeClient(resolver());
    const result = await readTwoFormatDelivery(INPUT, { client: fake.client });

    expect(result.kind).toBe("found");
    expect(fake.queries.length).toBeGreaterThan(0);
  });
});
