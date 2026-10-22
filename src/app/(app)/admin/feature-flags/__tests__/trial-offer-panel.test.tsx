// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TrialOfferPanel } from "../trial-offer-panel";

const LAUNCH_AT = "2026-10-20T12:00:00.000Z";
const INDIVIDUAL_AT = "2026-10-22T12:00:00.000Z";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPanel(
  overrides: Partial<ComponentProps<typeof TrialOfferPanel>> = {},
) {
  return render(
    <TrialOfferPanel
      initialEnabled
      initialLaunchAt={LAUNCH_AT}
      initialIndividualLaunchAt={null}
      {...overrides}
    />,
  );
}

describe("F50.4 - painel de ativação por CNPJ completo", () => {
  it("mostra estado, marcos e coorte sem CNPJ", () => {
    renderPanel();

    expect(screen.getByText("Teste gratuito de 28 dias")).toBeInTheDocument();
    expect(screen.getByTestId("trial-offer-current-state")).toHaveTextContent(
      "Ligado",
    );
    expect(screen.getByTestId("trial-offer-launch-at")).toHaveTextContent("2026");
    expect(
      screen.getByTestId("trial-offer-individual-launch-at"),
    ).toHaveTextContent("ainda não gravado");
    expect(screen.getByTestId("trial-offer-cohort-state")).toHaveTextContent(
      "Inativa",
    );
    expect(screen.queryByText(/CNPJ\s+\d{2}\.\d{3}/)).not.toBeInTheDocument();
  });

  it("bloqueia quando launchAt é nulo e nunca dispara fetch", () => {
    renderPanel({ initialLaunchAt: null });

    expect(
      screen.getByText(/Marco F50\.2 não configurado/),
    ).toBeInTheDocument();
    const button = screen.getByTestId("activate-f50-4");
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Motivo da ativação/), {
      target: { value: "Ativar no descartável" },
    });
    fireEvent.click(
      screen.getByLabelText(/Confirmo que esta ação é irreversível/),
    );
    fireEvent.click(button);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("bloqueia quando individualLaunchAt já está preenchido", () => {
    renderPanel({ initialIndividualLaunchAt: INDIVIDUAL_AT });

    expect(screen.getByTestId("activate-f50-4")).toBeDisabled();
    expect(screen.getByTestId("trial-offer-cohort-state")).toHaveTextContent(
      "Ativa",
    );
    expect(screen.getByTestId("trial-offer-individual-launch-at")).toHaveTextContent(
      "2026",
    );
  });

  it("bloqueia quando a oferta está desligada", () => {
    renderPanel({ initialEnabled: false });

    expect(screen.getByTestId("activate-f50-4")).toBeDisabled();
    expect(
      screen.getByText(/Ligue a oferta acima antes de ativar/),
    ).toBeInTheDocument();
  });

  it("exige confirmação explícita antes de enviar a ativação", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/admin/trial-offer/activate") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            idempotent: false,
            individualLaunchAt: INDIVIDUAL_AT,
            cohortState: "active",
          }),
        });
      }
      if (url === "/api/admin/trial-offer") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            enabled: true,
            launchAt: LAUNCH_AT,
            individualLaunchAt: INDIVIDUAL_AT,
            cohortState: "active",
          }),
        });
      }
      return Promise.reject(new Error(`fetch inesperado: ${url}`));
    });

    renderPanel();
    const button = screen.getByTestId("activate-f50-4");

    fireEvent.change(screen.getByLabelText(/Motivo da ativação/), {
      target: { value: "Ativar coorte no descartável" },
    });
    expect(button).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText(/Confirmo que esta ação é irreversível/),
    );
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/trial-offer/activate");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.reason).toBe("Ativar coorte no descartável");
    expect(typeof body.operationId).toBe("string");

    await waitFor(() =>
      expect(screen.getByTestId("trial-offer-individual-launch-at")).toHaveTextContent(
        "2026",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /Marco individual gravado/,
    );
  });

  it("erro seguro não afirma sucesso", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "individual_launch_already_set" }),
    });

    renderPanel();
    fireEvent.change(screen.getByLabelText(/Motivo da ativação/), {
      target: { value: "Ativar" },
    });
    fireEvent.click(
      screen.getByLabelText(/Confirmo que esta ação é irreversível/),
    );
    fireEvent.click(screen.getByTestId("activate-f50-4"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "individual_launch_already_set",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("não lê nem envia configuração mensal", () => {
    renderPanel();

    const source = readFileSync(
      path.resolve(__dirname, "../trial-offer-panel.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/VENDEO_MONTHLY_|launch_config/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
