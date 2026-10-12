// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCampaignForm } from "../use-campaign-form";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
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

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const DRAFT = {
  productName: "Test Product",
  description: "",
  originalPriceCents: 10000,
  discountedPriceCents: 1990,
  badge: "Oferta",
  campaignIntent: "offer",
  preserveImageContext: false,
  productImages: [],
  mandatoryArtworkText: "",
  showIllustrativeNotice: true,
  mandatoryArtworkTextFree: "",
  validityMode: "",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
};

/**
 * F56.2b1b (Plano 06 — correção): stream que ENTREGA os eventos e, em seguida,
 * REJEITA a leitura (`reader.read()` rejeitado). Usado para provar que uma
 * interrupção do NOVO fluxo vira resultado desconhecido (Superfície 3).
 */
function createErroringStreamResponse(
  events: Record<string, unknown>[],
  error: unknown,
): Response {
  let index = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(events[index++]) + "\n"));
      } else {
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

async function submitEligibleWith(response: Response) {
  sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
  mockRestoreFormState.mockReturnValue(DRAFT);
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useCampaignForm("store-123", { eligible: true }));
  await act(async () => {});
  expect(result.current.isValid).toBe(true);
  await act(async () => {
    await result.current.handleSubmit();
  });
  await waitFor(() => {
    expect(result.current.isSubmitting).toBe(false);
  });
  return { result, fetchMock };
}

beforeEach(() => {
  vi.clearAllMocks();
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  mockRestoreFormState.mockReturnValue(null);
});

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 06 (correção): interrupção da LEITURA do stream do NOVO fluxo
// ⇒ resultado DESCONHECIDO (Superfície 3), SEM retry e SEM afirmar cancelamento;
// o legado preserva o comportamento anterior (erro de envio + "Tentar novamente").
// ---------------------------------------------------------------------------

describe("useCampaignForm — interrupção do stream no NOVO fluxo (correção)", () => {
  it("interrupção ANTES do 1º evento ⇒ `unknown` (Surface 3), sem retry e IDs do CORPO enviado", async () => {
    const { result, fetchMock } = await submitEligibleWith(
      createErroringStreamResponse([], new Error("network interrupted")),
    );

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.unknownResult).not.toBeNull();
    // Sem retry: nenhum erro de envio oferecido (Surface 3 é a única superfície).
    expect(result.current.submitError).toBeNull();

    // Fallback para a identidade do corpo (nenhum evento chegou).
    const sentBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(result.current.unknownResult?.campaignId).toBe(sentBody.campaignId);
    expect(result.current.unknownResult?.operationId).toBe(sentBody.operationId);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("interrupção APÓS o 1º evento ⇒ `unknown` com a identidade observada no evento", async () => {
    const { result } = await submitEligibleWith(
      createErroringStreamResponse(
        [
          {
            type: "phase",
            phase: "orchestration",
            status: "running",
            operationId: OPERATION_ID,
            campaignId: CAMPAIGN_ID,
          },
        ],
        new DOMException("aborted", "AbortError"),
      ),
    );

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.unknownResult).not.toBeNull();
    expect(result.current.unknownResult?.operationId).toBe(OPERATION_ID);
    expect(result.current.unknownResult?.campaignId).toBe(CAMPAIGN_ID);
    expect(result.current.submitError).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("legado: interrupção MANTÉM o comportamento anterior (erro de envio + retry), sem `unknown`", async () => {
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
    mockRestoreFormState.mockReturnValue(DRAFT);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createErroringStreamResponse([], new Error("boom"))),
    );

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});
    expect(result.current.isValid).toBe(true);
    await act(async () => {
      await result.current.handleSubmit();
    });
    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });

    expect(result.current.unknownResult).toBeNull();
    expect(result.current.submitError).toContain("Erro ao processar a resposta de geração.");
  });
});
