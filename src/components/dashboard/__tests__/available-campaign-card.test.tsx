// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

import {
  buildIndividualFormatPresentation,
  buildJointFormatPresentation,
  buildUnavailableFormatPresentation,
  buildUnknownFormatPresentation,
  type CampaignFormatPresentation,
} from "@/lib/campaign/format-presentation";
import { ptBRCampaignFormatMessages } from "@/lib/i18n/campaign-formats/catalogs/pt-BR";
import { es419CampaignFormatMessages } from "@/lib/i18n/campaign-formats/catalogs/es-419";

import { AvailableCampaignCard } from "../available-campaign-card";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const SQUARE_DELIVERED = buildIndividualFormatPresentation({
  resolution: { kind: "1:1", source: "absent" },
  lifecycle: "delivered",
});

const VERTICAL_DELIVERED = buildIndividualFormatPresentation({
  resolution: { kind: "9:16", contractVersion: "f59-vertical-9-16-v1" },
  lifecycle: "delivered",
});

function renderCard(
  thumbnailUrl: string | null = "https://cdn.test/thumb.jpg",
  presentation: CampaignFormatPresentation = SQUARE_DELIVERED,
) {
  return render(
    <AvailableCampaignCard
      id="c1"
      productName="Tênis Runner"
      dateLabel="19 de out. de 2026"
      formatPresentation={presentation}
      messages={ptBRCampaignFormatMessages}
      thumbnailUrl={thumbnailUrl}
      openAria="Abrir campanha Tênis Runner, 19 de out. de 2026"
      openLabel="Abrir campanha"
    />,
  );
}

function formatGroup(): HTMLElement {
  return screen.getByRole("list", { name: "Formatos da campanha" });
}

describe("AvailableCampaignCard", () => {
  it("renderiza a miniatura quando a URL existe", () => {
    const { container } = renderCard();

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://cdn.test/thumb.jpg");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("decoding", "async");
    expect(container.querySelector(".lucide-image-off")).toBeNull();
  });

  it("recupera a imagem quando thumbnailUrl muda após uma falha", () => {
    const { container, rerender } = renderCard("https://cdn.test/broken.jpg");

    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".lucide-image-off")).not.toBeNull();

    rerender(
      <AvailableCampaignCard
        id="c1"
        productName="Tênis Runner"
        dateLabel="19 de out. de 2026"
        formatPresentation={SQUARE_DELIVERED}
        messages={ptBRCampaignFormatMessages}
        thumbnailUrl="https://cdn.test/recovered.jpg"
        openAria="Abrir campanha Tênis Runner, 19 de out. de 2026"
        openLabel="Abrir campanha"
      />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://cdn.test/recovered.jpg");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/campanhas/c1");
  });

  it("troca para o fallback quando a imagem falha, preservando o link", () => {
    const { container } = renderCard();
    const img = container.querySelector("img")!;

    fireEvent.error(img);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".lucide-image-off")).not.toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/campanhas/c1");
  });

  it("usa o fallback quando thumbnailUrl é nulo e mantém o link", () => {
    const { container } = renderCard(null);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".lucide-image-off")).not.toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/campanhas/c1");
  });

  it('aplica lang="" apenas no nome do produto', () => {
    renderCard();

    expect(screen.getByText("Tênis Runner")).toHaveAttribute("lang", "");
    expect(screen.getByText("19 de out. de 2026")).not.toHaveAttribute("lang");
    expect(screen.getByText("Quadrado 1:1")).not.toHaveAttribute("lang");
    expect(
      screen.getByRole("group", { name: "Quadrado 1:1: Disponível" }),
    ).not.toHaveAttribute("lang");
  });

  it("expõe nome acessível e alvo de foco no link do cartão", () => {
    renderCard();

    const link = screen.getByRole("link", {
      name: "Abrir campanha Tênis Runner, 19 de out. de 2026",
    });

    expect(link.className).toContain("focus-visible:ring-2");
    expect(link.className).toContain("focus-visible:ring-offset-2");
    expect(link.className).toContain("items-center");
    expect(link.className).toContain("min-h-[44px]");
  });
});

  it("aplica fallback quando a imagem já falhou antes da hidratação", () => {
    const originalComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => 0 });

    try {
      const { container } = renderCard();
      expect(container.querySelector(".lucide-image-off")).not.toBeNull();
      expect(screen.getByRole("link")).toHaveAttribute("href", "/campanhas/c1");
    } finally {
      if (originalComplete) Object.defineProperty(HTMLImageElement.prototype, "complete", originalComplete);
      if (originalWidth) Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", originalWidth);
    }
  });

describe("F61 — chips de formato no card do dashboard", () => {
  it("individual pronta exibe o formato entregue e o outro como não incluído", () => {
    renderCard();

    const group = formatGroup();
    expect(within(group).getAllByRole("listitem")).toHaveLength(2);
    expect(within(group).getByText("Quadrado 1:1")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Quadrado 1:1: Disponível" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Vertical 9:16: Não incluído" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Disponível")).toBeNull();
    expect(screen.queryByText("Não incluído")).toBeNull();
  });

  it("individual 9:16 pronta não é apresentada como parcial", () => {
    renderCard(null, VERTICAL_DELIVERED);

    const group = formatGroup();
    expect(within(group).getByText("Vertical 9:16")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Vertical 9:16: Disponível" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Quadrado 1:1: Não incluído" }),
    ).toBeInTheDocument();
    // Campanha individual não tem indicador de entrega parcial no chip.
    expect(screen.queryByText("Não entregue")).toBeNull();
  });

  it("legado quadrado mostra os dois chips", () => {
    renderCard(null, SQUARE_DELIVERED);

    const group = formatGroup();
    expect(within(group).getByText("Quadrado 1:1")).toBeInTheDocument();
    expect(within(group).getByText("Vertical 9:16")).toBeInTheDocument();
  });

  it("conjunta completa mostra os dois formatos disponíveis", () => {
    render(
      <AvailableCampaignCard
        id="c1"
        productName="Tênis Runner"
        dateLabel="19 de out. de 2026"
        formatPresentation={buildJointFormatPresentation({
          "1:1": { state: "delivered", refunded: false },
          "9:16": { state: "delivered", refunded: false },
        })}
        messages={ptBRCampaignFormatMessages}
        thumbnailUrl={null}
        openAria="Abrir campanha Tênis Runner, 19 de out. de 2026"
        openLabel="Abrir campanha"
        openHref="/campanhas/c1?format=1:1"
      />,
    );

    const group = formatGroup();
    expect(group.querySelectorAll("li")).toHaveLength(2);
    expect(
      screen.getAllByRole("group", { name: /Disponível$/ }),
    ).toHaveLength(2);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/campanhas/c1?format=1:1",
    );
    // Sem miniatura do preferido ⇒ placeholder, nunca original.
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector(".lucide-image-off")).not.toBeNull();
  });

  it("conjunta parcial estornada mantém o estorno visível e a abertura disponível", () => {
    render(
      <AvailableCampaignCard
        id="c1"
        productName="Tênis Runner"
        dateLabel="19 de out. de 2026"
        formatPresentation={buildJointFormatPresentation({
          "1:1": { state: "delivered", refunded: false },
          "9:16": { state: "absent", refunded: true },
        })}
        messages={ptBRCampaignFormatMessages}
        thumbnailUrl="https://cdn.test/thumb.jpg"
        openAria="Abrir campanha Tênis Runner, 19 de out. de 2026"
        openLabel="Abrir campanha"
        openHref="/campanhas/c1?format=1:1"
      />,
    );

    expect(
      screen.getByRole("group", { name: /Disponível$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /Crédito devolvido$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/campanhas/c1?format=1:1",
    );
  });

  it("unknown e unavailable nunca exibem 'Não gerado'", () => {
    const { rerender } = renderCard(null, buildUnknownFormatPresentation());

    expect(
      screen.getAllByRole("group", { name: /Não foi possível confirmar$/ }),
    ).toHaveLength(2);
    expect(screen.queryByText("Não gerado")).toBeNull();

    rerender(
      <AvailableCampaignCard
        id="c1"
        productName="Tênis Runner"
        dateLabel="19 de out. de 2026"
        formatPresentation={buildUnavailableFormatPresentation()}
        messages={ptBRCampaignFormatMessages}
        thumbnailUrl={null}
        openAria="Abrir campanha Tênis Runner, 19 de out. de 2026"
        openLabel="Abrir campanha"
      />,
    );

    expect(
      screen.getAllByRole("group", { name: /Indisponível$/ }),
    ).toHaveLength(2);
    expect(screen.queryByText("Não gerado")).toBeNull();
  });

  it("chips não são links e não navegam; 'Abrir campanha' permanece", () => {
    renderCard(null);

    const group = formatGroup();
    expect(within(group).queryAllByRole("link")).toHaveLength(0);
    expect(group.querySelectorAll("a")).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Abrir campanha/ })).toHaveAttribute(
      "href",
      "/campanhas/c1",
    );
  });

  it("aplica layout responsivo nos chips", () => {
    renderCard();

    const group = formatGroup();
    expect(group.className).toContain("flex-wrap");
    expect(group.className).toContain("min-w-0");
  });

  it("F61 — ajuda flutuante herda helpLang es-419 e preserva a abertura", () => {
    render(
      <AvailableCampaignCard
        id="c1"
        productName="Tênis Runner"
        dateLabel="19 de out. de 2026"
        formatPresentation={SQUARE_DELIVERED}
        messages={es419CampaignFormatMessages}
        helpLang="es-419"
        thumbnailUrl={null}
        openAria="Abrir campanha Tênis Runner"
        openLabel="Abrir campanha"
      />,
    );

    const group = screen.getByRole("group", { name: /^Cuadrado 1:1/ });
    fireEvent.click(within(group).getByRole("button"));

    const note = screen.getByRole("note");
    expect(note).toHaveAttribute("lang", "es-419");
    expect(note.parentElement).toBe(document.body);
    expect(within(group).queryByRole("note")).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir campanha/ })).toHaveAttribute(
      "href",
      "/campanhas/c1",
    );
  });
});
