// @vitest-environment node
/**
 * F61 (61-04) — prova SSR do componente de chips.
 *
 * Em ambiente de servidor NÃO existe `document`. O componente só cria o portal
 * da ajuda depois do mount (`useEffect`); portanto `renderToString` deve
 * renderizar os chips e NUNCA acessar `document` nem produzir o popover.
 */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { CampaignFormatChips } from "../campaign-format-chips";
import { buildJointFormatPresentation } from "@/lib/campaign/format-presentation";
import { es419CampaignFormatMessages } from "@/lib/i18n/campaign-formats/catalogs/es-419";
import { ptBRCampaignFormatMessages } from "@/lib/i18n/campaign-formats/catalogs/pt-BR";

const PRESENTATION = buildJointFormatPresentation(
  {
    "1:1": { state: "delivered", refunded: false },
    "9:16": { state: "absent", refunded: true },
  },
  "1:1",
);

describe("F61 — chips em renderToString (SSR)", () => {
  it("não acessa document no servidor e não monta o portal", () => {
    expect(typeof document).toBe("undefined");

    const html = renderToString(
      <CampaignFormatChips
        presentation={PRESENTATION}
        messages={ptBRCampaignFormatMessages}
        helpLang="pt-BR"
      />,
    );

    expect(html).toContain("Quadrado 1:1");
    expect(html).toContain("Vertical 9:16");
    expect(html).toContain('aria-label="Quadrado 1:1: Disponível, Selecionado"');
    expect(html).toContain('aria-label="Vertical 9:16: Crédito devolvido"');
    expect(html).toContain("hidden");
    // Sem portal no servidor: nenhuma camada flutuante/`position: fixed`.
    expect(html).not.toContain('role="note"');
    expect(html).not.toContain("z-50");
    expect(html).not.toContain("position:fixed");
  });

  it("preserva o catálogo es-419 sem criar portal", () => {
    const html = renderToString(
      <CampaignFormatChips
        presentation={PRESENTATION}
        messages={es419CampaignFormatMessages}
        helpLang="es-419"
      />,
    );

    expect(html).toContain('aria-label="Formatos de la campaña"');
    expect(html).toContain("Cuadrado 1:1");
    expect(html).toContain('aria-label="Cuadrado 1:1: Disponible, Seleccionado"');
    expect(html).not.toContain('role="note"');
  });
});
