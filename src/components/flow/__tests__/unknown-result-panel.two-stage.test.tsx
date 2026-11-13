// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { UnknownResultPanel } from "../unknown-result-panel";

describe("UnknownResultPanel two-stage", () => {
  it("hides image recovery when unavailable and keeps the query action", () => {
    render(
      <UnknownResultPanel
        supportReference="IMG-001"
        campaignId="c"
        operationId="o"
        imageRecoveryAvailable={false}
      />,
    );
    expect(screen.queryByText("Recuperar imagem salva")).toBeNull();
    expect(screen.getByText("Verificar novamente")).toBeTruthy();
  });

  it("keeps image recovery by default (1:1/histórico)", () => {
    render(<UnknownResultPanel supportReference="IMG-001" />);
    expect(screen.getByText("Recuperar imagem salva")).toBeTruthy();
  });
});
