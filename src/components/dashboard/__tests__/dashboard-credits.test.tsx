// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

import {
  es419DashboardMessages,
  ptBRDashboardMessages,
} from "@/lib/i18n/dashboard";
import type { DashboardCreditState } from "@/lib/dashboard/credits";

import { DashboardCredits } from "../dashboard-credits";

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

const messages = ptBRDashboardMessages.credits;

function renderCredits(state: DashboardCreditState, locale: "pt-BR" | "es-419" = "pt-BR") {
  return renderToString(
    <DashboardCredits
      state={state}
      messages={
        locale === "es-419" ? es419DashboardMessages.credits : messages
      }
      locale={locale}
    />,
  );
}

describe("DashboardCredits", () => {
  it("exibe número e unidade no estado available, com link para /conta", () => {
    const html = renderCredits({ state: "available", availableBalance: 7 });

    expect(html).toContain(">7<");
    expect(html).toContain(messages.unitPlural);
    expect(html).toContain('href="/conta"');
    expect(html).toContain(`aria-label="${messages.detailsAria}"`);
    expect(html).toContain(messages.sectionLabel);
  });

  it("usa o singular para saldo 1", () => {
    const html = renderCredits({ state: "available", availableBalance: 1 });

    expect(html).toContain(`>${messages.unitSingular}</span>`);
    expect(html).not.toContain(`>${messages.unitPlural}</span>`);
  });

  it("no estado zero renderiza apenas a string completa, sem número duplicado", () => {
    const html = renderCredits({ state: "zero", availableBalance: 0 });

    expect(html.split(messages.zero).length - 1).toBe(1);
    expect(html).not.toContain("0 0");
    expect(html).not.toContain(messages.unavailable);
    expect(html).toContain('href="/conta"');
  });

  it("no estado zero em es-419 usa a string localizada uma única vez", () => {
    const html = renderCredits({ state: "zero", availableBalance: 0 }, "es-419");

    expect(html.split(es419DashboardMessages.credits.zero).length - 1).toBe(1);
    expect(html).not.toContain("0 0");
  });

  it("no estado unavailable mostra ícone âmbar e nenhum zero/traço", () => {
    const html = renderCredits({ state: "unavailable" });

    expect(html).toContain(messages.unavailable);
    expect(html).toContain("text-accent-amber");
    expect(html).not.toContain(">0<");
    expect(html).not.toContain("—");
    expect(html).toContain('href="/conta"');
  });

  it("não renderiza BalanceDisplay nem detalhamento de demo/bônus", () => {
    const html = renderCredits({ state: "available", availableBalance: 12 });

    expect(html).not.toContain("BalanceDisplay");
    expect(html).not.toContain("demo");
    expect(html).not.toContain("Bônus");
  });
});
