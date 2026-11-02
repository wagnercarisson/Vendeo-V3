// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangelogAnnouncement } from "../changelog-announcement";
import {
  CHANGELOG_SEEN_KEY,
  CHANGELOG_DISMISSED_KEY,
} from "@/hooks/use-changelog-state";
import type { ChangelogEntry } from "@/lib/changelog/types";

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

function makeEntry(
  overrides: Partial<ChangelogEntry["frontmatter"]> = {},
): ChangelogEntry {
  return {
    frontmatter: {
      id: "fase-32-freemium-cnpj",
      title: "Freemium CNPJ",
      date: "2026-07-31",
      milestone: "v1.5",
      category: "feature",
      importance: "major",
      announcement: "card",
      ...overrides,
    },
    body: "## O que mudou\n\nAgora sua loja usa CNPJ.",
    slug: "2026-07-31-fase-32-freemium-cnpj",
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ChangelogAnnouncement", () => {
  it("exibe card discreto com titulo e botao Ver novidades quando announcement=card nao dispensada", () => {
    render(<ChangelogAnnouncement entry={makeEntry()} />);
    expect(screen.getByText("Freemium CNPJ")).toBeInTheDocument();
    expect(screen.getByText("Ver novidades")).toBeInTheDocument();
    expect(screen.getByLabelText("Fechar anúncio")).toBeInTheDocument();
  });

  it("retorna null quando announcement=none", () => {
    const { container } = render(
      <ChangelogAnnouncement entry={makeEntry({ announcement: "none" })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("clicar em x chama dismissAnnouncement e o card some", () => {
    render(<ChangelogAnnouncement entry={makeEntry()} />);
    fireEvent.click(screen.getByLabelText("Fechar anúncio"));

    expect(screen.queryByText("Freemium CNPJ")).not.toBeInTheDocument();
    expect(localStorage.getItem(CHANGELOG_DISMISSED_KEY)).toBe(
      "fase-32-freemium-cnpj",
    );
  });

  it("dispensar NÃO altera lastSeenId (SEEN_KEY nunca escrita)", () => {
    // Seed ANTES do spy — senão a escrita de seed seria registrada como chamada.
    localStorage.setItem(CHANGELOG_SEEN_KEY, "fase-34-store-readiness");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<ChangelogAnnouncement entry={makeEntry()} />);
    fireEvent.click(screen.getByLabelText("Fechar anúncio"));

    expect(
      setItemSpy.mock.calls.some(([key]) => key === CHANGELOG_SEEN_KEY),
    ).toBe(false);
    expect(localStorage.getItem(CHANGELOG_SEEN_KEY)).toBe(
      "fase-34-store-readiness",
    );
    expect(localStorage.getItem(CHANGELOG_DISMISSED_KEY)).toBe(
      "fase-32-freemium-cnpj",
    );
  });

  it("retorna null sem erro quando entry é null", () => {
    const { container } = render(<ChangelogAnnouncement entry={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

function makeCompactEntry(
  overrides: Partial<ChangelogEntry["frontmatter"]> = {},
): ChangelogEntry {
  return {
    ...makeEntry(overrides),
    body: "## O que mudou\n\n- Primeiro item do corpo completo.",
  };
}

const COMPACT_EXCERPT = "Trecho editorial derivado do conteúdo existente.";

describe("ChangelogAnnouncement — modo compacto", () => {
  it("exibe trecho e não renderiza o corpo markdown", () => {
    const { container } = render(
      <ChangelogAnnouncement
        entry={makeCompactEntry()}
        compact
        excerpt={COMPACT_EXCERPT}
      />,
    );

    expect(screen.getByText("Freemium CNPJ")).toBeInTheDocument();
    expect(screen.getByText(COMPACT_EXCERPT)).toBeInTheDocument();
    expect(screen.getByText("31/07/2026")).toBeInTheDocument();
    expect(container.querySelector("ul")).toBeNull();
    expect(screen.queryByText("Primeiro item do corpo completo.")).not.toBeInTheDocument();
    expect(screen.queryByText("O que mudou")).not.toBeInTheDocument();
  });

  it('aplica lang="pt-BR" apenas no título e no trecho', () => {
    render(
      <ChangelogAnnouncement
        entry={makeCompactEntry()}
        compact
        excerpt={COMPACT_EXCERPT}
      />,
    );

    const title = screen.getByRole("heading", { level: 2, name: "Freemium CNPJ" });
    expect(title).toHaveAttribute("lang", "pt-BR");
    expect(screen.getByText(COMPACT_EXCERPT)).toHaveAttribute("lang", "pt-BR");
    expect(screen.getByText("Ver novidades")).not.toHaveAttribute("lang");
    expect(screen.getByLabelText("Fechar anúncio")).not.toHaveAttribute("lang");
  });

  it("aceita entrada compacta apenas com frontmatter, sem body", () => {
    render(
      <ChangelogAnnouncement
        entry={{ frontmatter: makeEntry().frontmatter }}
        compact
        excerpt={COMPACT_EXCERPT}
      />,
    );

    expect(screen.getByText("Freemium CNPJ")).toBeInTheDocument();
    expect(screen.getByText(COMPACT_EXCERPT)).toBeInTheDocument();
    expect(screen.getByText("31/07/2026")).toBeInTheDocument();
  });

  it("usa rótulos localizados quando fornecidos", () => {
    render(
      <ChangelogAnnouncement
        entry={makeCompactEntry()}
        compact
        excerpt={COMPACT_EXCERPT}
        labels={{ view: "Ver novedades", close: "Cerrar anuncio" }}
      />,
    );

    expect(screen.getByText("Ver novedades")).toBeInTheDocument();
    expect(screen.getByLabelText("Cerrar anuncio")).toBeInTheDocument();
  });

  it("mantém título, data e ações quando o trecho é nulo", () => {
    const { container } = render(
      <ChangelogAnnouncement
        entry={makeCompactEntry()}
        compact
        excerpt={null}
      />,
    );

    expect(screen.getByText("Freemium CNPJ")).toBeInTheDocument();
    expect(screen.getByText("31/07/2026")).toBeInTheDocument();
    expect(screen.getByText("Ver novidades")).toBeInTheDocument();
    expect(container.querySelector("ul")).toBeNull();
  });

  it('preserva o modal quando announcement="modal"', () => {
    render(
      <ChangelogAnnouncement
        entry={makeCompactEntry({ announcement: "modal" })}
        compact
        excerpt={COMPACT_EXCERPT}
        labels={{ dialogLabel: "Novidades" }}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Novidades");
    expect(screen.getByText(COMPACT_EXCERPT)).toBeInTheDocument();
  });

  it("dispensar no compacto não grava CHANGELOG_SEEN_KEY", () => {
    localStorage.setItem(CHANGELOG_SEEN_KEY, "fase-34-store-readiness");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <ChangelogAnnouncement
        entry={makeCompactEntry()}
        compact
        excerpt={COMPACT_EXCERPT}
      />,
    );
    fireEvent.click(screen.getByLabelText("Fechar anúncio"));

    expect(
      setItemSpy.mock.calls.some(([key]) => key === CHANGELOG_SEEN_KEY),
    ).toBe(false);
    expect(screen.queryByText("Freemium CNPJ")).not.toBeInTheDocument();
    expect(localStorage.getItem(CHANGELOG_DISMISSED_KEY)).toBe(
      "fase-32-freemium-cnpj",
    );
  });
});
