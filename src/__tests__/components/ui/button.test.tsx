// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

describe("Button", () => {
  it("renders primary variant with correct classes", () => {
    const html = renderToString(<Button variant="primary">Criar Campanha</Button>);
    expect(html).toContain("bg-accent-green");
    expect(html).toContain("text-white");
    expect(html).toContain("Criar Campanha");
  });

  it("renders disabled button with disabled attr and reduced opacity", () => {
    const html = renderToString(<Button disabled>Salvar</Button>);
    expect(html).toContain('disabled=""');
    expect(html).toContain("opacity-50");
  });

  it("renders loading state with spinner and disabled", () => {
    const html = renderToString(<Button loading>Salvando...</Button>);
    expect(html).toContain("opacity-50");
    expect(html).toContain("Salvando...");
  });
});
