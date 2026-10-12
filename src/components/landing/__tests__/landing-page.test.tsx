// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAllEntries } from "@/lib/changelog/get-changelog";
import type { ChangelogEntry } from "@/lib/changelog/types";

/**
 * Composition / copy / flag-mode test for the public landing server page.
 *
 * The page is an async server component: `getLaunchConfig` (flag) and
 * `getAllEntries` (changelog) are mocked so the render never touches the
 * filesystem. The acquisition CTA's GoogleButton is mocked (it would otherwise
 * pull the Supabase browser client). The flag value is read once server-side
 * and forwarded to every acquisition block.
 *
 * Hard guarantee (D-09 / threat T-51.1-07-01): no code path reaches a remote
 * de geração/provider route. `fetch` is stubbed and asserted to be inert.
 */

const flagMock = vi.hoisted(() => ({ publicSignupEnabled: false }));

// Fixture determinística do changelog (mesmo padrão do changelog-announcement.test.tsx
// e do antigo teste legado A9). Apenas a FONTE DE DADOS é mockada — `ChangelogList` e
// `NovidadesLink` NÃO são mockados, para exercitar o componente real (títulos e estado
// vazio reais) e não fabricar o resultado pelo mock.
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

vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: vi.fn(async () => ({
    publicSignupEnabled: flagMock.publicSignupEnabled,
  })),
}));

vi.mock("@/lib/changelog/get-changelog", () => ({
  getAllEntries: vi.fn(async () => FIXTURE_ENTRIES),
}));

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: ({
    variant,
    fullWidth,
  }: {
    variant?: string;
    fullWidth?: boolean;
  }) => (
    <button
      type="button"
      data-variant={variant}
      data-fullwidth={String(fullWidth)}
    >
      Continuar com Google
    </button>
  ),
}));

import Home from "@/app/page";

const HEADLINE =
  "O que seu negócio quer divulgar vira uma campanha pronta para publicar.";
const SUBHEADLINE =
  "Você informa o básico. O Vendeo prepara a campanha completa — com arte e texto — pronta para publicar.";
const HERO_DISTINCTION = "Você define como quer apresentar.";

// Seven approved blocks, in the fixed delivery order.
const BLOCK_HEADINGS = [
  HEADLINE, // hero (h1)
  "Da informação à campanha, sem complicação", // transformação (h2)
  "Escolha como apresentar seu produto.", // apresentação do produto (h2)
  "Fica com a cara da sua loja — e você decide", // identidade e controle (h2)
  "Uma campanha para cada jeito de divulgar.", // abordagens de divulgação (h2)
  "Teste gratuitamente, sem cartão de crédito", // oferta (h2)
  "Perguntas frequentes", // FAQ / CTA final (h2)
];

// Rotas remotas de geração/provider que a landing jamais deve alcançar.
const FORBIDDEN_ROUTE = /\/api\/(generate|campaigns|provider)/i;

function setFlag(value: boolean) {
  flagMock.publicSignupEnabled = value;
}

// Gatilho VÁLIDO na landing atual (ground truth): `Novidades` existe SOMENTE no
// rodapé (`NovidadesLink variant="footer"`, botão dentro de `footer nav`). O helper
// do antigo A9 — que buscava o botão dentro de `#acesso` — é OBSOLETO e NÃO é
// preservado: o formulário não renderiza mais `Novidades`.
function getFooterNovidades(container: HTMLElement): HTMLElement {
  const footer = container.querySelector("footer");
  if (!footer) throw new Error("footer ausente");
  return within(footer as HTMLElement).getByRole("button", { name: "Novidades" });
}

beforeEach(() => {
  setFlag(false);
  vi.mocked(getAllEntries).mockResolvedValue(FIXTURE_ENTRIES);
});

afterEach(() => {
  setFlag(false);
  vi.unstubAllGlobals();
});

describe("Landing page — composição e copy (flag off)", () => {
  it("renderiza a headline, a subheadline e a linha de distinção aprovadas", async () => {
    const { container } = render(await Home());
    const text = container.textContent ?? "";

    expect(
      screen.getByRole("heading", { level: 1, name: HEADLINE }),
    ).toBeInTheDocument();
    expect(screen.getByText(SUBHEADLINE)).toBeInTheDocument();
    expect(text).toContain(HERO_DISTINCTION);
  });

  it("apresenta os sete blocos na ordem fixa aprovada", async () => {
    const { container } = render(await Home());
    const headings = Array.from(
      container.querySelectorAll("h1, h2"),
    ).map((el) => el.textContent?.trim() ?? "");

    const indices = BLOCK_HEADINGS.map((heading) => headings.indexOf(heading));
    expect(indices.every((index) => index >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it("não renderiza um bloco 'Como funciona' separado", async () => {
    render(await Home());
    expect(
      screen.queryByRole("heading", { name: "Como funciona" }),
    ).not.toBeInTheDocument();
  });

  it("não expõe termos internos (briefing, intenção, F56) no conteúdo público", async () => {
    const { container } = render(await Home());
    expect(container.textContent ?? "").not.toMatch(/briefing|intenção|F56/i);
  });

  it("renderiza Novidades na posição secundária (rodapé)", async () => {
    const { container } = render(await Home());
    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByText("Novidades")).toBeInTheDocument();
  });

  // 4 interações válidas de Novidades migradas do antigo A9 (C2 — migrate-then-delete),
  // com o gatilho do RODAPÉ e os componentes reais (títulos/estado vazio reais).
  it("abre o diálogo de Novidades pelo gatilho do rodapé com os títulos reais do fixture", async () => {
    const { container } = render(await Home());
    fireEvent.click(getFooterNovidades(container));

    const dialog = screen.getByRole("dialog", { name: "Novidades" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Primeira novidade")).toBeInTheDocument();
    expect(within(dialog).getByText("Segunda novidade")).toBeInTheDocument();
    expect(within(dialog).getByText("Terceira novidade")).toBeInTheDocument();
  });

  it("fecha o diálogo pelo botão 'Fechar novidades' e devolve o foco ao gatilho do rodapé", async () => {
    const { container } = render(await Home());
    const trigger = getFooterNovidades(container);
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar novidades" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("fecha o diálogo de Novidades com a tecla Escape", async () => {
    const { container } = render(await Home());
    fireEvent.click(getFooterNovidades(container));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("mostra o estado vazio real do changelog no diálogo quando não há entradas", async () => {
    vi.mocked(getAllEntries).mockResolvedValue([]);
    const { container } = render(await Home());

    fireEvent.click(getFooterNovidades(container));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Nenhuma novidade por enquanto."),
    ).toBeInTheDocument();
  });

  it("torna as faixas de demonstração focáveis por teclado e sem auto-advance", async () => {
    const { container } = render(await Home());
    const strips = container.querySelectorAll('ul[tabindex="0"]');
    expect(strips.length).toBeGreaterThanOrEqual(2);
    strips.forEach((strip) => {
      expect(strip).toHaveAttribute("tabindex", "0");
      expect(strip.className).toContain("scroll-snap");
    });
    expect(container.querySelectorAll("[data-auto-advance]").length).toBe(0);
  });

  it("flag off: hero/transformação/identidade/oferta renderizam 'Solicitar acesso free' → #acesso com texto escuro (D-19) e o formulário presente", async () => {
    const { container } = render(await Home());

    const ctas = screen.getAllByRole("link", { name: "Solicitar acesso free" });
    expect(ctas).toHaveLength(4);
    ctas.forEach((cta) => {
      expect(cta).toHaveAttribute("href", "#acesso");
      expect(cta.className).toContain("text-bg-deep");
      expect(cta.className).not.toContain("text-white");
    });

    expect(container.querySelector("#acesso")).not.toBeNull();
    expect(container.querySelector("#acesso form")).not.toBeNull();

    // D-19 local override on the form submit (dark text over green).
    expect(
      screen.getByRole("button", { name: "Solicitar acesso free" }).className,
    ).toContain("!text-bg-deep");

    expect(
      screen.queryByRole("button", { name: "Continuar com Google" }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-public-signup-enabled="false"]').length).toBeGreaterThanOrEqual(1);
  });

  it("'Entrar' é sempre a ação secundária, nunca o CTA de aquisição", async () => {
    render(await Home());

    const entrar = screen.getAllByRole("link", { name: "Entrar" });
    expect(entrar.length).toBeGreaterThanOrEqual(1);
    entrar.forEach((link) => expect(link).toHaveAttribute("href", "/login"));

    screen
      .getAllByRole("link", { name: "Solicitar acesso free" })
      .forEach((cta) => expect(cta).not.toHaveAttribute("href", "/login"));
  });

  it("carrega o hero sem lazy e as imagens abaixo dele com lazy (dimensões estáveis)", async () => {
    const { container } = render(await Home());

    const hero = container.querySelector(
      'img[alt="Campanha de oferta de café da Mercearia Tio João"]',
    );
    expect(hero).not.toBeNull();
    expect(hero).toHaveAttribute("loading", "eager");

    expect(
      container.querySelectorAll('img[loading="eager"]').length,
    ).toBe(1);
    expect(
      container.querySelectorAll('img[loading="lazy"]').length,
    ).toBeGreaterThanOrEqual(6);
  });

  it("usa o logo (imagem, alt 'Vendeo') no cabeçalho e no rodapé", async () => {
    const { container } = render(await Home());
    const logos = container.querySelectorAll('img[alt="Vendeo"]');
    expect(logos.length).toBeGreaterThanOrEqual(2);
    logos.forEach((logo) => {
      expect(logo).toHaveAttribute("src", "/landing/vendeo-logo-dark.webp");
    });
  });

  it("CTA de aquisição na transformação e na identidade; ausente após a FAQ; seta decorativa na transformação", async () => {
    const { container } = render(await Home());

    // Four acquisition CTAs: hero, transformação, identidade, oferta.
    expect(container.querySelectorAll('a[href="#acesso"]').length).toBe(4);

    const faqSection = container.querySelector(
      'section[aria-labelledby="perguntas-frequentes-heading"]',
    );
    expect(faqSection).not.toBeNull();
    expect(
      (faqSection as HTMLElement).querySelector('a[href="#acesso"]'),
    ).toBeNull();

    const transformSection = container.querySelector(
      'section[aria-labelledby="transformacao-heading"]',
    );
    expect(
      (transformSection as HTMLElement).querySelector(
        '[aria-hidden="true"] svg',
      ),
    ).not.toBeNull();
  });
});

describe("Landing page — ambos os modos da flag para hero/oferta/final", () => {
  it("flag on: hero/transformação/identidade/oferta renderizam Google + 'Continuar com email' → /signup e o formulário ausente", async () => {
    setFlag(true);
    const { container } = render(await Home());

    const google = screen.getAllByRole("button", { name: "Continuar com Google" });
    expect(google).toHaveLength(4);
    google.forEach((button) => {
      expect(button).toHaveAttribute("data-variant", "solid");
      expect(button).toHaveAttribute("data-fullwidth", "true");
    });

    const emailLinks = screen.getAllByRole("link", { name: "Continuar com email" });
    expect(emailLinks).toHaveLength(4);
    emailLinks.forEach((link) => expect(link).toHaveAttribute("href", "/signup"));

    expect(container.querySelector("#acesso")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Solicitar acesso free" }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-public-signup-enabled="true"]').length).toBeGreaterThanOrEqual(1);
  });

  it("não invoca nenhuma rota remota de geração/provider: fetch permanece inerte (D-09)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(await Home());
    expect(fetchMock).not.toHaveBeenCalled();

    setFlag(true);
    render(await Home());
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toMatch(FORBIDDEN_ROUTE);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
