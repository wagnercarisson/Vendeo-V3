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
