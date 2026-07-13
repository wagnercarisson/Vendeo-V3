// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import React from "react";

describe("EmptyState", () => {
  it("renders icon, title, description, and action", () => {
    const action = React.createElement("a", { href: "/campanhas/nova" }, "Criar");
    const html = renderToString(
      <EmptyState
        icon={Inbox}
        title="Nada aqui"
        description="Crie sua primeira campanha"
        action={action}
      />,
    );
    expect(html).toContain("Nada aqui");
    expect(html).toContain("Crie sua primeira campanha");
    expect(html).toContain('href="/campanhas/nova"');
    expect(html).toContain("Criar");
  });
});
