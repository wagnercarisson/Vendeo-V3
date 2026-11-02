// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";

import { ptBRDashboardMessages } from "@/lib/i18n/dashboard";

import { DashboardHeader } from "../dashboard-header";

const messages = ptBRDashboardMessages.header;

function renderHeader(options: {
  greeting?: string;
  storeName?: string | null;
}) {
  return renderToString(
    <DashboardHeader
      greeting={options.greeting ?? "Boa tarde"}
      storeName={options.storeName === undefined ? "Loja Teste" : options.storeName}
      nameSeparator=", "
      messages={messages}
    />,
  );
}

describe("DashboardHeader", () => {
  it('renderiza saudação com o nome da loja em span lang=""', () => {
    const html = renderHeader({});

    expect(html).toContain("Boa tarde");
    expect(html).toContain(', <span lang="">Loja Teste</span>');
  });

  it("renderiza subtítulo desktop e mobile", () => {
    const html = renderHeader({});

    expect(html).toContain(messages.subtitleDesktop);
    expect(html).toContain(messages.subtitleMobile);
    expect(html).toContain("hidden sm:inline");
    expect(html).toContain("sm:hidden");
  });

  it("não renderiza PageHeader nem título 'Dashboard'", () => {
    const html = renderHeader({});

    expect(html).not.toContain("Dashboard");
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).not.toContain("PageHeader");
  });

  it("não renderiza botões internos de criação ou configuração", () => {
    const html = renderHeader({});

    expect(html).not.toContain('href="/campanhas/nova"');
    expect(html).not.toContain('href="/loja"');
    expect(html).not.toContain("Nova campanha");
    expect(html).not.toContain("Configurar loja");
  });

  it("mantém boas-vindas neutras sem loja", () => {
    const html = renderHeader({
      storeName: null,
      greeting: "Bem-vindo ao Vendeo",
    });

    expect(html).toContain("Bem-vindo ao Vendeo");
    expect(html).not.toContain('lang=""');
    expect(html).not.toContain("Nova campanha");
  });
});
