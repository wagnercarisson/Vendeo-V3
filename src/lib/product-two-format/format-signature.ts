import type { TwoFormatFormat } from "./types";

/**
 * F60.7 C3 — assinatura CANÔNICA dos estados dos dois formatos.
 *
 * O cliente tem `formats: { "1:1": "delivered", ... }`, enquanto o endpoint de
 * status devolve `{ "1:1": { state: "delivered", deliveryOperationId } }`.
 * Comparar os objetos completos faria estados iguais parecerem diferentes.
 * Este helper reduz as duas formas ao mesmo texto estável, sem IDs/URLs.
 */

export type TwoFormatStateInput =
  | string
  | { readonly state?: string | null }
  | null
  | undefined;

type TwoFormatStatesRecord = Readonly<
  Partial<Record<TwoFormatFormat, TwoFormatStateInput>>
>;

function stateOf(value: TwoFormatStateInput): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.state === "string") {
    return value.state;
  }
  return "missing";
}

export function twoFormatStatesSignature(formats: TwoFormatStatesRecord): string {
  return `1:1=${stateOf(formats["1:1"])};9:16=${stateOf(formats["9:16"])}`;
}

/** Estados em que não há mais progresso útil a acompanhar. */
export function isSettledTwoFormatState(state: string): boolean {
  return (
    state === "delivered" ||
    state === "absent" ||
    state === "unknown" ||
    state === "unavailable"
  );
}

/** `true` quando ambos os formatos chegaram a um estado estável. */
export function areBothTwoFormatStatesSettled(
  formats: TwoFormatStatesRecord,
): boolean {
  return (
    isSettledTwoFormatState(stateOf(formats["1:1"])) &&
    isSettledTwoFormatState(stateOf(formats["9:16"]))
  );
}
