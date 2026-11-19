// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: routerRefresh }),
}));

import CampaignPageClient from "@/app/(app)/campanhas/[id]/client";
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
});
