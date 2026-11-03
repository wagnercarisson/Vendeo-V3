// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

import CampaignListClient from "@/app/(app)/campanhas/client";
import type { CampaignListItem } from "@/lib/campaign/list";
import { ptBRCampaignListMessages } from "@/lib/i18n/campaign-list/catalogs/pt-BR";
import { es419CampaignListMessages } from "@/lib/i18n/campaign-list/catalogs/es-419";

function expectedLocalDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

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
  messages: ptBRCampaignListMessages,
  locale: "pt-BR" as const,
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
    expect(
      screen.getByText(expectedLocalDate(mockReadyCampaign.createdAt)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(expectedLocalDate(mockErrorCampaign.createdAt)),
    ).toBeInTheDocument();
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
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("decoding", "async");
  });

  it("aplica eager nos 3 primeiros e lazy nos demais", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      ...mockReadyCampaign,
      id: `id-${i}`,
      thumbnailUrl: `https://example.com/thumb-${i}.jpg`,
    }));

    render(
      <CampaignListClient
        items={items}
        {...baseProps}
        total={5}
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images.slice(0, 3).every((img) => img.getAttribute("loading") === "eager")).toBe(true);
    expect(images.slice(3).every((img) => img.getAttribute("loading") === "lazy")).toBe(true);
  });

  it("recupera a imagem quando thumbnailUrl muda após uma falha", () => {
    const { rerender } = render(
      <CampaignListClient
        items={[mockReadyCampaign]}
        {...baseProps}
        total={1}
      />,
    );

    fireEvent.error(screen.getByRole("img"));

    rerender(
      <CampaignListClient
        items={[
          {
            ...mockReadyCampaign,
            thumbnailUrl: "https://example.com/recovered.jpg",
          },
        ]}
        {...baseProps}
        total={1}
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/recovered.jpg");
  });

  it("troca para placeholder quando a imagem falha antes da hidratação", () => {
    const originalComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => 0 });

    try {
      render(
        <CampaignListClient
          items={[mockReadyCampaign]}
          {...baseProps}
          total={1}
        />,
      );

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Abrir" })).toBeInTheDocument();
    } finally {
      if (originalComplete) Object.defineProperty(HTMLImageElement.prototype, "complete", originalComplete);
      if (originalWidth) Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", originalWidth);
    }
  });

  it("Baixar usa o endpoint do original mesmo com miniatura nula ou falha", () => {
    const originalLocation = window.location;
    let href = "";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        get href() {
          return href;
        },
        set href(value: string) {
          href = value;
        },
      },
    });

    try {
      const { rerender } = render(
        <CampaignListClient
          items={[{ ...mockReadyCampaign, id: "id-null", thumbnailUrl: null }]}
          {...baseProps}
          total={1}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Baixar" }));
      expect(href).toBe("/api/campaign/id-null/download");

      rerender(
        <CampaignListClient
          items={[mockReadyCampaign]}
          {...baseProps}
          total={1}
        />,
      );
      fireEvent.error(screen.getByRole("img"));
      fireEvent.click(screen.getByRole("button", { name: "Baixar" }));
      expect(href).toBe("/api/campaign/id-1/download");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
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
        messages={ptBRCampaignListMessages}
        locale="pt-BR"
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

  it("expõe os nomes acessíveis pt-BR da busca, período e ordenação", () => {
    render(
      <CampaignListClient items={[]} {...baseProps} total={0} totalPages={0} />,
    );

    expect(screen.getByLabelText("Buscar campanhas")).toBeInTheDocument();
    expect(screen.getByLabelText("Período")).toBeInTheDocument();
    expect(screen.getByLabelText("Ordenar por")).toBeInTheDocument();
  });

  it("aplica lang vazio ao nome do produto e ao alt da miniatura", () => {
    render(<CampaignListClient items={[mockReadyCampaign]} {...baseProps} total={1} />);

    expect(
      screen.getByRole("heading", { name: "Produto Teste" }),
    ).toHaveAttribute("lang", "");
    expect(screen.getByRole("img")).toHaveAttribute("lang", "");
  });

  it("renderiza a listagem em es-419 preservando campanhas, status e ações", () => {
    render(
      <CampaignListClient
        items={[mockReadyCampaign, mockErrorCampaign, mockNewFlowClosedCampaign]}
        total={3}
        page={1}
        totalPages={1}
        searchParams={{}}
        messages={es419CampaignListMessages}
        locale="es-419"
      />,
    );

    expect(screen.getByText("Campañas")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar campañas...")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar campañas")).toBeInTheDocument();
    expect(screen.getByLabelText("Período")).toBeInTheDocument();
    expect(screen.getByLabelText("Ordenar por")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Listas" })).toBeInTheDocument();
    expect(screen.getAllByText("Lista").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("No completada").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Error" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Abrir" })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Descargar" })).toBeInTheDocument();
    expect(screen.getByText("Más recientes")).toBeInTheDocument();
    expect(screen.getByText("Este año")).toBeInTheDocument();
  });

  it("renderiza os estados vazios em es-419", () => {
    const { rerender } = render(
      <CampaignListClient
        items={[]}
        total={0}
        page={1}
        totalPages={0}
        searchParams={{}}
        messages={es419CampaignListMessages}
        locale="es-419"
      />,
    );

    expect(screen.getByText("Aún no hay campañas")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Crear campaña" }),
    ).toHaveAttribute("href", "/campanhas/nova");

    rerender(
      <CampaignListClient
        items={[]}
        total={0}
        page={1}
        totalPages={0}
        searchParams={{ q: "inexistente" }}
        messages={es419CampaignListMessages}
        locale="es-419"
      />,
    );

    expect(screen.getByText("No se encontraron campañas")).toBeInTheDocument();
    expect(
      screen.getByText("Intenta ajustar la búsqueda o limpiar los filtros."),
    ).toBeInTheDocument();
  });
});
