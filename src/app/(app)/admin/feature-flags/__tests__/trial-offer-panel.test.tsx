// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { TrialOfferPanel } from "../trial-offer-panel";

describe("F50.2 TrialOfferPanel", () => {
  it("mostra estado, marco, motivo e ações", () => {
    const html = renderToString(
      <TrialOfferPanel
        initialEnabled={false}
        initialLaunchAt={null}
      />,
    );

    expect(html).toContain("Teste gratuito de 28 dias");
    expect(html).toContain("Desligado");
    expect(html).toContain("ainda não gravado");
    expect(html).toContain("Motivo");
    expect(html).toContain("Ligar oferta");
  });

  it("mostra o marco quando já existe", () => {
    const html = renderToString(
      <TrialOfferPanel
        initialEnabled
        initialLaunchAt="2026-10-20T12:00:00.000Z"
      />,
    );

    expect(html).toContain("Ligado");
    expect(html).toContain("2026");
  });
});
