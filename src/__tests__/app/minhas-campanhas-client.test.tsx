// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import MyCampaignsClient from "@/app/minhas-campanhas/client";
import type { CampaignListItem } from "@/lib/campaign/list";

const mockReadyCampaign: CampaignListItem = {
  id: "id-1",
  productName: "Produto Teste",
  status: "ready",
  createdAt: "2026-07-10T12:00:00Z",
  thumbnailUrl: "https://example.com/thumb.jpg",
  storagePath: "store-123/id-1.jpg",
};

const mockErrorCampaign: CampaignListItem = {
  id: "id-2",
  productName: "Produto com Erro",
  status: "error",
  createdAt: "2026-07-09T12:00:00Z",
  thumbnailUrl: null,
  storagePath: "store-123/id-2.jpg",
};

describe("MyCampaignsClient — display", () => {
  it("renders list of campaign cards", () => {
    render(<MyCampaignsClient campaigns={[mockReadyCampaign, mockErrorCampaign]} />);

    expect(screen.getByText("Produto Teste")).toBeInTheDocument();
    expect(screen.getByText("Produto com Erro")).toBeInTheDocument();
    expect(screen.getByText("10/07/2026")).toBeInTheDocument();
    expect(screen.getByText("09/07/2026")).toBeInTheDocument();
  });

  it("shows Baixar link only for ready campaigns", () => {
    render(<MyCampaignsClient campaigns={[mockReadyCampaign, mockErrorCampaign]} />);

    const downloadLinks = screen.getAllByRole("link", { name: "Baixar" });
    expect(downloadLinks).toHaveLength(1);
    expect(downloadLinks[0]).toHaveAttribute(
      "href",
      "/api/campaign/id-1/download",
    );
  });

  it("shows Abrir link for all campaigns", () => {
    render(<MyCampaignsClient campaigns={[mockReadyCampaign, mockErrorCampaign]} />);

    const openLinks = screen.getAllByRole("link", { name: "Abrir" });
    expect(openLinks).toHaveLength(2);
    expect(openLinks[0]).toHaveAttribute("href", "/campanha/id-1");
    expect(openLinks[1]).toHaveAttribute("href", "/campanha/id-2");
  });

  it("shows placeholder when thumbnailUrl is null", () => {
    render(<MyCampaignsClient campaigns={[mockErrorCampaign]} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector(".campaign-card__placeholder")).toBeInTheDocument();
  });

  it("renders image when thumbnailUrl is provided", () => {
    render(<MyCampaignsClient campaigns={[mockReadyCampaign]} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/thumb.jpg");
    expect(img).toHaveAttribute("alt", "Produto Teste");
  });

  it("shows status text Pronta for ready", () => {
    render(<MyCampaignsClient campaigns={[mockReadyCampaign]} />);

    expect(screen.getByText("Pronta")).toBeInTheDocument();
  });

  it("shows status text Erro for error", () => {
    render(<MyCampaignsClient campaigns={[mockErrorCampaign]} />);

    expect(screen.getByText("Erro")).toBeInTheDocument();
  });

  it("renders empty state when no campaigns", () => {
    render(<MyCampaignsClient campaigns={[]} />);

    expect(screen.getByText("Nenhuma campanha encontrada")).toBeInTheDocument();
    expect(
      screen.getByText("Suas campanhas aparecerão aqui depois de geradas."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Criar Primeira Campanha" }),
    ).toHaveAttribute("href", "/");
  });
});
