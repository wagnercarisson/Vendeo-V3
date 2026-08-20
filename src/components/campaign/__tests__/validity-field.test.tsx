// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ValidityField } from "../validity-field";

const baseProps = {
  mode: "until-date" as const,
  startDate: "",
  endDate: "2026-09-30",
  customText: "",
  disabled: false,
  onModeChange: vi.fn(),
  onStartDateChange: vi.fn(),
  onEndDateChange: vi.fn(),
  onCustomTextChange: vi.fn(),
};

describe("ValidityField — máscara dd/mm/aaaa", () => {
  it("nenhum input com type='date'; placeholder dd/mm/aaaa e inputMode numeric", () => {
    render(<ValidityField {...baseProps} />);
    expect(document.querySelector('input[type="date"]')).toBeNull();

    const endInput = screen.getByLabelText("Data final");
    expect(endInput).toHaveAttribute("type", "text");
    expect(endInput).toHaveAttribute("inputMode", "numeric");
    expect(endInput).toHaveAttribute("autoComplete", "off");
    expect(endInput).toHaveAttribute("maxLength", "10");
    expect(endInput).toHaveAttribute("placeholder", "dd/mm/aaaa");
  });

  it("máscara insere '/' automaticamente após o 2º e o 4º dígito", () => {
    render(<ValidityField {...baseProps} />);
    const endInput = screen.getByLabelText("Data final");

    fireEvent.change(endInput, { target: { value: "30" } });
    expect(endInput).toHaveValue("30");

    fireEvent.change(endInput, { target: { value: "3009" } });
    expect(endInput).toHaveValue("30/09");

    fireEvent.change(endInput, { target: { value: "30092026" } });
    expect(endInput).toHaveValue("30/09/2026");
  });

  it("digitar 30092026 em until-date emite ISO '2026-09-30'", () => {
    const onEndDateChange = vi.fn();
    render(<ValidityField {...baseProps} onEndDateChange={onEndDateChange} />);
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "30092026" } });
    expect(onEndDateChange).toHaveBeenLastCalledWith("2026-09-30");
  });

  it("data de calendário inválida emite '' (nunca um ISO de calendário impossível)", () => {
    const onEndDateChange = vi.fn();
    render(<ValidityField {...baseProps} onEndDateChange={onEndDateChange} />);
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "31022026" } });
    expect(onEndDateChange).toHaveBeenLastCalledWith("");
  });

  it("apagar até deixar incompleto emite '' (anti-ISO-stale: nunca mantém ISO antigo)", () => {
    const onEndDateChange = vi.fn();
    render(<ValidityField {...baseProps} onEndDateChange={onEndDateChange} />);
    const endInput = screen.getByLabelText("Data final");

    // Começa com ISO 2026-09-30; apagar um dígito → incompleto → "".
    fireEvent.change(endInput, { target: { value: "30/09/202" } });
    expect(onEndDateChange).toHaveBeenLastCalledWith("");

    fireEvent.change(endInput, { target: { value: "30/0" } });
    expect(onEndDateChange).toHaveBeenLastCalledWith("");

    fireEvent.change(endInput, { target: { value: "" } });
    expect(onEndDateChange).toHaveBeenLastCalledWith("");
  });

  it("prop ISO externa mudando re-sincroniza a máscara (campo sem foco)", () => {
    const { rerender } = render(<ValidityField {...baseProps} />);
    expect(screen.getByLabelText("Data final")).toHaveValue("30/09/2026");

    rerender(<ValidityField {...baseProps} endDate="2026-09-25" />);
    expect(screen.getByLabelText("Data final")).toHaveValue("25/09/2026");

    rerender(<ValidityField {...baseProps} endDate="" />);
    expect(screen.getByLabelText("Data final")).toHaveValue("");
  });

  it("mudança externa NÃO apaga digitação em andamento (guarda de foco)", () => {
    const onEndDateChange = vi.fn();
    const { rerender } = render(<ValidityField {...baseProps} onEndDateChange={onEndDateChange} />);
    const endInput = screen.getByLabelText("Data final");

    fireEvent.focus(endInput);
    fireEvent.change(endInput, { target: { value: "30/09/2" } }); // incompleto → ISO ""
    expect(onEndDateChange).toHaveBeenLastCalledWith("");

    // Fonte externa muda o ISO enquanto o campo está em edição → draft preservado.
    rerender(<ValidityField {...baseProps} endDate="" onEndDateChange={onEndDateChange} />);
    expect(screen.getByLabelText("Data final")).toHaveValue("30/09/2");
  });
});

describe("ValidityField — erros de data e blur (D2/D5)", () => {
  it("endDateError renderiza a mensagem abaixo do input em until-date", () => {
    render(<ValidityField {...baseProps} endDateError="Informe uma data válida (dd/mm/aaaa)" />);
    expect(screen.getByText("Informe uma data válida (dd/mm/aaaa)")).toBeInTheDocument();
  });

  it("startDateError/endDateError renderizam abaixo do input correspondente no range; somem sem erro", () => {
    const { rerender } = render(
      <ValidityField
        {...baseProps}
        mode="range"
        startDate="2026-09-30"
        endDate="2026-09-25"
        startDateError="Data inicial não pode ser posterior à data final"
        endDateError="Informe uma data válida (dd/mm/aaaa)"
      />
    );
    expect(screen.getByText("Data inicial não pode ser posterior à data final")).toBeInTheDocument();
    expect(screen.getByText("Informe uma data válida (dd/mm/aaaa)")).toBeInTheDocument();

    rerender(<ValidityField {...baseProps} mode="range" startDate="2026-09-25" endDate="2026-09-30" />);
    expect(screen.queryByText("Data inicial não pode ser posterior à data final")).not.toBeInTheDocument();
    expect(screen.queryByText("Informe uma data válida (dd/mm/aaaa)")).not.toBeInTheDocument();
  });

  it("blur no input de data chama onEndDateBlur/onStartDateBlur", () => {
    const onStartDateBlur = vi.fn();
    const onEndDateBlur = vi.fn();
    render(
      <ValidityField
        {...baseProps}
        mode="range"
        startDate="2026-09-25"
        endDate="2026-09-30"
        onStartDateBlur={onStartDateBlur}
        onEndDateBlur={onEndDateBlur}
      />
    );

    fireEvent.blur(screen.getByLabelText("Data inicial"));
    expect(onStartDateBlur).toHaveBeenCalledTimes(1);

    fireEvent.blur(screen.getByLabelText("Data final do intervalo"));
    expect(onEndDateBlur).toHaveBeenCalledTimes(1);
  });

  it("helper text atualizado para dd/mm/aaaa", () => {
    render(<ValidityField {...baseProps} />);
    expect(screen.getByText("A data aparece no formato dd/mm/aaaa na campanha.")).toBeInTheDocument();
  });
});