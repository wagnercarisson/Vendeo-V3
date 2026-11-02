// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

function renderCard(thumbnailUrl: string | null = "https://cdn.test/thumb.jpg") {
  return render(
    <AvailableCampaignCard
      id="c1"
      productName="Tênis Runner"
      dateLabel="19 de out. de 2026"
      thumbnailUrl={thumbnailUrl}
      openAria="Abrir campanha Tênis Runner, 19 de out. de 2026"
      openLabel="Abrir campanha"
    />,
  );
}

describe("AvailableCampaignCard", () => {
  it("renderiza a miniatura quando a URL existe", () => {
    const { container } = renderCard();

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://cdn.test/thumb.jpg");
    expect(img).toHaveAttribute("alt", "");
    expect(container.querySelector(".lucide-image-off")).toBeNull();
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
