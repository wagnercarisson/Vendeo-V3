// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: routerRefresh }),
}));

import CampaignPageClient from "@/app/(app)/campanhas/[id]/client";
import {
  buildJointFormatPresentation,
  buildUnknownFormatPresentation,
  type CampaignFormatKey,
} from "@/lib/campaign/format-presentation";
import type { CampaignPageProps } from "@/lib/campaign/display";
import { ptBRCampaignDetailMessages } from "@/lib/i18n/campaign-detail";

type JointProps = NonNullable<CampaignPageProps["joint"]>;

const baseProps = {
  imageUrl: "https://signed/square" as string | null,
  caption: "Legenda conjunta",
  hashtags: ["#oferta"],
  ctaPost: "Compre agora",
  displayStatus: "ready" as const,
  productName: "Produto Teste",
  createdAt: "2026-11-19T12:00:00Z",
  updatedAt: "2026-11-19T12:00:00Z",
  downloadUrl: "/api/campaign/c1/download?format=1:1",
  campaignId: "c1",
  isPublicationCopyEdited: false,
  messages: ptBRCampaignDetailMessages,
  locale: "pt-BR" as const,
  formatPresentation: buildJointFormatPresentation(
    {
      "1:1": { state: "delivered", refunded: false },
      "9:16": { state: "processing", refunded: false },
    },
    "1:1",
  ),
  newFlow: {
    state: "delivered" as const,
    operationId: "op-1",
    supportEmail: "suporte@example.com",
    copy: null,
  },
};

function joint(
  overrides: Partial<JointProps> = {},
): JointProps {
  return {
    formats: { "1:1": "delivered", "9:16": "processing" },
    preferredFormat: "1:1",
    requestedFormat: null,
    requestedFormatInvalid: false,
    previewFormat: "1:1",
    previewUrl: "https://signed/square",
    state: "partial_processing",
    ...overrides,
  } as JointProps;
}

function response(formats: Record<string, { state: string }>): Response {
  return new Response(JSON.stringify({ operation: { formats } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  routerRefresh.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("F60.7 C3 — cliente conjunto montado", () => {
  it("mostra a arte entregue enquanto o outro formato processa e acompanha sem refresh espúrio", async () => {
    const fetchMock = vi.fn(async () =>
      response({
        "1:1": { state: "delivered" },
        "9:16": { state: "processing" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CampaignPageClient {...baseProps} joint={joint()} />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://signed/square",
    );
    expect(
      screen.getByText(
        "Entrega parcial: o outro formato está em processamento.",
      ),
    ).toBeInTheDocument();

    // Assinatura canônica igual ao props ⇒ nenhum refresh no primeiro tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(routerRefresh).not.toHaveBeenCalled();

    // Continua acompanhando o formato pendente.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(routerRefresh).not.toHaveBeenCalled();

    // Transição para ambos entregues ⇒ um refresh e para.
    fetchMock.mockResolvedValue(
      response({
        "1:1": { state: "delivered" },
        "9:16": { state: "delivered" },
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(routerRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("não usa o intervalo legado de refresh e aplica transição para estorno/unknown", async () => {
    const fetchMock = vi.fn(async () =>
      response({
        "1:1": { state: "absent" },
        "9:16": { state: "unknown" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CampaignPageClient
        {...baseProps}
        imageUrl={null}
        newFlow={{
          state: "running",
          operationId: "op-1",
          supportEmail: "suporte@example.com",
        }}
        joint={joint({
          formats: { "1:1": "processing", "9:16": "processing" },
          preferredFormat: null,
          previewFormat: null,
          previewUrl: null,
          state: "processing",
        })}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    // Um refresh pela transição conjunta; o intervalo legado de 5 s não soma.
    expect(routerRefresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("formato inválido mostra indisponibilidade e não oferece download", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(
      <CampaignPageClient
        {...baseProps}
        imageUrl={null}
        downloadDisabled
        joint={joint({
          previewFormat: null,
          previewUrl: null,
          requestedFormatInvalid: true,
          state: "delivered",
        })}
      />,
    );

    expect(
      screen.getByText(
        "Formato solicitado inválido. Escolha um dos formatos entregues.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: ptBRCampaignDetailMessages.downloadOriginal,
      }),
    ).not.toBeInTheDocument();
  });

  it("fallback conjunto unknown não oferece recuperação de imagem individual", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      response({
        "1:1": { state: "unknown" },
        "9:16": { state: "unknown" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CampaignPageClient
        {...baseProps}
        imageUrl={null}
        jointFlow
        newFlow={{
          state: "unknown",
          operationId: "op-1",
          supportEmail: "suporte@example.com",
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Recuperar imagem salva" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Verificar novamente" }),
      );
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/campaign/generation-status");
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("image-recovery"),
      ),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        /generate|continue/.test(String(url)),
      ),
    ).toBe(false);
  });

  it("unknown individual preserva a recuperação de imagem", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(
      <CampaignPageClient
        {...baseProps}
        imageUrl={null}
        newFlow={{
          state: "unknown",
          operationId: "op-1",
          supportEmail: "suporte@example.com",
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Recuperar imagem salva" }),
    ).toBeInTheDocument();
  });

  it("F61 — chips conjuntos no topo, link só para entregue e nota única", () => {
    vi.stubGlobal("fetch", vi.fn());
    const hrefs: Partial<Record<CampaignFormatKey, string>> = {
      "1:1": "/campanhas/c1?format=1:1",
    };

    render(
      <CampaignPageClient
        {...baseProps}
        imageUrl={null}
        downloadDisabled
        joint={joint({
          formats: { "1:1": "delivered", "9:16": "absent" },
          preferredFormat: "1:1",
          previewFormat: "1:1",
          previewUrl: null,
          state: "partial_terminal",
        })}
        formatPresentation={buildJointFormatPresentation({
          "1:1": { state: "delivered", refunded: false },
          "9:16": { state: "absent", refunded: true },
        })}
        formatHrefs={hrefs}
      />,
    );

    expect(
      screen.getAllByRole("list", { name: "Formatos da campanha" }),
    ).toHaveLength(1);
    const formatLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("?format="));
    expect(formatLinks).toHaveLength(1);
    expect(formatLinks[0]).toHaveAttribute("href", "/campanhas/c1?format=1:1");
    expect(
      screen.getAllByText("Entrega parcial: um formato foi estornado."),
    ).toHaveLength(1);
    expect(
      screen.getByRole("group", { name: /Crédito devolvido$/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Não gerado")).toBeNull();
  });

  it("F61 — invalidRequest tem precedência sobre a nota de estado", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(
      <CampaignPageClient
        {...baseProps}
        imageUrl={null}
        downloadDisabled
        joint={joint({
          requestedFormatInvalid: true,
          previewFormat: null,
          previewUrl: null,
          state: "partial_processing",
        })}
      />,
    );

    expect(
      screen.getAllByText(
        "Formato solicitado inválido. Escolha um dos formatos entregues.",
      ),
    ).toHaveLength(1);
    expect(
      screen.queryByText("Entrega parcial: o outro formato está em processamento."),
    ).toBeNull();
  });

  it("F61 — estado unknown não exibe nota de processamento", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(
      <CampaignPageClient
        {...baseProps}
        imageUrl={null}
        downloadDisabled
        newFlow={{
          ...baseProps.newFlow,
          state: "unknown",
          operationId: null,
        }}
        joint={joint({
          formats: { "1:1": "unknown", "9:16": "unknown" },
          preferredFormat: null,
          previewFormat: null,
          previewUrl: null,
          state: "unknown",
        })}
        formatPresentation={buildUnknownFormatPresentation()}
      />,
    );

    expect(screen.queryByText("Processando formatos...")).toBeNull();
    expect(
      screen.getAllByRole("group", { name: /Não foi possível confirmar$/ }),
    ).toHaveLength(2);
  });
});
