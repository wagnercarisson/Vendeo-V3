// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

import { UnknownResultPanel } from "../unknown-result-panel";

beforeEach(() => {
  mockPush.mockClear();
});

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

  it("reconhece conclusão conjunta (ambos entregues) ao verificar novamente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            operation: {
              origin: "two_format_two_stage",
              formats: {
                "1:1": { state: "delivered" },
                "9:16": { state: "delivered" },
              },
              operationTerminal: true,
              canContinue: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(
      <UnknownResultPanel
        supportReference="IMG-001"
        campaignId="campaign-1"
        operationId="operation-1"
        imageRecoveryAvailable={false}
      />,
    );
    fireEvent.click(screen.getByText("Verificar novamente"));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/campanhas/campaign-1"),
    );
    vi.unstubAllGlobals();
  });

  it("reconhece parcial terminal conjunto (entregue + estornado) como resolvido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            operation: {
              origin: "two_format_two_stage",
              formats: {
                "1:1": { state: "delivered" },
                "9:16": { state: "absent" },
              },
              operationTerminal: true,
              canContinue: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(
      <UnknownResultPanel
        supportReference="IMG-001"
        campaignId="campaign-2"
        operationId="operation-2"
        imageRecoveryAvailable={false}
      />,
    );
    fireEvent.click(screen.getByText("Verificar novamente"));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/campanhas/campaign-2"),
    );
    vi.unstubAllGlobals();
  });
});
