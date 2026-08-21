// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { useCampaignForm, buildCampaignGenerationBody, buildValidityDisplayText, buildMandatoryArtworkText } from "../use-campaign-form";
import type { CampaignFormFields, PreparedCampaignImage } from "../use-campaign-form";
import { CampaignBriefReview } from "../campaign-brief-review";

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

const mockUseOperationCosts = vi.fn(
  (): {
    costs: { campaign_generation: { costCredits: number; enabled: boolean } } | null;
    status: "loading" | "unavailable" | "loaded";
    refetch: () => void;
  } => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  })
);
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => mockUseOperationCosts(),
}));

vi.mock("@/components/credit/credit-cta", () => ({
  CreditCta: () => null,
}));

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

function heicFile(): File {
  return new File([""], "foto.heic", { type: "image/heic" });
}

// Stubs para compressImage (mesmo padrão de use-campaign-form-product-images.test.ts)
function stubImageApis() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 100, height: 100 })
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
    cb(new Blob(["jpegdata"], { type: "image/jpeg" }));
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
}

function stubImageApisFail() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockRejectedValue(new Error("decode failed"))
  );
}

async function fillValidOfferFormWithDataUrl(result: { current: ReturnType<typeof useCampaignForm> }) {
  await act(async () => {
    result.current.setField("productName", "Produto Teste");
    result.current.setField("originalPriceCents", 10000);
    result.current.setField("discountedPriceCents", 1990);
    result.current.setField("badge", "Oferta");
    result.current.setField("productImages", [
      { id: "img-1", role: "primary", source: "upload", mimeType: "image/png", dataUrl: VALID_DATA_URL },
    ]);
  });
}

async function fillValidOfferFormWithFile(result: { current: ReturnType<typeof useCampaignForm> }, file: File) {
  await act(async () => {
    result.current.setField("productName", "Produto Teste");
    result.current.setField("originalPriceCents", 10000);
    result.current.setField("discountedPriceCents", 1990);
    result.current.setField("badge", "Oferta");
    result.current.addImage(file, "upload");
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(null);
  vi.unstubAllGlobals();
  mockUseOperationCosts.mockReturnValue({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCampaignForm review (F43) — Testes 1-10", () => {
  it("Teste 1 (D2): 'Revisar e gerar' com form inválido → não entra em revisão (erros exibidos)", async () => {
    const { result } = renderHook(() => useCampaignForm("store-1"));

    await act(async () => {
      result.current.setField("productName", "");
    });

    let entered = true;
    await act(async () => {
      entered = await result.current.enterReview();
    });

    expect(entered).toBe(false);
    expect(result.current.reviewMode).toBe(false);
    expect(Object.keys(result.current.fieldErrors).length).toBeGreaterThan(0);
  });

  it("Teste 2 (D2): form válido → entra em revisão; 'Voltar e editar' preserva fields/touched", async () => {
    const { result } = renderHook(() => useCampaignForm("store-1"));
    await fillValidOfferFormWithDataUrl(result);

    // marca um campo como touched
    await act(async () => {
      result.current.handleBlur("productName");
    });

    let entered = false;
    await act(async () => {
      entered = await result.current.enterReview();
    });
    expect(entered).toBe(true);
    expect(result.current.reviewMode).toBe(true);
    expect(result.current.preparedImages).not.toBeNull();

    // Voltar e editar — preserva fields/touched/fieldErrors
    await act(async () => {
      result.current.exitReview();
    });
    expect(result.current.reviewMode).toBe(false);
    expect(result.current.fields.productName).toBe("Produto Teste");
    expect(result.current.touched.productName).toBe(true);
    expect(result.current.fields.productImages).toHaveLength(1);
  });

  it("Teste 3 (D3): entrada em revisão dispara prepareCampaignImages (compressão; preparedImages preenchido)", async () => {
    stubImageApis();
    const { result } = renderHook(() => useCampaignForm("store-1"));
    await fillValidOfferFormWithFile(result, heicFile());

    expect(result.current.preparedImages).toBeNull();

    await act(async () => {
      await result.current.enterReview();
    });

    expect(result.current.reviewMode).toBe(true);
    expect(result.current.preparedImages).toHaveLength(1);
    expect(result.current.preparedImages![0].role).toBe("primary");
    expect(result.current.preparedImages![0].mimeType).toBe("image/jpeg");
    expect(result.current.preparedImages![0].dataUrl).toContain("data:image/jpeg;base64,");
  });

  it("Teste 4 (D3): payload final — HEIC/EXIF comprimido (mimeType image/jpeg, dataUrl)", async () => {
    stubImageApis();
    const { result } = renderHook(() => useCampaignForm("store-1"));

    await act(async () => {
      result.current.setField("productName", "Produto Teste");
      result.current.setField("originalPriceCents", 10000);
      result.current.setField("discountedPriceCents", 1990);
      result.current.setField("badge", "Oferta");
      result.current.addImage(heicFile(), "camera");
    });

    await act(async () => {
      await result.current.enterReview();
    });

    expect(result.current.reviewMode).toBe(true);
    expect(result.current.preparedImages).toHaveLength(1);
    expect(result.current.preparedImages![0].mimeType).toBe("image/jpeg");
    expect(result.current.preparedImages![0].source).toBe("camera");
    expect(result.current.preparedImages![0].dataUrl).toContain("data:image/jpeg;base64,");
  });

  it("Teste 5 (D3): falha de compressão → volta ao form com erro claro", async () => {
    stubImageApisFail();
    const { result } = renderHook(() => useCampaignForm("store-1"));

    await act(async () => {
      result.current.setField("productName", "Produto Teste");
      result.current.setField("originalPriceCents", 10000);
      result.current.setField("discountedPriceCents", 1990);
      result.current.setField("badge", "Oferta");
      result.current.addImage(heicFile(), "camera");
    });

    let entered = true;
    await act(async () => {
      entered = await result.current.enterReview();
    });

    expect(entered).toBe(false);
    expect(result.current.reviewMode).toBe(false);
    expect(result.current.reviewError).toContain("Não foi possível processar a imagem HEIC");
  });

  it("Teste 6 (D2): 'Confirmar e gerar campanha' trava o snapshot (body imutável)", async () => {
    const { result } = renderHook(() => useCampaignForm("store-1"));
    await fillValidOfferFormWithDataUrl(result);

    await act(async () => {
      await result.current.enterReview();
    });

    // captura o body do POST
    let capturedBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return createNdjsonResponse([
        { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      await result.current.confirmReview();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedBody).not.toBeNull();
    // snapshot travado — body congelado do que a revisão mostrou
    expect(capturedBody!.productName).toBe("Produto Teste");
    expect(capturedBody!.discountedPriceCents).toBe(1990);
  });

  it("Teste 7 (D4): body via buildCampaignGenerationBody — valores derivados idênticos ao exibido", async () => {
    const fields: CampaignFormFields = {
      productName: "Produto Teste",
      description: "Descrição teste",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [
        { id: "a", role: "primary", source: "upload", mimeType: "image/png", dataUrl: VALID_DATA_URL },
        { id: "b", role: "reference", source: "camera", mimeType: "image/png", dataUrl: VALID_DATA_URL },
      ],
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "Texto obrigatório",
      validityMode: "until-date",
      validityStartDate: "",
      validityEndDate: "2026-09-30",
      validityCustomText: "",
    };
    const prepared: PreparedCampaignImage[] = [
      { id: "a", role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
      { id: "b", role: "reference", source: "camera", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
    ];

    const body = buildCampaignGenerationBody(fields, prepared, "store-1");

    const validity = buildValidityDisplayText(fields);
    const mandatory = buildMandatoryArtworkText(fields.showIllustrativeNotice, fields.mandatoryArtworkTextFree);

    expect(body.productName).toBe("Produto Teste");
    expect(body.campaignIntent).toBe("offer");
    expect(body.badgeText).toBe("Oferta");
    expect(body.originalPriceCents).toBe(10000);
    expect(body.discountedPriceCents).toBe(1990);
    expect(body.validity).toBe(validity);
    expect(body.mandatoryArtworkText).toBe(mandatory);
    // XOR — com auxiliares → productImages[] sem id
    expect(Array.isArray(body.productImages)).toBe(true);
    expect((body.productImages as unknown[]).length).toBe(2);
    expect(JSON.stringify(body.productImages)).not.toContain('"id"');
    expect(body.productImageDataUrl).toBeUndefined();
  });

  it("Teste 8 (D5): body carrega inputValidationOverride.productImageCheck: 'brief_review_confirmed' no caminho confirmado", async () => {
    const { result } = renderHook(() => useCampaignForm("store-1"));
    await fillValidOfferFormWithDataUrl(result);

    await act(async () => {
      await result.current.enterReview();
    });

    let capturedBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return createNdjsonResponse([
        { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      await result.current.confirmReview();
    });

    const override = (capturedBody!.inputValidationOverride as { productImageCheck?: string } | undefined);
    expect(override?.productImageCheck).toBe("brief_review_confirmed");
  });

  it("Teste 9 (D6): confirmar com custo desativado/indisponível/saldo insuficiente → bloqueado", async () => {
    const fields: CampaignFormFields = {
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
    const prepared: PreparedCampaignImage[] = [
      { id: "a", role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
    ];
    const renderReview = (balanceValue: number | null = 5) =>
      createElement(
        CampaignBriefReview,
        {
          fields,
          preparedImages: prepared,
          preparing: false,
          error: null,
          store: undefined,
          identity: null,
          balance: balanceValue,
          onBack: vi.fn(),
          onConfirm: vi.fn(),
        }
      );

    // custo indisponível (status unavailable) → confirmar bloqueado
    mockUseOperationCosts.mockReturnValue({
      costs: null,
      status: "unavailable",
      refetch: vi.fn(),
    });
    const { rerender } = render(renderReview());
    expect(screen.getByRole("button", { name: "Confirmar e gerar campanha" })).toBeDisabled();

    // custo desativado → bloqueado
    mockUseOperationCosts.mockReturnValue({
      costs: { campaign_generation: { costCredits: 1, enabled: false } },
      status: "loaded",
      refetch: vi.fn(),
    });
    rerender(renderReview());
    expect(screen.getByRole("button", { name: "Confirmar e gerar campanha" })).toBeDisabled();

    // saldo insuficiente → bloqueado
    mockUseOperationCosts.mockReturnValue({
      costs: { campaign_generation: { costCredits: 5, enabled: true } },
      status: "loaded",
      refetch: vi.fn(),
    });
    rerender(renderReview(3));
    expect(screen.getByRole("button", { name: "Confirmar e gerar campanha" })).toBeDisabled();
  });

  it("Teste 10 (D2): sem imagens utilizáveis → revisão bloqueada com mensagem de imagem obrigatória", async () => {
    const { result } = renderHook(() => useCampaignForm("store-1"));

    await act(async () => {
      result.current.setField("productName", "Produto Teste");
      result.current.setField("originalPriceCents", 10000);
      result.current.setField("discountedPriceCents", 1990);
      result.current.setField("badge", "Oferta");
    });

    let entered = true;
    await act(async () => {
      entered = await result.current.enterReview();
    });

    expect(entered).toBe(false);
    expect(result.current.reviewMode).toBe(false);
    expect(result.current.fieldErrors.productImages).toBe("Imagem do produto é obrigatória");
  });
});