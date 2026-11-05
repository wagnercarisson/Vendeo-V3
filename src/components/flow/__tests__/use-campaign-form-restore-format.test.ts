// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  }),
}));

import {
  buildCampaignGenerationBody,
  useCampaignForm,
} from "@/components/flow/use-campaign-form";
import { CampaignBriefReview } from "@/components/flow/campaign-brief-review";
import { scopedDraftKey } from "@/hooks/use-input-preservation";
import type { CampaignFormRestore } from "@/lib/campaign/display";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";

const BASE_RESTORE: CampaignFormRestore = {
  campaignId: CAMPAIGN_ID,
  productName: "Produto F59",
  description: "",
  originalPriceCents: 0,
  discountedPriceCents: 1990,
  badge: "Oferta",
  campaignIntent: "offer",
  preserveImageContext: false,
  mandatoryArtworkTextFree: "",
  showIllustrativeNotice: false,
  backgroundDirection: "studio",
  referenceSelections: [],
  imageRestoreLimited: true,
};

function renderRestore(overrides: Partial<CampaignFormRestore>) {
  return renderHook(() =>
    useCampaignForm(STORE_ID, {
      eligible: true,
      restoredForm: { ...BASE_RESTORE, ...overrides },
    }),
  );
}

describe("F59/59-08 — hidratação do formato restaurado", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("restore vertical mantém 9:16 no estado e no body", async () => {
    const { result } = renderRestore({
      campaignFormat: "9:16",
      formatContractVersion: "f59-vertical-9-16-v1",
      formatUnavailable: false,
    });

    await waitFor(() => expect(result.current.fields.productName).toBe("Produto F59"));
    expect(result.current.fields.campaignFormat).toBe("9:16");

    const body = buildCampaignGenerationBody(result.current.fields, [], STORE_ID, {
      eligible: true,
    });
    expect(body.campaignFormat).toBe("9:16");
  });

  it("restore vertical + rascunho local SEM formato ⇒ herda 9:16 no estado, revisão e payload", async () => {
    // Rascunho gravado antes do campo `campaignFormat` existir.
    sessionStorage.setItem(
      scopedDraftKey(CAMPAIGN_ID),
      JSON.stringify({
        productName: "Rascunho local",
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
      }),
    );

    const { result } = renderRestore({
      campaignFormat: "9:16",
      formatContractVersion: "f59-vertical-9-16-v1",
      formatUnavailable: false,
    });

    await waitFor(() => expect(result.current.fields.productName).toBe("Rascunho local"));
    expect(result.current.fields.campaignFormat).toBe("9:16");

    const body = buildCampaignGenerationBody(result.current.fields, [], STORE_ID, {
      eligible: true,
    });
    expect(body.campaignFormat).toBe("9:16");

    render(
      createElement(CampaignBriefReview, {
        fields: result.current.fields,
        preparedImages: [],
        preparing: false,
        error: null,
        eligible: true,
        campaignFormat: result.current.fields.campaignFormat,
        onBack: vi.fn(),
        onConfirm: vi.fn(),
      }),
    );
    expect(screen.getByText("Formato")).toBeInTheDocument();
    expect(screen.getByText("Vertical 9:16")).toBeInTheDocument();
  });

  it("restore 1:1 mantém 1:1 e o body fica sem a chave", async () => {
    const { result } = renderRestore({
      campaignFormat: "1:1",
      formatContractVersion: null,
      formatUnavailable: false,
    });

    await waitFor(() => expect(result.current.fields.productName).toBe("Produto F59"));
    expect(result.current.fields.campaignFormat).toBe("1:1");

    const body = buildCampaignGenerationBody(result.current.fields, [], STORE_ID, {
      eligible: true,
    });
    expect("campaignFormat" in body).toBe(false);
  });

  it("formato vertical indisponível continua 9:16 (nunca cai para 1:1)", async () => {
    const { result } = renderRestore({
      campaignFormat: "9:16",
      formatContractVersion: null,
      formatUnavailable: true,
      formatUnavailableReason: "missing_version",
    });

    await waitFor(() => expect(result.current.fields.productName).toBe("Produto F59"));
    expect(result.current.fields.campaignFormat).toBe("9:16");
  });
});
