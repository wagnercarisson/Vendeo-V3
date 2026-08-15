// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCampaignForm, validateImage, compressImage } from "../use-campaign-form";
import { MAX_CAMPAIGN_IMAGES } from "@/lib/image-generation/config";

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

function pngFile(extraBytes = 1): File {
  const bytes = new Uint8Array(extraBytes);
  return new File([bytes], "foto.png", { type: "image/png" });
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

describe("useCampaignForm productImages (F41)", () => {
  it("9: primary obrigatória; auxiliares opcionais até MAX_CAMPAIGN_IMAGES - 1", async () => {
    const { result } = renderHook(() => useCampaignForm("store-1"));

    // completa campos obrigatórios (isValid depende deles também)
    await act(async () => {
      result.current.setField("productName", "Produto Teste");
      result.current.setField("discountedPriceCents", 1990);
      result.current.setField("badge", "Oferta");
    });

    // sem imagem → isValid false (obrigatoriedade da primary)
    expect(result.current.isValid).toBe(false);

    // adiciona a primary → isValid true
    await act(async () => {
      result.current.addImage(pngFile(10), "upload");
    });
    expect(result.current.fields.productImages).toHaveLength(1);
    expect(result.current.fields.productImages[0].role).toBe("primary");
    expect(result.current.isValid).toBe(true);

    // adiciona até o teto (MAX_CAMPAIGN_IMAGES)
    for (let i = 1; i < MAX_CAMPAIGN_IMAGES; i++) {
      await act(async () => {
        result.current.addImage(pngFile(10), "upload");
      });
    }
    expect(result.current.fields.productImages).toHaveLength(MAX_CAMPAIGN_IMAGES);

    // além do teto → hook bloqueia (D10)
    await act(async () => {
      result.current.addImage(pngFile(10), "upload");
    });
    expect(result.current.fields.productImages).toHaveLength(MAX_CAMPAIGN_IMAGES);

    // demais são reference
    const roles = result.current.fields.productImages.map((i) => i.role);
    expect(roles[0]).toBe("primary");
    expect(roles.slice(1).every((r) => r === "reference")).toBe(true);
  });

  it("10: remover a única primary → validação de obrigatoriedade volta a falhar", async () => {
    const { result } = renderHook(() => useCampaignForm("store-1"));

    await act(async () => {
      result.current.setField("productName", "Produto Teste");
      result.current.setField("discountedPriceCents", 1990);
      result.current.setField("badge", "Oferta");
      result.current.addImage(pngFile(10), "upload");
    });
    expect(result.current.isValid).toBe(true);

    const primaryId = result.current.fields.productImages[0].id;
    await act(async () => {
      result.current.removeImage(primaryId);
    });
    expect(result.current.fields.productImages).toHaveLength(0);
    expect(result.current.isValid).toBe(false);

    // remover primary com auxiliares → promove o próximo a primary
    await act(async () => {
      result.current.addImage(pngFile(10), "upload");
      result.current.addImage(pngFile(10), "camera");
    });
    const firstId = result.current.fields.productImages[0].id;
    await act(async () => {
      result.current.removeImage(firstId);
    });
    expect(result.current.fields.productImages).toHaveLength(1);
    expect(result.current.fields.productImages[0].role).toBe("primary");
  });

  it("11: source câmera → camera; galeria → upload", async () => {
    const { result } = renderHook(() => useCampaignForm("store-1"));

    await act(async () => {
      result.current.addImage(pngFile(10), "camera");
      result.current.addImage(pngFile(10), "upload");
    });

    expect(result.current.fields.productImages[0].source).toBe("camera");
    expect(result.current.fields.productImages[1].source).toBe("upload");
  });

  it("12: HEIC aceito no input; decode via canvas → JPEG; falha → mensagem PT-BR", async () => {
    // validateImage aceita HEIC
    expect(validateImage(heicFile())).toBeNull();
    // formato inválido
    expect(validateImage(new File([""], "f.gif", { type: "image/gif" }))).toBe(
      "Formato não suportado. Use PNG, JPG, WEBP ou HEIC"
    );

    // createImageBitmap mockado (resolve) → compressImage produz JPEG dataUrl
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

    const result = await compressImage(heicFile());
    expect(result.file.type).toBe("image/jpeg");
    expect(result.dataUrl).toContain("data:image/jpeg;base64,");
  });

  it("12b: falha do decode HEIC → mensagem PT-BR clara", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("decode failed"))
    );

    await expect(compressImage(heicFile())).rejects.toThrow(
      "Não foi possível processar a imagem HEIC. Use JPG ou PNG."
    );
  });

  it("13: EXIF respeitada — createImageBitmap com imageOrientation from-image", async () => {
    const bitmapMock = vi.fn().mockResolvedValue({ width: 100, height: 100 });
    vi.stubGlobal("createImageBitmap", bitmapMock);
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob(["jpegdata"], { type: "image/jpeg" }));
    }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;

    await compressImage(heicFile());
    expect(bitmapMock).toHaveBeenCalledWith(
      expect.any(File),
      { imageOrientation: "from-image" }
    );
  });

  it("16: erros de limite por item (5MB) e formato inválido", () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
    expect(validateImage(big)).toBe("Arquivo muito grande. Máximo 5MB");
    expect(validateImage(new File([""], "f.svg", { type: "image/svg+xml" }))).toBe(
      "Formato não suportado. Use PNG, JPG, WEBP ou HEIC"
    );
  });

  it("14: body D2 — com auxiliares → productImages[] sem id; sem → productImageDataUrl legado; nunca ambos", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      createNdjsonResponse([
        { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCampaignForm("store-1"));

    await act(async () => {
      result.current.setField("productName", "Produto Teste");
      result.current.setField("discountedPriceCents", 1990);
      result.current.setField("badge", "Oferta");
    });

    // Caso 1: primary + 2 auxiliares (com dataUrl) → body.productImages (sem id)
    await act(async () => {
      result.current.setField("productImages", [
        { id: "a", role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
        { id: "b", role: "reference", source: "upload", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
        { id: "c", role: "reference", source: "camera", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
      ]);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.productImages).toHaveLength(3);
    expect(body.productImages[0].role).toBe("primary");
    expect(body.productImages[1].role).toBe("reference");
    expect(body.productImages[2].role).toBe("reference");
    expect(body.productImages[0].source).toBe("upload");
    expect(body.productImages[2].source).toBe("camera");
    for (const item of body.productImages) {
      expect(item).not.toHaveProperty("id");
    }
    expect(body.productImageDataUrl).toBeUndefined();

    // Caso 2: só primary → body.productImageDataUrl legado (sem productImages)
    mockPush.mockClear();
    fetchMock.mockClear();
    await act(async () => {
      result.current.setField("productImages", [
        { id: "a", role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
      ]);
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(result.current.submitError).toBeNull();
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    const bodyLegado = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(bodyLegado.productImageDataUrl).toBe(VALID_DATA_URL);
    expect(bodyLegado.productImages).toBeUndefined();
  });

  it("15: draft/autosave restaura N imagens (file undefined — File não serializa)", async () => {
    mockRestoreFormState.mockReturnValue({
      productName: "Test Product",
      description: "",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [
        { id: "a", role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
        { id: "b", role: "reference", source: "camera", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
      ],
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
    });

    const { result } = renderHook(() => useCampaignForm("store-1"));
    await act(async () => {});

    expect(result.current.fields.productImages).toHaveLength(2);
    expect(result.current.fields.productImages[0].role).toBe("primary");
    expect(result.current.fields.productImages[0].dataUrl).toBe(VALID_DATA_URL);
    expect(result.current.fields.productImages[0].file).toBeUndefined();
    expect(result.current.fields.productImages[1].role).toBe("reference");
    expect(result.current.fields.productImages[1].source).toBe("camera");
  });
});
