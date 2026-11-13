// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GenerationProgress } from "../generation-progress";

describe("GenerationProgress two-stage", () => {
  it("uses the two-stage order and renders processing neutrally", () => {
    render(
      <GenerationProgress
        phases={[
          { phase: "campaign_validation", status: "complete" },
          { phase: "campaign_base", status: "running" },
        ]}
        variant="processing"
        flowKind="two_stage_9_16"
      />,
    );
    expect(screen.getByText("Base")).toBeTruthy();
    expect(screen.getByText("Vertical")).toBeTruthy();
    expect(
      screen.getByText(/A geração continua em processamento/i),
    ).toBeTruthy();
  });

  it("copy em execução real mostra spinner e mensagem (não sucesso)", () => {
    const { container } = render(
      <GenerationProgress
        phases={[
          { phase: "campaign_base", status: "complete" },
          {
            phase: "campaign_copy",
            status: "running",
            message: "Gerando texto da campanha...",
          },
        ]}
        flowKind="two_stage_9_16"
      />,
    );
    expect(screen.getByText("Gerando texto da campanha...")).toBeInTheDocument();
    expect(screen.getByText("Texto")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-spin").length).toBe(1);
  });

  it("copy reutilizada conclui com mensagem própria e sem spinner", () => {
    const { container } = render(
      <GenerationProgress
        phases={[
          { phase: "campaign_base", status: "complete" },
          {
            phase: "campaign_copy",
            status: "complete",
            message: "Texto da campanha reaproveitado.",
          },
        ]}
        flowKind="two_stage_9_16"
      />,
    );
    expect(
      screen.getByText("Texto da campanha reaproveitado."),
    ).toBeInTheDocument();
    expect(screen.getByText("Texto").className).toContain("text-accent-green");
    expect(container.querySelectorAll(".animate-spin").length).toBe(0);
  });

  it("falha da copy é exibida como falha, sem bloquear a etapa de arte", () => {
    render(
      <GenerationProgress
        phases={[
          { phase: "campaign_base", status: "complete" },
          {
            phase: "campaign_copy",
            status: "failed",
            message: "Não foi possível gerar o texto; a arte continua.",
          },
          { phase: "campaign_expansion", status: "running" },
        ]}
        flowKind="two_stage_9_16"
      />,
    );
    const copyLabel = screen.getByText("Texto");
    expect(copyLabel.className).toContain("text-accent-red");
    expect(screen.getByText("Vertical")).toBeInTheDocument();
  });
});
