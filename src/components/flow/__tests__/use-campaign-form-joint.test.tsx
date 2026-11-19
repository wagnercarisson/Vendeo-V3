// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCampaignGenerationBody,
  buildEligibleDraftFingerprint,
  normalizeTwoFormatOutcome,
  useCampaignForm,
} from "../use-campaign-form";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSaveFormState = vi.fn();
const mockRestoreFormState = vi.fn();
const mockClearFormState = vi.fn();
vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: mockSaveFormState,
    restoreFormState: mockRestoreFormState,
    clearFormState: mockClearFormState,
  }),
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

const DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";

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

function jsonResponse(body: unknown, status = 200): Response {
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

async function fillJointForm(result: {
  current: ReturnType<typeof useCampaignForm>;
}) {
  await act(async () => {
    result.current.setField("productName", "Produto conjunto");
    result.current.setField("originalPriceCents", 10000);
    result.current.setField("discountedPriceCents", 1990);
    result.current.setField("badge", "Oferta");
    result.current.setField("campaignFormat", "1:1+9:16");
    result.current.setField("productImages", [
      {
        id: "img-1",
        role: "primary",
        source: "upload",
        mimeType: "image/png",
        dataUrl: DATA_URL,
      },
    ]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(null);
});

describe("F60.7 C2 — body/fingerprint conjuntos", () => {
  it("joint entra no body/fingerprint somente sob elegibilidade", async () => {
    const { result } = renderHook(() =>
      useCampaignForm("store-1", { eligible: true }),
    );
    await fillJointForm(result);
    const prepared = result.current.fields.productImages.map((image) => ({
      id: image.id,
      role: image.role,
      source: image.source,
      mimeType: "image/jpeg" as const,
      dataUrl: image.dataUrl!,
    }));
    const body = buildCampaignGenerationBody(
      result.current.fields,
      prepared,
      "store-1",
      {
        eligible: true,
        identity: { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      },
    );
    expect(body.campaignFormat).toBe("1:1+9:16");
    expect(body.campaignId).toBe(CAMPAIGN_ID);

    const legacy = buildCampaignGenerationBody(
      result.current.fields,
      prepared,
      "store-1",
    );
    expect("campaignFormat" in legacy).toBe(false);
    expect(
      buildEligibleDraftFingerprint(result.current.fields, prepared, "store-1"),
    ).toContain("1:1+9:16");
  });
});

describe("F60.7 C2 — jornada formulário → review → stream", () => {
  it("review conjunto envia body joint e resultado parcial terminal preserva o entregue", async () => {
    const { result } = renderHook(() =>
      useCampaignForm("store-1", { eligible: true }),
    );
    await fillJointForm(result);
    await act(async () => {
      await result.current.enterReview();
    });
    expect(result.current.reviewMode).toBe(true);
    expect(result.current.fields.campaignFormat).toBe("1:1+9:16");

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          { type: "phase", phase: "square_base", status: "running" },
          {
            type: "result",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
            operationTerminal: true,
            partial: true,
            formats: formats("delivered", "absent"),
          },
        ]);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      await result.current.confirmReview();
    });

    const initialBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(initialBody.campaignFormat).toBe("1:1+9:16");
    expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("processing auto-continua com requestId joint; parcial indeterminado não navega", async () => {
    const { result } = renderHook(() =>
      useCampaignForm("store-1", { eligible: true }),
    );
    await fillJointForm(result);
    await act(async () => {
      await result.current.enterReview();
    });

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "processing",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            canContinue: true,
            nextStep: "square_delivery",
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
            operationTerminal: false,
            partial: true,
            formats: formats("delivered", "unknown"),
          },
        ]);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      await result.current.confirmReview();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const continueBody = JSON.parse(init.body as string) as Record<
      string,
      unknown
    >;
    expect(continueBody.operationId).toBe(OPERATION_ID);
    expect(typeof continueBody.requestId).toBe("string");
    expect(continueBody).not.toHaveProperty("requestIds");
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.processingResult?.partial).toBe("indeterminate");
  });
});

describe("F60.7 C2 — resultados parciais", () => {
  it("entregue + estornado é parcial terminal; entregue + unknown é não terminal", () => {
    expect(
      normalizeTwoFormatOutcome({
        formats: {
          "1:1": { state: "delivered" },
          "9:16": { state: "absent" },
        },
        operationTerminal: true,
      }).kind,
    ).toBe("partial_terminal");
    expect(
      normalizeTwoFormatOutcome({
        formats: {
          "1:1": { state: "delivered" },
          "9:16": { state: "unknown" },
        },
      }).kind,
    ).toBe("partial_indeterminate");
    expect(
      normalizeTwoFormatOutcome({
        formats: {
          "1:1": { state: "absent" },
          "9:16": { state: "processing" },
        },
        canContinue: true,
      }).kind,
    ).toBe("finalization_pending");
  });
});

describe("F60.7 C2 — reload e autoridade de origin", () => {
  it("reload sem restoredForm resolve joint por operation.origin e continua com requestId", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-1",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/campaign/generation-status") {
        return jsonResponse({
          operation: {
            origin: "two_format_two_stage",
            formats: formats("processing", "processing"),
            canContinue: true,
            operationTerminal: false,
            nextStep: "square_delivery",
          },
        });
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
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCampaignForm("store-1", { eligible: true }),
    );
    await waitFor(() => expect(result.current.processingResult).not.toBeNull());
    expect(result.current.flowKind).toBe("two_format_two_stage");

    await act(async () => {
      await result.current.continueGeneration();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const continueBody = JSON.parse(init.body as string) as Record<
      string,
      unknown
    >;
    expect(continueBody).toHaveProperty("requestId");
    expect(continueBody).not.toHaveProperty("requestIds");
  });

  it("draft antigo sem flowKind usa origin 9:16; status indisponível não continua", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-2",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/campaign/generation-status") {
        return jsonResponse({
          operation: {
            origin: "9_16_two_stage",
            state: "processing",
            canContinue: true,
          },
        });
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        return ndjson([
          {
            type: "result",
            campaignId: CAMPAIGN_ID,
            campaignUrl: `/campanhas/${CAMPAIGN_ID}`,
          },
        ]);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCampaignForm("store-2", { eligible: true }),
    );
    await waitFor(() => expect(result.current.processingResult).not.toBeNull());
    expect(result.current.flowKind).toBe("two_stage_9_16");
    await act(async () => {
      await result.current.continueGeneration();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty("requestIds");
    expect(body).not.toHaveProperty("requestId");
  });

  it("status conjunto entregue + estornado encerra parcialmente e preserva o entregue", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-4",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          operation: {
            origin: "two_format_two_stage",
            formats: formats("delivered", "absent"),
            canContinue: false,
            operationTerminal: true,
            nextStep: null,
          },
        }),
      ),
    );
    const { result } = renderHook(() =>
      useCampaignForm("store-4", { eligible: true }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`));
    expect(result.current.processingResult).toBeNull();
  });

  it("status conjunto estornado + reservado anuncia finalização pendente (não sucesso)", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-5",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          operation: {
            origin: "two_format_two_stage",
            formats: formats("absent", "processing"),
            canContinue: true,
            operationTerminal: false,
            nextStep: "delivery",
          },
        }),
      ),
    );
    const { result } = renderHook(() =>
      useCampaignForm("store-5", { eligible: true }),
    );
    await waitFor(() =>
      expect(result.current.processingResult?.partial).toBe(
        "finalization_pending",
      ),
    );
    expect(result.current.processingResult?.canContinue).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("status conjunto entregue + unknown permanece parcial indeterminado", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-6",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          operation: {
            origin: "two_format_two_stage",
            formats: formats("delivered", "unknown"),
            canContinue: false,
            operationTerminal: false,
            nextStep: null,
          },
        }),
      ),
    );
    const { result } = renderHook(() =>
      useCampaignForm("store-6", { eligible: true }),
    );
    await waitFor(() =>
      expect(result.current.processingResult?.partial).toBe("indeterminate"),
    );
    expect(result.current.processingResult?.canContinue).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("nova etapa autorizada após terminal processing usa novo requestId", async () => {
    const { result } = renderHook(() =>
      useCampaignForm("store-1", { eligible: true }),
    );
    await fillJointForm(result);
    await act(async () => {
      await result.current.enterReview();
    });
    let continueCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/campaign/generate-image") {
        return ndjson([
          {
            type: "processing",
            campaignId: CAMPAIGN_ID,
            operationId: OPERATION_ID,
            canContinue: true,
            nextStep: "square_delivery",
            formats: formats("processing", "processing"),
          },
        ]);
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        continueCalls += 1;
        if (continueCalls === 1) {
          return ndjson([
            {
              type: "processing",
              campaignId: CAMPAIGN_ID,
              operationId: OPERATION_ID,
              canContinue: true,
              nextStep: "expansion",
              formats: formats("delivered", "processing"),
            },
          ]);
        }
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
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      await result.current.confirmReview();
    });
    await waitFor(() => expect(continueCalls).toBe(2));
    const bodies = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/continue"))
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies).toHaveLength(2);
    expect(bodies[0].requestId).not.toBe(bodies[1].requestId);
  });

  it("retry ambíguo da mesma continuação reutiliza o requestId", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-7",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    let continueCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/campaign/generation-status") {
        return jsonResponse({
          operation: {
            origin: "two_format_two_stage",
            formats: formats("processing", "processing"),
            canContinue: true,
            operationTerminal: false,
            nextStep: "square_delivery",
          },
        });
      }
      if (url === `/api/campaign/${CAMPAIGN_ID}/continue`) {
        continueCalls += 1;
        if (continueCalls === 1) {
          return jsonResponse({ error: { code: "ambiguous" } }, 503);
        }
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
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCampaignForm("store-7", { eligible: true }),
    );
    await waitFor(() => expect(result.current.processingResult).not.toBeNull());
    await act(async () => {
      await result.current.continueGeneration();
    });
    await waitFor(() => expect(continueCalls).toBe(1));
    await waitFor(() => expect(result.current.processingResult).not.toBeNull());

    await act(async () => {
      await result.current.continueGeneration();
    });
    await waitFor(() => expect(continueCalls).toBe(2));
    const bodies = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/continue"))
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies).toHaveLength(2);
    expect(bodies[0].requestId).toBe(bodies[1].requestId);
  });

  it("status conjunto ambos estornados encaminha estorno, nunca sucesso", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-8",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          operation: {
            origin: "two_format_two_stage",
            formats: formats("absent", "absent"),
            canContinue: false,
            operationTerminal: true,
            nextStep: null,
          },
        }),
      ),
    );
    const { result } = renderHook(() =>
      useCampaignForm("store-8", { eligible: true }),
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/campanhas/${CAMPAIGN_ID}`),
    );
    expect(result.current.processingResult).toBeNull();
    expect(result.current.unknownResult).toBeNull();
  });

  it("status indisponível no reload não monta continuação nem adivinha fluxo", async () => {
    sessionStorage.setItem(
      "campaign_active_operation:store-3",
      JSON.stringify({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: "status_unavailable" } }, 503),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCampaignForm("store-3", { eligible: true }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.processingResult).toBeNull();
    await act(async () => {
      await result.current.continueGeneration();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.flowKind).not.toBe("two_format_two_stage");
  });
});
