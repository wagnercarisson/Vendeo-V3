// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  readFormatAdditionByCampaign,
  readFormatAdditionByIdentity,
  type FormatAdditionCreditRead,
  type FormatAdditionOutcomeRead,
  type FormatAdditionRow,
  type FormatAdditionRowsRead,
  type FormatAdditionReaderDeps,
} from "../delivery-reader";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const OTHER_OPERATION = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const ARTIFACT = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const REGISTRATION = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const REQUEST = "7a8b9c0d-7a8b-4c0d-9e1f-7a8b9c0d1e2f";

function row(overrides: Partial<FormatAdditionRow> = {}): FormatAdditionRow {
  return {
    operationId: OPERATION,
    storeId: STORE,
    campaignId: CAMPAIGN,
    sourceOrigin: "new_flow_1_1",
    sourceArtifactId: ARTIFACT,
    sourceRegistrationOperationId: REGISTRATION,
    status: "delivered",
    requestId: REQUEST,
    createdAt: "2026-11-23T12:00:00.000Z",
    ...overrides,
  };
}

function deps(options: {
  rows: FormatAdditionRowsRead;
  credit?: FormatAdditionCreditRead;
  outcome?: FormatAdditionOutcomeRead;
}): {
  deps: FormatAdditionReaderDeps;
  filters: unknown[];
  credits: unknown[];
  outcomes: unknown[];
} {
  const filters: unknown[] = [];
  const credits: unknown[] = [];
  const outcomes: unknown[] = [];
  return {
    filters,
    credits,
    outcomes,
    deps: {
      readRows: async (filter) => {
        filters.push(filter);
        return options.rows;
      },
      readCredit: async (input) => {
        credits.push(input);
        return options.credit ?? { kind: "missing" };
      },
      readOutcome: async (input) => {
        outcomes.push(input);
        return options.outcome ?? { kind: "missing" };
      },
    },
  };
}

describe("F62-03 — leitor canônico da adição", () => {
  it("sem vínculo devolve none, sem inventar ausência/estado", async () => {
    const fake = deps({ rows: { kind: "ok", rows: [] } });
    await expect(
      readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, fake.deps),
    ).resolves.toEqual({ kind: "none" });
    expect(fake.credits).toHaveLength(0);
    expect(fake.outcomes).toHaveLength(0);
  });

  it("delivered/refunded usam o vínculo e sanitizam o DTO", async () => {
    const delivered = deps({
      rows: { kind: "ok", rows: [row({ status: "delivered" })] },
    });
    const deliveredResult = await readFormatAdditionByCampaign(
      { storeId: STORE, campaignId: CAMPAIGN },
      delivered.deps,
    );
    expect(deliveredResult).toEqual({
      kind: "found",
      addition: {
        state: "delivered",
        sourceOrigin: "new_flow_1_1",
        refunded: false,
        operationId: OPERATION,
        requestId: REQUEST,
        sourceArtifactId: ARTIFACT,
        sourceRegistrationOperationId: REGISTRATION,
        createdAt: "2026-11-23T12:00:00.000Z",
      },
    });
    expect(delivered.credits).toHaveLength(0);

    const refunded = deps({
      rows: { kind: "ok", rows: [row({ status: "refunded" })] },
    });
    const refundedResult = await readFormatAdditionByCampaign(
      { storeId: STORE, campaignId: CAMPAIGN },
      refunded.deps,
    );
    expect(refundedResult).toMatchObject({
      kind: "found",
      addition: { state: "refunded", refunded: true },
    });
    expect(refunded.credits).toHaveLength(0);

    const dto = refundedResult.kind === "found" ? refundedResult.addition : {};
    expect(JSON.stringify(dto)).not.toMatch(
      /storagePath|storage_path|https?:\/\/|input_snapshot|bytes|url/i,
    );
    expect(Object.keys(dto).sort()).toEqual([
      "createdAt",
      "operationId",
      "refunded",
      "requestId",
      "sourceArtifactId",
      "sourceOrigin",
      "sourceRegistrationOperationId",
      "state",
    ]);
  });

  it("open com crédito reservado/art_uploaded é processing", async () => {
    for (const status of ["reserved", "art_uploaded"]) {
      const fake = deps({
        rows: { kind: "ok", rows: [row({ status: "open" })] },
        credit: { kind: "found", status },
        outcome: { kind: "missing" },
      });
      const result = await readFormatAdditionByCampaign(
        { storeId: STORE, campaignId: CAMPAIGN },
        fake.deps,
      );
      expect(result).toMatchObject({ kind: "found", addition: { state: "processing" } });
      expect(fake.credits).toEqual([{ campaignId: CAMPAIGN, operationId: OPERATION }]);
    }
  });

  it("open com outcome failed continua processing (finalização pendente)", async () => {
    const fake = deps({
      rows: { kind: "ok", rows: [row({ status: "open" })] },
      credit: { kind: "found", status: "reserved" },
      outcome: { kind: "found", outcome: "failed" },
    });
    await expect(
      readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, fake.deps),
    ).resolves.toMatchObject({ kind: "found", addition: { state: "processing" } });
  });

  it("open com resultado incerto/missing é unknown, nunca ausência", async () => {
    for (const [credit, outcome] of [
      [{ kind: "missing" }, { kind: "missing" }],
      [{ kind: "found", status: "reserved" }, { kind: "found", outcome: "unknown" }],
      [{ kind: "missing" }, { kind: "found", outcome: "unknown" }],
    ] as const) {
      const fake = deps({
        rows: { kind: "ok", rows: [row({ status: "open" })] },
        credit,
        outcome,
      });
      await expect(
        readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, fake.deps),
      ).resolves.toMatchObject({ kind: "found", addition: { state: "unknown" } });
    }
  });

  it("open reconcilia crédito terminal para delivered/refunded", async () => {
    const delivered = deps({
      rows: { kind: "ok", rows: [row({ status: "open" })] },
      credit: { kind: "found", status: "delivered" },
    });
    await expect(
      readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, delivered.deps),
    ).resolves.toMatchObject({ kind: "found", addition: { state: "delivered" } });

    const refunded = deps({
      rows: { kind: "ok", rows: [row({ status: "open" })] },
      credit: { kind: "found", status: "refunded" },
    });
    await expect(
      readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, refunded.deps),
    ).resolves.toMatchObject({
      kind: "found",
      addition: { state: "refunded", refunded: true },
    });
  });

  it("falha de leitura de crédito/outcome é read_failed, nunca processing", async () => {
    for (const [credit, outcome] of [
      [{ kind: "read_failed" }, { kind: "missing" }],
      [{ kind: "found", status: "reserved" }, { kind: "read_failed" }],
    ] as const) {
      const fake = deps({
        rows: { kind: "ok", rows: [row({ status: "open" })] },
        credit,
        outcome,
      });
      await expect(
        readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, fake.deps),
      ).resolves.toEqual({ kind: "read_failed" });
    }
  });

  it("prioriza open/delivered mais recente e só usa refunded quando não há ativo", async () => {
    const activeOlder = row({
      status: "delivered",
      operationId: OTHER_OPERATION,
      createdAt: "2026-11-20T00:00:00.000Z",
    });
    const refundedNewer = row({
      status: "refunded",
      operationId: OPERATION,
      createdAt: "2026-11-23T12:00:00.000Z",
    });
    const withActive = deps({
      rows: { kind: "ok", rows: [refundedNewer, activeOlder] },
    });
    const activeResult = await readFormatAdditionByCampaign(
      { storeId: STORE, campaignId: CAMPAIGN },
      withActive.deps,
    );
    expect(activeResult).toMatchObject({
      kind: "found",
      addition: { state: "delivered", operationId: OTHER_OPERATION },
    });

    const onlyRefunded = deps({
      rows: {
        kind: "ok",
        rows: [
          row({ status: "refunded", createdAt: "2026-11-20T00:00:00.000Z" }),
          row({
            status: "refunded",
            operationId: OTHER_OPERATION,
            createdAt: "2026-11-23T12:00:00.000Z",
          }),
        ],
      },
    });
    await expect(
      readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, onlyRefunded.deps),
    ).resolves.toMatchObject({
      kind: "found",
      addition: { state: "refunded", operationId: OTHER_OPERATION },
    });
  });

  it("identidade explícita usa exatamente um filtro", async () => {
    const fake = deps({
      rows: { kind: "ok", rows: [row({ status: "delivered" })] },
    });

    await readFormatAdditionByIdentity(
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
      fake.deps,
    );
    await readFormatAdditionByIdentity(
      { storeId: STORE, campaignId: CAMPAIGN, requestId: REQUEST },
      fake.deps,
    );
    await readFormatAdditionByIdentity(
      { storeId: STORE, campaignId: CAMPAIGN, sourceArtifactId: ARTIFACT },
      fake.deps,
    );

    expect(fake.filters).toEqual([
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION },
      { storeId: STORE, campaignId: CAMPAIGN, requestId: REQUEST },
      { storeId: STORE, campaignId: CAMPAIGN, sourceArtifactId: ARTIFACT },
    ]);
  });

  it("rejeita identidade ambígua, inválida ou base inválida", async () => {
    const fake = deps({ rows: { kind: "ok", rows: [row()] } });

    await expect(
      readFormatAdditionByIdentity({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        requestId: REQUEST,
      } as never, fake.deps),
    ).resolves.toEqual({ kind: "read_failed" });

    await expect(
      readFormatAdditionByIdentity(
        { storeId: "not-uuid", campaignId: CAMPAIGN, operationId: OPERATION },
        fake.deps,
      ),
    ).resolves.toEqual({ kind: "read_failed" });

    await expect(
      readFormatAdditionByCampaign({ storeId: STORE, campaignId: "not-uuid" }, fake.deps),
    ).resolves.toEqual({ kind: "read_failed" });

    expect(fake.filters).toHaveLength(0);
  });

  it("linha malformada ou leitura de vínculo falha devolve read_failed", async () => {
    const failed = deps({ rows: { kind: "read_failed" } });
    await expect(
      readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, failed.deps),
    ).resolves.toEqual({ kind: "read_failed" });

    const malformed = deps({
      rows: { kind: "ok", rows: [{ ...row(), status: "invalid" } as never] },
    });
    await expect(
      readFormatAdditionByCampaign({ storeId: STORE, campaignId: CAMPAIGN }, malformed.deps),
    ).resolves.toEqual({ kind: "read_failed" });
  });

  it("módulo é server-only e não expõe path/URL/snapshot/bytes", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "src/lib/campaign/format-addition/delivery-reader.ts",
      "utf8",
    );

    expect(source).toContain('import "server-only"');
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/input_snapshot/);
    expect(source).not.toMatch(/storage_path|storagePath/);
    expect(source).not.toMatch(/product_two_format/);
    expect(source).not.toMatch(/INSERT\s+INTO|UPDATE\s+public\./i);
  });
});
