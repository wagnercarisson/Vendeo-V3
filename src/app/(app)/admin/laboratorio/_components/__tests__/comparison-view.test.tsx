// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LabTechnicalAlert } from "@/lib/lab/technical-validation";

import { ComparisonView } from "../comparison-view";
import type { ComparisonRun } from "../comparison-format";

/**
 * F48.1 (48-1-10, task 2.4) — comparação lado a lado.
 *
 * Prova a evidência objetiva por painel (arte assinada, status, latência em
 * `font-mono`, custo coerente com a cobertura, bytes, dimensões e alertas), o erro
 * sanitizado do run que falhou, o modo cego com revelação posterior, o
 * embaralhamento explícito com a ordem passada à avaliação, a troca de repetição e
 * a ausência de qualquer julgamento automático de qualidade.
 *
 * O formulário de avaliação é substituído por uma sonda que expõe as props
 * recebidas: o comportamento do formulário é coberto pelo seu próprio teste.
 */

vi.mock("../evaluation-form", () => ({
  EvaluationForm: (props: {
    baselineRunId: string;
    candidateRunId: string;
    blindOrder: string | null;
  }) => (
    <div
      data-testid="evaluation-form-probe"
      data-blind-order={props.blindOrder ?? undefined}
      data-baseline-run-id={props.baselineRunId}
      data-candidate-run-id={props.candidateRunId}
    />
  ),
}));

const SCENARIO_A = "aaaaaaaa-1111-4111-8111-111111111111";
const SCENARIO_B = "bbbbbbbb-2222-4222-8222-222222222222";

const PROMPT_HASH =
  "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

function validation(alerts: LabTechnicalAlert[] = []) {
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

function run(overrides: Partial<ComparisonRun> & { id: string }): ComparisonRun {
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
    promptName: "campaign-image-director-offer",
    promptContentHash: PROMPT_HASH,
    errorType: null,
    errorMessage: null,
    technicalValidation: validation(),
    artifactUrl: "https://storage.local/lab/output.png",
    artifactBytes: 204800,
    ...overrides,
  };
}

const BASELINE_REP1 = run({
  id: "11111111-1111-4111-8111-111111111111",
  variantRole: "baseline",
  runSequence: 1,
  latencyMs: 8400,
  artifactUrl: "https://storage.local/lab/baseline-rep1.png",
  artifactBytes: 204800,
});

const CANDIDATE_REP1 = run({
  id: "22222222-2222-4222-8222-222222222222",
  variantRole: "candidate",
  runSequence: 2,
  latencyMs: 12500,
  estimatedCostUsd: 0.0518,
  costCoverage: "partial",
  artifactUrl: "https://storage.local/lab/candidate-rep1.png",
  artifactBytes: 102400,
});

const BASELINE_REP2 = run({
  id: "33333333-3333-4333-8333-333333333333",
  variantRole: "baseline",
  repetitionIndex: 2,
  runSequence: 3,
  latencyMs: 8900,
  artifactUrl: "https://storage.local/lab/baseline-rep2.png",
});

const CANDIDATE_REP2 = run({
  id: "44444444-4444-4444-8444-444444444444",
  variantRole: "candidate",
  repetitionIndex: 2,
  runSequence: 4,
  latencyMs: 13100,
  estimatedCostUsd: 0.0518,
  costCoverage: "partial",
  artifactUrl: "https://storage.local/lab/candidate-rep2.png",
});

const RUNS_OK = [BASELINE_REP1, CANDIDATE_REP1, BASELINE_REP2, CANDIDATE_REP2];

const BASELINE_ALERT = run({
  id: "55555555-5555-4555-8555-555555555555",
  variantRole: "baseline",
  technicalValidation: validation(["uniform_image"]),
  artifactUrl: "https://storage.local/lab/baseline-alert.png",
});

const CANDIDATE_FAILED = run({
  id: "66666666-6666-4666-8666-666666666666",
  variantRole: "candidate",
  runSequence: 2,
  status: "failed",
  latencyMs: null,
  estimatedCostUsd: null,
  costCoverage: "missing",
  errorType: "provider_error",
  errorMessage: "A chamada ao provider falhou (detalhes omitidos)",
  technicalValidation: validation(["decode_failed"]),
  artifactUrl: null,
  artifactBytes: null,
});

const SCENARIOS = [{ id: SCENARIO_A, label: "produto-oferta-preco v1" }];

function renderView(runs: ComparisonRun[] = RUNS_OK) {
  return render(
    <ComparisonView
      experimentId="exp-1"
      scenarioOptions={SCENARIOS}
      runs={runs}
      evaluations={[]}
    />,
  );
}

function panelRoles(): string[] {
  return screen
    .getAllByTestId("comparison-panel-role")
    .map((element) => element.textContent ?? "");
}

describe("ComparisonView", () => {
  it("exibe os dois painéis com arte assinada e a evidência técnica objetiva", () => {
    renderView();

    expect(screen.getByAltText("Arte da variante Baseline — repetição 1")).toHaveAttribute(
      "src",
      "https://storage.local/lab/baseline-rep1.png",
    );
    expect(screen.getByAltText("Arte da variante Candidata — repetição 1")).toHaveAttribute(
      "src",
      "https://storage.local/lab/candidate-rep1.png",
    );

    expect(panelRoles()).toEqual(["Baseline", "Candidata"]);
    expect(screen.getAllByText("Concluído")).toHaveLength(2);
    expect(screen.getByText("produto-oferta-preco v1")).toBeInTheDocument();

    const latency = screen.getByText("8.4 s");
    expect(latency).toHaveClass("font-mono");
    expect(screen.getByText("12.5 s")).toBeInTheDocument();

    expect(screen.getByText("US$ 0.0412 · Custo completo")).toBeInTheDocument();
    expect(screen.getByText("≈ US$ 0.0518 · Custo parcial")).toBeInTheDocument();

    expect(screen.getByText("200.0 KB")).toBeInTheDocument();
    expect(screen.getByText("100.0 KB")).toBeInTheDocument();
    expect(screen.getAllByText("1024 × 1024")).toHaveLength(2);

    expect(screen.getAllByText("openai/gpt-5.5")).toHaveLength(2);
    expect(screen.getAllByText("campaign-image-director-offer")).toHaveLength(2);
  });

  it("oculta modelo e prompt no modo cego e os traz de volta ao revelar", () => {
    renderView();

    expect(screen.getAllByText("openai/gpt-5.5")).toHaveLength(2);
    expect(screen.getAllByText("campaign-image-director-offer")).toHaveLength(2);

    fireEvent.click(screen.getByRole("switch", { name: "Modo cego" }));

    expect(screen.queryByText("openai/gpt-5.5")).not.toBeInTheDocument();
    expect(screen.queryByText("campaign-image-director-offer")).not.toBeInTheDocument();
    expect(screen.getAllByText("Modelo oculto (modo cego)")).toHaveLength(2);
    expect(screen.getAllByText("Prompt oculto (modo cego)")).toHaveLength(2);
    expect(screen.getByText("Modo cego ativo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar" }));

    expect(screen.getAllByText("openai/gpt-5.5")).toHaveLength(2);
    expect(screen.getAllByText("campaign-image-director-offer")).toHaveLength(2);
    expect(screen.queryByText("Modelo oculto (modo cego)")).not.toBeInTheDocument();
  });

  it("troca o par comparado ao mudar a repetição", () => {
    renderView();

    fireEvent.change(screen.getByRole("combobox", { name: "Repetição" }), {
      target: { value: "2" },
    });

    expect(screen.getByAltText("Arte da variante Baseline — repetição 2")).toHaveAttribute(
      "src",
      "https://storage.local/lab/baseline-rep2.png",
    );
    expect(screen.getByAltText("Arte da variante Candidata — repetição 2")).toHaveAttribute(
      "src",
      "https://storage.local/lab/candidate-rep2.png",
    );
    expect(screen.queryByAltText("Arte da variante Baseline — repetição 1")).not.toBeInTheDocument();
  });

  it("inverte os painéis ao embaralhar e só registra a ordem quando a escolha é cega", () => {
    renderView();

    expect(panelRoles()).toEqual(["Baseline", "Candidata"]);
    // Sem modo cego, a ordem NÃO é registrada na avaliação.
    expect(screen.getByTestId("evaluation-form-probe")).not.toHaveAttribute(
      "data-blind-order",
    );
    expect(screen.getByText("Ordem apresentada: Baseline à esquerda")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Modo cego" }));
    expect(screen.getByTestId("evaluation-form-probe")).toHaveAttribute(
      "data-blind-order",
      "baseline_left",
    );

    fireEvent.click(screen.getByRole("button", { name: "Embaralhar ordem" }));

    expect(panelRoles()).toEqual(["Candidata", "Baseline"]);
    expect(screen.getByTestId("evaluation-form-probe")).toHaveAttribute(
      "data-blind-order",
      "candidate_left",
    );
    expect(screen.getByText("Ordem apresentada: Candidata à esquerda")).toBeInTheDocument();

    // Revelar encerra o modo cego efetivo: a ordem deixa de ser registrada.
    fireEvent.click(screen.getByRole("button", { name: "Revelar" }));
    expect(screen.getByTestId("evaluation-form-probe")).not.toHaveAttribute(
      "data-blind-order",
    );
  });

  it("passa os runs comparados correntes ao formulário de avaliação", () => {
    renderView();

    expect(screen.getByTestId("evaluation-form-probe")).toHaveAttribute(
      "data-baseline-run-id",
      BASELINE_REP1.id,
    );
    expect(screen.getByTestId("evaluation-form-probe")).toHaveAttribute(
      "data-candidate-run-id",
      CANDIDATE_REP1.id,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Repetição" }), {
      target: { value: "2" },
    });

    expect(screen.getByTestId("evaluation-form-probe")).toHaveAttribute(
      "data-baseline-run-id",
      BASELINE_REP2.id,
    );
    expect(screen.getByTestId("evaluation-form-probe")).toHaveAttribute(
      "data-candidate-run-id",
      CANDIDATE_REP2.id,
    );
  });

  it("exibe o erro sanitizado e o alerta técnico do run que falhou", () => {
    renderView([BASELINE_ALERT, CANDIDATE_FAILED]);

    expect(screen.getByText("Imagem uniforme (branca/preta/vazia)")).toBeInTheDocument();
    expect(screen.getByText("Imagem não decodificável")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "provider_error: A chamada ao provider falhou (detalhes omitidos)",
    );
    expect(screen.getByText("Sem arte: Falhou.")).toBeInTheDocument();
    expect(screen.getByText("indisponível · Custo indisponível")).toBeInTheDocument();
  });

  it("não exibe nenhum julgamento automático de qualidade", () => {
    const { container } = renderView();
    expect(container.textContent ?? "").not.toMatch(/nota|score|pontua|%|publicável|ranking/i);

    const failed = render(<ComparisonView
      experimentId="exp-1"
      scenarioOptions={SCENARIOS}
      runs={[BASELINE_ALERT, CANDIDATE_FAILED]}
      evaluations={[]}
    />);
    expect(failed.container.textContent ?? "").not.toMatch(
      /nota|score|pontua|%|publicável|ranking/i,
    );
  });

  it("mostra o estado sem runs comparáveis quando falta o par", () => {
    renderView([]);
    expect(screen.getByText("Sem runs comparáveis")).toBeInTheDocument();

    render(
      <ComparisonView
        experimentId="exp-1"
        scenarioOptions={SCENARIOS}
        runs={[BASELINE_REP1]}
        evaluations={[]}
      />,
    );
    expect(screen.getAllByText("Sem runs comparáveis")).toHaveLength(2);
  });

  it("mantém os seletores visíveis quando o cenário inicial não tem par", () => {
    render(
      <ComparisonView
        experimentId="exp-1"
        scenarioOptions={[
          { id: SCENARIO_A, label: "produto-oferta-preco v1" },
          { id: SCENARIO_B, label: "produto-oferta-logo v1" },
        ]}
        runs={[
          run({ id: "b-baseline", variantRole: "baseline", scenarioVersionId: SCENARIO_B }),
          run({
            id: "b-candidate",
            variantRole: "candidate",
            scenarioVersionId: SCENARIO_B,
            runSequence: 2,
          }),
        ]}
        evaluations={[]}
      />,
    );

    // Cenário A não tem par → estado vazio, mas os seletores continuam visíveis.
    expect(screen.getByText("Sem runs comparáveis")).toBeInTheDocument();
    expect(screen.getByLabelText("Cenário")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Repetição" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cenário"), {
      target: { value: SCENARIO_B },
    });

    expect(screen.queryByText("Sem runs comparáveis")).not.toBeInTheDocument();
    expect(panelRoles()).toEqual(["Baseline", "Candidata"]);
  });

  it("oferece apenas repetições com o par completo", () => {
    renderView([
      // Repetição 1: apenas baseline (sem par).
      run({ id: "b-rep1", variantRole: "baseline", repetitionIndex: 1 }),
      // Repetição 2: par completo.
      run({ id: "b-rep2", variantRole: "baseline", repetitionIndex: 2 }),
      run({
        id: "c-rep2",
        variantRole: "candidate",
        repetitionIndex: 2,
        runSequence: 2,
      }),
    ]);

    const repetition = screen.getByRole("combobox", { name: "Repetição" });
    expect(
      within(repetition)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["2"]);
    expect(panelRoles()).toEqual(["Baseline", "Candidata"]);
  });

  it("reinicia o formulário de avaliação quando o par comparado muda", () => {
    render(
      <ComparisonView
        experimentId="exp-1"
        scenarioOptions={[
          { id: SCENARIO_A, label: "produto-oferta-preco v1" },
          { id: SCENARIO_B, label: "produto-oferta-logo v1" },
        ]}
        runs={[
          run({ id: "a-baseline", variantRole: "baseline", scenarioVersionId: SCENARIO_A }),
          run({
            id: "a-candidate",
            variantRole: "candidate",
            scenarioVersionId: SCENARIO_A,
            runSequence: 2,
          }),
          run({ id: "b-baseline", variantRole: "baseline", scenarioVersionId: SCENARIO_B }),
          run({
            id: "b-candidate",
            variantRole: "candidate",
            scenarioVersionId: SCENARIO_B,
            runSequence: 2,
          }),
        ]}
        evaluations={[]}
      />,
    );

    const before = screen.getByTestId("evaluation-form-probe");
    fireEvent.change(screen.getByLabelText("Cenário"), {
      target: { value: SCENARIO_B },
    });
    const after = screen.getByTestId("evaluation-form-probe");

    // A `key` muda com o par → remontagem → estado interno do formulário zerado
    // (a decisão nunca migra para outro par).
    expect(after).not.toBe(before);
    expect(after).toHaveAttribute("data-baseline-run-id", "b-baseline");
  });
});
