// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const HREFS: Partial<Record<CampaignFormatKey, string>> = {
  "1:1": "/campanhas/c1?format=1:1",
  "9:16": "/campanhas/c1?format=9:16",
};

function renderChips(
  presentation: CampaignFormatPresentation,
  messages: CampaignFormatPresentationMessages = ptBRCampaignFormatMessages,
  hrefs?: Partial<Record<CampaignFormatKey, string>>,
  helpLang?: string,
) {
  return render(
    <CampaignFormatChips
      presentation={presentation}
      messages={messages}
      hrefs={hrefs}
      helpLang={helpLang}
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

function groupByName(pattern: RegExp): HTMLElement {
  return screen.getByRole("group", { name: pattern });
}

function helpButtonOf(group: HTMLElement): HTMLElement {
  return within(group).getByRole("button");
}

/** O elemento “chip” (link ou span) é o pai do nome visível dentro do grupo. */
function chipElement(group: HTMLElement): HTMLElement {
  const link = within(group).queryByRole("link");
  if (link) return link;
  const nameSpan = group.querySelector("span.break-words");
  return (nameSpan?.parentElement as HTMLElement | null) ?? group;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("F61 — componente compartilhado de chips de formato (compacto)", () => {
  it("renderiza sempre dois chips, na ordem 1:1 e 9:16, com texto visível apenas dos nomes", () => {
    renderChips(joint("delivered", "delivered"));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(2);
    expect(groups[0].textContent).toBe("Quadrado 1:1");
    expect(groups[1].textContent).toBe("Vertical 9:16");
    expect(
      screen.getByRole("list", { name: "Formatos da campanha" }),
    ).toBeInTheDocument();
  });

  it("não exibe rótulos de estado nem badge 'Selecionado' como texto visível", () => {
    renderChips(
      joint("delivered", "delivered", { activeFormat: "9:16" }),
      ptBRCampaignFormatMessages,
      HREFS,
    );

    // Os rótulos existem apenas no nome acessível/descrição/ajuda, nunca como
    // texto visível isolado.
    expect(screen.queryByText("Disponível")).toBeNull();
    expect(screen.queryByText("Selecionado")).toBeNull();
    expect(screen.queryByText("Não incluído")).toBeNull();
    expect(screen.queryByText("Não entregue")).toBeNull();

    const vertical = groupByName(/Vertical 9:16/);
    expect(vertical.textContent).toBe("Vertical 9:16");
  });

  it("expõe o estado completo no group acessível e em descrição hidden estável", () => {
    renderChips(joint("delivered", "absent"));

    const delivered = groupByName(/^Quadrado 1:1: Disponível$/);
    expect(delivered).toHaveAccessibleName("Quadrado 1:1: Disponível");
    expect(delivered).toHaveAccessibleDescription(
      "Disponível. Este formato está disponível nesta campanha.",
    );

    const descriptionId = delivered.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    const description = document.getElementById(descriptionId ?? "");
    expect(description).not.toBeNull();
    expect(description).toHaveAttribute("hidden");
    expect(description).not.toBeVisible();
    expect(description?.textContent).toBe(
      "Disponível. Este formato está disponível nesta campanha.",
    );
  });

  it("associa a descrição também ao link de seleção e marca apenas o ativo com aria-current", () => {
    renderChips(
      joint("delivered", "delivered", { activeFormat: "9:16" }),
      ptBRCampaignFormatMessages,
      HREFS,
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
    expect(vertical).toHaveAccessibleDescription(
      "Disponível. Este é o formato exibido agora.",
    );
    expect(square).toHaveAccessibleDescription(
      "Disponível. Este formato está disponível nesta campanha.",
    );

    // O nome acessível do grupo ativo informa “Selecionado” sem badge visível.
    expect(
      screen.getByRole("group", {
        name: "Vertical 9:16: Disponível, Selecionado",
      }),
    ).toBeInTheDocument();
  });

  it("o '?' tem nome + estado, é irmão do link/span e nunca fica aninhado", () => {
    const { container } = renderChips(
      joint("delivered", "absent"),
      ptBRCampaignFormatMessages,
      HREFS,
    );

    const delivered = groupByName(/^Quadrado 1:1/);
    const button = helpButtonOf(delivered);
    expect(button).toHaveAccessibleName(
      "Ver explicação do formato: Quadrado 1:1, Disponível",
    );
    expect(button.closest("a")).toBeNull();
    expect(container.querySelectorAll("a button, button a, a a, button button")).toHaveLength(
      0,
    );
  });

  it("entregue tem destaque discreto e nenhum ícone; ausente fica cinza legível sem ícone", () => {
    renderChips(individual("delivered"));

    const deliveredChip = chipElement(groupByName(/^Quadrado 1:1/));
    expect(deliveredChip.className).toContain("bg-accent-green/10");
    expect(deliveredChip.className).toContain("border-accent-green/30");

    const absentGroup = groupByName(/^Vertical 9:16: Não incluído$/);
    const absentChip = chipElement(absentGroup);
    expect(absentChip.className).toContain("text-text-secondary");
    expect(absentChip.className).toContain("bg-bg-elevated");

    for (const group of screen.getAllByRole("group")) {
      expect(chipElement(group).querySelector("svg")).toBeNull();
    }
  });

  it("ativo usa borda/fundo distintos sem badge", () => {
    renderChips(joint("delivered", "delivered", { activeFormat: "1:1" }));

    const activeGroup = groupByName(/Selecionado/);
    const chip = chipElement(activeGroup);
    expect(chip.className).toContain("ring-1");
    expect(chip.className).toContain("ring-accent-green/40");
    expect(chip.className).toContain("bg-accent-green/15");
    expect(within(activeGroup).queryByText("Selecionado")).toBeNull();
  });

  it("processing usa indicador pequeno de processamento", () => {
    const { container } = renderChips(joint("processing", "delivered"));

    expect(container.querySelector(".lucide-loader-circle")).not.toBeNull();
    expect(groupByName(/^Quadrado 1:1: Processando$/)).toBeInTheDocument();
  });

  it("unknown/unavailable usam dúvida pequena; refunded usa Undo2", () => {
    renderChips(buildUnknownFormatPresentation());
    for (const group of screen.getAllByRole("group")) {
      expect(
        chipElement(group).querySelector(".lucide-circle-question-mark"),
      ).not.toBeNull();
    }
    expect(groupByName(/^Quadrado 1:1: Não foi possível confirmar$/)).toBeInTheDocument();
    cleanup();

    renderChips(buildUnavailableFormatPresentation());
    for (const group of screen.getAllByRole("group")) {
      expect(
        chipElement(group).querySelector(".lucide-circle-question-mark"),
      ).not.toBeNull();
    }
    cleanup();

    renderChips(joint("delivered", "absent", { verticalRefunded: true }));
    expect(
      chipElement(groupByName(/^Vertical 9:16: Crédito devolvido$/)).querySelector(
        ".lucide-undo-2",
      ),
    ).not.toBeNull();
  });

  it("não usa 'Não gerado', '+', emojis nem frase longa dentro do chip", () => {
    const { container } = renderChips(buildUnavailableFormatPresentation());

    expect(container.textContent).not.toContain("Não gerado");
    expect(container.textContent).not.toContain("+");
    expect(EMOJI.test(container.textContent ?? "")).toBe(false);
    for (const group of screen.getAllByRole("group")) {
      expect(group.textContent).not.toContain("Este formato");
    }
    expect(container.querySelector("button[disabled]")).toBeNull();
  });

  it("link somente para delivered com href; href é ignorado em estado não entregue", () => {
    const { unmount } = renderChips(joint("delivered", "absent"), ptBRCampaignFormatMessages, HREFS);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/campanhas/c1?format=1:1");
    unmount();

    renderChips(joint("delivered", "delivered"));
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("hover abre a ajuda em popover fora do fluxo (portal no body, position fixed)", () => {
    const { container } = renderChips(joint("delivered", "delivered"));
    const group = groupByName(/^Quadrado 1:1/);
    const button = helpButtonOf(group);

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-controls");

    fireEvent.mouseEnter(group);

    const note = screen.getByRole("note");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", note.id);
    expect(note.parentElement).toBe(document.body);
    expect(note.style.position).toBe("fixed");
    expect(note.getAttribute("style")).toContain("min(20rem");
    expect(note.className).toContain("z-50");
    expect(container.contains(note)).toBe(false);
  });

  it("foco abre a ajuda; saída sem fixar fecha", () => {
    vi.useFakeTimers();
    renderChips(joint("delivered", "delivered"));
    const group = groupByName(/^Quadrado 1:1/);
    const button = helpButtonOf(group);

    fireEvent.focus(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.blur(button, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("hover → clique FIXA a ajuda; segundo clique fecha", () => {
    vi.useFakeTimers();
    renderChips(joint("delivered", "delivered"));
    const group = groupByName(/^Quadrado 1:1/);
    const button = helpButtonOf(group);

    fireEvent.mouseEnter(group);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseLeave(group);
    fireEvent.blur(button, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("toque: primeiro acionamento abre, segundo fecha", () => {
    renderChips(joint("delivered", "delivered"));
    const button = helpButtonOf(groupByName(/^Vertical 9:16/));

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("Escape fecha, devolve o foco ao '?' e não reabre imediatamente", () => {
    renderChips(joint("delivered", "delivered"));
    const group = groupByName(/^Quadrado 1:1/);
    const button = helpButtonOf(group);

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("note")).toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
    // O foco devolvido não pode reabrir a ajuda.
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("clique/toque fora fecha; clique dentro do popover não fecha", () => {
    renderChips(joint("delivered", "delivered"));
    const button = helpButtonOf(groupByName(/^Quadrado 1:1/));

    fireEvent.click(button);
    const note = screen.getByRole("note");
    fireEvent.pointerDown(note);
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("note")).toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("mover o ponteiro do chip para o popover mantém a ajuda aberta", () => {
    vi.useFakeTimers();
    renderChips(joint("delivered", "delivered"));
    const group = groupByName(/^Quadrado 1:1/);

    fireEvent.mouseEnter(group);
    const note = screen.getByRole("note");
    fireEvent.mouseLeave(group);
    fireEvent.mouseEnter(note);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("reabre por hover após sair e voltar (sem fixar)", () => {
    vi.useFakeTimers();
    renderChips(joint("delivered", "delivered"));
    const group = groupByName(/^Quadrado 1:1/);
    const button = helpButtonOf(group);

    fireEvent.mouseEnter(group);
    fireEvent.mouseLeave(group);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.mouseEnter(group);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("somente um popover aberto por vez", () => {
    renderChips(joint("delivered", "delivered"));
    const square = groupByName(/^Quadrado 1:1/);
    const vertical = groupByName(/^Vertical 9:16/);

    fireEvent.mouseEnter(square);
    expect(screen.getAllByRole("note")).toHaveLength(1);

    fireEvent.mouseEnter(vertical);
    const notes = screen.getAllByRole("note");
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain("Vertical 9:16");
  });

  it("aria-controls só existe quando a ajuda está montada/aberta", () => {
    renderChips(joint("delivered", "delivered"));
    const button = helpButtonOf(groupByName(/^Quadrado 1:1/));

    expect(button).not.toHaveAttribute("aria-controls");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-controls");
    fireEvent.click(button);
    expect(button).not.toHaveAttribute("aria-controls");
  });

  it("não deixa conteúdo focável na ajuda fechada e o popover não é focável", () => {
    const { container } = renderChips(joint("delivered", "delivered"));

    expect(screen.queryByRole("note")).toBeNull();
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);

    fireEvent.click(helpButtonOf(groupByName(/^Quadrado 1:1/)));
    const note = screen.getByRole("note");
    expect(note.querySelectorAll("a, button, input, textarea, select")).toHaveLength(
      0,
    );
    expect(note).not.toHaveAttribute("tabindex");
  });

  it("preserva hit area ≥44×44 no '?' e no link, com '?' compacto sem círculo/borda", () => {
    renderChips(
      joint("delivered", "delivered"),
      ptBRCampaignFormatMessages,
      HREFS,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toBeDisabled();
      expect(button.className).toContain("min-h-11");
      expect(button.className).toContain("min-w-11");
      expect(button.className).toContain("focus-visible:ring-2");
      expect(button.className).not.toContain("rounded-full");
      expect(button.className).not.toContain("border-border");
      expect(button.getAttribute("tabindex")).not.toBe("-1");
    }

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
      expect(link.className).toContain("focus-visible:ring-2");
    }
  });

  it("o '?' não navega nem alterna o formato", () => {
    const { container } = renderChips(
      joint("delivered", "delivered"),
      ptBRCampaignFormatMessages,
      HREFS,
    );
    const before = container.querySelectorAll('[aria-label^="Formatos"]').length;
    const button = helpButtonOf(groupByName(/^Quadrado 1:1/));

    fireEvent.click(button);

    expect(button.tagName).toBe("BUTTON");
    expect(button).not.toHaveAttribute("href");
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByRole("group", { name: /^Quadrado 1:1/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /^Vertical 9:16/ })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label^="Formatos"]').length).toBe(
      before,
    );
  });

  it("não dispara fetch ao renderizar ou abrir a ajuda", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderChips(joint("delivered", "delivered"));
    fireEvent.click(helpButtonOf(groupByName(/^Quadrado 1:1/)));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("pinta o popover com lang es-419 e textos localizados", () => {
    renderChips(
      joint("delivered", "absent"),
      es419CampaignFormatMessages,
      undefined,
      "es-419",
    );

    expect(
      screen.getByRole("list", { name: "Formatos de la campaña" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Cuadrado 1:1: Disponible" }),
    ).toBeInTheDocument();

    fireEvent.click(
      helpButtonOf(screen.getByRole("group", { name: /^Cuadrado 1:1/ })),
    );

    const note = screen.getByRole("note");
    expect(note).toHaveAttribute("lang", "es-419");
    expect(note.textContent).toContain("Disponible");
    expect(note.textContent).toContain(
      "Este formato está disponible en esta campaña.",
    );
  });

  it("mantém classes de responsividade sem overflow", () => {
    renderChips(joint("delivered", "processing"));

    const list = screen.getByRole("list");
    expect(list.className).toContain("flex-wrap");
    expect(list.className).toContain("min-w-0");
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).toContain("min-w-0");
    }
    for (const group of screen.getAllByRole("group")) {
      expect(group.className).toContain("flex-wrap");
      expect(group.className).toContain("min-w-0");
    }
  });

  it("não importa Supabase, storage, fetch, server-only, next/link ou HTML cru", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/campaign/campaign-format-chips.tsx"),
      "utf8",
    );

    expect(source).toMatch(/^"use client";/);
    expect(source).toMatch(/createPortal/);
    expect(source).not.toMatch(/@\/lib\/supabase/);
    expect(source).not.toMatch(/["']server-only["']/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\.storage\b/);
    expect(source).not.toMatch(/next\/link/);
    expect(source).not.toMatch(/prefetch=/);
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
