// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackgroundDirectionSelector } from "../background-direction-selector";
import { IntentSelector } from "../intent-selector";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("Product 1:1 inactive selectors", () => {
  it("renders explicit intent options and reports changes from controlled props", () => {
    const onChange = vi.fn();
    render(<IntentSelector value="offer" onChange={onChange} />);

    expect(screen.getByTestId("product-1-1-intent-selector")).toBeInTheDocument();
    expect(screen.getByLabelText("Oferta")).toBeChecked();
    expect(screen.getByLabelText("Destaque")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Destaque"));
    expect(onChange).toHaveBeenCalledWith("spotlight");
  });

  it("renders explicit background options and displays a field error", () => {
    const onChange = vi.fn();
    render(
      <BackgroundDirectionSelector
        value="studio"
        onChange={onChange}
        error="Escolha uma direção de fundo válida."
      />,
    );

    expect(screen.getByTestId("product-1-1-background-selector")).toBeInTheDocument();
    expect(screen.getByLabelText("Fundo de estúdio")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Manter cenário original"));
    expect(onChange).toHaveBeenCalledWith("original");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escolha uma direção de fundo válida.",
    );
  });

  it("does not make network requests", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <>
        <IntentSelector value="exclusive" onChange={vi.fn()} />
        <BackgroundDirectionSelector value="ambient" onChange={vi.fn()} />
      </>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps both selectors unmounted from the productive app flow", () => {
    const appRoot = path.resolve(process.cwd(), "src/app");
    const source = collectSourceFiles(appRoot)
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /(?:@\/components\/product-1-1\/|\.\.\/.*product-1-1\/)(?:intent-selector|background-direction-selector)/,
    );
  });
});
