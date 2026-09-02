// @vitest-environment jsdom
// F37.1 (tasks.md 17.1-17.5): testes da UI de revisão da candidata.
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CampaignApprovalView from "@/components/campaign/campaign-approval-view";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const props = {
  campaignId: "c1",
  versionId: "v1",
  imageUrl: "https://preview.example.com/art.jpg",
  productName: "Produto X",
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("CampaignApprovalView (F37.1)", () => {
  it("17.1 — a revisão NÃO renderiza entrega/copy (kit oculto até aprovar)", () => {
    render(<CampaignApprovalView {...props} />);

    expect(screen.queryByText("Kit de Publicação")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /baixar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copiar/i })).not.toBeInTheDocument();
  });

  it("17.2 — aprovar chama POST /api/campaign/c1/approve com { versionId: 'v1' } e router.refresh", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "approved" }),
    });

    render(<CampaignApprovalView {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /aprovar e liberar campanha/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaign/c1/approve",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId: "v1" }),
        }),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("17.3 — mostra apenas a imagem da candidata (alt=productName); zero seletores de versão", () => {
    render(<CampaignApprovalView {...props} />);

    expect(screen.getByRole("img")).toHaveAttribute("alt", "Produto X");
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://preview.example.com/art.jpg",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/versão/i)).not.toBeInTheDocument();
  });

  it("17.4 — a revisão usa a imageUrl da prop (candidata ativa)", () => {
    render(<CampaignApprovalView {...props} />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://preview.example.com/art.jpg",
    );
  });

  it("17.5 — botão 'Corrigir' ausente; nenhum dialog abre em qualquer interação", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "approved" }),
    });

    render(<CampaignApprovalView {...props} />);

    expect(screen.queryByRole("button", { name: /corrigir/i })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    // interação no botão de aprovar não abre nenhum dialog
    fireEvent.click(screen.getByRole("button", { name: /aprovar e liberar campanha/i }));
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
