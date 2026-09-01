// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { useCampaignForm, buildMandatoryArtworkText } from "../use-campaign-form";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";

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

describe("testes 9-12: combinações checkbox × texto livre no body", () => {
  async function submitWith(showNotice: boolean, freeText: string) {
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
      result.current.setField("showIllustrativeNotice", showNotice);
      result.current.setField("mandatoryArtworkTextFree", freeText);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    return body;
  }

  it("9: marcado sem texto → body.mandatoryArtworkText = constante", async () => {
    const body = await submitWith(true, "");
    expect(body.mandatoryArtworkText).toBe(ILLUSTRATIVE_NOTICE_TEXT);
  });

  it("10: marcado + texto → constante\\ntexto", async () => {
    const body = await submitWith(true, "Texto promocional");
    expect(body.mandatoryArtworkText).toBe(`${ILLUSTRATIVE_NOTICE_TEXT}\nTexto promocional`);
  });

  it("11: desmarcado + texto → só o texto", async () => {
    const body = await submitWith(false, "Texto livre");
    expect(body.mandatoryArtworkText).toBe("Texto livre");
  });

  it("12: desmarcado sem texto → campo ausente", async () => {
    const body = await submitWith(false, "");
    expect(body.mandatoryArtworkText).toBeUndefined();
  });
});

describe("teste 13: defaults do form state", () => {
  it("showIllustrativeNotice default true e free default ''", async () => {
    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});
    expect(result.current.fields.showIllustrativeNotice).toBe(true);
    expect(result.current.fields.mandatoryArtworkTextFree).toBe("");
  });
});

describe("teste 14: constante única sem divergência nos componentes", () => {
  it("ILLUSTRATIVE_NOTICE_TEXT é o literal canônico singular", () => {
    expect(ILLUSTRATIVE_NOTICE_TEXT).toBe("Imagem meramente ilustrativa");
  });

  it("nenhum componente contém plural ou placeholder hardcoded", () => {
    const files = [
      path.join(process.cwd(), "src", "components", "campaign", "illustrative-notice-field.tsx"),
      path.join(process.cwd(), "src", "components", "campaign", "mandatory-artwork-field.tsx"),
    ];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      expect(content).not.toContain("Imagens meramente ilustrativas");
      expect(content).not.toContain("placeholder=\"Ex: Imagens");
    }
  });

  it("buildMandatoryArtworkText produz as 4 combinações exatas", () => {
    expect(buildMandatoryArtworkText(true, "X")).toBe(`${ILLUSTRATIVE_NOTICE_TEXT}\nX`);
    expect(buildMandatoryArtworkText(true, "")).toBe(ILLUSTRATIVE_NOTICE_TEXT);
    expect(buildMandatoryArtworkText(false, "X")).toBe("X");
    expect(buildMandatoryArtworkText(false, "")).toBeUndefined();
  });
});

describe("teste 15: migração legada + restore de shape novo", () => {
  it("draft legado (shape antigo) migra para free + espelho", async () => {
    mockRestoreFormState.mockReturnValue({
      productName: "X",
      originalPriceCents: 0,
      discountedPriceCents: undefined,
      badge: "",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [],
      mandatoryArtworkText: "Texto legado",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    expect(result.current.fields.mandatoryArtworkTextFree).toBe("Texto legado");
    expect(result.current.fields.mandatoryArtworkText).toBe("Texto legado");
    expect(result.current.fields.showIllustrativeNotice).toBe(true);
  });

  it("draft shape novo (free + mirror salvos) restaura free + espelho juntos", async () => {
    mockRestoreFormState.mockReturnValue({
      productName: "X",
      originalPriceCents: 0,
      discountedPriceCents: undefined,
      badge: "",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [],
      showIllustrativeNotice: false,
      mandatoryArtworkTextFree: "Texto novo",
      mandatoryArtworkText: "Texto novo",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    expect(result.current.fields.mandatoryArtworkTextFree).toBe("Texto novo");
    expect(result.current.fields.mandatoryArtworkText).toBe("Texto novo");
  });
});
