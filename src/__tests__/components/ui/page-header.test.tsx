// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { PageHeader } from "@/components/ui/page-header";
import React from "react";

describe("PageHeader", () => {
  it("renders title with breadcrumbs", () => {
    const html = renderToString(
      <PageHeader
        title="Campanha"
        breadcrumbs={[
          { label: "Campanhas", href: "/campanhas" },
          { label: "Campanha Atual" },
        ]}
      />,
    );
    expect(html).toContain("Campanha");
    expect(html).toContain('href="/campanhas"');
    expect(html).toContain("Campanhas");
    expect(html).toContain("Campanha Atual");
  });

  it("renders actions slot when provided", () => {
    const action = React.createElement("button", null, "Ação");
    const html = renderToString(
      <PageHeader title="Campanhas" actions={action} />,
    );
    expect(html).toContain("Ação");
  });

  it("não adiciona lang quando as props opcionais são omitidas", () => {
    const html = renderToString(<PageHeader title="Campanhas" />);
    expect(html).not.toContain("lang=");
  });

  it("propaga lang opcional no título e no breadcrumb", () => {
    const html = renderToString(
      <PageHeader
        title="Producto"
        titleLang=""
        breadcrumbs={[
          { label: "Campañas", href: "/campanhas", lang: "es-419" },
          { label: "Producto", lang: "" },
        ]}
      />,
    );

    expect(html).toContain('lang="es-419"');
    expect(html).toContain('href="/campanhas"');
    expect(html.match(/lang=""/g)?.length).toBe(2);
  });
});
