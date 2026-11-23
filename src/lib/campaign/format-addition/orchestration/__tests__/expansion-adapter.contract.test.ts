// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import type { ExpandVerticalResult } from "@/lib/campaign/vertical-expansion/types";

import type { FrozenEconomics } from "../../frozen-economics";
import {
  createFormatAdditionExpansionRunner,
  createProductionFormatAdditionDeps,
} from "../deps";
import type { FormatAdditionExpansionInput } from "../types";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const CONFIG_VERSION = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";

const PRICING: ModelPricing = {
  inputCostUsd: 1,
  cachedInputCostUsd: 0.5,
  imageInputTokenUsdPer1M: 2,
  imageTokenUsdPer1M: 30,
  imageCachedInputTokenUsdPer1M: 1,
  imageUnitCostUsd: 0.03,
};

const FROZEN: FrozenEconomics = {
  selection: {
    model: "gpt-image-2.5-flare",
    quality: "low",
    configVersionId: CONFIG_VERSION,
    selectionOrigin: "configured",
  },
  pricingVersionId: "pricing-frozen-1",
  pricing: PRICING,
  usdBrlRateAtGeneration: 5.5,
  creditValueBrlAtGeneration: 1.2,
  capturedAt: "2026-11-23T12:00:00.000Z",
};

function input(): FormatAdditionExpansionInput {
  return {
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    authorization: { kind: "system" },
    selection: {
      model: FROZEN.selection.model,
      quality: FROZEN.selection.quality,
      configVersionId: FROZEN.selection.configVersionId,
      origin: "configured",
    },
    frozen: FROZEN,
    acquisitionId: "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d",
    attemptReference: "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e",
    attemptTarget: "initial",
    deadlineAtMs: 100_000,
    expansionStatus: "pending",
    allowNewPaidStep: true,
  };
}

function reused(): ExpandVerticalResult {
  return {
    kind: "reused",
    artifact: { id: "artifact-1" } as never,
    bytes: Buffer.alloc(0),
    adoption: false,
    call: null,
  };
}

describe("F62-04 — adaptador de expansão entrega catálogo/pricing congelados (C2)", () => {
  it("repassa seleção e leitores congelados ao expansor real", async () => {
    let captured:
      | {
          selection: unknown;
          catalog: unknown;
          pricing: unknown;
          pilotSpend?: unknown;
        }
      | undefined;

    const control = {
      acquire: vi.fn(async () => ({
        acquired: true as const,
        authorization: "execute" as const,
        reason: null,
        attemptToken: "attempt-token",
        attemptNumber: 1,
        stage: "expansion" as const,
        target: "initial" as const,
      })),
      finish: vi.fn(async () => ({
        success: true as const,
        idempotent: false,
        status: "completed" as const,
        stage: "expansion" as const,
        attemptNumber: 1,
      })),
      getOperationView: vi.fn(),
    };

    const runner = createFormatAdditionExpansionRunner({
      control: control as never,
      clock: () => 1_000,
      retrieve: (async () => ({
        kind: "integral",
        artifact: { id: "source-artifact" } as never,
        bytes: Buffer.alloc(0),
      })) as never,
      probe: (async () => ({ kind: "proceed" })) as never,
      expand: (async (
        _expandInput: unknown,
        deps: {
          selection: unknown;
          catalog: unknown;
          pricing: unknown;
          pilotSpend?: unknown;
        },
      ) => {
        captured = deps;
        return reused();
      }) as never,
    });

    const result = await runner(input());
    await expect(result).toMatchObject({ kind: "completed" });

    expect(captured).toBeDefined();
    expect(captured?.selection).toEqual(input().selection);

    const catalog = captured?.catalog as {
      readActiveCatalogRows: () => Promise<{
        kind: string;
        rows: Array<{ model: string; provider: string; protocol: string }>;
      }>;
    };
    const catalogResult = await catalog.readActiveCatalogRows();
    expect(catalogResult.kind).toBe("ok");
    expect(catalogResult.rows).toEqual([
      expect.objectContaining({
        model: FROZEN.selection.model,
        provider: "openai",
        protocol: "images",
      }),
    ]);

    const pricing = captured?.pricing as {
      readModelPricing: (params: {
        provider: string;
        model: string;
        quality?: string;
      }) => Promise<unknown>;
    };
    await expect(
      pricing.readModelPricing({
        provider: "openai",
        model: FROZEN.selection.model,
        quality: FROZEN.selection.quality,
      }),
    ).resolves.toEqual({
      kind: "found",
      pricing: PRICING,
      versionId: FROZEN.pricingVersionId,
    });
    await expect(
      pricing.readModelPricing({
        provider: "openai",
        model: "gpt-image-other",
        quality: FROZEN.selection.quality,
      }),
    ).resolves.toEqual({
      kind: "read_failed",
      reason: "frozen_selection_mismatch",
    });
  });

  it("pilot gate armado chega ao expansor; ausente não inventa gate", async () => {
    const captured: Array<{ pilotSpend?: unknown }> = [];
    const control = {
      acquire: vi.fn(async () => ({
        acquired: true as const,
        authorization: "execute" as const,
        reason: null,
        attemptToken: "attempt-token",
        attemptNumber: 1,
        stage: "expansion" as const,
        target: "initial" as const,
      })),
      finish: vi.fn(async () => ({
        success: true as const,
        idempotent: false,
        status: "completed" as const,
        stage: "expansion" as const,
        attemptNumber: 1,
      })),
      getOperationView: vi.fn(),
    };
    const runner = createFormatAdditionExpansionRunner({
      control: control as never,
      clock: () => 1_000,
      retrieve: (async () => ({
        kind: "integral",
        artifact: { id: "source-artifact" } as never,
        bytes: Buffer.alloc(0),
      })) as never,
      probe: (async () => ({ kind: "proceed" })) as never,
        expand: (async (
          _expandInput: unknown,
          deps: { pilotSpend?: unknown },
        ) => {
          captured.push(deps);
          return reused();
        }) as never,
    });

    const gate = {
      beginPaidCall: vi.fn(),
      endPaidCall: vi.fn(),
      markUnknown: vi.fn(),
    };
    await runner({ ...input(), pilotSpend: gate });
    expect(captured[0]).toMatchObject({ pilotSpend: gate });

    await runner(input());
    expect(captured[1]).not.toHaveProperty("pilotSpend");
  });

  it("root sem resolvedor falha fechado; resolvedor injetado preserva os três estados", async () => {
    const client = {} as never;
    const withoutResolver = createProductionFormatAdditionDeps({ client });
    await expect(
      withoutResolver.resolvePilotSpend({ storeId: STORE }),
    ).resolves.toEqual({
      kind: "blocked",
      reason: "pilot_gate_resolver_not_configured",
    });

    for (const resolution of [
      { kind: "inactive" as const },
      { kind: "blocked" as const, reason: "pilot_requires_reconciliation" },
    ]) {
      const deps = createProductionFormatAdditionDeps({
        client,
        pilotSpendResolver: async () => resolution,
      });
      await expect(
        deps.resolvePilotSpend({ storeId: STORE }),
      ).resolves.toEqual(resolution);
    }

    const armedGate = {
      beginPaidCall: vi.fn(),
      endPaidCall: vi.fn(),
      markUnknown: vi.fn(),
    };
    const armed = createProductionFormatAdditionDeps({
      client,
      pilotSpendResolver: async () => ({ kind: "armed", gate: armedGate }),
    });
    await expect(
      armed.resolvePilotSpend({ storeId: STORE }),
    ).resolves.toEqual({ kind: "armed", gate: armedGate });
  });
});
