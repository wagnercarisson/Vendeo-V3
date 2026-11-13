// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CampaignCard } from "../client";
import type { CampaignListItem } from "@/lib/campaign/list";
import { ptBRCampaignListMessages } from "@/lib/i18n/campaign-list/catalogs/pt-BR";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const THUMBNAIL_URL =
  "https://cdn.example.test/storage/v1/object/sign/campaign-images/vertical.thumb-v1.webp";

function campaign(overrides: Partial<CampaignListItem> = {}): CampaignListItem {
  return {
    id: CAMPAIGN,
    productName: "Cafeteira",
    status: "ready",
    createdAt: "2026-11-13T10:00:00.000Z",
    thumbnailUrl: THUMBNAIL_URL,
    storagePath: `store/${CAMPAIGN}/op/vertical.jpg`,
    flow: "new",
    format: "9:16",
    ...overrides,
  };
}

function renderCard(item: CampaignListItem) {
  return render(
    <CampaignCard
      campaign={item}
      index={0}
      messages={ptBRCampaignListMessages}
      locale="pt-BR"
    />,
  );
}

afterEach(() => cleanup());

describe("listagem — card do consumidor (miniatura × placeholder)", () => {
  it("renderiza a MINIATURA derivada assinada quando ela existe", () => {
    renderCard(campaign());

    const image = screen.getByRole("img", { name: "Cafeteira" });
    expect(image).toHaveAttribute("src", THUMBNAIL_URL);
    expect(image.getAttribute("src")).toContain("vertical.thumb-v1.webp");
    expect(image.getAttribute("src")).not.toContain("vertical.jpg");
  });

  it("sem miniatura mostra placeholder e nunca cai para o original", () => {
    const { container } = renderCard(campaign({ thumbnailUrl: null }));

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.innerHTML).not.toContain("vertical.jpg");
    expect(container.innerHTML).not.toContain("thumbnail");
  });

  it("falha de carregamento da miniatura vira placeholder, sem fallback ao original", () => {
    const { container } = renderCard(campaign());

    fireEvent.error(screen.getByRole("img", { name: "Cafeteira" }));

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.innerHTML).not.toContain("vertical.jpg");
  });

  it("campanha 9:16 entregue exibe miniatura e formato vertical", () => {
    renderCard(campaign());

    expect(screen.getByText("9:16 vertical")).toBeInTheDocument();
    expect(screen.getByText("Pronta")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cafeteira" })).toBeInTheDocument();
  });
});
