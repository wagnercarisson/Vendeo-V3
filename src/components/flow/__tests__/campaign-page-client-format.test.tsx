// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCampaignInputForm } = vi.hoisted(() => ({
  mockCampaignInputForm: vi.fn(() => null),
}));

vi.mock("@/components/flow/campaign-input-form", () => ({
  CampaignInputForm: mockCampaignInputForm,
}));

vi.mock("@/components/flow/store-identity-block", () => ({
  StoreIdentityBlock: () => null,
}));

import { CampaignPageClient } from "../campaign-page-client";

const STORE = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Loja F59",
  segment: "outros",
  brand_color: "#000000",
} as never;

function lastProps() {
  return (
    (mockCampaignInputForm.mock.calls as unknown as [[Record<string, unknown>]]).at(
      -1,
    )?.[0] ?? {}
  );
}

describe("CampaignPageClient — cadeia de props do formato (F59)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults `false` quando as props não são fornecidas", () => {
    render(<CampaignPageClient store={STORE} balance={10} />);
    expect(lastProps().verticalEnabled).toBe(false);
    expect(lastProps().campaignFormatPaused).toBe(false);
    expect(lastProps().campaignFormatUnavailable).toBe(false);
  });

  it("repassa `verticalEnabled` e `campaignFormatPaused` ao formulário", () => {
    render(
      <CampaignPageClient
        store={STORE}
        balance={10}
        eligible
        verticalEnabled
        campaignFormatPaused
      />,
    );
    expect(lastProps()).toMatchObject({
      eligible: true,
      verticalEnabled: true,
      campaignFormatPaused: true,
    });
  });

  it("repassa `campaignFormatUnavailable` separadamente da pausa vertical", () => {
    render(
      <CampaignPageClient
        store={STORE}
        balance={10}
        eligible
        campaignFormatPaused
        campaignFormatUnavailable
      />,
    );
    expect(lastProps()).toMatchObject({
      campaignFormatPaused: true,
      campaignFormatUnavailable: true,
    });
  });
});
