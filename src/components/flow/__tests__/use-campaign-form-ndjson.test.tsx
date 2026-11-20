// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCampaignForm } from "../use-campaign-form";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockRestoreFormState = vi.fn();
vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: vi.fn(),
    restoreFormState: mockRestoreFormState,
    clearFormState: vi.fn(),
  }),
  scopedDraftKey: (scope?: string | null) =>
    scope ? `campaign_draft:${scope}` : "campaign_draft",
  scopedImageDraftKey: (scope?: string | null) =>
    scope ? `campaign_draft_image:${scope}` : "campaign_draft_image",
}));

vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/credit/credit-cta", () => ({
  CreditCta: () => null,
}));

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function rawNdjson(body: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formats(square: string, vertical: string) {
  return {
    "1:1": { state: square, deliveryOperationId: "sq" },
    "9:16": { state: vertical, deliveryOperationId: OPERATION_ID },
  };
}

function statusProcessing(canContinue = true) {
  return json({
    operation: {
      origin: "two_format_two_stage",
      formats: formats("processing", "processing"),
      canContinue,
      operationTerminal: false,
      nextStep: "square_delivery",
    },
  });
}

function terminalResult(noNewline: boolean): string {
  return `${JSON.stringify({
    type: "result",
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
    operationTerminal: true,
    formats: formats("delivered", "delivered"),
  })}${noNewline ? "" : "\n"}`;
}

function seedOperation() {
  sessionStorage.setItem(
    "campaign_active_operation:store-1",
    JSON.stringify({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      flowKind: "two_format_two_stage",
    }),
  );
}

async function renderReloaded() {
  seedOperation();
  const { result } = renderHook(() =>
    useCampaignForm("store-1", { eligible: true }),
  );
  await waitFor(() => expect(result.current.processingResult).not.toBeNull());
  return result;
}

describe("F60.7 C2/C6 — continuação NDJSON", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    mockRestoreFormState.mockReturnValue(null);
  });

  it("aplica terminal sem newline final e não faz consulta extra", async () => {
    let statusCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generation-status") {
        statusCalls += 1;
        return statusProcessing();
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        return rawNdjson(terminalResult(true));
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await renderReloaded();
    await act(async () => {
      await result.current.continueGeneration();
    });

    expect(statusCalls).toBe(1);
    expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`);
  });

  it("processing → result na mesma resposta: só processing é aplicado", async () => {
    let statusCalls = 0;
    let continueCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generation-status") {
        statusCalls += 1;
        return statusProcessing();
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        continueCalls += 1;
        if (continueCalls === 1) {
          return rawNdjson(
            `${JSON.stringify({
              type: "processing",
              campaignId: CAMPAIGN_ID,
              operationId: OPERATION_ID,
              canContinue: true,
              nextStep: "vertical_delivery",
              formats: formats("delivered", "processing"),
            })}\n${terminalResult(false)}`,
          );
        }
        return rawNdjson(
          `${JSON.stringify({
            type: "processing",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            canContinue: false,
            nextStep: null,
            formats: formats("delivered", "processing"),
          })}\n`,
        );
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await renderReloaded();
    await act(async () => {
      await result.current.continueGeneration();
    });
    await waitFor(() => expect(continueCalls).toBe(2));

    expect(statusCalls).toBe(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.processingResult?.canContinue).toBe(false);
  });

  it("submissão normal não dispara status em paralelo à reidratação", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockRestoreFormState.mockReturnValue({
      productName: "Produto conjunto",
      description: "",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [
        {
          id: "img-1",
          role: "primary",
          source: "upload",
          mimeType: "image/jpeg",
          dataUrl: DATA_URL,
        },
      ],
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
      backgroundDirection: "studio",
      campaignFormat: "1:1+9:16",
    });

    let statusCalls = 0;
    let generateCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        generateCalls += 1;
        return new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  `${JSON.stringify({
                    type: "phase",
                    phase: "square_base",
                    status: "running",
                  })}\n`,
                ),
              );
              await gate;
              controller.enqueue(
                new TextEncoder().encode(terminalResult(false)),
              );
              controller.close();
            },
          }),
          { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
        );
      }
      if (url === "/api/campaign/generation-status") {
        statusCalls += 1;
        return json({ error: { code: "status_unavailable" } }, 503);
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCampaignForm("store-1", { eligible: true }),
    );
    await waitFor(() =>
      expect(result.current.fields.productName).toBe("Produto conjunto"),
    );

    let submitPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      submitPromise = Promise.resolve(result.current.handleSubmit());
      await Promise.resolve();
    });
    await waitFor(() => expect(generateCalls).toBe(1));
    expect(statusCalls).toBe(0);
    expect(result.current.processingResult).toBeNull();

    release();
    await act(async () => {
      await submitPromise;
    });
    expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`);
  });
});
