// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComparisonEvaluation } from "../comparison-format";
import { EvaluationForm } from "../evaluation-form";

/**
 * F48.1 (48-1-10, task 3.3) — registro e reavaliação humana.
 *
 * Prova os 4 verdicts com rótulos exatos e sem pré-seleção, o CTA desabilitado até
 * haver verdict, o payload enviado (runs comparados + ordem cega + observação) para
 * a rota correta, a confirmação, a exibição da avaliação mais recente e o histórico
 * append-only (reavaliar cria novo registro e preserva o anterior) — e a ausência
 * de qualquer julgamento automático de qualidade.
 */

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => vi.unstubAllGlobals());

const EXPERIMENT_ID = "exp-1";
const SCENARIO_VERSION_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const BASELINE_RUN_ID = "11111111-1111-4111-8111-111111111111";
const CANDIDATE_RUN_ID = "22222222-2222-4222-8222-222222222222";

const EVAL_1: ComparisonEvaluation = {
  id: "eval-1",
  scenarioVersionId: SCENARIO_VERSION_ID,
  baselineRunId: BASELINE_RUN_ID,
  candidateRunId: CANDIDATE_RUN_ID,
  blindOrder: "baseline_left",
  verdict: "baseline",
  observation: "Primeira observação registrada",
  evaluatorId: "99999999-9999-4999-8999-999999999999",
  createdAt: "2026-09-16T12:00:00.000Z",
};

const EVAL_2: ComparisonEvaluation = {
  id: "eval-2",
  scenarioVersionId: SCENARIO_VERSION_ID,
  baselineRunId: BASELINE_RUN_ID,
  candidateRunId: CANDIDATE_RUN_ID,
  blindOrder: "candidate_left",
  verdict: "candidate",
  observation: "Segunda observação registrada",
  evaluatorId: "99999999-9999-4999-8999-999999999999",
  createdAt: "2026-09-16T13:30:00.000Z",
};

function renderForm(overrides: {
  latestEvaluation?: ComparisonEvaluation | null;
  history?: ComparisonEvaluation[];
  blindOrder?: "baseline_left" | "candidate_left";
} = {}) {
  return render(
    <EvaluationForm
      experimentId={EXPERIMENT_ID}
      scenarioVersionId={SCENARIO_VERSION_ID}
      baselineRunId={BASELINE_RUN_ID}
      candidateRunId={CANDIDATE_RUN_ID}
      blindOrder={overrides.blindOrder ?? "baseline_left"}
      latestEvaluation={overrides.latestEvaluation ?? null}
      history={overrides.history ?? []}
    />,
  );
}

function submitForm() {
  fireEvent.submit(screen.getByRole("button", { name: "Registrar avaliação" }).closest("form")!);
}

describe("EvaluationForm", () => {
  it("oferece os 4 verdicts com os rótulos exatos e sem pré-seleção", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "Baseline melhor" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Candidata melhor" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Empate" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Nenhuma adequada" })).not.toBeChecked();

    expect(screen.getByRole("button", { name: "Registrar avaliação" })).toBeDisabled();
    expect(
      screen.getByText("Nenhuma avaliação registrada para este cenário ainda."),
    ).toBeInTheDocument();
  });

  it("habilita o CTA ao escolher o verdict e envia runs comparados, ordem cega e observação", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ evaluationId: "eval-2", createdAt: EVAL_2.createdAt }),
    });

    renderForm({ blindOrder: "candidate_left" });

    const submit = screen.getByRole("button", { name: "Registrar avaliação" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Candidata melhor" }));
    expect(submit).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Observação"), {
      target: { value: "A candidata preservou melhor o preço" },
    });

    submitForm();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [url, init] = mockFetch.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe(`/api/admin/laboratorio/experiments/${EXPERIMENT_ID}/evaluations`);
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toEqual({
      scenarioVersionId: SCENARIO_VERSION_ID,
      baselineRunId: BASELINE_RUN_ID,
      candidateRunId: CANDIDATE_RUN_ID,
      verdict: "candidate",
      blindOrder: "candidate_left",
      observation: "A candidata preservou melhor o preço",
    });

    expect(await screen.findByText("Avaliação registrada.")).toBeInTheDocument();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("exibe a avaliação mais recente com avaliador, timestamp e runs comparados", () => {
    renderForm({ latestEvaluation: EVAL_1 });

    expect(screen.getAllByTestId("evaluation-entry")).toHaveLength(1);
    expect(screen.getByText("Avaliação mais recente")).toBeInTheDocument();
    expect(screen.getByTestId("evaluation-verdict")).toHaveTextContent("Baseline melhor");
    expect(screen.getByText("Primeira observação registrada")).toBeInTheDocument();
    expect(screen.getByTestId("evaluation-evaluator")).toHaveTextContent("99999999");
    expect(screen.getByTestId("evaluation-created-at")).toHaveTextContent(/\/\d{4}/);
    expect(screen.getByTestId("evaluation-runs")).toHaveTextContent("11111111 · 22222222");
    expect(screen.getByText("Ordem cega apresentada: Baseline à esquerda")).toBeInTheDocument();
  });

  it("reavalia com novo POST e preserva a avaliação anterior no histórico", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ evaluationId: "eval-2", createdAt: EVAL_2.createdAt }),
    });

    const { rerender } = renderForm({ latestEvaluation: EVAL_1 });

    expect(screen.getAllByTestId("evaluation-entry")).toHaveLength(1);

    fireEvent.click(screen.getByRole("radio", { name: "Empate" }));
    fireEvent.change(screen.getByLabelText("Observação"), {
      target: { value: "Segunda observação registrada" },
    });
    submitForm();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Avaliação registrada.")).toBeInTheDocument();

    // Simula o `router.refresh()`: a página do servidor volta com a nova avaliação
    // mais recente e a anterior no histórico.
    rerender(
      <EvaluationForm
        experimentId={EXPERIMENT_ID}
        scenarioVersionId={SCENARIO_VERSION_ID}
        baselineRunId={BASELINE_RUN_ID}
        candidateRunId={CANDIDATE_RUN_ID}
        blindOrder="baseline_left"
        latestEvaluation={EVAL_2}
        history={[EVAL_1]}
      />,
    );

    expect(screen.getAllByTestId("evaluation-entry")).toHaveLength(2);
    expect(screen.getAllByTestId("evaluation-verdict")[0]).toHaveTextContent(
      "Candidata melhor",
    );
    expect(screen.getByText("Segunda observação registrada")).toBeInTheDocument();
    expect(screen.getByText("Histórico de avaliações (1)")).toBeInTheDocument();
    // A avaliação anterior permanece preservada (append-only).
    expect(screen.getByText("Primeira observação registrada")).toBeInTheDocument();
    expect(screen.getByText("Avaliação anterior")).toBeInTheDocument();
  });

  it("exibe o motivo do erro 400 invalid_comparison_runs", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_comparison_runs" }),
    });

    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "Empate" }));
    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("não formam um par válido");
    expect(screen.queryByText("Avaliação registrada.")).not.toBeInTheDocument();
  });

  it("exibe o motivo do erro 403 environment_blocked", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "environment_blocked" }),
    });

    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "Nenhuma adequada" }));
    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O laboratório está bloqueado neste ambiente",
    );
  });

  it("não exibe nenhum julgamento automático de qualidade", () => {
    const { container } = renderForm({
      latestEvaluation: EVAL_2,
      history: [EVAL_1],
      blindOrder: "candidate_left",
    });

    expect(container.textContent ?? "").not.toMatch(
      /nota|score|pontua|%|publicável|ranking/i,
    );
  });
});
