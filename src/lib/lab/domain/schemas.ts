import { z } from "zod";

import {
  DEFAULT_MAX_RUNS_PER_EXPERIMENT,
  MAX_REPETITIONS,
  MAX_RUNS_PER_EXPERIMENT,
  MAX_SCENARIOS_PER_EXPERIMENT,
} from "@/lib/lab/limits";

/**
 * Schemas de entrada do domínio de experimentos do Laboratório de IA
 * (F48.1, D5/D13/D14).
 *
 * Módulo **puro** — sem `server-only`, sem I/O, sem `process.env`. Importável por
 * testes, pela API administrativa e pela UI.
 *
 * ## Dimensão única nesta fase (D5)
 *
 * O schema **conhece** as três dimensões (`prompt`/`model`/`configuration`) para
 * poder devolver um erro explícito e determinístico, mas só aceita `prompt`:
 * `CHANGED_DIMENSIONS` é o conjunto executável hoje e `FUTURE_CHANGED_DIMENSIONS`
 * é exatamente o que `UnsupportedChangedDimensionError` sinaliza (F48.2+).
 *
 * ## Comparação justa (D5/D18)
 *
 * O alvo de modelo e os parâmetros vivem **no experimento** e são idênticos para
 * as duas variantes. Nenhum schema de variante possui alvo próprio — a única
 * diferença entre baseline e candidata é o prompt:
 *  - baseline = prompt oficial atual (apenas o nome; sem conteúdo do cliente);
 *  - candidata = override completo do prompt sob teste.
 *
 * A validação de visão é **sempre** dispensada nesta fase (D7): o parâmetro
 * `skipInputValidation` é literal `true`.
 */

// ─── Dimensões alteráveis ────────────────────────────────────────────────────

/** Dimensões executáveis na F48.1. */
export const CHANGED_DIMENSIONS = ["prompt"] as const;

/** Dimensões previstas para as fatias seguintes (F48.2+). */
export const FUTURE_CHANGED_DIMENSIONS = ["model", "configuration"] as const;

/** União conhecida pelo schema (aceita pelo enum, filtrada pelo `superRefine`). */
const CHANGED_DIMENSION_VALUES = ["prompt", "model", "configuration"] as const;

// ─── Alvo de modelo e parâmetros (nível do experimento) ──────────────────────

export const LabModelTargetSchema = z
  .object({
    provider: z.enum(["openai", "gemini"]),
    model: z.string().min(1),
    protocol: z.enum(["chat-completions", "responses", "images", "gemini"]),
  })
  .strict();

export type LabModelTarget = z.infer<typeof LabModelTargetSchema>;

export const LabExperimentParamsSchema = z
  .object({
    size: z.string().min(1),
    quality: z.string().min(1),
    /** Validação de visão dispensada pelo override já suportado (D7). */
    skipInputValidation: z.literal(true),
  })
  .strict();

export type LabExperimentParams = z.infer<typeof LabExperimentParamsSchema>;

// ─── Criação do experimento ──────────────────────────────────────────────────

export const CreateLabExperimentInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    objective: z.string().min(1),
    hypothesis: z.string().min(1),
    changedDimension: z.enum(CHANGED_DIMENSION_VALUES),
    /** Alvo fixo do experimento — idêntico para as duas variantes (D5). */
    modelTarget: LabModelTargetSchema,
    params: LabExperimentParamsSchema,
    repetitions: z.number().int().min(1).max(MAX_REPETITIONS),
    maxRuns: z
      .number()
      .int()
      .min(1)
      .max(MAX_RUNS_PER_EXPERIMENT)
      .default(DEFAULT_MAX_RUNS_PER_EXPERIMENT),
    scenarioVersionIds: z
      .array(z.string().uuid())
      .min(1)
      .max(MAX_SCENARIOS_PER_EXPERIMENT),
    /** Baseline é sempre o prompt oficial atual: só o nome atravessa a fronteira. */
    baseline: z
      .object({
        promptName: z.string().min(1),
      })
      .strict(),
    /** Candidata carrega o texto completo alterado (override do snapshot). */
    candidate: z
      .object({
        promptName: z.string().min(1),
        promptContent: z.string().min(1),
      })
      .strict(),
    notes: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((FUTURE_CHANGED_DIMENSIONS as readonly string[]).includes(value.changedDimension)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["changedDimension"],
        message: "unsupported_changed_dimension",
      });
    }
  });

export type CreateLabExperimentInput = z.infer<typeof CreateLabExperimentInputSchema>;

// ─── Avaliação humana ────────────────────────────────────────────────────────

export const LAB_EVALUATION_VERDICTS = ["baseline", "candidate", "tie", "none"] as const;

export const LAB_BLIND_ORDERS = ["baseline_left", "candidate_left"] as const;

export const CreateLabEvaluationInputSchema = z
  .object({
    scenarioVersionId: z.string().uuid(),
    baselineRunId: z.string().uuid(),
    candidateRunId: z.string().uuid(),
    verdict: z.enum(LAB_EVALUATION_VERDICTS),
    blindOrder: z.enum(LAB_BLIND_ORDERS).optional(),
    observation: z.string().max(4000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.baselineRunId === value.candidateRunId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["candidateRunId"],
        message: "run_ids_must_differ",
      });
    }
  });

export type CreateLabEvaluationInput = z.infer<typeof CreateLabEvaluationInputSchema>;

// ─── Erro determinístico de dimensão não suportada ───────────────────────────

/**
 * Lançado quando a criação declara `changedDimension` em `model`/`configuration`.
 * Carrega o código e a dimensão culpada para que o chamador recuse a criação sem
 * ambiguidade e **antes** de qualquer escrita (T-48-1-23).
 */
export class UnsupportedChangedDimensionError extends Error {
  readonly code = "unsupported_changed_dimension" as const;
  readonly dimension: string;

  constructor(dimension: string) {
    super(
      `unsupported_changed_dimension: '${dimension}' não é comparável na F48.1 — o laboratório compara somente o prompt (modelo e configuração ficam para a F48.2).`,
    );
    this.name = "UnsupportedChangedDimensionError";
    this.dimension = dimension;
  }
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function serializeIssues(issues: z.ZodIssue[]): string {
  return JSON.stringify(
    issues.map((issue) => ({ path: issue.path, message: issue.message })),
  );
}

function readChangedDimension(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>).changedDimension;
  return typeof value === "string" ? value : "";
}

/**
 * Valida a entrada de criação do experimento.
 *
 * - `changedDimension` em `model`/`configuration` ⇒ `UnsupportedChangedDimensionError`
 *   (com `code`), antes de qualquer escrita.
 * - Qualquer outra falha ⇒ `Error` com a serialização dos issues (path + message).
 */
export function parseCreateLabExperimentInput(input: unknown): CreateLabExperimentInput {
  const result = CreateLabExperimentInputSchema.safeParse(input);
  if (result.success) return result.data;

  const issues = result.error.issues;
  const dimensionIssue = issues.find(
    (issue) => issue.message === "unsupported_changed_dimension",
  );
  if (dimensionIssue) {
    throw new UnsupportedChangedDimensionError(readChangedDimension(input));
  }

  throw new Error(`Experimento de laboratório inválido: ${serializeIssues(issues)}`);
}

/**
 * Valida a entrada de avaliação humana. Os dois runs comparados precisam ser
 * distintos — a checagem de mesma combinação/experimento/cenário é do serviço de
 * avaliação (48-1-08) sobre esta base.
 */
export function parseCreateLabEvaluationInput(input: unknown): CreateLabEvaluationInput {
  const result = CreateLabEvaluationInputSchema.safeParse(input);
  if (result.success) return result.data;

  throw new Error(`Avaliação de laboratório inválida: ${serializeIssues(result.error.issues)}`);
}
