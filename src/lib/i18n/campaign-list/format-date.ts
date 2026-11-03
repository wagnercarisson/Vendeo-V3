import type { SupportedUiLocale } from "@/lib/i18n/locales";

/**
 * Formata a data de criação de uma campanha no idioma da interface.
 *
 * Preserva a semântica anterior da listagem: usa os componentes locais do
 * `Date` (dia/mês/ano), sem fixar `timeZone`, sem adotar o fuso da loja e sem
 * converter UTC. Apenas a formatação passa a ser dirigida pelo `uiLocale`.
 */
export function formatCampaignListDate(
  createdAt: string,
  locale: SupportedUiLocale,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(createdAt));
}
