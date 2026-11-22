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

/** O CHIP (link ou botão) é o único controle de cada item da lista. */
function chipOf(item: HTMLElement): HTMLElement {
  const control =
    within(item).queryByRole("link") ?? within(item).queryByRole("button");
  if (!control) throw new Error("controle do chip não encontrado");
  return control;
}

function chipItems(): HTMLElement[] {
  return screen.getAllByRole("listitem");
}

function allChips(): HTMLElement[] {
  return chipItems().map(chipOf);
}

function chipByLabel(pattern: RegExp): HTMLElement {
  const found = allChips().find((chip) =>
    pattern.test(chip.getAttribute("aria-label") ?? ""),
  );
  if (!found) throw new Error(`chip não encontrado: ${pattern}`);
  return found;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("F61 — chip único de formato (sem '?')", () => {
  it("renderiza sempre dois chips, na ordem 1:1 e 9:16, com texto visível apenas dos nomes", () => {
    renderChips(joint("delivered", "delivered"));

    const items = chipItems();
    expect(items).toHaveLength(2);
    expect(allChips()).toHaveLength(2);
    const chips = allChips();
    expect(chips[0].textContent).toBe("Quadrado 1:1");
    expect(chips[1].textContent).toBe("Vertical 9:16");
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

    expect(screen.queryByText("Disponível")).toBeNull();
    expect(screen.queryByText("Selecionado")).toBeNull();
    expect(screen.queryByText("Não incluído")).toBeNull();
    expect(screen.queryByText("Não entregue")).toBeNull();

    expect(chipByLabel(/^Vertical 9:16/).textContent).toBe("Vertical 9:16");
  });

  it("expõe o estado completo no aria-label e em descrição hidden estável", () => {
    renderChips(joint("delivered", "absent"));

    const delivered = chipByLabel(/^Quadrado 1:1: Disponível$/);
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

  it("não existe '?' separado: o próprio chip é o único controle, sem nested ou grupo duplicando o nome", () => {
    const { container } = renderChips(
      joint("delivered", "absent"),
      ptBRCampaignFormatMessages,
      HREFS,
    );

    // Exatamente dois controles: o chip entregue (link) e o ausente (botão).
    expect(container.querySelectorAll("a, button")).toHaveLength(2);
    // Nenhum wrapper `role="group"` com nome acessível duplicando o chip.
    expect(screen.queryAllByRole("group")).toHaveLength(0);
    // Nenhum botão aninhado em link ou link dentro de botão.
    expect(
      container.querySelectorAll("a button, button a, a a, button button"),
    ).toHaveLength(0);
    // Nenhum foco órfão/invisível: os únicos focáveis são os chips.
    expect(
      container.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])'),
    ).toHaveLength(2);
    // O nome acessível não menciona a ação antiga do "?".
    for (const chip of allChips()) {
      expect(chip.getAttribute("aria-label")).not.toMatch(/Ver explicação/);
    }
  });

  it("entregue x ausente não depende só de cor: borda espessa/preenchimento x borda simples", () => {
    renderChips(individual("delivered"));

    const deliveredChip = chipByLabel(/^Quadrado 1:1/);
    expect(deliveredChip.className).toContain("border-2");
    expect(deliveredChip.className).toContain("border-solid");
    expect(deliveredChip.className).toContain("bg-accent-green/10");

    const absentChip = chipByLabel(/^Vertical 9:16: Não incluído$/);
    expect(absentChip.className).toContain("border-solid");
    expect(absentChip.className).not.toContain("border-2");
    expect(absentChip.className).toContain("bg-bg-elevated");
    expect(absentChip.className).toContain("text-text-secondary");

    for (const chip of allChips()) {
      expect(chip.querySelector("svg")).toBeNull();
    }
  });

  it("ativo usa borda/fundo distintos sem badge", () => {
    renderChips(joint("delivered", "delivered", { activeFormat: "1:1" }));

    const activeChip = chipByLabel(/Selecionado/);
    expect(activeChip.className).toContain("ring-1");
    expect(activeChip.className).toContain("ring-accent-green/40");
    expect(activeChip.className).toContain("bg-accent-green/15");
    expect(screen.queryByText("Selecionado")).toBeNull();
  });

  it("processing usa indicador pequeno de processamento", () => {
    const { container } = renderChips(joint("processing", "delivered"));

    expect(container.querySelector(".lucide-loader-circle")).not.toBeNull();
    expect(chipByLabel(/^Quadrado 1:1: Processando$/)).toBeInTheDocument();
  });

  it("unknown/unavailable usam dúvida pequena + borda tracejada; refunded usa Undo2", () => {
    renderChips(buildUnknownFormatPresentation());
    for (const chip of allChips()) {
      expect(chip.querySelector(".lucide-circle-question-mark")).not.toBeNull();
      expect(chip.className).toContain("border-dashed");
    }
    expect(chipByLabel(/^Quadrado 1:1: Não foi possível confirmar$/)).toBeInTheDocument();
    cleanup();

    renderChips(buildUnavailableFormatPresentation());
    for (const chip of allChips()) {
      expect(chip.querySelector(".lucide-circle-question-mark")).not.toBeNull();
      expect(chip.className).toContain("border-dashed");
    }
    cleanup();

    renderChips(joint("delivered", "absent", { verticalRefunded: true }));
    expect(
      chipByLabel(/^Vertical 9:16: Crédito devolvido$/).querySelector(
        ".lucide-undo-2",
      ),
    ).not.toBeNull();
  });

  it("não usa 'Não gerado', '+', emojis, frase longa nem botão desabilitado", () => {
    const { container } = renderChips(buildUnavailableFormatPresentation());

    expect(container.textContent).not.toContain("Não gerado");
    expect(container.textContent).not.toContain("+");
    expect(EMOJI.test(container.textContent ?? "")).toBe(false);
    for (const chip of allChips()) {
      expect(chip.textContent).not.toContain("Este formato");
      expect(chip).not.toBeDisabled();
    }
    expect(container.querySelector("button[disabled]")).toBeNull();
  });

  it("link somente para delivered COM href; href é ignorado em estado não entregue", () => {
    const { unmount } = renderChips(
      joint("delivered", "absent"),
      ptBRCampaignFormatMessages,
      HREFS,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/campanhas/c1?format=1:1");
    expect(links[0]).not.toHaveAttribute("prefetch");
    // O chip ausente (mesmo com href configurado) é botão, nunca link.
    expect(chipByLabel(/^Vertical 9:16/).tagName).toBe("BUTTON");
    unmount();

    renderChips(joint("delivered", "delivered"));
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("entregue SEM href (individual/legado) é botão explicativo, sem aria-current", () => {
    renderChips(individual("delivered", "1:1"));

    const chip = chipByLabel(/^Quadrado 1:1: Disponível, Selecionado$/);
    expect(chip.tagName).toBe("BUTTON");
    expect(chip).toHaveAttribute("type", "button");
    expect(chip).not.toHaveAttribute("aria-current");
    expect(chip).not.toHaveAttribute("href");
  });

  it("aria-current apenas no link ativo; aria-expanded/aria-controls apenas no chip-botão", () => {
    renderChips(
      joint("delivered", "delivered", { activeFormat: "9:16" }),
      ptBRCampaignFormatMessages,
      HREFS,
    );

    const square = screen.getByRole("link", {
      name: "Quadrado 1:1: Disponível",
    });
    const vertical = screen.getByRole("link", {
      name: "Vertical 9:16: Disponível, Selecionado",
    });

    expect(square).not.toHaveAttribute("aria-current");
    expect(vertical).toHaveAttribute("aria-current", "true");
    expect(vertical).toHaveAccessibleDescription(
      "Disponível. Este é o formato exibido agora.",
    );
    expect(square).toHaveAccessibleDescription(
      "Disponível. Este formato está disponível nesta campanha.",
    );
    expect(
      screen.getByRole("link", {
        name: "Vertical 9:16: Disponível, Selecionado",
      }),
    ).toBeInTheDocument();

    // Abrir a ajuda por hover no LINK não cria aria-expanded/aria-controls.
    fireEvent.mouseEnter(vertical);
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(vertical).not.toHaveAttribute("aria-expanded");
    expect(vertical).not.toHaveAttribute("aria-controls");
  });

  it("hover abre a ajuda em popover fora do fluxo (portal no body, position fixed)", () => {
    const { container } = renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(chip).not.toHaveAttribute("aria-controls");

    fireEvent.mouseEnter(chip);

    const note = screen.getByRole("note");
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(chip).toHaveAttribute("aria-controls", note.id);
    expect(note.parentElement).toBe(document.body);
    expect(note.style.position).toBe("fixed");
    expect(note.getAttribute("style")).toContain("min(20rem");
    expect(note.className).toContain("z-50");
    expect(container.contains(note)).toBe(false);
  });

  it("foco abre a ajuda; saída sem fixar fecha", () => {
    vi.useFakeTimers();
    renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    fireEvent.focus(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.blur(chip, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("hover → clique FIXA a ajuda; segundo clique fecha", () => {
    vi.useFakeTimers();
    renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    fireEvent.mouseEnter(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseLeave(chip);
    fireEvent.blur(chip, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("toque: primeiro acionamento abre, segundo fecha", () => {
    renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Vertical 9:16/);

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("link entregue: click seleciona (não intercepta) e NÃO abre a ajuda", () => {
    renderChips(
      joint("delivered", "delivered", { activeFormat: "1:1" }),
      ptBRCampaignFormatMessages,
      HREFS,
    );
    const link = screen.getByRole("link", {
      name: "Quadrado 1:1: Disponível, Selecionado",
    });

    // Sem hover/foco prévio, o clique não abre ajuda e não é cancelado. O
    // `href` é temporariamente trocado por um hash (mesmo documento) para o
    // jsdom não tentar navegar; o elemento e a ausência de handler são os
    // mesmos, e o `href` real é conferido logo abaixo.
    const originalHref = link.getAttribute("href");
    link.setAttribute("href", "#noop");
    try {
      expect(fireEvent.click(link)).toBe(true);
    } finally {
      link.setAttribute("href", originalHref ?? "");
    }
    expect(screen.queryByRole("note")).toBeNull();
    expect(link).toHaveAttribute("href", "/campanhas/c1?format=1:1");
    expect(link).not.toHaveAttribute("aria-expanded");
  });

  it("Escape fecha, devolve o foco ao chip de origem e não reabre imediatamente", () => {
    renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("note")).toBeNull();
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(chip).toHaveFocus();
    expect(chip).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape em ajuda de link devolve o foco ao link sem abrir aria-expanded", () => {
    renderChips(
      joint("delivered", "delivered"),
      ptBRCampaignFormatMessages,
      HREFS,
    );
    const link = screen.getByRole("link", { name: /^Quadrado 1:1/ });

    fireEvent.focus(link);
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("note")).toBeNull();
    expect(link).toHaveFocus();
    expect(link).not.toHaveAttribute("aria-expanded");
  });

  it("clique/toque fora fecha; clique dentro do popover não fecha", () => {
    renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    fireEvent.click(chip);
    const note = screen.getByRole("note");
    fireEvent.pointerDown(note);
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("note")).toBeNull();
    expect(chip).toHaveAttribute("aria-expanded", "false");
  });

  it("mover o ponteiro do chip para o popover mantém a ajuda aberta", () => {
    vi.useFakeTimers();
    renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    fireEvent.mouseEnter(chip);
    const note = screen.getByRole("note");
    fireEvent.mouseLeave(chip);
    fireEvent.mouseEnter(note);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("reabre por hover após sair e voltar (sem fixar)", () => {
    vi.useFakeTimers();
    renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    fireEvent.mouseEnter(chip);
    fireEvent.mouseLeave(chip);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(chip).toHaveAttribute("aria-expanded", "false");

    fireEvent.mouseEnter(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("somente um popover aberto por vez", () => {
    renderChips(joint("delivered", "delivered"));
    const square = chipByLabel(/^Quadrado 1:1/);
    const vertical = chipByLabel(/^Vertical 9:16/);

    fireEvent.mouseEnter(square);
    expect(screen.getAllByRole("note")).toHaveLength(1);

    fireEvent.mouseEnter(vertical);
    const notes = screen.getAllByRole("note");
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain("Vertical 9:16");
  });

  it("aria-controls só existe no chip-botão quando a ajuda está aberta", () => {
    renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    expect(chip).not.toHaveAttribute("aria-controls");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-controls");
    fireEvent.click(chip);
    expect(chip).not.toHaveAttribute("aria-controls");
  });

  it("remove listeners de fora/scroll/resize ao fechar e não reage após fechado", () => {
    const docAdd = vi.spyOn(document, "addEventListener");
    const docRemove = vi.spyOn(document, "removeEventListener");
    const winAdd = vi.spyOn(window, "addEventListener");
    const winRemove = vi.spyOn(window, "removeEventListener");

    try {
      renderChips(joint("delivered", "delivered"));
      const chip = chipByLabel(/^Quadrado 1:1/);

      for (let cycle = 0; cycle < 2; cycle += 1) {
        fireEvent.click(chip);
        expect(chip).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(chip);
        expect(chip).toHaveAttribute("aria-expanded", "false");
      }

      for (const type of ["pointerdown", "keydown"] as const) {
        const adds = docAdd.mock.calls.filter(([event]) => event === type).length;
        const removes = docRemove.mock.calls.filter(([event]) => event === type)
          .length;
        expect(adds).toBeGreaterThan(0);
        expect(removes).toBe(adds);
      }

      for (const type of ["resize", "scroll"] as const) {
        const adds = winAdd.mock.calls.filter(([event]) => event === type).length;
        const removes = winRemove.mock.calls.filter(([event]) => event === type)
          .length;
        expect(adds).toBeGreaterThan(0);
        expect(removes).toBe(adds);
      }

      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.pointerDown(document.body);
      expect(screen.queryByRole("note")).toBeNull();
    } finally {
      docAdd.mockRestore();
      docRemove.mockRestore();
      winAdd.mockRestore();
      winRemove.mockRestore();
    }
  });

  it("não deixa conteúdo focável na ajuda fechada e o popover não é focável", () => {
    const { container } = renderChips(joint("delivered", "delivered"));

    expect(screen.queryByRole("note")).toBeNull();
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);

    fireEvent.click(chipByLabel(/^Quadrado 1:1/));
    const note = screen.getByRole("note");
    expect(note.querySelectorAll("a, button, input, textarea, select")).toHaveLength(
      0,
    );
    expect(note).not.toHaveAttribute("tabindex");
  });

  it("preserva hit area ≥44×44 e foco visível no próprio chip (botão e link)", () => {
    renderChips(
      joint("delivered", "delivered"),
      ptBRCampaignFormatMessages,
      HREFS,
    );

    for (const chip of allChips()) {
      expect(chip.className).toContain("min-h-11");
      expect(chip.className).toContain("min-w-11");
      expect(chip.className).toContain("focus-visible:ring-2");
      expect(chip.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("chip de lista/dashboard não navega nem gera: só explica", () => {
    const { container } = renderChips(joint("delivered", "delivered"));
    const chip = chipByLabel(/^Quadrado 1:1/);

    fireEvent.click(chip);

    expect(chip.tagName).toBe("BUTTON");
    // Sem `href` as duas entradas continuam com o mesmo nome/estado.
    expect(chipByLabel(/^Vertical 9:16/)).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label^="Formatos"]').length).toBe(1);
  });

  it("não dispara fetch ao renderizar ou abrir a ajuda", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderChips(joint("delivered", "delivered"));
    fireEvent.click(chipByLabel(/^Quadrado 1:1/));

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
      chipByLabel(/^Cuadrado 1:1: Disponible$/),
    ).toBeInTheDocument();

    fireEvent.click(chipByLabel(/^Cuadrado 1:1/));

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
    for (const item of chipItems()) {
      expect(item.className).toContain("min-w-0");
      const chip = chipOf(item);
      expect(chip.className).toContain("inline-flex");
      expect(chip.querySelector("span.min-w-0")).not.toBeNull();
    }
  });

  it("não importa Supabase, storage, fetch, server-only, next/link nem HTML cru", () => {
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
    // O controle “?” e o nome acessível antigo foram removidos do componente.
    expect(source).not.toMatch(/HELP_BUTTON_CLASS/);
    expect(source).not.toMatch(/infoAria/);
    expect(source).not.toMatch(/role="group"\s+aria-label/);
  });
});
