// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

import CampaignListClient from "@/app/(app)/campanhas/client";
import type { CampaignListItem } from "@/lib/campaign/list";

const mockReadyCampaign: CampaignListItem = {
  id: "id-1",
  productName: "Produto Teste",
  status: "ready",
  createdAt: "2026-07-10T12:00:00Z",
  thumbnailUrl: "https://example.com/thumb.jpg",
  storagePath: "store-123/id-1.jpg",
  flow: "legacy",
};

const mockErrorCampaign: CampaignListItem = {
  id: "id-2",
  productName: "Produto com Erro",
  status: "error",
  createdAt: "2026-07-09T12:00:00Z",
  thumbnailUrl: null,
  storagePath: "store-123/id-2.jpg",
  flow: "legacy",
};

const mockNewFlowClosedCampaign: CampaignListItem = {
  id: "id-3",
  productName: "Produto Encerrado",
  status: "error",
  createdAt: "2026-07-08T12:00:00Z",
  thumbnailUrl: null,
  storagePath: "store-123/id-3.jpg",
  flow: "new",
};

const baseProps = {
  total: 2,
  page: 1,
  totalPages: 1,
  searchParams: {},
};

describe("CampaignListClient — display", () => {
  it("renders list of campaign cards", () => {
    render(
      <CampaignListClient
        items={[mockReadyCampaign, mockErrorCampaign]}
        {...baseProps}
      />,
    );

    expect(screen.getByText("Produto Teste")).toBeInTheDocument();
    expect(screen.getByText("Produto com Erro")).toBeInTheDocument();
    expect(screen.getByText("10/07/2026")).toBeInTheDocument();
    expect(screen.getByText("09/07/2026")).toBeInTheDocument();
  });

  it("shows Baixar button only for ready campaigns", () => {
    render(
      <CampaignListClient
        items={[mockReadyCampaign, mockErrorCampaign]}
        {...baseProps}
      />,
    );

    const downloadButtons = screen.getAllByRole("button", { name: "Baixar" });
    expect(downloadButtons).toHaveLength(1);
  });

  it("shows Abrir button for all campaigns", () => {
    render(
      <CampaignListClient
        items={[mockReadyCampaign, mockErrorCampaign]}
        {...baseProps}
      />,
    );

    const openButtons = screen.getAllByRole("button", { name: "Abrir" });
    expect(openButtons).toHaveLength(2);
  });

  it("shows placeholder when thumbnailUrl is null", () => {
    render(
      <CampaignListClient
        items={[mockErrorCampaign]}
        {...baseProps}
        total={1}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders image when thumbnailUrl is provided", () => {
    render(
      <CampaignListClient
        items={[mockReadyCampaign]}
        {...baseProps}
        total={1}
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/thumb.jpg");
    expect(img).toHaveAttribute("alt", "Produto Teste");
  });

  it("shows status text Pronta for ready", () => {
    render(
      <CampaignListClient
        items={[mockReadyCampaign]}
        {...baseProps}
        total={1}
      />,
    );

    const prontaElements = screen.getAllByText("Pronta");
    expect(prontaElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows status text Erro for error", () => {
    render(
      <CampaignListClient
        items={[mockErrorCampaign]}
        {...baseProps}
        total={1}
      />,
    );

    const erroElements = screen.getAllByText("Erro");
    expect(erroElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows neutral label 'Não concluída' for new-flow closed campaign (not 'Erro')", () => {
    render(
      <CampaignListClient
        items={[mockNewFlowClosedCampaign]}
        {...baseProps}
        total={1}
      />,
    );

    expect(screen.getAllByText("Não concluída").length).toBeGreaterThanOrEqual(1);
    // O rótulo da CAMPANHA não é "Erro" (o chip de filtro "Erro" é um botão legítimo).
    const cardErro = screen
      .queryAllByText("Erro")
      .filter((el) => el.tagName === "SPAN");
    expect(cardErro).toHaveLength(0);
  });

  it("renders empty state when no campaigns", () => {
    render(
      <CampaignListClient
        items={[]}
        total={0}
        page={1}
        totalPages={0}
        searchParams={{}}
      />,
    );

    expect(screen.getByText("Nenhuma campanha ainda")).toBeInTheDocument();
    expect(
      screen.getByText("Crie sua primeira campanha e comece a divulgar seus produtos."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Criar campanha" }),
    ).toHaveAttribute("href", "/campanhas/nova");
  });
});
