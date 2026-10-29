// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

import { NOINDEX_ROBOTS, getSurfacePolicy } from "@/lib/seo/indexation-policy";
import { ptBRMessages } from "@/lib/i18n/catalogs/pt-BR";
import { es419Messages } from "@/lib/i18n/catalogs/es-419";

/**
 * F57.4 — página `/configuracoes` (Server Component).
 *
 * Cobre: rota autenticada sem loja, leitura server-side sem escrita, estado de
 * erro com retry e sem formulário, `lang` escopado e política de indexação.
 * O mock de `next/navigation` é obrigatório porque o estado de erro é client e
 * chama `useRouter()` durante o render SSR.
 */

const mockRequirePageUser = vi.fn();
const mockGetUiRenderContext = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: mockGetUiRenderContext,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const okPtBr = {
  ok: true as const,
  locale: "pt-BR" as const,
  preference: { uiLocale: "pt-BR" as const, source: "explicit" as const, version: 3 },
};

const okEs419 = {
  ok: true as const,
  locale: "es-419" as const,
  preference: { uiLocale: "es-419" as const, source: "explicit" as const, version: 4 },
};

const failure = {
  ok: false as const,
  locale: "pt-BR" as const,
  errorCode: "preferences_read_timeout" as const,
};

async function renderPage(): Promise<string> {
  const { default: ConfiguracoesPage } = await import(
    "@/app/(app)/configuracoes/page"
  );
  return renderToString(await ConfiguracoesPage());
}

function radioTagFor(html: string, value: string): string | null {
  const valueIndex = html.indexOf(`value="${value}"`);
  if (valueIndex === -1) return null;
  const start = html.lastIndexOf("<input", valueIndex);
  const end = html.indexOf(">", valueIndex);
  if (start === -1 || end === -1) return null;
  return html.slice(start, end + 1);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePageUser.mockResolvedValue({
    userId: "user-123",
    claims: { sub: "user-123" },
  });
});

describe("ConfiguracoesPage — leitura e conteúdo", () => {
  it("renderiza título/breadcrumb traduzidos e as duas opções com a persistida marcada", async () => {
    mockGetUiRenderContext.mockResolvedValue(okPtBr);

    const html = await renderPage();

    expect(mockRequirePageUser).toHaveBeenCalledTimes(1);
    expect(mockGetUiRenderContext).toHaveBeenCalledWith("user-123");

    expect(html).toContain(ptBRMessages.settings.title);
    expect(html).toContain(ptBRMessages.settings.breadcrumbDashboard);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain(ptBRMessages.settings.languageSection);
    expect(html).toContain(ptBRMessages.settings.optionPtBr);
    expect(html).toContain(ptBRMessages.settings.optionEs419);

    const ptRadio = radioTagFor(html, "pt-BR");
    const esRadio = radioTagFor(html, "es-419");
    expect(ptRadio).not.toBeNull();
    expect(esRadio).not.toBeNull();
    expect(ptRadio).toContain("checked");
    expect(esRadio).not.toContain("checked");
  });

  it("usuário sem loja renderiza a página sem depender de store-ownership", async () => {
    mockGetUiRenderContext.mockResolvedValue(okPtBr);

    const html = await renderPage();
    expect(html).toContain(ptBRMessages.settings.title);

    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/configuracoes/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/store-ownership|getCurrentStore|CreditService/);
  });

  it("falha de leitura renderiza card de erro com retry e nenhum formulário", async () => {
    mockGetUiRenderContext.mockResolvedValue(failure);

    const html = await renderPage();

    expect(html).toContain('role="alert"');
    expect(html).toContain(ptBRMessages.settings.error.load);
    expect(html).toContain(ptBRMessages.common.retry);
    expect(html).not.toContain('type="radio"');
  });

  it("aplica lang='es-419' somente quando o locale é espanhol", async () => {
    mockGetUiRenderContext.mockResolvedValue(okEs419);
    const esHtml = await renderPage();
    expect(esHtml).toContain('lang="es-419"');
    expect(esHtml).toContain(es419Messages.settings.title);
    expect(esHtml).toContain(es419Messages.settings.optionEs419);

    mockGetUiRenderContext.mockResolvedValue(okPtBr);
    const ptHtml = await renderPage();
    expect(ptHtml).not.toContain('lang="es-419"');
  });
});

describe("ConfiguracoesPage — política de indexação", () => {
  it("/configuracoes resolve NOINDEX_ROBOTS e fica fora do sitemap", () => {
    const policy = getSurfacePolicy("/configuracoes");
    expect(policy.robots).toEqual(NOINDEX_ROBOTS);
    expect(policy.inSitemap).toBe(false);
  });
});
