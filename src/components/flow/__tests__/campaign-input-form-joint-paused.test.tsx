// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampaignInputForm } from "../campaign-input-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const JOINT_DRAFT = {
  productName: "Produto local",
  description: "",
  originalPriceCents: 1000,
  discountedPriceCents: undefined,
  badge: "",
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
  backgroundDirection: "studio",
  campaignFormat: "1:1+9:16",
};

vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: vi.fn(),
    restoreFormState: () => JOINT_DRAFT,
    clearFormState: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/credit/credit-cta", () => ({
  CreditCta: () => null,
}));

describe("F60.7 C2 — formulário montado pausa draft local joint com flag OFF", () => {
  it("mostra pausa e não permite revisar/confirmar", () => {
    render(
      <CampaignInputForm
        storeId="store-1"
        balance={5}
        eligible
        verticalEnabled={false}
      />,
    );
    expect(
      screen.getByText("Envio de dois formatos pausado"),
    ).toBeInTheDocument();
    expect(screen.getByText("Revisar e gerar")).toBeDisabled();
  });
});
