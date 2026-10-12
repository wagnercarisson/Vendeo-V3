// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCampaignForm } from "../use-campaign-form";
import { ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE_MESSAGE } from "@/lib/product-1-1/selection-validation";

/**
 * F2 (REQ-56.2.2-01): a regra `Original exige exatamente uma imagem de produto`
 * é GATED por elegibilidade no hook REAL. Em `off` o fluxo legado permanece
 * intocado; a regra nunca é avaliada. Sob elegibilidade, a regra ainda é
 * avaliada mesmo quando a imagem vem de um `dataUrl` restaurado (o caminho que
 * antes era integralmente pulado pelos loops de submit/revisão).
 */

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

const MESSAGE = ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE_MESSAGE;

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function createNdjsonResponse(events: Record<string, unknown>[]): Response {
  const body = events.map((e) => JSON.stringify(e) + "\n").join("");
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } }
  );
}

function restoredImage(id: string, role: "primary" | "reference") {
  return { id, role, source: "upload" as const, mimeType: "image/jpeg", dataUrl: VALID_DATA_URL };
}

/** Preenche os campos comerciais válidos (offer). */
function fillValidOffer(result: { current: ReturnType<typeof useCampaignForm> }) {
  result.current.setField("productName", "Produto Teste");
  result.current.setField("discountedPriceCents", 1990);
  result.current.setField("badge", "Oferta");
  result.current.setField("backgroundDirection", "original");
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(null);
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("F2 — regra Original gated por elegibilidade (hook real)", () => {
  it("elegível + original + 0 imagens ⇒ submit E revisão bloqueados com a copy exata", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-1", { eligible: true }));
    await act(async () => {
      fillValidOffer(result);
    });

    // submit bloqueado
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.fieldErrors.productImages).toBe(MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();

    // revisão bloqueada
    let entered = true;
    await act(async () => {
      entered = await result.current.enterReview();
    });
    expect(entered).toBe(false);
    expect(result.current.fieldErrors.productImages).toBe(MESSAGE);
  });

  it("elegível + original + exatamente 1 imagem ⇒ permitido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createNdjsonResponse([
          { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-1", { eligible: true }));
    await act(async () => {
      fillValidOffer(result);
      result.current.setField("productImages", [restoredImage("p1", "primary")]);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.fieldErrors.productImages).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.backgroundDirection).toBe("original");
    // elegível ⇒ identidade transportada
    expect(body.campaignId).toBeDefined();
    expect(body.operationId).toBeDefined();
  });

  it("elegível + original + 2 imagens restauradas (dataUrl) ⇒ submit bloqueado (caminho antes pulado)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-1", { eligible: true }));
    await act(async () => {
      fillValidOffer(result);
      result.current.setField("productImages", [
        restoredImage("p1", "primary"),
        restoredImage("p2", "reference"),
      ]);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.fieldErrors.productImages).toBe(MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("elegível + original + 2 imagens restauradas e form inválido ⇒ revisão bloqueada pela regra Original", async () => {
    // rascunho restaurado (imagens dataUrl, sem File). Falta o nome para forçar
    // que o loop de validação da revisão rode (ele só roda quando !isValid).
    mockRestoreFormState.mockReturnValue({
      productName: "",
      description: "",
      originalPriceCents: 0,
      discountedPriceCents: undefined,
      badge: "",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [restoredImage("a", "primary"), restoredImage("b", "reference")],
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
      backgroundDirection: "original",
    });

    const { result } = renderHook(() => useCampaignForm("store-1", { eligible: true }));
    await act(async () => {});
    expect(result.current.fields.backgroundDirection).toBe("original");

    let entered = true;
    await act(async () => {
      entered = await result.current.enterReview();
    });
    expect(entered).toBe(false);
    expect(result.current.fieldErrors.productImages).toBe(MESSAGE);
  });

  it("off + original restaurado (2 imagens dataUrl) ⇒ NÃO bloqueado (legado intocado)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createNdjsonResponse([
          { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    mockRestoreFormState.mockReturnValue({
      productName: "Produto Teste",
      description: "",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [restoredImage("a", "primary"), restoredImage("b", "reference")],
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
      backgroundDirection: "original",
    });

    const { result } = renderHook(() => useCampaignForm("store-1")); // off
    await act(async () => {});

    await act(async () => {
      await result.current.handleSubmit();
    });

    // a regra Original NÃO dispara em off; a imagem restaurada não é re-validada.
    expect(result.current.fieldErrors.productImages).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // byte-compatível: nenhuma chave exclusiva em off.
    expect(body).not.toHaveProperty("backgroundDirection");
    expect(body).not.toHaveProperty("campaignId");
    expect(body).not.toHaveProperty("operationId");
  });
});
