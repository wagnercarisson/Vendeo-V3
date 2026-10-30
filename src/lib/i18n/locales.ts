/**
 * Locales da interface (F57.4).
 *
 * Reutiliza a fonte de verdade da F57.3 (`src/lib/market-context`). Não
 * redeclara a união de locales nem os valores suportados.
 */

import { SUPPORTED_UI_LOCALES } from "@/lib/market-context";
import type { SupportedUiLocale } from "@/lib/market-context";

export { SUPPORTED_UI_LOCALES };
export type { SupportedUiLocale };

export const DEFAULT_UI_LOCALE = "pt-BR" as const;

export interface UiLocaleOption {
  readonly value: SupportedUiLocale;
  readonly label: string;
}

/**
 * Opções endônimas: cada idioma é nomeado no próprio idioma, idêntico em
 * ambos os catálogos.
 */
export const UI_LOCALE_OPTIONS: readonly UiLocaleOption[] = Object.freeze([
  Object.freeze({ value: "pt-BR", label: "Português (Brasil)" }),
  Object.freeze({ value: "es-419", label: "Español (Latinoamérica)" }),
]);
