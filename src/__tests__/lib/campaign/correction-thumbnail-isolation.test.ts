// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockFrom, mockRpc, mockStorageFrom, mockRemove, mockGenerateThumbnail } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockRpc: vi.fn(),
    mockStorageFrom: vi.fn(),
    mockRemove: vi.fn(),
    mockGenerateThumbnail: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
  },
}));

vi.mock("@/lib/campaign/thumbnail/thumbnail-safe", () => ({
  generateCampaignThumbnailSafely: mockGenerateThumbnail,
}));
vi.mock("@/lib/campaign/thumbnail/thumbnail-generator", () => ({
  createDefaultThumbnailContext: vi.fn(() => null),
}));
vi.mock("@/lib/campaign/brief", () => ({
  buildCampaignBriefFromFlat: vi.fn(() => ({})),
}));
vi.mock("@/lib/store-identity-service", () => ({
  buildCampaignBrief: vi.fn(async () => ({ campaignInput: {} })),
}));
vi.mock("@/lib/ai", () => ({
  createDefaultTelemetryContext: vi.fn(() => ({})),
}));
vi.mock("@/lib/image-generation/providers/factory", () => ({
  createImageProvider: vi.fn(() => ({ name: "test" })),
}));
vi.mock("@/lib/image-generation/services/image-generation-service", () => ({
  ImageGenerationService: class {
    async generateImage() {
      return {
        success: true,
        model: "test-model",
        imageDataUrl: "data:image/jpeg;base64,ZmFrZQ==",
      };
    }
  },
}));
vi.mock("@/lib/campaign/image-processor", () => ({
  transcodeToJpeg: vi.fn(async () => ({
    buffer: Buffer.from("jpeg"),
    mimeType: "image/jpeg",
  })),
}));
vi.mock("@/lib/campaign/persistence", () => ({
  dataUrlToCampaignImage: vi.fn(() => ({
    buffer: Buffer.from("generated"),
    mimeType: "image/jpeg",
  })),
  deleteCampaignImage: vi.fn(async () => undefined),
}));

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_ID = "44444444-4444-4444-8444-444444444444";
const SUBMISSION_ID = "55555555-5555-4555-8555-555555555555";
const VERSION_ID = "66666666-6666-4666-8666-666666666666";
const STORE_ID = "11111111-1111-4111-8111-111111111111";

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.order = vi.fn(self);
  builder.insert = vi.fn(async () => ({ error: null }));
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  return builder;
}

describe("correção v2 — isolamento da miniatura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    mockFrom.mockImplementation((table: string) => {
      if (table === "campaign_correction_reports") {
        return chain({
          data: {
            id: REPORT_ID,
            campaign_id: CAMPAIGN_ID,
            reported_version_id: VERSION_ID,
            status: "generation_started",
          },
          error: null,
        });
      }
      if (table === "campaign_art_versions") {
        return chain({
          data: {
            id: VERSION_ID,
            brief_snapshot: {
              product: { name: "Produto", description: "Desc" },
              commercial: {
                intent: "offer",
                originalPriceCents: 1000,
                discountedPriceCents: 900,
                badgeText: "",
                hook: "",
                cta: "",
                objective: "",
                campaignDetails: "",
                additionalDetails: "",
                targetChannel: "feed",
                format: "1:1",
              },
              creativeContext: {
                sensitiveConstraints: "",
                preserveImageContext: false,
              },
              media: {
                images: [
                  {
                    role: "product",
                    source: "upload",
                    mimeType: "image/jpeg",
                    storagePath: `${STORE_ID}/${CAMPAIGN_ID}/inputs/1.jpg`,
                  },
                ],
              },
            },
          },
          error: null,
        });
      }
      if (table === "campaigns") {
        return chain({
          data: {
            id: CAMPAIGN_ID,
            store_id: STORE_ID,
            identity_snapshot: { colors: [] },
            operation_run_id: "run-1",
          },
          error: null,
        });
      }
      if (table === "campaign_correction_submissions") {
        return chain({
          data: {
            id: SUBMISSION_ID,
            report_id: REPORT_ID,
            attempt_number: 2,
            analysis_state: "eligible",
            normalized_instruction: "Corrija o corte.",
            category: "truncated_element",
          },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    mockStorageFrom.mockReturnValue({
      download: vi.fn(async () => ({
        data: new Blob([Buffer.from("input-image")]),
        error: null,
      })),
      upload: vi.fn(async () => ({ data: { path: "v2" }, error: null })),
      remove: mockRemove,
    });

    mockRpc.mockImplementation(async (name: string) => {
      if (name === "complete_campaign_correction_v2") {
        return { data: { version_id: VERSION_ID }, error: null };
      }
      return { data: null, error: null };
    });

    // A miniatura "explode" apesar do contrato do wrapper.
    mockGenerateThumbnail.mockRejectedValue(new Error("thumbnail boom"));
  });

  it("não chama failCorrectionV2, não apaga a v2 e retorna sucesso", async () => {
    const { generateCorrectionV2 } = await import("@/lib/campaign/correction-reports");

    const result = await generateCorrectionV2({
      campaignId: CAMPAIGN_ID,
      reportId: REPORT_ID,
      submissionId: SUBMISSION_ID,
    });

    expect(result).toMatchObject({
      success: true,
      campaignId: CAMPAIGN_ID,
      storagePath: `${STORE_ID}/${CAMPAIGN_ID}/v2.jpg`,
    });

    const rpcNames = mockRpc.mock.calls.map((call) => call[0]);
    expect(rpcNames).toContain("complete_campaign_correction_v2");
    expect(rpcNames).not.toContain("fail_campaign_correction_v2");
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
