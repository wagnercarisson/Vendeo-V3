// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
/**
 * Quick 260919-hju — testes do seletor descritivo do Tom de Voz (Select-Only
 * Combobox APG). Asserções importam as strings canônicas de
 * `@/lib/store-onboarding/field-guidance` (fonte única, sem literais).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ToneOfVoiceSelect } from "../tone-of-voice-select";
import {
  TONE_OF_VOICE_OPTIONS,
  TONE_OF_VOICE_DESCRIPTIONS,
} from "@/lib/store-onboarding/field-guidance";

function renderSelect(props: { value?: string; onChange?: (v: string) => void } = {}) {
  const onChange = props.onChange ?? vi.fn();
  const utils = render(
    <>
      <label htmlFor="tone_of_voice">Tom de Voz</label>
      <ToneOfVoiceSelect
        value={props.value ?? ""}
        onChange={onChange}
        inputId="tone_of_voice"
      />
    </>,
  );
  return { ...utils, onChange };
}

function combobox(): HTMLInputElement {
  return screen.getByRole("combobox", { name: "Tom de Voz" }) as HTMLInputElement;
}

function openListbox(): HTMLUListElement {
  return screen.getByRole("listbox") as HTMLUListElement;
}

function mockRect(input: HTMLInputElement, top: number, bottom: number) {
  input.getBoundingClientRect = () =>
    ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top }) as DOMRect;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ToneOfVoiceSelect — seletor descritivo (Quick 260919-hju)", () => {
  it("1. fechado exibe placeholder quando vazio e somente o label quando selecionado", () => {
    const { rerender } = renderSelect();
    expect(combobox()).toHaveValue("");
    expect(combobox()).toHaveAttribute("placeholder", "Selecione");

    rerender(
      <>
        <label htmlFor="tone_of_voice">Tom de Voz</label>
        <ToneOfVoiceSelect value="popular" onChange={() => {}} inputId="tone_of_voice" />
      </>,
    );
    expect(combobox()).toHaveValue("Popular");
  });

  it("2. aberto exibe exatamente 9 opções com label e descrição canônica", () => {
    renderSelect();
    fireEvent.click(combobox());

    const listbox = openListbox();
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(9);

    for (const option of TONE_OF_VOICE_OPTIONS) {
      const optionEl = within(listbox).getByRole("option", { name: new RegExp(option.label) });
      expect(optionEl).toHaveTextContent(TONE_OF_VOICE_DESCRIPTIONS[option.value]);
    }
  });

  it("3. selecionar Popular chama onChange('popular')", () => {
    const { onChange } = renderSelect();
    fireEvent.click(combobox());

    const listbox = openListbox();
    const popular = within(listbox).getByRole("option", { name: /Popular/ });
    fireEvent.click(popular);

    expect(onChange).toHaveBeenCalledWith("popular");
  });

  it("4. reabertura marca aria-selected na opção correta", () => {
    renderSelect({ value: "moderno" });
    fireEvent.click(combobox());

    const listbox = openListbox();
    const moderno = within(listbox).getByRole("option", { name: /Moderno/ });
    expect(moderno).toHaveAttribute("aria-selected", "true");
  });

  it("5. expõe nome acessível e valor/estado separadamente", () => {
    renderSelect({ value: "popular" });
    expect(combobox()).toHaveValue("Popular");
  });

  it("6. teclado: ArrowDown abre, setas movem, Enter seleciona, Escape fecha e devolve foco", () => {
    const { onChange } = renderSelect();
    const input = combobox();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    expect(combobox()).toHaveAttribute("aria-activedescendant");
    expect(openListbox()).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
  });

  it("7. abertura por ponteiro alterna aberto/fechado", () => {
    renderSelect();
    const input = combobox();

    fireEvent.click(input);
    expect(combobox()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(input);
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
  });

  it("8. typeahead: 'po' → Popular", () => {
    const { onChange } = renderSelect();
    const input = combobox();

    fireEvent.keyDown(input, { key: "p" });
    fireEvent.keyDown(input, { key: "o" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("popular");
  });

  it("8c. typeahead: 'pr' → Profissional", () => {
    const { onChange } = renderSelect();
    const input = combobox();

    fireEvent.keyDown(input, { key: "p" });
    fireEvent.keyDown(input, { key: "r" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("profissional");
  });

  it("8b. teclar 'p' repetidamente alterna entre Profissional e Popular", () => {
    renderSelect();
    const input = combobox();

    fireEvent.keyDown(input, { key: "p" });
    expect(combobox()).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-opt-profissional"),
    );

    fireEvent.keyDown(input, { key: "p" });
    expect(combobox()).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-opt-popular"),
    );

    fireEvent.keyDown(input, { key: "p" });
    expect(combobox()).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-opt-profissional"),
    );
  });

  it("9. clique externo fecha; seleção por clique mantém o foco no combobox", () => {
    render(
      <>
        <label htmlFor="tone_of_voice">Tom de Voz</label>
        <ToneOfVoiceSelect value="" onChange={() => {}} inputId="tone_of_voice" />
        <button type="button">Fora</button>
      </>,
    );
    const input = combobox();

    fireEvent.click(input);
    expect(combobox()).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseDown(screen.getByRole("button", { name: "Fora" }));
    expect(combobox()).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(input);
    input.focus();
    const listbox = openListbox();
    fireEvent.click(within(listbox).getByRole("option", { name: /Moderno/ }));
    expect(input).toHaveFocus();
  });

  it("10. valor vazio e valor legado/desconhecido: placeholder, sem aria-selected, sem crash", () => {
    renderSelect({ value: "legado-desconhecido" });
    expect(combobox()).toHaveValue("");

    fireEvent.click(combobox());
    const listbox = openListbox();
    const selected = within(listbox)
      .getAllByRole("option")
      .filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(0);
  });

  it("11. ARIA: aria-controls resolve mesmo fechado; sem aria-checked; sem ids órfãos", () => {
    renderSelect({ value: "popular" });
    const input = combobox();

    expect(input).not.toHaveAttribute("aria-checked");
    const listboxId = input.getAttribute("aria-controls")!;
    const listbox = document.getElementById(listboxId);
    expect(listbox).not.toBeNull();
    expect(listbox).toHaveAttribute("hidden");
    expect(listbox).toHaveAttribute("role", "listbox");

    const describedBy = input.getAttribute("aria-describedby");
    if (describedBy) {
      for (const id of describedBy.split(" ").filter(Boolean)) {
        expect(document.getElementById(id)).not.toBeNull();
      }
    }
  });

  it("12. touch target ≥44px (combobox e opções)", () => {
    renderSelect();
    fireEvent.click(combobox());
    const listbox = openListbox();

    expect(combobox()).toHaveClass("min-h-[44px]");
    for (const option of within(listbox).getAllByRole("option")) {
      expect(option).toHaveClass("min-h-[44px]");
    }
  });

  describe("altura real calculada do popup", () => {
    function setViewport(height: number) {
      Object.defineProperty(window, "innerHeight", {
        value: height,
        configurable: true,
        writable: true,
      });
    }

    it("(a) espaço suficiente abaixo → abre abaixo com maxHeight = min(320, abaixo - margem)", () => {
      setViewport(800);
      renderSelect();
      const input = combobox();
      mockRect(input, 100, 150);
      fireEvent.click(input);

      const listbox = openListbox();
      expect(listbox.className).toContain("top-full");
      expect(listbox.style.maxHeight).toBe("320px");
    });

    it("(b) mais espaço acima → abre acima", () => {
      setViewport(800);
      renderSelect();
      const input = combobox();
      mockRect(input, 600, 650);
      fireEvent.click(input);

      const listbox = openListbox();
      expect(listbox.className).toContain("bottom-full");
      expect(listbox.style.maxHeight).toBe("320px");
    });

    it("(c) ambos os lados com menos de 240px → usa o lado com maior espaço", () => {
      setViewport(400);
      renderSelect();
      const input = combobox();
      mockRect(input, 200, 230);
      fireEvent.click(input);

      const listbox = openListbox();
      // espaço acima = 200 - 8 = 192; abaixo = 400 - 230 - 8 = 162 → abre acima
      expect(listbox.className).toContain("bottom-full");
      expect(listbox.style.maxHeight).toBe("192px");
    });

    it("(d) o popup nunca ultrapassa o viewport", () => {
      setViewport(400);
      renderSelect();
      const input = combobox();
      mockRect(input, 100, 120);
      fireEvent.click(input);

      const listbox = openListbox();
      // espaço abaixo = 400 - 120 - 8 = 272; acima = 100 - 8 = 92 → abaixo
      expect(listbox.className).toContain("top-full");
      expect(listbox.style.maxHeight).toBe("272px");
    });
  });
});
