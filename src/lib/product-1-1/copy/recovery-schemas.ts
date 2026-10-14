import { z } from "zod";

/**
 * F56.2b2a (B2.1 / B2A-D3/D5) — Zod ESTRITO do corpo da ação explícita de
 * recuperação de copy do Produto 1:1.
 *
 * `mode`, sequência, token e `requestToken` enviados pelo cliente são
 * SOLICITAÇÕES — NUNCA AUTORIDADE. O serviço resolve a identidade corrente
 * SERVER-SIDE e usa o `requestToken` apenas como CONDIÇÃO de dedupe do MESMO
 * acionamento (`already_acquired`); ele nunca escolhe o vencedor.
 *
 * A identidade de acionamento (`requestToken`) é OBRIGATÓRIA (critério 24):
 * ausência ⇒ recusa (`missing_request_token`), SEM aquisição nem IA. A tentativa
 * INICIAL interna (drenagem no ciclo do orquestrador) é a ÚNICA que gera o
 * PRÓPRIO token server-side.
 *
 * `.strict()` REJEITA campos desconhecidos.
 */
export const CopyRecoveryRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    mode: z.enum(["auto_retry", "manual"]),
    attemptSeq: z.number().int().min(1).max(6),
    attemptToken: z.string().min(1),
    // OBRIGATÓRIO — SEM `.optional()`: a ausência é recusada antes de qualquer
    // aquisição/provider (o serviço devolve `missing_request_token`).
    requestToken: z.string().uuid(),
  })
  .strict();

export type CopyRecoveryRequest = z.infer<typeof CopyRecoveryRequestSchema>;
