// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
  createServerClient: vi.fn(),
}));

import { mapRestoredForm } from "@/lib/campaign/display";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";

/**
 * F56.2b2b — Plano 10 (Recorte 3): fidelidade da restauração do AVISO ilustrativo.
 * Remove APENAS o prefixo canônico — evita DUPLICAR o aviso no reenvio.
 */
describe("F56.2b2b — Plano 10: aviso ilustrativo (round-trip sem duplicação)", () => {
  const base = (text: string) => ({
    product: { name: "Produto", description: "" },
    commercial: { intent: "offer", legalNotice: { text } },
  });

  it("canônico COMPLETO ⇒ checkbox ligado + texto livre vazio", () => {
    const restored = mapRestoredForm({
      campaignId: "22222222-2222-4222-8222-222222222222",
      inputSnapshot: base(ILLUSTRATIVE_NOTICE_TEXT),
      backgroundDirection: "studio",
    });
    expect(restored?.showIllustrativeNotice).toBe(true);
    expect(restored?.mandatoryArtworkTextFree).toBe("");
  });

  it("canônico + separador + texto ⇒ checkbox ligado + texto livre", () => {
    const restored = mapRestoredForm({
      campaignId: "22222222-2222-4222-8222-222222222222",
      inputSnapshot: base(`${ILLUSTRATIVE_NOTICE_TEXT}\nOferta exclusiva`),
      backgroundDirection: "studio",
    });
    expect(restored?.showIllustrativeNotice).toBe(true);
    expect(restored?.mandatoryArtworkTextFree).toBe("Oferta exclusiva");
  });

  it("texto ARBITRÁRIO (mesmo começando igual, sem separador) ⇒ checkbox DESLIGADO + texto ÍNTEGRO", () => {
    for (const text of ["Imagem ilustrativa", `${ILLUSTRATIVE_NOTICE_TEXT}X`, `x ${ILLUSTRATIVE_NOTICE_TEXT}`]) {
      const restored = mapRestoredForm({
        campaignId: "22222222-2222-4222-8222-222222222222",
        inputSnapshot: base(text),
        backgroundDirection: "studio",
      });
      expect(restored?.showIllustrativeNotice).toBe(false);
      expect(restored?.mandatoryArtworkTextFree).toBe(text);
    }
  });
});
