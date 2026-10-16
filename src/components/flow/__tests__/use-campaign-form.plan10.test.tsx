// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { useCampaignForm } from "@/components/flow/use-campaign-form";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  it("grava o snapshot/imagem ENVIADOS sob B ANTES do stream (B a partir de A) e PRESERVA A", async () => {
    const A = RESTORED.campaignId;
    sessionStorage.setItem(`campaign_draft_image:${A}`, VALID_DATA_URL);
    const captured: { body?: string } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        captured.body = String(init?.body ?? "");
        // Stream SEM eventos: nada de `campaignId` chega do servidor.
        return new Response("", { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
      }),
    );

    const { result } = renderHook(() =>
      useCampaignForm("11111111-1111-4111-8111-111111111111", { eligible: true, restoredForm: RESTORED }),
    );
    await waitFor(() => expect(result.current.isValid).toBe(true));
    await act(async () => {
      await result.current.handleSubmit();
    });

    const body = JSON.parse(captured.body ?? "{}") as { campaignId?: string };
    expect(body.campaignId).toMatch(UUID_V4);
    expect(body.campaignId).not.toBe(A);
    // Persistido ANTES de qualquer evento do stream.
    expect(sessionStorage.getItem(`campaign_draft_image:${body.campaignId}`)).toBe(VALID_DATA_URL);
    // A é preservada.
    expect(sessionStorage.getItem(`campaign_draft_image:${A}`)).toBe(VALID_DATA_URL);
  });

  it("checkbox ilustrativo restaurado controla o aviso no CORPO (ligado/desligado; com/sem texto)", async () => {
    const cases = [
      { show: true, free: "Oferta exclusiva", notice: true },
      { show: false, free: "Sem aviso", notice: false },
    ];
    for (const c of cases) {
      sessionStorage.clear();
      sessionStorage.setItem(`campaign_draft_image:${RESTORED.campaignId}`, VALID_DATA_URL);
      const captured: { body?: string } = {};
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: unknown, init?: RequestInit) => {
          captured.body = String(init?.body ?? "");
          return new Response("", { status: 200 });
        }),
      );
      const restored = {
        ...RESTORED,
        showIllustrativeNotice: c.show,
        mandatoryArtworkTextFree: c.free,
      };
      const { result } = renderHook(() =>
        useCampaignForm("11111111-1111-4111-8111-111111111111", { eligible: true, restoredForm: restored }),
      );
      await waitFor(() => expect(result.current.isValid).toBe(true));
      await act(async () => {
        await result.current.handleSubmit();
      });
      const body = JSON.parse(captured.body ?? "{}") as { mandatoryArtworkText?: string };
      const text = body.mandatoryArtworkText ?? "";
      if (c.notice) {
        expect(text).toContain(ILLUSTRATIVE_NOTICE_TEXT);
        expect(text).toContain(c.free);
        // Sem DUPLICAÇÃO: o canônico aparece exatamente UMA vez.
        expect(text.split(ILLUSTRATIVE_NOTICE_TEXT).length - 1).toBe(1);
      } else {
        expect(text).not.toContain(ILLUSTRATIVE_NOTICE_TEXT);
        expect(text).toBe(c.free);
      }
    }
  });

  it("o 1º evento do stream NÃO sobrescreve o snapshot B recém-salvo (dados antigos de A permanecem em A)", async () => {
    const A = RESTORED.campaignId;
    const OLD_DRAFT = { ...DRAFT, productName: "Antigo" };
    sessionStorage.setItem(`campaign_draft:${A}`, JSON.stringify(OLD_DRAFT));
    sessionStorage.setItem(`campaign_draft_image:${A}`, VALID_DATA_URL);
    const captured: { campaignId?: string } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as { campaignId?: string };
        captured.campaignId = parsed.campaignId;
        // 1º evento do stream IDENTIFICA B — a adoção legada miraria este escopo.
        return ndjson([
          { type: "phase", phase: "orchestration", status: "running", campaignId: parsed.campaignId, operationId: "op" },
        ]);
      }),
    );

    const { result } = renderHook(() =>
      useCampaignForm("11111111-1111-4111-8111-111111111111", { eligible: true, restoredForm: RESTORED }),
    );
    await waitFor(() => expect(result.current.fields.productName).toBe("Antigo"));
    act(() => {
      result.current.setField("productName", "Novo");
    });
    await waitFor(() => expect(result.current.fields.productName).toBe("Novo"));
    await act(async () => {
      await result.current.handleSubmit();
    });

    const B = captured.campaignId ?? "";
    expect(B).toMatch(UUID_V4);
    expect(B).not.toBe(A);
    // B mantém EXATAMENTE os dados enviados (não o rascunho ANTIGO de A).
    const bDraft = JSON.parse(sessionStorage.getItem(`campaign_draft:${B}`) ?? "{}") as {
      productName?: string;
    };
    expect(bDraft.productName).toBe("Novo");
    expect(sessionStorage.getItem(`campaign_draft_image:${B}`)).toBe(VALID_DATA_URL);
    // A permanece intacta.
    const aDraft = JSON.parse(sessionStorage.getItem(`campaign_draft:${A}`) ?? "{}") as {
      productName?: string;
    };
    expect(aDraft.productName).toBe("Antigo");
    expect(sessionStorage.getItem(`campaign_draft_image:${A}`)).toBe(VALID_DATA_URL);
  });
});
