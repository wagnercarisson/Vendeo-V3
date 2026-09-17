// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetLabEnvironment,
  mockListRecentExperiments,
  mockListPendingEvaluations,
} = vi.hoisted(() => ({
  mockGetLabEnvironment: vi.fn(),
  mockListRecentExperiments: vi.fn(),
  mockListPendingEvaluations: vi.fn(),
}));

vi.mock("@/lib/lab/environment-guard", () => ({
  getLabEnvironment: () => mockGetLabEnvironment(),
  assertLabEnvironment: vi.fn(),
  labEnvironmentDeniedBody: (reason: string) => ({ error: "environment_blocked", reason }),
  LabEnvironmentError: class LabEnvironmentError extends Error {},
}));

vi.mock("@/lib/lab/api/experiment-queries", () => ({
  listRecentExperiments: (...args: unknown[]) => mockListRecentExperiments(...args),
  listPendingEvaluations: (...args: unknown[]) => mockListPendingEvaluations(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import LaboratorioPage from "@/app/(app)/admin/laboratorio/page";
import type { LabTechnicalAlert, LabTechnicalValidation } from "@/lib/lab/technical-validation";
import { ComparisonView } from "../comparison-view";
import type { ComparisonEvaluation, ComparisonRun } from "../comparison-format";
import { EvaluationForm } from "../evaluation-form";
import { ExperimentForm } from "../experiment-form";
import { RunExecutionPanel } from "../run-execution-panel";

/**
 * F48.1 — suíte de contrato nº 2 (48-1-12, task 12.5): UI administrativa.
 *
 * Trava o contrato visual do laboratório: página inicial (com estado vazio),
 * estado desabilitado sem acesso a dados, criação prompt-only com modelo fixo e
 * limites travados, confirmação com estimativa + progresso NDJSON, comparação com
 * modo cego, avaliação/reavaliação append-only, acessibilidade básica e a
 * **ausência de qualquer nota automática de qualidade**.
 *
 * `fetch` é sempre mockado: nenhuma chamada de rede.
 */

const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";
const SCENARIO_A = "aaaaaaaa-1111-4111-8111-111111111111";
const SCENARIO_B = "bbbbbbbb-2222-4222-8222-222222222222";
const BASELINE_RUN_ID = "11111111-1111-4111-8111-111111111111";
const CANDIDATE_RUN_ID = "22222222-2222-4222-8222-222222222222";

const PROMPT_NAME = "campaign-image-director-offer";
const MODEL_TARGET = { provider: "openai", model: "gpt-5.5", protocol: "responses" };
const PROMPT_HASH = "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

/** Vocabulário proibido de julgamento automático de qualidade (uso só negativo). */
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

const ENABLED_ENV = { enabled: true, supabaseHost: "localhost", local: true, reason: "ok" };
const DISABLED_ENV = {
  enabled: false,
  supabaseHost: null,
  local: false,
  reason: "disabled_flag",
};

const EXPERIMENT_SUMMARY = {
  id: EXPERIMENT_ID,
  name: "Exp prompt",
  status: "running",
  repetitions: 1,
  maxRuns: 6,
  runsUsed: 1,
  remainingRuns: 5,
  scenarioCount: 1,
  updatedAt: "2026-09-16T12:00:00.000Z",
};

const PENDING_EVALUATION = {
  experimentId: EXPERIMENT_ID,
  experimentName: "Exp prompt",
  scenarioVersionId: SCENARIO_A,
  scenarioLabel: "produto-oferta-preco v1",
  baselineRunId: BASELINE_RUN_ID,
  candidateRunId: CANDIDATE_RUN_ID,
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

const ESTIMATE = {
  perRun: {
    estimatedCostUsd: 0.04,
    costSource: "pricing_table",
    textComponentUsd: 0.01,
    imageToolComponentUsd: 0.03,
  },
  perRunCoverage: "complete",
  plannedRuns: 3,
  remainingRuns: 5,
  totalEstimatedUsd: 0.12,
  coverage: "complete",
};

function validation(alerts: LabTechnicalAlert[] = []): LabTechnicalValidation {
  return {
    decodable: true,
    mimeType: "image/png",
    width: 1024,
    height: 1024,
    bytes: 204800,
    aspectRatio: 1,
    uniform: false,
    emptyOrCorrupt: false,
    alerts,
    structuredOutputValid: null,
    ocrAlert: null,
  };
}

function comparisonRun(overrides: Partial<ComparisonRun> & { id: string }): ComparisonRun {
  return {
    variantRole: "baseline",
    scenarioVersionId: SCENARIO_A,
    repetitionIndex: 1,
    runSequence: 1,
    status: "succeeded",
    latencyMs: 8400,
    estimatedCostUsd: 0.0412,
    costCoverage: "complete",
    provider: "openai",
    model: "gpt-5.5",
    promptName: PROMPT_NAME,
    promptContentHash: PROMPT_HASH,
    errorType: null,
    errorMessage: null,
    technicalValidation: validation(),
    artifactUrl: "https://storage.local/lab/output.png",
    artifactBytes: 204800,
    ...overrides,
  };
}

const BASELINE_REP1 = comparisonRun({
  id: BASELINE_RUN_ID,
  variantRole: "baseline",
  artifactUrl: "https://storage.local/lab/baseline-rep1.png",
});
const CANDIDATE_REP1 = comparisonRun({
  id: CANDIDATE_RUN_ID,
  variantRole: "candidate",
  runSequence: 2,
  latencyMs: 12500,
  estimatedCostUsd: 0.0518,
  costCoverage: "partial",
  artifactUrl: "https://storage.local/lab/candidate-rep1.png",
});
const BASELINE_REP2 = comparisonRun({
  id: "33333333-3333-4333-8333-333333333333",
  variantRole: "baseline",
  repetitionIndex: 2,
  runSequence: 3,
  artifactUrl: "https://storage.local/lab/baseline-rep2.png",
});
const CANDIDATE_REP2 = comparisonRun({
  id: "44444444-4444-4444-8444-444444444444",
  variantRole: "candidate",
  repetitionIndex: 2,
  runSequence: 4,
  artifactUrl: "https://storage.local/lab/candidate-rep2.png",
});

const EVAL_1: ComparisonEvaluation = {
  id: "eval-1",
  scenarioVersionId: SCENARIO_A,
  baselineRunId: BASELINE_RUN_ID,
  candidateRunId: CANDIDATE_RUN_ID,
  blindOrder: "baseline_left",
  verdict: "baseline",
  observation: "Primeira observação registrada",
  evaluatorId: "99999999-9999-4999-8999-999999999999",
  createdAt: "2026-09-16T12:00:00.000Z",
};

const EVAL_2: ComparisonEvaluation = {
  ...EVAL_1,
  id: "eval-2",
  verdict: "candidate",
  blindOrder: "candidate_left",
  observation: "Segunda observação registrada",
  createdAt: "2026-09-16T13:30:00.000Z",
};

const mockFetch = vi.fn();

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => payload,
  };
}

function ndjsonResponse() {
  const encoder = new TextEncoder();
  const events = [
    { type: "phase", phase: "running", runId: "run-123" },
    { type: "phase", phase: "generation", runId: "run-123" },
    { type: "done", status: "succeeded", runId: "run-123" },
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn().mockReturnValue("00000000-0000-4000-8000-0000000000aa"),
  });
  mockGetLabEnvironment.mockReturnValue(ENABLED_ENV);
  mockListRecentExperiments.mockResolvedValue([EXPERIMENT_SUMMARY]);
  mockListPendingEvaluations.mockResolvedValue([PENDING_EVALUATION]);
});

afterEach(() => vi.unstubAllGlobals());

// ─── 1. Página inicial ───────────────────────────────────────────────────────

describe("contrato de UI — página inicial", () => {
  it("renderiza experimentos recentes e avaliações pendentes com links ao detalhe", async () => {
    render(await LaboratorioPage());

    expect(screen.getByRole("heading", { name: "Experimentos recentes" })).toBeInTheDocument();
    const experimentLink = screen.getByRole("link", { name: "Exp prompt" });
    expect(experimentLink).toHaveAttribute(
      "href",
      `/admin/laboratorio/experimentos/${EXPERIMENT_ID}`,
    );

    expect(screen.getByRole("heading", { name: "Avaliações pendentes" })).toBeInTheDocument();
    expect(screen.getByText("produto-oferta-preco v1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Comparar" })).toHaveAttribute(
      "href",
      `/admin/laboratorio/experimentos/${EXPERIMENT_ID}/comparar`,
    );
  });

  it("mostra o estado vazio com a ação de criar experimento", async () => {
    mockListRecentExperiments.mockResolvedValue([]);
    mockListPendingEvaluations.mockResolvedValue([]);

    render(await LaboratorioPage());

    expect(screen.getByText("Nenhum experimento ainda")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma avaliação pendente.")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Novo experimento" }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

// ─── 2. Estado desabilitado ──────────────────────────────────────────────────

describe("contrato de UI — ambiente desabilitado", () => {
  it("mostra o aviso com o motivo legível e não acessa nenhum dado", async () => {
    mockGetLabEnvironment.mockReturnValue(DISABLED_ENV);

    render(await LaboratorioPage());

    expect(screen.getByText("Laboratório desabilitado neste ambiente")).toBeInTheDocument();
    expect(screen.getByText("disabled_flag")).toBeInTheDocument();
    expect(screen.getByText("A flag VENDEO_LAB_ENABLED não está ativa")).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma tabela lab_\*/)).toBeInTheDocument();

    expect(mockListRecentExperiments).not.toHaveBeenCalled();
    expect(mockListPendingEvaluations).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── 3. Criação prompt-only ──────────────────────────────────────────────────

describe("contrato de UI — criação prompt-only", () => {
  function renderForm() {
    return render(
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

  function fillValidForm() {
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Experimento" } });
    fireEvent.change(screen.getByLabelText("Objetivo"), { target: { value: "Comparar" } });
    fireEvent.change(screen.getByLabelText("Hipótese"), { target: { value: "Melhora" } });
    selectScenarios([SCENARIOS[0].id]);
    fireEvent.change(screen.getByLabelText(/prompt candidato/i), {
      target: { value: "Conteúdo candidato com mais de vinte caracteres." },
    });
  }

  it("fixa a dimensão prompt e o modelo, sem controle editável por variante", () => {
    renderForm();

    expect(screen.getByTestId("lab-changed-dimension")).toHaveTextContent("prompt");
    expect(screen.getByTestId("lab-model-fixed")).toHaveTextContent("openai/gpt-5.5 (responses)");
    expect(screen.queryByRole("combobox", { name: /dimens|modelo/i })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /modelo/i })).toBeNull();
  });

  it("limita a seleção a 3 cenários, repetições a 1–3 e o teto a 12", () => {
    renderForm();

    selectScenarios(SCENARIOS.map((scenario) => scenario.id));
    expect(
      (screen.getByLabelText("Cenários") as HTMLSelectElement).selectedOptions.length,
    ).toBe(3);
    expect(screen.getByText("Selecione no máximo 3 cenários")).toBeInTheDocument();

    const repetitions = screen.getByLabelText("Repetições");
    expect(
      within(repetitions)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["1", "2", "3"]);

    const maxRuns = screen.getByLabelText("Teto de execuções");
    expect(maxRuns).toHaveAttribute("min", "1");
    expect(maxRuns).toHaveAttribute("max", "12");
  });

  it("envia o POST de criação e navega ao detalhe", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ experimentId: EXPERIMENT_ID, status: "ready" }, 201));
    renderForm();
    fillValidForm();
    fireEvent.submit(screen.getByTestId("lab-create-button").closest("form")!);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/laboratorio/experiments");
    expect(JSON.parse(String(init.body)).changedDimension).toBe("prompt");
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        `/admin/laboratorio/experimentos/${EXPERIMENT_ID}`,
      ),
    );
  });

  it("exibe o erro da API em accent.red", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: "unsupported_changed_dimension" }, 400),
    );
    renderForm();
    fillValidForm();
    fireEvent.submit(screen.getByTestId("lab-create-button").closest("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("text-accent-red");
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─── 4. Confirmação com estimativa + NDJSON ──────────────────────────────────

describe("contrato de UI — confirmação com estimativa e progresso NDJSON", () => {
  function renderPanel() {
    return render(
      <RunExecutionPanel
        experimentId={EXPERIMENT_ID}
        variants={[
          { id: BASELINE_RUN_ID, role: "baseline", label: "Baseline oficial" },
          { id: CANDIDATE_RUN_ID, role: "candidate", label: "Candidata" },
        ]}
        scenarios={[{ id: SCENARIO_A, label: "produto-oferta-preco v1" }]}
        repetitions={3}
        budget={{ maxRuns: 6, used: 1, remaining: 5 }}
        experimentStatus="ready"
      />,
    );
  }

  function runCalls() {
    return mockFetch.mock.calls.filter(([url]) => String(url).endsWith("/runs"));
  }

  async function openConfirmation() {
    fireEvent.click(screen.getByTestId("lab-run-button"));
    await screen.findByTestId("lab-run-estimate");
    await screen.findByTestId("lab-confirm-button");
  }

  it("exibe a estimativa por componente e a cobertura antes de qualquer POST", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(ESTIMATE));
    renderPanel();

    expect(screen.getByText("5 de 6 execuções restantes")).toBeInTheDocument();

    await openConfirmation();

    const estimateCard = screen.getByTestId("lab-run-estimate");
    expect(within(estimateCard).getByText("US$ 0.0400")).toBeInTheDocument();
    expect(within(estimateCard).getByText("US$ 0.1200")).toBeInTheDocument();
    expect(within(estimateCard).getByText("complete")).toBeInTheDocument();
    expect(within(estimateCard).getByText(/texto US\$ 0\.0100/)).toBeInTheDocument();
    expect(within(estimateCard).getByText(/imagem US\$ 0\.0300/)).toBeInTheDocument();

    expect(runCalls()).toHaveLength(0);
    expect(
      String(mockFetch.mock.calls[0][0]),
    ).toContain(`/api/admin/laboratorio/experiments/${EXPERIMENT_ID}/estimate`);
  });

  it("confirma com confirmed true + operationId e consome o NDJSON até o runId", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(ESTIMATE)).mockResolvedValueOnce(ndjsonResponse());
    renderPanel();

    await openConfirmation();
    fireEvent.click(screen.getByTestId("lab-confirm-button"));

    await waitFor(() => expect(runCalls()).toHaveLength(1));
    const [url, init] = runCalls()[0];
    expect(String(url)).toBe(`/api/admin/laboratorio/experiments/${EXPERIMENT_ID}/runs`);
    const body = JSON.parse(String(init.body));
    expect(body.confirmed).toBe(true);
    expect(body.operationId).toBe("00000000-0000-4000-8000-0000000000aa");
    expect(body.variantId).toBe(BASELINE_RUN_ID);
    expect(body.scenarioVersionId).toBe(SCENARIO_A);

    expect(await screen.findByTestId("lab-run-id")).toHaveTextContent("Run run-123 concluído");
    expect(screen.getByTestId("lab-run-phases")).toHaveTextContent("Gerando a arte");
  });

  it("bloqueia o botão com o teto atingido", () => {
    render(
      <RunExecutionPanel
        experimentId={EXPERIMENT_ID}
        variants={[{ id: BASELINE_RUN_ID, role: "baseline", label: "Baseline" }]}
        scenarios={[{ id: SCENARIO_A, label: "produto-oferta-preco v1" }]}
        repetitions={1}
        budget={{ maxRuns: 6, used: 6, remaining: 0 }}
        experimentStatus="ready"
      />,
    );

    expect(screen.getByTestId("lab-run-button")).toBeDisabled();
  });
});

// ─── 5. Comparação e modo cego ───────────────────────────────────────────────

describe("contrato de UI — comparação lado a lado e modo cego", () => {
  function renderView(runs: ComparisonRun[] = [BASELINE_REP1, CANDIDATE_REP1]) {
    return render(
      <ComparisonView
        experimentId={EXPERIMENT_ID}
        scenarioOptions={[{ id: SCENARIO_A, label: "produto-oferta-preco v1" }]}
        runs={runs}
        evaluations={[]}
      />,
    );
  }

  it("exibe os dois painéis com arte assinada, custo, latência e alertas", () => {
    renderView();

    expect(screen.getByAltText("Arte da variante Baseline — repetição 1")).toHaveAttribute(
      "src",
      "https://storage.local/lab/baseline-rep1.png",
    );
    expect(screen.getByAltText("Arte da variante Candidata — repetição 1")).toHaveAttribute(
      "src",
      "https://storage.local/lab/candidate-rep1.png",
    );
    expect(screen.getByText("8.4 s")).toBeInTheDocument();
    expect(screen.getByText("12.5 s")).toBeInTheDocument();
    expect(screen.getByText("US$ 0.0412 · Custo completo")).toBeInTheDocument();
    expect(screen.getByText("≈ US$ 0.0518 · Custo parcial")).toBeInTheDocument();
    expect(screen.getAllByText("1024 × 1024")).toHaveLength(2);
    // O formulário de avaliação é renderizado de verdade: o CTA do contrato existe.
    expect(screen.getByRole("button", { name: "Registrar avaliação" })).toBeInTheDocument();
  });

  it("oculta modelo/prompt no modo cego e os revela depois", () => {
    renderView();

    const blindSwitch = screen.getByRole("switch", { name: "Modo cego" });
    expect(blindSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(blindSwitch);

    expect(screen.getByRole("switch", { name: "Modo cego" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByText("openai/gpt-5.5")).not.toBeInTheDocument();
    expect(screen.getAllByText("Modelo oculto (modo cego)")).toHaveLength(2);
    expect(screen.getAllByText("Prompt oculto (modo cego)")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Revelar" }));

    expect(screen.getAllByText("openai/gpt-5.5")).toHaveLength(2);
    expect(screen.queryByText("Modelo oculto (modo cego)")).not.toBeInTheDocument();
  });

  it("troca o par comparado ao mudar a repetição", () => {
    renderView([BASELINE_REP1, CANDIDATE_REP1, BASELINE_REP2, CANDIDATE_REP2]);

    fireEvent.change(screen.getByRole("combobox", { name: "Repetição" }), {
      target: { value: "2" },
    });

    expect(screen.getByAltText("Arte da variante Baseline — repetição 2")).toHaveAttribute(
      "src",
      "https://storage.local/lab/baseline-rep2.png",
    );
    expect(
      screen.queryByAltText("Arte da variante Baseline — repetição 1"),
    ).not.toBeInTheDocument();
  });

  it("exibe o erro sanitizado e o alerta técnico sem julgamento automático", () => {
    renderView([
      comparisonRun({
        id: "55555555-5555-4555-8555-555555555555",
        variantRole: "baseline",
        technicalValidation: { ...validation(), alerts: ["uniform_image"] },
      }),
      comparisonRun({
        id: "66666666-6666-4666-8666-666666666666",
        variantRole: "candidate",
        runSequence: 2,
        status: "failed",
        latencyMs: null,
        estimatedCostUsd: null,
        costCoverage: "missing",
        errorType: "provider_error",
        errorMessage: "A chamada ao provider falhou (detalhes omitidos)",
        artifactUrl: null,
        artifactBytes: null,
      }),
    ]);

    expect(screen.getByText("Imagem uniforme (branca/preta/vazia)")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "provider_error: A chamada ao provider falhou (detalhes omitidos)",
    );
  });
});

// ─── 6. Avaliação e reavaliação ──────────────────────────────────────────────

describe("contrato de UI — avaliação humana e reavaliação", () => {
  function renderForm(overrides: {
    latestEvaluation?: ComparisonEvaluation | null;
    history?: ComparisonEvaluation[];
    blindOrder?: "baseline_left" | "candidate_left" | null;
  } = {}) {
    return render(
      <EvaluationForm
        experimentId={EXPERIMENT_ID}
        scenarioVersionId={SCENARIO_A}
        baselineRunId={BASELINE_RUN_ID}
        candidateRunId={CANDIDATE_RUN_ID}
        blindOrder={overrides.blindOrder === undefined ? "baseline_left" : overrides.blindOrder}
        latestEvaluation={overrides.latestEvaluation ?? null}
        history={overrides.history ?? []}
      />,
    );
  }

  function submitForm() {
    fireEvent.submit(
      screen.getByRole("button", { name: "Registrar avaliação" }).closest("form")!,
    );
  }

  it("oferece os 4 verdicts e desabilita o CTA sem verdict", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "Baseline melhor" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Candidata melhor" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Empate" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Nenhuma adequada" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Registrar avaliação" })).toBeDisabled();
  });

  it("envia runs comparados, verdict, ordem cega e observação", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ evaluationId: "eval-2", createdAt: EVAL_2.createdAt }, 201));
    renderForm({ blindOrder: "candidate_left" });

    fireEvent.click(screen.getByRole("radio", { name: "Candidata melhor" }));
    fireEvent.change(screen.getByLabelText("Observação"), {
      target: { value: "A candidata preservou melhor o preço" },
    });
    submitForm();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`/api/admin/laboratorio/experiments/${EXPERIMENT_ID}/evaluations`);
    expect(JSON.parse(String(init.body))).toEqual({
      scenarioVersionId: SCENARIO_A,
      baselineRunId: BASELINE_RUN_ID,
      candidateRunId: CANDIDATE_RUN_ID,
      verdict: "candidate",
      blindOrder: "candidate_left",
      observation: "A candidata preservou melhor o preço",
    });
    expect(await screen.findByText("Avaliação registrada.")).toBeInTheDocument();
  });

  it("reavaliar cria novo registro e preserva o anterior no histórico", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ evaluationId: "eval-2", createdAt: EVAL_2.createdAt }, 201));
    const { rerender } = renderForm({ latestEvaluation: EVAL_1 });

    fireEvent.click(screen.getByRole("radio", { name: "Empate" }));
    submitForm();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender(
      <EvaluationForm
        experimentId={EXPERIMENT_ID}
        scenarioVersionId={SCENARIO_A}
        baselineRunId={BASELINE_RUN_ID}
        candidateRunId={CANDIDATE_RUN_ID}
        blindOrder="baseline_left"
        latestEvaluation={EVAL_2}
        history={[EVAL_1]}
      />,
    );

    expect(screen.getAllByTestId("evaluation-entry")).toHaveLength(2);
    expect(screen.getByText("Histórico de avaliações (1)")).toBeInTheDocument();
    expect(screen.getByText("Primeira observação registrada")).toBeInTheDocument();
  });
});

// ─── 7. Nenhuma nota automática ──────────────────────────────────────────────

describe("contrato de UI — nenhuma nota automática de qualidade", () => {
  it("nenhuma tela renderiza julgamento automático de qualidade", async () => {
    const page = render(await LaboratorioPage());
    expect(page.container.textContent ?? "").not.toMatch(/score|rating|publicável|ranking|percentual|\bnota\b/i);
    page.unmount();

    const comparison = render(
      <ComparisonView
        experimentId={EXPERIMENT_ID}
        scenarioOptions={[{ id: SCENARIO_A, label: "produto-oferta-preco v1" }]}
        runs={[BASELINE_REP1, CANDIDATE_REP1]}
        evaluations={[EVAL_2]}
      />,
    );
    expect(comparison.container.textContent ?? "").not.toMatch(/score|rating|publicável|ranking|percentual|\bnota\b/i);
    comparison.unmount();

    const evaluation = render(
      <EvaluationForm
        experimentId={EXPERIMENT_ID}
        scenarioVersionId={SCENARIO_A}
        baselineRunId={BASELINE_RUN_ID}
        candidateRunId={CANDIDATE_RUN_ID}
        blindOrder={null}
        latestEvaluation={EVAL_2}
        history={[EVAL_1]}
      />,
    );
    expect(evaluation.container.textContent ?? "").not.toMatch(/score|rating|publicável|ranking|percentual|\bnota\b/i);
  });
});

// ─── 8. Acessibilidade básica ────────────────────────────────────────────────

describe("contrato de UI — acessibilidade básica", () => {
  it("associa rótulos aos campos e expõe o modo cego como switch", () => {
    render(
      <ComparisonView
        experimentId={EXPERIMENT_ID}
        scenarioOptions={[{ id: SCENARIO_A, label: "produto-oferta-preco v1" }]}
        runs={[BASELINE_REP1, CANDIDATE_REP1]}
        evaluations={[]}
      />,
    );

    expect(screen.getByLabelText("Cenário")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Repetição" })).toBeInTheDocument();
    expect(screen.getByLabelText("Observação")).toBeInTheDocument();

    const blindSwitch = screen.getByRole("switch", { name: "Modo cego" });
    expect(blindSwitch).toHaveAttribute("aria-checked", "false");
    expect(blindSwitch.className).toContain("min-h-[44px]");
    expect(blindSwitch.className).toContain("min-w-[44px]");
  });

  it("mantém alvos de toque ≥ 44px nos CTAs e nenhum emoji", async () => {
    const page = render(await LaboratorioPage());

    const cta = screen.getAllByRole("link", { name: "Novo experimento" })[0];
    expect(cta.className).toContain("min-h-[44px]");
    expect(EMOJI_PATTERN.test(page.container.textContent ?? "")).toBe(false);
    page.unmount();

    const panel = render(
      <RunExecutionPanel
        experimentId={EXPERIMENT_ID}
        variants={[{ id: BASELINE_RUN_ID, role: "baseline", label: "Baseline" }]}
        scenarios={[{ id: SCENARIO_A, label: "produto-oferta-preco v1" }]}
        repetitions={1}
        budget={{ maxRuns: 6, used: 0, remaining: 6 }}
        experimentStatus="ready"
      />,
    );
    expect(EMOJI_PATTERN.test(panel.container.textContent ?? "")).toBe(false);
  });
});
