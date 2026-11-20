// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

/**
 * Quick 261120-qvp (T-261120-04): nenhum cenário pode consultar o parâmetro
 * econômico VIGENTE como substituto. O espião fica zerado e o fonte do leitor
 * é conferido estaticamente.
 */
const economicSpy = vi.hoisted(() => ({ getParameter: vi.fn() }));
vi.mock("@/lib/economic/economic-parameter-service", () => ({
  EconomicParameterService: vi.fn(function () {
    return { getParameter: economicSpy.getParameter };
  }),
}));

import {
  ECONOMIC_SNAPSHOT_READ_TIMEOUT_MS,
  readExpansionEconomicSnapshot,
  withEconomicReadBudget,
} from "../economic-snapshot-reader";
import { runExpansionStep } from "../expansion-step";
import { durableResumeContext } from "./fixtures";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const NULLS = {
  usdBrlRateAtGeneration: null,
  creditValueBrlAtGeneration: null,
} as const;

type QueryResult = { data: unknown; error: unknown };

interface RecordingClientOptions {
  readonly throwsSync?: boolean;
  readonly rejects?: boolean;
}

function recordingClient(
  result: QueryResult | (() => QueryResult),
  options: RecordingClientOptions = {},
) {
  const calls = {
    from: [] as string[],
    select: [] as string[],
    eq: [] as Array<[string, unknown]>,
  };
  const resolve = () => (typeof result === "function" ? result() : result);
  const builder: Record<string, unknown> = {
    eq(column: string, value: unknown) {
      calls.eq.push([column, value]);
      return builder;
    },
    async maybeSingle() {
      if (options.rejects) throw new Error("async_client_down");
      return resolve();
    },
  };
  const client = {
    from(table: string) {
      if (options.throwsSync) throw new Error("sync_client_down");
      calls.from.push(table);
      return {
        select(columns: string) {
          calls.select.push(columns);
          return builder;
        },
      };
    },
  };
  return { client, calls };
}

function rowWithResumeContext(resumeContext: unknown) {
  return { input_snapshot: { resumeContext, frozenContentReferences: [] } };
}

function readerInput(client: unknown) {
  return { campaignId: CAMPAIGN_ID, storeId: STORE_ID, client };
}

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("readExpansionEconomicSnapshot — snapshot durável best-effort", () => {
  beforeEach(() => {
    economicSpy.getParameter.mockClear();
  });

  it("linha válida devolve exatamente o snapshot congelado", async () => {
    const { client } = recordingClient({
      data: rowWithResumeContext(durableResumeContext()),
      error: null,
    });

    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual({
      usdBrlRateAtGeneration: 5.1,
      creditValueBrlAtGeneration: 1,
    });
  });

  it("ausência de linha devolve null/null", async () => {
    const { client } = recordingClient({ data: null, error: null });
    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual(NULLS);
  });

  it.each([
    ["null", null],
    ["string", "snapshot"],
    ["número", 42],
    ["array", []],
  ])("input_snapshot %s devolve null/null", async (_label, snapshot) => {
    const { client } = recordingClient({
      data: { input_snapshot: snapshot },
      error: null,
    });
    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual(NULLS);
  });

  it("resumeContext ausente devolve null/null", async () => {
    const { client } = recordingClient({
      data: { input_snapshot: { frozenContentReferences: [] } },
      error: null,
    });
    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual(NULLS);
  });

  it.each([
    ["sem briefing", { economicSnapshot: { usdBrlRateAtGeneration: 5.1 } }],
    [
      "sem inputFiles",
      {
        briefing: {},
        briefingText: "{}",
        campaignIntent: "offer",
        backgroundDirection: "studio",
        economicSnapshot: { usdBrlRateAtGeneration: 5.1 },
      },
    ],
    ["economicSnapshot não-objeto", { ...durableResumeContext(), economicSnapshot: 5.1 }],
  ])("resumeContext malformado (%s) devolve null/null", async (_label, resumeContext) => {
    const { client } = recordingClient({ data: rowWithResumeContext(resumeContext), error: null });
    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual(NULLS);
  });

  it("erro PostgREST devolve null/null", async () => {
    const { client } = recordingClient({ data: null, error: { message: "boom" } });
    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual(NULLS);
  });

  it("cliente que LANÇA de forma síncrona devolve null/null (nunca propaga)", async () => {
    const { client } = recordingClient({ data: null, error: null }, { throwsSync: true });
    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual(NULLS);
  });

  it("cliente que REJEITA de forma assíncrona devolve null/null (nunca propaga)", async () => {
    const { client } = recordingClient({ data: null, error: null }, { rejects: true });
    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual(NULLS);
  });

  it("valores não finitos/strings no economicSnapshot viram null por campo (nunca zero)", async () => {
    const { client } = recordingClient({
      data: rowWithResumeContext({
        ...durableResumeContext(),
        economicSnapshot: {
          usdBrlRateAtGeneration: Number.POSITIVE_INFINITY,
          creditValueBrlAtGeneration: "1",
        },
      }),
      error: null,
    });

    await expect(readExpansionEconomicSnapshot(readerInput(client))).resolves.toEqual(NULLS);
  });

  it("consulta restrita: apenas input_snapshot, filtrando id E store_id", async () => {
    const { client, calls } = recordingClient({
      data: rowWithResumeContext(durableResumeContext()),
      error: null,
    });

    await readExpansionEconomicSnapshot(readerInput(client));

    expect(calls.from).toEqual(["campaigns"]);
    expect(calls.select).toEqual(["input_snapshot"]);
    expect(calls.eq).toHaveLength(2);
    expect(calls.eq).toContainEqual(["id", CAMPAIGN_ID]);
    expect(calls.eq).toContainEqual(["store_id", STORE_ID]);
  });

  it("não consulta outra campanha/loja: nenhum filtro usa identidade diferente", async () => {
    const { client, calls } = recordingClient({
      data: rowWithResumeContext(durableResumeContext()),
      error: null,
    });

    await readExpansionEconomicSnapshot(readerInput(client));

    const accepted = new Set<unknown>([CAMPAIGN_ID, STORE_ID]);
    for (const [, value] of calls.eq) {
      expect(accepted.has(value)).toBe(true);
    }
  });

  it("não consulta o parâmetro econômico vigente (comportamental)", async () => {
    const { client } = recordingClient({
      data: rowWithResumeContext(durableResumeContext()),
      error: null,
    });

    await readExpansionEconomicSnapshot(readerInput(client));
    expect(economicSpy.getParameter).not.toHaveBeenCalled();
  });

  it("não importa nem menciona o serviço de parâmetro econômico (estático)", () => {
    const source = readFileSync(sourcePath("../economic-snapshot-reader.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

    expect(source).not.toMatch(/@\/lib\/economic/);
    expect(source).not.toMatch(/EconomicParameterService/);
    expect(source).not.toMatch(/resolveEconomicSnapshot/);
  });
});

describe("withEconomicReadBudget — limite de espera injetável", () => {
  it("declara o limite padrão de 2000 ms", () => {
    expect(ECONOMIC_SNAPSHOT_READ_TIMEOUT_MS).toBe(2000);
  });

  it("invoca o THUNK exatamente uma vez e devolve o resultado", async () => {
    const read = vi.fn(async () => ({
      usdBrlRateAtGeneration: 5.1,
      creditValueBrlAtGeneration: 1,
    }));

    await expect(withEconomicReadBudget(read, 50)).resolves.toEqual({
      usdBrlRateAtGeneration: 5.1,
      creditValueBrlAtGeneration: 1,
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("timer vencido devolve null/null sem bloquear", async () => {
    const read = vi.fn(() => new Promise<never>(() => {}));

    await expect(withEconomicReadBudget(read, 15)).resolves.toEqual(NULLS);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("rejeição da dependência devolve null/null (sem unhandled rejection)", async () => {
    const read = vi.fn(async () => Promise.reject(new Error("snapshot_down")));
    await expect(withEconomicReadBudget(read, 50)).resolves.toEqual(NULLS);
  });

  it("exceção síncrona do thunk devolve null/null", async () => {
    const read = vi.fn(() => {
      throw new Error("sync_down");
    });
    await expect(withEconomicReadBudget(read, 50)).resolves.toEqual(NULLS);
  });

  it("resultado inválido é normalizado por campo (nunca inventa valor)", async () => {
    const read = vi.fn(async () => ({
      usdBrlRateAtGeneration: "5.1",
      creditValueBrlAtGeneration: Number.NaN,
    })) as never;

    await expect(withEconomicReadBudget(read, 50)).resolves.toEqual(NULLS);
  });

  it("timeoutMs não finito/≤ 0 cai no default (nunca ilimitado)", async () => {
    const read = vi.fn(() => new Promise<never>(() => {}));

    await expect(withEconomicReadBudget(read, Number.NaN)).resolves.toEqual(NULLS);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

const SOURCE_ARTIFACT = {
  id: "src",
  storeId: "s",
  campaignId: "c",
  operationId: "o",
  role: "square_prepared",
  format: "1:1",
  origin: "deterministic_preparation",
  derivedFromArtifactId: "orig",
  sourceCampaignId: null,
  storageBucket: "b",
  storagePath: "p",
  width: 1152,
  height: 1152,
  mimeType: "image/jpeg",
  byteSize: 1,
  checksumSha256: "x",
  provenance: {},
  createdAt: "now",
} as never;

const SELECTION = {
  model: "gpt-image-2.5-sunburst",
  quality: "low",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
} as const;

function stepInput() {
  return {
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    acquisitionId: "22222222-2222-4222-8222-222222222222",
    attemptReference: "ref",
    attemptTarget: "initial",
    deadlineAtMs: 100_000,
    expansionStatus: "pending",
    allowNewPaidStep: true,
    selection: SELECTION,
  } as never;
}

function stepHarness(overrides: Record<string, unknown> = {}) {
  const expand = vi.fn(async () => ({
    kind: "expanded",
    artifact: {},
    bytes: Buffer.alloc(0),
    persistence: "created",
    call: {},
  }));
  const deps = {
    control: {
      acquire: vi.fn(async () => ({
        acquired: true,
        authorization: "execute",
        reason: null,
        attemptToken: "t",
        attemptNumber: 1,
        stage: "expansion",
        target: "initial",
      })),
      finish: vi.fn(async () => ({
        success: true,
        idempotent: false,
        status: "completed",
        stage: "expansion",
        attemptNumber: 1,
      })),
      getOperationView: vi.fn(),
    },
    expand,
    retrieve: vi.fn(async () => ({
      kind: "integral",
      artifact: SOURCE_ARTIFACT,
      bytes: Buffer.alloc(0),
    })),
    probe: vi.fn(async () => ({ kind: "proceed" })),
    preflightFrozenExpansion: vi.fn(async (selection: unknown) => ({ ok: true, selection })),
    clock: () => 0,
    ...overrides,
  } as never;
  return { deps, expand };
}

describe("runExpansionStep — continuação/retry e operação antiga (D-04)", () => {
  it("duas execuções mantêm o snapshot ORIGINAL mesmo com parâmetros vigentes alterados", async () => {
    const frozen = { usdBrlRateAtGeneration: 5.1, creditValueBrlAtGeneration: 1 };
    // Parâmetros vigentes simulados: mudam entre as execuções, nunca usados.
    let currentUsdBrlRate = 5.1;
    let currentCreditValueBrl = 1;
    const read = vi.fn(async () => frozen);

    const first = stepHarness({ readEconomicSnapshot: read });
    currentUsdBrlRate = 6.9;
    currentCreditValueBrl = 2.3;
    await expect(runExpansionStep(stepInput(), first.deps)).resolves.toEqual({
      kind: "completed",
    });

    const second = stepHarness({ readEconomicSnapshot: read });
    currentUsdBrlRate = 7.5;
    currentCreditValueBrl = 3.1;
    await expect(runExpansionStep(stepInput(), second.deps)).resolves.toEqual({
      kind: "completed",
    });

    for (const harness of [first, second]) {
      const expandCalls = harness.expand.mock.calls as Array<
        [{ usdBrlRateAtGeneration: unknown; creditValueBrlAtGeneration: unknown }]
      >;
      expect(expandCalls).toHaveLength(1);
      expect(expandCalls[0][0].usdBrlRateAtGeneration).toBe(5.1);
      expect(expandCalls[0][0].creditValueBrlAtGeneration).toBe(1);
      expect(expandCalls[0][0].usdBrlRateAtGeneration).not.toBe(currentUsdBrlRate);
      expect(expandCalls[0][0].creditValueBrlAtGeneration).not.toBe(currentCreditValueBrl);
    }
    // Uma leitura por execução; nenhum acesso ao serviço de parâmetro vigente.
    expect(read).toHaveBeenCalledTimes(2);
    expect(economicSpy.getParameter).not.toHaveBeenCalled();
  });

  it("operação antiga (linha sem resumeContext/economicSnapshot) é null/null e não bloqueia", async () => {
    const { client } = recordingClient({ data: { input_snapshot: {} }, error: null });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const harness = stepHarness({ client });
      await expect(runExpansionStep(stepInput(), harness.deps)).resolves.toEqual({
        kind: "completed",
      });

      const expandCalls = harness.expand.mock.calls as Array<
        [{ usdBrlRateAtGeneration: unknown; creditValueBrlAtGeneration: unknown }]
      >;
      expect(expandCalls).toHaveLength(1);
      expect(expandCalls[0][0].usdBrlRateAtGeneration).toBeNull();
      expect(expandCalls[0][0].creditValueBrlAtGeneration).toBeNull();
    }
    expect(economicSpy.getParameter).not.toHaveBeenCalled();
  });
});
