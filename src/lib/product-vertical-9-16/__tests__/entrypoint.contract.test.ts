// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const m = vi.hoisted(() => ({
  engine: vi.fn(),
  project: vi.fn(),
}));

vi.mock("@/lib/product-1-1/orchestration/generation-orchestrator", () => ({
  runProductOneToOneGeneration: m.engine,
}));

vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: m.project,
}));

import type { ImagePairCostResolution } from "@/lib/ai-cost/image-pair-pricing";
import type { ProductOneToOneGenerationDeps } from "@/lib/product-1-1/orchestration/generation-orchestrator";
import {
  makeVerticalProjection,
  runProductVertical9x16Generation,
  verticalExpectedArtifactPath,
} from "../orchestration/entrypoint";
import {
  createVerticalAttemptCostResolver,
  createVerticalCostGuard,
  VerticalProofBudgetExceededError,
} from "../orchestration/cost-profile";
import { createProofBudget } from "../cost/vertical-estimate";
import { VerticalEstimateMissingError } from "../cost/vertical-estimate";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

const CONFIG = {
  primary: { model: "gpt-image-2.5-sunburst" as const, quality: "medium" as const },
  fallback: { model: "gpt-image-2" as const, quality: "low" as const },
};

function resolution(over: Partial<ImagePairCostResolution> = {}): ImagePairCostResolution {
  return {
    primary: {
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      costUsd: 0.044,
      versionId: "pricing-primary",
      costSource: "pricing_table",
      pricing: { imageTokenUsdPer1M: 30 },
    },
    fallback: {
      model: "gpt-image-2",
      quality: "low",
      costUsd: 0.042,
      versionId: "pricing-fallback",
      costSource: "pricing_table",
      pricing: { imageTokenUsdPer1M: 30 },
    },
    ...over,
  };
}

const input = {
  campaignId: CAMPAIGN,
  operationId: OPERATION,
  storeId: STORE,
  briefing: {
    backgroundDirection: "studio" as const,
    product: { name: "Produto", description: null },
    commercial: {
      intent: "offer" as const,
      originalPriceText: null,
      discountedPriceText: "R$ 10",
      badge: null,
      validity: null,
    },
    constraints: { mandatoryArtworkText: null },
  },
  briefingText: "briefing",
  campaignIntent: "offer" as const,
  backgroundDirection: "studio" as const,
  productImagesDataUrls: ["data:image/png;base64,primary"],
};

const artifact = { storeArtifact: vi.fn(), probeArtifact: vi.fn() };

beforeEach(() => {
  m.engine.mockReset();
  m.project.mockReset();
  m.engine.mockResolvedValue(new Response("engine-response"));
  m.project.mockResolvedValue({ projected: true, reason: "projected" });
});

describe("F59 — entrypoint vertical", () => {
  it("compõe as deps verticais sobre a engine e devolve a mesma Response", async () => {
    const response = await runProductVertical9x16Generation(input, {
      artifact: artifact as never,
      resolvePair: async () => resolution(),
      client: {} as never,
    });

    expect(response).toBe(await m.engine.mock.results[0].value);
    const deps = m.engine.mock.calls[0][1] as ProductOneToOneGenerationDeps;
    expect(deps.imageSize).toBe("1152x2048");
    expect(typeof deps.composePrompt).toBe("function");
    expect(deps.artifact).toBe(artifact);
    expect(typeof deps.projectDeliveredCampaign).toBe("function");
    expect(typeof deps.beforeReservation).toBe("function");
    expect(typeof deps.resolveAttemptCost).toBe("function");
    expect(deps.client).toEqual({});
  });

  it("a projeção recebe expectedArtifactPath no INPUT e client nas deps", async () => {
    const client = { marker: "client" };
    const project = makeVerticalProjection(STORE, CAMPAIGN, OPERATION, {
      client: client as never,
    });
    await project({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION });

    expect(m.project).toHaveBeenCalledWith(
      {
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        expectedArtifactPath: verticalExpectedArtifactPath(
          STORE,
          CAMPAIGN,
          OPERATION,
        ),
      },
      { client },
    );
  });

  it("resolveAttemptCost preserva versionId/costSource/pricing e só troca costUsd", async () => {
    const resolver = createVerticalAttemptCostResolver({
      resolvePair: async () => resolution(),
    });
    const result = await resolver(CONFIG);

    expect(result.primary).toMatchObject({
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      costUsd: 0.11,
      versionId: "pricing-primary",
      costSource: "pricing_table",
      pricing: { imageTokenUsdPer1M: 30 },
    });
    expect(result.fallback).toMatchObject({
      costUsd: 0.105,
      versionId: "pricing-fallback",
      pricing: { imageTokenUsdPer1M: 30 },
    });
  });

  it("custo unitário ausente vira costUsd null sem apagar os demais campos", async () => {
    const resolver = createVerticalAttemptCostResolver({
      resolvePair: async () =>
        resolution({
          primary: {
            model: "m",
            quality: "low",
            costUsd: null,
            versionId: "v",
            costSource: "pricing_table",
            pricing: { imageTokenUsdPer1M: 30 },
          },
        }),
    });
    const result = await resolver(CONFIG);
    expect(result.primary.costUsd).toBeNull();
    expect(result.primary.versionId).toBe("v");
    expect(result.primary.costSource).toBe("pricing_table");
    expect(result.primary.pricing).toEqual({ imageTokenUsdPer1M: 30 });
  });

  it("guarda falha sem estimativa vertical", async () => {
    const guard = createVerticalCostGuard({
      resolvePair: async () =>
        resolution({
          primary: {
            model: "m",
            quality: "low",
            costUsd: null,
            versionId: "v",
            costSource: "pricing_table",
          },
        }),
    });
    await expect(guard(CONFIG)).rejects.toBeInstanceOf(VerticalEstimateMissingError);
  });

  it("guarda falha quando o orçamento não cobre o maior estimado", async () => {
    const guard = createVerticalCostGuard({
      resolvePair: async () => resolution(),
      budget: createProofBudget({ capUsd: 0.1, plannedCalls: 1 }),
    });
    await expect(guard(CONFIG)).rejects.toBeInstanceOf(
      VerticalProofBudgetExceededError,
    );
  });

  it("guarda passa com orçamento suficiente", async () => {
    const guard = createVerticalCostGuard({
      resolvePair: async () => resolution(),
      budget: createProofBudget({ capUsd: 3, plannedCalls: 1 }),
    });
    await expect(guard(CONFIG)).resolves.toBeUndefined();
  });

  it("propaga o client injetado para store/projeção", async () => {
    const client = { marker: "same-client" };
    await runProductVertical9x16Generation(input, {
      resolvePair: async () => resolution(),
      client: client as never,
      artifact: { storeArtifact: vi.fn(), probeArtifact: vi.fn() } as never,
    });
    const deps = m.engine.mock.calls[0][1] as ProductOneToOneGenerationDeps;
    expect(deps.client).toBe(client);
  });
});
