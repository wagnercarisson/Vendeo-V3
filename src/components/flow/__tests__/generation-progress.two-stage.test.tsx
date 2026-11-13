// @vitest-environment jsdom
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
});
