/**
 * F56.2b1a — Campos EXCLUSIVOS do novo fluxo Produto 1:1.
 *
 * Fonte única da lista. Um campo só é exclusivo se NÃO existir em
 * `GenerateImageRequestSchema` (`src/lib/image-generation/schema.ts`). O schema
 * legado é `.strict()` e REJEITA campos desconhecidos (não os descarta):
 * `campaignIntent` JÁ existe no schema legado e NÃO é exclusivo; o único campo
 * hoje confirmado como exclusivo é `backgroundDirection`.
 *
 * O detector opera sobre o CORPO BRUTO (antes do parse estrito) para que o guard
 * possa recusar um payload do novo fluxo inelegível antes da validação de schema
 * e antes de qualquer reserva de crédito.
 */
export type ExclusiveNewFlowField = "backgroundDirection";

export const EXCLUSIVE_NEW_FLOW_FIELDS = Object.freeze([
  "backgroundDirection",
] as const satisfies readonly ExclusiveNewFlowField[]);

/** Retorna os campos exclusivos do novo fluxo presentes no corpo bruto. */
export function detectExclusiveNewFlowFields(
  rawBody: unknown,
): ExclusiveNewFlowField[] {
  if (rawBody === null || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return [];
  }

  const record = rawBody as Record<string, unknown>;
  return EXCLUSIVE_NEW_FLOW_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(record, field),
  );
}
