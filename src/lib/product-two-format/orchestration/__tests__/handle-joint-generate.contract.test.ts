import { beforeEach, describe, expect, it, vi } from "vitest";

const createCampaign = vi.fn();
const isEnabled = vi.fn();
const preflightJointSelection = vi.fn();
const readOperationView = vi.fn();
const runTwoFormatGeneration = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => from(...args) },
}));
vi.mock("@/lib/campaign/persistence", () => ({
  createCampaign: (...args: unknown[]) => createCampaign(...args),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isProduct9_16TwoStageEnabled: (...args: unknown[]) => isEnabled(...args),
}));
vi.mock("@/lib/legal/clearance", () => ({
  requireLegalClearance: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/store-readiness", () => ({
  getStoreReadiness: vi.fn(async () => ({ ready: true, missing: [] })),
}));
vi.mock("@/lib/rate-limit/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: () => ({ rateLimitEnabled: false }),
}));
vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: class {
    async getBalance() {
      return 10;
    }
  },
}));
vi.mock("../run-two-format-deps", () => ({
  createTwoFormatRunDeps: () => ({
    readOperationView: (...args: unknown[]) => readOperationView(...args),
    preflightJointSelection: (...args: unknown[]) => preflightJointSelection(...args),
  }),
}));
vi.mock("../run-two-format", () => ({
  runTwoFormatGeneration: (...args: unknown[]) => runTwoFormatGeneration(...args),
}));

import type { NewFlowGenerateImageRequest } from "@/lib/image-generation/schema";
import { buildJointResumeContext } from "../joint-resume-context";
import { handleJointGenerateRequest } from "../handle-joint-generate";

const STORE = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";
const OPERATION = "44444444-4444-4444-8444-444444444444";
const SQUARE = "55555555-5555-4555-8555-555555555555";
const BASE = "66666666-6666-4666-8666-666666666666";

const newFlow: NewFlowGenerateImageRequest = {
  storeId: STORE,
  productName: "Produto",
  campaignId: CAMPAIGN,
  operationId: OPERATION,
  campaignIntent: "offer",
  backgroundDirection: "studio",
  campaignFormat: "1:1+9:16",
  productImages: [
    {
      role: "primary",
      source: "upload",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,AAAA",
    },
  ],
};

const context = buildJointResumeContext({
  operationId: OPERATION,
  uuid: (() => {
    const values = [SQUARE, BASE];
    return () => values.shift() ?? BASE;
  })(),
});

const jointSnapshot = {
  campaignFormat: "1:1+9:16",
  formatContractVersion: "f60.7-two-format-v1",
  generationOrigin: "two_format_two_stage",
  generationContractVersion: "f60.7-two-format-v1",
  jointResumeContext: context,
};

function campaignRow(data: unknown) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data, error: null }),
      }),
    }),
  };
}

beforeEach(() => {
  createCampaign.mockReset();
  isEnabled.mockReset();
  preflightJointSelection.mockReset();
  readOperationView.mockReset();
  runTwoFormatGeneration.mockReset();
  from.mockReset();
  runTwoFormatGeneration.mockImplementation(async () => new Response("ok"));
  preflightJointSelection.mockResolvedValue({
    ok: true,
    selection: {
      model: "gpt-image-2.5-flare",
      quality: "low",
      configVersionId: "77777777-7777-4777-8777-777777777777",
    },
  });
});

describe("F60.7 C1 — criação inicial e replay", () => {
  it("corrida de criação reutiliza a identidade vencedora", async () => {
    from.mockReturnValueOnce(campaignRow(null));
    createCampaign.mockRejectedValueOnce(new Error("duplicate key"));
    from.mockReturnValueOnce(
      campaignRow({
        id: CAMPAIGN,
        store_id: STORE,
        input_snapshot: jointSnapshot,
      }),
    );
    readOperationView.mockResolvedValue({ kind: "absent" });
    isEnabled.mockResolvedValue(true);

    await handleJointGenerateRequest({ newFlow, userId: USER });

    expect(createCampaign).toHaveBeenCalledTimes(1);
    expect(preflightJointSelection).toHaveBeenCalledTimes(1);
    expect(runTwoFormatGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "new",
        allowNewPaidStep: true,
        squareDeliveryId: SQUARE,
        initialRequestId: BASE,
      }),
      expect.anything(),
    );
  });

  it("operação existente é replay read-only, sem preflight/criação", async () => {
    from.mockReturnValueOnce(
      campaignRow({
        id: CAMPAIGN,
        store_id: STORE,
        input_snapshot: jointSnapshot,
      }),
    );
    readOperationView.mockResolvedValue({
      kind: "found",
      view: { campaignId: CAMPAIGN, operationId: OPERATION },
    });

    await handleJointGenerateRequest({ newFlow, userId: USER });

    expect(createCampaign).not.toHaveBeenCalled();
    expect(preflightJointSelection).not.toHaveBeenCalled();
    expect(runTwoFormatGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "new",
        allowNewPaidStep: false,
        squareDeliveryId: SQUARE,
      }),
      expect.anything(),
    );
  });

  it("flag OFF sem operação retorna erro sem criação/preflight", async () => {
    from.mockReturnValueOnce(campaignRow(null));
    readOperationView.mockResolvedValue({ kind: "absent" });
    isEnabled.mockResolvedValue(false);

    const response = await handleJointGenerateRequest({
      newFlow,
      userId: USER,
    });

    expect(response.status).toBe(503);
    expect(createCampaign).not.toHaveBeenCalled();
    expect(preflightJointSelection).not.toHaveBeenCalled();
    expect(runTwoFormatGeneration).not.toHaveBeenCalled();
  });
});
