// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import CampaignPageClient from "@/app/campanha/[id]/client";

const defaultProps = {
  imageUrl: "https://example.com/image.jpg",
  caption: "Caption original",
  hashtags: ["#promocao", "#oferta"],
  ctaPost: "Compre agora",
  displayStatus: "ready" as const,
  productName: "Produto Teste",
  createdAt: "2026-07-10T12:00:00Z",
  updatedAt: "2026-07-10T12:00:00Z",
  downloadUrl: "/api/campaign/id-1/download",
  campaignId: "550e8400-e29b-41d4-a716-446655440000",
  isPublicationCopyEdited: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset fetch mock
  vi.restoreAllMocks();
});

describe("CampaignPageClient — Kit de Publicação", () => {
  it("renders publication copy in view mode", () => {
    render(<CampaignPageClient {...defaultProps} />);

    expect(screen.getByText("Kit de Publicação")).toBeInTheDocument();
    expect(screen.getByText("Caption original")).toBeInTheDocument();
    expect(screen.getByText("#promocao")).toBeInTheDocument();
    expect(screen.getByText("#oferta")).toBeInTheDocument();
    expect(screen.getByText("Compre agora")).toBeInTheDocument();
  });

  it("shows badge when isPublicationCopyEdited is true", () => {
    render(<CampaignPageClient {...defaultProps} isPublicationCopyEdited={true} />);

    expect(screen.getByText("Editado")).toBeInTheDocument();
  });

  it("hides badge when isPublicationCopyEdited is false", () => {
    render(<CampaignPageClient {...defaultProps} isPublicationCopyEdited={false} />);

    expect(screen.queryByText("Editado")).not.toBeInTheDocument();
  });

  it("enters edit mode on Edit button click", () => {
    render(<CampaignPageClient {...defaultProps} />);

    const editButton = screen.getByText("✏️ Editar");
    fireEvent.click(editButton);

    // Textarea should appear for caption
    expect(screen.getByDisplayValue("Caption original")).toBeInTheDocument();
    // Input for cta
    expect(screen.getByDisplayValue("Compre agora")).toBeInTheDocument();
    // Buttons should show
    expect(screen.getByText("💾 Salvar")).toBeInTheDocument();
    expect(screen.getByText("↩️ Restaurar original")).toBeInTheDocument();
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
  });

  it("sends PATCH with campaignId on Save", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        publication_copy_current: {
          caption: "Caption editado",
          hashtags: ["#novo"],
          cta_post: "Compre já",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<CampaignPageClient {...defaultProps} />);

    // Enter edit mode
    fireEvent.click(screen.getByText("✏️ Editar"));

    // Modify caption
    const captionInput = screen.getByDisplayValue("Caption original");
    fireEvent.change(captionInput, { target: { value: "Caption editado" } });

    // Click Save
    fireEvent.click(screen.getByText("💾 Salvar"));

    // Wait for the async save to process
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toBe(
      "/api/campaign/550e8400-e29b-41d4-a716-446655440000/publication-copy",
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.caption).toBe("Caption editado");

    vi.unstubAllGlobals();
  });

  it("sends PATCH restore on Restore button", async () => {
    // Mock confirm to return true
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        restored: true,
        publication_copy_snapshot: {
          caption: "Original da IA",
          hashtags: ["#ia"],
          cta_post: "Compre original",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<CampaignPageClient {...defaultProps} />);

    // Enter edit mode first
    fireEvent.click(screen.getByText("✏️ Editar"));

    // Click Restore
    const restoreButton = screen.getByText("↩️ Restaurar original");
    fireEvent.click(restoreButton);

    // Wait for the async restore to process
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody).toEqual({ restore: true });

    window.confirm = originalConfirm;
    vi.unstubAllGlobals();
  });

  it("cancels edit without changes", () => {
    render(<CampaignPageClient {...defaultProps} />);

    // Enter edit mode
    fireEvent.click(screen.getByText("✏️ Editar"));
    expect(screen.getByDisplayValue("Caption original")).toBeInTheDocument();

    // Modify something
    const captionInput = screen.getByDisplayValue("Caption original");
    fireEvent.change(captionInput, { target: { value: "Texto alterado" } });

    // Cancel
    fireEvent.click(screen.getByText("Cancelar"));

    // Should be back in view mode with original values
    expect(screen.getByText("Caption original")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Texto alterado")).not.toBeInTheDocument();
  });

  it("disables buttons during saving", async () => {
    // Fetch that never resolves during test
    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", mockFetch);

    render(<CampaignPageClient {...defaultProps} />);

    // Enter edit mode
    fireEvent.click(screen.getByText("✏️ Editar"));

    // Click Save
    fireEvent.click(screen.getByText("💾 Salvar"));

    // Should show loading text and disabled buttons
    expect(screen.getByText("Salvando...")).toBeInTheDocument();
    expect(screen.getByText("Salvando...")).toBeDisabled();
    expect(screen.getByText("↩️ Restaurar original")).toBeDisabled();
    expect(screen.getByText("Cancelar")).toBeDisabled();

    vi.unstubAllGlobals();
  });

  it("shows error on save failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Erro ao salvar" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<CampaignPageClient {...defaultProps} />);

    // Enter edit mode
    fireEvent.click(screen.getByText("✏️ Editar"));

    // Click Save
    fireEvent.click(screen.getByText("💾 Salvar"));

    // Wait for error to appear
    await vi.waitFor(() => {
      expect(screen.getByText("Erro ao salvar")).toBeInTheDocument();
    });

    // Edit mode should be maintained
    expect(screen.getByText("💾 Salvar")).toBeInTheDocument();
    expect(screen.getByText("↩️ Restaurar original")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
