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
  it("remove SOMENTE o prefixo canônico; o TEXTO LIVRE permanece", () => {
    const restored = mapRestoredForm({
      campaignId: "22222222-2222-4222-8222-222222222222",
      inputSnapshot: {
        product: { name: "Produto", description: "" },
        commercial: {
          intent: "offer",
          legalNotice: { text: `${ILLUSTRATIVE_NOTICE_TEXT}\nOferta exclusiva` },
        },
      },
      backgroundDirection: "studio",
    });
    expect(restored?.mandatoryArtworkTextFree).toBe("Oferta exclusiva");
  });

  it("sem o prefixo ⇒ texto livre INTACTO (não mexe em texto arbitrário)", () => {
    const restored = mapRestoredForm({
      campaignId: "22222222-2222-4222-8222-222222222222",
      inputSnapshot: {
        product: { name: "Produto", description: "" },
        commercial: { intent: "offer", legalNotice: { text: "Imagem ilustrativa" } },
      },
      backgroundDirection: "studio",
    });
    expect(restored?.mandatoryArtworkTextFree).toBe("Imagem ilustrativa");
  });
});
