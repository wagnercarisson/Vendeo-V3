// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCampaignForm, buildValidityDisplayText, formatDDMM } from "../use-campaign-form";

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

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function createNdjsonResponse(
  events: Record<string, unknown>[]
): Response {
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

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(null);
});

describe("testes 1-7: buildValidityDisplayText e formatDDMM (helpers puros)", () => {
  const base = {
    validityStartDate: "",
    validityEndDate: "",
    validityCustomText: "",
  };

  it("1: modo vazio → undefined", () => {
    expect(buildValidityDisplayText({ ...base, validityMode: "" })).toBeUndefined();
  });

  it("2: until-date + endDate → 'até dd/mm'", () => {
    expect(
      buildValidityDisplayText({ ...base, validityMode: "until-date", validityEndDate: "2026-09-30" })
    ).toBe("até 30/09");
  });

  it("3: range + start + end → 'de dd/mm até dd/mm'", () => {
    expect(
      buildValidityDisplayText({
        ...base,
        validityMode: "range",
        validityStartDate: "2026-09-25",
        validityEndDate: "2026-09-30",
      })
    ).toBe("de 25/09 até 30/09");
  });

  it("4: today → 'somente hoje'", () => {
    expect(buildValidityDisplayText({ ...base, validityMode: "today" })).toBe("somente hoje");
  });

  it("5: stock → 'enquanto durarem os estoques'", () => {
    expect(buildValidityDisplayText({ ...base, validityMode: "stock" })).toBe(
      "enquanto durarem os estoques"
    );
  });

  it("6: custom sem prefixo → inalterado", () => {
    expect(
      buildValidityDisplayText({ ...base, validityMode: "custom", validityCustomText: "Somente em novembro" })
    ).toBe("Somente em novembro");
  });

  it("7: custom com prefixo 'Oferta válida' → normalizado; formatDDMM", () => {
    expect(
      buildValidityDisplayText({
        ...base,
        validityMode: "custom",
        validityCustomText: "Oferta válida: por tempo limitado",
      })
    ).toBe("por tempo limitado");
    expect(formatDDMM("2026-09-30")).toBe("30/09");
    expect(formatDDMM("")).toBe("");
  });
});

describe("teste 8: validade no body (endDate ISO nunca enviado)", () => {
  it("offer + until-date → body.validity='até 30/09' sem validityEndDate/StartDate", async () => {
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
    const fetchMock = vi.fn().mockResolvedValue(
      createNdjsonResponse([
        { type: "result", campaignId: "abc", campaignUrl: "/campanhas/abc" },
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
      imageFile: null,
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    act(() => {
      result.current.setField("validityMode", "until-date");
      result.current.setField("validityEndDate", "2026-09-30");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.validity).toBe("até 30/09");
    expect(body.validityEndDate).toBeUndefined();
    expect(body.validityStartDate).toBeUndefined();
  });

  it("bonus D4: trocar intent preserva os campos de validade", async () => {
    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    act(() => {
      result.current.setField("validityMode", "until-date");
      result.current.setField("validityEndDate", "2026-09-30");
      result.current.setField("campaignIntent", "exclusive");
    });

    expect(result.current.fields.validityMode).toBe("until-date");
    expect(result.current.fields.validityEndDate).toBe("2026-09-30");
  });
});
