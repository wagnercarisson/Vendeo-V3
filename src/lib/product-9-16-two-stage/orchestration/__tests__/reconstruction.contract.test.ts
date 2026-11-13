// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { describeDurableInput } from "../durable-input";
import {
  reconstructFirstExecution,
  reconstructForComplete,
  reconstructForRepair,
} from "../reconstruction";

const BYTES = Buffer.from("image-bytes");
const DATA_URL = `data:image/png;base64,${BYTES.toString("base64")}`;
const descriptorResult = describeDurableInput({
  kind: "product",
  role: "primary",
  index: 0,
  storagePath: "s/c/inputs/hash.png",
  mimeType: "image/png",
  dataUrl: DATA_URL,
});
if (!descriptorResult.ok) throw new Error("fixture descriptor failed");
const descriptor = descriptorResult.descriptor;

const briefing = {
  backgroundDirection: "studio",
  product: { name: "Produto" },
  commercial: { intent: "offer" },
  constraints: { mandatoryArtworkText: null },
};
const resumeContext = {
  briefing,
  briefingText: JSON.stringify(briefing),
  campaignIntent: "offer",
  backgroundDirection: "studio",
  identityDirective: null,
  identityContext: null,
  copyContext: { storeName: "Loja" },
  economicSnapshot: { usdBrlRateAtGeneration: 5.1, creditValueBrlAtGeneration: 1 },
  inputFiles: [descriptor],
};
const frozenContentReferences = [
  { kind: "product", id: descriptor.contentId, role: "primary", index: 0 },
];

function fakeClient(row: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  } as never;
}

describe("reconstructFirstExecution", () => {
  it("rebuilds content only from durable snapshot + verified input files", async () => {
    const result = await reconstructFirstExecution(
      {
        campaignId: "c",
        operationId: "o",
        storeId: "s",
        frozen: { kind: "absent" },
      },
      {
        client: fakeClient({
          input_snapshot: { resumeContext, frozenContentReferences },
          identity_snapshot: null,
        }),
        readInputBytes: async () => ({ kind: "bytes", bytes: BYTES }),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.productImagesDataUrls).toEqual([DATA_URL]);
    expect(result.content.briefingText).toBe(JSON.stringify(briefing));
    expect(result.frozenState).toBe("absent");
  });

  async function reconstructWithResume(
    resume: Record<string, unknown>,
  ) {
    return reconstructFirstExecution(
      {
        campaignId: "c",
        operationId: "o",
        storeId: "s",
        frozen: { kind: "absent" },
      },
      {
        client: fakeClient({
          input_snapshot: { resumeContext: resume, frozenContentReferences },
          identity_snapshot: null,
        }),
        readInputBytes: async () => ({ kind: "bytes", bytes: BYTES }),
      },
    );
  }

  it("aceita briefing com chaves reordenadas (JSONB round-trip), inclusive aninhadas", async () => {
    const reorderedBriefing = {
      constraints: { mandatoryArtworkText: null },
      commercial: { intent: "offer" },
      product: { name: "Produto" },
      backgroundDirection: "studio",
    };
    const result = await reconstructWithResume({
      ...resumeContext,
      briefing: reorderedBriefing,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A string ORIGINAL e preservada (nao reescrita pelo canonicalizador).
    expect(result.content.briefingText).toBe(JSON.stringify(briefing));
    expect(result.content.briefing).toEqual(reorderedBriefing);
  });

  it.each([
    ["produto", { ...briefing, product: { name: "Outro Produto" } }],
    [
      "preco",
      {
        ...briefing,
        commercial: { intent: "offer", discountedPriceText: "R$ 9,90" },
      },
    ],
    [
      "texto obrigatorio",
      {
        ...briefing,
        constraints: { mandatoryArtworkText: "Texto diferente" },
      },
    ],
  ])("recusa conteudo realmente diferente (%s)", async (_label, changedBriefing) => {
    const result = await reconstructWithResume({
      ...resumeContext,
      briefing: changedBriefing,
    });
    expect(result).toEqual({
      ok: false,
      reason: "resume_context_malformed",
      definitive: true,
    });
  });

  it("recusa briefingText com JSON invalido", async () => {
    const result = await reconstructWithResume({
      ...resumeContext,
      briefingText: "{not-json",
    });
    expect(result).toEqual({
      ok: false,
      reason: "resume_context_malformed",
      definitive: true,
    });
  });

  it("mantem arrays sensiveis a ordem (nao canonicaliza a ordem dos itens)", async () => {
    const arrayBriefing = {
      ...briefing,
      constraints: {
        mandatoryArtworkText: null,
        notes: ["primeiro", "segundo"],
      },
    };
    const result = await reconstructWithResume({
      ...resumeContext,
      briefing: arrayBriefing,
      briefingText: JSON.stringify({
        ...briefing,
        constraints: {
          mandatoryArtworkText: null,
          notes: ["segundo", "primeiro"],
        },
      }),
    });
    expect(result).toEqual({
      ok: false,
      reason: "resume_context_malformed",
      definitive: true,
    });
  });

  it("fails closed for missing input file", async () => {
    const result = await reconstructFirstExecution(
      {
        campaignId: "c",
        operationId: "o",
        storeId: "s",
        frozen: { kind: "absent" },
      },
      {
        client: fakeClient({
          input_snapshot: { resumeContext, frozenContentReferences },
          identity_snapshot: null,
        }),
        readInputBytes: async () => ({ kind: "absent" }),
      },
    );
    expect(result).toEqual({ ok: false, reason: "input_file_missing", definitive: true });
  });

  it("reconstructForRepair refuses non-repairable state", async () => {
    const result = await reconstructForRepair(
      {
        campaignId: "c",
        operationId: "o",
        storeId: "s",
        frozen: { kind: "absent" },
      },
      {},
    );
    expect(result).toEqual({ ok: false, reason: "frozen_state_not_absent", definitive: true });
  });

  it("treats a snapshot read error as indeterminate, not corruption", async () => {
    const failingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: "boom" } }),
          }),
        }),
      }),
    } as never;
    const result = await reconstructFirstExecution(
      {
        campaignId: "c",
        operationId: "o",
        storeId: "s",
        frozen: { kind: "absent" },
      },
      { client: failingClient },
    );
    expect(result).toEqual({
      ok: false,
      reason: "snapshot_indeterminate",
      definitive: false,
    });
  });

  it("treats a thrown query as indeterminate, not corruption", async () => {
    const throwingClient = {
      from: () => {
        throw new Error("network");
      },
    } as never;
    const result = await reconstructFirstExecution(
      {
        campaignId: "c",
        operationId: "o",
        storeId: "s",
        frozen: { kind: "absent" },
      },
      { client: throwingClient },
    );
    expect(result).toMatchObject({
      ok: false,
      reason: "snapshot_indeterminate",
      definitive: false,
    });
  });

  it("reconstructs durable content for frozen complete without repair", async () => {
    const result = await reconstructForComplete(
      {
        campaignId: "c",
        operationId: "o",
        storeId: "s",
        frozen: { kind: "complete" } as never,
      },
      {
        client: fakeClient({
          input_snapshot: { resumeContext, frozenContentReferences },
          identity_snapshot: null,
        }),
        readInputBytes: async () => ({ kind: "bytes", bytes: BYTES }),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frozenState).toBe("complete");
    expect(result.content.productImagesDataUrls).toEqual([DATA_URL]);
    expect(result.repaired).toBeUndefined();
  });

  it("reconstructForComplete refuses absent/repairable", async () => {
    for (const frozen of [{ kind: "absent" }, { kind: "repairable" }] as const) {
      const result = await reconstructForComplete(
        { campaignId: "c", operationId: "o", storeId: "s", frozen: frozen as never },
        {},
      );
      expect(result).toEqual({
        ok: false,
        reason: "frozen_state_not_absent",
        definitive: true,
      });
    }
  });
});
