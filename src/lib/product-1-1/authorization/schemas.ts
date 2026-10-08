import { z } from "zod";

/** Corpo do POST de concessão (validação server-side; o actor vem do requireAdmin). */
export const GrantStageAuthorizationRequestSchema = z
  .object({
    stage: z.enum(["off", "isolated_pilot", "test_stores", "all_stores"]),
    scope: z.enum(["test_stores", "all_stores"]),
    reason: z.string().min(1).max(500),
    operationId: z.string().uuid(),
  })
  .strict(); // REJEITA campos desconhecidos — a identidade da instância NÃO vem do payload.

/** Filtro do GET de histórico (a identidade da instância é derivada no servidor). */
export const StageAuthorizationQuerySchema = z.object({
  scope: z.enum(["test_stores", "all_stores"]),
});

export type GrantStageAuthorizationRequest = z.infer<
  typeof GrantStageAuthorizationRequestSchema
>;

export type StageAuthorizationQuery = z.infer<
  typeof StageAuthorizationQuerySchema
>;
