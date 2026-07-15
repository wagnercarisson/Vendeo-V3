// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders label and placeholder", () => {
    const html = renderToString(
      <Input label="Nome do Produto" placeholder="Ex: Tênis Runner Pro" />,
    );
    expect(html).toContain("Nome do Produto");
    expect(html).toContain('placeholder="Ex: Tênis Runner Pro"');
  });

  it("shows inline error", () => {
    const html = renderToString(<Input label="Nome" error="Campo obrigatório" />);
    expect(html).toContain("Campo obrigatório");
    expect(html).toContain("accent-red");
  });

  it("has min-h-[44px] for touch target", () => {
    const html = renderToString(<Input label="Nome" />);
    expect(html).toContain("min-h-[44px]");
  });
});
