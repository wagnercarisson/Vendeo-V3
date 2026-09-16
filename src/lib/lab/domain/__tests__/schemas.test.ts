// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  CHANGED_DIMENSIONS,
  CreateLabEvaluationInputSchema,
  CreateLabExperimentInputSchema,
  FUTURE_CHANGED_DIMENSIONS,
  UnsupportedChangedDimensionError,
  parseCreateLabEvaluationInput,
  parseCreateLabExperimentInput,
} from "../schemas";

/**
 * Schemas de criação/avaliação do laboratório (F48.1, D5/D13/D14).
 *
 * Trava o contrato: dimensão única `prompt` (com rejeição determinística de
 * `model`/`configuration`), limites de cenários/repetições/teto, baseline sem
 * conteúdo do cliente, candidata com override, alvo/params somente no
 * experimento (nenhum alvo por variante) e avaliação com runs distintos.
 */

const SCENARIO_A = "11111111-1111-4111-8111-111111111111";
const SCENARIO_B = "22222222-2222-4222-8222-222222222222";
const SCENARIO_C = "33333333-3333-4333-8333-333333333333";
const SCENARIO_D = "44444444-4444-4444-8444-444444444444";
const RUN_BASELINE = "55555555-5555-4555-8555-555555555555";
const RUN_CANDIDATE = "66666666-6666-4666-8666-666666666666";

/** Entrada de criação válida mínima — ponto de partida das variações. */
function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Prompt enxuto vs atual",
    objective: "Reduzir instruções redundantes sem perder fidelidade",
    hypothesis: "Um prompt mais curto mantém a qualidade da arte",
    changedDimension: "prompt",
    modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
    params: { size: "1024x1024", quality: "high", skipInputValidation: true },
    repetitions: 1,
    scenarioVersionIds: [SCENARIO_A],
    baseline: { promptName: "campaign-image-director-offer" },
    candidate: {
      promptName: "campaign-image-director-offer",
      promptContent: "# Diretor de arte (candidata)\n\nInstruções enxutas.",
    },
    ...overrides,
  };
}

/** Entrada de avaliação válida mínima. */
function validEvaluation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    scenarioVersionId: SCENARIO_A,
    baselineRunId: RUN_BASELINE,
    candidateRunId: RUN_CANDIDATE,
    verdict: "candidate",
    ...overrides,
  };
}

function captureError(fn: () => unknown): unknown {
  try {
    fn();
    return null;
  } catch (caught) {
    return caught;
  }
}

describe("CreateLabExperimentInputSchema — criação válida", () => {
  it("aceita experimento prompt-only com 1 cenário e 1 repetição", () => {
    const parsed = parseCreateLabExperimentInput(validInput());

    expect(parsed.changedDimension).toBe("prompt");
    expect(parsed.repetitions).toBe(1);
    expect(parsed.scenarioVersionIds).toEqual([SCENARIO_A]);
    expect(parsed.modelTarget).toEqual({
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
    });
    expect(parsed.params.skipInputValidation).toBe(true);
    expect(parsed.baseline).toEqual({ promptName: "campaign-image-director-offer" });
    expect(parsed.candidate.promptContent).toContain("candidata");
  });

  it("aplica o default de maxRuns (6) quando ausente", () => {
    const parsed = parseCreateLabExperimentInput(validInput());

    expect(parsed.maxRuns).toBe(6);
  });

  it("aceita o teto absoluto de cenários (3) e de repetições (3)", () => {
    const parsed = parseCreateLabExperimentInput(
      validInput({
        repetitions: 3,
        maxRuns: 12,
        scenarioVersionIds: [SCENARIO_A, SCENARIO_B, SCENARIO_C],
      }),
    );

    expect(parsed.repetitions).toBe(3);
    expect(parsed.maxRuns).toBe(12);
    expect(parsed.scenarioVersionIds).toHaveLength(3);
  });

  it("expõe CHANGED_DIMENSIONS (executável) e FUTURE_CHANGED_DIMENSIONS (F48.2+)", () => {
    expect(CHANGED_DIMENSIONS).toEqual(["prompt"]);
    expect(FUTURE_CHANGED_DIMENSIONS).toEqual(["model", "configuration"]);
  });
});

describe("CreateLabExperimentInputSchema — dimensão não suportada", () => {
  it("changedDimension 'model' → UnsupportedChangedDimensionError com code", () => {
    const error = captureError(() =>
      parseCreateLabExperimentInput(validInput({ changedDimension: "model" })),
    );

    expect(error).toBeInstanceOf(UnsupportedChangedDimensionError);
    const typed = error as UnsupportedChangedDimensionError;
    expect(typed.code).toBe("unsupported_changed_dimension");
    expect(typed.dimension).toBe("model");
  });

  it("changedDimension 'configuration' → UnsupportedChangedDimensionError com code", () => {
    const error = captureError(() =>
      parseCreateLabExperimentInput(validInput({ changedDimension: "configuration" })),
    );

    expect(error).toBeInstanceOf(UnsupportedChangedDimensionError);
    expect((error as UnsupportedChangedDimensionError).code).toBe(
      "unsupported_changed_dimension",
    );
    expect((error as UnsupportedChangedDimensionError).dimension).toBe("configuration");
  });

  it("changedDimension desconhecido → erro genérico (não UnsupportedChangedDimensionError)", () => {
    const error = captureError(() =>
      parseCreateLabExperimentInput(validInput({ changedDimension: "temperature" })),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnsupportedChangedDimensionError);
  });
});

describe("CreateLabExperimentInputSchema — limites (LOCKED)", () => {
  it("rejeita repetitions acima de 3", () => {
    const result = CreateLabExperimentInputSchema.safeParse(validInput({ repetitions: 4 }));
    expect(result.success).toBe(false);
  });

  it("rejeita maxRuns acima de 12", () => {
    const result = CreateLabExperimentInputSchema.safeParse(validInput({ maxRuns: 13 }));
    expect(result.success).toBe(false);
  });

  it("rejeita 4 cenários (acima de MAX_SCENARIOS_PER_EXPERIMENT)", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({ scenarioVersionIds: [SCENARIO_A, SCENARIO_B, SCENARIO_C, SCENARIO_D] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita zero cenários", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({ scenarioVersionIds: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita cenário que não é UUID", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({ scenarioVersionIds: ["nao-e-uuid"] }),
    );
    expect(result.success).toBe(false);
  });
});

describe("CreateLabExperimentInputSchema — comparação justa (D5/D18)", () => {
  it("rejeita skipInputValidation false (validação de visão é sempre dispensada)", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({
        params: { size: "1024x1024", quality: "high", skipInputValidation: false },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita alvo de modelo dentro de uma variante (chave extra, .strict())", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({
        candidate: {
          promptName: "campaign-image-director-offer",
          promptContent: "# Candidata",
          modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita baseline sem promptName", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({ baseline: {} }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita baseline que traz conteúdo próprio (baseline é o prompt oficial)", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({
        baseline: {
          promptName: "campaign-image-director-offer",
          promptContent: "# Conteúdo injetado pelo cliente",
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita candidata sem promptContent", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({ candidate: { promptName: "campaign-image-director-offer" } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita chave extra no root (.strict())", () => {
    const result = CreateLabExperimentInputSchema.safeParse(
      validInput({ primaryCapability: "campaign_image_edit" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("CreateLabEvaluationInputSchema — avaliação humana", () => {
  it("aceita avaliação válida com modo cego", () => {
    const parsed = parseCreateLabEvaluationInput(
      validEvaluation({ blindOrder: "baseline_left", observation: "Candidata mais limpa." }),
    );

    expect(parsed.verdict).toBe("candidate");
    expect(parsed.blindOrder).toBe("baseline_left");
    expect(parsed.observation).toBe("Candidata mais limpa.");
  });

  it("rejeita baselineRunId === candidateRunId com run_ids_must_differ", () => {
    const result = CreateLabEvaluationInputSchema.safeParse(
      validEvaluation({ candidateRunId: RUN_BASELINE }),
    );

    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("run_ids_must_differ");
  });

  it("parse rejeita runs iguais com a mensagem do issue", () => {
    const error = captureError(() =>
      parseCreateLabEvaluationInput(validEvaluation({ candidateRunId: RUN_BASELINE })),
    ) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("run_ids_must_differ");
  });

  it("rejeita verdict fora do enum", () => {
    const result = CreateLabEvaluationInputSchema.safeParse(
      validEvaluation({ verdict: "baseline_venceu" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita blindOrder fora do enum", () => {
    const result = CreateLabEvaluationInputSchema.safeParse(
      validEvaluation({ blindOrder: "shuffled" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita chave extra (.strict())", () => {
    const result = CreateLabEvaluationInputSchema.safeParse(
      validEvaluation({ evaluatorId: RUN_CANDIDATE }),
    );
    expect(result.success).toBe(false);
  });
});
