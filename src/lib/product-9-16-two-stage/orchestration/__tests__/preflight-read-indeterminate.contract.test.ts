// @vitest-environment node
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/access", () => ({
  verifyCampaignAccess: async () => ({ ok: true, authorization: { kind: "system" } }),
}));
const logged = vi.hoisted(() => ({ events: [] as Record<string, unknown>[] }));
vi.mock("@/lib/logging/pipeline-logger", () => ({
  logPipelineEvent: (event: Record<string, unknown>) => {
    logged.events.push(event);
  },
}));

// Dependências alheias ao preflight: isoladas para o teste exercitar os
// LEITORES REAIS (catálogo/pricing) da seleção CONGELADA com um cliente de
// banco simulado. A configuração administrativa nem existe no fake.
vi.mock("../two-stage-operation-client", () => ({
  ProductTwoStageOperationClient: class {},
}));
vi.mock("@/lib/product-1-1/credit-operation/credit-operation-client", () => ({
  ProductOneToOneCreditOperationClient: class {},
}));
vi.mock("../two-stage-financial-service", () => ({
  TwoStageFinancialService: class {},
}));
vi.mock("../vertical-probe", () => ({
  CompositionVerticalProbe: class {},
}));
vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: vi.fn(async () => ({ projected: true, reason: "projected" })),
}));
vi.mock("@/lib/product-1-1/orchestration/project-closed-campaign", () => ({
  projectClosedCampaign: vi.fn(async () => ({ projected: true, reason: "projected" })),
}));
vi.mock("@/lib/campaign/thumbnail/thumbnail-safe", () => ({
  generateCampaignThumbnailSafely: vi.fn(async () => ({ status: "created" })),
}));
vi.mock("@/lib/campaign/thumbnail/thumbnail-generator", () => ({
  createDefaultThumbnailContext: vi.fn(() => null),
}));
vi.mock("@/lib/ai/image-generation-support-reference", () => ({
  generateSupportReference: vi.fn(() => "support-ref"),
}));
vi.mock("@/lib/campaign/composition-artifacts/repository", () => ({
  getArtifactByIdentity: vi.fn(),
}));
vi.mock("@/lib/campaign/composition-artifacts/retrieve", () => ({
  retrieveCompositionArtifact: vi.fn(),
}));
vi.mock("@/lib/campaign/square-base/run-square-base", () => ({
  runSquareBase: vi.fn(async () => ({ kind: "completed" })),
}));
vi.mock("@/lib/campaign/square-preparation/prepare", () => ({
  prepareSquareForExpansion: vi.fn(),
}));
vi.mock("@/lib/campaign/vertical-expansion/expand", () => ({
  expandVerticalToNineSixteen: vi.fn(),
}));
vi.mock("@/lib/campaign/square-base/frozen-state", () => ({
  readSquareBaseFrozenState: vi.fn(),
  hashImageDataUrl: (value: string) =>
    createHash("sha256").update(value).digest("hex"),
}));

import { createNineSixteenDeps } from "../delivery-deps";
import { runNineSixteenTwoStageGeneration } from "../run-nine-sixteen";
import type { RunNineSixteenDeps, RunNineSixteenInput } from "../types";
import type { TwoStageOperationView } from "../../types";
import { durableReconstruction } from "./fixtures";

const CATALOG_ROW = {
  id: "0f7f1c1a-5f2b-4a4b-9d1e-2a3b4c5d6e7f",
  capability: "campaign_product_image",
  segment: "product",
  provider: "openai",
  model: "gpt-image-2.5-sunburst",
  protocol: "images",
  label: null,
  status: "active",
  source_note: null,
  validated_at: null,
  created_at: "2026-11-11T00:00:00.000Z",
  updated_at: "2026-11-11T00:00:00.000Z",
} as const;

type PricingMode = "ok" | "error" | "missing" | "incomplete";

interface DbState {
  catalog: "ok" | "error";
  pricing: PricingMode;
}

interface PricingBuilder {
  select(): PricingBuilder;
  eq(): PricingBuilder;
  is(): PricingBuilder;
  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>;
}

/** Tabela da configuração administrativa: NÃO deve ser lida na continuação. */
const ADMIN_CONFIG_TABLE = "nine_sixteen_expansion_model_config";

function pricingRow(incomplete: boolean) {
  return {
    id: "f9a278bb-c8ef-4ac4-bada-bf4bb886e041",
    input_token_usd_per_1m: 1,
    output_token_usd_per_1m: null,
    cached_input_token_usd_per_1m: 0.5,
    image_unit_usd: null,
    image_token_usd_per_1m: incomplete ? null : 40,
    image_input_token_usd_per_1m: 10,
    image_cached_input_token_usd_per_1m: 5,
    quality: "low",
  };
}

/** Cliente Supabase simulado que exercita os leitores REAIS dos serviços. */
function makeClient(state: DbState): SupabaseClient {
  return {
    from(table: string) {
      if (table === "ai_model_catalog") {
        return {
          select: async () =>
            state.catalog === "error"
              ? { data: null, error: { message: "catalog_down" } }
              : { data: [CATALOG_ROW], error: null },
        };
      }
      if (table === "ai_model_pricing") {
        const builder: PricingBuilder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => {
            if (state.pricing === "error") {
              return { data: null, error: { message: "pricing_down" } };
            }
            if (state.pricing === "missing") {
              return { data: null, error: null };
            }
            return {
              data: pricingRow(state.pricing === "incomplete"),
              error: null,
            };
          },
        };
        return builder;
      }
      if (table === ADMIN_CONFIG_TABLE) {
        // A continuação NUNCA lê a configuração administrativa: a seleção vem
        // da operação congelada. Uma leitura aqui é falha de contrato.
        throw new Error("admin_config_read_in_continuation");
      }
      throw new Error(`unexpected_table:${table}`);
    },
  } as unknown as SupabaseClient;
}

function step(
  stage: "base" | "expansion",
  status: TwoStageOperationView["base"]["status"],
) {
  return {
    stage,
    status,
    attemptsUsed: status === "pending" ? 0 : 1,
    failureClass: null,
    attemptNumber: status === "pending" ? null : 1,
    claimedAt: null,
  };
}

function pendingView(): TwoStageOperationView {
  return {
    campaignId: "c",
    operationId: "o",
    origin: "9_16_two_stage",
    contractVersion: 1,
    frozenSelection: null,
    credit: {
      status: "reserved",
      terminal: false,
      delivered: false,
      refunded: false,
      reserved: true,
    },
    base: step("base", "pending"),
    expansion: step("expansion", "pending"),
    unknown: false,
    failedOutcome: false,
    supportReference: null,
    nextAction: "acquire_base",
    canContinue: true,
    processingPhase: null,
  };
}

const completedBase = {
  kind: "completed",
  copy: { kind: "not_requested" },
  art: { kind: "created", artifact: {}, snapshotOriginalId: "s" },
  call: null,
};

function compose(state: DbState) {
  const real = createNineSixteenDeps({
    client: makeClient(state),
    clock: () => 0,
    callIdFactory: () => "call",
  });

  const acquire = vi.fn(async (request: { stage: string; target: string }) => ({
    acquired: true,
    authorization: "execute",
    reason: null,
    attemptToken: "t",
    attemptNumber: 1,
    stage: request.stage,
    target: request.target,
  }));
  const finish = vi.fn(async (request: { stage?: string }) => ({
    success: true,
    idempotent: false,
    status: "completed",
    stage: request.stage ?? "base",
    attemptNumber: 1,
  }));
  const recordOutcome = vi.fn(async (request: { outcome: string }) => ({
    success: true,
    idempotent: false,
    outcome: request.outcome,
    stage: "base",
    supportReference: "ref",
  }));
  const refund = vi.fn(async () => ({
    kind: "refunded",
    state: { status: "refunded" },
  }));
  const base = vi.fn(async () => completedBase);

  const deps = {
    ...real,
    control: {
      getOperationView: vi.fn(async () => ({
        kind: "found" as const,
        view: pendingView(),
      })),
      resume: vi.fn(async () => ({
        success: true as const,
        action: "acquire_base" as const,
        nextTarget: "primary" as const,
        origin: "9_16_two_stage" as const,
        creditStatus: "reserved",
        baseStatus: "pending" as const,
        baseAttempts: 0,
        expansionStatus: "pending" as const,
        expansionAttempts: 0,
        unknown: false,
        failedOutcome: false,
      })),
      acquire,
      finish,
      recordOutcome,
    },
    financial: {
      reserveOperationOnce: vi.fn(),
      confirmOnVerticalDelivery: vi.fn(),
      refundOnDefinitiveFailure: refund,
      readFinancialAuthority: vi.fn(async () => ({
        status: "reserved",
        terminal: false,
        delivered: false,
        refunded: false,
        reserved: true,
        storeId: "s",
      })),
    },
    credit: {
      beginPublication: vi.fn(),
      getPublicationEpoch: vi.fn(),
      markArtUploaded: vi.fn(),
      deliver: vi.fn(),
    },
    base,
    prepare: vi.fn(),
    expand: vi.fn(),
    readFrozenState: vi.fn(async () => ({ kind: "complete" as const })),
    retrieveCompositionArtifact: vi.fn(async () => ({
      kind: "integral" as const,
      artifact: { id: "prepared" },
      bytes: Buffer.alloc(0),
    })),
    probeExpansion: vi.fn(async () => ({ kind: "proceed" as const })),
    projectDelivered: vi.fn(async () => ({ projected: true, reason: "projected" })),
    projectClosed: vi.fn(async () => ({ projected: true, reason: "projected" })),
    probeVertical: {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    },
    generateThumbnail: vi.fn(),
    reconstruction: durableReconstruction(),
  } as unknown as RunNineSixteenDeps;

  return { deps, acquire, finish, recordOutcome, refund, base };
}

function continueInput(): RunNineSixteenInput {
  return {
    mode: "continue",
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    requestStartedAtMs: 0,
    acquisitionIds: {
      base: "11111111-1111-4111-8111-111111111111",
      expansion: "22222222-2222-4222-8222-222222222222",
    },
  };
}

async function run(
  deps: RunNineSixteenDeps,
): Promise<Array<Record<string, unknown>>> {
  const response = await runNineSixteenTwoStageGeneration(continueInput(), deps);
  const text = await response.text();
  return text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function terminal(events: Array<Record<string, unknown>>): Record<string, unknown> {
  return events.at(-1) ?? {};
}

beforeEach(() => {
  logged.events.length = 0;
});

describe("preflight real — leitura indeterminada", () => {
  it("erro de catálogo: distingue leitura, mantém a reserva recuperável e prossegue na leitura seguinte", async () => {
    const state: DbState = { catalog: "error", pricing: "ok" };
    const harness = compose(state);

    const first = await run(harness.deps);
    expect(terminal(first)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    });
    expect(harness.acquire).not.toHaveBeenCalled();
    expect(harness.base).not.toHaveBeenCalled();
    expect(harness.refund).not.toHaveBeenCalled();
    expect(harness.recordOutcome).not.toHaveBeenCalled();
    expect(logged.events[0]).toMatchObject({
      event: "expansion_preflight_indeterminate",
      errorCode: "configuration_read_failed:catalog_read_failed",
    });

    state.catalog = "ok";
    const second = await run(harness.deps);
    expect(terminal(second)).toMatchObject({
      type: "processing",
      nextStep: "expansion",
    });
    expect(harness.acquire).toHaveBeenCalledTimes(1);
    expect(harness.base).toHaveBeenCalledTimes(1);
    expect(harness.finish).toHaveBeenCalledTimes(1);
  });

  it("erro de pricing: distingue leitura, mantém a reserva recuperável e prossegue na leitura seguinte", async () => {
    const state: DbState = { catalog: "ok", pricing: "error" };
    const harness = compose(state);

    const first = await run(harness.deps);
    expect(terminal(first)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    });
    expect(harness.acquire).not.toHaveBeenCalled();
    expect(harness.base).not.toHaveBeenCalled();
    expect(harness.refund).not.toHaveBeenCalled();
    expect(harness.recordOutcome).not.toHaveBeenCalled();
    expect(logged.events[0]).toMatchObject({
      event: "expansion_preflight_indeterminate",
      errorCode: "configuration_read_failed:pricing_read_failed",
    });

    state.pricing = "ok";
    const second = await run(harness.deps);
    expect(terminal(second)).toMatchObject({
      type: "processing",
      nextStep: "expansion",
    });
    expect(harness.acquire).toHaveBeenCalledTimes(1);
    expect(harness.base).toHaveBeenCalledTimes(1);
  });

  it("configuração comprovadamente incompleta mantém falha definitiva e estorno único", async () => {
    const state: DbState = { catalog: "ok", pricing: "incomplete" };
    const harness = compose(state);

    const events = await run(harness.deps);

    expect(terminal(events)).toMatchObject({
      type: "error",
      code: "generation_failed",
      refunded: true,
      reason: "pricing_unavailable:incomplete_coverage",
    });
    expect(harness.acquire).not.toHaveBeenCalled();
    expect(harness.base).not.toHaveBeenCalled();
    expect(harness.recordOutcome).toHaveBeenCalledTimes(1);
    expect(harness.refund).toHaveBeenCalledTimes(1);
    expect(logged.events[0]).toMatchObject({
      event: "generation_failed",
      errorCode: "pricing_unavailable:incomplete_coverage",
      metadata: expect.objectContaining({
        outcome: "definitive",
        missing: ["imageTokenUsdPer1M"],
      }),
    });
  });
});
