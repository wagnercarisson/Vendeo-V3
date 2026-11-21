// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

import { ptBRDashboardMessages } from "@/lib/i18n/dashboard";
import type { EligibleCampaignCard } from "@/lib/dashboard/campaigns";
import {
  buildIndividualFormatPresentation,
  buildJointFormatPresentation,
  buildUnavailableFormatPresentation,
} from "@/lib/campaign/format-presentation";

import { DashboardCampaigns } from "../dashboard-campaigns";

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

const messages = ptBRDashboardMessages.campaigns;

function makeItems(...ids: string[]): EligibleCampaignCard[] {
  return ids.map((id, index) => ({
    id,
    productName: `Produto ${index + 1}`,
    createdAt: "2026-10-19T10:00:00.000Z",
    thumbnailUrl: `https://cdn.test/${id}.jpg`,
    format: index % 2 === 0 ? "1:1" : "9:16",
    formatPresentation: buildIndividualFormatPresentation({
      resolution:
        index % 2 === 0
          ? { kind: "1:1", source: "absent" }
          : {
              kind: "9:16",
              contractVersion: "f59-vertical-9-16-v1",
            },
      lifecycle: "delivered",
    }),
  }));
}

function renderSection(options: {
  count: number;
  items?: EligibleCampaignCard[];
  failure?: boolean;
}) {
  const items = options.items ?? [];
  const dateLabels = Object.fromEntries(
    items.map((item) => [item.id, "19 de out. de 2026"]),
  );
  const openAriaLabels = Object.fromEntries(
    items.map((item) => [item.id, `Abrir campanha ${item.productName}`]),
  );

  return renderToString(
    <DashboardCampaigns
      count={options.count}
      items={items}
      messages={messages}
      failure={options.failure}
      dateLabels={dateLabels}
      openAriaLabels={openAriaLabels}
    />,
  );
}

describe("DashboardCampaigns", () => {
  it("renderiza o estado vazio sem cartões quando count é 0", () => {
    const html = renderSection({ count: 0 });

    expect(html).toContain(messages.emptyTitle);
    expect(html).toContain(messages.emptyBody);
    expect(html).toContain('href="/campanhas/nova"');
    expect(html).not.toContain("href=\"/campanhas/c");
  });

  it("renderiza no máximo os itens recebidos com link por campanha e 'Ver todas'", () => {
    const items = makeItems("c1", "c2", "c3");
    const html = renderSection({ count: 3, items });

    expect(html.match(/href="\/campanhas\/c/g)?.length).toBe(3);
    expect(html).toContain("Produto 1");
    expect(html).toContain(messages.viewAll);
    expect(html).toContain(messages.orientation);
    expect(html).toContain('href="/campanhas"');
    expect(html).not.toContain("grid-cols-3");
  });

  it("usa o painel role=\"status\" na falha, sem contagem nem '0 campanhas'", () => {
    const html = renderSection({ count: 0, failure: true });

    expect(html).toContain('role="status"');
    expect(html).toContain(messages.failureTitle);
    expect(html).toContain(messages.failureBody);
    expect(html).toContain('href="/campanhas"');
    expect(html).not.toContain("sr-only");
    expect(html).not.toContain("min-w-[32px]");
    expect(html).not.toContain("0 campanhas disponíveis");
    expect(html).not.toContain("0 campanha disponível");
    expect(html).not.toContain(messages.emptyTitle);
  });

  it("expõe a contagem secundária no singular", () => {
    const html = renderSection({ count: 1, items: makeItems("c1") });

    expect(html).not.toContain("sr-only");
    expect(html).toContain("1 campanha disponível");
  });

  it("expõe a contagem secundária no plural para count > 1", () => {
    const html = renderSection({ count: 3, items: makeItems("c1", "c2", "c3") });

    expect(html).toContain("3 campanhas disponíveis");
    expect(html).not.toContain("3 campanha disponível");
  });

  it("F61: exibe os dois chips de formato em cada cartão", () => {
    const html = renderSection({ count: 2, items: makeItems("c1", "c2") });

    expect(html).toContain("Quadrado 1:1");
    expect(html).toContain("Vertical 9:16");
    expect(html).toContain("Disponível");
    expect(html).toContain("Não incluído");
    // Dois chips por cartão: 4 itens de lista para 2 cartões.
    expect(html.match(/<li /g)?.length).toBe(4);
  });

  it("F61: formato indisponível exibe os dois chips como indisponíveis", () => {
    const html = renderSection({
      count: 1,
      items: [
        {
          ...makeItems("c1")[0],
          format: null,
          formatPresentation: buildUnavailableFormatPresentation(),
        },
      ],
    });

    expect(html).toContain("Indisponível");
    expect(html).not.toContain("1:1 quadrado");
    expect(html).not.toContain("Não gerado");
  });

  it("F61: chips não são links (apenas a abertura da campanha)", () => {
    const html = renderSection({ count: 1, items: makeItems("c1") });

    // Um único link de campanha, nenhum link dentro da lista de formatos.
    expect(html.match(/href="\/campanhas\/c/g)?.length).toBe(1);
    expect(html).not.toContain("?format=");
  });

  it("F61: conjunta parcial não duplica a linha e preserva openHref", () => {
    const html = renderSection({
      count: 1,
      items: [
        {
          ...makeItems("c1")[0],
          format: null,
          joint: true,
          formats: { "1:1": "delivered", "9:16": "absent" },
          preferredFormat: "1:1",
          formatPresentation: buildJointFormatPresentation({
            "1:1": { state: "delivered", refunded: false },
            "9:16": { state: "absent", refunded: true },
          }),
        },
      ],
    });

    expect(html.match(/href="\/campanhas\/c/g)?.length).toBe(1);
    expect(html).toContain('href="/campanhas/c1?format=1:1"');
    expect(html).toContain("Disponível");
    expect(html).toContain("Crédito devolvido");
    expect(html).toContain("1 campanha disponível");
  });

  it("não renderiza badges de status técnico nos cartões", () => {
    const html = renderSection({ count: 2, items: makeItems("c1", "c2") });

    expect(html).not.toContain("Pronta");
    expect(html).not.toContain("Erro");
    expect(html).not.toContain("Gerando");
  });
});
