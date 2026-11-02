// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

import { ptBRDashboardMessages } from "@/lib/i18n/dashboard";

import { DashboardHeader } from "../dashboard-header";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const messages = ptBRDashboardMessages.header;

function renderHeader(options: {
  greeting?: string;
  storeName?: string | null;
  showPrimaryCta?: boolean;
  showSecondaryCta?: boolean;
}) {
  return renderToString(
    <DashboardHeader
      greeting={options.greeting ?? "Boa tarde"}
      storeName={options.storeName === undefined ? "Loja Teste" : options.storeName}
      nameSeparator=", "
      showPrimaryCta={options.showPrimaryCta ?? true}
      showSecondaryCta={options.showSecondaryCta ?? true}
      messages={messages}
    />,
  );
}

describe("DashboardHeader", () => {
  it("renderiza saudação com o nome da loja em span lang=\"\"", () => {
    const html = renderHeader({});

    expect(html).toContain("Boa tarde");
    expect(html).toContain(', <span lang="">Loja Teste</span>');
  });

  it("não renderiza PageHeader nem título 'Dashboard'", () => {
    const html = renderHeader({});

    expect(html).not.toContain("Dashboard");
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).not.toContain("PageHeader");
  });

  it("renderiza a CTA primária apenas quando showPrimaryCta", () => {
    const withPrimary = renderHeader({ showPrimaryCta: true });
    const withoutPrimary = renderHeader({ showPrimaryCta: false });

    expect(withPrimary).toContain('href="/campanhas/nova"');
    expect(withPrimary).toContain(messages.primaryCta);
    expect(withoutPrimary).not.toContain('href="/campanhas/nova"');
  });

  it("renderiza a CTA secundária quando showSecondaryCta", () => {
    const html = renderHeader({ showSecondaryCta: true });

    expect(html).toContain('href="/loja"');
    expect(html).toContain(messages.secondaryCta);
  });

  it("não renderiza ações sem loja (ambos os CTAs desligados)", () => {
    const html = renderHeader({
      storeName: null,
      greeting: "Bem-vindo ao Vendeo",
      showPrimaryCta: false,
      showSecondaryCta: false,
    });

    expect(html).toContain("Bem-vindo ao Vendeo");
    expect(html).not.toContain('href="/campanhas/nova"');
    expect(html).not.toContain('href="/loja"');
    expect(html).not.toContain('lang=""');
  });

  it("aplica alvos de 44 px e foco visível nas ações", () => {
    const html = renderHeader({});

    expect(html.match(/min-h-\[44px\]/g)?.length).toBe(2);
    expect(html.match(/focus-visible:ring-2/g)?.length).toBe(2);
  });
});
