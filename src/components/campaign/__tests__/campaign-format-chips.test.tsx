// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampaignFormatChips } from "../campaign-format-chips";
import {
  buildIndividualFormatPresentation,
  buildJointFormatPresentation,
  buildUnavailableFormatPresentation,
  buildUnknownFormatPresentation,
  type CampaignFormatKey,
  type CampaignFormatPresentation,
} from "@/lib/campaign/format-presentation";
import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import { es419CampaignFormatMessages } from "@/lib/i18n/campaign-formats/catalogs/es-419";
import { ptBRCampaignFormatMessages } from "@/lib/i18n/campaign-formats/catalogs/pt-BR";
import type { CampaignFormatPresentationMessages } from "@/lib/i18n/campaign-formats/messages";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function renderChips(
  presentation: CampaignFormatPresentation,
  messages: CampaignFormatPresentationMessages = ptBRCampaignFormatMessages,
  hrefs?: Partial<Record<CampaignFormatKey, string>>,
) {
  return render(
    <CampaignFormatChips
      presentation={presentation}
      messages={messages}
      hrefs={hrefs}
    />,
  );
}

function joint(
  square: "delivered" | "processing" | "absent" | "unknown" | "unavailable",
  vertical: "delivered" | "processing" | "absent" | "unknown" | "unavailable",
  options: {
    squareRefunded?: boolean;
    verticalRefunded?: boolean;
    activeFormat?: CampaignFormatKey | null;
  } = {},
): CampaignFormatPresentation {
  return buildJointFormatPresentation(
    {
      "1:1": { state: square, refunded: options.squareRefunded ?? false },
      "9:16": {
        state: vertical,
        refunded: options.verticalRefunded ?? false,
      },
    },
    options.activeFormat ?? null,
  );
}

function individual(
  lifecycle: "delivered" | "processing" | "refunded" | "unknown",
  activeFormat: CampaignFormatKey | null = null,
): CampaignFormatPresentation {
  return buildIndividualFormatPresentation(
    { resolution: resolveCampaignFormat({}), lifecycle },
    activeFormat,
  );
}

describe("F61 — componente compartilhado de chips de formato", () => {
  it("renderiza sempre dois chips, na ordem 1:1 e 9:16", () => {
    renderChips(joint("delivered", "delivered"));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Quadrado 1:1");
    expect(items[1].textContent).toContain("Vertical 9:16");
    expect(screen.getByRole("list", { name: "Formatos da campanha" })).toBeInTheDocument();
  });

  it("delivered exibe rótulo de disponibilidade e ícone", () => {
    const { container } = renderChips(joint("delivered", "delivered"));

    expect(screen.getAllByText("Disponível")).toHaveLength(2);
    expect(container.querySelectorAll(".lucide-check")).toHaveLength(2);
  });

  it("processing exibe rótulo e indicador próprio", () => {
    const { container } = renderChips(joint("processing", "delivered"));

    expect(screen.getByText("Processando")).toBeInTheDocument();
    expect(screen.getByText("Este formato está sendo processado.")).toBeInTheDocument();
    expect(container.querySelector(".lucide-loader-circle")).not.toBeNull();
  });

  it("absent distingue not_requested e not_delivered", () => {
    const { unmount } = renderChips(individual("delivered"));
    expect(screen.getByText("Não incluído")).toBeInTheDocument();
    unmount();

    renderChips(joint("delivered", "absent"));
    expect(screen.getByText("Não entregue")).toBeInTheDocument();
  });

  it("estorno conhecido aparece como crédito devolvido, com Undo2", () => {
    const { container } = renderChips(
      joint("delivered", "absent", { verticalRefunded: true }),
    );

    expect(screen.getByText("Crédito devolvido")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Este formato não está disponível e o crédito foi devolvido.",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector(".lucide-undo-2")).not.toBeNull();
  });

  it("unknown e unavailable são honestos e distintos", () => {
    const { unmount } = renderChips(buildUnknownFormatPresentation());
    expect(screen.getAllByText("Não foi possível confirmar")).toHaveLength(2);
    expect(
      screen.getAllByText("Não foi possível confirmar o estado deste formato."),
    ).toHaveLength(2);
    unmount();

    renderChips(buildUnavailableFormatPresentation());
    expect(screen.getAllByText("Indisponível")).toHaveLength(2);
  });

  it("ativo recebe aria-current no link e o texto 'Selecionado'", () => {
    renderChips(
      joint("delivered", "delivered", { activeFormat: "9:16" }),
      ptBRCampaignFormatMessages,
      { "1:1": "/campanhas/c1?format=1:1", "9:16": "/campanhas/c1?format=9:16" },
    );

    const links = screen.getAllByRole("link");
    const square = links.find(
      (link) => link.getAttribute("href") === "/campanhas/c1?format=1:1",
    );
    const vertical = links.find(
      (link) => link.getAttribute("href") === "/campanhas/c1?format=9:16",
    );

    expect(square).not.toHaveAttribute("aria-current");
    expect(vertical).toHaveAttribute("aria-current", "true");
    expect(vertical?.textContent).toContain("Selecionado");
    expect(square?.textContent).not.toContain("Selecionado");
  });

  it("link somente para delivered com href; href é ignorado em estado não entregue", () => {
    const { unmount } = renderChips(
      joint("delivered", "absent"),
      ptBRCampaignFormatMessages,
      { "1:1": "/campanhas/c1?format=1:1", "9:16": "/campanhas/c1?format=9:16" },
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/campanhas/c1?format=1:1");
    unmount();

    renderChips(joint("delivered", "delivered"));
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("explicação abre/fecha por clique, com aria-expanded e aria-controls resolvido", () => {
    renderChips(joint("delivered", "delivered"));

    const button = screen.getByRole("button", {
      name: "Ver explicação do formato: Quadrado 1:1",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");

    const controls = button.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    const region = document.getElementById(controls ?? "");
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("role", "note");
    expect(region?.className).toContain("hidden");
    expect(region?.className).toContain("group-hover:block");
    expect(region?.className).toContain("group-focus-within:block");

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(region?.className).toContain("block");
    expect(region?.className).not.toContain("hidden");
    expect(region).toHaveTextContent(
      "Este formato está disponível nesta campanha.",
    );
  });

  it("controle de informação é focável, 44x44 e nunca desabilitado", () => {
    renderChips(buildUnavailableFormatPresentation());

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).not.toBeDisabled();
      expect(button.className).toContain("min-h-11");
      expect(button.className).toContain("min-w-11");
      expect(button.className).toContain("focus-visible:ring-2");
      expect(button.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("não usa 'Não gerado', '+', emojis nem desabilita a explicação", () => {
    const { container } = renderChips(buildUnavailableFormatPresentation());

    expect(container.textContent).not.toContain("Não gerado");
    expect(container.textContent).not.toContain("+");
    expect(EMOJI.test(container.textContent ?? "")).toBe(false);
    expect(container.querySelector("button[disabled]")).toBeNull();
  });

  it("localiza em pt-BR e es-419 com os mesmos estados", () => {
    const { unmount } = renderChips(
      joint("delivered", "absent"),
      ptBRCampaignFormatMessages,
    );
    expect(screen.getByText("Disponível")).toBeInTheDocument();
    expect(screen.getByText("Não entregue")).toBeInTheDocument();
    unmount();

    renderChips(
      joint("delivered", "absent"),
      es419CampaignFormatMessages,
    );
    expect(
      screen.getByRole("list", { name: "Formatos de la campaña" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.getByText("No entregado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ver explicación del formato: Cuadrado 1:1",
      }),
    ).toBeInTheDocument();
  });

  it("mantém classes de responsividade sem overflow", () => {
    const { container } = renderChips(joint("delivered", "processing"));

    const list = screen.getByRole("list");
    expect(list.className).toContain("flex-wrap");
    expect(list.className).toContain("min-w-0");
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).toContain("min-w-0");
      expect(item.className).toContain("flex-wrap");
    }
    expect(container.querySelectorAll(".break-words").length).toBeGreaterThan(0);
  });

  it("não importa Supabase, storage, fetch, server-only ou HTML cru", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/components/campaign/campaign-format-chips.tsx",
      ),
      "utf8",
    );

    expect(source).toMatch(/^"use client";/);
    expect(source).not.toMatch(/@\/lib\/supabase/);
    expect(source).not.toMatch(/["']server-only["']/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\.storage\b/);
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
