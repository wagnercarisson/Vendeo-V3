// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CampaignImageUpload } from "../campaign-image-upload";
import type { CampaignProductFormImage } from "../use-campaign-form";

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function createItem(
  overrides: Partial<CampaignProductFormImage> = {}
): CampaignProductFormImage {
  return {
    id: "img-x",
    role: "reference",
    source: "upload",
    mimeType: "image/png",
    dataUrl: VALID_DATA_URL,
    ...overrides,
  };
}

describe("CampaignImageUpload — preview sem recorte (Q1Y)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom 29 não implementa URL.createObjectURL de forma confiável — safety
    // net para o cenário com item.file (não usado aqui, mas protege regressão).
    vi.stubGlobal("URL.createObjectURL", vi.fn(() => "blob:mock"));
    vi.stubGlobal("URL.revokeObjectURL", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preview usa object-contain e não object-cover", () => {
    const img1 = createItem({ id: "img-1", role: "primary", source: "upload" });
    const img2 = createItem({ id: "img-2", role: "reference", source: "camera" });
    const { container } = render(
      <CampaignImageUpload
        productImages={[img1, img2]}
        error={null}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
    for (const img of imgs) {
      expect(img.className).toContain("object-contain");
      expect(img.className).not.toContain("object-cover");
    }
    expect(container.querySelector(".object-cover")).toBeNull();
  });

  it("badge Principal renderiza no preview", () => {
    const img1 = createItem({ id: "img-1", role: "primary", source: "upload" });
    const img2 = createItem({ id: "img-2", role: "reference", source: "camera" });
    const { container } = render(
      <CampaignImageUpload
        productImages={[img1, img2]}
        error={null}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const preview = container.querySelector<HTMLElement>(".grid.grid-cols-3");
    expect(preview).not.toBeNull();
    expect(within(preview!).getByText("Principal")).toBeInTheDocument();
  });

  it("badge Câmera renderiza no preview", () => {
    const img1 = createItem({ id: "img-1", role: "primary", source: "upload" });
    const img2 = createItem({ id: "img-2", role: "reference", source: "camera" });
    const { container } = render(
      <CampaignImageUpload
        productImages={[img1, img2]}
        error={null}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    // within(preview) obrigatório — o botão "Câmera" da área de ações também
    // casa com screen.getByText("Câmera"), tornando o lookup global ambíguo.
    const preview = container.querySelector<HTMLElement>(".grid.grid-cols-3");
    expect(preview).not.toBeNull();
    expect(within(preview!).getByText("Câmera")).toBeInTheDocument();
  });

  it("botão Remover por item e onRemove(id)", () => {
    const img1 = createItem({ id: "img-1", role: "primary", source: "upload" });
    const img2 = createItem({ id: "img-2", role: "reference", source: "camera" });
    const onRemoveSpy = vi.fn();
    const { container } = render(
      <CampaignImageUpload
        productImages={[img1, img2]}
        error={null}
        onAdd={vi.fn()}
        onRemove={onRemoveSpy}
      />
    );

    const preview = container.querySelector<HTMLElement>(".grid.grid-cols-3");
    expect(preview).not.toBeNull();
    const removeButtons = within(preview!).getAllByRole("button", {
      name: "Remover",
    });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]);
    expect(onRemoveSpy).toHaveBeenCalledTimes(1);
    expect(onRemoveSpy).toHaveBeenCalledWith("img-1");
  });
});

describe("CampaignImageUpload — contrato preservado (Q1Y)", () => {
  it("smoke: estado vazio + erro renderizam com contrato de props inalterado", () => {
    render(
      <CampaignImageUpload
        productImages={[]}
        error="Erro teste"
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText("Erro teste")).toBeInTheDocument();
  });
});