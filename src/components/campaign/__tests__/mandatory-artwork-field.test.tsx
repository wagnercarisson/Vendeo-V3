// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
/**
 * F49 (D10/D11/D13/D14) — testes do campo "Informações obrigatórias na arte":
 * label/microcopy de fonte única, associação acessível por `aria-describedby`
 * (id de `useId`, não literal), campo visível sem `required` nativo, placeholder
 * multi-linha e transporte do valor multi-linha preservando `\n`.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MANDATORY_ARTWORK_HINT,
  MANDATORY_ARTWORK_LABEL,
  MANDATORY_ARTWORK_PLACEHOLDER,
} from "@/lib/campaign/field-guidance";
import { MandatoryArtworkField } from "../mandatory-artwork-field";

function getTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText(new RegExp(MANDATORY_ARTWORK_LABEL)) as HTMLTextAreaElement;
}

describe("MandatoryArtworkField — orientação, a11y e multi-linha (F49)", () => {
  it("7.1/7.2 exibe label/hint de fonte única, associa por aria-describedby e não usa required nativo", () => {
    render(<MandatoryArtworkField value="" onChange={vi.fn()} />);

    // Label canônico visível.
    expect(screen.getByText(MANDATORY_ARTWORK_LABEL, { exact: false })).toBeInTheDocument();

    const textarea = getTextarea();

    // Hint associado por aria-describedby; id derivado de useId (não literal) e
    // resolvendo para o elemento do hint.
    const describedBy = textarea.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const hintId = describedBy!.split(" ").filter(Boolean)[0];
    expect(hintId).toBeTruthy();
    expect(hintId).not.toContain("mandatoryArtworkText");
    const hint = document.getElementById(hintId);
    expect(hint).not.toBeNull();
    expect(hint).toHaveTextContent(MANDATORY_ARTWORK_HINT);

    // Campo diretamente visível (sem checkbox/fluxo secundário).
    expect(screen.queryByRole("checkbox")).toBeNull();

    // Contrato: maxLength 200 e sem `required` nativo.
    expect(textarea).toHaveAttribute("maxlength", "200");
    expect(textarea).not.toHaveAttribute("required");
  });

  it("7.7 placeholder multi-linha (3 linhas) e envio do valor multi-linha no mesmo contrato", () => {
    const onChange = vi.fn();
    render(<MandatoryArtworkField value="" onChange={onChange} />);

    const textarea = getTextarea();

    const placeholder = textarea.getAttribute("placeholder") ?? "";
    expect(placeholder).toBe(MANDATORY_ARTWORK_PLACEHOLDER);
    expect(placeholder.split("\n").length).toBe(3);

    const multi = "Intensidade 8\nTorra clássica\nPeso líquido 500 g";
    fireEvent.change(textarea, { target: { value: multi } });
    expect(onChange).toHaveBeenCalledWith(multi);
  });

  it("não renderiza advertências negativas permanentes", () => {
    render(<MandatoryArtworkField value="" onChange={vi.fn()} />);
    expect(screen.queryByText(/Não repita/)).toBeNull();
    expect(screen.queryByText(/Não use para aviso ilustrativo/)).toBeNull();
  });
});
