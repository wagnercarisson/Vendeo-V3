export function humanizeLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getLabel(map: Record<string, string>, value: string): string {
  return map[value] ?? humanizeLabel(value);
}
