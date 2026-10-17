// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GenerationProgress } from "../generation-progress";

/**
 * F56.2b2c (B2.3) — indicadores do NOVO fluxo Produto 1:1.
 * Preserva as 4 etapas do legado e usa as fases REAIS do novo fluxo; NÃO exibe
 * "Revisão" inexistente; imagem e copy podem correr em paralelo; em falha/
 * desconhecido nenhum spinner permanece sugerindo processamento ativo.
 */
describe("GenerationProgress — novo fluxo (B2.3)", () => {
  it("renderiza as fases reais do novo fluxo e NÃO mostra 'Revisão'", () => {
    render(
      <GenerationProgress
        phases={[
          { phase: "campaign_validation", status: "complete" },
          { phase: "campaign_preparation", status: "complete" },
          { phase: "campaign_image", status: "running", message: "Gerando imagem..." },
          { phase: "campaign_copy", status: "running", message: "Gerando texto da campanha..." },
        ]}
      />,
    );
    expect(screen.getByText("Validação")).toBeTruthy();
    expect(screen.getByText("Preparação")).toBeTruthy();
    expect(screen.getByText("Arte")).toBeTruthy();
    expect(screen.getByText("Texto")).toBeTruthy();
    expect(screen.getByText("Entrega")).toBeTruthy();
    // não há etapa de revisão de qualidade no novo fluxo
    expect(screen.queryByText("Revisão")).toBeNull();
    // imagem e copy concorrentes ⇒ dois spinners simultâneos
    expect(document.querySelectorAll(".animate-spin").length).toBeGreaterThanOrEqual(2);
  });

  it("em falha/desconhecido NÃO permanece spinner ativo", () => {
    render(
      <GenerationProgress
        variant="unknown"
        phases={[
          { phase: "campaign_validation", status: "complete" },
          { phase: "campaign_preparation", status: "complete" },
          { phase: "campaign_image", status: "failed", message: "Interrompido" },
          { phase: "campaign_copy", status: "failed", message: "Interrompido" },
        ]}
      />,
    );
    expect(document.querySelectorAll(".animate-spin").length).toBe(0);
  });

  it("legado: mantém as 4 etapas (Validação/Briefing/Arte/Revisão)", () => {
    render(
      <GenerationProgress
        phases={[
          { phase: "input_validation", status: "complete" },
          { phase: "prompt_assembly", status: "complete" },
          { phase: "image_generation", status: "running" },
          { phase: "quality_review", status: "pending" },
        ]}
      />,
    );
    expect(screen.getByText("Validação")).toBeTruthy();
    expect(screen.getByText("Briefing")).toBeTruthy();
    expect(screen.getByText("Arte")).toBeTruthy();
    expect(screen.getByText("Revisão")).toBeTruthy();
  });
});
