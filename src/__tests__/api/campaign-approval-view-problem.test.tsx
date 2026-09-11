// @vitest-environment jsdom
// F37.2 (tasks.md §16, 16.3/16.4/16.5/16.9): dois botões + modal de relato,
// estado regenerating sem actions, pending v2 só [Aprovar arte] e o consumo do
// NDJSON eligible (result/error) + ramo JSON (blocked/unclear → orientação).
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CampaignApprovalView from "@/components/campaign/campaign-approval-view";
import CampaignPageClient from "@/app/(app)/campanhas/[id]/client";

const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));

const approvalProps = {
  campaignId: "c1",
  versionId: "v1",
  imageUrl: "https://preview.example.com/art.jpg",
  productName: "Produto X",
};

const pageProps = {
  imageUrl: null,
  caption: "",
  hashtags: [] as string[],
  ctaPost: "",
  displayStatus: "ready" as const,
  productName: "Produto X",
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-01T10:00:00Z",
  downloadUrl: "/api/campaign/c1/download",
  campaignId: "c1",
  isPublicationCopyEdited: false,
};

function openModal(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: /informar problema/i }));
  return screen.getByRole("dialog");
}

function typeReport(value: string): void {
  fireEvent.change(screen.getByLabelText("Descreva o problema na arte"), {
    target: { value },
  });
}

function submitReport(): void {
  fireEvent.click(screen.getByRole("button", { name: /enviar para análise/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("16.3 — dois botões + modal de relato (sem efeito ao fechar)", () => {
  it("pending v1 exibe [Aprovar arte] e [Informar problema]", () => {
    render(<CampaignApprovalView {...approvalProps} showProblemReport />);

    expect(
      screen.getByRole("button", { name: /aprovar arte/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /informar problema/i })
    ).toBeInTheDocument();
  });

  it("sem showProblemReport (v2) não exibe [Informar problema]", () => {
    render(<CampaignApprovalView {...approvalProps} />);

    expect(
      screen.queryByRole("button", { name: /informar problema/i })
    ).toBeNull();
  });

  it("abre o modal com preview, orientação e campo obrigatório", () => {
    render(<CampaignApprovalView {...approvalProps} showProblemReport />);

    openModal();

    expect(screen.getByText("O que pode ser corrigido:")).toBeInTheDocument();
    expect(screen.getByText("O que não é corrigido:")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Descreva o problema na arte")
    ).toBeInTheDocument();
    expect(screen.getByAltText("Arte candidata")).toHaveAttribute(
      "src",
      approvalProps.imageUrl
    );
  });

  it("texto vazio → erro amigável sem chamar fetch", () => {
    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();

    submitReport();

    expect(
      screen.getByText("Descreva o problema na arte para continuar")
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("texto só pontuação → erro amigável sem chamar fetch", () => {
    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();
    typeReport("...");

    submitReport();

    expect(
      screen.getByText("Descreva o problema na arte para continuar")
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("Cancelar fecha sem efeito (sem fetch)", () => {
    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("X fecha sem efeito (sem fetch)", () => {
    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();

    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ESC fecha sem efeito (sem fetch)", () => {
    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("clique no backdrop fecha sem efeito (sem fetch)", () => {
    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    const dialog = openModal();

    fireEvent.click(dialog.parentElement as HTMLElement);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("16.4/16.5 — estados da página (regenerating e pending v2)", () => {
  it("16.4 — regenerating exibe progresso sem download/copy/approve", () => {
    render(
      <CampaignPageClient
        {...pageProps}
        approval={{
          state: { status: "regenerating" },
          candidateImageUrl: "https://preview.example.com/art.jpg",
          candidateVersionId: "v1",
          isV1: true,
          hasOpportunity: false,
        }}
      />
    );

    expect(screen.getByText("Corrigindo a arte...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /aprovar arte/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /informar problema/i })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /baixar/i })).toBeNull();
    expect(screen.queryByText("Kit de Publicação")).toBeNull();
  });

  it("16.5 — pending v2 exibe só [Aprovar arte] e aprova a v2", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "approved" }),
    });

    render(
      <CampaignPageClient
        {...pageProps}
        approval={{
          state: { status: "pending" },
          candidateImageUrl: "https://preview.example.com/v2.jpg",
          candidateVersionId: "v2",
          isV1: false,
          hasOpportunity: true,
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: /aprovar arte/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /informar problema/i })
    ).toBeNull();
    expect(screen.queryByText(/voltar/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /aprovar arte/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaign/c1/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ versionId: "v2" }),
        })
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("16.3 (via página) — pending v1 com oportunidade exibe os dois botões", () => {
    render(
      <CampaignPageClient
        {...pageProps}
        approval={{
          state: { status: "pending" },
          candidateImageUrl: "https://preview.example.com/art.jpg",
          candidateVersionId: "v1",
          isV1: true,
          hasOpportunity: true,
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: /aprovar arte/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /informar problema/i })
    ).toBeInTheDocument();
  });
});

describe("16.9 — consumo do NDJSON eligible + ramo JSON", () => {
  const encoder = new TextEncoder();

  function ndjsonResponseWithGate() {
    let releaseResult!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseResult = resolve;
    });

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "phase",
              phase: "image_generation",
              status: "started",
            }) + "\n"
          )
        );
        await gate;
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "result",
              campaignId: "c1",
              campaignUrl: "/campanhas/c1",
            }) + "\n"
          )
        );
        controller.close();
      },
    });

    const response = new Response(stream, {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });

    return { response, releaseResult };
  }

  function ndjsonErrorResponse(message: string) {
    const body =
      JSON.stringify({
        type: "phase",
        phase: "image_generation",
        status: "started",
      }) +
      "\n" +
      JSON.stringify({ type: "error", message }) +
      "\n";

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      }),
      { status: 200, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  it("NDJSON eligible → mostra processamento, consome o stream e chama router.refresh no result", async () => {
    const { response, releaseResult } = ndjsonResponseWithGate();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();
    typeReport("o preço saiu cortado");
    submitReport();

    await waitFor(() => {
      expect(screen.getByText("Gerando a nova arte...")).toBeInTheDocument();
    });
    expect(mockRefresh).not.toHaveBeenCalled();

    releaseResult();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("NDJSON error → exibe erro PT-BR e NÃO chama refresh", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      ndjsonErrorResponse("Falha ao gerar a correção. Tente novamente.")
    );

    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();
    typeReport("o preço saiu cortado");
    submitReport();

    await waitFor(() => {
      expect(
        screen.getByText("Falha ao gerar a correção. Tente novamente.")
      ).toBeInTheDocument();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("JSON blocked → exibe orientação", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          analysisState: "blocked",
          guidance: "Alterações de preço não são feitas por aqui.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();
    typeReport("mude o preço para 10 reais");
    submitReport();

    await waitFor(() => {
      expect(
        screen.getByText("Alterações de preço não são feitas por aqui.")
      ).toBeInTheDocument();
    });
  });

  it("JSON unclear → exibe orientação", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          analysisState: "unclear",
          guidance: "Não conseguimos identificar um defeito objetivo.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<CampaignApprovalView {...approvalProps} showProblemReport />);
    openModal();
    typeReport("não gostei da arte");
    submitReport();

    await waitFor(() => {
      expect(
        screen.getByText("Não conseguimos identificar um defeito objetivo.")
      ).toBeInTheDocument();
    });
  });
});
