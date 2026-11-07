import { z } from "zod";

/**
 * Contrato da **execução de expansão** (quick 261107-qvo).
 *
 * Diferente de `BenchRunInputSchema`, não exige produto/oferta nem compositor
 * comercial. A única imagem de origem é a campanha pronta a preservar; o
 * prompt aprovado é a única fonte do texto enviado.
 */

const BENCH_REFERENCE_PREFIX = "bench/";

function isExpandInputReference(reference: string, runId: string): boolean {
  if (
    reference.includes("..") ||
    reference.includes("\\") ||
    reference.includes("://") ||
    reference.includes("?") ||
    reference.includes("#")
  ) {
    return false;
  }
  const prefix = `${BENCH_REFERENCE_PREFIX}${runId}/inputs/`;
  if (!reference.startsWith(prefix)) return false;
  const rest = reference.slice(prefix.length);
  return rest.length > 0 && !rest.startsWith("/") && !rest.includes("//");
}

export const BenchExpandRunInputSchema = z
  .object({
    operationId: z.string().uuid(),
    runId: z.string().uuid(),
    storeId: z.string().uuid(),
    presetId: z.string().min(1),
    /** Texto final aprovado — única fonte do prompt enviado. */
    promptApproved: z.string().min(1),
    /** Exatamente uma imagem de campanha pronta. */
    references: z.array(z.string().min(1)).length(1),
    /** Confirmação financeira explícita. */
    confirmed: z.literal(true),
    /** Versão do baseline de prompt (opcional; validada na rota). */
    promptVersion: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    value.references.forEach((reference, index) => {
      if (!isExpandInputReference(reference, value.runId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["references", index],
          message: "invalid_bench_expand_reference_path",
        });
      }
    });
  });

export type BenchExpandRunInput = z.infer<typeof BenchExpandRunInputSchema>;

export function parseBenchExpandRunInput(input: unknown): BenchExpandRunInput {
  const result = BenchExpandRunInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new Error(
    `Entrada de expansão inválida: ${JSON.stringify(
      result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    )}`,
  );
}
