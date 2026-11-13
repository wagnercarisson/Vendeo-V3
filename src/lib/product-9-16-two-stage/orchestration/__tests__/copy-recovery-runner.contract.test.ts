// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("../reconstruction", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../reconstruction")>();
  return { ...actual, reconstructForRepair: vi.fn() };
});

import { buildTwoStageCopyRunner } from "../copy-recovery-runner";
import { reconstructForRepair } from "../reconstruction";
import type { FrozenContentPayload } from "@/lib/campaign/square-base/types";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

function payload(overrides: Partial<FrozenContentPayload> = {}): FrozenContentPayload {
  return {
    briefing: {
      backgroundDirection: "studio",
      product: { name: "Produto", description: null },
      commercial: {
        intent: "offer",
        originalPriceText: null,
        discountedPriceText: null,
        badge: null,
        validity: null,
      },
      constraints: { mandatoryArtworkText: null },
    },
    copyContext: { storeName: "Loja", segment: "varejo" },
    identityDirective: null,
    campaignIntent: "offer",
    backgroundDirection: "studio",
    referenceSelections: [],
    promptBaseVersion: "v1",
    composerVersion: "v1",
    policyVersions: {},
    ...overrides,
  } as FrozenContentPayload;
}

function client() {
  const tables: string[] = [];
  return {
    tables,
    client: {
      from(table: string) {
        tables.push(table);
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({
            data: {
              input_snapshot: {
                resumeContext: {
                  briefing: {},
                  briefingText: "{}",
                  campaignIntent: "offer",
                  backgroundDirection: "studio",
                  identityDirective: null,
                  identityContext: null,
                  copyContext: { storeName: "Loja" },
                  inputFiles: [],
                  economicSnapshot: {
                    usdBrlRateAtGeneration: 5.1,
                    creditValueBrlAtGeneration: 1,
                  },
                },
              },
            },
            error: null,
          }),
        };
        return builder;
      },
    } as never,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  const backend = client();
  return {
    backend,
    args: {
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      client: backend.client,
      ...overrides,
    },
  };
}

describe("buildTwoStageCopyRunner", () => {
  it("builds the runner from a complete frozen payload without reading the store", async () => {
    const { backend, args } = input();
    const result = await buildTwoStageCopyRunner(args, {
      readFrozenState: async () =>
        ({ kind: "complete", payload: payload() }) as never,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.runner).toMatchObject({
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      storeId: STORE,
      briefing: { product: { name: "Produto" } },
      copyContext: { storeName: "Loja", segment: "varejo" },
      usdBrlRateAtGeneration: 5.1,
      creditValueBrlAtGeneration: 1,
    });
    expect(backend.tables).toEqual(["campaigns"]);
  });

  it("repairs a repairable state and only then builds the runner", async () => {
    vi.mocked(reconstructForRepair).mockResolvedValue({
      ok: true,
      content: {} as never,
      frozenState: "complete",
      repaired: true,
      payload: payload(),
    } as never);
    const { args } = input();
    const result = await buildTwoStageCopyRunner(args, {
      readFrozenState: async () => ({ kind: "repairable" }) as never,
    });
    expect(result.ok).toBe(true);
    expect(reconstructForRepair).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the repair is impossible", async () => {
    vi.mocked(reconstructForRepair).mockResolvedValue({
      ok: false,
      reason: "frozen_repair_divergence",
      definitive: true,
    } as never);
    const { args } = input();
    await expect(
      buildTwoStageCopyRunner(args, {
        readFrozenState: async () => ({ kind: "repairable" }) as never,
      }),
    ).resolves.toEqual({ ok: false, reason: "frozen_state_unrepairable" });
  });

  it("fails closed for absent and indeterminate states", async () => {
    for (const kind of ["absent", "indeterminate", "unproven"] as const) {
      const { args } = input();
      await expect(
        buildTwoStageCopyRunner(args, {
          readFrozenState: async () => ({ kind }) as never,
        }),
      ).resolves.toEqual({ ok: false, reason: "frozen_state_unrepairable" });
    }
  });

  it("requires a frozen copy context", async () => {
    const { args } = input();
    await expect(
      buildTwoStageCopyRunner(args, {
        readFrozenState: async () =>
          ({ kind: "complete", payload: payload({ copyContext: null }) }) as never,
      }),
    ).resolves.toEqual({ ok: false, reason: "copy_context_missing" });
  });
});
