import { z } from "zod";

/** Corpo do POST de concessão (validação server-side; o actor vem do requireAdmin). */
export const GrantStageAuthorizationRequestSchema = z.object({
  stage: z.enum(["off", "isolated_pilot", "test_stores", "all_stores"]),
  scope: z.enum(["test_stores", "all_stores"]),
  instanceIdentity: z.string().min(1).max(200),
  reason: z.string().min(1).max(500),
  operationId: z.string().uuid(),
});

/** Filtro do GET de histórico. */
export const StageAuthorizationQuerySchema = z.object({
  scope: z.enum(["test_stores", "all_stores"]),
  instanceIdentity: z.string().min(1).max(200),
});

export type GrantStageAuthorizationRequest = z.infer<
  typeof GrantStageAuthorizationRequestSchema
>;

export type StageAuthorizationQuery = z.infer<
  typeof StageAuthorizationQuerySchema
>;
