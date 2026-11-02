import type { SupportedUiLocale } from "@/lib/i18n/locales";

/**
 * Formata a data de criação de uma campanha no idioma da interface e no fuso
 * da loja (F58).
 *
 * Nunca usa o locale/fuso do servidor: quando o fuso da loja não foi resolvido,
 * aplica `UTC` explicitamente (nunca `America/Sao_Paulo` silencioso).
 */
export function formatDashboardDate(
  createdAt: string,
  locale: SupportedUiLocale,
  timeZone: string | null,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timeZone ?? "UTC",
  }).format(new Date(createdAt));
}
