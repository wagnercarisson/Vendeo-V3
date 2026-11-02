// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

import { ptBRDashboardMessages } from "@/lib/i18n/dashboard";

import { DashboardShortcut } from "../dashboard-shortcut";

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

describe("DashboardShortcut", () => {
  it("renderiza o convite fixo e o link para criar campanha", () => {
    const html = renderToString(
      <DashboardShortcut messages={ptBRDashboardMessages.shortcut} />,
    );

    expect(html).toContain("Que tal criar sua próxima campanha?");
    expect(html).toContain("Criar campanha");
    expect(html).toContain('href="/campanhas/nova"');
    expect(html).toContain("min-h-[44px]");
  });
});
