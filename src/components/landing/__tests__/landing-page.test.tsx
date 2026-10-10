// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: vi.fn(async () => ({
    publicSignupEnabled: flagMock.publicSignupEnabled,
  })),
}));

vi.mock("@/lib/changelog/get-changelog", () => ({
  getAllEntries: vi.fn(async () => []),
}));

vi.mock("@/components/changelog/changelog-list", () => ({
  ChangelogList: () => <span data-testid="changelog-list" />,
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

beforeEach(() => {
  setFlag(false);
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

  it("flag off: hero/oferta/final renderizam 'Solicitar acesso free' → #acesso com texto escuro (D-19) e o formulário presente", async () => {
    const { container } = render(await Home());

    const ctas = screen.getAllByRole("link", { name: "Solicitar acesso free" });
    expect(ctas).toHaveLength(3);
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
});

describe("Landing page — ambos os modos da flag para hero/oferta/final", () => {
  it("flag on: hero/oferta/final renderizam Google + 'Continuar com email' → /signup e o formulário ausente", async () => {
    setFlag(true);
    const { container } = render(await Home());

    const google = screen.getAllByRole("button", { name: "Continuar com Google" });
    expect(google).toHaveLength(3);
    google.forEach((button) => {
      expect(button).toHaveAttribute("data-variant", "solid");
      expect(button).toHaveAttribute("data-fullwidth", "true");
    });

    const emailLinks = screen.getAllByRole("link", { name: "Continuar com email" });
    expect(emailLinks).toHaveLength(3);
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
