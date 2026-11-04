// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfferCard } from "../offer-card";
import { PUBLIC_ACCESS_COPY, PUBLIC_OFFER_COPY } from "../public-offer-copy";

/**
 * Card compartilhado. Em `/floriculturas` existe apenas uma instância, no
 * encerramento, com ID estável de âncora e foco programático. A abertura usa
 * somente o grupo de botões em modo âncora.
 */
describe("OfferCard — compacto (único card no encerramento)", () => {
  function renderOne(publicSignupEnabled: boolean) {
    return render(
      <OfferCard
        id="floriculturas-oferta"
        variant="compact"
        publicSignupEnabled={publicSignupEnabled}
        align="center"
      >
        <a href="/#acesso">Acesso</a>
      </OfferCard>,
    );
  }

  it("renderiza os textos uma única vez e um destino de âncora focável", () => {
    const { container } = renderOne(false);

    expect(container.querySelectorAll("[data-offer-card='compact']")).toHaveLength(1);
    expect(screen.getAllByText(PUBLIC_OFFER_COPY.summary)).toHaveLength(1);
    expect(screen.getAllByText(PUBLIC_OFFER_COPY.complement)).toHaveLength(1);
    expect(screen.getAllByText(PUBLIC_OFFER_COPY.detailsLabel)).toHaveLength(1);

    const card = container.querySelector("#floriculturas-oferta")!;
    expect(card).toHaveAttribute("tabindex", "-1");
    expect(card.className).toContain("scroll-mt-24");

    const ids = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("mantém o expansível acionável pelo teclado", () => {
    const { container } = renderOne(false);
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);

    fireEvent.click(screen.getByText(PUBLIC_OFFER_COPY.detailsLabel));

    expect(details.open).toBe(true);
  });

  it("exibe apoio e nota fechada apenas com o cadastro fechado", () => {
    const { unmount } = renderOne(false);
    expect(screen.getAllByText(PUBLIC_ACCESS_COPY.closedSupport)).toHaveLength(1);
    expect(screen.getAllByText(PUBLIC_OFFER_COPY.closedDetailsNote)).toHaveLength(1);
    unmount();

    renderOne(true);
    expect(screen.queryByText(PUBLIC_ACCESS_COPY.closedSupport)).toBeNull();
    expect(screen.queryByText(PUBLIC_OFFER_COPY.closedDetailsNote)).toBeNull();
  });
});

describe("OfferCard — completo", () => {
  it("usa o título e o headingId fornecidos pela home", () => {
    const { container } = render(
      <OfferCard variant="full" publicSignupEnabled={false} headingId="oferta-heading">
        <a href="#acesso">Acesso</a>
      </OfferCard>,
    );

    const heading = container.querySelector("#oferta-heading");
    expect(heading).not.toBeNull();
    expect(heading).toHaveTextContent(PUBLIC_OFFER_COPY.heading);
  });
});
