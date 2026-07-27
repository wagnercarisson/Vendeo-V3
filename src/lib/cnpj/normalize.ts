export function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, "");
}
