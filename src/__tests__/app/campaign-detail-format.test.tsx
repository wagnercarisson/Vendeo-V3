// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import CampaignPageClient from "@/app/(app)/campanhas/[id]/client";
import { buildIndividualFormatPresentation } from "@/lib/campaign/format-presentation";
import { ptBRCampaignDetailMessages } from "@/lib/i18n/campaign-detail";

const VERTICAL_DELIVERED = buildIndividualFormatPresentation(
  {
    resolution: { kind: "9:16", contractVersion: "f59-vertical-9-16-v1" },
    lifecycle: "delivered",
  },
  "9:16",
);

const BASE_PROPS = {
  imageUrl: "https://example.com/art.jpg",
  caption: "Legenda",
  hashtags: ["#tag"],
  ctaPost: "Compre agora",
  displayStatus: "ready" as const,
  productName: "Produto F59",
  createdAt: "2026-11-04T12:00:00Z",
  updatedAt: "2026-11-04T12:00:00Z",
  downloadUrl: "/api/campaign/550e8400-e29b-41d4-a716-446655440000/download",
  campaignId: "550e8400-e29b-41d4-a716-446655440000",
  isPublicationCopyEdited: false,
  messages: ptBRCampaignDetailMessages,
  locale: "pt-BR" as const,
  formatPresentation: VERTICAL_DELIVERED,
  newFlow: {
    state: "delivered" as const,
    operationId: "660e8400-e29b-41d4-a716-446655440000",
    copy: null,
    recovery: null,
    restoredForm: null,
  },
};

describe("F59/59-08 — detalhe da campanha por formato", () => {
  it("9:16 entrega com arte integral usa container vertical e object-contain", () => {
    render(<CampaignPageClient {...BASE_PROPS} newFlowFormat="9:16" />);
    const image = screen.getByRole("img", { name: "Produto F59" });
    expect(image).toHaveClass("h-full", "w-full", "object-contain");
    expect(image).not.toHaveClass("object-cover");
    const frame = image.parentElement;
    expect(frame).toHaveClass("aspect-[9/16]", "max-h-[70vh]", "overflow-hidden");
  });

  it("1:1 mantém a imagem atual sem frame vertical", () => {
    render(<CampaignPageClient {...BASE_PROPS} newFlowFormat="1:1" />);
    const image = screen.getByRole("img", { name: "Produto F59" });
    expect(image).toHaveClass("w-full", "rounded-xl", "shadow-md");
    expect(image.parentElement).not.toHaveClass("aspect-[9/16]");
  });

  it("formato indisponível não monta imagem nem frame vertical", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        imageUrl={null}
        newFlowFormat={undefined}
      />,
    );
    expect(screen.queryByRole("img", { name: "Produto F59" })).not.toBeInTheDocument();
    expect(document.querySelector(".aspect-\\[9\\/16\\]")).toBeNull();
  });

  it("não oferece conversão nem troca de formato", () => {
    render(<CampaignPageClient {...BASE_PROPS} newFlowFormat="9:16" />);
    expect(screen.queryByText(/converter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trocar formato/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mudar formato/i)).not.toBeInTheDocument();
  });

  it("página resolve o formato persistido e usa sonda/URL assinada vertical", () => {
    const pageSource = readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/(app)/campanhas/[id]/page.tsx",
      ),
      "utf8",
    );
    expect(pageSource).toMatch(/resolveCampaignFormat/);
    expect(pageSource).toMatch(/product-vertical-9-16/);
    expect(pageSource).toMatch(/getSignedArtifactUrl/);
    expect(pageSource).toMatch(/formatResolution\.kind === "9:16"/);
  });
});

describe("F61 — chips de formato no nível da página do detalhe", () => {
  it("exibe os dois chips uma única vez, sem rótulos crus nem duplicação", () => {
    render(<CampaignPageClient {...BASE_PROPS} />);

    expect(
      screen.getAllByRole("list", { name: "Formatos da campanha" }),
    ).toHaveLength(1);
    expect(screen.getByText("Vertical 9:16")).toBeInTheDocument();
    expect(screen.getByText("Quadrado 1:1")).toBeInTheDocument();
    expect(screen.getByText("Não incluído")).toBeInTheDocument();
    expect(screen.getByText("Selecionado")).toBeInTheDocument();
    expect(screen.queryByText("Não gerado")).toBeNull();
    expect(screen.queryByText("+")).toBeNull();
  });

  it("mantém os chips nos estados generating/stale/error", () => {
    for (const displayStatus of ["generating", "stale", "error"] as const) {
      const { unmount } = render(
        <CampaignPageClient
          {...BASE_PROPS}
          newFlow={undefined}
          displayStatus={displayStatus}
          imageUrl={null}
        />,
      );
      expect(
        screen.getByRole("list", { name: "Formatos da campanha" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Não gerado")).toBeNull();
      unmount();
    }
  });

  it("aprovação pendente com candidata mantém chips sem ativo e sem preview/download novos", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={undefined}
        imageUrl={null}
        formatPresentation={buildIndividualFormatPresentation({
          resolution: { kind: "9:16", contractVersion: "f59-vertical-9-16-v1" },
          lifecycle: "delivered",
        })}
        approval={{
          state: { status: "pending" },
          candidateImageUrl: "https://preview.example.com/art.jpg",
          candidateVersionId: "v1",
        }}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Formatos da campanha" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Selecionado")).toBeNull();
    expect(screen.queryByRole("button", { name: /baixar/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /aprovar arte/i }),
    ).toBeInTheDocument();
  });

  it("regenerating mostra chips sem ativo e sem download", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={undefined}
        imageUrl={null}
        formatPresentation={buildIndividualFormatPresentation({
          resolution: { kind: "9:16", contractVersion: "f59-vertical-9-16-v1" },
          lifecycle: "processing",
        })}
        approval={{
          state: { status: "regenerating" },
          candidateImageUrl: "https://preview.example.com/art.jpg",
          candidateVersionId: "v1",
        }}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Formatos da campanha" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Corrigindo a arte...")).toBeInTheDocument();
    expect(screen.queryByText("Selecionado")).toBeNull();
    expect(screen.queryByRole("button", { name: /baixar/i })).toBeNull();
  });
});
