/**
 * F60.7 C2 — normalizador ÚNICO do terminal conjunto.
 *
 * Usado pelo formulário (stream inicial/continuação), pela consulta de status e
 * pela superfície de resultado desconhecido. `result` nunca é sucesso por si só:
 * o estado dos dois formatos e `operationTerminal` decidem.
 */

export type TwoFormatClientFormatState =
  | "delivered"
  | "processing"
  | "absent"
  | "unknown"
  | "unavailable";

export type TwoFormatClientFormats = Record<
  "1:1" | "9:16",
  { readonly state: TwoFormatClientFormatState }
>;

export type NormalizedTwoFormatOutcome =
  | { readonly kind: "complete"; readonly formats: TwoFormatClientFormats }
  | { readonly kind: "partial_terminal"; readonly formats: TwoFormatClientFormats }
  | {
      readonly kind: "partial_indeterminate";
      readonly formats: TwoFormatClientFormats;
    }
  | {
      readonly kind: "finalization_pending";
      readonly formats: TwoFormatClientFormats;
      readonly canContinue: boolean;
      readonly nextStep: string | null;
    }
  | { readonly kind: "refunded"; readonly formats: TwoFormatClientFormats }
  | { readonly kind: "unknown"; readonly formats: TwoFormatClientFormats }
  | {
      readonly kind: "processing";
      readonly formats: TwoFormatClientFormats;
      readonly canContinue: boolean;
      readonly nextStep: string | null;
    }
  | { readonly kind: "error"; readonly formats: TwoFormatClientFormats };

export function normalizeTwoFormatOutcome(input: {
  readonly formats: TwoFormatClientFormats;
  readonly operationTerminal?: boolean;
  readonly canContinue?: boolean;
  readonly nextStep?: string | null;
  readonly event?: "result" | "processing" | "unknown" | "error";
  readonly refunded?: boolean;
}): NormalizedTwoFormatOutcome {
  const { formats } = input;
  const square = formats["1:1"].state;
  const vertical = formats["9:16"].state;
  const delivered =
    (square === "delivered" ? 1 : 0) + (vertical === "delivered" ? 1 : 0);

  if (input.event === "unknown") return { kind: "unknown", formats };
  if (input.event === "error") {
    return input.refunded === true
      ? { kind: "refunded", formats }
      : { kind: "error", formats };
  }

  if (delivered === 2) return { kind: "complete", formats };

  if (delivered === 1) {
    const other = square === "delivered" ? vertical : square;
    if (other === "absent") return { kind: "partial_terminal", formats };
    if (other === "processing") {
      return {
        kind: "processing",
        formats,
        canContinue: input.canContinue === true,
        nextStep: input.nextStep ?? null,
      };
    }
    return { kind: "partial_indeterminate", formats };
  }

  if (square === "absent" && vertical === "absent") {
    return { kind: "refunded", formats };
  }

  const anyUnknown =
    square === "unknown" ||
    vertical === "unknown" ||
    square === "unavailable" ||
    vertical === "unavailable";
  if (anyUnknown) return { kind: "unknown", formats };

  const finalizationPending =
    (square === "absent" && vertical === "processing") ||
    (vertical === "absent" && square === "processing");
  if (finalizationPending) {
    return {
      kind: "finalization_pending",
      formats,
      canContinue: input.canContinue === true,
      nextStep: input.nextStep ?? null,
    };
  }

  return {
    kind: "processing",
    formats,
    canContinue: input.canContinue === true,
    nextStep: input.nextStep ?? null,
  };
}

export function eventFormats(
  event: Record<string, unknown>,
): TwoFormatClientFormats | null {
  const raw = event.formats as
    | Record<string, { state?: unknown }>
    | undefined;
  const square = raw?.["1:1"]?.state;
  const vertical = raw?.["9:16"]?.state;
  const valid = new Set<TwoFormatClientFormatState>([
    "delivered",
    "processing",
    "absent",
    "unknown",
    "unavailable",
  ]);
  if (
    typeof square !== "string" ||
    typeof vertical !== "string" ||
    !valid.has(square as TwoFormatClientFormatState) ||
    !valid.has(vertical as TwoFormatClientFormatState)
  ) {
    return null;
  }
  return {
    "1:1": { state: square as TwoFormatClientFormatState },
    "9:16": { state: vertical as TwoFormatClientFormatState },
  };
}
