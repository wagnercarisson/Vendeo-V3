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

const DRAFT = {
  productName: "Produto conjunto",
  description: "",
  originalPriceCents: 10000,
  discountedPriceCents: 1990,
  badge: "Oferta",
  campaignIntent: "offer" as const,
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
  campaignFormat: "1:1+9:16" as const,
};

function formats(square: string, vertical: string) {
  return {
    "1:1": { state: square, deliveryOperationId: "sq" },
    "9:16": { state: vertical, deliveryOperationId: OPERATION_ID },
  };
}

function ndjson(events: Record<string, unknown>[]): Response {
  const body = events.map((event) => `${JSON.stringify(event)}\n`).join("");
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

async function startJoint(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() =>
    useCampaignForm("store-1", { eligible: true }),
  );
  await waitFor(() =>
    expect(result.current.fields.productName).toBe("Produto conjunto"),
  );
  await act(async () => {
    expect(await result.current.enterReview()).toBe(true);
  });
  await waitFor(() => expect(result.current.preparedImages?.length).toBe(1));
  await act(async () => {
    await result.current.confirmReview();
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(DRAFT);
});

describe("F60.7 C2/C6 — transição para a campanha pronta", () => {
  it("conclusão do stream inicial inicia transição delivered e navega uma vez", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "result",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
            operationTerminal: true,
            formats: formats("delivered", "delivered"),
          },
        ]);
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await startJoint(fetchMock);
    await waitFor(() =>
      expect(result.current.campaignTransition?.outcome).toBe("delivered"),
    );

    expect(result.current.processingResult).toBeNull();
    expect(result.current.campaignTransition).toMatchObject({
      campaignId: CAMPAIGN_ID,
      campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
      outcome: "delivered",
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`);
  });

  it("conclusão da continuação inicia a mesma transição", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "processing",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            canContinue: true,
            nextStep: "vertical_delivery",
            formats: formats("processing", "processing"),
          },
        ]);
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        return ndjson([
          {
            type: "result",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
            operationTerminal: true,
            formats: formats("delivered", "delivered"),
          },
        ]);
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await startJoint(fetchMock);
    await waitFor(() =>
      expect(result.current.campaignTransition?.outcome).toBe("delivered"),
    );
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("conclusão reconhecida por generation-status inicia transição", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-1",
      JSON.stringify({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        flowKind: "two_format_two_stage",
      }),
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generation-status") {
        return json({
          operation: {
            origin: "two_format_two_stage",
            formats: formats("delivered", "delivered"),
            canContinue: false,
            operationTerminal: true,
            nextStep: null,
          },
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCampaignForm("store-1", { eligible: true }),
    );
    await waitFor(() =>
      expect(result.current.campaignTransition?.outcome).toBe("delivered"),
    );
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("parcial terminal preserva a classificação", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "result",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
            operationTerminal: true,
            formats: formats("delivered", "absent"),
          },
        ]);
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await startJoint(fetchMock);
    await waitFor(() =>
      expect(result.current.campaignTransition?.outcome).toBe("partial_terminal"),
    );
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("estorno que navega preserva a classificação refunded", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "error",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            refunded: true,
            formats: formats("absent", "absent"),
          },
        ]);
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await startJoint(fetchMock);
    await waitFor(() =>
      expect(result.current.campaignTransition?.outcome).toBe("refunded"),
    );
    expect(result.current.submitError).toBeNull();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("unknown não inicia transição", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "unknown",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            reference: "IMG-001",
          },
        ]);
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await startJoint(fetchMock);
    await waitFor(() => expect(result.current.unknownResult).not.toBeNull());
    expect(result.current.campaignTransition).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("indisponibilidade não inicia transição", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "phase",
            phase: "square_base",
            status: "running",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
          },
        ]);
      }
      if (url === "/api/campaign/generation-status") {
        return json({ error: { code: "status_unavailable" } }, 503);
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await startJoint(fetchMock);
    await waitFor(() =>
      expect(result.current.processingResult?.partial).toBe("unavailable"),
    );
    expect(result.current.campaignTransition).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("respostas tardias/duplicadas não iniciam nova navegação", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "result",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
            operationTerminal: true,
            formats: formats("delivered", "delivered"),
          },
          {
            type: "error",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            refunded: true,
            formats: formats("absent", "absent"),
          },
        ]);
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await startJoint(fetchMock);
    await waitFor(() =>
      expect(result.current.campaignTransition?.outcome).toBe("delivered"),
    );
    await act(async () => {});
    expect(result.current.campaignTransition?.outcome).toBe("delivered");
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("conclusão individual pelo status também entra em transição", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-1",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/campaign/generation-status") {
        return json({ operation: { state: "delivered" } });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCampaignForm("store-1", { eligible: true }),
    );
    await waitFor(() =>
      expect(result.current.campaignTransition?.outcome).toBe("delivered"),
    );
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
