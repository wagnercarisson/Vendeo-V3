// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCampaignForm, buildValidityDisplayText, formatDateDisplay, formatDateInput, parseDateInput, isValidDateInput } from "../use-campaign-form";

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

describe("testes 1-7: buildValidityDisplayText e formatDateDisplay (helpers puros)", () => {
  const base = {
    validityStartDate: "",
    validityEndDate: "",
    validityCustomText: "",
  };

  it("1: modo vazio → undefined", () => {
    expect(buildValidityDisplayText({ ...base, validityMode: "" })).toBeUndefined();
  });

  it("2: until-date + endDate → 'até dd/mm/aaaa'", () => {
    expect(
      buildValidityDisplayText({ ...base, validityMode: "until-date", validityEndDate: "2026-09-30" })
    ).toBe("até 30/09/2026");
  });

  it("3: range + start + end → 'de dd/mm/aaaa até dd/mm/aaaa'", () => {
    expect(
      buildValidityDisplayText({
        ...base,
        validityMode: "range",
        validityStartDate: "2026-09-25",
        validityEndDate: "2026-09-30",
      })
    ).toBe("de 25/09/2026 até 30/09/2026");
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

  it("7: custom com prefixo 'Oferta válida' → normalizado; formatDateDisplay", () => {
    expect(
      buildValidityDisplayText({
        ...base,
        validityMode: "custom",
        validityCustomText: "Oferta válida: por tempo limitado",
      })
    ).toBe("por tempo limitado");
    expect(formatDateDisplay("2026-09-30")).toBe("30/09/2026");
    expect(formatDateDisplay("")).toBe("");
    // Entrada sem 3 partes após split "-" → entrada original (comportamento F40 preservado)
    expect(formatDateDisplay("30/09/2026")).toBe("30/09/2026");
  });
});

describe("helpers de data (formatDateInput/parseDateInput/isValidDateInput — determinísticos, sem timezone)", () => {
  it("round-trip ISO → máscara → ISO", () => {
    expect(formatDateInput("2026-09-30")).toBe("30/09/2026");
    expect(parseDateInput("30/09/2026")).toBe("2026-09-30");
    expect(formatDateInput(parseDateInput("30/09/2026"))).toBe("30/09/2026");
  });

  it("formatDateInput vazia/inválida → ''", () => {
    expect(formatDateInput("")).toBe("");
    expect(formatDateInput("2026-9-30")).toBe("");
    expect(formatDateInput("30/09/2026")).toBe("");
  });

  it("parseDateInput incompleta/inválida/ano curto → ''", () => {
    expect(parseDateInput("30/09")).toBe("");
    expect(parseDateInput("30/09/202")).toBe("");
    expect(parseDateInput("3/09/2026")).toBe("");
    expect(parseDateInput("30-09-2026")).toBe("");
    expect(parseDateInput("")).toBe("");
  });

  it("isValidDateInput exige máscara completa e data de calendário real", () => {
    expect(isValidDateInput("30/09/2026")).toBe(true);
    expect(isValidDateInput("01/01/2026")).toBe(true);
    // Datas de calendário inválidas
    expect(isValidDateInput("31/02/2026")).toBe(false);
    expect(isValidDateInput("29/02/2023")).toBe(false); // não bissexto
    expect(isValidDateInput("00/09/2026")).toBe(false);
    expect(isValidDateInput("30/13/2026")).toBe(false);
    // Máscara incompleta
    expect(isValidDateInput("30/09/20")).toBe(false);
    expect(isValidDateInput("30/09")).toBe(false);
    expect(isValidDateInput("")).toBe(false);
    // Ano bissexto permite 29/02
    expect(isValidDateInput("29/02/2024")).toBe(true);
  });
});

describe("teste 8: validade no body (endDate ISO nunca enviado)", () => {
  it("offer + until-date → body.validity='até 30/09/2026' sem validityEndDate/StartDate", async () => {
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
      productImages: [],
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
    expect(body.validity).toBe("até 30/09/2026");
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

describe("D2/D5: validação de datas no submit (frontend, antes do fetch)", () => {
  const OFFER_FIELDS = {
    productName: "Produto Teste",
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

  beforeEach(() => {
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
    mockRestoreFormState.mockReturnValue(OFFER_FIELDS);
  });

  it("D5: range com start > end (ambas preenchidas) bloqueia submit sem fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createNdjsonResponse([{ type: "result", campaignId: "abc", campaignUrl: "/campanhas/abc" }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    act(() => {
      result.current.setField("validityMode", "range");
      result.current.setField("validityStartDate", "2026-09-30");
      result.current.setField("validityEndDate", "2026-09-25");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fieldErrors.validityStartDate).toBe(
      "Data inicial não pode ser posterior à data final"
    );
    expect(result.current.fieldErrors.validityEndDate).toBeUndefined();
  });

  it("range com start === end (iguais permitidas) → submit segue e chama fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createNdjsonResponse([{ type: "result", campaignId: "abc", campaignUrl: "/campanhas/abc" }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    act(() => {
      result.current.setField("validityMode", "range");
      result.current.setField("validityStartDate", "2026-09-25");
      result.current.setField("validityEndDate", "2026-09-25");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(result.current.fieldErrors.validityStartDate).toBeUndefined();
    expect(result.current.fieldErrors.validityEndDate).toBeUndefined();
  });

  it("range com start preenchida e end vazia → erro genérico em validityEndDate (sem erro de ordem)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    act(() => {
      result.current.setField("validityMode", "range");
      result.current.setField("validityStartDate", "2026-09-25");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fieldErrors.validityEndDate).toBe(
      "Informe uma data válida (dd/mm/aaaa)"
    );
    expect(result.current.fieldErrors.validityStartDate).toBeUndefined();
  });

  it("until-date sem validityEndDate → bloqueia sem fetch com erro genérico", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    act(() => {
      result.current.setField("validityMode", "until-date");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fieldErrors.validityEndDate).toBe(
      "Informe uma data válida (dd/mm/aaaa)"
    );
  });

  it("today/stock/custom não exigem datas (submit segue)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createNdjsonResponse([{ type: "result", campaignId: "abc", campaignUrl: "/campanhas/abc" }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    act(() => {
      result.current.setField("validityMode", "today");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.validity).toBe("somente hoje");
  });
});
