// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import Home from "@/app/page";
import { getAllEntries } from "@/lib/changelog/get-changelog";
import type { ChangelogEntry } from "@/lib/changelog/types";

// Fixture determinística do changelog — a factory makeEntry segue o padrão do
// changelog-announcement.test.tsx. vi.hoisted evita o TDZ do vi.mock factory.
const { FIXTURE_ENTRIES } = vi.hoisted(() => {
  function makeEntry(
    overrides: Partial<ChangelogEntry["frontmatter"]> = {},
  ): ChangelogEntry {
    return {
      frontmatter: {
        id: "entry-1",
        title: "Título de teste",
        date: "2026-07-31",
        category: "feature",
        importance: "minor",
        announcement: "none",
        ...overrides,
      },
      body: "## O que mudou\n\nConteúdo da novidade.",
      slug: "2026-07-31-entry",
    };
  }
  return {
    FIXTURE_ENTRIES: [
      makeEntry({
        id: "e1",
        title: "Primeira novidade",
        date: "2026-08-14",
        importance: "major",
      }),
      makeEntry({
        id: "e2",
        title: "Segunda novidade",
        date: "2026-08-10",
        category: "improvement",
      }),
      makeEntry({
        id: "e3",
        title: "Terceira novidade",
        date: "2026-08-05",
        category: "fix",
      }),
    ],
  };
});

vi.mock("@/lib/changelog/get-changelog", () => ({
  getAllEntries: vi.fn().mockResolvedValue(FIXTURE_ENTRIES),
}));

function getProminentNovidades(): HTMLElement {
  const acessoSection = document.getElementById("acesso");
  expect(acessoSection).not.toBeNull();
  return within(acessoSection as HTMLElement).getByRole("button", {
    name: "Novidades",
  });
}

describe("Landing page (/)", () => {
  beforeEach(() => {
    vi.mocked(getAllEntries).mockResolvedValue(FIXTURE_ENTRIES);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders hero headline", async () => {
    render(await Home());
    expect(
      screen.getByRole("heading", { name: /Campanhas profissionais/ }),
    ).toBeInTheDocument();
  });

  it("renders primary CTA to request access (anchor to form)", async () => {
    render(await Home());
    const cta = screen.getByRole("link", { name: "Solicitar acesso free" });
    expect(cta).toHaveAttribute("href", "#acesso");
  });

  it("renders secondary CTA Entrar pointing to /login", async () => {
    render(await Home());
    const loginLinks = screen.getAllByRole("link", { name: "Entrar" });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0]).toHaveAttribute("href", "/login");
  });

  it("renders the access request form (email input)", async () => {
    render(await Home());
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Solicitar acesso free" }),
    ).toBeInTheDocument();
  });

  it("hides hero CTA and shows 'Solicitação enviada' card after submitting", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(await Home());

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "loja@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar acesso free" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Solicitação enviada")).toBeInTheDocument();
    });

    // Hero CTA some — usuário já enviou; não deve permitir re-envio
    expect(
      screen.queryByRole("link", { name: "Solicitar acesso free" }),
    ).not.toBeInTheDocument();
    // Card mantém a sequência "recebemos sua solicitação..." + "em breve entraremos em contato"
    expect(screen.getByText(/Recebemos sua solicitação/)).toBeInTheDocument();
    expect(screen.getByText(/Em breve entraremos em contato/)).toBeInTheDocument();
  });

  it("renders prominent Novidades button below the access card", async () => {
    render(await Home());
    const prominent = getProminentNovidades();
    expect(prominent).toBeInTheDocument();
  });

  it("renders discreet Novidades button in the footer nav", async () => {
    render(await Home());
    const footerNav = screen.getByRole("navigation");
    expect(
      within(footerNav).getByRole("button", { name: "Novidades" }),
    ).toBeInTheDocument();
  });

  it("opens dialog with fixture entry titles when prominent Novidades is clicked", async () => {
    render(await Home());
    fireEvent.click(getProminentNovidades());

    const dialog = screen.getByRole("dialog", { name: "Novidades" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Primeira novidade")).toBeInTheDocument();
    expect(within(dialog).getByText("Segunda novidade")).toBeInTheDocument();
    expect(within(dialog).getByText("Terceira novidade")).toBeInTheDocument();
  });

  it("closes dialog on × click and returns focus to the trigger", async () => {
    render(await Home());
    const prominent = getProminentNovidades();
    fireEvent.click(prominent);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar novidades" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(prominent).toHaveFocus();
    });
  });

  it("closes dialog on Escape key", async () => {
    render(await Home());
    fireEvent.click(getProminentNovidades());
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("renders changelog empty state in the modal when there are no entries", async () => {
    vi.mocked(getAllEntries).mockResolvedValue([]);
    render(await Home());

    fireEvent.click(getProminentNovidades());

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Nenhuma novidade por enquanto."),
    ).toBeInTheDocument();
  });
});
