// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { useCampaignForm } from "@/components/flow/use-campaign-form";

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const DRAFT = {
  productName: "Produto Plano 10",
  description: "",
  originalPriceCents: 10000,
  discountedPriceCents: 1990,
  badge: "Promoção",
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
const CAMPAIGN_B = "44444444-4444-4444-8444-444444444444";
const OTHER = "55555555-5555-4555-8555-555555555555";
const ndjson = (events: Record<string, unknown>[]) =>
  new Response(events.map((e) => JSON.stringify(e) + "\n").join(""), {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });

/**
 * F56.2b2b — Plano 10 (Recorte 3): a INTENÇÃO/SELO hidratados do snapshot
 * server-side são tratados como seleção EXPLÍCITA — a inferência por preço NÃO os
 * sobrescreve no primeiro ciclo.
 */
const RESTORED = {
  campaignId: "22222222-2222-4222-8222-222222222222",
  productName: "Produto UAT",
  description: "",
  originalPriceCents: 0,
  discountedPriceCents: 1990,
  badge: "Promoção",
  campaignIntent: "offer" as const,
  preserveImageContext: false,
  mandatoryArtworkTextFree: "",
  imageRestoreLimited: true as const,
  backgroundDirection: "studio" as const,
  referenceSelections: [],
};

describe("F56.2b2b — Plano 10: intenção/selo hidratados preservados", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("intenção `offer` + selo `Promoção` NÃO são sobrescritos pela inferência após a hidratação", async () => {
    const { result } = renderHook(() =>
      useCampaignForm("11111111-1111-4111-8111-111111111111", {
        eligible: true,
        restoredForm: RESTORED,
      }),
    );
    await waitFor(() => expect(result.current.fields.productName).toBe("Produto UAT"));
    // Deixa os efeitos de hidratação/inferência concluírem.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.fields.campaignIntent).toBe("offer");
    expect(result.current.fields.badge).toBe("Promoção");
    expect(result.current.fields.discountedPriceCents).toBe(1990);
  });

  it("associa rascunho/imagem à IDENTIDADE ENVIADA (global→B) e PRESERVA outras campanhas", async () => {
    sessionStorage.setItem("campaign_draft", JSON.stringify(DRAFT));
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
    // Rascunho escopado de OUTRA campanha — deve permanecer intacto.
    sessionStorage.setItem(`campaign_draft_image:${OTHER}`, "OUTRA");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        ndjson([
          { type: "phase", phase: "orchestration", status: "running", campaignId: CAMPAIGN_B, operationId: "op" },
        ]),
      ),
    );

    const { result } = renderHook(() => useCampaignForm("11111111-1111-4111-8111-111111111111"));
    await waitFor(() => expect(result.current.isValid).toBe(true));
    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() =>
      expect(sessionStorage.getItem(`campaign_draft_image:${CAMPAIGN_B}`)).toBe(VALID_DATA_URL),
    );
    // O rascunho de OUTRA campanha NÃO é apagado nem sobrescrito.
    expect(sessionStorage.getItem(`campaign_draft_image:${OTHER}`)).toBe("OUTRA");
  });
});
