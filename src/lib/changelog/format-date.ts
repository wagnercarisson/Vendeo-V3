const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formata data ISO `YYYY-MM-DD` como `dd/mm/aaaa` sem converter fuso horário.
 * PROIBIDO usar `new Date(dateIso)`/`toLocaleDateString` aqui: o parser ISO UTC
 * desloca a data para o dia anterior em UTC-3. Se a string não casar o regex,
 * retorna a própria string intacta (fail-safe, sem lançar).
 */
export function formatChangelogDate(dateIso: string): string {
  const match = ISO_DATE_REGEX.exec(dateIso);
  if (!match) return dateIso;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
