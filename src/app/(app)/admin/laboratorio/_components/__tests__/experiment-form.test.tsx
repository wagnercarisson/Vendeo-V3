// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentForm } from "../experiment-form";

/**
 * F48.1 (48-1-09, task 9.3) — formulário de criação prompt-only.
 *
 * Prova os invariantes de comparação justa (dimensão fixa `prompt` e modelo fixo,
 * sem nenhum controle editável), os limites travados da fonte única
 * (`@/lib/lab/limits`) e o contrato do `POST /api/admin/laboratorio/experiments`.
 */

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const PROMPT_NAME = "campaign-image-director-offer";

const MODEL_TARGET = {
  provider: "openai",
  model: "gpt-5.5",
  protocol: "responses",
};

const SCENARIOS = [1, 2, 3, 4].map((index) => ({
  id: `00000000-0000-4000-8000-00000000000${index}`,
  scenarioId: `scenario-${index}`,
  slug: `produto-oferta-${index}`,
  name: `Cenário ${index}`,
  version: 1,
  contentHash: `hash-${index}`,
  intent: "offer",
  format: "1:1",
  locale: "pt-BR",
  createdAt: "2026-09-15T00:00:00.000Z",
}));

const mockFetch = vi.fn();

function renderForm() {
  render(
    <ExperimentForm
      modelTarget={MODEL_TARGET}
      scenarios={SCENARIOS}
      defaultParams={{ size: "1024x1024", quality: "auto" }}
      promptName={PROMPT_NAME}
    />,
  );
}

function selectScenarios(ids: string[]) {
  const select = screen.getByLabelText("Cenários") as HTMLSelectElement;
  const wanted = new Set(ids);
  for (const option of Array.from(select.options)) {
    option.selected = wanted.has(option.value);
  }
  fireEvent.change(select);
}

function submitForm() {
  const form = screen.getByTestId("lab-create-button").closest("form");
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Experimento de prompt" },
  });
  fireEvent.change(screen.getByLabelText("Objetivo"), {
    target: { value: "Deixar a oferta mais legível" },
  });
  fireEvent.change(screen.getByLabelText("Hipótese"), {
    target: { value: "Um prompt mais direto melhora a leitura do preço" },
  });
  selectScenarios([SCENARIOS[0].id]);
  fireEvent.change(screen.getByLabelText(/prompt candidato/i), {
    target: { value: "Conteúdo candidato com mais de vinte caracteres." },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn().mockReturnValue("00000000-0000-4000-8000-0000000000ff"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExperimentForm", () => {
  it("exibe a dimensão fixa prompt e nenhum controle editável de dimensão", () => {
    renderForm();

    expect(screen.getByTestId("lab-changed-dimension")).toHaveTextContent("prompt");
    expect(screen.queryByRole("combobox", { name: /dimens/i })).toBeNull();
    expect(screen.queryByRole("listbox", { name: /dimens/i })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /dimens/i })).toBeNull();
  });

  it("exibe o modelo fixo e nenhum controle editável de modelo", () => {
    renderForm();

    expect(screen.getByTestId("lab-model-fixed")).toHaveTextContent(
      "openai/gpt-5.5 (responses)",
    );
    expect(screen.queryByRole("combobox", { name: /modelo/i })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /modelo/i })).toBeNull();
  });

  it("exibe o prompt baseline fixo e oferece repetições de 1 a 3", () => {
    renderForm();

    expect(screen.getByTestId("lab-baseline-prompt")).toHaveTextContent(PROMPT_NAME);

    const repetitions = screen.getByLabelText("Repetições");
    expect(
      within(repetitions)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["1", "2", "3"]);
  });

  it("trava o teto de execuções em 12 com default 6", () => {
    renderForm();

    const maxRuns = screen.getByLabelText("Teto de execuções");
    expect(maxRuns).toHaveAttribute("type", "number");
    expect(maxRuns).toHaveAttribute("min", "1");
    expect(maxRuns).toHaveAttribute("max", "12");
    expect(maxRuns).toHaveValue(6);
  });

  it("exibe erro inline de limite ao selecionar 4 cenários", async () => {
    renderForm();

    selectScenarios(SCENARIOS.map((scenario) => scenario.id));

    expect(
      await screen.findByText("Selecione no máximo 3 cenários"),
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Cenários") as HTMLSelectElement).selectedOptions
        .length,
    ).toBe(3);
  });

  it("valida inline ao sair de um campo obrigatório vazio", async () => {
    renderForm();

    fireEvent.blur(screen.getByLabelText("Nome"));

    expect(
      await screen.findByText("Informe o nome do experimento"),
    ).toBeInTheDocument();
  });

  it("envia o contrato prompt-only e navega para o detalhe", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ experimentId: "exp-1", status: "ready" }),
    });

    renderForm();
    fillValidForm();
    submitForm();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/laboratorio/experiments");

    const body = JSON.parse(String(init.body));
    expect(body.changedDimension).toBe("prompt");
    expect(body.params.skipInputValidation).toBe(true);
    expect(body.params.size).toBe("1024x1024");
    expect(body.params.quality).toBe("auto");
    expect(body.baseline.promptName).toBe(PROMPT_NAME);
    expect(body.candidate.promptName).toBe(PROMPT_NAME);
    expect(body.modelTarget).toEqual(MODEL_TARGET);
    expect(body).not.toHaveProperty("variants");

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        "/admin/laboratorio/experimentos/exp-1",
      ),
    );
  });

  it("mapeia o erro 400 unsupported_changed_dimension", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ error: "unsupported_changed_dimension" }),
    });

    renderForm();
    fillValidForm();
    submitForm();

    expect(
      await screen.findByText(/Somente a dimensão prompt é comparável/),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("mapeia o erro 400 model_target_not_in_catalog", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ error: "model_target_not_in_catalog" }),
    });

    renderForm();
    fillValidForm();
    submitForm();

    expect(
      await screen.findByText(/não está ativo no catálogo de modelos/),
    ).toBeInTheDocument();
  });
});
