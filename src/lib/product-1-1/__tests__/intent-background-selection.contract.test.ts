// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCampaignGenerationBody,
  buildEligibleDraftFingerprint,
  resolveDraftIdentity,
} from "@/components/flow/use-campaign-form";
import type {
  CampaignFormFields,
  DraftIdentityState,
  PreparedCampaignImage,
} from "@/components/flow/use-campaign-form";
import {
  countProductImages,
  ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE,
  validateOriginalBackground,
} from "../selection-validation";

const { mockUseCampaignForm } = vi.hoisted(() => ({
  mockUseCampaignForm: vi.fn(),
}));

// Preserva o MÓDULO REAL (buildCampaignGenerationBody/resolveDraftIdentity/
// buildEligibleDraftFingerprint reais) e substitui apenas o hook — o gating da
// região B depende da prop `eligible` do componente, não do hook.
vi.mock("@/components/flow/use-campaign-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/flow/use-campaign-form")>();
  return {
    ...actual,
    inferIntent: vi.fn(() => "offer" as const),
    useCampaignForm: () => mockUseCampaignForm(),
  };
});

vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/credit/credit-cta", () => ({ CreditCta: () => null }));
vi.mock("@/components/campaign/mandatory-artwork-field", () => ({
  MandatoryArtworkField: () => null,
}));
vi.mock("@/components/campaign/illustrative-notice-field", () => ({
  IllustrativeNoticeField: () => null,
}));
vi.mock("@/components/campaign/validity-field", () => ({ ValidityField: () => null }));
vi.mock("@/components/flow/campaign-image-upload", () => ({ CampaignImageUpload: () => null }));
vi.mock("@/components/flow/generation-progress", () => ({ GenerationProgress: () => null }));

import { CampaignInputForm } from "@/components/flow/campaign-input-form";

const DATA_URL = "data:image/png;base64,AAAA";

function legacyOfferFields(overrides: Partial<CampaignFormFields> = {}): CampaignFormFields {
  return {
    productName: "Produto Teste",
    description: "",
    originalPriceCents: 10000,
    discountedPriceCents: 1990,
    badge: "Oferta",
    campaignIntent: "offer",
    preserveImageContext: false,
    productImages: [
      { id: "p1", role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: DATA_URL },
    ],
    mandatoryArtworkText: "",
    showIllustrativeNotice: false,
    mandatoryArtworkTextFree: "",
    validityMode: "",
    validityStartDate: "",
    validityEndDate: "",
    validityCustomText: "",
    backgroundDirection: "studio",
    ...overrides,
  };
}

function singlePreparedImage(): PreparedCampaignImage[] {
  return [{ id: "p1", role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: DATA_URL }];
}

/** Gerador determinístico; conta as chamadas para provar conservação/regeneração. */
function makeGenerator(): () => string {
  let n = 0;
  return () => `11111111-1111-4111-8111-${String(++n).padStart(12, "0")}`;
}

function makeHookState(fields: CampaignFormFields) {
  return {
    fields,
    fieldErrors: {} as Record<string, string | undefined>,
    touched: {} as Record<string, boolean>,
    setField: vi.fn(),
    handleBlur: vi.fn(),
    displayPriceOriginal: "",
    displayPriceDiscounted: "",
    handlePriceOriginalChange: vi.fn(),
    handlePriceDiscountedChange: vi.fn(),
    imagePreviewUrl: null,
    isSubmitting: false,
    submitError: null,
    setSubmitError: vi.fn(),
    retrySubmit: vi.fn(),
    pendingConflict: null,
    handleConflictContinue: vi.fn(),
    handleConflictCorrect: vi.fn(),
    handleConflictCancel: vi.fn(),
    phases: [],
    addImage: vi.fn(),
    removeImage: vi.fn(),
    reviewMode: false,
    preparing: false,
    preparedImages: [],
    reviewError: null,
    enterReview: vi.fn(),
    exitReview: vi.fn(),
    confirmReview: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("F56.2b1b — gating de payload (buildCampaignGenerationBody)", () => {
  it("off: saída byte-compatível com o legado (sem campos exclusivos)", () => {
    const fields = legacyOfferFields();
    const body = buildCampaignGenerationBody(fields, singlePreparedImage(), "store-1");

    expect(JSON.stringify(body)).toBe(
      '{"storeId":"store-1","productName":"Produto Teste","originalPriceCents":10000,"discountedPriceCents":1990,"badgeText":"Oferta","campaignIntent":"offer","productImageDataUrl":"data:image/png;base64,AAAA"}',
    );
    expect(Object.keys(body)).toEqual([
      "storeId",
      "productName",
      "originalPriceCents",
      "discountedPriceCents",
      "description",
      "badgeText",
      "campaignIntent",
      "productImageDataUrl",
    ]);
    // FALHA se `backgroundDirection` (ou a identidade) vazar no payload legado.
    expect(body).not.toHaveProperty("backgroundDirection");
    expect(body).not.toHaveProperty("campaignId");
    expect(body).not.toHaveProperty("operationId");
  });

  it("off explícito (eligible:false) === sem opção (byte-compatível)", () => {
    const fields = legacyOfferFields();
    const withoutOption = buildCampaignGenerationBody(fields, singlePreparedImage(), "store-1");
    const explicitOff = buildCampaignGenerationBody(fields, singlePreparedImage(), "store-1", {
      eligible: false,
    });
    expect(JSON.stringify(explicitOff)).toBe(JSON.stringify(withoutOption));
  });

  it("eligible: payload inclui backgroundDirection (enum interno)", () => {
    const fields = legacyOfferFields({ backgroundDirection: "original" });
    const body = buildCampaignGenerationBody(fields, singlePreparedImage(), "store-1", {
      eligible: true,
    });
    expect(body.backgroundDirection).toBe("original");
    expect(body.productName).toBe("Produto Teste");
  });
});

describe("quick 261017-cdi — preço no payload (novo fluxo omite zero; legado preserva)", () => {
  it("elegível: Destaque sem preço NÃO envia originalPriceCents=0 nem discountedPriceCents", () => {
    const fields = legacyOfferFields({
      campaignIntent: "spotlight",
      originalPriceCents: 0,
      discountedPriceCents: undefined,
      badge: "Destaque da Semana",
    });
    const body = buildCampaignGenerationBody(fields, singlePreparedImage(), "store-1", {
      eligible: true,
    });
    expect(body).not.toHaveProperty("originalPriceCents");
    expect(body).not.toHaveProperty("discountedPriceCents");
  });

  it("elegível: Destaque com preço POSITIVO preserva o valor (original 0 é omitido)", () => {
    const fields = legacyOfferFields({
      campaignIntent: "spotlight",
      originalPriceCents: 0,
      discountedPriceCents: 1990,
      badge: "Destaque da Semana",
    });
    const body = buildCampaignGenerationBody(fields, singlePreparedImage(), "store-1", {
      eligible: true,
    });
    expect(body.discountedPriceCents).toBe(1990);
    expect(body).not.toHaveProperty("originalPriceCents");
  });

  it("legado (inelegível): byte-compatível — `0` é preservado", () => {
    const fields = legacyOfferFields({
      campaignIntent: "spotlight",
      originalPriceCents: 0,
      discountedPriceCents: undefined,
      badge: "Destaque da Semana",
    });
    const body = buildCampaignGenerationBody(fields, singlePreparedImage(), "store-1");
    expect(body.originalPriceCents).toBe(0);
    expect(body.discountedPriceCents).toBeUndefined();
    // byte-compatível: a chave `discountedPriceCents` é preservada com `undefined`
    // (JSON.stringified a descarta) — igual ao comportamento legado.
    expect(JSON.stringify(body)).not.toContain("discountedPriceCents");
  });
});

describe("F56.2b1b — regra Original exige exatamente uma imagem de produto", () => {
  it("aceita exatamente 1 imagem de produto", () => {
    expect(validateOriginalBackground({ productImageCount: 1 })).toEqual({
      valid: true,
      error: null,
    });
  });

  it.each([0, 2, 3])("rejeita %i imagens de produto como erro de campo", (productImageCount) => {
    expect(validateOriginalBackground({ productImageCount })).toEqual({
      valid: false,
      error: ORIGINAL_BACKGROUND_REQUIRES_ONE_PRODUCT_IMAGE,
    });
  });

  it("uma imagem de produto + uma de identidade continua válido (identidade não conta)", () => {
    const count = countProductImages({
      productImages: [{ id: "product-1" }],
      identityImages: [{ id: "logo" }],
    });
    expect(count).toBe(1);
    expect(validateOriginalBackground({ productImageCount: count })).toEqual({
      valid: true,
      error: null,
    });
  });
});

describe("F56.2b1b — C3 identidade (origem/transporte no formulário)", () => {
  it("identidade padrão usa UUIDs", () => {
    const state = resolveDraftIdentity("fp-1", null);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(state.identity.campaignId).toMatch(uuidRe);
    expect(state.identity.operationId).toMatch(uuidRe);
  });

  it("MESMO fingerprint conserva a identidade (duas construções ⇒ identidade idêntica)", () => {
    const fields = legacyOfferFields();
    const images = singlePreparedImage();
    const fingerprint = buildEligibleDraftFingerprint(fields, images, "store-1");

    const generator = makeGenerator();
    const state1 = resolveDraftIdentity(fingerprint, null, generator);
    // segundo reenvio: gerador diferente NÃO deve ser usado (fingerprint igual).
    const unusedGenerator = vi.fn(makeGenerator());
    const state2 = resolveDraftIdentity(fingerprint, state1, unusedGenerator);

    expect(state2.identity).toEqual(state1.identity);
    expect(unusedGenerator).not.toHaveBeenCalled();

    const body1 = buildCampaignGenerationBody(fields, images, "store-1", {
      eligible: true,
      identity: state1.identity,
    });
    const body2 = buildCampaignGenerationBody(fields, images, "store-1", {
      eligible: true,
      identity: state2.identity,
    });
    // FALHA se a identidade não for conservada entre as duas construções.
    expect(body1.campaignId).toBe(body2.campaignId);
    expect(body1.operationId).toBe(body2.operationId);
  });

  it("fingerprints distintos produzem identidades distintas", () => {
    const generator = makeGenerator();
    const stateA = resolveDraftIdentity("fp-a", null, generator);
    const stateB = resolveDraftIdentity("fp-b", stateA, generator);
    expect(stateB.fingerprint).toBe("fp-b");
    expect(stateB.identity.campaignId).not.toBe(stateA.identity.campaignId);
    expect(stateB.identity.operationId).not.toBe(stateA.identity.operationId);
  });

  it("fingerprint muda quando o rascunho elegível muda", () => {
    const base = legacyOfferFields();
    const images = singlePreparedImage();
    const fp1 = buildEligibleDraftFingerprint(base, images, "store-1");
    const fp2 = buildEligibleDraftFingerprint(
      legacyOfferFields({ backgroundDirection: "ambient" }),
      images,
      "store-1",
    );
    expect(fp1).not.toBe(fp2);
    // mesma entrada ⇒ mesmo fingerprint (estável).
    expect(buildEligibleDraftFingerprint(base, images, "store-1")).toBe(fp1);
  });

  it("payload inelegível NÃO transporta identidade (mesmo com identity fornecida)", () => {
    const state: DraftIdentityState = resolveDraftIdentity("fp", null, makeGenerator());
    const body = buildCampaignGenerationBody(
      legacyOfferFields(),
      singlePreparedImage(),
      "store-1",
      { identity: state.identity },
    );
    expect(body).not.toHaveProperty("campaignId");
    expect(body).not.toHaveProperty("operationId");
    expect(body).not.toHaveProperty("backgroundDirection");
  });
});

describe("F56.2b1b — F1 fingerprint = conteúdo efetivo da submissão (sem identidade/revisão)", () => {
  const STORE = "store-1";

  it("mudar a validade muda o fingerprint/identidade", () => {
    const images = singlePreparedImage();
    const fpBase = buildEligibleDraftFingerprint(legacyOfferFields(), images, STORE);
    const fpValidity = buildEligibleDraftFingerprint(
      legacyOfferFields({ validityMode: "today" }),
      images,
      STORE,
    );
    expect(fpValidity).not.toBe(fpBase);

    const generator = makeGenerator();
    const a = resolveDraftIdentity(fpBase, null, generator);
    const b = resolveDraftIdentity(fpValidity, a, generator);
    expect(b.identity.campaignId).not.toBe(a.identity.campaignId);
    expect(b.identity.operationId).not.toBe(a.identity.operationId);
  });

  it("mudar texto obrigatório (mandatoryArtworkTextFree/description) muda a identidade", () => {
    const images = singlePreparedImage();
    const fpBase = buildEligibleDraftFingerprint(legacyOfferFields(), images, STORE);

    const withNotice = legacyOfferFields({
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "beba com moderação",
    });
    expect(buildEligibleDraftFingerprint(withNotice, images, STORE)).not.toBe(fpBase);

    const withDescription = legacyOfferFields({ description: "Descrição comercial" });
    const fpDescription = buildEligibleDraftFingerprint(withDescription, images, STORE);
    expect(fpDescription).not.toBe(fpBase);

    const generator = makeGenerator();
    const a = resolveDraftIdentity(fpBase, null, generator);
    const b = resolveDraftIdentity(fpDescription, a, generator);
    expect(b.identity).not.toEqual(a.identity);
  });

  it("mudar/adicionar imagem de referência muda a identidade", () => {
    const base = legacyOfferFields();
    const single = singlePreparedImage();
    const two: PreparedCampaignImage[] = [
      ...single,
      {
        id: "p2",
        role: "reference",
        source: "upload",
        mimeType: "image/jpeg",
        dataUrl: "data:image/png;base64,BBBB",
      },
    ];
    const fpSingle = buildEligibleDraftFingerprint(base, single, STORE);
    const fpTwo = buildEligibleDraftFingerprint(base, two, STORE);
    expect(fpTwo).not.toBe(fpSingle);

    const generator = makeGenerator();
    const a = resolveDraftIdentity(fpSingle, null, generator);
    const b = resolveDraftIdentity(fpTwo, a, generator);
    expect(b.identity.campaignId).not.toBe(a.identity.campaignId);
    expect(b.identity.operationId).not.toBe(a.identity.operationId);
  });

  it("conteúdo idêntico ⇒ identidade idêntica e UUIDs NÃO entram no fingerprint", () => {
    const fields = legacyOfferFields({ validityMode: "today" });
    const images = singlePreparedImage();
    const fp1 = buildEligibleDraftFingerprint(fields, images, STORE);
    const fp2 = buildEligibleDraftFingerprint(fields, images, STORE);
    expect(fp2).toBe(fp1);

    const generator = makeGenerator();
    const state = resolveDraftIdentity(fp1, null, generator);
    // duas construções do MESMO conteúdo ⇒ MESMOS ids (o gerador não é reusado).
    const unusedGenerator = vi.fn(makeGenerator());
    const sameContentAgain = resolveDraftIdentity(fp2, state, unusedGenerator);
    expect(sameContentAgain.identity).toEqual(state.identity);
    expect(unusedGenerator).not.toHaveBeenCalled();

    // a identidade (UUIDs) NUNCA aparece dentro da string do fingerprint.
    expect(fp1).not.toContain(state.identity.campaignId);
    expect(fp1).not.toContain(state.identity.operationId);
    expect(fp1).not.toContain("campaignId");
    expect(fp1).not.toContain("operationId");
  });
});

describe("F56.2b1b — prova de RENDER: controle exclusivo só sob elegibilidade (jsdom)", () => {
  it("off: região B não monta; a intenção legada (região A) permanece", () => {
    mockUseCampaignForm.mockReturnValue(makeHookState(legacyOfferFields()));
    render(createElement(CampaignInputForm, { storeId: "store-1", balance: 5, eligible: false }));

    expect(screen.queryByTestId("flow-background-direction-selector")).not.toBeInTheDocument();
    expect(screen.queryByText("Direção de fundo")).not.toBeInTheDocument();
    // região A (legado) sempre visível.
    expect(screen.getByText("Intenção da campanha")).toBeInTheDocument();
  });

  it("eligible: região B monta com Estúdio/Ambientado/Original; região A permanece", () => {
    mockUseCampaignForm.mockReturnValue(makeHookState(legacyOfferFields()));
    render(createElement(CampaignInputForm, { storeId: "store-1", balance: 5, eligible: true }));

    expect(screen.getByTestId("flow-background-direction-selector")).toBeInTheDocument();
    expect(screen.getByText("Direção de fundo")).toBeInTheDocument();
    expect(screen.getByLabelText("Estúdio")).toBeInTheDocument();
    expect(screen.getByLabelText("Ambientado")).toBeInTheDocument();
    expect(screen.getByLabelText("Original")).toBeInTheDocument();
    expect(screen.getByText("Intenção da campanha")).toBeInTheDocument();
  });
});
