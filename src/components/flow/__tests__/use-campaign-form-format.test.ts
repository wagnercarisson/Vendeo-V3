import { describe, expect, it } from "vitest";
import {
  buildCampaignGenerationBody,
  buildEligibleDraftFingerprint,
  isCampaignFormatLocked,
  type CampaignFormFields,
} from "../use-campaign-form";

const STORE_ID = "11111111-1111-4111-8111-111111111111";

const BASE_FIELDS: CampaignFormFields = {
  productName: "Produto F59",
  description: "",
  originalPriceCents: 0,
  discountedPriceCents: 1990,
  badge: "Oferta",
  campaignIntent: "offer",
  preserveImageContext: false,
  productImages: [],
  mandatoryArtworkText: "",
  showIllustrativeNotice: false,
  mandatoryArtworkTextFree: "",
  validityMode: "",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
};

function fieldsWith(overrides: Partial<CampaignFormFields>): CampaignFormFields {
  return { ...BASE_FIELDS, ...overrides };
}

describe("F59/D-03 — campaignFormat no estado/body/fingerprint", () => {
  it("default é 1:1 e o body NÃO contém campaignFormat", () => {
    const fields = fieldsWith({ campaignFormat: "1:1" });
    const body = buildCampaignGenerationBody(fields, [], STORE_ID, { eligible: true });
    expect(body.backgroundDirection).toBe("studio");
    expect("campaignFormat" in body).toBe(false);
  });

  it("9:16 entra no body somente no fluxo elegível", () => {
    const fields = fieldsWith({ campaignFormat: "9:16" });
    const eligibleBody = buildCampaignGenerationBody(fields, [], STORE_ID, { eligible: true });
    const legacyBody = buildCampaignGenerationBody(fields, [], STORE_ID);
    expect(eligibleBody.campaignFormat).toBe("9:16");
    expect("campaignFormat" in legacyBody).toBe(false);
  });

  it("voltar para 1:1 remove a chave (payload byte-compatível)", () => {
    const vertical = buildCampaignGenerationBody(
      fieldsWith({ campaignFormat: "9:16" }),
      [],
      STORE_ID,
      { eligible: true },
    );
    const square = buildCampaignGenerationBody(
      fieldsWith({ campaignFormat: "1:1" }),
      [],
      STORE_ID,
      { eligible: true },
    );
    expect("campaignFormat" in vertical).toBe(true);
    expect("campaignFormat" in square).toBe(false);
  });

  it("fingerprint 1:1 permanece igual e 9:16 é diferente", () => {
    const square = buildEligibleDraftFingerprint(
      fieldsWith({ campaignFormat: "1:1" }),
      [],
      STORE_ID,
    );
    const defaultFormat = buildEligibleDraftFingerprint(
      fieldsWith({}),
      [],
      STORE_ID,
    );
    const vertical = buildEligibleDraftFingerprint(
      fieldsWith({ campaignFormat: "9:16" }),
      [],
      STORE_ID,
    );

    expect(square).toBe(defaultFormat);
    expect(vertical).not.toBe(square);
  });
});

describe("Quick 261106-qxn — bloqueio de mutação do formato", () => {
  const unlocked = {
    reviewMode: false,
    preparing: false,
    isSubmitting: false,
    unknownResult: null,
  };

  it("libera apenas na edição normal", () => {
    expect(isCampaignFormatLocked(unlocked)).toBe(false);
  });

  it.each([
    ["revisão", { ...unlocked, reviewMode: true }],
    ["preparação", { ...unlocked, preparing: true }],
    ["geração", { ...unlocked, isSubmitting: true }],
    ["resultado desconhecido", { ...unlocked, unknownResult: { operationId: "op-1" } }],
  ])("bloqueia durante %s", (_label, state) => {
    expect(isCampaignFormatLocked(state)).toBe(true);
  });
});
