// @vitest-environment jsdom
/**
 * Quick 261121-m97 — ciclo de vida da imagem do rascunho.
 *
 * Provas determinísticas (sem timers reais) para:
 * 1. promoção de principal A→B: leitura antiga de A não sobrescreve B;
 * 2. A→B→A com o mesmo objeto File: leitura antiga não vence;
 * 3. remoção durante a leitura: não ressuscita a imagem após reload;
 * 4. unmount durante a leitura: callback tardio não grava;
 * 5. object URL do hook revogada no unmount;
 * 6. mudança de escopo/chave durante a leitura: grava na chave vigente;
 * 7a/7b/7c. Strict Mode: seleção/restauração válidas e revogação no unmount.
 *
 * Estas provas rodam ANTES de qualquer correção. Falha de preparação
 * (mock incompleto, premissa de contagem de leitores, timeout) é reportada
 * separadamente de falha de comportamento.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { StrictMode } from "react";
import { useCampaignForm } from "../use-campaign-form";
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSaveFormState = vi.fn();
const mockRestoreFormState = vi.fn();
const mockClearFormState = vi.fn();

const DRAFT_KEY = "campaign_draft";
const IMAGE_DRAFT_KEY = "campaign_draft_image";

vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: mockSaveFormState,
    restoreFormState: mockRestoreFormState,
    clearFormState: mockClearFormState,
  }),
  scopedDraftKey: (scope?: string | null) => (scope ? `${DRAFT_KEY}:${scope}` : DRAFT_KEY),
  scopedImageDraftKey: (scope?: string | null) =>
    scope ? `${IMAGE_DRAFT_KEY}:${scope}` : IMAGE_DRAFT_KEY,
}));

const DATA_URL_A = "data:image/png;base64,AAAA";
const DATA_URL_A_OLD = "data:image/png;base64,OLD";
const DATA_URL_A_NEW = "data:image/png;base64,NEW";
const DATA_URL_B = "data:image/png;base64,BBBB";
const DATA_URL_COMPRESSED = "data:image/jpeg;base64,COMPRESSED";

type FakeReaderInstance = {
  file: File | null;
  result: string | null;
  onloadend: ((event?: unknown) => void) | null;
  readAsDataURL: (file: File | Blob) => void;
  fire: (dataUrl: string) => void;
};

class FakeFileReader {
  static instances: FakeReaderInstance[] = [];

  file: File | null = null;
  result: string | null = null;
  onloadend: ((event?: unknown) => void) | null = null;

  constructor() {
    FakeFileReader.instances.push(this as unknown as FakeReaderInstance);
  }

  readAsDataURL(file: File | Blob): void {
    this.file = file instanceof File ? file : null;
    // A compressão (`compressImage`) lê um Blob via FileReader. Para não
    // bloquear esse caminho, leituras que não são do preview são concluídas
    // automaticamente; as leituras do preview (File do produto) seguem manuais.
    if (!(file instanceof File)) {
      const self = this as unknown as FakeReaderInstance;
      self.result = DATA_URL_COMPRESSED;
      queueMicrotask(() => self.onloadend?.());
    }
  }

  fire(dataUrl: string): void {
    this.result = dataUrl;
    this.onloadend?.();
  }

  static reset(): void {
    FakeFileReader.instances = [];
  }

  static fire(index: number, dataUrl: string): void {
    const reader = FakeFileReader.instances[index];
    if (!reader) throw new Error(`FileReader inexistente no índice ${index}`);
    reader.fire(dataUrl);
  }
}

type UrlStatic = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

const urlStatic = URL as unknown as UrlStatic;
const originalCreateObjectURL = urlStatic.createObjectURL;
const originalRevokeObjectURL = urlStatic.revokeObjectURL;

let createdUrls: string[] = [];
let revokedUrls: string[] = [];
let urlSequence = 0;

function fileA(): File {
  return new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" });
}

function fileB(): File {
  return new File([new Uint8Array([4, 5, 6])], "b.png", { type: "image/png" });
}

function heicFile(): File {
  return new File([new Uint8Array([7, 8, 9])], "c.heic", { type: "image/heic" });
}

function savedFields(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function renderForm(options: { strict?: boolean } = {}) {
  const wrapper = options.strict ? StrictMode : undefined;
  return renderHook(() => useCampaignForm("store-1"), { wrapper });
}

function stubImageCompression(): void {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 100, height: 100 }),
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
    cb(new Blob(["jpegdata"], { type: "image/jpeg" }));
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
}

function ndjsonResponse(events: Record<string, unknown>[]): Response {
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

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(null);
  FakeFileReader.reset();
  vi.stubGlobal("FileReader", FakeFileReader);

  createdUrls = [];
  revokedUrls = [];
  urlSequence = 0;
  urlStatic.createObjectURL = (blob: Blob) => {
    void blob;
    urlSequence += 1;
    const url = `blob:mock-${urlSequence}`;
    createdUrls.push(url);
    return url;
  };
  urlStatic.revokeObjectURL = (url: string) => {
    revokedUrls.push(url);
  };
});

afterEach(() => {
  urlStatic.createObjectURL = originalCreateObjectURL;
  urlStatic.revokeObjectURL = originalRevokeObjectURL;
  vi.unstubAllGlobals();
});

describe("useCampaignForm — ciclo de vida da imagem do rascunho", () => {
  it("1) promoção de B: leitura de A concluída depois não sobrescreve o rascunho", async () => {
    const primaryFile = fileA();
    const secondFile = fileB();
    const { result } = renderForm();

    await act(async () => {
      result.current.addImage(primaryFile, "upload");
    });
    await act(async () => {
      result.current.addImage(secondFile, "upload");
    });

    const primaryAfterAdd = result.current.fields.productImages[0];
    expect(primaryAfterAdd?.file).toBe(primaryFile);
    expect(result.current.fields.productImages).toHaveLength(2);

    await act(async () => {
      result.current.removeImage(result.current.fields.productImages[0].id);
    });

    // Premissa da reprodução: a remoção promove B a principal e cria o 2º leitor.
    expect(result.current.fields.productImages[0].file).toBe(secondFile);
    expect(FakeFileReader.instances).toHaveLength(2);
    expect(FakeFileReader.instances[0].file).toBe(primaryFile);
    expect(FakeFileReader.instances[1].file).toBe(secondFile);

    FakeFileReader.fire(1, DATA_URL_B);
    FakeFileReader.fire(0, DATA_URL_A);

    expect(sessionStorage.getItem(IMAGE_DRAFT_KEY)).toBe(DATA_URL_B);
  });

  it("2) A→B→A com o mesmo objeto File: leitura antiga não vence", async () => {
    const firstA = fileA();
    const b = fileB();
    const { result } = renderForm();

    await act(async () => {
      result.current.addImage(firstA, "upload");
    });
    await act(async () => {
      result.current.addImage(b, "upload");
    });
    await act(async () => {
      result.current.removeImage(result.current.fields.productImages[0].id);
    });
    expect(result.current.fields.productImages[0].file).toBe(b);

    await act(async () => {
      result.current.addImage(firstA, "upload");
    });
    // A entra como referência: a principal continua sendo B.
    expect(result.current.fields.productImages[0].file).toBe(b);
    expect(result.current.fields.productImages[1].file).toBe(firstA);

    await act(async () => {
      result.current.removeImage(result.current.fields.productImages[0].id);
    });

    // Premissa: três leitores, na ordem A, B, A (adicionar referência não cria leitor).
    expect(result.current.fields.productImages[0].file).toBe(firstA);
    expect(FakeFileReader.instances).toHaveLength(3);
    expect(FakeFileReader.instances[0].file).toBe(firstA);
    expect(FakeFileReader.instances[1].file).toBe(b);
    expect(FakeFileReader.instances[2].file).toBe(firstA);

    FakeFileReader.fire(2, DATA_URL_A_NEW);
    FakeFileReader.fire(0, DATA_URL_A_OLD);

    expect(sessionStorage.getItem(IMAGE_DRAFT_KEY)).toBe(DATA_URL_A_NEW);
  });

  it("3) remoção durante a leitura não ressuscita a imagem após reload", async () => {
    const file = fileA();
    const { result, unmount } = renderForm();

    await act(async () => {
      result.current.addImage(file, "upload");
    });
    await act(async () => {
      result.current.removeImage(result.current.fields.productImages[0].id);
    });
    expect(result.current.fields.productImages).toHaveLength(0);

    FakeFileReader.fire(0, DATA_URL_A);
    const persistedAfterRemoval = sessionStorage.getItem(IMAGE_DRAFT_KEY);

    // Reload: o autosave salvou campos sem imagens; a imagem não pode voltar.
    mockRestoreFormState.mockReturnValue(savedFields());
    unmount();
    const reloaded = renderForm();
    await act(async () => {});

    expect({
      persistedAfterRemoval,
      imagesAfterReload: reloaded.result.current.fields.productImages.length,
      hasRestorationNotice: reloaded.result.current.restorationNotice !== null,
    }).toEqual({
      persistedAfterRemoval: null,
      imagesAfterReload: 0,
      hasRestorationNotice: true,
    });
  });

  it("4) unmount durante a leitura: callback tardio não grava", async () => {
    const file = fileA();
    const { result, unmount } = renderForm();

    await act(async () => {
      result.current.addImage(file, "upload");
    });
    expect(FakeFileReader.instances).toHaveLength(1);

    unmount();
    FakeFileReader.fire(0, DATA_URL_A);

    expect(sessionStorage.getItem(IMAGE_DRAFT_KEY)).toBeNull();
  });

  it("5) object URL do hook é revogada no unmount", async () => {
    const file = fileA();
    const { result, unmount } = renderForm();

    await act(async () => {
      result.current.addImage(file, "upload");
    });
    expect(createdUrls).toEqual(["blob:mock-1"]);

    unmount();

    expect(revokedUrls).toContain("blob:mock-1");
  });

  it("6) leitura de outro escopo é descartada e não altera a chave de destino", async () => {
    stubImageCompression();
    const file = heicFile();
    const { result } = renderForm();
    const SENTINEL = "data:image/jpeg;base64,SENTINEL-ENVIADA";

    await act(async () => {
      result.current.setField("productName", "Produto Teste");
      result.current.setField("originalPriceCents", 10000);
      result.current.setField("discountedPriceCents", 1990);
      result.current.setField("badge", "Oferta");
      result.current.addImage(file, "upload");
    });

    expect(FakeFileReader.instances).toHaveLength(1);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        ndjsonResponse([
          { type: "phase", phase: "quality", status: "running", campaignId: "camp-1" },
        ]),
      ),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    // Premissa de HARNESS: o submit realmente aconteceu (fetch + fase) e a
    // leitura do preview continua pendente. Stream sem terminal vira
    // `unknownResult` por fail-safe — não é falha de submissão.
    const fetchMock = globalThis.fetch as unknown as { mock?: { calls: unknown[] } };
    expect({
      submitError: result.current.submitError,
      fieldErrors: result.current.fieldErrors,
      readers: FakeFileReader.instances.length,
      fetchCalls: fetchMock.mock?.calls.length ?? -1,
      phases: result.current.phases.length,
      unknownCampaignId: result.current.unknownResult?.campaignId ?? null,
      storageKeys: Object.keys(sessionStorage),
    }).toEqual({
      submitError: null,
      fieldErrors: {},
      readers: 2,
      fetchCalls: 1,
      phases: 1,
      unknownCampaignId: "camp-1",
      storageKeys: [],
    });

    // A adoção de escopo deve ter acontecido; a leitura de A continua pendente.
    expect(sessionStorage.getItem(`${IMAGE_DRAFT_KEY}:camp-1`)).toBeNull();

    // A imagem efetivamente enviada já está persistida na chave da campanha
    // (caminho existente `persistSubmittedDraft`). O callback tardio NÃO pode
    // sobrescrevê-la nem gravar na chave antiga.
    sessionStorage.setItem(`${IMAGE_DRAFT_KEY}:camp-1`, SENTINEL);

    FakeFileReader.fire(0, DATA_URL_A);

    expect({
      scopedKey: sessionStorage.getItem(`${IMAGE_DRAFT_KEY}:camp-1`),
      globalKey: sessionStorage.getItem(IMAGE_DRAFT_KEY),
    }).toEqual({ scopedKey: SENTINEL, globalKey: null });
  });

  it("7a) Strict Mode: seleção normal grava e cria um único leitor", async () => {
    const file = fileA();
    const { result } = renderForm({ strict: true });

    await act(async () => {
      result.current.addImage(file, "upload");
    });
    expect(FakeFileReader.instances).toHaveLength(1);

    FakeFileReader.fire(0, DATA_URL_A);

    expect(sessionStorage.getItem(IMAGE_DRAFT_KEY)).toBe(DATA_URL_A);
  });

  it("7b) Strict Mode: unmount revoga a URL criada exatamente uma vez", async () => {
    const file = fileA();
    const { result, unmount } = renderForm({ strict: true });

    await act(async () => {
      result.current.addImage(file, "upload");
    });
    expect(createdUrls).toEqual(["blob:mock-1"]);

    unmount();

    expect(revokedUrls).toEqual(["blob:mock-1"]);
  });

  it("7c) Strict Mode: restauração de rascunho continua funcionando", async () => {
    const file = fileA();
    const { result, unmount } = renderForm({ strict: true });

    await act(async () => {
      result.current.addImage(file, "upload");
    });
    FakeFileReader.fire(0, DATA_URL_A);
    expect(sessionStorage.getItem(IMAGE_DRAFT_KEY)).toBe(DATA_URL_A);

    unmount();
    mockRestoreFormState.mockReturnValue(savedFields());

    const reloaded = renderForm({ strict: true });
    await act(async () => {});

    expect(reloaded.result.current.fields.productImages).toHaveLength(1);
    expect(reloaded.result.current.restorationNotice).toBeNull();
  });
});
