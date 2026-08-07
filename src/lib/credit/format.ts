export function formatCredits(value: number): string {
  if (value <= 0) return "0 créditos";
  if (value === 1) return "1 crédito";
  return `${value} créditos`;
}
