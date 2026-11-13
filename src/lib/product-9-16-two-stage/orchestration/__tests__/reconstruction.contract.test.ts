// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { describeDurableInput } from "../durable-input";
import { reconstructFirstExecution, reconstructForRepair } from "../reconstruction";

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
});
