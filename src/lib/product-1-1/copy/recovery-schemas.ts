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
 * A IDENTIDADE DE ACIONAMENTO (tentativa) é EXCLUSIVAMENTE SERVER-SIDE. O
 * `attemptSeq`/`attemptToken` do cliente, QUANDO PRESENTES, são SOLICITAÇÕES —
 * NUNCA autoridade: o serviço os ignora e resolve a identidade corrente pela
 * aquisição atômica. Por isso o corpo REAL emitido pela UI
 * (`{ mode, operationId, requestToken }`) NÃO os carrega (CR-01): o schema
 * ACEITA a ausência, mas ainda VALIDA os campos quando enviados.
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
    // OPCIONAIS — a UI nunca os envia (a identidade é server-side); quando
    // enviados, ainda são VALIDADOS (1..6 / não-vazio). Ausência aceita.
    attemptSeq: z.number().int().min(1).max(6).optional(),
    attemptToken: z.string().min(1).optional(),
    // OBRIGATÓRIO — SEM `.optional()`: a ausência é recusada antes de qualquer
    // aquisição/provider (o serviço devolve `missing_request_token`).
    requestToken: z.string().uuid(),
  })
  .strict();

export type CopyRecoveryRequest = z.infer<typeof CopyRecoveryRequestSchema>;
